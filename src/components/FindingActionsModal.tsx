import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdminAuditLog, type AdminAuditLogEntry } from '../api/adminAuditLog';
import { getAdminUsers } from '../api/adminUsers';
import { getDepartments } from '../api/departments';
import { getAttachments, type Attachment } from '../api/attachments';
import { toast } from 'react-toastify';
import { getStatusColor } from '../constants/statusColors';

interface FindingActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId: string;
  findingTitle?: string;
}

interface ActionData {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  assignedBy: string;
  assignedTo: string;
  assignedDeptId: number;
  rootCauseId: string;
  status: string;
  progressPercent: number;
  dueDate: string;
  createdAt: string;
  closedAt: string | null;
  reviewFeedback: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  targetStartDate: string | null;
  verificationComment: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  attachments: Attachment[];
  timestamp: string;
  performedBy: string;
}

export const FindingActionsModal: React.FC<FindingActionsModalProps> = ({
  isOpen,
  onClose,
  findingId,
  findingTitle = 'Finding Actions',
}) => {
  const [actions, setActions] = useState<ActionData[]>([]);
  const [findingAttachments, setFindingAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map());
  const [deptMap, setDeptMap] = useState<Map<number, any>>(new Map());
  const [expandedFindingAttachments, setExpandedFindingAttachments] = useState(false);
  const [expandedActionAttachments, setExpandedActionAttachments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !findingId) {
      setActions([]);
      setFindingAttachments([]);
      setError(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load users
        const users = await getAdminUsers();
        const usersById = new Map();
        users.forEach((u: any) => {
          usersById.set(u.userId, u);
        });
        setUserMap(usersById);

        // Load departments
        const depts = await getDepartments();
        const deptsById = new Map();
        depts.forEach((d: any) => {
          deptsById.set(d.deptId, d);
        });
        setDeptMap(deptsById);

        // Load finding attachments
        try {
          const findingAtts = await getAttachments('Finding', findingId);
          setFindingAttachments(findingAtts);
        } catch (err) {
          console.error('Failed to load finding attachments:', err);
        }

        // Load all audit logs for this finding
        const logs = await getAdminAuditLog({
          entityType: 'Finding',
          entityId: findingId,
        });

        // Extract actions from logs
        const actionLogs = logs.filter(
          (log: AdminAuditLogEntry) =>
            log.entityType === 'Action' ||
            (log.newValue && log.newValue.includes('ActionId'))
        );

        // Also get action-specific logs
        const actionEntityLogs = await getAdminAuditLog({
          entityType: 'Action',
        });

        // Filter action logs related to this finding
        const relatedActionLogs = actionEntityLogs.filter((log: AdminAuditLogEntry) => {
          try {
            const newValue = JSON.parse(log.newValue || '{}');
            return newValue.FindingId === findingId;
          } catch {
            return false;
          }
        });

        // Combine and deduplicate
        const allActionLogs = [...actionLogs, ...relatedActionLogs];
        const uniqueActionMap = new Map<string, ActionData>();

        allActionLogs.forEach((log: AdminAuditLogEntry) => {
          try {
            const newValue = JSON.parse(log.newValue || '{}');
            if (newValue.ActionId && newValue.FindingId === findingId) {
              const actionData: ActionData = {
                actionId: newValue.ActionId,
                findingId: newValue.FindingId,
                title: newValue.Title || '',
                description: newValue.Description || '',
                assignedBy: newValue.AssignedBy || '',
                assignedTo: newValue.AssignedTo || '',
                assignedDeptId: newValue.AssignedDeptId || 0,
                rootCauseId: newValue.RootCauseId || '',
                status: newValue.Status || '',
                progressPercent: newValue.ProgressPercent || 0,
                dueDate: newValue.DueDate || '',
                createdAt: newValue.CreatedAt || '',
                closedAt: newValue.ClosedAt || null,
                reviewFeedback: newValue.ReviewFeedback || '',
                acceptedAt: newValue.AcceptedAt || null,
                rejectedAt: newValue.RejectedAt || null,
                rejectionReason: newValue.RejectionReason || null,
                targetStartDate: newValue.TargetStartDate || null,
                verificationComment: newValue.VerificationComment || null,
                verifiedBy: newValue.VerifiedBy || null,
                verifiedAt: newValue.VerifiedAt || null,
                attachments: newValue.Attachments || [],
                timestamp: log.performedAt,
                performedBy: log.performedBy,
              };

              // Keep the most recent version of each action
              const existing = uniqueActionMap.get(actionData.actionId);
              if (!existing || new Date(actionData.timestamp) > new Date(existing.timestamp)) {
                uniqueActionMap.set(actionData.actionId, actionData);
              }
            }
          } catch (err) {
            console.error('Failed to parse action log:', err);
          }
        });

        // Convert to array and sort by created date (newest first)
        const actionsList = Array.from(uniqueActionMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Load attachments for each action
        const actionsWithAttachments = await Promise.all(
          actionsList.map(async (action) => {
            try {
              const actionAtts = await getAttachments('Action', action.actionId);
              return { ...action, attachments: actionAtts };
            } catch (err) {
              console.error(`Failed to load attachments for action ${action.actionId}:`, err);
              return { ...action, attachments: [] };
            }
          })
        );

        setActions(actionsWithAttachments);
      } catch (err: any) {
        console.error('Failed to load actions:', err);
        setError(err?.message || 'Failed to load actions');
        toast.error('Failed to load actions');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, findingId]);

  if (!isOpen) return null;

  const getUserName = (userId: string | null): string => {
    if (!userId) return 'N/A';
    const user = userMap.get(userId);
    return user?.fullName || user?.email || userId;
  };

  const getDeptName = (deptId: number | null): string => {
    if (!deptId) return 'N/A';
    const dept = deptMap.get(deptId);
    return dept?.name || dept?.deptName || `Department ${deptId}`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownloadAttachment = (attachment: Attachment) => {
    // Use the blob path or file path from the attachment
    const filePath = attachment.filePath || attachment.blobPath;
    if (filePath) {
      // Open in new tab to trigger download
      window.open(filePath, '_blank');
    } else {
      toast.error('File path not available');
    }
  };

  const toggleActionAttachments = (actionId: string) => {
    setExpandedActionAttachments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Corrective Actions</h2>
              <p className="text-sm text-gray-500">{findingTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600"></div>
              <span className="ml-3 text-gray-600">Loading actions...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && actions.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-gray-500">No corrective actions found for this finding.</p>
            </div>
          )}

          {!loading && !error && actions.length > 0 && (
            <div className="space-y-6">
              {/* Finding Attachments Section */}
              {findingAttachments.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                  <button
                    onClick={() => setExpandedFindingAttachments(!expandedFindingAttachments)}
                    className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                  >
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Finding Attachments ({findingAttachments.length})
                    </h3>
                    <svg
                      className={`w-5 h-5 text-blue-600 transition-transform ${expandedFindingAttachments ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedFindingAttachments && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {findingAttachments.map((att) => (
                        <div
                          key={att.attachmentId}
                          className="bg-white rounded-lg p-4 border border-blue-100 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleDownloadAttachment(att)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate" title={att.fileName}>
                                {att.fileName}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatFileSize(att.fileSize)} • {att.contentType}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Uploaded by {getUserName(att.uploadedBy)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDate(att.uploadedAt)}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions List */}
              {actions.map((action) => (
                <div
                  key={action.actionId}
                  className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-shadow"
                >
                  {/* Action Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{action.title}</h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                          {action.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-xs text-gray-500">Progress</div>
                      <div className="text-2xl font-bold text-purple-600">{action.progressPercent}%</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${action.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Assignment Info */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Assignment</h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 min-w-[80px]">Assigned By:</span>
                          <span className="text-sm font-medium text-gray-900">{getUserName(action.assignedBy)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 min-w-[80px]">Assigned To:</span>
                          <span className="text-sm font-medium text-gray-900">{getUserName(action.assignedTo)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 min-w-[80px]">Department:</span>
                          <span className="text-sm font-medium text-gray-900">{getDeptName(action.assignedDeptId)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Info */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Timeline</h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 min-w-[80px]">Created:</span>
                          <span className="text-sm text-gray-900">{formatDate(action.createdAt)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 min-w-[80px]">Due Date:</span>
                          <span className="text-sm text-gray-900">{formatDate(action.dueDate)}</span>
                        </div>
                        {action.targetStartDate && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 min-w-[80px]">Start Date:</span>
                            <span className="text-sm text-gray-900">{formatDate(action.targetStartDate)}</span>
                          </div>
                        )}
                        {action.closedAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 min-w-[80px]">Closed:</span>
                            <span className="text-sm text-gray-900">{formatDate(action.closedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review & Verification Info */}
                  {(action.reviewFeedback || action.verificationComment || action.verifiedBy) && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-xs font-bold text-blue-900 mb-3 uppercase tracking-wide">Review & Verification</h4>
                      <div className="space-y-3">
                        {action.reviewFeedback && (
                          <div>
                            <span className="text-xs font-semibold text-blue-700">Review Feedback:</span>
                            <p className="text-sm text-gray-900 mt-1">{action.reviewFeedback}</p>
                          </div>
                        )}
                        {action.verificationComment && (
                          <div>
                            <span className="text-xs font-semibold text-blue-700">Verification Comment:</span>
                            <p className="text-sm text-gray-900 mt-1">{action.verificationComment}</p>
                          </div>
                        )}
                        {action.verifiedBy && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-blue-700 font-semibold min-w-[100px]">Verified By:</span>
                            <span className="text-sm font-medium text-gray-900">{getUserName(action.verifiedBy)}</span>
                            {action.verifiedAt && (
                              <span className="text-xs text-gray-500">on {formatDate(action.verifiedAt)}</span>
                            )}
                          </div>
                        )}
                        {action.acceptedAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-green-700 font-semibold">Accepted:</span>
                            <span className="text-sm text-gray-900">{formatDate(action.acceptedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Info */}
                  {(action.rejectedAt || action.rejectionReason) && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200 mt-4">
                      <h4 className="text-xs font-bold text-red-900 mb-3 uppercase tracking-wide">Rejection</h4>
                      <div className="space-y-2">
                        {action.rejectedAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-red-700 font-semibold min-w-[100px]">Rejected At:</span>
                            <span className="text-sm text-gray-900">{formatDate(action.rejectedAt)}</span>
                          </div>
                        )}
                        {action.rejectionReason && (
                          <div>
                            <span className="text-xs font-semibold text-red-700">Reason:</span>
                            <p className="text-sm text-gray-900 mt-1">{action.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {action.attachments && action.attachments.length > 0 && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <button
                        onClick={() => toggleActionAttachments(action.actionId)}
                        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                      >
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          Action Attachments ({action.attachments.length})
                        </h4>
                        <svg
                          className={`w-4 h-4 text-gray-600 transition-transform ${expandedActionAttachments.has(action.actionId) ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {expandedActionAttachments.has(action.actionId) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                          {action.attachments.map((att) => (
                            <div
                              key={att.attachmentId}
                              className="bg-white rounded-lg p-3 border border-gray-300 hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleDownloadAttachment(att)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0">
                                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate" title={att.fileName}>
                                    {att.fileName}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {formatFileSize(att.fileSize)}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {getUserName(att.uploadedBy)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Info */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <div>
                      <span className="font-semibold">Action ID:</span> {action.actionId.substring(0, 8)}...
                    </div>
                    <div>
                      <span className="font-semibold">Last Updated:</span> {formatDate(action.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Total Actions: <span className="font-bold text-gray-900">{actions.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FindingActionsModal;
