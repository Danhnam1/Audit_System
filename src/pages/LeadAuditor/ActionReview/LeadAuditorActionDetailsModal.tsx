import { useState, useEffect } from 'react';
import { getActionById, updateActionProgressPercent, type Action } from '../../../api/actions';
import { getAttachments, updateAttachmentStatus, type Attachment } from '../../../api/attachments';
import { approveFindingActionHigherLevel, rejectFindingActionHigherLevel } from '../../../api/findings';
import { toast } from 'react-toastify';

interface LeadAuditorActionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  onDataReload?: () => Promise<void>;
}

const LeadAuditorActionDetailsModal = ({ isOpen, onClose, actionId, onDataReload }: LeadAuditorActionDetailsModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

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
      
      // Filter out duplicate attachments by attachmentId
      const attachmentsArray = Array.isArray(attachmentsData) ? attachmentsData : [];
      const uniqueAttachments = attachmentsArray.filter((att, index, self) => 
        index === self.findIndex((a) => a.attachmentId === att.attachmentId)
      );
      
    
      
      setAttachments(uniqueAttachments);
    } catch (err: any) {
      console.error('Failed to load action details', err);
      toast.error('Failed to load action details: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!action) return;
    
    setProcessing(true);
    try {
      // IMPORTANT: Reload attachments to ensure we have the latest status
      // This ensures we're working with the most up-to-date attachment statuses
      let currentAttachments = attachments;
      try {
        const freshAttachments = await getAttachments('Action', action.actionId);
        currentAttachments = Array.isArray(freshAttachments) ? freshAttachments : [];
        setAttachments(currentAttachments);
      } catch (attErr) {
        // Continue with cached attachments if reload fails
      }
      
      // IMPORTANT: Before approving action, we should only approve attachments with status "Open"
      // Filter to get only attachments with status "Open" (case-insensitive)
      const openAttachments = currentAttachments.filter(att => {
        const status = att.status?.toLowerCase() || '';
        return status === 'open';
      });
      
      // const rejectedAttachments = currentAttachments.filter(att => {
      //   const status = att.status?.toLowerCase() || '';
      //   return status === 'rejected';
      // }); // Unused
      
      // const approvedAttachments = currentAttachments.filter(att => {
      //   const status = att.status?.toLowerCase() || '';
      //   return status === 'approved';
      // }); // Unused
      
      
      // This ensures rejected attachments are NOT approved
      if (openAttachments.length > 0) {
        const approvePromises = openAttachments.map(async (attachment) => {
          try {
            await updateAttachmentStatus(attachment.attachmentId, 'Approved');
            return { success: true, attachmentId: attachment.attachmentId, fileName: attachment.fileName };
          } catch (err: any) {
            return { success: false, attachmentId: attachment.attachmentId, fileName: attachment.fileName, error: err };
          }
        });
        
        const results = await Promise.all(approvePromises);
        // const succeeded = results.filter(r => r.success).length; // Unused
        const failed = results.filter(r => !r.success).length;
        
        if (failed > 0) {
        }
      } else {
      }
      
      // Now approve the action (backend should not approve rejected attachments)
      await approveFindingActionHigherLevel(action.actionId, '');
      
      toast.success('Action approved successfully!');
      
      // Reload attachments to reflect the updated statuses
      try {
        const updatedAttachments = await getAttachments('Action', action.actionId);
        const attachmentsArray = Array.isArray(updatedAttachments) ? updatedAttachments : [];
        // Filter out duplicate attachments by attachmentId
        const uniqueAttachments = attachmentsArray.filter((att, index, self) => 
          index === self.findIndex((a) => a.attachmentId === att.attachmentId)
        );
        setAttachments(uniqueAttachments);
        
      } catch (reloadErr) {
      }
      
      // Dispatch custom event to notify other components (e.g., CAPA Owner ActionDetailModal) that action was updated
      window.dispatchEvent(new CustomEvent('actionUpdated', { 
        detail: { actionId: action.actionId, status: 'approved' } 
      }));
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (onDataReload) {
        await onDataReload();
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      onClose();
    } catch (err: any) {
      console.error('Failed to approve action', err);
      toast.error(err?.response?.data?.message || 'Failed to approve action');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = () => {
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const handleConfirmFeedback = async () => {
    if (!action) return;
    
    setProcessing(true);
    try {
      await rejectFindingActionHigherLevel(action.actionId, feedback.trim());
      
      // Reset progress to 0 when action is rejected
      try {
        await updateActionProgressPercent(action.actionId, 0);
      } catch (progressError: any) {
        // Don't fail the whole operation if progress reset fails
      }
      
      toast.success('Action rejected successfully!');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (onDataReload) {
        await onDataReload();
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setShowFeedbackModal(false);
      onClose();
    } catch (err: any) {
      console.error('Failed to reject action', err);
      toast.error(err?.response?.data?.message || 'Failed to reject action');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
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
    if (statusLower === 'completed') {
      return (
        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded border border-purple-300 flex-shrink-0">
          Completed
        </span>
      );
    }
    // Default: show status as-is (capitalize first letter)
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded border border-gray-300 flex-shrink-0">
        {displayStatus}
      </span>
    );
  };

  // Unused function
  // const _getStatusColor = (_status: string) => {
  //   const statusLower = _status?.toLowerCase() || '';
  //   if (statusLower === 'open' || statusLower === 'pending') {
  //     return 'bg-blue-100 text-blue-800 border-blue-200';
  //   }
  //   if (statusLower === 'closed' || statusLower === 'resolved' || statusLower === 'reviewed') {
  //     return 'bg-gray-100 text-gray-800 border-gray-200';
  //   }
  //   if (statusLower === 'in progress' || statusLower === 'in-progress') {
  //     return 'bg-cyan-100 text-cyan-800 border-cyan-200';
  //   }
  //   if (statusLower === 'approved' || statusLower === 'verified') {
  //     return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  //   }
  //   if (statusLower === 'completed') {
  //     return 'bg-teal-100 text-teal-800 border-teal-200';
  //   }
  //   if (statusLower === 'rejected') {
  //     return 'bg-red-100 text-red-800 border-red-200';
  //   }
  //   return 'bg-gray-100 text-gray-800 border-gray-200';
  // };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    }
    if (['pdf'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (['doc', 'docx'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (['xls', 'xlsx'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-green-700" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  };

  if (!isOpen) return null;

  const isApproved = action?.status?.toLowerCase() === 'approved';

  return (
    <>
      <div className="fixed inset-0 z-[10000] overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-60 transition-opacity backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-xl shadow-lg w-full max-w-5xl mx-auto max-h-[90vh] overflow-hidden flex flex-col border border-blue-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-blue-600 px-8 py-6 flex items-center justify-between border-b border-blue-700">
              <div className="flex-1 min-w-0 flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Action Details</h2>
                  <p className="text-blue-100 text-sm mt-1">Comprehensive action information and attachments</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 flex-shrink-0 group"
              >
                <svg className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
              ) : !action ? (
                <div className="text-center py-8 text-gray-500">
                  Failed to load action details
                </div>
              ) : (
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

                    {/* Created Date */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Created Date
                      </label>
                      <input
                        type="text"
                        value={formatDate(action.createdAt)}
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
                  </div>

                  {/* Attachments Section */
                  <div className="bg-white rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">Attachments</h4>
                      <span className="ml-auto bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold border border-purple-200">
                        {attachments.filter(att => att.status?.toLowerCase() !== 'rejected').length} {attachments.filter(att => att.status?.toLowerCase() !== 'rejected').length === 1 ? 'file' : 'files'}
                      </span>
                    </div>
                    
                    {attachments.filter(att => att.status?.toLowerCase() !== 'rejected').length === 0 ? (
                      <div className="text-center py-8">
                        <div className="bg-gray-100 rounded-full p-4 inline-block mb-3">
                          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">No attachments available</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {[...attachments]
                          .filter((att, index, self) => {
                            // Remove duplicates by attachmentId
                            const isUnique = index === self.findIndex((a) => a.attachmentId === att.attachmentId);
                            // Filter out Rejected attachments
                            const isNotRejected = att.status?.toLowerCase() !== 'rejected';
                            return isUnique && isNotRejected;
                          })
                          .map((att) => {
                          const isImage = att.contentType?.toLowerCase().startsWith('image/');
                          const filePath = att.filePath || att.blobPath || '';
                          
                          // If it's an image, show image preview
                          if (isImage && filePath) {
                            return (
                              <div
                                key={att.attachmentId}
                                className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
                              >
                                {/* Image Header */}
                                <div className="p-4 border-b-2 border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="text-base font-bold text-gray-900 truncate">{att.fileName}</p>
                                          {getAttachmentStatusBadge(att.status)}
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">{formatFileSize(att.fileSize || 0)}</p>
                                      </div>
                                    </div>
                                    <a
                                      href={filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 ml-3 p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                                      title="Open image in new tab"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                {/* Image Preview - Full width, good quality */}
                                <div className="relative bg-gray-100">
                                  <img
                                    src={filePath}
                                    alt={att.fileName}
                                    className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      console.error('Image load error:', filePath);
                                      const target = e.target as HTMLImageElement;
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
                                    onClick={() => {
                                      // Open image in new tab when clicked
                                      window.open(filePath, '_blank');
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                          
                          // Non-image files
                          return (
                            <div
                              key={att.attachmentId}
                              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                            >
                              <div className="flex-shrink-0">
                                {getFileIcon(att.fileName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                    {att.fileName}
                                  </p>
                                  {getAttachmentStatusBadge(att.status)}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {formatFileSize(att.fileSize || 0)} • Uploaded {formatDate(att.uploadedAt)}
                                </p>
                              </div>
                              <a
                                href={att.filePath}
                                download={att.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm hover:shadow-md flex items-center gap-2 group"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 px-6 py-4">
              {isApproved && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Approve
                  </button>
                </>
              )}
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

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[10001] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !processing && setShowFeedbackModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b-2 bg-red-50 border-red-200">
                <h3 className="text-lg font-bold text-red-900">
                  Reject Action
                </h3>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Enter your rejection reason..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                />
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  disabled={processing}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFeedback}
                  disabled={processing || !feedback.trim()}
                  className="px-5 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadAuditorActionDetailsModal;
