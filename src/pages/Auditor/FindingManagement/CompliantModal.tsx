import React, { useState, useEffect } from 'react';
import { markChecklistItemCompliant, markChecklistItemCompliant1 } from '../../../api/checklists';
import { getAdminUsersByDepartment, type AdminUserDto } from '../../../api/adminUsers';
import { uploadAttachment } from '../../../api/attachments';
import { useUserId } from '../../../store/useAuthStore';

interface CompliantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (compliantData?: any) => void;
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
  
  // Get current user ID from auth store
  const currentUserId = useUserId();
  
  // Additional fields
  const [reason, setReason] = useState(''); // Why it meets standards
  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>([]); // Selected witness IDs
  const [departmentUsers, setDepartmentUsers] = useState<AdminUserDto[]>([]); // Users from department
  const [loadingUsers, setLoadingUsers] = useState(false); // Loading state for users
  const [showWitnessesDropdown, setShowWitnessesDropdown] = useState(false); // Dropdown visibility

  // Confirmation modals
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showCompliantConfirmModal, setShowCompliantConfirmModal] = useState(false);

  // Get current date and time automatically
  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 5); // HH:MM
    return { date, time };
  };

  const { date: complianceDate, time: defaultTime } = getCurrentDateTime();
  const [complianceTime, setComplianceTime] = useState(defaultTime);

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
      setDepartmentUsers(users);
      console.log(`Loaded ${users.length} users from department ${deptId}:`, users);
    } catch (err: any) {
      console.error('Error loading department users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleWitnessToggle = (userId: string) => {
    setSelectedWitnesses(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getSelectedWitnessesDisplay = (): string => {
    if (selectedWitnesses.length === 0) return '';
    return selectedWitnesses
      .map(id => departmentUsers.find(u => u.userId === id)?.fullName || '')
      .filter(name => name)
      .join(', ');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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
    
    // Validate file upload is required
    if (files.length === 0) {
      alert('At least one file attachment is required');
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

      // Get current user ID from auth hook (decodes JWT token)
      // currentUserId is a GUID string from JWT, keep it as string

      // Get witness userId (it's a GUID string from departmentUsers)
      const witnessUserId = selectedWitnesses.length > 0 ? selectedWitnesses[0] : '';

      // Create compliant payload for API
      // Backend expects: auditChecklistItemId, title, reason, dateOfCompliance, timeOfCompliance, department, witnessId (GUID string), createdBy (GUID string)
      const compliantData = {
        title: checklistItem.questionTextSnapshot,
        reason: reason.trim(),
        dateOfCompliance: complianceDate,
        timeOfCompliance: complianceTime,
        department: departmentName,
        witnessId: witnessUserId, // First witness's userId (GUID string)
        createdBy: currentUserId || '', // Current user ID as GUID string from JWT token
      };

      console.log('========== MARK COMPLIANT DEBUG ==========');
      console.log('1. Checklist Item:', checklistItem);
      console.log('1a. Checklist Item ALL FIELDS:', Object.keys(checklistItem).reduce((acc: any, key) => {
        acc[key] = (checklistItem as any)[key];
        return acc;
      }, {}));
      console.log('2. Form Data:', {
        reason,
        witnesses: selectedWitnesses,
        witnessesDisplay: getSelectedWitnessesDisplay(),
        department: departmentName,
        complianceDate,
        complianceTime,
        filesCount: files.length,
      });
      console.log('3. Compliant Payload:', JSON.stringify(compliantData, null, 2));

      // Call API to mark item as compliant
      let response;
      try {
        console.log('🔵 About to call markChecklistItemCompliant1 API...');
        response = await markChecklistItemCompliant1(checklistItem.auditItemId, compliantData);
        console.log('✅ markChecklistItemCompliant1 API call succeeded');
        console.log('Response received:', JSON.stringify(response, null, 2));
        console.log('Response type:', typeof response);
        console.log('Response keys:', response ? Object.keys(response) : 'null');
        console.log('Response.id:', response?.id);
        console.log('Response.auditChecklistItemId:', response?.auditChecklistItemId);
      } catch (apiErr: any) {
        console.error('❌ ERROR calling markChecklistItemCompliant1:', apiErr);
        console.error('API Error details:', {
          message: apiErr?.message,
          response: apiErr?.response,
          data: apiErr?.response?.data,
          status: apiErr?.response?.status,
        });
        throw apiErr; // Re-throw to outer catch
      }

      // Use the 'id' field from response for file upload (this is the new identifier)
      const compliantItemId = response?.id || response?.auditChecklistItemId || checklistItem.auditItemId;
      
      console.log('Using compliantItemId for file upload:', compliantItemId, '(id type:', typeof compliantItemId, ')');
      
      // Upload files if any
      if (files.length > 0 && compliantItemId) {
        console.log(`Uploading ${files.length} file(s) with entityId: ${compliantItemId}...`);
        
        const uploadResults = [];
        for (const file of files) {
          try {
            console.log(`Uploading file: ${file.name}...`);
            const result = await uploadAttachment({
              entityType: 'compliant', // EntityType is 'compliant' for compliance items
              entityId: compliantItemId,
              status: 'Compliant',
              retentionUntil: retentionUntil,
              isArchived: false,
              file: file,
            });
            console.log(`✅ File ${file.name} uploaded successfully:`, result);
            uploadResults.push({ file: file.name, success: true });
          } catch (fileError: any) {
            console.error(`❌ Error uploading file ${file.name}:`, fileError);
            console.error('Upload error details:', {
              message: fileError?.message,
              response: fileError?.response,
              data: fileError?.response?.data,
              status: fileError?.response?.status,
            });
            uploadResults.push({ file: file.name, success: false, error: fileError?.message });
          }
        }
        
        // Show summary of uploads
        const successCount = uploadResults.filter(r => r.success).length;
        const failCount = uploadResults.filter(r => !r.success).length;
        if (failCount > 0) {
          console.warn(`⚠️ ${successCount} file(s) uploaded, ${failCount} file(s) failed`);
        } else {
          console.log(`✅ All ${successCount} file(s) uploaded successfully`);
        }
      } else if (files.length > 0) {
        console.warn('⚠️ Cannot upload files: compliantItemId is missing');
      }
      
      // Mark the audit item as compliant (final step)
      console.log('Marking audit item as compliant via PUT endpoint...');
      try {
        await markChecklistItemCompliant(checklistItem.auditItemId);
        console.log('✅ Audit item marked as compliant successfully');
      } catch (markCompliantErr: any) {
        console.error('⚠️ Error marking audit item as compliant:', markCompliantErr);
        // Don't fail - the compliant record was already created
      }
      
      // Reset form
      setReason('');
      setSelectedWitnesses([]);
      setComplianceTime(defaultTime);
      setFiles([]);
      
      // Pass complete API response to parent (includes 'id', 'auditChecklistItemId', and other fields)
      console.log('🟢 [CompliantModal] About to call onSuccess callback with response:', response);
      console.log('🟢 [CompliantModal] response.id:', response?.id);
      console.log('🟢 [CompliantModal] response.auditChecklistItemId:', response?.auditChecklistItemId);
      onSuccess?.(response);
      console.log('🟢 [CompliantModal] onSuccess callback completed');
      onClose();
    } catch (err: any) {
      console.error('❌ Error in handleConfirmCompliant:', err);
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
    const hasData = reason.trim() !== '' || 
                   selectedWitnesses.length > 0 || 
                   complianceTime !== defaultTime ||
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
    setSelectedWitnesses([]);
    setComplianceTime(defaultTime);
    setFiles([]);
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
                  onChange={(e) => setComplianceTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

            {/* Witnesses - Multi-select dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Witnesses
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
                    ) : selectedWitnesses.length === 0 ? (
                      <span className="text-gray-500">Select witnesses from department...</span>
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
                            type="checkbox"
                            checked={selectedWitnesses.includes(user.userId || '')}
                            onChange={() =>
                              handleWitnessToggle(user.userId || '')
                            }
                            className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-2 focus:ring-primary-500"
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
                Attachments <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              
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
                  onClick={() => {
                    handleConfirmCompliant();
                  }}
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
