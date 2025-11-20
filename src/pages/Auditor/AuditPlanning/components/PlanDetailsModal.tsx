import React from 'react';

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
  getTemplateName?: (templateId: string | number | null | undefined) => string;
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
  getTemplateName,
}) => {
  if (!showModal || !selectedPlanDetails) return null;

  const [reviewComments, setReviewComments] = React.useState('');

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

  const combinedAuditTeam = [...auditTeamsFromDetails, ...missingOwners];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-primary px-6 py-5 border-b border-sky-500">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">Audit Plan Details</h3>
              
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-sky-800 rounded-full p-2 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic Information Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">Title:</span>
                <span className="text-sm text-gray-900 font-medium">{selectedPlanDetails.title}</span>
              </div>
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">Type:</span>
                <span className="text-sm text-gray-900">{selectedPlanDetails.type}</span>
              </div>
              {selectedPlanDetails.templateId && (
                <div className="flex col-span-1 md:col-span-2">
                  <span className="text-sm font-medium text-gray-600 w-32">Template:</span>
                  <span className="text-sm text-gray-900">
                    {getTemplateName
                      ? getTemplateName(selectedPlanDetails.templateId)
                      : String(selectedPlanDetails.templateId)}
                  </span>
                </div>
              )}
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">Start Date:</span>
                <span className="text-sm text-gray-900">
                  {selectedPlanDetails.startDate
                    ? new Date(selectedPlanDetails.startDate).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">End Date:</span>
                <span className="text-sm text-gray-900">
                  {selectedPlanDetails.endDate
                    ? new Date(selectedPlanDetails.endDate).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">Scope:</span>
                <span className="text-sm text-gray-900">{selectedPlanDetails.scope || 'N/A'}</span>
              </div>
              <div className="flex">
                <span className="text-sm font-medium text-gray-600 w-32">Status:</span>
                <span
                  className={`text-sm px-2 py-0.5 rounded font-medium ${getStatusColor(
                    selectedPlanDetails.status
                  )}`}
                >
                  {selectedPlanDetails.status}
                </span>
              </div>
              <div className="flex col-span-1 md:col-span-2">
                <span className="text-sm font-medium text-gray-600 w-32">Objective:</span>
                <span className="text-sm text-gray-900 flex-1">
                  {selectedPlanDetails.objective || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Created By Section */}
          {selectedPlanDetails.createdByUser && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
               Created By
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                <div className="flex">
                  <span className="text-sm font-medium text-gray-600 w-32">Name:</span>
                  <span className="text-sm text-gray-900">
                    {selectedPlanDetails.createdByUser.fullName}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-sm font-medium text-gray-600 w-32">Email:</span>
                  <span className="text-sm text-gray-900">
                    {selectedPlanDetails.createdByUser.email}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-sm font-medium text-gray-600 w-32">Role:</span>
                  <span className="text-sm text-gray-900">
                    {selectedPlanDetails.createdByUser.roleName}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-sm font-medium text-gray-600 w-32">Created At:</span>
                  <span className="text-sm text-gray-900">
                    {new Date(selectedPlanDetails.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scope Departments Section */}
          {selectedPlanDetails.scopeDepartments?.values?.length > 0 && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
               Scope Departments
              </h3>
              <div className="space-y-2">
                {selectedPlanDetails.scopeDepartments.values.map((dept: any, idx: number) => {
                  const deptName = dept.deptName || getDepartmentName(dept.deptId);
                  // Find department head (AuditeeOwner) for this department
                  const deptHead = ownerOptions.find(
                    (owner: any) => String(owner.deptId) === String(dept.deptId)
                  );

                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-start">
                        <span className="text-primary-500 mr-2 mt-0.5">•</span>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{deptName}</span>
                          {deptHead && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              Trưởng phòng: <span className="font-medium">{deptHead.fullName}</span>
                              {deptHead.email && (
                                <span className="text-gray-500"> ({deptHead.email})</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Criteria Section */}
          {selectedPlanDetails.criteria?.values?.length > 0 && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
                Audit Criteria
              </h3>
              <ul className="space-y-2">
                {selectedPlanDetails.criteria.values.map((criterion: any, idx: number) => {
                  // Use criterion.name if available, otherwise lookup by criteriaId
                  // API uses 'criteriaId' (with 'a'), not 'criterionId'
                  const displayName =
                    criterion.name ||
                    criterion.criterionName ||
                    getCriterionName(
                      criterion.criteriaId || criterion.criterionId || criterion.auditCriteriaMapId
                    );
                  return (
                    <li key={idx} className="flex items-start">
                      <span className="text-primary-500 mr-2">•</span>
                      <span className="text-sm text-gray-700">{displayName}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Audit Team Section */}
          {combinedAuditTeam.length > 0 && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
                 Audit Team
              </h3>
              <ul className="space-y-2">
                {combinedAuditTeam
                  .filter((m: any) => String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '') !== 'auditeeowner')
                  .map((member: any, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary-500 mr-2">•</span>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{member.fullName}</span>
                      {member.roleInTeam && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded ${getBadgeVariant(
                            'primary-light'
                          )}`}
                        >
                          {member.roleInTeam}
                        </span>
                      )}
                      {member.isLead && (
                        <span
                          className={`ml-1 text-xs px-2 py-0.5 rounded font-semibold ${getBadgeVariant(
                            'primary-medium'
                          )}`}
                        >
                          Lead
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Schedule & Milestones Section */}
          {selectedPlanDetails.schedules?.values?.length > 0 && (
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
                Schedule & Milestones
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPlanDetails.schedules.values.map((schedule: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-sky-50 rounded-lg p-4 border border-sky-200 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-sky-600 mb-1">Milestone</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {schedule.milestoneName || 'N/A'}
                        </p>
                      </div>
                      {schedule.dueDate && (
                        <div>
                          <p className="text-xs font-medium text-sky-600 mb-1">Due Date</p>
                          <p className="text-sm text-gray-700">
                            {new Date(schedule.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                      {schedule.evidenceDate && (
                        <div>
                          <p className="text-xs font-medium text-sky-600 mb-1">Evidence Date</p>
                          <p className="text-sm text-gray-700">
                            {new Date(schedule.evidenceDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                      {schedule.status && (
                        <div>
                          <p className="text-xs font-medium text-sky-600 mb-1">Status</p>
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(
                              schedule.status
                            )}`}
                          >
                            {schedule.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Review comments area for Lead Auditor actions */}
        <div className="px-6 pb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Review Comments (Optional)</h4>
          <textarea
            value={reviewComments}
            onChange={(e) => setReviewComments(e.target.value)}
            rows={4}
            placeholder="Add any comments or feedback for the Auditor..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          ></textarea>
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-300 flex justify-center gap-3">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            Close
          </button>

          {onForwardToDirector && (
            <button
              onClick={async () => {
                try {
                  await onForwardToDirector(selectedPlanDetails.auditId, reviewComments);
                  onClose();
                } catch (err) {
                  console.error('Forward to director failed', err);
                  alert('Failed to forward to Director: ' + (err as any)?.message || String(err));
                }
              }}
              className="px-8 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors shadow-sm"
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
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
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
              className="px-8 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors shadow-sm"
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
              className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Approve
            </button>
          )}

          {/* If the plan is still Draft, allow submitting to Lead Auditor */}
          {selectedPlanDetails.status === 'Draft' && onSubmitToLead && (
            <button
              onClick={async () => {
                if (!window.confirm('Submit this plan to Lead Auditor?')) return;
                try {
                  await onSubmitToLead(selectedPlanDetails.auditId);
                  // close modal after submit
                  onClose();
                } catch (err) {
                  console.error('Failed to submit to lead auditor', err);
                  alert('Failed to submit to Lead Auditor: ' + (err as any)?.message || String(err));
                }
              }}
              className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Submit to Lead Auditor
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit(selectedPlanDetails.auditId);
              }}
              className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Edit Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
