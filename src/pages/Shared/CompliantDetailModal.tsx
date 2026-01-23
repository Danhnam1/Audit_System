import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { getChecklistItemCompliantDetails, getChecklistItemNoFindingByAuditChecklistItemId } from '../../api/checklists';
import { getUserById } from '../../api/adminUsers';
import { getAttachments, type Attachment } from '../../api/attachments';

interface CompliantDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  compliantId: string | number | null;
  auditChecklistItemId?: string | null;
}

const CompliantDetailModal = ({ 
  isOpen, 
  onClose, 
  compliantId,
  auditChecklistItemId = null,
}: CompliantDetailModalProps) => {
  const [compliantData, setCompliantData] = useState<any>(null);
  const [witnessName, setWitnessName] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && (compliantId || auditChecklistItemId)) {
      fetchCompliantDetails();
    } else {
      // Reset state when modal closes
      setCompliantData(null);
      setWitnessName('');
      setAttachments([]);
      setError(null);
    }
  }, [isOpen, compliantId, auditChecklistItemId]);

  const fetchCompliantDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!compliantId && !auditChecklistItemId) {
        setError('Compliant ID is required');
        return;
      }

      const data = auditChecklistItemId
        ? await getChecklistItemNoFindingByAuditChecklistItemId(auditChecklistItemId)
        : await getChecklistItemCompliantDetails(compliantId as string | number);

      if (!data) {
        setError('No compliant details found for this item');
        return;
      }
      setCompliantData(data);

      // Fetch witness name if witnessId exists
      if (data?.witnessId) {
        try {
          const witnessUser = await getUserById(data.witnessId);
          setWitnessName(witnessUser?.fullName || '');
        } catch (err) {
          console.error('Failed to fetch witness name:', err);
          setWitnessName('Unknown');
        }
      }

      // Fetch attachments for this audit checklist item
      if (data?.auditChecklistItemId) {
        try {
          const attachmentsData = await getAttachments('compliant', data.auditChecklistItemId);
          setAttachments(attachmentsData);
        } catch (err) {
          console.error('Failed to fetch attachments:', err);
          setAttachments([]);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load compliant details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter out inactive attachments
  const activeAttachments = attachments.filter((att: any) => (att.status || '').toLowerCase() !== 'inactive');

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 animate-fadeIn">
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Compliant Item Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">View complete compliant information</p>
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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading compliant details...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : compliantData ? (
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
                  <div className="text-sm font-semibold text-gray-900 leading-relaxed">{compliantData?.title || '—'}</div>
                </div>

                {/* Reason Why It Meets Standards */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Reason Why It Meets Standards</label>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{compliantData?.reason || '—'}</div>
                </div>

                {/* Date & Time of Compliance */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Date of Compliance</label>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {compliantData?.dateOfCompliance ? new Date(compliantData.dateOfCompliance).toLocaleDateString('en-GB') : '—'}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Time of Compliance</label>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {compliantData?.timeOfCompliance ? compliantData.timeOfCompliance.substring(0, 5) : '—'}
                    </div>
                  </div>
                </div>

                {/* Department */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{compliantData?.department || '—'}</div>
                </div>

                {/* Witness */}
                {witnessName && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Witness</label>
                    </div>
                    <div className="text-sm font-medium text-gray-800">{witnessName}</div>
                  </div>
                )}
              </div>

              {/* Right Column - Attachments */}
              <div className="space-y-5">
                {/* Attachments Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <label className="text-sm font-bold text-gray-900">Attachments</label>
                    <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {activeAttachments.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {activeAttachments.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-500 font-medium">No attachments</p>
                      </div>
                    ) : (
                      activeAttachments.map((att: Attachment, idx: number) => {
                        const name = att?.fileName || `Attachment ${idx+1}`;
                        const url = att?.filePath || att?.blobPath;
                        const isImage = att?.contentType?.startsWith('image/');
                        
                        return (
                          <div key={att.attachmentId || idx} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            {/* Image preview if it's an image */}
                            {isImage && url && (
                              <div className="relative bg-gray-100">
                                <img
                                  src={url}
                                  alt={name}
                                  className="w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    console.error('Image load error:', url);
                                    e.currentTarget.parentElement!.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* File info */}
                            <div className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                                {isImage ? (
                                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
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

export default CompliantDetailModal;
