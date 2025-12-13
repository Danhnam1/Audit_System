import { useState, useEffect } from 'react';
import { getFindingById, type Finding } from '../../../api/findings';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { getDepartmentById } from '../../../api/departments';

interface FindingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId: string;
}

const FindingDetailModal = ({ isOpen, onClose, findingId }: FindingDetailModalProps) => {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [witnessName, setWitnessName] = useState<string>('');
  const [departmentName, setDepartmentName] = useState<string>('');

  useEffect(() => {
    if (isOpen && findingId) {
      loadFinding();
      loadAttachments();
    }
  }, [isOpen, findingId]);

  const loadFinding = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingById(findingId);
      setFinding(data);
      
      // Fetch witness name if witnessId exists
      if (data?.witnessId) {
        try {
          const witnessUser = await getUserById(data.witnessId);
          setWitnessName(witnessUser?.fullName || '');
        } catch (err) {
          console.error('Error loading witness:', err);
          setWitnessName('');
        }
      }
      
      // Fetch department name if deptId exists
      if (data?.deptId) {
        try {
          const dept = await getDepartmentById(data.deptId);
          setDepartmentName(dept?.name || '');
        } catch (err) {
          console.error('Error loading department:', err);
          setDepartmentName('');
        }
      }
    } catch (err: any) {
      console.error('Error loading finding:', err);
      setError(err?.message || 'Failed to load finding details');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('finding', findingId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      // Don't show error for attachments, just log it
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Format as "MMM dd, yyyy" (e.g., "Nov 21, 2025")
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  };

  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower.includes('high')) return 'bg-red-100 text-red-800';
    if (severityLower.includes('medium')) return 'bg-yellow-100 text-yellow-800';
    if (severityLower.includes('low')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 sm:px-8 py-6 shadow-lg z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Finding Details</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg font-medium">Loading finding details...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {finding && !loading && (
              <div className="space-y-6">
                {/* Title - Highlighted with gradient */}
                <div className="bg-gradient-to-r from-primary-50 to-blue-50 border-l-4 border-primary-600 p-6 rounded-r-xl shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                      <p className="text-xl font-bold text-gray-900 leading-relaxed">{finding.title}</p>
                    </div>
                  </div>
                </div>

                {/* Description - Enhanced card */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide pt-2">Description</label>
                  </div>
                  <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[80px] pl-[52px]">
                    {finding.description || 'No description provided'}
                  </p>
                </div>

                {/* Info Grid - 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Severity */}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Severity</label>
                    </div>
                    <span className={`inline-block px-5 py-2.5 rounded-xl text-base font-bold shadow-sm ${getSeverityColor(finding.severity)}`}>
                      {finding.severity || 'N/A'}
                    </span>
                  </div>

                  {/* Department */}
                  {finding.deptId && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
                      </div>
                      <p className="text-base font-semibold text-gray-900 pl-[52px]">{departmentName || 'Loading...'}</p>
                    </div>
                  )}

                  {/* Witness */}
                  {finding.witnessId && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Witness</label>
                      </div>
                      <p className="text-base font-semibold text-gray-900 pl-[52px]">{witnessName || 'Loading...'}</p>
                    </div>
                  )}

                  {/* Dates */}
                  {finding.deadline && (
                    <div className="bg-gradient-to-br from-red-50 to-red-100/50 border-2 border-red-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-red-700 uppercase tracking-wide">Deadline</label>
                      </div>
                      <p className="text-lg font-bold text-red-900 pl-[52px]">{formatDate(finding.deadline)}</p>
                    </div>
                  )}
                  {finding.createdAt && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-green-700 uppercase tracking-wide">Created At</label>
                      </div>
                      <p className="text-lg font-bold text-green-900 pl-[52px]">{formatDate(finding.createdAt)}</p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Attachments</label>
                  </div>
                  {loadingAttachments ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-3"></div>
                        <span className="text-base text-gray-600 font-medium">Loading attachments...</span>
                      </div>
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <p className="text-base text-gray-500 font-medium">No attachments found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {attachments.map((attachment) => {
                        const isImage = attachment.contentType?.startsWith('image/');
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className={`bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all ${
                              isImage ? '' : 'p-4'
                            }`}
                          >
                            {isImage ? (
                              /* Image Preview */
                              <div>
                                <div className="p-4 border-b-2 border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                        <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                      </div>
                                    </div>
                                    {attachment.filePath && (
                                      <a
                                        href={attachment.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 ml-3 p-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                                        title="Open image in new tab"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {attachment.filePath && (
                                  <div className="p-4 bg-gray-50">
                                    <a
                                      href={attachment.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img
                                        src={attachment.filePath}
                                        alt={attachment.fileName}
                                        className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                                        onError={(e) => {
                                          // Fallback if the image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = `
                                              <div class="p-8 text-center text-gray-500">
                                                <svg class="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <p class="text-base font-medium">Image failed to load</p>
                                              </div>
                                            `;
                                          }
                                        }}
                                      />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Non-image File */
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* File Icon */}
                                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                    <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                  </div>
                                </div>
                                {/* Download Button */}
                                {attachment.filePath && (
                                  <a
                                    href={attachment.filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-3 px-4 py-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium border border-primary-200 flex items-center gap-2"
                                    title="Open file"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open
                                  </a>
                                )}
                              </div>
                            )}
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
          <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 px-6 sm:px-8 py-5 flex justify-end shadow-lg">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-200 text-base font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindingDetailModal;

