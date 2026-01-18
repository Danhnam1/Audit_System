import { getSeverityColor } from '../../../constants/statusColors';

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
  return (
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
                    <td className="px-4 py-3 text-sm text-gray-700">{f.status || "—"}</td>
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

                          {/* Actions for this finding */}
                          {relatedActions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Actions ({relatedActions.length})</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full border border-gray-200 rounded-lg">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Title</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Department</th>
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
  );
};
