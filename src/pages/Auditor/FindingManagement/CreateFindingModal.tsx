import { useState, useEffect } from 'react';
import { createFinding } from '../../../api/findings';
import { getFindingSeverities } from '../../../api/findingSeverity';
import { uploadAttachment } from '../../../api/attachments';
import useAuthStore from '../../../store/useAuthStore';

interface CreateFindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  checklistItem: {
    auditItemId: string;
    auditId: string;
    questionTextSnapshot: string;
  };
  deptId: number;
}

const CreateFindingModal = ({
  isOpen,
  onClose,
  onSuccess,
  checklistItem,
  deptId,
}: CreateFindingModalProps) => {
  const { user } = useAuthStore();
  const [severities, setSeverities] = useState<Array<{ severity: string }>>([]);
  const [loadingSeverities, setLoadingSeverities] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  // Errors
  const [errors, setErrors] = useState<{
    description?: string;
    severity?: string;
    deadline?: string;
    files?: string;
  }>({});

  // Load severities on mount
  useEffect(() => {
    if (isOpen) {
      loadSeverities();
    }
  }, [isOpen]);

  const loadSeverities = async () => {
    setLoadingSeverities(true);
    try {
      const data = await getFindingSeverities();
      setSeverities(data.map(item => ({ severity: item.severity || item.name || '' })));
    } catch (err) {
      console.error('Error loading severities:', err);
    } finally {
      setLoadingSeverities(false);
    }
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

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!severity) {
      newErrors.severity = 'Severity is required';
    }
    
    if (!deadline) {
      newErrors.deadline = 'Deadline is required';
    } else {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (deadlineDate < today) {
        newErrors.deadline = 'Deadline cannot be before today';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    
    try {
      // Calculate retentionUntil (30 days from now) - format as YYYY-MM-DD
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + 30);
      const retentionUntil = retentionDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

      // Create finding payload
      // Based on working example: rootCauseId and reviewerId can be null
      const findingPayload = {
        auditId: checklistItem.auditId,
        auditItemId: checklistItem.auditItemId,
        title: `Non-compliance: ${checklistItem.questionTextSnapshot}`,
        description: description.trim(),
        severity: severity,
        rootCauseId: null, // null is accepted by backend
        deptId: deptId,
        status: 'Open',
        deadline: new Date(deadline).toISOString(),
        reviewerId: null, // null is accepted by backend
        source: '', // Empty string
        externalAuditorName: '', // Empty string
      };

      console.log('========== CREATE FINDING DEBUG ==========');
      console.log('1. Checklist Item:', checklistItem);
      console.log('2. Form Data:', { description, severity, deadline, filesCount: files.length });
      console.log('3. Finding Payload (camelCase):', JSON.stringify(findingPayload, null, 2));
      
      // Create finding
      const finding = await createFinding(findingPayload);
      console.log('Finding created:', finding);
      
      const findingId = finding.findingId || finding.$id || finding.id;
      
      if (!findingId) {
        throw new Error('Finding ID not found in response');
      }

      // Upload files if any
      if (files.length > 0) {
        console.log(`Uploading ${files.length} file(s)...`);
        
        const uploadResults = [];
        for (const file of files) {
          try {
            console.log(`Uploading file: ${file.name}...`);
            const result =             await uploadAttachment({
              entityType: 'finding', // lowercase as per API example
              entityId: findingId,
              status: 'Open', // Status is required by backend, use 'Open' as default
              retentionUntil: retentionUntil, // Format: YYYY-MM-DD
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
            // Continue with other files even if one fails
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
      }

      // Reset form
      setDescription('');
      setSeverity('');
      setDeadline('');
      setFiles([]);
      setErrors({});
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error creating finding:', err);
      console.error('Error details:', {
        message: err?.message,
        response: err?.response,
        data: err?.response?.data,
        status: err?.response?.status,
      });
      
      // Show more detailed error message
      const errorMessage = err?.message || 'Failed to create finding. Please check console for details.';
      
      // Show error in a more readable format
      alert(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setDescription('');
      setSeverity('');
      setDeadline('');
      setFiles([]);
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

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
            <h2 className="text-xl font-semibold text-gray-900">Create Finding</h2>
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
                Title
              </label>
              <input
                type="text"
                value={`Non-compliance: ${checklistItem.questionTextSnapshot}`}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
                }}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter finding description..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity <span className="text-red-500">*</span>
              </label>
              {loadingSeverities ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-sm text-gray-500">Loading severities...</span>
                </div>
              ) : (
                <select
                  value={severity}
                  onChange={(e) => {
                    setSeverity(e.target.value);
                    if (errors.severity) setErrors(prev => ({ ...prev, severity: undefined }));
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.severity ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select severity</option>
                  {severities.map((sev, index) => (
                    <option key={index} value={sev.severity}>
                      {sev.severity}
                    </option>
                  ))}
                </select>
              )}
              {errors.severity && (
                <p className="mt-1 text-sm text-red-600">{errors.severity}</p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  if (errors.deadline) setErrors(prev => ({ ...prev, deadline: undefined }));
                }}
                min={today}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.deadline ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.deadline && (
                <p className="mt-1 text-sm text-red-600">{errors.deadline}</p>
              )}
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments (Optional)
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              
              {/* File List */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
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
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create Finding'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateFindingModal;

