import { useState, useEffect } from 'react';
import { getActionById, type Action } from '../../../../api/actions';
import { getAttachments, type Attachment } from '../../../../api/attachments';
import { toast } from 'react-toastify';

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
      setAttachments(Array.isArray(attachmentsData) ? attachmentsData.filter(att => att.status?.toLowerCase() !== 'rejected') : []);
    } catch (err: any) {
      console.error('Failed to load action details', err);
      toast.error('Failed to load action details: ' + (err?.message || 'Unknown error'));
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

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'open' || statusLower === 'pending') {
      return 'bg-blue-100 text-blue-800';
    }
    if (statusLower === 'closed' || statusLower === 'resolved' || statusLower === 'reviewed') {
      return 'bg-gray-100 text-gray-800';
    }
    if (statusLower === 'in progress' || statusLower === 'in-progress') {
      return 'bg-purple-100 text-purple-800';
    }
    if (statusLower === 'approved') {
      return 'bg-green-100 text-green-800';
    }
    if (statusLower === 'rejected') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
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
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white">Action Details</h2>
                    {action && (
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(action.status || '')}`}>
                        {action.status || 'N/A'}
                      </span>
                    )}
                  </div>
                  <p className="text-white/90 text-sm font-medium pl-9 truncate">
                    {action?.title || 'Loading...'}
                  </p>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors ml-4 flex-shrink-0"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading action details...</p>
                </div>
              </div>
            ) : action ? (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gradient-to-br from-white to-indigo-50 rounded-xl border-2 border-indigo-200 shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</p>
                      <p className="text-sm font-medium text-gray-900">{action.title || 'N/A'}</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(action.status || '')}`}>
                        {action.status || 'N/A'}
                      </span>
                    </div>

                    {action.description && (
                      <div className="md:col-span-2 bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{action.description}</p>
                      </div>
                    )}

                    <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(action.dueDate)}</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Progress</p>
                      <div className="w-full bg-indigo-200 rounded-full h-3 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-300 shadow-sm flex items-center justify-end pr-2" 
                          style={{ width: `${action.progressPercent ?? 0}%` }}
                        >
                          <span className="text-[10px] font-bold text-white">{action.progressPercent ?? 0}%</span>
                        </div>
                      </div>
                    </div>

                    {action.reviewFeedback && (
                      <div className="md:col-span-2 bg-amber-50 rounded-lg p-4 border border-amber-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Review Feedback</p>
                        </div>
                        <p className="text-sm text-gray-900">{action.reviewFeedback}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border-2 border-blue-200 shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900">Attachments</h3>
                    {attachments.length > 0 && (
                      <span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        {attachments.length}
                      </span>
                    )}
                  </div>

                  {attachments.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 font-medium">No attachments</p>
                      <p className="text-gray-400 text-sm mt-1">No files have been uploaded yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.attachmentId}
                          className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{attachment.fileName}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                            </div>
                            {attachment.filePath && (
                              <a
                                href={attachment.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Open file"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
          <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200 px-6 py-4 flex justify-end shadow-lg">
            <button
              onClick={onClose}
              className="px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg bg-gradient-to-r from-gray-700 to-gray-800 text-white hover:from-gray-800 hover:to-gray-900 transform hover:scale-105 active:scale-95 flex items-center gap-2"
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

export default ActionDetailsModal;
