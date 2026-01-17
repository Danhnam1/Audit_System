import { createPortal } from 'react-dom';
import { getSeverityColor } from '../../constants/statusColors';

interface FindingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: any; // Finding object
  onReturn?: (findingId: string) => void; // Optional return action (for Lead Auditor)
  showReturnAction?: boolean; // Whether to show return button in footer
}

const unwrapValues = (v: any): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (v.$values && Array.isArray(v.$values)) return v.$values;
  return [];
};

const FindingDetailModal = ({ 
  isOpen, 
  onClose, 
  finding, 
  onReturn,
  showReturnAction = false 
}: FindingDetailModalProps) => {
  if (!isOpen || !finding) return null;

  const isReturned = finding && String(finding?.status || '').toLowerCase() === 'return';
  // Filter out inactive attachments
  const allAttachments = unwrapValues(finding?.attachments);
  const attachments = allAttachments.filter((att: any) => (att.status || '').toLowerCase() !== 'inactive');

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Finding Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">View complete finding information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all p-2 rounded-lg"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Title */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                </div>
                <div className="text-sm font-semibold text-gray-900 leading-relaxed">{finding?.title || '—'}</div>
              </div>

              {/* Description */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Description</label>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{finding?.description || '—'}</div>
              </div>

              {/* Severity & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Severity</label>
                  </div>
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold border ${getSeverityColor(finding?.severity || '')}`}>
                    {finding?.severity || '—'}
                  </span>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Status</label>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{finding?.status || '—'}</div>
                </div>
              </div>

              {/* Audit Item */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Audit Item</label>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed">{finding?.auditItem?.questionTextSnapshot || finding?.auditItem?.section || '—'}</div>
              </div>

              {/* Created By, Created, Deadline */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Created By</label>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{finding?.createdByUser?.fullName || finding?.createdByUser?.email || '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Created</label>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {finding?.createdAt ? new Date(finding.createdAt).toLocaleDateString('en-GB') : '—'}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Deadline</label>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {finding?.deadline ? new Date(finding.deadline).toLocaleDateString('en-GB') : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Attachments */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <label className="text-sm font-bold text-gray-900">Attachments</label>
                <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {attachments.length}
                </span>
              </div>
              <div className="space-y-3">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">No attachments</p>
                  </div>
                ) : (
                  attachments.map((att: any, idx: number) => {
                    const name = att?.fileName || att?.documentName || att?.name || att?.originalName || `Attachment ${idx+1}`;
                    const url = att?.blobPath || att?.url || att?.link || att?.path;
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 transition-colors">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                          {url && (
                            <div className="text-xs text-gray-500 mt-0.5">Click to open</div>
                          )}
                        </div>
                        {url ? (
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex-shrink-0 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open
                          </a>
                        ) : (
                          <span className="flex-shrink-0 px-3 py-2 text-xs text-gray-500 bg-gray-200 rounded-lg">No link</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          {showReturnAction && onReturn && (
            <>
              {isReturned ? (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-orange-100 text-orange-700 font-medium rounded-lg border border-orange-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Returned
                </div>
              ) : (
                <button
                  onClick={() => onReturn(finding?.findingId || '')}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Return
                </button>
              )}
            </>
          )}
          {!showReturnAction && <div />}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FindingDetailModal;
