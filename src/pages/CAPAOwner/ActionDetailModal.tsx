import { useState, useEffect } from 'react';
import { getActionById, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';

interface ActionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
}

const ActionDetailModal = ({ isOpen, onClose, actionId }: ActionDetailModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    if (isOpen && actionId) {
      loadAction();
    }
  }, [isOpen, actionId]);

  const loadAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActionById(actionId);
      setAction(data);
      // Load attachments if findingId exists
      if (data.findingId) {
        loadAttachments(data.findingId);
      }
    } catch (err: any) {
      console.error('Error loading action:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load action details');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (findingId: string) => {
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

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'approved') return 'bg-green-100 text-green-800';
    if (statusLower === 'open') return 'bg-blue-100 text-blue-800';
    if (statusLower === 'closed') return 'bg-gray-100 text-gray-800';
    if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-800';
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
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Action Details</h2>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading action details...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm sm:text-base">{error}</p>
              </div>
            ) : action ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Title and Status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-gray-200">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 break-words">
                      {action.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                      {action.progressPercent > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {action.progressPercent}% Complete
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {action.description && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Description</h4>
                    <p className="text-sm sm:text-base text-gray-600 bg-gray-50 rounded-lg p-3 break-words">
                      {action.description}
                    </p>
                  </div>
                )}

                {/* Progress Bar */}
                {action.progressPercent > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700">Progress</h4>
                      <span className="text-xs sm:text-sm font-medium text-gray-800">{action.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${action.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Due Date */}
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <p className="text-xs text-gray-500 mb-1">Due Date</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                      {formatDate(action.dueDate)}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <p className="text-xs text-gray-500 mb-1">Created Date</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                      {formatDate(action.createdAt)}
                    </p>
                  </div>

                  {/* Closed Date */}
                  {action.closedAt && (
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xs text-gray-500 mb-1">Closed Date</p>
                      <p className="text-xs sm:text-sm font-medium text-gray-900">
                        {formatDate(action.closedAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {action.findingId && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">Attachments</h4>
                    {loadingAttachments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-xs sm:text-sm text-gray-600">Loading attachments...</span>
                      </div>
                    ) : attachments.length === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-500 py-2 bg-gray-50 rounded-lg p-3 text-center">
                        No attachments found
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {attachments.map((attachment) => {
                          const isImage = attachment.contentType?.toLowerCase().startsWith('image/');
                          const filePath = attachment.filePath || attachment.blobPath || '';
                          
                          // If it's an image, always show the image preview
                          if (isImage && filePath) {
                            return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
                              >
                                {/* Image Header */}
                                <div className="p-3 border-b border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                                      <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                                    </div>
                                    <a
                                      href={filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Open image in new tab"
                                    >
                                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                {/* Image Preview */}
                                <div className="p-3 bg-gray-50">
                                  <img
                                    src={filePath}
                                    alt={attachment.fileName}
                                    className="w-full h-auto max-h-64 sm:max-h-96 object-contain rounded-lg border border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `
                                          <div class="p-4 text-center text-gray-500">
                                            <svg class="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="text-xs sm:text-sm">Image failed to load</p>
                                          </div>
                                        `;
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                          
                          // Non-image files
                          return (
                            <div
                              key={attachment.attachmentId}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* File Icon */}
                                  <div className="flex-shrink-0">
                                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                                  </div>
                                </div>
                                {/* Download Button */}
                                {filePath && (
                                  <a
                                    href={filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Open file"
                                  >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionDetailModal;

