import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import FindingDetailModal from '../../../pages/Auditor/FindingManagement/FindingDetailModal';
import { createAction, getActionsByFinding, getActionsByRootCause, type Action, rejectActionForResubmit } from '../../../api/actions';
import { getAdminUsersByDepartment, getUserById } from '../../../api/adminUsers';
import { markFindingAsReceived } from '../../../api/findings';
import apiClient from '../../../api/client';
import { Pagination } from '../../../components';
import AuditeeActionReviewModal from './AuditeeActionReviewModal';
import { toast } from 'react-toastify';
import { getStatusColor, getSeverityColor } from '../../../constants';

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
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionFindingId, setSelectedActionFindingId] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);

  const [selectedFindingActions, setSelectedFindingActions] = useState<Action[]>([]);
  const [loadingFindingActions, setLoadingFindingActions] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const itemsPerPage = 10;
  const [assignedUsersMap, setAssignedUsersMap] = useState<Record<string, string>>({}); // findingId -> assignedUserName
  const [returnedActionsMap, setReturnedActionsMap] = useState<Record<string, Action>>({}); // findingId -> returned action
  const [rejectedActionsMap, setRejectedActionsMap] = useState<Record<string, Action>>({}); // findingId -> rejected action
  const [rootCauseStatusMap, setRootCauseStatusMap] = useState<Record<string, { hasApproved: boolean; hasPending: boolean; hasRejected: boolean; allApproved: boolean; totalCount: number }>>({}); // findingId -> root cause status
  const [findingActionsMap, setFindingActionsMap] = useState<Record<string, Action[]>>({}); // findingId -> all actions

  // New states for root cause assignment
  const [findingRootCauses, setFindingRootCauses] = useState<any[]>([]); // Root causes of selected finding
  const [loadingRootCauses, setLoadingRootCauses] = useState(false);
  const [submittedRootCauseIds, setSubmittedRootCauseIds] = useState<Set<string>>(new Set()); // Track submitted root causes (UUID strings)
  const [assignedRootCauseData, setAssignedRootCauseData] = useState<Record<string, { staffId: string; staffName: string; dueDate: string }>>({}); // Track assigned data

  // Individual root cause assignment modal
  const [showIndividualAssignModal, setShowIndividualAssignModal] = useState(false);
  const [selectedRootCause, setSelectedRootCause] = useState<any>(null);
  const [individualStaffId, setIndividualStaffId] = useState('');
  const [individualDueDate, setIndividualDueDate] = useState('');
  const [individualStaffError, setIndividualStaffError] = useState('');
  const [individualDateError, setIndividualDateError] = useState('');

  // Description view modal
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState<{ name: string; description: string; category?: string } | null>(null);

  // Tab state for Witness Disagreed
  const [activeTab, setActiveTab] = useState<'findings' | 'disagreed'>('findings');
  const [disagreedFindings, setDisagreedFindings] = useState<Finding[]>([]);
  const [loadingDisagreedFindings, setLoadingDisagreedFindings] = useState(false);

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    return getStatusColor(status) || 'bg-gray-100 text-gray-700';
  };

  const formatVNDate = (date: Date) =>
    date.toLocaleDateString('en-CA');
  // Check if all actions for a finding are closed
  const areAllActionsClosed = (findingId: string): boolean => {
    const actions = findingActionsMap[findingId] || [];
    if (actions.length === 0) return false; // No actions means not all closed

    // Check if all actions are closed
    return actions.every(action => {
      const status = action.status?.toLowerCase() || '';
      const isClosed = status === 'closed' || action.closedAt !== null;
      return isClosed;
    });
  };

  // Get display status for finding - override "Closed" if not all actions are closed
  // Keep "Received" if there's at least one action not approved or verified
  // If all actions are "completed", show "Closed"
  const getDisplayStatus = (finding: Finding): string => {
    const originalStatus = finding.status || '';
    const statusLower = originalStatus.toLowerCase();
    const actions = findingActionsMap[finding.findingId] || [];

    // First, check if all actions are completed - if so, always show "Closed"
    if (actions.length > 0) {
      const allCompleted = actions.every(a => {
        const actionStatus = a.status?.toLowerCase() || '';
        return actionStatus === 'completed';
      });
      
      if (allCompleted) {
        return 'Closed';
      }
    }

    // If status is "Received", check if all actions are approved/verified
    if (statusLower === 'received') {
      if (actions.length > 0) {
        // Check if all actions are approved or verified
        const allApprovedOrVerified = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'approved' || actionStatus === 'verified' || actionStatus === 'completed';
        });
        
        // If not all actions are approved/verified, keep "Received" status
        if (!allApprovedOrVerified) {
          return 'Received';
        }
        
        // If all actions are approved/verified, change status based on action states
        // Check if all actions are closed
        const allClosed = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'closed' || a.closedAt !== null;
        });
        
        if (allClosed) {
          return 'Closed';
        }
        
        // All verified/approved but not all closed - show "Verified" or "Approved" status
        // Check if all are verified
        const allVerified = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'verified';
        });
        
        if (allVerified) {
          return 'Verified';
        }
        
        // Check if all are approved
        const allApproved = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'approved' || actionStatus === 'completed';
        });
        
        if (allApproved) {
          return 'Approved';
        }
        
        // Mixed verified/approved - show "In Progress"
        return 'In Progress';
      }
      // No actions yet, keep Received
      return 'Received';
    }

    // If status is "Closed", check if all actions are actually closed
    if (statusLower === 'closed') {
      const allClosed = areAllActionsClosed(finding.findingId);
      if (!allClosed) {
        // Not all actions are closed, determine status based on actions
        if (actions.length === 0) {
          return 'Open'; // No actions yet
        }

        // Check action statuses to determine finding status
        const hasInProgress = actions.some(a => {
          const status = a.status?.toLowerCase() || '';
          return status === 'inprogress' || status === 'in progress' || (a.progressPercent > 0 && a.progressPercent < 100);
        });

        if (hasInProgress) {
          return 'In Progress';
        }

        const hasReviewed = actions.some(a => a.status?.toLowerCase() === 'reviewed');
        if (hasReviewed) {
          return 'Review';
        }

        const hasApproved = actions.some(a => a.status?.toLowerCase() === 'approved');
        if (hasApproved) {
          return 'Approved';
        }

        // Default to Open if we can't determine
        return 'Open';
      }
    }
    
    return originalStatus;
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
    const actionsMap: Record<string, Action[]> = {};

    // Load actions for each finding and get assignedTo
    await Promise.all(
      findingsData.map(async (finding) => {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          if (actions && actions.length > 0) {
            // Store all actions for this finding
            actionsMap[finding.findingId] = actions;

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
          } else {
            // No actions for this finding
            actionsMap[finding.findingId] = [];
          }
        } catch (err) {
          console.warn(`Failed to load actions for finding ${finding.findingId}`, err);
          actionsMap[finding.findingId] = [];
        }
      })
    );

    setAssignedUsersMap(usersMap);
    setReturnedActionsMap(returnedMap);
    setRejectedActionsMap(rejectedMap);
    setFindingActionsMap(actionsMap);
  };

  // Function to reload findings data
  const reloadFindings = async () => {
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

        filteredFindings = allFindings.filter((finding: Finding) => {
          // Try multiple possible locations for auditId
          const findingAuditId = finding.auditId ||
            (finding as any).AuditId ||
            (finding as any).auditPlanId ||
            (finding as any).audit?.auditId;

          return String(findingAuditId) === String(auditIdFromState);
        });
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

  useEffect(() => {
    reloadFindings();
    loadDisagreedFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditIdFromState]);

  // Load disagreed findings
  const loadDisagreedFindings = async () => {
    try {
      setLoadingDisagreedFindings(true);

      const deptId = getUserDeptId();
      if (!deptId) {
        return;
      }

      const allFindings = await getFindingsByDepartment(deptId);

      // Filter findings by auditId and WitnessDisagreed status
      let filteredFindings = allFindings;
      if (auditIdFromState) {
        filteredFindings = allFindings.filter((finding: Finding) => {
          const findingAuditId = finding.auditId ||
            (finding as any).AuditId ||
            (finding as any).auditPlanId ||
            (finding as any).audit?.auditId;

          const statusLower = (finding.status || '').toLowerCase().trim();
          const isWitnessDisagreed = statusLower === 'witnessdisagreed';

          return String(findingAuditId) === String(auditIdFromState) && isWitnessDisagreed;
        });
      } else {
        filteredFindings = allFindings.filter((finding: Finding) => {
          const statusLower = (finding.status || '').toLowerCase().trim();
          return statusLower === 'witnessdisagreed';
        });
      }

      setDisagreedFindings(filteredFindings);
    } catch (err: any) {
      console.error('Error fetching disagreed findings:', err);
    } finally {
      setLoadingDisagreedFindings(false);
    }
  };

  // Listen for action updates from CAPAOwner
  useEffect(() => {
    const handleActionUpdated = async (_event: Event) => {
      // Small delay to ensure backend has updated
      await new Promise(resolve => setTimeout(resolve, 500));
      // Reload findings to reflect updated action status
      await reloadFindings();
    };

    window.addEventListener('actionUpdated', handleActionUpdated);

    return () => {
      window.removeEventListener('actionUpdated', handleActionUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for root cause updates
  useEffect(() => {
    const handleRootCauseUpdated = async (_event: Event) => {
      // Small delay to ensure backend has updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reload root cause status for all findings
      if (findings.length > 0) {
        await loadRootCauseStatus(findings);
      } else {
        // If no findings, reload all findings first
        await reloadFindings();
      }
    };

    window.addEventListener('rootCauseUpdated', handleRootCauseUpdated);

    return () => {
      window.removeEventListener('rootCauseUpdated', handleRootCauseUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Filter findings based on search query
  const getFilteredFindings = () => {
    let filtered = findings;

    // Filter out findings with status "Archived" and "WitnessDisagreed"
    filtered = filtered.filter(finding => {
      const statusLower = (finding.status || '').toLowerCase().trim();
      return statusLower !== 'archived' && statusLower !== 'witnessdisagreed';
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

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(finding => finding.status === statusFilter);
    }

    // Apply date filter (filter by deadline)
    if (dateFrom && dateFrom.trim()) {
      filtered = filtered.filter(finding => {
        if (!finding.deadline) return false;
        const findingDate = new Date(finding.deadline);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        findingDate.setHours(0, 0, 0, 0);
        return findingDate >= fromDate;
      });
    }

    if (dateTo && dateTo.trim()) {
      filtered = filtered.filter(finding => {
        if (!finding.deadline) return false;
        const findingDate = new Date(finding.deadline);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return findingDate <= toDate;
      });
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


  // Load root causes for the selected finding - NEW FLOW: Load all root causes with their actions
  const loadFindingRootCauses = async (findingId: string) => {
    setLoadingRootCauses(true);
    try {
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCauses = res.data.$values || [];

      // Fetch actions for this finding to check which root causes are already assigned
      let assignedRootCauseIds = new Set<string>();
      const assignedDataMap: Record<string, { staffId: string; staffName: string; dueDate: string }> = {};

      try {
        const actions = await getActionsByFinding(findingId);

        if (actions && actions.length > 0) {
          // IMPORTANT: Only consider actions that are NOT rejected
          const validActions = actions.filter((action: Action) => {
            const statusLower = action.status?.toLowerCase() || '';
            return statusLower !== 'rejected' && statusLower !== 'leadrejected';
          });

          // Get all root cause IDs that have valid (non-rejected) actions AND have assignedTo
          // Only consider "assigned" if action has BOTH rootCauseId AND assignedTo
          const fullyAssignedActions = validActions.filter((action: Action) => 
            action.rootCauseId && action.assignedTo
          );

          // Fetch user info for all assigned actions
          await Promise.all(
            fullyAssignedActions.map(async (action: Action) => {
              const rcId = String(action.rootCauseId); // Ensure string
              assignedRootCauseIds.add(rcId);

              // Get assigned user info
              if (!assignedDataMap[rcId]) {
                try {
                  const user = await getUserById(action.assignedTo);
                  assignedDataMap[rcId] = {
                    staffId: action.assignedTo,
                    staffName: user.fullName || user.email || 'Unknown',
                    dueDate: action.dueDate || ''
                  };
                } catch (err) {
                  assignedDataMap[rcId] = {
                    staffId: action.assignedTo,
                    staffName: 'Unknown',
                    dueDate: action.dueDate || ''
                  };
                }
              }
            })
          );
        }
      } catch (err) {
        console.warn('Error loading actions for finding:', err);
      }

      // Update submittedRootCauseIds with root causes that have actions
      setSubmittedRootCauseIds(assignedRootCauseIds);

      // Update assignedRootCauseData
      setAssignedRootCauseData(assignedDataMap);

      // NEW FLOW: Show ALL root causes with actions (not just approved ones)
      // Load actions for each root cause
      const rootCausesWithActions = await Promise.all(
        rootCauses.map(async (rc: any) => {
          try {
            const actions = await getActionsByRootCause(rc.rootCauseId);
            return { ...rc, actions: actions || [] };
          } catch (err) {
            return { ...rc, actions: [] };
          }
        })
      );

      setFindingRootCauses(rootCausesWithActions);
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

  // Assign single root cause immediately
  const handleAssignSingleRootCause = async () => {
 
    if (!selectedFindingForAssign || !selectedRootCause) {
      console.error(' Missing selectedFindingForAssign or selectedRootCause');
      toast.error('Please select a finding and root cause');
      return;
    }

    if (!individualStaffId || !individualDueDate) {
      console.error(' Missing individualStaffId or individualDueDate');
      toast.error('Please select CAPA owner and due date');
      return;
    }

    setSubmittingAssign(true);

    try {
      // Validate deptId - must be a valid positive number
      if (!selectedFindingForAssign.deptId || selectedFindingForAssign.deptId <= 0) {
        toast.error('Invalid department ID. Please ensure the finding has a valid department.');
        setSubmittingAssign(false);
        return;
      }

      // Create action for this root cause with rootCauseId link
      // Keep finding description separate, don't mix with root cause info
      await createAction({
        findingId: selectedFindingForAssign.findingId,
        title: `${selectedFindingForAssign.title} - ${selectedRootCause.name}`,
        description: selectedFindingForAssign.description || '', // Keep original finding description
        assignedTo: individualStaffId,
        assignedDeptId: selectedFindingForAssign.deptId, // Only send if valid (> 0)
        progressPercent: 0,
        dueDate: new Date(individualDueDate).toISOString(),
        reviewFeedback: '',
        rootCauseId: selectedRootCause.rootCauseId, // Link to root cause
      });

      // Mark this root cause as submitted and save assigned data
      const rcIdStr = String(selectedRootCause.rootCauseId);
      const newSubmittedIds = new Set(submittedRootCauseIds);
      newSubmittedIds.add(rcIdStr);
      setSubmittedRootCauseIds(newSubmittedIds);

      const staffName = staffMembers.find(s => s.userId === individualStaffId)?.fullName || 'Unknown';
      setAssignedRootCauseData(prev => ({
        ...prev,
        [rcIdStr]: {
          staffId: individualStaffId,
          staffName: staffName,
          dueDate: individualDueDate
        }
      }));

      // Check if all root causes are now assigned
      const allRootCausesRes = await apiClient.get(`/RootCauses/by-finding/${selectedFindingForAssign.findingId}`);
      const allRootCauses = allRootCausesRes.data.$values || [];
      const allAssigned = allRootCauses.every((rc: any) => newSubmittedIds.has(String(rc.rootCauseId)));

      // Mark finding as received if all root causes assigned
      if (allAssigned) {
        await markFindingAsReceived(selectedFindingForAssign.findingId);
      }

      // Close individual modal
      setShowIndividualAssignModal(false);

      const remainingCount = allRootCauses.length - newSubmittedIds.size;

      if (allAssigned) {
        toast.success(`Action created for ${staffName}. All root causes assigned! Finding marked as Received.`);
        // Close assign modal completely
        handleCloseAssignModal();
      } else {
        toast.success(`Action created for ${staffName}. ${remainingCount} root cause${remainingCount > 1 ? 's' : ''} remaining.`);
        // Keep all root causes in the list to show assigned status
      }

      // Reload findings with assigned users and root cause status
      const deptId = getUserDeptId();
      if (deptId) {
        const allFindings = await getFindingsByDepartment(deptId);

        // Filter by auditId if needed
        let filteredData = allFindings;
        if (auditIdFromState) {
          filteredData = allFindings.filter((finding: Finding) => {
            const findingAuditId = finding.auditId || (finding as any).audit?.auditId;
            return String(findingAuditId) === String(auditIdFromState);
          });
        }

        setFindings(filteredData);
        await loadAssignedUsers(filteredData);
        await loadRootCauseStatus(filteredData);
      }
    } catch (err: any) {
      console.error('Error creating action:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create action';
      toast.error(errorMsg);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle open assign modal - reset state first
  const handleOpenAssignModal = (finding: Finding) => {
    // Reset all state first
    setSubmittedRootCauseIds(new Set());
    setAssignedRootCauseData({});
    setFindingRootCauses([]);
    
    // Then set the finding and open modal
    setSelectedFindingForAssign(finding);
    setShowAssignModal(true);
    
    // Load data
    loadStaffMembers(finding.deptId);
    loadFindingRootCauses(finding.findingId);
  };

  // Handle close assign modal
  const handleCloseAssignModal = () => {
    setSelectedFindingForAssign(null);
    setFindingRootCauses([]);
    setSubmittedRootCauseIds(new Set()); // Reset submitted tracking
    setAssignedRootCauseData({}); // Reset assigned data
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
  }, [findings.length, searchQuery, dateFrom, dateTo, statusFilter]);

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
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-4">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('findings')}
                    className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'findings'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Findings ({filteredFindings.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('disagreed')}
                    className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors relative ${
                      activeTab === 'disagreed'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Witness Disagreed
                    {disagreedFindings.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                        {disagreedFindings.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>
            </div>

            {/* Findings Table */}
            {activeTab === 'findings' && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
              {/* Header with Search and Filters */}
              <div className="border-b border-gray-200 bg-gray-50">
                <div className="px-4 sm:px-6 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Findings List ({filteredFindings.length})
                    </h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="flex-1">
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
                    
                    {/* Status Filter */}
                    <div className="w-full sm:w-40">
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="block w-full px-3 py-2 border-2 border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      >
                        <option value="">All Status</option>
                        <option value="Open">Open</option>
                        <option value="Received">Received</option>
                        <option value="Closed">Closed</option>
                        <option value="Return">Return</option>
                      </select>
                    </div>
                    
                    {/* Date From */}
                    <div className="w-full sm:w-48">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="block w-full px-3 py-2 border-2 border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>
                    
                    {/* Date To */}
                    <div className="w-full sm:w-48">
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="block w-full px-3 py-2 border-2 border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>
                    
                    {/* Clear Filters */}
                    {(searchQuery || dateFrom || dateTo || statusFilter) && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setDateFrom(new Date().toISOString().split('T')[0]);
                          setDateTo('');
                          setStatusFilter('');
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap text-sm"
                      >
                        Clear
                      </button>
                    )}
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
                              {/* Root Cause Indicator Badge - Only show if not all approved */}
                              {(() => {
                                const rcStatus = rootCauseStatusMap[finding.findingId];
                                const totalCount = rcStatus?.totalCount || 0;
                                const allApproved = rcStatus?.allApproved || false;
                                const hasPendingRC = rcStatus?.hasPending || false;
                                const hasApprovedRC = rcStatus?.hasApproved || false;
                                const hasRejectedRC = rcStatus?.hasRejected || false;

                                // Only show badge if there are root causes AND not all are approved
                                if (totalCount > 0 && !allApproved) {
                                  return (
                                    <div className="relative group flex-shrink-0">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${hasPendingRC
                                          ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                          : hasRejectedRC
                                            ? 'bg-red-100 text-red-700 border-red-300'
                                            : hasApprovedRC
                                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                                              : 'bg-blue-100 text-blue-700 border-blue-300'
                                        }`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        {totalCount} RC
                                      </span>
                                      <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <p className="font-semibold mb-1">Root Causes Status:</p>
                                        <p className="text-gray-300">
                                          Total: {totalCount} root cause{totalCount > 1 ? 's' : ''}
                                        </p>
                                        {hasApprovedRC && (
                                          <p className="text-green-300 mt-1">✓ Has approved root cause{hasApprovedRC && totalCount > 1 ? 's' : ''}</p>
                                        )}
                                        {hasPendingRC && (
                                          <p className="text-yellow-300 mt-1">⏳ Has pending root cause{hasPendingRC && totalCount > 1 ? 's' : ''}</p>
                                        )}
                                        {hasRejectedRC && (
                                          <p className="text-red-300 mt-1">✗ Has rejected root cause{hasRejectedRC && totalCount > 1 ? 's' : ''}</p>
                                        )}
                                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(finding.severity || '')}`}>
                              {finding.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(getDisplayStatus(finding))}`}>
                              {getDisplayStatus(finding) || 'N/A'}
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
                                        const allFindings = await getFindingsByDepartment(deptId);

                                        // Filter by auditId if needed
                                        let filteredData = allFindings;
                                        if (auditIdFromState) {
                                          filteredData = allFindings.filter((finding: Finding) => {
                                            const findingAuditId = finding.auditId ||
                                              (finding as any).AuditId ||
                                              (finding as any).auditPlanId ||
                                              (finding as any).audit?.auditId;
                                            return String(findingAuditId) === String(auditIdFromState);
                                          });
                                        }

                                        setFindings(filteredData);
                                        await loadAssignedUsers(filteredData);
                                        await loadRootCauseStatus(filteredData);
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
                                const totalCount = rcStatus?.totalCount || 0;

                                // NEW FLOW: Allow assign if there are root causes (no need to wait for approval)
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
                                } else {
                                  // Has root causes - allow assign
                                  return (
                                    <button
                                      onClick={() => handleOpenAssignModal(finding)}
                                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors active:scale-95"
                                      title="Assign CAPA Owner for root causes"
                                    >
                                      Assign
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
            )}

            {/* Disagreed Findings Tab */}
            {activeTab === 'disagreed' && (
              <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    Witness Disagreed Findings ({disagreedFindings.length})
                  </h2>
                </div>

                {loadingDisagreedFindings ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading disagreed findings...</p>
                  </div>
                ) : disagreedFindings.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No disagreed findings found</p>
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
                            Deadline
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {disagreedFindings.map((finding) => (
                          <tr
                            key={finding.findingId}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                                  {finding.title}
                                </div>
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300 flex-shrink-0">
                                  Witness Disagreed
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(finding.severity || '')}`}>
                                {finding.severity || 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(finding.deadline)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedFindingId(finding.findingId);
                                    setShowDetailModal(true);
                                  }}
                                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                >
                                  View Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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

        {/* Assign Finding Modal - Root Causes Table */}
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
                className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Assign CAPA Owners</h2>
                    <p className="text-sm text-gray-600 mt-0.5">{selectedFindingForAssign.title}</p>
                  </div>
                  <button
                    onClick={handleCloseAssignModal}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {/* Loading State */}
                  {loadingRootCauses ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                        <p className="text-sm text-gray-600">Loading root causes...</p>
                      </div>
                    </div>
                  ) : findingRootCauses.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
                      <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-amber-700 font-medium mb-2">No root causes found</p>
                      <p className="text-xs text-amber-600">Please add root causes for this finding first</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          Total: <span className="font-semibold text-gray-900">{findingRootCauses.length}</span> root cause(s)
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
                            {findingRootCauses.length - submittedRootCauseIds.size} Pending Assignment
                          </span>
                          {submittedRootCauseIds.size > 0 && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                              {submittedRootCauseIds.size} Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Root Causes List - Simple Design */}
                      <div className="space-y-3">
                        {findingRootCauses.map((rootCause, index) => {
                          const rcId = String(rootCause.rootCauseId); // Ensure string for comparison
                          const isAssigned = submittedRootCauseIds.has(rcId);
                          const assignedData = assignedRootCauseData[rcId];
                          const actions = rootCause.actions || [];

                          return (
                            <div key={rootCause.rootCauseId} className={`border rounded-lg ${isAssigned ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'}`}>
                              {/* Root Cause Header */}
                              <div className="px-4 py-3 border-b border-gray-200">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-gray-600">#{index + 1}</span>
                                      <h3 className="text-sm font-semibold text-gray-900">{rootCause.name}</h3>
                                      {isAssigned && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded">
                                          ✓ Assigned
                                        </span>
                                      )}
                                    </div>
                                    {rootCause.description && (
                                      <p className="text-xs text-gray-600">{rootCause.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Remediation Proposals */}
                              <div className="px-4 py-3">
                                {actions.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic py-2">No remediation proposals yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-700">Remediation Proposals: {actions.length}</p>
                                    {actions.map((action: any) => (
                                      <div key={action.actionId} className="border border-gray-200 rounded p-2 bg-gray-50">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-xs font-medium text-gray-900 flex-1">{action.title}</p>
                                          <span className={`px-2 py-0.5 text-xs rounded flex-shrink-0 ${
                                            action.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                            action.status === 'Reviewed' ? 'bg-blue-100 text-blue-700' :
                                            action.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {action.status || 'Pending'}
                                          </span>
                                        </div>
                                        {action.description && (
                                          <p className="text-xs text-gray-600 mt-1">{action.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                          <span>Progress: {action.progressPercent || 0}%</span>
                                          <span>•</span>
                                          <span>Due: {formatDate(action.dueDate)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Assignment Section */}
                              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs">
                                    {assignedData ? (
                                      <div>
                                        <span className="text-green-700 font-medium">✓ {assignedData.staffName}</span>
                                        <span className="text-gray-500 ml-2">Due: {new Date(assignedData.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">Not assigned</span>
                                    )}
                                  </div>
                                  {!isAssigned && (
                                    <button
                                      onClick={() => {
                                        setSelectedRootCause(rootCause);
                                        setIndividualStaffId('');
                                        setIndividualDueDate('');
                                        setIndividualStaffError('');
                                        setIndividualDateError('');
                                        setShowIndividualAssignModal(true);
                                      }}
                                      className="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700"
                                    >
                                      Assign
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end">
                  <button
                    onClick={handleCloseAssignModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Individual Root Cause Assignment Modal */}
        {showIndividualAssignModal && selectedRootCause && (
          <div className="fixed inset-0 z-[60] overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowIndividualAssignModal(false)}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-primary-600 px-4 py-3 rounded-t-xl">
                  <h3 className="text-base font-semibold text-white">Assign CAPA Owner</h3>
                  <p className="text-sm text-primary-100 mt-0.5">{selectedRootCause.name}</p>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Root Cause Info */}
                  {selectedRootCause.description && (
                    <div className="bg-gray-50 border rounded p-2">
                      <p className="text-xs text-gray-600">{selectedRootCause.description}</p>
                    </div>
                  )}

                  {/* CAPA Owner Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CAPA Owner <span className="text-red-500">*</span>
                    </label>
                    {loadingStaff ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-gray-500">Loading CAPA owners...</span>
                      </div>
                    ) : staffMembers.length === 0 ? (
                      <div className="bg-red-50 border rounded p-2 text-center">
                        <p className="text-xs text-red-700">No CAPA owners found</p>
                      </div>
                    ) : (
                      <select
                        value={individualStaffId}
                        onChange={(e) => {
                          setIndividualStaffId(e.target.value);
                          if (individualStaffError) setIndividualStaffError('');
                        }}
                        className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500 text-sm ${individualStaffError ? 'border-red-300' : 'border-gray-300'}`}
                      >
                        <option value="">Select CAPA Owner</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.userId} value={staff.userId}>
                            {staff.fullName}
                          </option>
                        ))}
                      </select>
                    )}
                    {individualStaffError && (
                      <p className="mt-1 text-xs text-red-600">{individualStaffError}</p>
                    )}
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date <span className="text-red-500">*</span>
                    </label>

                    {selectedFindingForAssign?.deadline && (
                      <p className="text-xs text-gray-500 mb-1">
                        Finding deadline: {formatVNDate(new Date(selectedFindingForAssign.deadline))}
                      </p>
                    )}

                    <input
                      type="date"
                      value={individualDueDate}
                      onChange={(e) => {
                        setIndividualDueDate(e.target.value);
                        if (individualDateError) setIndividualDateError('');
                      }}
                      min={formatVNDate(new Date())}
                      max={
                        selectedFindingForAssign?.deadline
                          ? formatVNDate(new Date(selectedFindingForAssign.deadline))
                          : undefined
                      }
                      className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500 text-sm ${individualDateError ? 'border-red-300' : 'border-gray-300'}`}
                    />

                    {individualDateError && (
                      <p className="mt-1 text-xs text-red-600">{individualDateError}</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-4 py-3 rounded-b-xl flex justify-end gap-2">
                  <button
                    onClick={() => setShowIndividualAssignModal(false)}
                    className="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Validate
                      let hasError = false;

                      if (!individualStaffId) {
                        setIndividualStaffError('Please select a CAPA owner');
                        hasError = true;
                      }

                      if (!individualDueDate) {
                        setIndividualDateError('Please select a due date');
                        hasError = true;
                      } else {
                        const dueDateObj = new Date(individualDueDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        if (dueDateObj < today) {
                          setIndividualDateError('Due date cannot be in the past');
                          hasError = true;
                        }

                        if (selectedFindingForAssign?.deadline) {
                          const findingDeadline = new Date(selectedFindingForAssign.deadline);
                          findingDeadline.setHours(23, 59, 59, 999);

                          if (dueDateObj > findingDeadline) {
                            const deadlineStr = formatDate(selectedFindingForAssign.deadline);
                            setIndividualDateError(`Due date cannot exceed finding deadline (${deadlineStr})`);
                            hasError = true;
                          }
                        }
                      }

                      if (!hasError) {
                        handleAssignSingleRootCause();
                      }
                    }}
                    disabled={!individualStaffId || !individualDueDate || submittingAssign}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submittingAssign ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Assigning...
                      </>
                    ) : (
                      'Assign'
                    )}
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
                const allFindings = await getFindingsByDepartment(deptId);

                // Filter by auditId if needed (same as initial load)
                let filteredData = allFindings;
                if (auditIdFromState) {
                  filteredData = allFindings.filter((finding: Finding) => {
                    const findingAuditId = finding.auditId ||
                      (finding as any).AuditId ||
                      (finding as any).auditPlanId ||
                      (finding as any).audit?.auditId;
                    return String(findingAuditId) === String(auditIdFromState);
                  });
                }

                setFindings(filteredData);
                await loadAssignedUsers(filteredData);
                await loadRootCauseStatus(filteredData);
              }

              // Reload actions sidebar if open
              if (selectedFindingId && showActionsModal) {
                const actions = await getActionsByFinding(selectedFindingId);
                setSelectedFindingActions(Array.isArray(actions) ? actions : []);
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
                className="relative bg-white rounded-xl shadow-lg w-full max-w-6xl mx-auto max-h-[95vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-primary-600 px-8 py-6 border-b border-primary-700 z-10">
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
                <div className="flex-1 overflow-y-auto bg-white">
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
                            className="border border-gray-200 rounded-lg bg-white hover:border-primary-300 transition-all overflow-hidden"
                          >
                            {/* Action Header */}
                            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
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
                                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${action.status === 'Approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                                      action.status === 'Reviewed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                        action.status === 'Rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                                          action.status === 'Returned' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                            'bg-gray-100 text-gray-700 border border-gray-200'
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
                                      className="bg-primary-600 h-4 rounded-full transition-all duration-500"
                                      style={{ width: `${action.progressPercent || 0}%` }}
                                    >
                                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Info Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
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
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
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
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
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
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-4">
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
                                    }}
                                    className="px-6 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2"
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

        {/* Description View Modal */}
        {showDescriptionModal && selectedDescription && (
          <div className="fixed inset-0 z-[70] overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowDescriptionModal(false);
                setSelectedDescription(null);
              }}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-gray-100 px-4 py-3 border-b rounded-t-xl flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{selectedDescription.name}</h3>
                  <button
                    onClick={() => {
                      setShowDescriptionModal(false);
                      setSelectedDescription(null);
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedDescription.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-4 py-3 rounded-b-xl flex justify-end border-t">
                  <button
                    onClick={() => {
                      setShowDescriptionModal(false);
                      setSelectedDescription(null);
                    }}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                  >
                    Close
                  </button>
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
