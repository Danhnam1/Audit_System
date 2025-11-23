import { useState, useRef } from 'react';
import { updateActionStatusInProgress, updateActionStatusReviewed, updateActionProgressPercent } from '../../api/actions';
import { uploadAttachment } from '../../api/attachments';

interface StartActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionId: string;
}

const StartActionModal = ({ isOpen, onClose, onSuccess, actionId }: StartActionModalProps) => {
  const [selectedProgress, setSelectedProgress] = useState<number>(25);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation: Must have progress selected and at least one file
  const canSave = selectedProgress > 0 && files.length > 0;

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
        // If progress = 100%, call reviewed API (no need to update progress-percent as it's already 100%)
        await updateActionStatusReviewed(actionId);
      }

      // Success - close modal and refresh
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
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Progress Percent
              </label>
              <select
                value={selectedProgress}
                onChange={(e) => setSelectedProgress(Number(e.target.value))}
                disabled={submitting || uploading}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
              </select>
            </div>

            {/* Upload Evidence Section */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Evidence Files
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
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Evidence'}
              </button>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={submitting || uploading}
                        className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove file"
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <p className="text-red-800 text-xs sm:text-sm">{error}</p>
              </div>
            )}

            {/* Validation Message */}
            {!canSave && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                <p className="text-yellow-800 text-xs sm:text-sm">
                  Please select progress percent and upload at least one evidence file to save.
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

