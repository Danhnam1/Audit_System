import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getSeverityColor, getStatusColor } from '../../../constants/statusColors';
import { getRootCausesByFinding } from '../../../api/rootCauses';
import { getActionsByRootCause } from '../../../api/actions';

interface FindingsTableProps {
  findings: any[];
  actionsByFindingMap: Map<string, any[]>;
  expandedFindingId: string | null;
  onToggleExpand: (findingId: string | null) => void;
  getDeptName: (deptId: string | number | null | undefined) => string;
  unwrapArray: <T,>(value: any) => T[];
  isImage: (contentType?: string, fileName?: string) => boolean;
  expandedImages: Set<string>;
  handleFileAction: (file: any) => void;
  isActionCompleted: (a: any) => boolean;
}

export const FindingsTable = ({
  findings,
  actionsByFindingMap,
  expandedFindingId,
  onToggleExpand,
  getDeptName,
  unwrapArray,
  isImage,
  expandedImages,
  handleFileAction,
  isActionCompleted,
}: FindingsTableProps) => {
  // State to store root causes for each finding
  const [rootCausesMap, setRootCausesMap] = useState<Record<string, any[]>>({});
  const [loadingRootCauses, setLoadingRootCauses] = useState<Record<string, boolean>>({});
  const [showActionAttachmentsModal, setShowActionAttachmentsModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [expandedActionImages, setExpandedActionImages] = useState<Set<string>>(new Set());

  const getActionAttachments = (action: any): any[] => {
    const raw = action?.attachments ?? action?.files ?? action?.documents ?? action?.actionAttachments;
    return unwrapArray<any>(raw);
  };

  const toggleActionImageExpand = (id: string) => {
    setExpandedActionImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Load root causes when a finding is expanded
  useEffect(() => {
    if (!expandedFindingId) return;

    const loadRootCauses = async () => {
      // Check if already loaded
      if (rootCausesMap[expandedFindingId]) return;

      setLoadingRootCauses(prev => ({ ...prev, [expandedFindingId]: true }));
      try {
        const rootCauses = await getRootCausesByFinding(expandedFindingId);
        
        // Load actions (proposed solutions) for each root cause
        const rootCausesWithActions = await Promise.all(
          rootCauses.map(async (rc: any) => {
            try {
              const actions = await getActionsByRootCause(rc.rootCauseId);
              // Filter out rejected/returned actions
              const activeActions = (actions || []).filter((a: any) => {
                const st = (a.status || '').toLowerCase();
                return st !== 'rejected' && st !== 'leadrejected' && st !== 'return';
              });
              return { ...rc, actions: activeActions };
            } catch (err) {
              console.error('Failed to load actions for root cause:', rc.rootCauseId, err);
              return { ...rc, actions: [] };
            }
          })
        );
        
        setRootCausesMap(prev => ({ ...prev, [expandedFindingId]: rootCausesWithActions || [] }));
      } catch (err) {
        console.error('Failed to load root causes:', err);
        setRootCausesMap(prev => ({ ...prev, [expandedFindingId]: [] }));
      } finally {
        setLoadingRootCauses(prev => ({ ...prev, [expandedFindingId]: false }));
      }
    };

    loadRootCauses();
  }, [expandedFindingId, rootCausesMap]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {findings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No findings found
                </td>
              </tr>
            ) : (
              findings.map((f: any) => {
                const findingId = String(f.findingId || '');
                const isExpanded = expandedFindingId === findingId;
                const relatedActions = actionsByFindingMap.get(findingId) || [];
                const attachments = unwrapArray<any>(f.attachments);
                
                return (
                  <>
                    <tr
                      key={findingId}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onToggleExpand(isExpanded ? null : findingId)}
                    >
                      <td className="px-4 py-3">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.title || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(f.severity || '')}`}>
                          {f.severity || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{getDeptName(f.deptId)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(f.status || "—")}`}>
                          {f.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {f.deadline ? new Date(f.deadline).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-4">
                          {/* Description */}
                          {f.description && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                              <p className="text-sm text-gray-600 whitespace-pre-line">{f.description}</p>
                            </div>
                          )}

                          {/* Attachments */}
                          {attachments.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Attachments ({attachments.length})</h4>
                              <div className="space-y-2">
                                {attachments.map((att: any) => {
                                  const attId = att.attachmentId || "";
                                  const isImg = isImage(att.contentType, att.fileName);
                                  const isExpandedImg = expandedImages.has(attId);
                                  const filePath = att.blobPath || att.filePath;
                                  return (
                                    <div key={attId} className="border border-gray-200 rounded-md p-2 bg-white">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFileAction(att);
                                        }}
                                        className="w-full flex items-center justify-between gap-2 text-left"
                                      >
                                        <span className="text-sm text-gray-700">{att.fileName || "Attachment"}</span>
                                        {isImg ? (
                                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpandedImg ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        )}
                                      </button>
                                      {isImg && isExpandedImg && filePath && (
                                        <div className="mt-2">
                                          <img src={filePath} alt={att.fileName} className="max-w-full h-auto rounded border" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Root Causes and Proposed Solutions */}
                          {loadingRootCauses[findingId] ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                              <span>Loading root causes...</span>
                            </div>
                          ) : (
                            (() => {
                              const rootCauses = rootCausesMap[findingId] || [];
                              if (rootCauses.length === 0) return null;

                              return (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Root Causes & Proposed Solutions</h4>
                                  <div className="space-y-4">
                                    {rootCauses.map((rc: any, idx: number) => (
                                      <div key={rc.rootCauseId || idx} className="border border-gray-200 rounded-lg p-4 bg-white">
                                        {/* Root Cause */}
                                        <div className="mb-3">
                                          <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <h5 className="text-sm font-semibold text-gray-900">
                                              Root Cause {idx + 1}: {rc.name || rc.rootCauseName || `Root Cause ${idx + 1}`}
                                            </h5>
                                          </div>
                                          {rc.description && (
                                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap ml-6">
                                              {rc.description}
                                            </p>
                                          )}
                                        </div>

                                        {/* Proposed Solutions (Actions) */}
                                        {rc.actions && rc.actions.length > 0 && (
                                          <div className="mt-3 pt-3 border-t border-gray-300">
                                            <div className="flex items-center gap-2 mb-2">
                                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                              </svg>
                                              <h6 className="text-xs font-semibold text-blue-700">
                                                Proposed Solutions ({rc.actions.length})
                                              </h6>
                                            </div>
                                            <div className="space-y-2 ml-6">
                                              {rc.actions.map((action: any, actionIdx: number) => (
                                                <div
                                                  key={action.actionId || actionIdx}
                                                  className="border border-blue-100 rounded-md p-2 bg-blue-50"
                                                >
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                      <p className="text-xs font-medium text-gray-900 mb-1">
                                                        {action.title || `Solution ${actionIdx + 1}`}
                                                      </p>
                                                      {action.description && (
                                                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                          {action.description}
                                                        </p>
                                                      )}
                                                    </div>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                                      isActionCompleted(action) ? 'bg-green-100 text-green-700' :
                                                      String(action.status || '').toLowerCase().includes('overdue') ? 'bg-red-100 text-red-700' :
                                                      'bg-amber-100 text-amber-700'
                                                    }`}>
                                                      {action.status || "—"}
                                                    </span>
                                                  </div>
                                                  {(action.dueDate || action.assignedDeptId) && (
                                                    <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-600">
                                                      {action.dueDate && (
                                                        <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                                                      )}
                                                      {action.assignedDeptId && (
                                                        <span>Dept: {getDeptName(action.assignedDeptId)}</span>
                                                      )}
                                                      
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()
                          )}

                          {/* Actions for this finding */}
                          {relatedActions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">All Actions ({relatedActions.length})</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full border border-gray-200 rounded-lg">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Title</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Department</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Attachments</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Due Date</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Progress</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {relatedActions.map((a: any) => (
                                      <tr key={a.actionId}>
                                        <td className="px-3 py-2 text-sm text-gray-900">{a.title || "—"}</td>
                                        <td className="px-3 py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            isActionCompleted(a) ? 'bg-green-100 text-green-700' :
                                            String(a.status || '').toLowerCase().includes('overdue') ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                          }`}>
                                            {a.status || "—"}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-700">{getDeptName(a.assignedDeptId)}</td>
                                        <td className="px-3 py-2 text-sm text-gray-700">
                                          {getActionAttachments(a).length > 0 ? (
                                            <button
                                              type="button"
                                              className="text-xs text-primary-600 hover:text-primary-700 underline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedAction(a);
                                                setShowActionAttachmentsModal(true);
                                              }}
                                            >
                                              View details
                                            </button>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-700">
                                          {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-700">
                                          {typeof a.progressPercent === 'number' ? `${a.progressPercent}%` : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showActionAttachmentsModal && selectedAction &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Action Attachments</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionAttachmentsModal(false);
                    setSelectedAction(null);
                    setExpandedActionImages(new Set());
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="px-5 py-4">
                {getActionAttachments(selectedAction).length === 0 ? (
                  <div className="text-sm text-gray-500">No attachments</div>
                ) : (
                  <div className="space-y-2">
                    {getActionAttachments(selectedAction).map((att: any, idx: number) => {
                      const attId = String(att.attachmentId || att.docId || att.id || idx);
                      const fileName = att.fileName || att.name || `Attachment ${idx + 1}`;
                      const filePath = att.blobPath || att.filePath || att.url || att.path;
                      const isImg = isImage(att.contentType, fileName);
                      const isExpandedImg = expandedActionImages.has(attId);

                      return (
                        <div key={attId} className="border border-gray-200 rounded-md p-2 bg-white">
                          <button
                            onClick={() => {
                              if (isImg) {
                                toggleActionImageExpand(attId);
                              } else if (filePath) {
                                window.open(filePath, '_blank');
                              }
                            }}
                            className="w-full flex items-center justify-between gap-2 text-left"
                          >
                            <span className="text-sm text-gray-700">{fileName}</span>
                            {isImg ? (
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpandedImg ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            )}
                          </button>
                          {isImg && isExpandedImg && filePath && (
                            <div className="mt-2">
                              <img src={filePath} alt={fileName} className="max-w-full h-auto rounded border" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
