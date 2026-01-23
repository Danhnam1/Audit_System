import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdminAuditLog, type AdminAuditLogEntry } from '../api/adminAuditLog';
import { getReportRequestById, type ViewReportRequest } from '../api/reportRequest';
import { getAdminUsers } from '../api/adminUsers';
import { toast } from 'react-toastify';
import { getStatusColor } from '../constants/statusColors';

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

        // Load report request details
        const report = await getReportRequestById(reportRequestId);
        if (!report) {
          throw new Error('Report request not found');
        }
        setReportRequest(report);

        // Load audit logs for this report request
        const result = await getAdminAuditLog({
          entityType: 'ReportRequest',
          entityId: reportRequestId,
        });
        setLogs(result);
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

  const formatDate = (dateStr: string | null | undefined): string => {
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

  const handleDownloadReport = () => {
    if (reportRequest?.filePath) {
      window.open(reportRequest.filePath, '_blank');
    } else {
      toast.error('Report file not available');
    }
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
              {/* Report Information Section */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Report Information
                  </h3>
                  {reportRequest.filePath && (
                    <button
                      onClick={handleDownloadReport}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Report
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Report ID */}
                  <div className="bg-white rounded-lg p-4 border border-green-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Report ID</p>
                    <p className="text-sm text-gray-900 font-mono">{reportRequest.reportRequestId}</p>
                  </div>

                  {/* Status */}
                  <div className="bg-white rounded-lg p-4 border border-green-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Status</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reportRequest.status)}`}>
                      {reportRequest.status}
                    </span>
                  </div>

                  {/* Requested By */}
                  <div className="bg-white rounded-lg p-4 border border-green-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Requested By</p>
                    <p className="text-sm text-gray-900">{getUserName(reportRequest.requestedBy)}</p>
                  </div>

                  {/* Requested At */}
                  <div className="bg-white rounded-lg p-4 border border-green-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Requested Date</p>
                    <p className="text-sm text-gray-900">{formatDate(reportRequest.requestedAt)}</p>
                  </div>

                  {/* Title */}
                  {reportRequest.title && (
                    <div className="bg-white rounded-lg p-4 border border-green-100 md:col-span-2">
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Title</p>
                      <p className="text-sm text-gray-900">{reportRequest.title}</p>
                    </div>
                  )}

                  {/* Completed At */}
                  {reportRequest.completedAt && (
                    <div className="bg-white rounded-lg p-4 border border-green-100">
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Completed Date</p>
                      <p className="text-sm text-gray-900">{formatDate(reportRequest.completedAt)}</p>
                    </div>
                  )}

                  {/* File Path */}
                  {reportRequest.filePath && (
                    <div className="bg-white rounded-lg p-4 border border-green-100">
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">File Available</p>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-green-700">Yes</span>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {reportRequest.note && (
                    <div className="bg-white rounded-lg p-4 border border-green-100 md:col-span-2">
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Note</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{reportRequest.note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Timeline Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Activity Timeline</h3>
                {logs.length === 0 ? (
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
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  log.action === 'Create'
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
                                        <span className="text-green-500 mt-1">•</span>
                                        <span className="flex-1">{change}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Performer Info */}
                              <p className="text-xs text-gray-400 mt-2">
                                Performed by: {getUserName(log.performedBy)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
