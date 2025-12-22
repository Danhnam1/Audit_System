import { useState, useRef, useEffect } from 'react';
import { updateActionStatusInProgress, updateActionStatusReviewed, updateActionProgressPercent, getActionById } from '../../api/actions';
import { uploadAttachment, getAttachments, type Attachment } from '../../api/attachments';

interface StartActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionId: string;
}

const StartActionModal = ({ isOpen, onClose, onSuccess, actionId }: StartActionModalProps) => {
  const [currentProgress, setCurrentProgress] = useState<number>(0); // Current saved progress
  const [selectedProgress, setSelectedProgress] = useState<number>(25);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation: Must have progress selected and at least one file
  const canSave = selectedProgress > 0 && files.length > 0;

  // Load action data and attachments when modal opens
  useEffect(() => {
    if (isOpen && actionId) {
      const loadData = async () => {
        setLoadingAction(true);
        setLoadingAttachments(true);
        try {
          // Load action to get current progress
          const action = await getActionById(actionId);
          const progress = action.progressPercent || 0;
          setCurrentProgress(progress);
          
          // Set selected progress to next available value or current if at 100%
          if (progress >= 100) {
            setSelectedProgress(100);
          } else if (progress >= 75) {
            setSelectedProgress(100);
          } else if (progress >= 50) {
            setSelectedProgress(75);
          } else if (progress >= 25) {
            setSelectedProgress(50);
          } else {
            setSelectedProgress(25);
          }
          
          // Load attachments
          const attachments = await getAttachments('Action', actionId);
          // Filter out rejected attachments
          const filteredAttachments = (attachments || []).filter(att => att.status?.toLowerCase() !== 'rejected');
          setExistingAttachments(filteredAttachments);
        } catch (err: any) {
          console.error('Error loading data:', err);
          // Don't show error, just log it
        } finally {
          setLoadingAction(false);
          setLoadingAttachments(false);
        }
      };
      loadData();
    } else {
      setExistingAttachments([]);
      setCurrentProgress(0);
    }
  }, [isOpen, actionId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateRetentionUntil = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  const handleUploadEvidence = () => {
    fileInputRef.current?.click();
  };

  const handleSaveClick = () => {
    if (!canSave) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    if (submitting || uploading) return;

    setError(null);
    setSubmitting(true);

    try {
      const retentionUntil = calculateRetentionUntil();

      // Upload files first
      setUploading(true);
      const uploadedFiles: string[] = [];
      for (const file of files) {
        try {
          await uploadAttachment({
            entityType: 'Action',
            entityId: actionId,
            status: 'Open',
            retentionUntil: retentionUntil,
            isArchived: false,
            file: file,
          });
          uploadedFiles.push(file.name);
        } catch (fileError: any) {
          console.error(`Error uploading file ${file.name}:`, fileError);
          // Continue with other files even if one fails
        }
      }
      setUploading(false);

      // Update status based on progress percent
      if (selectedProgress < 100) {
        // If progress < 100%, update progress percent first, then call in-progress API
        await updateActionProgressPercent(actionId, selectedProgress);
        await updateActionStatusInProgress(actionId);
      } else if (selectedProgress === 100) {
        // If progress = 100%, update progress percent first, then call reviewed API
        await updateActionProgressPercent(actionId, selectedProgress);
        await updateActionStatusReviewed(actionId);
      }

      // Success - reload attachments and close modal
      // Small delay to ensure API has updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload existing attachments to show newly uploaded ones
      try {
        const attachments = await getAttachments('Action', actionId);
        // Filter out rejected attachments
        const filteredAttachments = (attachments || []).filter(att => att.status?.toLowerCase() !== 'rejected');
        setExistingAttachments(filteredAttachments);
      } catch (err) {
        console.error('Error reloading attachments:', err);
      }
      
      // Dispatch custom event to notify other components (like FindingsProgress) that action was updated
      window.dispatchEvent(new CustomEvent('actionUpdated', {
        detail: { actionId, progress: selectedProgress }
      }));
      
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error saving progress:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save progress');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
  };

  const handleClose = () => {
    if (submitting || uploading) return;
    setFiles([]);
    setSelectedProgress(25);
    setError(null);
    setExistingAttachments([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Start Action</h2>
            <button
              onClick={handleClose}
              disabled={submitting || uploading}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Progress Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Progress Percent
                </label>
                {currentProgress > 0 && (
                  <span className="text-xs text-gray-500">Current: {currentProgress}%</span>
                )}
              </div>
              {loadingAction ? (
                <div className="flex items-center justify-center py-3 border border-gray-300 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading...</span>
                </div>
              ) : (
                <select
                  value={selectedProgress}
                  onChange={(e) => setSelectedProgress(Number(e.target.value))}
                  disabled={submitting || uploading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value={25} disabled={currentProgress >= 25}>25%</option>
                  <option value={50} disabled={currentProgress >= 50}>50%</option>
                  <option value={75} disabled={currentProgress >= 75}>75%</option>
                  <option value={100} disabled={currentProgress >= 100}>100%</option>
                </select>
              )}
              {currentProgress > 0 && (
                <p className="mt-1.5 text-xs text-gray-500">
                  ⚠️ You can only increase progress, not decrease it
                </p>
              )}
            </div>

            {/* Existing Attachments Section */}
            {existingAttachments.filter(att => att.status?.toLowerCase() !== 'rejected').length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Existing Evidence ({existingAttachments.filter(att => att.status?.toLowerCase() !== 'rejected').length})
                </label>
                {loadingAttachments ? (
                  <div className="flex items-center justify-center py-3 border border-gray-200 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading...</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {existingAttachments.filter(att => att.status?.toLowerCase() !== 'rejected').map((attachment) => (
                      <div
                        key={attachment.attachmentId}
                        className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize || 0)}</p>
                          </div>
                        </div>
                        {attachment.filePath && (
                          <a
                            href={attachment.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Open file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload Evidence Section */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Upload New Evidence {files.length > 0 && `(${files.length})`}
              </label>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={submitting || uploading}
              />

              {/* Upload button */}
              <button
                type="button"
                onClick={handleUploadEvidence}
                disabled={submitting || uploading}
                className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? 'Uploading...' : 'Choose Files'}
              </button>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={submitting || uploading}
                        className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Validation Message */}
            {!canSave && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-amber-800 text-sm">
                  Please upload at least one evidence file to continue.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleClose}
              disabled={submitting || uploading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={!canSave || submitting || uploading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? (uploading ? 'Uploading...' : 'Saving...') : 'Save Progress'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelConfirm}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                Confirm Save Progress
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                Are you sure you want to save progress at {selectedProgress}% with {files.length} evidence file(s)?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleCancelConfirm}
                  disabled={submitting || uploading}
                  className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={submitting || uploading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? (uploading ? 'Uploading...' : 'Saving...') : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StartActionModal;

