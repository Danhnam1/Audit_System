import React, { useState, useEffect } from 'react';
import { getAdminUsersByDepartment, type AdminUserDto } from '../../../api/adminUsers';
import { uploadAttachment, getAttachments, deleteAttachment, type Attachment } from '../../../api/attachments';
import apiClient from '../../../api/client';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';

interface EditCompliantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  compliantData: {
    id: number;
    auditChecklistItemId: string;
    title: string;
    reason: string;
    dateOfCompliance: string;
    timeOfCompliance: string;
    department: string;
    witnessId: string;
    createdBy: string;
    createdDate: string;
    status: string;
    reasonReturn: string;
  };
  departmentName?: string;
  deptId?: number;
}

const EditCompliantModal = ({
  isOpen,
  onClose,
  onSuccess,
  compliantData,
  departmentName = '',
  deptId = 0,
}: EditCompliantModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
  
  // Form fields
  const [reason, setReason] = useState('');
  const [selectedWitnesses, setSelectedWitnesses] = useState<string>('');
  const [departmentUsers, setDepartmentUsers] = useState<AdminUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showWitnessesDropdown, setShowWitnessesDropdown] = useState(false);

  // Confirmation modals
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);

  // Compliance date and time (can be editable or read-only based on requirements)
  const [complianceDate, setComplianceDate] = useState('');
  const [complianceTime, setComplianceTime] = useState('');

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen && compliantData) {
      setReason(compliantData.reason || '');
      setSelectedWitnesses(compliantData.witnessId || '');
      setComplianceDate(compliantData.dateOfCompliance || '');
      setComplianceTime(compliantData.timeOfCompliance || '');
      
      // Load existing attachments
      loadExistingAttachments();
    }
  }, [isOpen, compliantData]);

  // Load department users when modal opens
  useEffect(() => {
    if (isOpen && deptId && deptId > 0) {
      loadDepartmentUsers();
    }
  }, [isOpen, deptId]);

  const loadExistingAttachments = async () => {
    if (!compliantData?.auditChecklistItemId) return;
    
    setLoadingAttachments(true);
    try {
      const attachments = await getAttachments('compliant', compliantData.auditChecklistItemId);
      const activeAttachments = (attachments || []).filter(
        (att: Attachment) => (att.status || '').toLowerCase() !== 'inactive'
      );
      setExistingAttachments(activeAttachments);
    } catch (err) {
      console.error('Error loading attachments:', err);
      setExistingAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const loadDepartmentUsers = async () => {
    if (!deptId || deptId <= 0) return;
    
    setLoadingUsers(true);
    try {
      const users = await getAdminUsersByDepartment(deptId);
      const potentialWitnesses = users.filter(
        (user) => user.roleName === 'AuditeeOwner' || user.roleName === 'CAPAOwner'
      );
      setDepartmentUsers(potentialWitnesses);
    } catch (err: any) {
      console.error('Error loading department users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleWitnessToggle = (userId: string) => {
    setSelectedWitnesses(prev => prev === userId ? '' : userId);
  };

  const getSelectedWitnessesDisplay = (): string => {
    if (!selectedWitnesses) return '';
    return departmentUsers.find(u => u.userId === selectedWitnesses)?.fullName || '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      
      const invalidFiles = newFiles.filter(file => file.size > maxSize);
      if (invalidFiles.length > 0) {
        setFileError(`The following files exceed the 10MB limit: ${invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join(', ')}`);
        e.target.value = '';
        return;
      }
      
      if (fileError) {
        setFileError('');
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (fileError) {
      setFileError('');
    }
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setDeletedAttachmentIds(prev => [...prev, attachmentId]);
    setExistingAttachments(prev => prev.filter(att => att.attachmentId !== attachmentId));
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  const getImagePreviewUrl = (file: File) => {
    return URL.createObjectURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!reason.trim()) {
      toast.error('Reason Why It Meets Standards is required');
      return;
    }
    
    if (fileError) {
      toast.error('Please fix file upload errors before submitting');
      return;
    }
    
    const maxSize = 10 * 1024 * 1024;
    const invalidCurrentFiles = files.filter(file => file.size > maxSize);
    if (invalidCurrentFiles.length > 0) {
      setFileError(`Some files exceed 10MB limit: ${invalidCurrentFiles.map(f => f.name).join(', ')}`);
      toast.error('Please remove files that exceed 10MB limit');
      return;
    }
    
    setShowUpdateConfirmModal(true);
  };

  const handleConfirmUpdate = async () => {
    setShowUpdateConfirmModal(false);
    setSubmitting(true);
    
    try {
      // Update compliant record using PUT
      const updatePayload = {
        auditChecklistItemId: compliantData.auditChecklistItemId,
        title: compliantData.title,
        reason: reason.trim(),
        dateOfCompliance: complianceDate,
        timeOfCompliance: complianceTime,
        department: departmentName || compliantData.department,
        witnessId: selectedWitnesses || '',
        status: 'Fixed',
      };

      await apiClient.put(`/ChecklistItemNoFinding/${compliantData.id}`, updatePayload);

      // Delete removed attachments
      if (deletedAttachmentIds.length > 0) {
        await Promise.all(
          deletedAttachmentIds.map((id) =>
            deleteAttachment(id).catch((err) => console.warn(`Failed to delete attachment ${id}`, err))
          )
        );
        setDeletedAttachmentIds([]);
      }
      
      // Upload new files
      if (files.length > 0) {
        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() + 30);
        const retentionUntil = retentionDate.toISOString().split('T')[0];

        const uploadResults = [];
        for (const file of files) {
          try {
            await uploadAttachment({
              entityType: 'compliant',
              entityId: compliantData.auditChecklistItemId,
              status: 'Compliant',
              retentionUntil: retentionUntil,
              isArchived: false,
              file: file,
            });
            uploadResults.push({ file: file.name, success: true });
          } catch (fileError: any) {
            uploadResults.push({ file: file.name, success: false, error: fileError?.message });
          }
        }
        
        const failCount = uploadResults.filter(r => !r.success).length;
        if (failCount > 0) {
          console.warn(`${failCount} file(s) failed to upload`);
        }
      }
      
      toast.success('Compliant record updated successfully');
      
      // Reset form
      setFiles([]);
      setFileError('');
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error updating compliant record:', err);
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to update compliant record. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;

    const hasChanges = reason !== compliantData.reason || 
                      selectedWitnesses !== compliantData.witnessId || 
                      files.length > 0 ||
                      deletedAttachmentIds.length > 0;

    if (hasChanges) {
      setShowCancelConfirmModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    setReason(compliantData.reason || '');
    setSelectedWitnesses(compliantData.witnessId || '');
    setComplianceDate(compliantData.dateOfCompliance || '');
    setComplianceTime(compliantData.timeOfCompliance || '');
    setFiles([]);
    setFileError('');
    setDeletedAttachmentIds([]);
    setShowCancelConfirmModal(false);
    loadExistingAttachments(); // Reload to restore deleted items
    onClose();
  };

  const handleCancelCancel = () => {
    setShowCancelConfirmModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-semibold text-gray-900">Edit Compliant Record</h2>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Return Reason Display (if exists) */}
            {compliantData.reasonReturn && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-orange-800 mb-2">Return Reason:</h3>
                <p className="text-sm text-orange-700">{compliantData.reasonReturn}</p>
              </div>
            )}

            {/* Title (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item
              </label>
              <input
                type="text"
                value={compliantData.title}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>

            {/* Reason - Why it meets standards */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason Why It Meets Standards <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Explain why this item meets the required standards..."
              />
            </div>

            {/* Two-column layout for date/time */}
            <div className="grid grid-cols-2 gap-4">
              {/* Compliance Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Compliance
                </label>
                <input
                  type="date"
                  value={complianceDate}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* Compliance Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time of Compliance
                </label>
                <input
                  type="time"
                  value={complianceTime}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            {/* Department - Read-only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <input
                type="text"
                value={departmentName || compliantData.department}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>

            {/* Witnesses - Single select dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Witness
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowWitnessesDropdown(!showWitnessesDropdown)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 flex items-center justify-between"
                >
                  <span className="text-gray-700">
                    {loadingUsers ? (
                      <span className="text-gray-500">Loading users...</span>
                    ) : !selectedWitnesses ? (
                      <span className="text-gray-500">Select a witness from department...</span>
                    ) : (
                      getSelectedWitnessesDisplay()
                    )}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-600 transition-transform ${
                      showWitnessesDropdown ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {showWitnessesDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="px-4 py-3 text-center text-gray-500">
                        <div className="inline-block animate-spin">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      </div>
                    ) : departmentUsers.length === 0 ? (
                      <div className="px-4 py-3 text-center text-gray-500 text-sm">
                        No users found in this department
                      </div>
                    ) : (
                      departmentUsers.map(user => (
                        <label
                          key={user.userId}
                          className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <input
                            type="radio"
                            name="witness"
                            checked={selectedWitnesses === user.userId}
                            onChange={() => handleWitnessToggle(user.userId || '')}
                            className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">
                            {user.fullName}
                          </span>
                          {user.email && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({user.email})
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Existing Attachments */}
            {loadingAttachments ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 mt-2">Loading attachments...</p>
              </div>
            ) : existingAttachments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Attachments
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {existingAttachments.map((attachment) => (
                    <div key={attachment.attachmentId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {attachment.filePath?.split('/').pop() || 'Attachment'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingAttachment(attachment.attachmentId)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Remove attachment"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add New Attachments <span className="text-gray-500 text-xs">(Max 10MB per file)</span>
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  fileError ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {fileError && (
                <p className="mt-1 text-sm text-red-600">{fileError}</p>
              )}
              
              {files.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">New files to upload:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        {isImageFile(file) ? (
                          <img
                            src={getImagePreviewUrl(file)}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewImage(getImagePreviewUrl(file))}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-blue-200 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Remove file"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update Compliant
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[70] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cancel */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelCancel}
          />
          
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Cancel
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to cancel? All unsaved changes will be lost.
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  No, Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Update */}
      {showUpdateConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowUpdateConfirmModal(false)}
          />
          
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Update
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to update this compliant record?
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpdateConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpdate}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Yes, Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditCompliantModal;
