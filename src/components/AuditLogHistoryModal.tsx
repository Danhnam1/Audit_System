import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdminAuditLog, type AdminAuditLogEntry } from '../api/adminAuditLog';
import { toast } from 'react-toastify';

interface AuditLogHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'Finding' | 'ChecklistItem' | 'ChecklistItemNoFinding';
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

  useEffect(() => {
    if (!isOpen || !entityId) {
      setLogs([]);
      setError(null);
      return;
    }

    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminAuditLog({
          entityType,
          entityId,
        });
        setLogs(result);
      } catch (err: any) {
        console.error('Failed to load audit log:', err);
        setError(err?.message || 'Failed to load history');
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
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
                {entityType} - {entityId}
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
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span className="flex-1">{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Performer ID */}
                        <p className="text-xs text-gray-400 mt-2">
                          Performed by: {log.performedBy}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
