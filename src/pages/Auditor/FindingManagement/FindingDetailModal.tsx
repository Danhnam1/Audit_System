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
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Finding Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-3 text-gray-600">Loading finding details...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {finding && !loading && (
              <div className="space-y-5">
                {/* Title - Highlighted */}
                <div className="bg-primary-50 border-l-4 border-primary-500 p-4 rounded-r-lg">
                  <label className="block text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                  <p className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed">{finding.title}</p>
                </div>

                {/* Description - Card style */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Description</label>
                  <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                    {finding.description || 'No description provided'}
                  </p>
                </div>

                {/* Severity */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Severity</label>
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold ${getSeverityColor(finding.severity)}`}>
                    {finding.severity || 'N/A'}
                  </span>
                </div>

                {/* Department */}
                {finding.deptId && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Department</label>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-sm sm:text-base font-medium text-gray-900">{departmentName || 'Loading...'}</p>
                    </div>
                  </div>
                )}

                {/* Witness */}
                {finding.witnessId && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Witness</label>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-sm sm:text-base font-medium text-gray-900">{witnessName || 'Loading...'}</p>
                    </div>
                  </div>
                )}

                {/* Dates - Side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {finding.deadline && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Deadline</label>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm sm:text-base font-medium text-gray-900">{formatDate(finding.deadline)}</p>
                      </div>
                    </div>
                  )}
                  {finding.createdAt && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Created At</label>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm sm:text-base font-medium text-gray-900">{formatDate(finding.createdAt)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Attachments</label>
                  {loadingAttachments ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading attachments...</span>
                    </div>
                  ) : attachments.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No attachments found</p>
                  ) : (
                    <div className="space-y-3">
                      {attachments.map((attachment) => {
                        const isImage = attachment.contentType?.startsWith('image/');
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className={`bg-gray-50 border border-gray-200 rounded-lg overflow-hidden ${
                              isImage ? '' : 'p-3 hover:bg-gray-100 transition-colors'
                            }`}
                          >
                            {isImage ? (
                              /* Image Preview */
                              <div>
                                <div className="p-3 border-b border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                                      <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                                    </div>
                                    {attachment.filePath && (
                                      <a
                                        href={attachment.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 ml-3 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
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
                                  <div className="p-3 bg-gray-50">
                                    <a
                                      href={attachment.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img
                                        src={attachment.filePath}
                                        alt={attachment.fileName}
                                        className="w-full h-auto max-h-96 object-contain rounded-lg border border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity"
                                        onError={(e) => {
                                          // Fallback if the image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = `
                                              <div class="p-4 text-center text-gray-500">
                                                <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <p class="text-sm">Image failed to load</p>
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
                                  <div className="flex-shrink-0">
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                                  </div>
                                </div>
                                {/* Download Button */}
                                {attachment.filePath && (
                                  <a
                                    href={attachment.filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-3 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                    title="Open file"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
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
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindingDetailModal;

