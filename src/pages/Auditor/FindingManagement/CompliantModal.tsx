import React, { useState, useEffect } from 'react';
import { markChecklistItemCompliant, markChecklistItemCompliant1 } from '../../../api/checklists';
import { getAdminUsersByDepartment, type AdminUserDto } from '../../../api/adminUsers';
import { uploadAttachment } from '../../../api/attachments';
import { useUserId } from '../../../store/useAuthStore';

interface CompliantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (response?: any) => void;
  checklistItem: {
    auditItemId: string;
    auditId: string;
    questionTextSnapshot: string;
  };
  departmentName?: string; // Department name passed from parent
  deptId?: number; // Department ID to fetch users
}

const CompliantModal = ({
  isOpen,
  onClose,
  onSuccess,
  checklistItem,
  departmentName = '',
  deptId = 0,
}: CompliantModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>('');
  
  // Get current user ID from auth store
  const currentUserId = useUserId();
  
  // Additional fields
  const [reason, setReason] = useState(''); // Why it meets standards
  const [selectedWitnesses, setSelectedWitnesses] = useState<string>(''); // Single witness ID
  const [departmentUsers, setDepartmentUsers] = useState<AdminUserDto[]>([]); // Users from department
  const [loadingUsers, setLoadingUsers] = useState(false); // Loading state for users
  const [showWitnessesDropdown, setShowWitnessesDropdown] = useState(false); // Dropdown visibility

  // Confirmation modals
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showCompliantConfirmModal, setShowCompliantConfirmModal] = useState(false);

  // Get current date and time automatically
  const getCurrentDateTime = () => {
    const now = new Date();
  
    // ✅ LẤY NGÀY THEO GIỜ VIỆT NAM (LOCAL)
    const date = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
    // ✅ GIỜ PHÚT THEO GIỜ VIỆT NAM
    const time = now.toTimeString().slice(0, 5); // HH:MM
  
    return { date, time };
  };
  
  // Ngày compliance (VN)
  const { date: complianceDate } = getCurrentDateTime();
  
  // Giờ compliance (VN)
  const [complianceTime, setComplianceTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  

  // Update time to current time when modal opens and keep it updated
  useEffect(() => {
    if (isOpen) {
      // Set initial time
      const updateTime = () => {
        const now = new Date();
        setComplianceTime(now.toTimeString().slice(0, 5));
      };
      
      updateTime();
      
      // Update time every second to show real-time
      const interval = setInterval(updateTime, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Load department users when modal opens
  useEffect(() => {
    if (isOpen && deptId && deptId > 0) {
      loadDepartmentUsers();
    }
  }, [isOpen, deptId]);

  const loadDepartmentUsers = async () => {
    if (!deptId || deptId <= 0) return;
    
    setLoadingUsers(true);
    try {
      const users = await getAdminUsersByDepartment(deptId);
      // Include both Department Head (AuditeeOwner) and department staff (CAPAOwner) as potential witnesses
      const potentialWitnesses = users.filter(
        (user) => user.roleName === 'AuditeeOwner' || user.roleName === 'CAPAOwner'
      );
      setDepartmentUsers(potentialWitnesses);
      
      // Auto-select witness if there's exactly one eligible user
      if (potentialWitnesses.length === 1 && potentialWitnesses[0].userId) {
        setSelectedWitnesses(potentialWitnesses[0].userId);
      } else if (potentialWitnesses.length > 1 && !selectedWitnesses) {
        // If multiple exist and no selection yet, auto-select the first one
        setSelectedWitnesses(potentialWitnesses[0].userId || '');
      }
    } catch (err: any) {
      console.error('Error loading department users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleWitnessToggle = (userId: string) => {
    // Single selection: if clicking the same user, deselect; otherwise select the new user
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
      
      // Validate file sizes
      const invalidFiles = newFiles.filter(file => file.size > maxSize);
      if (invalidFiles.length > 0) {
        setFileError(`The following files exceed the 10MB limit: ${invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join(', ')}`);
        // Clear the input
        e.target.value = '';
        return;
      }
      
      // Clear file error if valid
      if (fileError) {
        setFileError('');
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Clear file error when removing files
    if (fileError) {
      setFileError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!reason.trim()) {
      alert('Reason Why It Meets Standards is required');
      return;
    }
    
    if (!departmentName?.trim()) {
      alert('Department is required');
      return;
    }
    
    // Validate files - check if there's an error or files exceed limit
    if (fileError) {
      alert('Please fix file upload errors before submitting');
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidCurrentFiles = files.filter(file => file.size > maxSize);
    if (invalidCurrentFiles.length > 0) {
      setFileError(`Some files exceed 10MB limit: ${invalidCurrentFiles.map(f => f.name).join(', ')}`);
      alert('Please remove files that exceed 10MB limit');
      return;
    }
    
    // Show confirmation modal before marking as compliant
    setShowCompliantConfirmModal(true);
  };

  const handleConfirmCompliant = async () => {
    setShowCompliantConfirmModal(false);
    setSubmitting(true);
    
    try {
      // Calculate retentionUntil (30 days from now) - format as YYYY-MM-DD
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + 30);
      const retentionUntil = retentionDate.toISOString().split('T')[0];

      const compliantData = {
        title: checklistItem.questionTextSnapshot,
        reason: reason.trim(),
        dateOfCompliance: complianceDate,
        timeOfCompliance: complianceTime,
        department: departmentName,
        witnessId: selectedWitnesses || '',
        createdBy: currentUserId || '',
      };

   

      // Call API to create compliant record with details
      const response = await markChecklistItemCompliant1(checklistItem.auditItemId, compliantData);

      // Call API to update checklist item status to "Compliant"
      try {
        await markChecklistItemCompliant(checklistItem.auditItemId);
      } catch (statusError: any) {
        // The compliant record was already created successfully
      }

      // Use auditChecklistItemId from response (GUID string) for file upload
      // NOT the numeric 'id'
      const compliantItemId = response?.auditChecklistItemId || checklistItem.auditItemId;
      
      
      // Upload files if any
      if (files.length > 0 && compliantItemId) {
        
        const uploadResults = [];
        for (const file of files) {
          try {
            const result = await uploadAttachment({
              entityType: 'compliant', // EntityType is 'compliant' for compliance items
              entityId: compliantItemId,
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
        
        // Show summary of uploads
        const successCount = uploadResults.filter(r => r.success).length;
        const failCount = uploadResults.filter(r => !r.success).length;
        if (failCount > 0) {
        } else {
        }
      } else if (files.length > 0) {
      }
      
      // Reset form
      setReason('');
      setSelectedWitnesses('');
      const now = new Date();
      setComplianceTime(now.toTimeString().slice(0, 5));
      setFiles([]);
      setFileError('');
      
      // Pass response to onSuccess callback
      onSuccess?.(response);
      onClose();
    } catch (err: any) {
      console.error('Error marking item as compliant:', err);
      console.error('Error details:', {
        message: err?.message,
        response: err?.response,
        data: err?.response?.data,
        status: err?.response?.status,
      });
      
      // Handle validation errors from backend
      const errorData = err?.response?.data;
      if (errorData?.errors && typeof errorData.errors === 'object') {
        const errorMessages: string[] = [];
        Object.keys(errorData.errors).forEach(key => {
          const fieldErrors = errorData.errors[key];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((err: string) => {
              errorMessages.push(err);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(fieldErrors);
          }
        });
        if (errorMessages.length > 0) {
          alert(`Validation Error:\n${errorMessages.join('\n')}`);
        } else {
          alert(`Error: ${err?.message || 'Failed to mark item as compliant'}`);
        }
      } else {
        alert(`Error: ${err?.message || 'Failed to mark item as compliant'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;

    // Check if form has any data
    // Note: complianceTime is always current time (read-only), so we don't check it
    const hasData = reason.trim() !== '' || 
                   selectedWitnesses !== '' || 
                   files.length > 0;

    if (hasData) {
      // Show confirmation modal if form has data
      setShowCancelConfirmModal(true);
    } else {
      // No data, close directly
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    setReason('');
    setSelectedWitnesses('');
    // Time will be updated automatically by useEffect when modal reopens
    setFiles([]);
    setFileError('');
    setShowCancelConfirmModal(false);
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
            <h2 className="text-xl font-semibold text-gray-900">Mark as Compliant</h2>
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
            {/* Title (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item
              </label>
              <input
                type="text"
                value={checklistItem.questionTextSnapshot}
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
                onChange={(e) => {
                  setReason(e.target.value);
                }}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Explain why this item meets the required standards..."
              />
            </div>

            {/* Two-column layout for date/time and auditor */}
            <div className="grid grid-cols-2 gap-4">
              {/* Compliance Date - Read-only, auto-filled */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Compliance <span className="text-red-500">*</span>
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

            {/* Department - Read-only, auto-filled */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={departmentName}
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
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
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
                            onChange={() =>
                              handleWitnessToggle(user.userId || '')
                            }
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

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments (Optional) <span className="text-gray-500 text-xs">(Max 10MB per file)</span>
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
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attached files:</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 16.5a1 1 0 01-2 0v-5.21l-1.793 1.793a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 11.29V16.5z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
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
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Compliant
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal for Cancel */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelCancel}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Cancel
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to cancel? All entered data will be lost.
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

      {/* Confirmation Modal for Marking as Compliant */}
      {showCompliantConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowCompliantConfirmModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Mark as Compliant
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to mark this item as compliant? This action cannot be easily undone.
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompliantConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCompliant}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Yes, Mark as Compliant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompliantModal;
