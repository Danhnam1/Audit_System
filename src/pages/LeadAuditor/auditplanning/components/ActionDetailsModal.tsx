import { useState, useEffect } from 'react';
import { getActionById, type Action } from '../../../../api/actions';
import { getAttachments, type Attachment } from '../../../../api/attachments';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../../utils/errorMessages';

interface ActionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
}

const ActionDetailsModal = ({ isOpen, onClose, actionId }: ActionDetailsModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && actionId) {
      loadActionDetails();
    }
  }, [isOpen, actionId]);

  const loadActionDetails = async () => {
    setLoading(true);
    try {
      const [actionData, attachmentsData] = await Promise.all([
        getActionById(actionId),
        getAttachments('Action', actionId),
      ]);
      setAction(actionData);
      // Show all attachments, including old evidence when action is rejected
      setAttachments(Array.isArray(attachmentsData) ? attachmentsData : []);
    } catch (err: any) {
      console.error('Failed to load action details', err);
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to load action details. Please refresh the page.'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get status badge for attachment
  const getAttachmentStatusBadge = (status?: string) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'rejected') {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-300 flex-shrink-0">
          Rejected
        </span>
      );
    }
    if (statusLower === 'approved') {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-300 flex-shrink-0">
          Approved
        </span>
      );
    }
    if (statusLower === 'open') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-300 flex-shrink-0">
          Open
        </span>
      );
    }
    if (statusLower === 'Completed') {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded border border-blue-300 flex-shrink-0">
          Completed
        </span>
      );
    }
    // Default: show status as-is
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded border border-gray-300 flex-shrink-0">
        {status}
      </span>
    );
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-lg w-full max-w-5xl mx-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 px-6 py-5 flex items-center justify-between z-10 border-b border-blue-700">
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span className="text-white font-medium">Loading action details...</span>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-white">Action Details</h2>
                  <p className="text-blue-100 text-sm mt-1">Comprehensive action information and attachments</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading action details...</span>
              </div>
            ) : action ? (
              <div className="space-y-6">
                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Title
                    </label>
                    <input
                      type="text"
                      value={action.title || 'N/A'}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Status
                    </label>
                    <input
                      type="text"
                      value={action.status || 'N/A'}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Due Date
                    </label>
                    <input
                      type="text"
                      value={formatDate(action.dueDate)}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Description */}
                  {action.description && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Description
                      </label>
                      <textarea
                        value={action.description}
                        readOnly
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium resize-none"
                      />
                    </div>
                  )}

                  {/* Progress */}
                  {action.progressPercent > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Progress
                      </label>
                      <input
                        type="text"
                        value={`${action.progressPercent}% Complete`}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                      />
                    </div>
                  )}

                  {/* Review Feedback */}
                  {action.reviewFeedback && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Review Feedback
                      </label>
                      <textarea
                        value={action.reviewFeedback}
                        readOnly
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium resize-none"
                      />
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {attachments.filter(att => att.status?.toLowerCase() !== 'inactive').length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Attachments ({attachments.filter(att => att.status?.toLowerCase() !== 'inactive').length})
                    </label>
                    <div className="space-y-3">
                      {[...attachments]
                        .filter(att => att.status?.toLowerCase() !== 'inactive')
                        .sort((a, b) => {
                        // Sort: Rejected attachments first, then others
                        const aIsRejected = a.status?.toLowerCase() === 'rejected';
                        const bIsRejected = b.status?.toLowerCase() === 'rejected';
                        if (aIsRejected && !bIsRejected) return -1;
                        if (!aIsRejected && bIsRejected) return 1;
                        return 0;
                      }).map((attachment) => {
                        const isImage = attachment.contentType?.startsWith('image/');
                        const imageUrl = attachment.filePath || attachment.blobPath || '';
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm"
                          >
                            {/* Image preview - Full width, good quality */}
                            {isImage && imageUrl && (
                              <div className="relative bg-gray-100">
                                <img
                                  src={imageUrl}
                                  alt={attachment.fileName}
                                  className="w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    console.error('Image load error:', attachment.filePath);
                                    e.currentTarget.parentElement!.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* File info bar */}
                            <div className="p-3 bg-gray-50 border-t border-gray-200">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isImage ? (
                                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-gray-700 font-medium truncate">{attachment.fileName}</p>
                                      {getAttachmentStatusBadge(attachment.status)}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {formatFileSize(attachment.fileSize || 0)} • {new Date(attachment.uploadedAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={imageUrl || attachment.filePath}
                                  download={attachment.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium">No action data available</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionDetailsModal;
