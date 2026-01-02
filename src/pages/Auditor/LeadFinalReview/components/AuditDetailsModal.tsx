import { useMemo } from 'react';
import type { Audit, Finding, ActionWithDetails, AuditMetadata } from '../types';
import { getAuditTypeBadgeColor } from '../../../../constants';

type AuditDetailsModalProps = {
  open: boolean;
  audit: Audit | null;
  auditDetail: AuditMetadata | null;
  findings: Finding[];
  loading: boolean;
  loadingAuditDetail: boolean;
  processingAction: boolean;
  onClose: () => void;
  onActionDecision: (action: ActionWithDetails, type: 'approve' | 'reject') => void;
  showActionControls?: boolean;
  auditeeOwnerMode?: boolean; // When true, show approve buttons for Reviewed/InProgress/Active/Open statuses
  auditorMode?: boolean; // When true, show approve buttons for Verified status (approved by AuditeeOwner, pending Auditor review)
};

const statusMap: Record<
  string,
  {
    label: string;
    color: string;
  }
> = {
  Open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  Active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  InProgress: { label: 'In progress', color: 'bg-yellow-100 text-yellow-700' },
  Reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700' },
  Approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  ApprovedAuditor: { label: 'Approved by auditor', color: 'bg-teal-100 text-teal-700' },
  Rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  Returned: { label: 'Returned', color: 'bg-orange-100 text-orange-700' },
  Closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
  Completed: { label: 'Completed', color: 'bg-green-100 text-gray-700' },
};

const getStatusBadge = (status?: string) => {
  if (!status) return null;
  const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AuditDetailsModal = ({
  open,
  audit,
  auditDetail,
  findings,
  loading,
  loadingAuditDetail,
  processingAction,
  onClose,
  onActionDecision,
  showActionControls = true,
  auditeeOwnerMode = false,
  auditorMode = false,
}: AuditDetailsModalProps) => {
  const stats = useMemo(() => {
    const actions = findings.flatMap(f => f.actions || []);
    return {
      findings: findings.length,
      pending: actions.filter(a => a.status === 'Approved').length,
      approved: actions.filter(a => a.status === 'ApprovedAuditor').length,
      returned: actions.filter(a => a.status === 'Returned').length,
    };
  }, [findings]);

  if (!open || !audit) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-primary px-6 py-4 border-b border-primary-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-white">Audit Details</h3>
              <p className="text-sm text-primary-100 mt-1">{audit.title}</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-primary-100 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Findings</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{stats.findings}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Pending Approval</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500">Returned</div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{stats.returned}</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">Basic Information</h4>
              {getStatusBadge(auditDetail?.status || audit.status)}
            </div>
            {loadingAuditDetail ? (
              <div className="text-sm text-gray-500">Loading audit info...</div>
            ) : auditDetail ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Audit type</p>
                    {auditDetail.type ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getAuditTypeBadgeColor(auditDetail.type, 'default')}`}>
                        {auditDetail.type}
                      </span>
                    ) : (
                      <p className="font-medium text-gray-900">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Scope</p>
                    <p className="font-medium text-gray-900">{auditDetail.scope || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Status</p>
                    <p className="font-medium text-gray-900">{auditDetail.status || audit.status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Start date</p>
                    <p className="font-medium text-gray-900">{formatDate(auditDetail.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">End date</p>
                    <p className="font-medium text-gray-900">{formatDate(auditDetail.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Created by</p>
                    <p className="font-medium text-gray-900">
                      {auditDetail.createdByName || '—'}
                      {auditDetail.createdByEmail && (
                        <span className="block text-xs text-gray-500">{auditDetail.createdByEmail}</span>
                      )}
                    </p>
                  </div>
                </div>
                {auditDetail.objective && (
                  <div className="bg-white rounded-lg p-4 text-sm text-gray-700 border border-dashed border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Objective</p>
                    <p className="whitespace-pre-line">{auditDetail.objective}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500">Audit information not found.</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Audit team</h4>
                <span className="text-xs text-gray-500">{auditDetail?.team.length || 0} members</span>
              </div>
              {loadingAuditDetail ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : auditDetail && auditDetail.team.length > 0 ? (
                <ul className="space-y-2">
                  {auditDetail.team.map(member => (
                    <li
                      key={`${member.userId || member.name}`}
                      className="flex flex-col border border-gray-100 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between text-sm font-medium text-gray-900">
                        <span>{member.name}</span>
                        {member.isLead && <span className="text-xs text-primary-600 font-semibold">Lead</span>}
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                        <span>{member.roleInTeam || '—'}</span>
                        {member.email && <span>• {member.email}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No data yet.</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Department scope</h4>
                <span className="text-xs text-gray-500">{auditDetail?.departments.length || 0} items</span>
              </div>
              {loadingAuditDetail ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : auditDetail && auditDetail.departments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {auditDetail.departments.map(dept => (
                    <span
                      key={`${dept.deptId || dept.name}`}
                      className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
                    >
                      {dept.name} {dept.status ? `• ${dept.status}` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data yet.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Assessment criteria</h4>
                <span className="text-xs text-gray-500">{auditDetail?.criteria.length || 0} criteria</span>
              </div>
              {loadingAuditDetail ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : auditDetail && auditDetail.criteria.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {auditDetail.criteria.map(criteria => (
                    <span
                      key={criteria.criteriaId}
                      className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium"
                    >
                      {criteria.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data yet.</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Timeline</h4>
                <span className="text-xs text-gray-500">{auditDetail?.schedules.length || 0} milestones</span>
              </div>
              {loadingAuditDetail ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : auditDetail && auditDetail.schedules.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {auditDetail.schedules.map(schedule => (
                    <li key={schedule.scheduleId} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary-500" />
                      <div>
                        <p className="font-medium text-gray-900">{schedule.milestoneName}</p>
                        <p className="text-xs text-gray-500">{formatDate(schedule.dueDate)}</p>
                        {schedule.status && <p className="text-xs text-gray-500">Status: {schedule.status}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No data yet.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">Findings & Actions</h4>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-600">Loading findings...</div>
            ) : findings.length === 0 ? (
              <div className="p-6 text-center text-gray-600">No findings.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {findings.map(finding => (
                  <div key={finding.findingId} className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <h5 className="text-base font-semibold text-gray-900">{finding.title}</h5>
                          {getStatusBadge(finding.status)}
                        </div>
                        <p className="text-sm text-gray-600">{finding.description}</p>
                        <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                          <p>
                            Severity: <span className="font-medium">{finding.severity || '-'}</span>
                          </p>
                          <p>
                            Deadline:{' '}
                            <span className="font-medium">{finding.deadline ? formatDate(finding.deadline) : 'N/A'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        {finding.severity && <span>{finding.severity}</span>}
                      </div>
                    </div>

                    {finding.findingAttachments && finding.findingAttachments.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          📎 Finding Attachments ({finding.findingAttachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {finding.findingAttachments.map(file => (
                            <a
                              key={file.attachmentId}
                              href={file.filePath || file.blobPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1 bg-white rounded text-xs hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="text-gray-700 truncate max-w-[150px]">{file.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {finding.actions && finding.actions.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-700">Actions ({finding.actions.length})</p>
                        {finding.actions.map(action => (
                          <div key={action.actionId} className="p-4 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{action.title}</span>
                                  {getStatusBadge(action.status)}
                                </div>
                                <p className="text-xs text-gray-600">{action.description}</p>
                                <div className="text-xs text-gray-500 space-y-1">
                                  <p>
                                    Assigned:{' '}
                                    <span className="font-medium text-gray-700">
                                      {action.assignedUserName || action.assignedTo || '-'}
                                    </span>
                                  </p>
                                  <p>Progress: {action.progressPercent ?? 0}%</p>
                                  <p>Due: {formatDate(action.dueDate)}</p>
                                </div>
                                {action.reviewFeedback && (
                                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                    <p className="font-semibold text-gray-700 mb-1">💬 Feedback:</p>
                                    <p className="text-gray-600">{action.reviewFeedback}</p>
                                  </div>
                                )}
                              </div>

                                  {showActionControls && (() => {
                                // For AuditeeOwner: show buttons for Reviewed/InProgress/Active/Open (not yet approved by AuditeeOwner)
                                if (auditeeOwnerMode) {
                                  return ['Reviewed', 'InProgress', 'Active', 'Open'].includes(action.status || '');
                                }
                                // For Auditor: show buttons for Verified (approved by AuditeeOwner, pending Auditor review)
                                if (auditorMode) {
                                  return action.status === 'Verified';
                                }
                                // For Lead Auditor: show buttons only for Approved (already approved by Auditor, ready for final review)
                                return action.status === 'Approved';
                              })() && (
                                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                                  <button
                                    onClick={() => onActionDecision(action, 'approve')}
                                    disabled={processingAction}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50"
                                  >
                                     Approve
                                  </button>
                                  <button
                                    onClick={() => onActionDecision(action, 'reject')}
                                    disabled={processingAction}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50"
                                  >
                                     Reject
                                  </button>
                                </div>
                              )}
                            </div>

                            {action.attachments && action.attachments.length > 0 && (
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  📎 Evidence ({action.attachments.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {action.attachments.map(file => (
                                    <a
                                      key={file.attachmentId}
                                      href={file.filePath || file.blobPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs hover:bg-green-100 transition-colors"
                                    >
                                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                      </svg>
                                      <span className="text-gray-700 truncate max-w-[120px]">{file.fileName}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditDetailsModal;

