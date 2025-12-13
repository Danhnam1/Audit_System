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
      // Load attachments for this action
      loadAttachments(actionId);
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

  const loadAttachments = async (actionId: string) => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('Action', actionId);
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 sm:px-8 py-6 shadow-lg z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Action Details</h2>
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
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white relative">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg font-medium">Loading action details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            ) : action ? (
              <div className="space-y-6">
                {/* Title and Status */}
                <div className="bg-gradient-to-r from-primary-50 to-blue-50 border-l-4 border-primary-600 p-6 rounded-r-xl shadow-md">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                      <h3 className="text-xl font-bold text-gray-900 break-words leading-tight">
                        {action.title}
                      </h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-[52px]">
                    <span className={`px-4 py-2 rounded-xl text-base font-bold shadow-sm ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                    {action.progressPercent > 0 && (
                      <span className="px-4 py-2 rounded-xl text-base font-bold bg-primary-100 text-primary-700 border-2 border-primary-200 shadow-sm">
                        {action.progressPercent}% Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {action.description && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide pt-2">Description</label>
                    </div>
                    <p className="text-base text-gray-800 leading-relaxed break-words min-h-[80px] pl-[52px]">
                      {action.description}
                    </p>
                  </div>
                )}

                {/* Progress Bar */}
                {action.progressPercent > 0 && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Progress</h4>
                      </div>
                      <span className="text-2xl font-bold text-primary-600">{action.progressPercent}%</span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 relative overflow-hidden"
                          style={{ width: `${action.progressPercent}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Responsible Person */}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Responsible Person</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">
                      {assignedToUser?.fullName || action.assignedTo || 'N/A'}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 rounded-xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-green-700 uppercase tracking-wide">Created Date</label>
                    </div>
                    <p className="text-lg font-bold text-green-900 pl-[52px]">
                      {formatDate(action.createdAt)}
                    </p>
                  </div>

                  {/* Due Date */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 border-2 border-red-200 rounded-xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-red-700 uppercase tracking-wide">Due Date</label>
                    </div>
                    <p className="text-lg font-bold text-red-900 pl-[52px]">
                      {formatDate(action.dueDate)}
                    </p>
                  </div>

                  {/* Closed Date - Full Width (if exists) */}
                  {action.closedAt && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-6 shadow-md md:col-span-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Closed Date</label>
                      </div>
                      <p className="text-lg font-bold text-gray-900 pl-[52px]">
                        {formatDate(action.closedAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {action.findingId && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Attachments</label>
                      <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-bold rounded-full">
                        {attachments.length}
                      </span>
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
                          const isImage = attachment.contentType?.toLowerCase().startsWith('image/');
                          const filePath = attachment.filePath || attachment.blobPath || '';
                          
                          // If it's an image, always show the image preview
                          if (isImage && filePath) {
                            return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all"
                              >
                                {/* Image Header */}
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
                                    <a
                                      href={filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 ml-3 p-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                                      title="Open image in new tab"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                {/* Image Preview */}
                                <div className="p-4 bg-gray-50">
                                  <img
                                    src={filePath}
                                    alt={attachment.fileName}
                                    className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                                    onError={(e) => {
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
                                </div>
                              </div>
                            );
                          }
                          
                          // Non-image files
                          return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-4 hover:bg-gray-100 hover:border-primary-300 transition-all shadow-sm"
                              >
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
                                {filePath && (
                                  <a
                                    href={filePath}
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
          {showReviewButtons && action && (action.status?.toLowerCase() === 'reviewed' || action.status?.toLowerCase() === 'verified') && !showFeedbackInput && (
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

