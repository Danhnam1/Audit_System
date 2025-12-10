import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditPlanById } from '../../../api/audits';
import { getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import { getActionsByFinding, type Action } from '../../../api/actions';
import { approveFindingActionHigherLevel, rejectFindingActionHigherLevel } from '../../../api/findings';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';
import FindingDetailModal from '../../Auditor/FindingManagement/FindingDetailModal';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { getStatusColor } from '../../../constants';

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
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [showFindingDetailModal, setShowFindingDetailModal] = useState(false);
  const [selectedFindingForDetail, setSelectedFindingForDetail] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'reject'>('approve');
  const [feedback, setFeedback] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [findingActionsMap, setFindingActionsMap] = useState<Record<string, Action[]>>({}); // findingId -> actions

  const getStatusBadgeColor = (status: string) => {
    return getStatusColor(status) || 'bg-gray-100 text-gray-700';
  };

  const getAuditTypeBadgeColor = (auditType: string) => {
    const typeLower = auditType?.toLowerCase() || '';
    switch (typeLower) {
      case 'internal':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'external':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'compliance':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
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
              
              // Count findings across all departments
              let totalFindings = 0;
              for (const dept of deptArray) {
                try {
                  const findings = await getFindingsByDepartment(dept.deptId);
                  totalFindings += findings.length;
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

  // Load findings when department is selected
  const handleDepartmentSelect = async (deptId: number) => {
    setSelectedDeptId(deptId);
    setFindings([]);
    setSelectedFindingId(null);
    setActions([]);
    
    setLoadingFindings(true);
    try {
      const findingsData = await getFindingsByDepartment(deptId);
      setFindings(findingsData);
      
      // Load actions for each finding to check for "Approved" status
      const actionsMap: Record<string, Action[]> = {};
      for (const finding of findingsData) {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          actionsMap[finding.findingId] = actions || [];
        } catch (err) {
          console.warn(`Failed to load actions for finding ${finding.findingId}`, err);
          actionsMap[finding.findingId] = [];
        }
      }
      setFindingActionsMap(actionsMap);
    } catch (err: any) {
      console.error('Error loading findings:', err);
      toast.error('Failed to load findings');
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
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
      setActions(Array.isArray(actionsData) ? actionsData : []);
    } catch (err: any) {
      console.error('Error loading actions:', err);
      toast.error('Failed to load actions');
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  };

  // Handle approve action (open feedback modal)
  const handleApproveAction = (actionId: string) => {
    setPendingActionId(actionId);
    setFeedbackType('approve');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  // Handle reject action (open feedback modal)
  const handleRejectAction = (actionId: string) => {
    setPendingActionId(actionId);
    setFeedbackType('reject');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (!pendingActionId) return;

    // For reject, feedback is required
    if (feedbackType === 'reject' && !feedback.trim()) {
      toast.warning('Please enter feedback for rejection');
      return;
    }

    setProcessingActionId(pendingActionId);
    try {
      if (feedbackType === 'approve') {
        await approveFindingActionHigherLevel(pendingActionId, feedback || '');
        toast.success('Action approved successfully');
      } else {
        await rejectFindingActionHigherLevel(pendingActionId, feedback);
        toast.success('Action rejected successfully');
      }
      
      setShowFeedbackModal(false);
      setPendingActionId(null);
      setFeedback('');
      
      // Reload actions
      if (selectedFindingId) {
        const actionsData = await getActionsByFinding(selectedFindingId);
        setActions(Array.isArray(actionsData) ? actionsData : []);
        // Update actions map
        setFindingActionsMap(prev => ({
          ...prev,
          [selectedFindingId]: actionsData || []
        }));
      }
    } catch (err: any) {
      console.error(`Error ${feedbackType === 'approve' ? 'approving' : 'rejecting'} action:`, err);
      toast.error(err?.message || `Failed to ${feedbackType === 'approve' ? 'approve' : 'reject'} action`);
    } finally {
      setProcessingActionId(null);
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
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg mb-6">
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Action Review</h1>
            <p className="text-primary-100 text-sm sm:text-base mt-2">Select an audit to review actions</p>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Header for nested views */}
        {(selectedAuditId || selectedDeptId || selectedFindingId) && (
          <div className="bg-white border-b border-primary-100 shadow-sm mb-4 sm:mb-6">
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
                  <div className="divide-y divide-gray-200">
                    {audits.map((audit) => (
                      <div
                        key={audit.auditId}
                        onClick={() => handleAuditSelect(audit.auditId)}
                        className="px-4 sm:px-6 py-4 hover:bg-primary-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700 mb-2">
                              {audit.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getAuditTypeBadgeColor(audit.type)}`}>
                                {audit.type || 'N/A'}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(audit.status)}`}>
                                {audit.status || 'Unknown'}
                              </span>
                              {audit.departmentCount !== undefined && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {audit.departmentCount} {audit.departmentCount === 1 ? 'department' : 'departments'}
                                </span>
                              )}
                              {audit.findingCount !== undefined && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {audit.findingCount} {audit.findingCount === 1 ? 'finding' : 'findings'}
                                </span>
                              )}
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
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
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-block ${getStatusBadgeColor(finding.status)}`}>

  {finding.status || 'No status'}

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
              <div className="divide-y divide-gray-200">
                {actions.map((action) => (
                  <div
                    key={action.actionId}
                    className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`flex items-start justify-between mb-3 ${
                      action.status?.toLowerCase() === 'complete'
                        ? 'bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg'
                        : action.status?.toLowerCase() === 'rejected'
                        ? 'bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg'
                        : ''
                    }`}>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 mb-1">{action.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{action.description || 'No description'}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Progress: {action.progressPercent || 0}%</span>
                          {action.dueDate && <span>Due: {formatDate(action.dueDate)}</span>}
                        </div>
                        {action.progressPercent && action.progressPercent > 0 && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                action.status?.toLowerCase() === 'complete'
                                  ? 'bg-green-600'
                                  : action.status?.toLowerCase() === 'rejected'
                                  ? 'bg-red-600'
                                  : 'bg-primary-600'
                              }`}
                              style={{ width: `${action.progressPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ml-4 ${
                        action.status?.toLowerCase() === 'complete'
                          ? 'bg-green-100 text-green-700'
                          : action.status?.toLowerCase() === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : action.status?.toLowerCase() === 'approved'
                          ? 'bg-blue-100 text-blue-700'
                          : action.status?.toLowerCase() === 'verified'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {action.status || 'N/A'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActionId(action.actionId);
                          setShowActionDetailModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        View Detail
                      </button>
                      {action.status?.toLowerCase() === 'approved' && (
                        <>
                          <button
                            onClick={() => handleApproveAction(action.actionId)}
                            disabled={processingActionId === action.actionId}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingActionId === action.actionId ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleRejectAction(action.actionId)}
                            disabled={processingActionId === action.actionId}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingActionId === action.actionId ? 'Processing...' : 'Reject'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
        <ActionDetailModal
          isOpen={showActionDetailModal}
          onClose={() => {
            setShowActionDetailModal(false);
            setSelectedActionId(null);
          }}
          actionId={selectedActionId}
          showReviewButtons={false}
        />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {feedbackType === 'approve' ? 'Approve Action' : 'Reject Action'}
              </h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback {feedbackType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={feedbackType === 'approve' ? 'Enter feedback (optional)' : 'Enter feedback for rejection'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={4}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setPendingActionId(null);
                  setFeedback('');
                }}
                disabled={processingActionId === pendingActionId}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={processingActionId === pendingActionId || (feedbackType === 'reject' && !feedback.trim())}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  feedbackType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processingActionId === pendingActionId ? 'Processing...' : feedbackType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
};

export default ActionReview;

