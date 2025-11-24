import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';

// Badge variant type matching the constants definition
type BadgeVariant = 'primary-light' | 'primary-medium' | 'primary-dark' | 'primary-solid' | 'gray-light' | 'gray-medium';

interface PlanDetailsModalProps {
  showModal: boolean;
  selectedPlanDetails: any;
  onClose: () => void;
  onEdit?: (auditId: string) => void;
  onSubmitToLead?: (auditId: string) => Promise<void>;
  // Optional callbacks for Lead Auditor actions
  onForwardToDirector?: (auditId: string, comment?: string) => Promise<void>;
  onRejectPlan?: (auditId: string, comment?: string) => Promise<void>;
  onRequestRevision?: (auditId: string, comment?: string) => Promise<void>;
  // Optional callback for Director approval
  onApprove?: (auditId: string, comment?: string) => Promise<void>;
  getCriterionName: (criterionId: string) => string;
  getDepartmentName: (deptId: string | number) => string;
  getStatusColor: (status: string) => string;
  getBadgeVariant: (variant: BadgeVariant) => string;
  ownerOptions: any[];
  auditorOptions?: any[];
  getTemplateName?: (templateId: string | number | null | undefined) => string;
  // Optional prop to hide specific sections
  hideSections?: string[];
  // Optional prop to check if current user is Lead Auditor of THIS specific plan
  currentUserId?: string | null;
  // Optional prop to pass audit teams for this specific plan
  auditTeamsForPlan?: any[];
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  showModal,
  selectedPlanDetails,
  onClose,
  onEdit,
  onSubmitToLead,
  onForwardToDirector,
  onRejectPlan,
  onRequestRevision,
  onApprove,
  getCriterionName,
  getDepartmentName,
  getStatusColor,
  getBadgeVariant,
  ownerOptions,
  auditorOptions = [],
  getTemplateName,
  hideSections = [],
  currentUserId = null,
  auditTeamsForPlan = [],
}) => {
  if (!showModal || !selectedPlanDetails) return null;

  // Check if current user is Lead Auditor of THIS specific plan
  const isLeadAuditor = React.useMemo(() => {
    if (!currentUserId || !auditTeamsForPlan.length) return false;
    
    const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
    if (!currentAuditId) return false;
    
    // Check if user has isLead: true in THIS plan's audit team
    const isLead = auditTeamsForPlan.some((m: any) => {
      const teamAuditId = String(m?.auditId || '').trim();
      const teamUserId = String(m?.userId || '').trim();
      const userIdMatch = teamUserId === String(currentUserId).trim() || 
                         teamUserId.toLowerCase() === String(currentUserId).trim().toLowerCase();
      const auditIdMatch = teamAuditId === String(currentAuditId).trim() ||
                          teamAuditId.toLowerCase() === String(currentAuditId).trim().toLowerCase();
      const isLeadMatch = m?.isLead === true;
      return userIdMatch && auditIdMatch && isLeadMatch;
    });
    
    return isLead;
  }, [currentUserId, auditTeamsForPlan, selectedPlanDetails.auditId, selectedPlanDetails.id]);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const reviewComments = ''; // Review comments for actions

  // Debug: Log selectedPlanDetails to check data
  React.useEffect(() => {
    if (showModal && selectedPlanDetails) {
      console.log('🔍 PlanDetailsModal - selectedPlanDetails:', {
        title: selectedPlanDetails.title,
        type: selectedPlanDetails.type,
        startDate: selectedPlanDetails.startDate,
        endDate: selectedPlanDetails.endDate,
        scope: selectedPlanDetails.scope,
        status: selectedPlanDetails.status,
        objective: selectedPlanDetails.objective,
        fullObject: selectedPlanDetails,
      });
    }
  }, [showModal, selectedPlanDetails]);

  // Build a list of audit team members to render. If Auditee Owners are not present
  // in `selectedPlanDetails.auditTeams.values`, try to supplement them from `ownerOptions`.
  const auditTeamsFromDetails: any[] = Array.isArray(selectedPlanDetails.auditTeams?.values)
    ? selectedPlanDetails.auditTeams.values
    : [];

  const ownerUserIdsInTeam = new Set(auditTeamsFromDetails.map((m) => String(m.userId)));

  // Determine owners relevant for this plan: if scope is 'Department', pick owners whose deptId
  // matches any selected scope department; if scope is 'Academy' pick all provided ownerOptions.
  const relevantOwners: any[] = (ownerOptions || []).filter((o: any) => {
    if (!o) return false;
    if (!selectedPlanDetails) return false;
    const scope = String(selectedPlanDetails.scope || '').toLowerCase();
    const ownerDeptId = o.deptId ?? o.departmentId ?? o.deptID ?? o.dept?.id;
    if (scope === 'department') {
      const deptIds = (selectedPlanDetails.scopeDepartments?.values || []).map((d: any) => String(d.deptId));
      return deptIds.length === 0 ? false : deptIds.includes(String(ownerDeptId));
    }
    return true;
  });

  const missingOwners = relevantOwners
    .filter((o) => {
      const uid = o.userId ?? o.id ?? o.$id;
      return !ownerUserIdsInTeam.has(String(uid));
    })
    .map((o) => {
      const uid = o.userId ?? o.id ?? o.$id;
      return {
        userId: uid,
        fullName: o.fullName || o.name || `User ${uid}`,
        roleInTeam: 'AuditeeOwner',
        isLead: false,
        email: o.email,
      };
    });

  // Build user lookup map from auditorOptions and ownerOptions
  const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
  const userMap = new Map<string, any>();
  
  allUsers.forEach((u: any) => {
    // Get all possible ID fields
    const possibleIds = [
      u.userId,
      u.id,
      u.$id,
    ].filter(id => id !== undefined && id !== null && id !== '');
    
    // Index by all possible ID formats (string, lowercase, number)
    possibleIds.forEach((id: any) => {
      const idStr = String(id);
      // Store with lowercase key
      userMap.set(idStr.toLowerCase(), u);
      // Also store with original case (in case of exact match needed)
      userMap.set(idStr, u);
      // Try as number if it's a valid number string
      if (!isNaN(Number(idStr)) && idStr.trim() !== '') {
        userMap.set(String(Number(idStr)), u);
      }
    });
    
    // Also index by email for fallback lookup
    if (u.email) {
      const emailStr = String(u.email);
      userMap.set(emailStr.toLowerCase(), u);
      userMap.set(emailStr, u);
    }
  });

  // Enrich audit team members with fullName from userMap
  const enrichedAuditTeam = auditTeamsFromDetails.map((member: any) => {
    const userId = member.userId || member.id || member.$id;
    const userIdStr = userId ? String(userId).trim() : '';
    
    // Try multiple lookup strategies
    let user = null;
    if (userIdStr) {
      // Try exact match (case-insensitive first, then original case)
      user = userMap.get(userIdStr.toLowerCase()) || userMap.get(userIdStr);
      
      // If still not found, try with the original userId value (in case it's a different type)
      if (!user && userId) {
        const originalStr = String(userId).trim();
        user = userMap.get(originalStr.toLowerCase()) || userMap.get(originalStr);
      }
      
      // Try as number if it's a valid number string
      if (!user && !isNaN(Number(userIdStr)) && userIdStr !== '') {
        user = userMap.get(String(Number(userIdStr)));
      }
    }
    
    // Fallback to email lookup
    if (!user && member.email) {
      const emailStr = String(member.email).trim();
      user = userMap.get(emailStr.toLowerCase()) || userMap.get(emailStr);
    }
    
    // Use found user's fullName, or keep existing fullName, or fallback to User ID
    const fullName = member.fullName || user?.fullName || user?.name;
    
    // Debug logging only if we couldn't find the user
    if (showModal && !fullName && userIdStr && userMap.size > 0) {
      console.warn('⚠️ PlanDetailsModal - Could not find fullName for userId:', userIdStr, {
        memberKeys: Object.keys(member),
        userIdType: typeof userId,
        userFound: !!user,
        userMapSize: userMap.size,
        sampleKeys: Array.from(userMap.keys()).slice(0, 3),
      });
    }
    
    return {
      ...member,
      fullName: fullName || (userIdStr ? `User ID: ${userIdStr}` : 'Unknown User'),
      email: member.email || user?.email,
    };
  });

  const combinedAuditTeam = [...enrichedAuditTeam, ...missingOwners];

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden">
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6  shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              
              <div>
                <h3 className="text-2xl font-bold text-white">Audit Plan Details</h3>
                
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
              title="Close"
            >
              
            </button>
          </div>
        </div>

        {/* Content area with scroll */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
          <div className="p-8 space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Basic Information</h3>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Title:</span>
                <span className="text-sm text-black font-normal">{selectedPlanDetails.title}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Type:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getBadgeVariant('primary-light')}`}>
                  {selectedPlanDetails.type}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Start Date:</span>
                <span className="text-sm text-black font-normal">
                  {selectedPlanDetails.startDate
                    ? new Date(selectedPlanDetails.startDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              {!hideSections.includes('status') && (
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Status:</span>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(
                      selectedPlanDetails.status
                    )}`}
                  >
                    {selectedPlanDetails.status}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">End Date:</span>
                <span className="text-sm text-black font-normal">
                  {selectedPlanDetails.endDate
                    ? new Date(selectedPlanDetails.endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Scope:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getBadgeVariant('primary-medium')}`}>
                  {selectedPlanDetails.scope || 'N/A'}
                </span>
              </div>
              {selectedPlanDetails.templateId && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <span className="text-sm font-bold text-black min-w-[100px]">Template:</span>
                  <span className="text-sm text-black font-normal">
                    {getTemplateName
                      ? getTemplateName(selectedPlanDetails.templateId)
                      : String(selectedPlanDetails.templateId)}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3 md:col-span-2">
                <span className="text-sm font-bold text-black min-w-[100px]">Objective:</span>
                <span className="text-sm text-black font-normal flex-1 leading-relaxed">
                  {selectedPlanDetails.objective || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Created By Section */}
          {selectedPlanDetails.createdByUser && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Created By</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Name:</span>
                  <span className="text-sm text-black font-normal">
                    {selectedPlanDetails.createdByUser.fullName}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Email:</span>
                  <span className="text-sm text-black font-normal">
                    {selectedPlanDetails.createdByUser.email}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Role:</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getBadgeVariant('primary-light')}`}>
                    {selectedPlanDetails.createdByUser.roleName}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Created At:</span>
                  <span className="text-sm text-black font-normal">
                    {new Date(selectedPlanDetails.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scope Departments Section */}
          {!hideSections.includes('scopeDepartments') && selectedPlanDetails.scopeDepartments?.values?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Scope Departments</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPlanDetails.scopeDepartments.values.map((dept: any, idx: number) => {
                  const deptName = dept.deptName || getDepartmentName(dept.deptId);
                  const deptHead = ownerOptions.find(
                    (owner: any) => String(owner.deptId) === String(dept.deptId)
                  );

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-5 border-2 border-gray-200 hover:border-primary-300 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="text-center mb-3">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{deptName}</p>
                      </div>
                      {deptHead && (
                        <div className="pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-xs font-bold text-gray-600">Department Head:</span>
                            <span className="text-sm font-semibold text-gray-900">{deptHead.fullName}</span>
                          </div>
                          {deptHead.email && (
                            <div className="mt-1 text-center">
                              <span className="text-xs text-gray-600">{deptHead.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Criteria Section */}
          {!hideSections.includes('auditCriteria') && selectedPlanDetails.criteria?.values?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
               
                <h3 className="text-lg font-bold text-primary-700">Audit Criteria</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedPlanDetails.criteria.values.map((criterion: any, idx: number) => {
                  const displayName =
                    criterion.name ||
                    criterion.criterionName ||
                    getCriterionName(
                      criterion.criteriaId || criterion.criterionId || criterion.auditCriteriaMapId
                    );
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="bg-primary-600 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm text-black font-normal">{displayName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Team Section */}
          {!hideSections.includes('auditTeam') && combinedAuditTeam.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Audit Team</h3>
              </div>
              <div className="space-y-2">
                {combinedAuditTeam
                  .filter((m: any) => String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '') !== 'auditeeowner')
                  .sort((a: any, b: any) => {
                    // Sort: Lead Auditor first, then others
                    if (a.isLead && !b.isLead) return -1;
                    if (!a.isLead && b.isLead) return 1;
                    return 0;
                  })
                  .map((member: any, idx: number) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all `}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        member.isLead ? 'bg-primary-600' : 'bg-gray-300'
                      }`}>
                        <span className={`text-xs font-bold ${
                          member.isLead ? 'text-white' : 'text-gray-700'
                        }`}>
                          {member.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${member.isLead ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
                            {member.fullName}
                          </span>
                          {member.isLead && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getBadgeVariant('primary-solid')} text-white`}>
                              Lead Auditor
                            </span>
                          )}
                          {member.roleInTeam && !member.isLead && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBadgeVariant('primary-light')}`}>
                              {member.roleInTeam}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Schedule & Milestones Section */}
          {selectedPlanDetails.schedules?.values?.length > 0 && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
               
                <h3 className="text-lg font-bold text-primary-700">Schedule & Milestones</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPlanDetails.schedules.values.map((schedule: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      
                      <p className="text-sm font-bold ">
                        {schedule.milestoneName || 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      {schedule.dueDate && (
                        <div className="flex items-center justify-center gap-2">
                          
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-600">Due Date:</p>
                            <p className="text-xs text-gray-600">
                              {new Date(schedule.dueDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      {schedule.evidenceDate && (
                        <div className="flex items-center justify-center gap-2">
                          <div className="text-center">
                            <p className="text-xs font-bold text-black">Evidence Date:</p>
                            <p className="text-sm text-black font-normal">
                              {new Date(schedule.evidenceDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
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

        

        {/* Footer with actions */}
        <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5  shadow-lg">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>

            {onForwardToDirector && (
              <button
                onClick={() => setShowForwardModal(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-600 hover:bg-primary-700 text-white"
              >
                Forward to Director
              </button>
            )}

            {onRequestRevision && (
              <button
                onClick={async () => {
                  try {
                    await onRequestRevision(selectedPlanDetails.auditId, reviewComments);
                    onClose();
                  } catch (err) {
                    console.error('Request revision failed', err);
                    alert('Failed to request revision: ' + (err as any)?.message || String(err));
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-500 hover:bg-primary-600 text-white"
              >
                Request Revision
              </button>
            )}

            {onRejectPlan && (
              <button
                onClick={async () => {
                  if (!reviewComments) {
                    if (!window.confirm('Reject without comment?')) return;
                  }
                  try {
                    await onRejectPlan(selectedPlanDetails.auditId, reviewComments);
                    onClose();
                  } catch (err) {
                    console.error('Reject failed', err);
                    alert('Failed to reject: ' + (err as any)?.message || String(err));
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-red-500 hover:bg-red-600 text-white"
              >
                Reject
              </button>
            )}

            {onApprove && (
              <button
                onClick={async () => {
                  try {
                    await onApprove(selectedPlanDetails.auditId, reviewComments);
                    onClose();
                  } catch (err) {
                    console.error('Approve failed', err);
                    alert('Failed to approve: ' + (err as any)?.message || String(err));
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-600 hover:bg-primary-700 text-white"
              >
                Approve
              </button>
            )}

            {/* If the plan is still Draft, allow submitting to Lead Auditor (but not if current user is Lead Auditor) */}
            {selectedPlanDetails.status === 'Draft' && onSubmitToLead && !isLeadAuditor && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-600 hover:bg-primary-700 text-white"
              >
                Submit to Lead Auditor
              </button>
            )}

            
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  // Submit Confirmation Modal
  const submitModalContent = showSubmitModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowSubmitModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Submit
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure to submit this audit plan to Lead Auditor?
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!onSubmitToLead) return;
                try {
                  await onSubmitToLead(selectedPlanDetails.auditId);
                  setShowSubmitModal(false);
                  onClose();
                } catch (err) {
                  console.error('Failed to submit to lead auditor', err);
                  const errorMessage = (err as any)?.response?.data?.message || (err as any)?.message || String(err);
                  toast.error('Failed to submit to Lead Auditor: ' + errorMessage);
                }
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Forward to Director Confirmation Modal
  const forwardModalContent = showForwardModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowForwardModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Forward
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure to submit to Director?
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForwardModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!onForwardToDirector) return;
                try {
                  await onForwardToDirector(selectedPlanDetails.auditId, reviewComments);
                  setShowForwardModal(false);
                  toast.success('Submit successfully.');
                  onClose();
                } catch (err) {
                  console.error('Forward to director failed', err);
                  const errorMessage = (err as any)?.response?.data?.message || (err as any)?.message || String(err);
                  toast.error('Failed to forward to Director: ' + errorMessage);
                }
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Render modal using Portal to ensure it's outside the DOM hierarchy
  return (
    <>
      {createPortal(modalContent, document.body)}
      {submitModalContent}
      {forwardModalContent}
    </>
  );
};
