import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import FindingDetailModal from '../../../pages/Auditor/FindingManagement/FindingDetailModal';
import { createAction, getActionsByFinding, type Action, rejectActionForResubmit } from '../../../api/actions';
import { getAdminUsersByDepartment, getUserById } from '../../../api/adminUsers';
import { markFindingAsReceived } from '../../../api/findings';
import apiClient from '../../../api/client';
import { Pagination } from '../../../components';
import AuditeeActionReviewModal from './AuditeeActionReviewModal';
import { toast } from 'react-toastify';
import { getStatusColor } from '../../../constants';

const FindingsProgress = () => {
  const { user } = useAuth();
  const { auditId } = useParams<{ auditId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const auditIdFromState = (location.state as any)?.auditId || auditId || '';
  const auditTitle = (location.state as any)?.auditTitle || '';

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingForAssign, setSelectedFindingForAssign] = useState<Finding | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffMembers, setStaffMembers] = useState<Array<{ userId: string; fullName: string; email?: string }>>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [showAssignConfirmModal, setShowAssignConfirmModal] = useState(false);
  const [selectedStaffError, setSelectedStaffError] = useState('');
  const [dueDateError, setDueDateError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionFindingId, setSelectedActionFindingId] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);

  const [selectedFindingActions, setSelectedFindingActions] = useState<Action[]>([]);
  const [loadingFindingActions, setLoadingFindingActions] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;
  const [assignedUsersMap, setAssignedUsersMap] = useState<Record<string, string>>({}); // findingId -> assignedUserName
  const [returnedActionsMap, setReturnedActionsMap] = useState<Record<string, Action>>({}); // findingId -> returned action
  const [rejectedActionsMap, setRejectedActionsMap] = useState<Record<string, Action>>({}); // findingId -> rejected action
  const [rootCauseStatusMap, setRootCauseStatusMap] = useState<Record<string, { hasApproved: boolean; hasPending: boolean; hasRejected: boolean; allApproved: boolean; totalCount: number }>>({}); // findingId -> root cause status
  
  // New states for root cause assignment
  const [findingRootCauses, setFindingRootCauses] = useState<any[]>([]); // Root causes of selected finding
  const [loadingRootCauses, setLoadingRootCauses] = useState(false);
  const [rootCauseStaffMap, setRootCauseStaffMap] = useState<Record<number, string>>({}); // rootCauseId -> staffId
  const [rootCauseAssignError, setRootCauseAssignError] = useState('');

    // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    return getStatusColor(status) || 'bg-gray-100 text-gray-700';
  };

  // Get user's department ID from token
  const getUserDeptId = (): number | null => {
    const token = localStorage.getItem('auth-storage');
    if (!token) return null;
    
    try {
      const authData = JSON.parse(token);
      const jwtToken = authData?.state?.token;
      if (jwtToken) {
        const base64Url = jwtToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const deptId = payload['DeptId'];
        return deptId ? parseInt(deptId) : null;
      }
    } catch (err) {
      console.error('Error parsing token:', err);
    }
    return null;
  };

  // Load root cause status for findings
  const loadRootCauseStatus = async (findingsData: Finding[]) => {
    const statusMap: Record<string, { hasApproved: boolean; hasPending: boolean; hasRejected: boolean; allApproved: boolean; totalCount: number }> = {};
    
    await Promise.all(
      findingsData.map(async (finding) => {
        try {
          const res = await apiClient.get(`/RootCauses/by-finding/${finding.findingId}`);
          const rootCauses = res.data.$values || [];
          const totalCount = rootCauses.length;
          const approvedCount = rootCauses.filter((rc: any) => rc.status?.toLowerCase() === 'approved').length;
          
          statusMap[finding.findingId] = {
            hasApproved: rootCauses.some((rc: any) => rc.status?.toLowerCase() === 'approved'),
            hasPending: rootCauses.some((rc: any) => rc.status?.toLowerCase() === 'pending'),
            hasRejected: rootCauses.some((rc: any) => rc.status?.toLowerCase() === 'rejected'),
            allApproved: totalCount > 0 && approvedCount === totalCount,
            totalCount: totalCount,
          };
        } catch (err) {
          console.warn(`Failed to load root causes for finding ${finding.findingId}`, err);
          statusMap[finding.findingId] = { hasApproved: false, hasPending: false, hasRejected: false, allApproved: false, totalCount: 0 };
        }
      })
    );
    
    setRootCauseStatusMap(statusMap);
  };

  // Load assigned users and returned actions for findings
  const loadAssignedUsers = async (findingsData: Finding[]) => {
    const usersMap: Record<string, string> = {};
    const returnedMap: Record<string, Action> = {};
    const rejectedMap: Record<string, Action> = {};
    
    // Load actions for each finding and get assignedTo
    await Promise.all(
      findingsData.map(async (finding) => {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          if (actions && actions.length > 0) {
            // Check for returned actions
            const returnedAction = actions.find(a => a.status?.toLowerCase() === 'returned');
            if (returnedAction) {
              returnedMap[finding.findingId] = returnedAction;
            }
            
            // Check for rejected actions
            const rejectedAction = actions.find(a => a.status?.toLowerCase() === 'rejected');
            if (rejectedAction) {
              rejectedMap[finding.findingId] = rejectedAction;
            }
            
            // Get all unique assignedTo users
            const uniqueAssignedUsers = new Set<string>();
            actions.forEach(action => {
              if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                uniqueAssignedUsers.add(action.assignedTo);
              }
            });
            
            // Fetch all user names
            const userNames: string[] = [];
            for (const userId of Array.from(uniqueAssignedUsers)) {
              try {
                const user = await getUserById(userId);
                userNames.push(user.fullName || user.email || userId);
              } catch (err) {
                console.warn(`Failed to fetch user info for ${userId}`, err);
                userNames.push(userId);
              }
            }
            
            // Store as comma-separated names or count if more than 2
            if (userNames.length > 0) {
              if (userNames.length === 1) {
                usersMap[finding.findingId] = userNames[0];
              } else if (userNames.length === 2) {
                usersMap[finding.findingId] = userNames.join(', ');
              } else {
                usersMap[finding.findingId] = `${userNames[0]} +${userNames.length - 1} others`;
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to load actions for finding ${finding.findingId}`, err);
        }
      })
    );
    
    setAssignedUsersMap(usersMap);
    setReturnedActionsMap(returnedMap);
    setRejectedActionsMap(rejectedMap);
  };

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const deptId = getUserDeptId();
        if (!deptId) {
          setError('Department ID not found in token');
          return;
        }

        const allFindings = await getFindingsByDepartment(deptId);
        
        // Filter findings by auditId if provided
        let filteredFindings = allFindings;
        if (auditIdFromState) {
          console.log(`🔍 Filtering findings by auditId: ${auditIdFromState}`);
          filteredFindings = allFindings.filter((finding: Finding) => {
            const findingAuditId = finding.auditId || (finding as any).AuditId || (finding as any).auditPlanId;
            return String(findingAuditId) === String(auditIdFromState);
          });
          console.log(`✅ Filtered findings: ${filteredFindings.length} out of ${allFindings.length} for audit ${auditIdFromState}`);
        }
        
        setFindings(filteredFindings);
        
        // Load assigned users and root cause status for findings
        await loadAssignedUsers(filteredFindings);
        await loadRootCauseStatus(filteredFindings);
      } catch (err: any) {
        console.error('Error fetching findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, [auditIdFromState]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Filter findings based on search query
  const getFilteredFindings = () => {
    let filtered = findings;
    
    // Filter out findings with status "Archived"
    filtered = filtered.filter(finding => {
      const statusLower = (finding.status || '').toLowerCase().trim();
      return statusLower !== 'archived';
    });
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(finding => 
        finding.title?.toLowerCase().includes(query) ||
        finding.description?.toLowerCase().includes(query) ||
        finding.findingId?.toLowerCase().includes(query) ||
        finding.severity?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const filteredFindings = getFilteredFindings();


  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };


  // Toggle staff selection for a root cause
  const handleSelectStaffForRootCause = (rootCauseId: number, staffId: string) => {
    setRootCauseStaffMap(prev => ({
      ...prev,
      [rootCauseId]: staffId
    }));
    
    // Add staff to selected list if not already there
    if (!selectedStaff.includes(staffId)) {
      setSelectedStaff(prev => [...prev, staffId]);
    }
    
    // Clear errors
    if (rootCauseAssignError) setRootCauseAssignError('');
    if (selectedStaffError) setSelectedStaffError('');
  };



  // Load root causes for the selected finding
  const loadFindingRootCauses = async (findingId: string) => {
    setLoadingRootCauses(true);
    try {
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCauses = res.data.$values || [];
      // Only show approved root causes
      const approvedRootCauses = rootCauses.filter((rc: any) => rc.status?.toLowerCase() === 'approved');
      setFindingRootCauses(approvedRootCauses);
      console.log('📝 Loaded root causes for assignment:', approvedRootCauses);
    } catch (err) {
      console.error('Error loading root causes:', err);
      setFindingRootCauses([]);
    } finally {
      setLoadingRootCauses(false);
    }
  };

  // Load staff members for assignment (only CAPAOwner role)
  const loadStaffMembers = async (deptId?: number) => {
    if (!deptId) return;
    
    setLoadingStaff(true);
    try {
      const users = await getAdminUsersByDepartment(deptId);
      // Filter only CAPAOwner role
      const capaOwners = (users || []).filter((user: any) => 
        user.roleName?.toLowerCase() === 'capaowner'
      );
      setStaffMembers(capaOwners.map((user: any) => ({
        userId: user.userId || user.id,
        fullName: user.fullName || user.name || user.email || 'Unknown',
        email: user.email,
      })));
    } catch (err: any) {
      console.error('Error loading staff members:', err);
      setStaffMembers([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Handle assign finding - show confirmation first
  const handleAssign = () => {
    // Reset errors
    setSelectedStaffError('');
    setDueDateError('');

    // Validate fields
    let hasError = false;

    if (!selectedStaff || selectedStaff.length === 0) {
      setSelectedStaffError('Please select at least one staff member');
      hasError = true;
    }

    if (!dueDate) {
      setDueDateError('Please select a due date');
      hasError = true;
    } else if (selectedFindingForAssign) {
      // Validate due date
      const dueDateObj = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if due date is in the past
      if (dueDateObj < today) {
        setDueDateError('Due date cannot be in the past');
        hasError = true;
      }
      
      // Check if due date exceeds finding deadline
      if (selectedFindingForAssign.deadline) {
        const findingDeadline = new Date(selectedFindingForAssign.deadline);
        findingDeadline.setHours(23, 59, 59, 999); // End of day
        
        if (dueDateObj > findingDeadline) {
          const deadlineStr = formatDate(selectedFindingForAssign.deadline);
          setDueDateError(`Due date cannot exceed finding deadline (${deadlineStr})`);
          hasError = true;
        }
      }
    }

    if (!selectedFindingForAssign) {
      // This shouldn't happen, but handle it silently
      return;
    }

    // If validation passes, show confirmation modal
    if (!hasError) {
      setShowAssignConfirmModal(true);
    }
  };

  // Confirm and actually assign finding (create action)
  const handleConfirmAssign = async () => {
    if (!selectedFindingForAssign) {
      return;
    }

    // Validate that all root causes are assigned if there are any
    if (findingRootCauses.length > 0) {
      const unassignedRootCauses = findingRootCauses.filter(
        rc => !rootCauseStaffMap[rc.rootCauseId]
      );
      
      if (unassignedRootCauses.length > 0) {
        setRootCauseAssignError(`Please assign all ${findingRootCauses.length} root causes to staff members`);
        setShowAssignConfirmModal(false);
        return;
      }
    }

    setShowAssignConfirmModal(false);
    setSubmittingAssign(true);

    try {
      // First, mark finding as received
      await markFindingAsReceived(selectedFindingForAssign.findingId);
      
      // Get unique staff IDs from root cause assignments
      const assignedStaffIds = new Set(Object.values(rootCauseStaffMap));
      
      // Group root causes by assigned staff
      const staffRootCausesMap: Record<string, any[]> = {};
      Object.entries(rootCauseStaffMap).forEach(([rootCauseId, staffId]) => {
        if (!staffRootCausesMap[staffId]) {
          staffRootCausesMap[staffId] = [];
        }
        const rootCause = findingRootCauses.find(rc => rc.rootCauseId === parseInt(rootCauseId));
        if (rootCause) {
          staffRootCausesMap[staffId].push(rootCause);
        }
      });
      
      // Create actions for each staff member with their assigned root causes
      const actionPromises = Array.from(assignedStaffIds).map(staffId => {
        const assignedRootCauses = staffRootCausesMap[staffId] || [];
        
        // Build description with assigned root causes
        let actionDescription = selectedFindingForAssign.description || '';
        if (assignedRootCauses.length > 0) {
          actionDescription += '\n\n Assigned Root Causes:\n' + 
            assignedRootCauses.map((rc, index) => 
              `${index + 1}. ${rc.name} (${rc.category})`
            ).join('\n');
        }
        
        return createAction({
          findingId: selectedFindingForAssign.findingId,
          title: selectedFindingForAssign.title,
          description: actionDescription,
          assignedTo: staffId,
          assignedDeptId: selectedFindingForAssign.deptId || 0,
          progressPercent: 0,
          dueDate: new Date(dueDate).toISOString(),
          reviewFeedback: '',
        });
      });
      
      // Wait for all actions to be created
      await Promise.all(actionPromises);

      // Reset form and close modal
      const assignedStaffCount = new Set(Object.values(rootCauseStaffMap)).size;
      const rootCauseCount = findingRootCauses.length;
      
      setSelectedStaff([]);
      setDueDate('');
      setSelectedStaffError('');
      setDueDateError('');
      setSelectedFindingForAssign(null);
      setShowAssignModal(false);
      setRootCauseStaffMap({});
      setFindingRootCauses([]);
      setRootCauseAssignError('');
      
      // Show success toast
      toast.success(`Finding assigned successfully to ${assignedStaffCount} staff member${assignedStaffCount > 1 ? 's' : ''} with ${rootCauseCount} root cause${rootCauseCount > 1 ? 's' : ''}`);
      
      // Reload findings and assigned users
      const deptId = getUserDeptId();
      if (deptId) {
        const data = await getFindingsByDepartment(deptId);
        setFindings(data);
        await loadAssignedUsers(data);
        await loadRootCauseStatus(data);
      }
    } catch (err: any) {
      console.error('Error creating action:', err);
      // Show error toast
      toast.error(err?.message || 'Failed to assign finding');
      // Also show error in UI
      setRootCauseAssignError(err?.message || 'Failed to create action');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle close assign modal
  const handleCloseAssignModal = () => {
    setSelectedStaff([]);
    setDueDate('');
    setSelectedStaffError('');
    setDueDateError('');
    setSelectedFindingForAssign(null);
    setRootCauseStaffMap({});
    setFindingRootCauses([]);
    setRootCauseAssignError('');
    setShowAssignModal(false);
  };



  // Pagination calculations
  const totalPages = Math.ceil(filteredFindings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFindings = filteredFindings.slice(startIndex, endIndex);

  // Reset to page 1 when findings or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [findings.length, searchQuery]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            <div className="flex items-center gap-3">
              {auditIdFromState && (
                <button
                  onClick={() => navigate('/auditee-owner/findings')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span>
                {auditTitle ? `${auditTitle} - Findings Progress` : 'Findings Progress'}
              </span>
            </div>
          </h1>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading findings...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Findings Table */}
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
              {/* Header with Search */}
              <div className="border-b border-gray-200 bg-gray-50">
                <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Findings List ({filteredFindings.length})
                  </h2>
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-primary-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search findings..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="block w-full pl-10 pr-10 py-2 border-2 border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm shadow-sm hover:border-gray-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setCurrentPage(1);
                          }}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center group"
                        >
                          <div className="p-1 rounded-full bg-gray-100 group-hover:bg-red-100 transition-colors duration-200">
                            <svg className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings Table */}
              {filteredFindings.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">
                    {searchQuery ? `No findings found matching "${searchQuery}"` : 'No findings found for your department'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th className="px-3 sm:px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedFindings.map((finding) => (
                        <tr 
                          key={finding.findingId} 
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={async () => {
                            setLoadingFindingActions(true);
                            setShowActionsModal(true);
                            try {
                              const actions = await getActionsByFinding(finding.findingId);
                              setSelectedFindingActions(Array.isArray(actions) ? actions : []);
                              setSelectedFindingId(finding.findingId);
                            } catch (err: any) {
                              console.error('Error loading actions:', err);
                              setSelectedFindingActions([]);
                            } finally {
                              setLoadingFindingActions(false);
                            }
                          }}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              {returnedActionsMap[finding.findingId] && (
                                <div className="relative group flex-shrink-0">
                                  <div className="w-2 h-2 bg-red-500 rounded-full cursor-help"></div>
                                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                    <div className="font-semibold mb-1">Feedback:</div>
                                    <div className="text-gray-300">
                                      {returnedActionsMap[finding.findingId].reviewFeedback || 'No feedback provided'}
                                    </div>
                                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              )}
                              <div className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                                {finding.title}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(finding.severity)}`}>
                              {finding.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(finding.status)}`}>
                              {finding.status || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(finding.deadline)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                            {assignedUsersMap[finding.findingId] ? (
                              <span className="font-medium">{assignedUsersMap[finding.findingId]}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                              {returnedActionsMap[finding.findingId] ? (
                                <button
                                  onClick={async () => {
                                    const action = returnedActionsMap[finding.findingId];
                                    if (!action) return;
                                    
                                    try {
                                      await rejectActionForResubmit(action.actionId);
                                      toast.success('Action redone successfully');
                                      // Reload findings and actions
                                      const deptId = getUserDeptId();
                                      if (deptId) {
                                        const data = await getFindingsByDepartment(deptId);
                                        setFindings(data);
                                        await loadAssignedUsers(data);
                                        await loadRootCauseStatus(data);
                                      }
                                    } catch (err: any) {
                                      console.error('Error resubmitting action:', err);
                                      toast.error(err?.message || 'Failed to redo action');
                                    }
                                  }}
                                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors active:scale-95"
                                  title="Redo Action"
                                >
                                  Redo
                                </button>
                              ) : rejectedActionsMap[finding.findingId] ? (
                                <button
                                  disabled
                                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                  title="Action Rejected"
                                >
                                  Rejected
                                </button>
                              ) : finding.status?.toLowerCase() === 'received' || finding.status?.toLowerCase() === 'closed' ? (
                                // Don't show any button when already assigned or closed
                                null
                              ) : (() => {
                                const rcStatus = rootCauseStatusMap[finding.findingId];
                                const allApproved = rcStatus?.allApproved || false;
                                const hasPendingRC = rcStatus?.hasPending || false;
                                const hasRejectedRC = rcStatus?.hasRejected || false;
                                const totalCount = rcStatus?.totalCount || 0;
                                
                                // Show appropriate button based on root cause status
                                // Only allow assign when ALL root causes are approved
                                if (totalCount === 0) {
                                  return (
                                    <button
                                      disabled
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                      title="Please add root cause first"
                                    >
                                      No Root Cause
                                    </button>
                                  );
                                } else if (hasPendingRC) {
                                  return (
                                    <button
                                      disabled
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg cursor-not-allowed opacity-80"
                                      title="Some root causes are pending review"
                                    >
                                      Pending Review
                                    </button>
                                  );
                                } else if (hasRejectedRC) {
                                  return (
                                    <button
                                      disabled
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-700 bg-red-100 rounded-lg cursor-not-allowed opacity-80"
                                      title="Some root causes were rejected - please update"
                                    >
                                      RC Rejected
                                    </button>
                                  );
                                } else if (allApproved) {
                                  // All root causes approved - allow assign
                                  return (
                                    <button
                                      onClick={() => {
                                        setSelectedFindingForAssign(finding);
                                        setShowAssignModal(true);
                                        loadStaffMembers(finding.deptId);
                                        loadFindingRootCauses(finding.findingId);
                                        // Reset root cause assignments
                                        setRootCauseStaffMap({});
                                        setRootCauseAssignError('');
                                      }}
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors active:scale-95"
                                      title="All root causes approved - ready to assign"
                                    >
                                      Assign
                                    </button>
                                  );
                                } else {
                                  // Fallback: not all approved
                                  return (
                                    <button
                                      disabled
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                      title="Not all root causes are approved yet"
                                    >
                                      Incomplete
                                    </button>
                                  );
                                }
                              })()}
                              {/* View Action button - show if finding has actions */}
                              {(() => {
                                // Check if finding has any action (assigned, returned, or rejected)
                                const hasAction = assignedUsersMap[finding.findingId] || 
                                                  returnedActionsMap[finding.findingId] || 
                                                  rejectedActionsMap[finding.findingId] ||
                                                  finding.status?.toLowerCase() === 'received';
                                
                                if (hasAction) {
                                  return (
                                    <button
                                      onClick={async () => {
                                        try {
                                          // Load actions for this finding
                                          const actions = await getActionsByFinding(finding.findingId);
                                          const actionsList = Array.isArray(actions) ? actions : [];
                                          
                                          if (actionsList.length > 0) {
                                            // Get the first action (or most recent one)
                                            const firstAction = actionsList[0];
                                            setSelectedActionId(firstAction.actionId);
                                            setSelectedActionFindingId(finding.findingId);
                                            setShowActionDetailModal(true);
                                            console.log('Opening action modal - ActionId:', firstAction.actionId, 'FindingId:', finding.findingId);
                                          } else {
                                            toast.info('No actions found for this finding');
                                          }
                                        } catch (err: any) {
                                          console.error('Error loading actions:', err);
                                          toast.error(err?.message || 'Failed to load actions');
                                        }
                                      }}
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors active:scale-95"
                                      title="View Action"
                                    >
                                      View Action
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              <button
                                onClick={() => {
                                  setSelectedFindingId(finding.findingId);
                                  setShowDetailModal(true);
                                }}
                                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95"
                                title="View Details"
                              >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredFindings.length > 0 && (
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Finding Detail Modal */}
        {selectedFindingId && (
          <FindingDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedFindingId(null);
            }}
            findingId={selectedFindingId}
          />
        )}

        {/* Assign Finding Modal */}
        {showAssignModal && selectedFindingForAssign && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseAssignModal}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Assign Finding</h2>
                  <button
                    onClick={handleCloseAssignModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Finding Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Finding
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{selectedFindingForAssign.title}</p>
                    </div>
                  </div>
  {/* Due Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    {selectedFindingForAssign?.deadline && (
                      <p className="text-xs text-gray-500 mb-2">
                        Finding deadline: <span className="font-medium text-gray-700">{formatDate(selectedFindingForAssign.deadline)}</span>
                      </p>
                    )}
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        if (dueDateError) setDueDateError('');
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      max={selectedFindingForAssign?.deadline ? new Date(selectedFindingForAssign.deadline).toISOString().split('T')[0] : undefined}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        dueDateError ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {dueDateError && (
                      <p className="mt-1 text-xs text-red-600">{dueDateError}</p>
                    )}
                    {selectedFindingForAssign?.deadline && !dueDateError && (
                      <p className="mt-1 text-xs text-gray-500">
                        Must be on or before finding deadline
                      </p>
                    )}
                  </div>
                  {/* Root Cause Assignment Section */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Root Cause Assignment <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Assign each root cause to a CAPA owner
                    </p>
                    
                    {loadingRootCauses ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-gray-500">Loading root causes...</span>
                      </div>
                    ) : loadingStaff ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-gray-500">Loading CAPA owners...</span>
                      </div>
                    ) : findingRootCauses.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                        <svg className="w-10 h-10 text-amber-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-amber-700 font-medium">No approved root causes found</p>
                        <p className="text-xs text-amber-600 mt-1">Please ensure root causes are approved before assigning</p>
                      </div>
                    ) : staffMembers.length === 0 ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <svg className="w-10 h-10 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-700 font-medium">No CAPA Owners found</p>
                        <p className="text-xs text-red-600 mt-1">Please add CAPA owners to this department first</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {findingRootCauses.map((rootCause, index) => {
                          const assignedStaffId = rootCauseStaffMap[rootCause.rootCauseId];
                          const assignedStaff = staffMembers.find(s => s.userId === assignedStaffId);
                          
                          return (
                            <div 
                              key={rootCause.rootCauseId} 
                              className={`border rounded-lg p-3 ${
                                assignedStaffId 
                                  ? 'border-green-400 bg-green-50' 
                                  : 'border-gray-300 bg-gray-50'
                              }`}
                            >
                              {/* Root Cause Info */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-primary-600">#{index + 1}</span>
                                <h4 className="text-sm font-medium text-gray-900">{rootCause.name}</h4>
                                <span className="text-xs text-gray-500">• {rootCause.category}</span>
                                {assignedStaffId && (
                                  <span className="ml-auto text-xs text-green-700 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Assigned
                                  </span>
                                )}
                              </div>
                              {rootCause.description && (
                                <p className="text-xs text-gray-600 mb-2">{rootCause.description}</p>
                              )}

                              {/* Staff Selection */}
                              <label className="block text-xs text-gray-600 mb-1">Assign to CAPA Owner:</label>
                              <select
                                value={assignedStaffId || ''}
                                onChange={(e) => handleSelectStaffForRootCause(rootCause.rootCauseId, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              >
                                <option value="">-- Select CAPA Owner --</option>
                                {staffMembers.map((staff) => (
                                  <option key={staff.userId} value={staff.userId}>
                                    {staff.fullName} {staff.email ? `(${staff.email})` : ''}
                                  </option>
                                ))}
                              </select>
                              {assignedStaff && (
                                <div className="mt-2 text-xs text-green-700">
                                  ✓ {assignedStaff.fullName}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Assignment Summary */}
                    {findingRootCauses.length > 0 && (
                      <div className={`mt-3 border rounded p-2 text-xs ${
                        Object.keys(rootCauseStaffMap).length === findingRootCauses.length
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-gray-300 bg-gray-50 text-gray-600'
                      }`}>
                        <span className="font-medium">
                          {Object.keys(rootCauseStaffMap).length} of {findingRootCauses.length} root causes assigned
                        </span>
                        {Object.keys(rootCauseStaffMap).length === findingRootCauses.length && (
                          <span className="ml-2">✓ All root causes have been assigned</span>
                        )}
                        {rootCauseAssignError && (
                          <p className="mt-1 text-red-600">⚠ {rootCauseAssignError}</p>
                        )}
                      </div>
                    )}
                  </div>
                
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={handleCloseAssignModal}
                    disabled={submittingAssign}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={submittingAssign || selectedStaff.length === 0}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAssign ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Confirmation Modal */}
        {showAssignConfirmModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowAssignConfirmModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm Assign
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to assign this finding? The finding will be marked as received and an action will be created.
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignConfirmModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAssign}
                    disabled={submittingAssign}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAssign ? 'Assigning...' : 'Yes, Assign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Detail Modal */}
        {selectedActionId && (
          <AuditeeActionReviewModal
            isOpen={showActionDetailModal}
            onClose={() => {
              setShowActionDetailModal(false);
              setSelectedActionId(null);
              setSelectedActionFindingId(null);
            }}
            actionId={selectedActionId}
            findingId={selectedActionFindingId || undefined}
            onDataReload={async () => {
              // Reload findings
              const deptId = getUserDeptId();
              if (deptId) {
                console.log('🔄 Reloading findings...');
                const data = await getFindingsByDepartment(deptId);
                setFindings(data);
                await loadAssignedUsers(data);
                await loadRootCauseStatus(data);
                console.log('✅ Findings reloaded');
              }
              
              // Reload actions sidebar if open
              if (selectedFindingId && showActionsModal) {
                console.log('🔄 Reloading actions for finding:', selectedFindingId);
                const actions = await getActionsByFinding(selectedFindingId);
                setSelectedFindingActions(Array.isArray(actions) ? actions : []);
                console.log('✅ Actions reloaded');
              }
            }}
          />
        )}

        {/* Actions Modal */}
        {showActionsModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => {
                setShowActionsModal(false);
                setSelectedFindingActions([]);
                setSelectedFindingId(null);
              }}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-auto max-h-[95vh] overflow-hidden flex flex-col animate-slideUp"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with Gradient */}
                <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6 shadow-lg z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Actions for Finding</h2>
                        <p className="text-primary-100 mt-1 text-sm">
                          {findings.find(f => f.findingId === selectedFindingId)?.title || 'Finding Details'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowActionsModal(false);
                        setSelectedFindingActions([]);
                        setSelectedFindingId(null);
                      }}
                      className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
                  {loadingFindingActions ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 text-lg font-medium">Loading actions...</p>
                      </div>
                    </div>
                  ) : selectedFindingActions.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg font-medium">No actions found</p>
                      <p className="text-gray-400 text-sm mt-2">Actions will appear here once they are created</p>
                    </div>
                  ) : (
                    <div className="p-8">
                      <div className="mb-6 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-600">
                          Showing <span className="text-primary-600 font-semibold">{selectedFindingActions.length}</span> action{selectedFindingActions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="space-y-6">
                        {selectedFindingActions.map((action, index) => (
                          <div
                            key={action.actionId}
                            className="border-2 border-gray-200 rounded-2xl bg-white hover:border-primary-300 hover:shadow-xl transition-all duration-300 overflow-hidden group"
                          >
                            {/* Action Header */}
                            <div className="bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 px-6 py-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4 flex-1">
                                  <div className="w-10 h-10 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                                    <span className="text-primary-700 font-bold text-lg">#{index + 1}</span>
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-700 transition-colors">
                                      {action.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                      {action.description || 'No description provided'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                                    action.status === 'Approved' ? 'bg-green-100 text-green-700 border-2 border-green-200' :
                                    action.status === 'Reviewed' ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' :
                                    action.status === 'Rejected' ? 'bg-red-100 text-red-700 border-2 border-red-200' :
                                    action.status === 'Returned' ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-200' :
                                    'bg-gray-100 text-gray-700 border-2 border-gray-200'
                                  }`}>
                                    {action.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Body */}
                            <div className="p-6">
                              {/* Progress Bar */}
                              <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <span className="text-sm font-bold text-gray-700">Progress</span>
                                  </div>
                                  <span className="text-2xl font-bold text-primary-600">
                                    {action.progressPercent || 0}%
                                  </span>
                                </div>
                                <div className="relative">
                                  <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                                    <div
                                      className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 relative overflow-hidden"
                                      style={{ width: `${action.progressPercent || 0}%` }}
                                    >
                                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Info Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                                      <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Due Date</p>
                                      <p className="text-base font-bold text-blue-900">{formatDate(action.dueDate)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                                      <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Created</p>
                                      <p className="text-base font-bold text-purple-900">{formatDate(action.createdAt)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-200">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                                      <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Status</p>
                                      <p className="text-base font-bold text-green-900">{action.status || 'Pending'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Review Feedback */}
                              {action.reviewFeedback && (
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-5 mb-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-amber-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Review Feedback</p>
                                      <p className="text-sm text-amber-900 leading-relaxed">{action.reviewFeedback}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Actions Footer */}
                              {action.status?.toLowerCase() === 'reviewed' && (
                                <div className="flex items-center justify-end pt-4 border-t-2 border-gray-200">
                                  <button
                                    onClick={() => {
                                      setSelectedActionId(action.actionId);
                                      setSelectedActionFindingId(action.findingId);
                                      setShowActionDetailModal(true);
                                      setShowActionsModal(false);
                                      console.log('Opening action modal for review - ActionId:', action.actionId, 'FindingId:', action.findingId);
                                    }}
                                    className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Review Action
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </MainLayout>
  );
};

export default FindingsProgress;
