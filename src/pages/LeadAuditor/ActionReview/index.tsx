import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditPlanById } from '../../../api/audits';
import { getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import { getActionsByFinding, type Action } from '../../../api/actions';
import { approveFindingActionHigherLevel } from '../../../api/findings';
import { getAttachments, updateAttachmentStatus } from '../../../api/attachments';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';
import FindingDetailModal from '../../Auditor/FindingManagement/FindingDetailModal';
import LeadAuditorActionDetailsModal from './LeadAuditorActionDetailsModal';
import { getStatusColor, getAuditTypeBadgeColor } from '../../../constants';

interface Audit {
  auditId: string;
  title: string;
  type: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  objective?: string;
  isPublished?: boolean;
  departmentCount?: number;
  findingCount?: number;
}

interface Department {
  deptId: number;
  name: string;
  auditIds: string[];
}

const ActionReview = () => {
  const { user } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showFindingDetailModal, setShowFindingDetailModal] = useState(false);
  const [selectedFindingForDetail, setSelectedFindingForDetail] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [findingActionsMap, setFindingActionsMap] = useState<Record<string, Action[]>>({}); // findingId -> actions
  const [approvingAll, setApprovingAll] = useState(false);
  const [approveAllFeedback] = useState(''); // Used in approveFindingActionHigherLevel call
  const [approveResults, setApproveResults] = useState<{
    succeeded: Array<{actionId: string, title: string}>;
    failed: Array<{actionId: string, title: string, error: string}>;
  } | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [approvingProgress, setApprovingProgress] = useState<{
    total: number;
    current: number;
    currentAction: string;
  } | null>(null);

  // Use centralized badge color functions
  const getStatusBadgeColor = (status: string) => {
    return getStatusColor(status) || 'bg-gray-100 text-gray-700';
  };
  
  // Use centralized getAuditTypeBadgeColor from constants with light variant
  const getAuditTypeBadgeColorLocal = (auditType: string) => {
    return getAuditTypeBadgeColor(auditType, 'light');
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load audits (filter to only show InProgress)
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const auditsData = await getAuditPlans();
        const auditsList = unwrap<Audit>(auditsData);
        // Filter to only show audits with status "InProgress"
        let filteredAudits = (Array.isArray(auditsList) ? auditsList : []).filter((audit: Audit) => {
          const statusLower = (audit.status || '').toLowerCase().trim();
          return statusLower === 'inprogress';
        });

        // Enrich audits with additional info (department count, finding count)
        const enrichedAudits = await Promise.all(
          filteredAudits.map(async (audit: Audit) => {
            try {
              // Get detailed audit info
              const auditDetails = await getAuditPlanById(audit.auditId);
              
              // Get departments count
              const deptData = await getAuditScopeDepartmentsByAuditId(audit.auditId);
              const deptList = unwrap<any>(deptData);
              const deptArray = Array.isArray(deptList) ? deptList : [];
              
              // Count findings across all departments (filter by auditId)
              let totalFindings = 0;
              for (const dept of deptArray) {
                try {
                  const findings = await getFindingsByDepartment(dept.deptId);
                  // Filter findings by auditId
                  const filteredFindings = findings.filter((finding: Finding) => {
                    const findingAuditId = finding.auditId || finding.audit?.auditId || '';
                    return String(findingAuditId) === String(audit.auditId);
                  });
                  totalFindings += filteredFindings.length;
                } catch (err) {
                  // Ignore errors for individual departments
                }
              }

              return {
                ...audit,
                title: auditDetails.title || audit.title || auditDetails.name || 'Untitled Audit',
                type: auditDetails.type || audit.type || auditDetails.auditType || '',
                status: auditDetails.status || audit.status || '',
                departmentCount: deptArray.length,
                findingCount: totalFindings,
              };
            } catch (err) {
              console.error(`Error enriching audit ${audit.auditId}:`, err);
              return audit;
            }
          })
        );

        setAudits(enrichedAudits);
      } catch (err: any) {
        console.error('Error loading audits:', err);
        toast.error('Failed to load audits');
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

  // Load departments when audit is selected
  const handleAuditSelect = async (auditId: string) => {
    setSelectedAuditId(auditId);
    setSelectedDeptId(null);
    setFindings([]);
    setSelectedFindingId(null);
    setActions([]);
    
    setLoadingDepartments(true);
    try {
      const deptData = await getAuditScopeDepartmentsByAuditId(auditId);
      const deptList = unwrap<Department>(deptData);
      const deptArray = Array.isArray(deptList) ? deptList : [];
      setDepartments(deptArray);
    } catch (err: any) {
      console.error('Error loading departments:', err);
      toast.error('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

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
  const getDisplayStatus = (finding: Finding): string => {
    const originalStatus = finding.status || '';
    const statusLower = originalStatus.toLowerCase();

    // If status is "Received", check if all actions are approved/verified
    if (statusLower === 'received') {
      const actions = findingActionsMap[finding.findingId] || [];
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
        const actions = findingActionsMap[finding.findingId] || [];
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

  // Helper function to load findings
  const loadFindings = async (deptId: number) => {
    setLoadingFindings(true);
    try {
      const findingsData = await getFindingsByDepartment(deptId);
      // Filter findings by selectedAuditId
      const filteredFindings = selectedAuditId 
        ? findingsData.filter((finding: Finding) => {
            const findingAuditId = finding.auditId || finding.audit?.auditId || '';
            return String(findingAuditId) === String(selectedAuditId);
          })
        : findingsData;
      
      // Load actions for each finding to check for "Approved" status
      const actionsMap: Record<string, Action[]> = {};
      for (const finding of filteredFindings) {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          actionsMap[finding.findingId] = actions || [];
        } catch (err) {
          console.warn(`Failed to load actions for finding ${finding.findingId}`, err);
          actionsMap[finding.findingId] = [];
        }
      }
      setFindingActionsMap(actionsMap);
      setFindings(filteredFindings);
    } catch (err: any) {
      console.error('Error loading findings:', err);
      toast.error('Failed to load findings');
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
  };

  // Load findings when department is selected
  const handleDepartmentSelect = async (deptId: number) => {
    setSelectedDeptId(deptId);
    setFindings([]);
    setSelectedFindingId(null);
    setActions([]);
    
    await loadFindings(deptId);
  };
  
  // Check if finding has action with "Approved" status
  const hasApprovedAction = (findingId: string): boolean => {
    const actions = findingActionsMap[findingId] || [];
    return actions.some(action => action.status?.toLowerCase() === 'approved');
  };

  // Load actions when finding is selected
  const handleFindingSelect = async (findingId: string) => {
    setSelectedFindingId(findingId);
    setActions([]);
    
    setLoadingActions(true);
    try {
      const actionsData = await getActionsByFinding(findingId);
      const allActions = Array.isArray(actionsData) ? actionsData : [];
      
      // Filter out actions that don't have assignedTo (these are remediation proposals, not assigned actions)
      // Only show actions that have been assigned to a CAPA Owner
      const assignedActions = allActions.filter(action => action.assignedTo);
      
      // Remove duplicates by actionId (in case API returns duplicates)
      const uniqueActionsById = new Map<string, Action>();
      assignedActions.forEach(action => {
        if (!uniqueActionsById.has(action.actionId)) {
          uniqueActionsById.set(action.actionId, action);
        }
      });
      
      setActions(Array.from(uniqueActionsById.values()));
    } catch (err: any) {
      console.error('Error loading actions:', err);
      toast.error('Failed to load actions');
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  };




  // Retry failed actions - one by one
  const handleRetryFailed = async () => {
    if (!approveResults?.failed.length) return;

    setShowResultsModal(false);
    setApprovingAll(true);

    const succeeded: Array<{actionId: string, title: string}> = [];
    const stillFailed: Array<{actionId: string, title: string, error: string}> = [];

    try {
      const failedActions = approveResults.failed;
      
      // Retry each failed action one by one
      for (let i = 0; i < failedActions.length; i++) {
        const failedAction = failedActions[i];
        const action = actions.find(a => a.actionId === failedAction.actionId);
        
        if (!action) {
          stillFailed.push({ ...failedAction, error: 'Action not found' });
          continue;
        }

        // Update progress
        setApprovingProgress({
          total: failedActions.length,
          current: i + 1,
          currentAction: action.title
        });

        try {
          // IMPORTANT: Approve only attachments with status "Open" before approving the action
          try {
            const attachments = await getAttachments('Action', action.actionId);
            const openAttachments = attachments.filter(att => att.status?.toLowerCase() === 'open');
            // const rejectedAttachments = attachments.filter(att => att.status?.toLowerCase() === 'rejected'); // Unused
            
            if (openAttachments.length > 0) {
              const approvePromises = openAttachments.map(async (attachment) => {
                try {
                  await updateAttachmentStatus(attachment.attachmentId, 'Approved');
                } catch (err: any) {
                  console.error(`  ✗ Failed to approve attachment ${attachment.fileName}:`, err);
                  // Continue with other attachments even if one fails
                }
              });
              
              await Promise.all(approvePromises);
            }
          } catch (attErr) {
            console.warn('Could not load/approve attachments for retry:', attErr);
          }
          
          // Retry approve this action
          await approveFindingActionHigherLevel(action.actionId, approveAllFeedback || '');
          
          succeeded.push({ actionId: action.actionId, title: action.title });
          toast.success(`✅ Retry successful: ${action.title}`, { autoClose: 2000 });
        } catch (error: any) {
          const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
          stillFailed.push({
            actionId: action.actionId,
            title: action.title,
            error: errorMsg
          });
          toast.error(`❌ Retry failed: ${action.title}`, { autoClose: 3000 });
        }

        // Small delay between retries
        if (i < failedActions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Update results with retry outcomes
      const newSucceeded = [...(approveResults.succeeded || []), ...succeeded];
      setApproveResults({ succeeded: newSucceeded, failed: stillFailed });

      if (stillFailed.length === 0) {
        toast.success(`🎉 Successfully approved all remaining ${succeeded.length} action${succeeded.length > 1 ? 's' : ''}!`, { autoClose: 5000 });
      } else {
        toast.warning(`⚠️ Retry completed: ${succeeded.length} succeeded, ${stillFailed.length} still failed`);
        setShowResultsModal(true);
      }

      // Reload data
      if (selectedFindingId) {
        const actionsData = await getActionsByFinding(selectedFindingId);
        setActions(Array.isArray(actionsData) ? actionsData : []);
      }
      if (selectedAuditId && selectedDeptId) {
        await loadFindings(selectedDeptId);
      }
    } catch (err: any) {
      console.error('Error retrying failed actions:', err);
      toast.error('Failed to retry actions');
    } finally {
      setApprovingAll(false);
      setApprovingProgress(null);
    }
  };

  const handleBack = () => {
    if (selectedFindingId) {
      setSelectedFindingId(null);
      setActions([]);
    } else if (selectedDeptId) {
      setSelectedDeptId(null);
      setFindings([]);
      setSelectedFindingId(null);
      setActions([]);
    } else if (selectedAuditId) {
      setSelectedAuditId(null);
      setDepartments([]);
      setSelectedDeptId(null);
      setFindings([]);
      setSelectedFindingId(null);
      setActions([]);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      {!selectedAuditId && !selectedDeptId && !selectedFindingId && (
        <div className="bg-white border-b border-primary-100 shadow-sm mb-4 sm:mb-6 ml-6">
                    <div className="px-4 sm:px-6 py-4 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-black-600">Action Review</h1>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Header for nested views */}
        {(selectedAuditId || selectedDeptId || selectedFindingId) && (
          <div className="bg-white border-b border-primary-100 shadow-sm mb-4 sm:mb-6 ">
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-xl sm:text-2xl font-semibold text-primary-600">
                  {selectedFindingId ? 'Actions' : selectedDeptId ? 'Findings' : 'Departments'}
                </h1>
              </div>
              <p className="text-gray-600 text-xs sm:text-sm ml-11">
                {selectedFindingId 
                  ? 'Review and manage actions for this finding'
                  : selectedDeptId 
                  ? 'Select a finding to view its actions'
                  : 'Select a department to view its findings'}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {!selectedAuditId ? (
          // Level 1: Audits
          <div className="space-y-6">
            {/* Loading State */}
            {loadingAudits ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading audits...</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
                {audits.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 font-semibold text-lg">No audits available</p>
                    <p className="text-sm text-gray-400 mt-2">Audits with "In Progress" status will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-primary-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Title
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Type
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Scope
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Start Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            End Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Departments
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Findings
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {audits.map((audit) => (
                          <tr
                            key={audit.auditId}
                            className="hover:bg-primary-50 transition-colors cursor-pointer group"
                            onClick={() => handleAuditSelect(audit.auditId)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">
                                {audit.title}
                              </div>
                           
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${getAuditTypeBadgeColorLocal(audit.type)}`}>
                                {audit.type || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-700 font-medium">
                                {audit.scope || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${getStatusBadgeColor(audit.status)}`}>
                                {audit.status || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                              {formatDate(audit.startDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                              {formatDate(audit.endDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-700">
                                  {audit.departmentCount !== undefined ? audit.departmentCount : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-700">
                                  {audit.findingCount !== undefined ? audit.findingCount : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAuditSelect(audit.auditId);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !selectedDeptId ? (
          // Level 2: Departments
          <div className="bg-white rounded-xl border border-primary-100  overflow-hidden">
            {loadingDepartments ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading departments...</p>
              </div>
            ) : departments.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No departments found for this audit</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <div
                    key={dept.deptId}
                    onClick={() => handleDepartmentSelect(dept.deptId)}
                  className="px-4 sm:px-6 py-4 hover:bg-primary-50 transition-colors cursor-pointer group"

                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700">
                        {dept.name}
                      </h3>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
               ) : ! selectedFindingId ? (
          // Level 3: Findings
          <div className="bg-white rounded-xl border border-primary-100  overflow-hidden">
            {loadingFindings ?  (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading findings...</p>
              </div>
            ) : findings.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No findings found for this department</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {findings.map((finding) => (
                  <div
                    key={finding.findingId}
                  className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 mb-2">
                          {finding.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            finding. severity?. toLowerCase() === 'high' || finding.severity?.toLowerCase() === 'major'
                              ? 'bg-red-100 text-red-700'
                              : finding.severity?.toLowerCase() === 'medium' || finding.severity?.toLowerCase() === 'normal'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {finding.severity || 'N/A'}
                                                  
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-block ${getStatusBadgeColor(getDisplayStatus(finding))}`}>
                            {getDisplayStatus(finding) || 'No status'}
                          </span>
                        
                          {hasApprovedAction(finding.findingId) && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                              Review
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFindingForDetail(finding.findingId);
                            setShowFindingDetailModal(true);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Detail
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFindingSelect(finding.findingId);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          View Actions
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div> ) : (
          // Level 4: Actions
          <div className="bg-white rounded-xl border border-primary-100  overflow-hidden">
            {loadingActions ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading actions...</p>
              </div>
            ) : actions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No actions found for this finding</p>
              </div>
            ) : (
              <>
                {/* Approve All Button - Show if there are multiple approved actions ready for final review */}
             
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Title
                        </th>
                       
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Progress
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {actions.map((action) => (
                        <tr key={action.actionId} className="hover:bg-blue-50 transition-colors">
                          <td className="px-6 py-4 whitespace-normal">
                            <div className="text-sm font-semibold text-gray-900">{action.title}</div>
                            {action.description && (
                              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{action.description}</div>
                            )}
                          </td>
                        
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-bold text-blue-600">{action.progressPercent || 0}%</span>
                              <div className="w-20 bg-gray-200 rounded-full h-2 shadow-inner">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                                  style={{ width: `${action.progressPercent || 0}%` }}
                                >
                                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                            {action.dueDate ? formatDate(action.dueDate) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                              action.status?.toLowerCase() === 'complete'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : action.status?.toLowerCase() === 'rejected'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : action.status?.toLowerCase() === 'approved'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : action.status?.toLowerCase() === 'verified'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : action.status?.toLowerCase() === 'reviewed'
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                : action.status?.toLowerCase() === 'approved'
                                ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {action.status || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedActionId(action.actionId);
                                setShowActionDetailModal(true);
                              }}
                              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2 mx-auto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Finding Detail Modal */}
      {showFindingDetailModal && selectedFindingForDetail && (
        <FindingDetailModal
          isOpen={showFindingDetailModal}
          onClose={() => {
            setShowFindingDetailModal(false);
            setSelectedFindingForDetail(null);
          }}
          findingId={selectedFindingForDetail}
        />
      )}

      {/* Action Detail Modal */}
      {showActionDetailModal && selectedActionId && (
        <LeadAuditorActionDetailsModal
          isOpen={showActionDetailModal}
          onClose={() => {
            setShowActionDetailModal(false);
            setSelectedActionId(null);
          }}
          actionId={selectedActionId}
          onDataReload={async () => {
            // Reload actions
            if (selectedFindingId) {
              const actionsData = await getActionsByFinding(selectedFindingId);
              const actionsList = unwrap<Action>(actionsData);
              setActions(Array.isArray(actionsList) ? actionsList : []);
              // Update actions map
              setFindingActionsMap(prev => ({
                ...prev,
                [selectedFindingId]: actionsList || []
              }));
            }
            }}
        />
      )}

      {/* Approving Progress Modal */}
      {approvingProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Approving Actions</h3>
                  <p className="text-sm text-white/80">Please wait, processing...</p>
                </div>
              </div>
            </div>

            {/* Progress Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Progress Counter */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-lg font-bold text-primary-600">
                  {approvingProgress.current} / {approvingProgress.total}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 relative"
                    style={{ width: `${(approvingProgress.current / approvingProgress.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                  </div>
                </div>
                <div className="absolute -top-1 right-0 text-xs font-bold text-primary-600">
                  {Math.round((approvingProgress.current / approvingProgress.total) * 100)}%
                </div>
              </div>

              {/* Current Action */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Current Action</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-700 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-blue-900 flex-1 break-words leading-relaxed">
                    {approvingProgress.currentAction}
                  </p>
                </div>
              </div>

              {/* Info Message */}
              <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                <svg className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="flex-1">
                  Approving each action individually. Please do not close this window.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Approve All Results Modal */}
      {showResultsModal && approveResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Bulk Approval Results</h3>
                </div>
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">Succeeded</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{approveResults?.succeeded?.length || 0}</p>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm font-medium text-red-700">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{approveResults?.failed?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Succeeded Actions */}
              {approveResults && approveResults.succeeded.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Successfully Approved ({approveResults.succeeded.length})
                  </h4>
                  <div className="space-y-2">
                    {approveResults.succeeded.map((action, idx) => (
                      <div key={action.actionId} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-green-700">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900 break-words">{action.title}</p>
                            <p className="text-xs text-green-600 mt-1">Action ID: {action.actionId}</p>
                          </div>
                          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Actions */}
              {approveResults && approveResults.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Failed to Approve ({approveResults.failed.length})
                  </h4>
                  <div className="space-y-2">
                    {approveResults.failed.map((action, idx) => (
                      <div key={action.actionId} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-red-700">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-900 break-words">{action.title}</p>
                            <p className="text-xs text-red-600 mt-1">Action ID: {action.actionId}</p>
                            <div className="mt-2 bg-red-100 border border-red-200 rounded px-2 py-1">
                              <p className="text-xs text-red-700 font-medium">Error: {action.error}</p>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Close
                </button>
                {approveResults && approveResults.failed.length > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={approvingAll}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {approvingAll ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Retrying...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Failed ({approveResults.failed.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


    </MainLayout>
  );
};

export default ActionReview;

