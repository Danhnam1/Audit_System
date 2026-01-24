import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdminAuditLog, type AdminAuditLogEntry } from '../api/adminAuditLog';
import { getAdminUsers } from '../api/adminUsers';
import { toast } from 'react-toastify';
import { UserTag } from './UserTag';

interface AuditLogHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'Finding' | 'ChecklistItem' | 'AuditChecklistItem' | 'ChecklistItemNoFinding';
  entityId: string;
  title?: string;
}

export const AuditLogHistoryModal: React.FC<AuditLogHistoryModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  title = 'History',
}) => {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!isOpen || !entityId) {
      setLogs([]);
      setError(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load users first
        const users = await getAdminUsers();
        const usersById = new Map();
        users.forEach((u: any) => {
          usersById.set(u.userId, u);
        });
        setUserMap(usersById);

        // Then load logs
        let result = await getAdminAuditLog({
          entityType,
          entityId,
        });

        const isChecklistEntity =
          entityType === 'ChecklistItemNoFinding' || entityType === 'AuditChecklistItem';

        // Fallbacks for checklist entities when entityId is not stored in logs
        if (isChecklistEntity && result.length === 0) {
          if (entityType === 'AuditChecklistItem') {
            const alt = await getAdminAuditLog({
              entityType: 'ChecklistItem',
              entityId,
            });
            if (alt.length > 0) {
              result = alt;
            }
          }

          if (result.length === 0) {
            const [primaryLogs, altLogs] = await Promise.all([
              getAdminAuditLog({ entityType }),
              entityType === 'AuditChecklistItem'
                ? getAdminAuditLog({ entityType: 'ChecklistItem' })
                : Promise.resolve([] as AdminAuditLogEntry[]),
            ]);
            const merged = [...primaryLogs, ...altLogs];
            const filtered = merged.filter((log) => matchesEntityId(log, entityId));
            result = filtered;
          }
        }

        setLogs(result);
      } catch (err: any) {
        console.error('Failed to load audit log:', err);
        setError(err?.message || 'Failed to load history');
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, entityId, entityType]);

  if (!isOpen) return null;

  // Helper function to parse JSON string safely
  const parseValue = (value: string | null): any => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const normalizeId = (value: any): string => String(value ?? '').toLowerCase().trim();

  const matchesEntityId = (log: AdminAuditLogEntry, targetId: string): boolean => {
    const target = normalizeId(targetId);
    if (!target) return false;
    if (normalizeId(log.entityId) === target) return true;

    const oldObj = parseValue(log.oldValue);
    const newObj = parseValue(log.newValue);

    const candidates = [
      oldObj?.AuditChecklistItemId,
      oldObj?.auditChecklistItemId,
      oldObj?.ChecklistItemId,
      oldObj?.checklistItemId,
      newObj?.AuditChecklistItemId,
      newObj?.auditChecklistItemId,
      newObj?.ChecklistItemId,
      newObj?.checklistItemId,
    ];

    return candidates.some((c) => normalizeId(c) === target);
  };

  // Helper function to format field differences
  const getChanges = (oldValue: string | null, newValue: string | null): string[] => {
    const oldObj = parseValue(oldValue);
    const newObj = parseValue(newValue);

    if (!oldObj && !newObj) return [];
    if (!oldObj) return ['Created'];
    if (!newObj) return ['Deleted'];

    const changes: string[] = [];
    const ignoredKeys = new Set(['rowversion', 'row_version']);
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    allKeys.forEach((key) => {
      if (ignoredKeys.has(String(key).toLowerCase())) return;
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      // Skip complex objects and arrays for simple display
      if (typeof oldVal === 'object' || typeof newVal === 'object') return;

      if (oldVal !== newVal) {
        changes.push(`${key}: ${oldVal ?? 'N/A'} → ${newVal ?? 'N/A'}`);
      }
    });

    return changes;
  };

  // Helper function to extract user IDs from audit log entries
  const extractUserInfo = (logs: AdminAuditLogEntry[]) => {
    const info = {
      createdBy: null as string | null,
      rootCauseProposers: new Set<string>(),
      solutionProposers: new Set<string>(),
      actionPerformers: new Set<string>(),
      attachmentUploaders: new Set<string>(),
    };

    logs.forEach((log) => {
      const newObj = parseValue(log.newValue);

      // Extract creator from Finding creation
      if (log.action === 'Create' && log.entityType === 'Finding') {
        info.createdBy = log.performedBy || newObj?.createdBy || newObj?.CreatedBy;
      }

      // Extract root cause proposers
      if (log.entityType === 'RootCause' && (log.action === 'Create' || log.action === 'Update')) {
        if (log.performedBy) info.rootCauseProposers.add(log.performedBy);
        if (newObj?.createdBy) info.rootCauseProposers.add(newObj.createdBy);
        if (newObj?.CreatedBy) info.rootCauseProposers.add(newObj.CreatedBy);
      }

      // Extract solution proposers (from remediation proposals or actions)
      if (log.entityType === 'RemediationProposal' && (log.action === 'Create' || log.action === 'Update')) {
        if (log.performedBy) info.solutionProposers.add(log.performedBy);
        if (newObj?.createdBy) info.solutionProposers.add(newObj.createdBy);
        if (newObj?.CreatedBy) info.solutionProposers.add(newObj.CreatedBy);
      }

      // Extract action performers
      if (log.entityType === 'Action' && (log.action === 'Create' || log.action === 'Update')) {
        if (log.performedBy) info.actionPerformers.add(log.performedBy);
        if (newObj?.assignedTo) info.actionPerformers.add(newObj.assignedTo);
        if (newObj?.AssignedTo) info.actionPerformers.add(newObj.AssignedTo);
        if (newObj?.assignedBy) info.actionPerformers.add(newObj.assignedBy);
        if (newObj?.AssignedBy) info.actionPerformers.add(newObj.AssignedBy);
      }

      // Extract attachment uploaders
      if (log.entityType === 'Attachment' && log.action === 'Create') {
        if (log.performedBy) info.attachmentUploaders.add(log.performedBy);
        if (newObj?.uploadedBy) info.attachmentUploaders.add(newObj.uploadedBy);
        if (newObj?.UploadedBy) info.attachmentUploaders.add(newObj.UploadedBy);
      }
    });

    return info;
  };

  const userInfo = extractUserInfo(logs);

  const getEntityLabel = (type: AuditLogHistoryModalProps['entityType']): string => {
    if (type === 'AuditChecklistItem' || type === 'ChecklistItem') return 'Checklist Item';
    if (type === 'ChecklistItemNoFinding') return 'No Finding';
    return type;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">
                {getEntityLabel(entityType)} - {entityId}
              </p>
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
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-200 border-t-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading history...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500">No history available for this item.</p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <div className="space-y-6">
              {/* User Summary Section */}
              {entityType === 'Finding' && (userInfo.createdBy ||
                userInfo.rootCauseProposers.size > 0 ||
                userInfo.solutionProposers.size > 0 ||
                userInfo.actionPerformers.size > 0 ||
                userInfo.attachmentUploaders.size > 0) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Contributors Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userInfo.createdBy && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Created By</p>
                          <UserTag userId={userInfo.createdBy} userMap={userMap} size="medium" />
                        </div>
                      )}

                      {userInfo.rootCauseProposers.size > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Root Cause Proposed By</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(userInfo.rootCauseProposers).map((userId) => (
                              <UserTag key={userId} userId={userId} userMap={userMap} size="small" />
                            ))}
                          </div>
                        </div>
                      )}

                      {userInfo.solutionProposers.size > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Solution Proposed By</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(userInfo.solutionProposers).map((userId) => (
                              <UserTag key={userId} userId={userId} userMap={userMap} size="small" />
                            ))}
                          </div>
                        </div>
                      )}

                      {userInfo.actionPerformers.size > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Remediation By</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(userInfo.actionPerformers).map((userId) => (
                              <UserTag key={userId} userId={userId} userMap={userMap} size="small" />
                            ))}
                          </div>
                        </div>
                      )}

                      {userInfo.attachmentUploaders.size > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Attachments Uploaded By</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(userInfo.attachmentUploaders).map((userId) => (
                              <UserTag key={userId} userId={userId} userMap={userMap} size="small" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Timeline Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Activity Timeline</h3>
                <div className="space-y-4">
                  {logs.map((log, index) => {
                    const changes = getChanges(log.oldValue, log.newValue);
                    const performedDate = new Date(log.performedAt);

                    return (
                      <div
                        key={log.logId || index}
                        className="relative border border-gray-200 rounded-lg p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-shadow"
                      >
                        {/* Timeline connector */}
                        {index < logs.length - 1 && (
                          <div className="absolute left-9 top-[70px] bottom-[-16px] w-0.5 bg-gray-300"></div>
                        )}

                        <div className="flex gap-4">
                          {/* Action icon */}
                          <div className="flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${log.action === 'Create'
                                  ? 'bg-green-100 text-green-600'
                                  : log.action === 'Update'
                                    ? 'bg-blue-100 text-blue-600'
                                    : log.action === 'Delete'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                              {log.action === 'Create' && (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                              {log.action === 'Update' && (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              )}
                              {log.action === 'Delete' && (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Action details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="text-base font-bold text-gray-900">{log.action}</h4>
                                <p className="text-sm text-gray-600">
                                  by <span className="font-medium">{log.role}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  {performedDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {performedDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Changes */}
                            {changes.length > 0 && (
                              <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                  Changes:
                                </p>
                                <ul className="space-y-1">
                                  {changes.map((change, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                      <span className="text-blue-500 mt-1">•</span>
                                      <span className="flex-1">{change}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Performer Info */}
                            <p className="text-xs text-gray-400 mt-2">
                              Performed by: {(() => {
                                const user = userMap.get(log.performedBy);
                                return user?.fullName || user?.email || log.performedBy;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
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

export default AuditLogHistoryModal;
