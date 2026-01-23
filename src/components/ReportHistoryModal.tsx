import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdminAuditLog, type AdminAuditLogEntry } from '../api/adminAuditLog';
import { getReportRequestById, type ViewReportRequest } from '../api/reportRequest';
import { getAdminUsers } from '../api/adminUsers';
import { toast } from 'react-toastify';

interface ReportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportRequestId: string;
  auditTitle?: string;
}

export const ReportHistoryModal: React.FC<ReportHistoryModalProps> = ({
  isOpen,
  onClose,
  reportRequestId,
  auditTitle = 'Report History',
}) => {
  const [reportRequest, setReportRequest] = useState<ViewReportRequest | null>(null);
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map());
  const [showFindingsHistory, setShowFindingsHistory] = useState(true);
  const [showFinalHistory, setShowFinalHistory] = useState(false);

  useEffect(() => {
    if (!isOpen || !reportRequestId) {
      setReportRequest(null);
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

        // Load report request details (may fail for ReportRequestFinal)
        let report: ViewReportRequest | null = null;
        try {
          report = await getReportRequestById(reportRequestId);
          setReportRequest(report || null);
        } catch {
          setReportRequest(null);
        }

        // Load audit logs for both entity types (by entityId first)
        const [byEntityLogsRes, byEntityFinalLogsRes] = await Promise.allSettled([
          getAdminAuditLog({
            entityType: 'ReportRequest',
            entityId: reportRequestId,
          }),
          getAdminAuditLog({
            entityType: 'ReportRequestFinal',
            entityId: reportRequestId,
          }),
        ]);

        const byEntityLogs = byEntityLogsRes.status === 'fulfilled' ? byEntityLogsRes.value : [];
        const byEntityFinalLogs = byEntityFinalLogsRes.status === 'fulfilled' ? byEntityFinalLogsRes.value : [];

        let combinedLogs: AdminAuditLogEntry[] = [...byEntityLogs, ...byEntityFinalLogs];

        // Try to resolve auditId (from report or logs)
        let auditId: string | null = report?.auditId ? String(report.auditId) : null;
        if (!auditId && combinedLogs.length > 0) {
          const newest = combinedLogs.reduce((acc, cur) => {
            if (!acc) return cur;
            return new Date(cur.performedAt || 0) > new Date(acc.performedAt || 0) ? cur : acc;
          }, combinedLogs[0]);
          const parsed = parseValue(newest.newValue) || {};
          auditId = parsed.AuditId || parsed.auditId || null;
        }

        // If we have auditId, load logs by auditId to include both entity types
        if (auditId) {
          const [auditLogsRes, auditFinalLogsRes] = await Promise.allSettled([
            getAdminAuditLog({
              entityType: 'ReportRequest',
              auditId: String(auditId),
            }),
            getAdminAuditLog({
              entityType: 'ReportRequestFinal',
              auditId: String(auditId),
            }),
          ]);
          const auditLogs = auditLogsRes.status === 'fulfilled' ? auditLogsRes.value : [];
          const auditFinalLogs = auditFinalLogsRes.status === 'fulfilled' ? auditFinalLogsRes.value : [];
          const merged = [...combinedLogs, ...auditLogs, ...auditFinalLogs];
          const uniq = new Map<string, AdminAuditLogEntry>();
          merged.forEach((log) => {
            const key = log.logId || `${log.entityType}-${log.entityId}-${log.performedAt}`;
            if (!uniq.has(key)) {
              uniq.set(key, log);
            }
          });
          combinedLogs = Array.from(uniq.values());
        }

        combinedLogs.sort((a, b) => {
          const timeA = new Date(a.performedAt || 0).getTime();
          const timeB = new Date(b.performedAt || 0).getTime();
          return timeB - timeA;
        });
        setLogs(combinedLogs);

        // Build report items from logs (both ReportRequest + ReportRequestFinal)
        const reportMap = new Map<string, { report: ViewReportRequest; entityType: string; timestamp: string }>();
        combinedLogs.forEach((log) => {
          const parsed = parseValue(log.newValue) || {};
          const id = parsed.ReportRequestId || parsed.reportRequestId || log.entityId || '';
          if (!id) return;
          const reportData: ViewReportRequest = {
            reportRequestId: id,
            auditId: parsed.AuditId || parsed.auditId || auditId || '',
            title: parsed.Title || parsed.title || '',
            status: parsed.Status || parsed.status || 'Pending',
            filePath: parsed.FilePath || parsed.filePath || null,
            requestedAt: parsed.RequestedAt || parsed.requestedAt || null,
            completedAt: parsed.CompletedAt || parsed.completedAt || null,
            note: parsed.Note || parsed.note || null,
            requestedBy: parsed.RequestedBy || parsed.requestedBy || null,
          } as ViewReportRequest;

          const existing = reportMap.get(id);
          if (!existing || new Date(log.performedAt || 0) > new Date(existing.timestamp || 0)) {
            reportMap.set(id, { report: reportData, entityType: log.entityType || '', timestamp: log.performedAt || '' });
          }
        });

        // Ensure API report is included
        if (report?.reportRequestId) {
          const id = String(report.reportRequestId);
          if (!reportMap.has(id)) {
            reportMap.set(id, { report, entityType: 'ReportRequest', timestamp: report.requestedAt || '' });
          }
        }

        const items = Array.from(reportMap.values()).sort((a, b) => {
          const timeA = new Date(a.timestamp || a.report.requestedAt || 0).getTime();
          const timeB = new Date(b.timestamp || b.report.requestedAt || 0).getTime();
          return timeB - timeA;
        });

        // If report request not found via API, derive info from audit logs
        if (!report && items.length > 0) {
          setReportRequest(items[0].report);
        }
      } catch (err: any) {
        console.error('Failed to load report history:', err);
        setError(err?.message || 'Failed to load report history');
        toast.error('Failed to load report history');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, reportRequestId]);

  if (!isOpen) return null;

  const getUserName = (userId: string | null | undefined): string => {
    if (!userId) return 'N/A';
    const user = userMap.get(userId);
    return user?.fullName || user?.email || userId;
  };

  // Helper function to parse JSON string safely
  const parseValue = (value: string | null): any => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  // Helper function to format field differences
  const getChanges = (oldValue: string | null, newValue: string | null): string[] => {
    const oldObj = parseValue(oldValue);
    const newObj = parseValue(newValue);

    if (!oldObj && !newObj) return [];
    if (!oldObj) return ['Created'];
    if (!newObj) return ['Deleted'];

    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    allKeys.forEach((key) => {
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

  const getStatusFromValue = (value: string | null): string | null => {
    const parsed = parseValue(value);
    const status = parsed?.Status || parsed?.status || null;
    return status ? String(status) : null;
  };

  const getActionLabel = (log: AdminAuditLogEntry): string => {
    const newStatus = getStatusFromValue(log.newValue);
    const oldStatus = getStatusFromValue(log.oldValue);
    if (newStatus && newStatus !== oldStatus) {
      const norm = String(newStatus).toLowerCase();
      if (norm.includes('approve')) return 'Approved';
      if (norm.includes('return') || norm.includes('reject')) return 'Returned';
      if (norm.includes('submit')) return 'Submitted';
      if (norm.includes('pending')) return 'Submitted';
    }
    if (log.action === 'Create') return 'Submitted';
    return log.action || 'Updated';
  };

  const getActionByLabel = (actionLabel: string): string => {
    const norm = actionLabel.toLowerCase();
    if (norm.includes('approve')) return 'Approved by';
    if (norm.includes('return') || norm.includes('reject')) return 'Returned by';
    if (norm.includes('submit')) return 'Submitted by';
    return 'Performed by';
  };

  const renderTimeline = (title: string, timelineLogs: AdminAuditLogEntry[]) => (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
      {timelineLogs.length === 0 ? (
        <div className="text-center py-8">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500">No activity history available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timelineLogs.map((log, index) => {
            const changes = getChanges(log.oldValue, log.newValue);
            const performedDate = new Date(log.performedAt);
            const actionLabel = getActionLabel(log);
            const byLabel = getActionByLabel(actionLabel);

            return (
              <div
                key={log.logId || index}
                className="relative border border-gray-200 rounded-lg p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-shadow"
              >
                {index < timelineLogs.length - 1 && (
                  <div className="absolute left-9 top-[70px] bottom-[-16px] w-0.5 bg-gray-300"></div>
                )}

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        actionLabel === 'Submitted'
                          ? 'bg-blue-100 text-blue-600'
                          : actionLabel === 'Approved'
                          ? 'bg-green-100 text-green-600'
                          : actionLabel === 'Returned'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {actionLabel === 'Approved' && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {actionLabel === 'Returned' && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {actionLabel === 'Submitted' && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {actionLabel !== 'Submitted' && actionLabel !== 'Approved' && actionLabel !== 'Returned' && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{actionLabel}</h4>
                        <p className="text-sm text-gray-600">
                          {byLabel} <span className="font-medium">{getUserName(log.performedBy)}</span>
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

                    {changes.length > 0 && (
                      <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                          Changes:
                        </p>
                        <ul className="space-y-1">
                          {changes.map((change, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-green-500 mt-1">•</span>
                              <span className="flex-1">{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      Role: {log.role}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
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
            <div>
              <h2 className="text-xl font-bold text-gray-900">Report History</h2>
              <p className="text-sm text-gray-500">{auditTitle}</p>
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
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-200 border-t-green-600"></div>
              <span className="ml-3 text-gray-600">Loading report details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && reportRequest && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Report Findings</h3>
                      
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFindingsHistory((v) => !v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      {showFindingsHistory ? 'Hide history' : 'View history'}
                    </button>
                  </div>
                  {showFindingsHistory && (
                    <div className="mt-4">
                      {renderTimeline(
                        '',
                        logs.filter((log) => String(log.entityType || '').toLowerCase() === 'reportrequest')
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Report Final</h3>
                      
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFinalHistory((v) => !v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      {showFinalHistory ? 'Hide history' : 'View history'}
                    </button>
                  </div>
                  {showFinalHistory && (
                    <div className="mt-4">
                      {renderTimeline(
                        '',
                        logs.filter((log) => String(log.entityType || '').toLowerCase() === 'reportrequestfinal')
                      )}
                    </div>
                  )}
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

export default ReportHistoryModal;
