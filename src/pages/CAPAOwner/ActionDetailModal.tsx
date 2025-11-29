import { useState, useEffect } from 'react';
import { getActionById, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById, type AdminUserDto } from '../../api/adminUsers';

interface ActionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  showReviewButtons?: boolean;
  onApprove?: (feedback: string) => Promise<void>;
  onReject?: (feedback: string) => Promise<void>;
  isProcessing?: boolean;
}

const ActionDetailModal = ({ 
  isOpen, 
  onClose, 
  actionId, 
  showReviewButtons = false,
  onApprove,
  onReject,
  isProcessing = false
}: ActionDetailModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [assignedToUser, setAssignedToUser] = useState<AdminUserDto | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [reviewType, setReviewType] = useState<'approve' | 'reject'>('approve');

  useEffect(() => {
    if (isOpen && actionId) {
      loadAction();
    } else {
      // Reset state when modal closes
      setAction(null);
      setAssignedToUser(null);
      setAttachments([]);
      setError(null);
      setReviewFeedback('');
      setShowFeedbackInput(false);
      setReviewType('approve');
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
      // Load assignedTo user info
      if (data.assignedTo) {
        loadAssignedToUser(data.assignedTo);
      }
    } catch (err: any) {
      console.error('Error loading action:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load action details');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedToUser = async (userId: string) => {
    try {
      const userData = await getUserById(userId);
      setAssignedToUser(userData);
    } catch (err: any) {
      console.error('Error loading assignedTo user:', err);
      // Don't show error, just log it
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
    if (statusLower === 'completed' || statusLower === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (statusLower === 'active' || statusLower === 'open') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (statusLower === 'closed') return 'bg-gray-100 text-gray-700 border-gray-200';
    if (statusLower === 'pending' || statusLower === 'reviewed') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-5 flex items-center justify-between z-10 shadow-lg">
            <h2 className="text-xl font-bold">Action Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                <span className="mt-4 text-gray-600 font-medium">Loading action details...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              </div>
            ) : action ? (
              <div className="space-y-6">
                {/* Title and Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 break-words leading-tight">
                    {action.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                    {action.progressPercent > 0 && (
                      <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-100 text-primary-700 border border-primary-200">
                        {action.progressPercent}% Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {action.description && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Description</h4>
                    <p className="text-base text-gray-700 leading-relaxed break-words">
                      {action.description}
                    </p>
                  </div>
                )}

                {/* Progress Bar */}
                {action.progressPercent > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Progress</h4>
                      <span className="text-lg font-bold text-primary-600">{action.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${action.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="space-y-4">
                  {/* Responsible Person - Full Width */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsible Person</p>
                    <p className="text-base font-semibold text-gray-900">
                      {assignedToUser?.fullName || action.assignedTo || 'N/A'}
                    </p>
                  </div>

                  {/* Created Date and Due Date - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Created Date */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formatDate(action.createdAt)}
                      </p>
                    </div>

                    {/* Due Date */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formatDate(action.dueDate)}
                      </p>
                    </div>
                  </div>

                  {/* Closed Date - Full Width (if exists) */}
                  {action.closedAt && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Closed Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formatDate(action.closedAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {action.findingId && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Attachments</h4>
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                        {attachments.length}
                      </span>
                    </div>
                    {loadingAttachments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-xs sm:text-sm text-gray-600">Loading attachments...</span>
                      </div>
                    ) : attachments.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-500 font-medium">No attachments found</p>
                      </div>
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
                                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 hover:border-primary-300 transition-all shadow-sm"
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

            {/* Feedback Input */}
            {showFeedbackInput && showReviewButtons && action && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-4">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    {reviewType === 'reject' ? 'Feedback (Required)' : 'Feedback (Optional)'}
                  </label>
                  <textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    rows={3}
                    placeholder={reviewType === 'reject' ? 'Enter a reason for rejection...' : 'Enter feedback if needed...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowFeedbackInput(false);
                      setReviewFeedback('');
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (reviewType === 'approve') {
                        onApprove?.(reviewFeedback);
                      } else if (reviewType === 'reject' && reviewFeedback.trim()) {
                        onReject?.(reviewFeedback);
                      }
                    }}
                    disabled={isProcessing || (reviewType === 'reject' && !reviewFeedback.trim())}
                    className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      reviewType === 'approve'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isProcessing ? 'Processing...' : reviewType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer with Review Buttons */}
          {showReviewButtons && action && action.status?.toLowerCase() === 'reviewed' && !showFeedbackInput && (
            <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowFeedbackInput(true);
                  setReviewType('approve');
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  setShowFeedbackInput(true);
                  setReviewType('reject');
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionDetailModal;

