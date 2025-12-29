import { useState, useEffect } from 'react';
import { createFinding } from '../../../api/findings';
import { getFindingSeverities } from '../../../api/findingSeverity';
import { uploadAttachment } from '../../../api/attachments';
import { markChecklistItemNonCompliant } from '../../../api/checklists';
import { getAuditScheduleByAudit } from '../../../api/auditSchedule';
import { getAdminUsersByDepartment, type AdminUserDto } from '../../../api/adminUsers';
import { unwrap } from '../../../utils/normalize';

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
  departmentName?: string; // Department name
}

const CreateFindingModal = ({
  isOpen,
  onClose,
  onSuccess,
  checklistItem,
  deptId,
  departmentName = '',
}: CreateFindingModalProps) => {
  const [severities, setSeverities] = useState<Array<{ severity: string }>>([]);
  const [loadingSeverities, setLoadingSeverities] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  
  // Schedule data
  const [fieldworkStartDate, setFieldworkStartDate] = useState<Date | null>(null);
  const [evidenceDueDate, setEvidenceDueDate] = useState<Date | null>(null);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [witnesses, setWitnesses] = useState<string>(''); // Single witness selection
  
  // Department users for witnesses dropdown
  const [departmentUsers, setDepartmentUsers] = useState<AdminUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showWitnessesDropdown, setShowWitnessesDropdown] = useState(false);

  
 // Additional fields (Giờ Việt Nam)
const [findingDate] = useState(() => {
  const now = new Date();
  return now.toLocaleDateString('en-CA'); // YYYY-MM-DD (VN)
});

const [findingTime, setFindingTime] = useState(() => {
  const now = new Date();
  return now.toTimeString().slice(0, 5); // HH:MM (VN)
});




  // Update time to current time when modal opens and keep it updated
  useEffect(() => {
    if (isOpen) {
      // Set initial time
      const updateTime = () => {
        const now = new Date();
        setFindingTime(now.toTimeString().slice(0, 5));
      };
      
      updateTime();
      
      // Update time every second to show real-time
      const interval = setInterval(updateTime, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  
  // Errors
  const [errors, setErrors] = useState<{
    description?: string;
    severity?: string;
    deadline?: string;
    files?: string;
  }>({});

  // Confirmation modals
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);

  // Get current date and time automatically
  useEffect(() => {
    if (isOpen) {
      loadSeverities();
      loadSchedule();
      loadDepartmentUsers();
    }
  }, [isOpen]);

  const loadDepartmentUsers = async () => {
    if (!deptId || deptId <= 0) return;
    
    setLoadingUsers(true);
    try {
      const users = await getAdminUsersByDepartment(deptId);
      // Filter users to only show AuditeeOwner role
      const auditeeOwners = users.filter(user => user.roleName === 'AuditeeOwner');
      setDepartmentUsers(auditeeOwners);
      
      // Auto-select witness if there's exactly one AuditeeOwner
      if (auditeeOwners.length === 1 && auditeeOwners[0].userId) {
        setWitnesses(auditeeOwners[0].userId);
      } else if (auditeeOwners.length > 1 && !witnesses) {
        // If multiple AuditeeOwners exist and no selection yet, auto-select the first one
        setWitnesses(auditeeOwners[0].userId || '');
      }
    } catch (err: any) {
      console.error('Error loading department users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load audit schedule
  const loadSchedule = async () => {
    if (!checklistItem.auditId) return;
    
    setLoadingSchedule(true);
    try {
      const scheduleResponse = await getAuditScheduleByAudit(checklistItem.auditId);
      const schedulesArray = unwrap(scheduleResponse);
      
      // Find "Fieldwork Start" and "Evidence Due" milestones
      const fieldworkStart = schedulesArray.find((s: any) => 
        s.milestoneName?.toLowerCase().includes('fieldwork start')
      );
      const evidenceDue = schedulesArray.find((s: any) => 
        s.milestoneName?.toLowerCase().includes('evidence due')
      );
      
      if (fieldworkStart?.dueDate) {
        setFieldworkStartDate(new Date(fieldworkStart.dueDate));
      }
      if (evidenceDue?.dueDate) {
        setEvidenceDueDate(new Date(evidenceDue.dueDate));
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Calculate deadline based on severity
  const calculateDeadline = (selectedSeverity: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let daysToAdd = 0;
    const severityLower = selectedSeverity.toLowerCase();
    
    if (severityLower === 'major') {
      daysToAdd = 14;
    } else if (severityLower === 'minor') {
      daysToAdd = 30;
    } else if (severityLower === 'observation') {
      daysToAdd = 60;
    }
    
    if (daysToAdd === 0) return '';
    
    const calculatedDate = new Date(today);
    calculatedDate.setDate(calculatedDate.getDate() + daysToAdd);
    
    // Ensure deadline is within Fieldwork Start and (Evidence Due - 1 day) range
    let finalDate = calculatedDate;
    
    if (fieldworkStartDate && finalDate < fieldworkStartDate) {
      finalDate = new Date(fieldworkStartDate);
    }
    
    if (evidenceDueDate) {
      // Max deadline is 1 day before Evidence Due date
      const maxDeadline = new Date(evidenceDueDate);
      maxDeadline.setDate(maxDeadline.getDate() - 1);
      if (finalDate > maxDeadline) {
        finalDate = new Date(maxDeadline);
      }
    }
    
    return finalDate.toISOString().split('T')[0];
  };

  // Update deadline when severity changes
  useEffect(() => {
    if (severity && fieldworkStartDate && evidenceDueDate) {
      const calculatedDeadline = calculateDeadline(severity);
      if (calculatedDeadline) {
        setDeadline(calculatedDeadline);
        if (errors.deadline) {
          setErrors(prev => ({ ...prev, deadline: undefined }));
        }
      }
    }
  }, [severity, fieldworkStartDate, evidenceDueDate]);

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

  const handleWitnessToggle = (userId: string) => {
    // Single selection: if clicking the same user, deselect; otherwise select the new user
    setWitnesses(prev => prev === userId ? '' : userId);
  };

  const getSelectedWitnessesDisplay = (): string => {
    if (!witnesses) return '';
    return departmentUsers.find(u => u.userId === witnesses)?.fullName || '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      
      // Validate file sizes
      const invalidFiles = newFiles.filter(file => file.size > maxSize);
      if (invalidFiles.length > 0) {
        setErrors(prev => ({
          ...prev,
          files: `The following files exceed the 10MB limit: ${invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join(', ')}`
        }));
        // Clear the input
        e.target.value = '';
        return;
      }
      
      // Clear file error if valid
      if (errors.files) {
        setErrors(prev => ({ ...prev, files: undefined }));
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Clear file error when removing files
    if (errors.files) {
      setErrors(prev => ({ ...prev, files: undefined }));
    }
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
      } else if (fieldworkStartDate && deadlineDate < fieldworkStartDate) {
        newErrors.deadline = `Deadline must be on or after Fieldwork Start date (${fieldworkStartDate.toISOString().split('T')[0]})`;
      } else if (evidenceDueDate) {
        // Deadline must be at least 1 day before Evidence Due date
        const maxDeadlineDate = new Date(evidenceDueDate);
        maxDeadlineDate.setDate(maxDeadlineDate.getDate() - 1);
        maxDeadlineDate.setHours(0, 0, 0, 0);
        
        if (deadlineDate > maxDeadlineDate) {
          const maxDeadlineStr = maxDeadlineDate.toISOString().split('T')[0];
          newErrors.deadline = `Deadline must be on or before ${maxDeadlineStr} `;
        }
      }
    }
    
   
    
    // Validate files - check if at least one file is uploaded
    if (files.length === 0) {
      newErrors.files = 'At least one attachment is required';
    } else if (errors.files) {
      // Check if there's an existing file error
      newErrors.files = errors.files;
    } else {
      // Additional validation: check each file in current files array
      const maxSize = 10 * 1024 * 1024; // 10MB
      const invalidCurrentFiles = files.filter(file => file.size > maxSize);
      if (invalidCurrentFiles.length > 0) {
        newErrors.files = `Some files exceed 10MB limit: ${invalidCurrentFiles.map(f => f.name).join(', ')}`;
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

    // Show confirmation modal before creating
    setShowCreateConfirmModal(true);
  };

  const handleConfirmCreate = async () => {
    setShowCreateConfirmModal(false);
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
        witnessId: witnesses || '', // Single witness's userId (GUID string)
      };

      // Create finding
      const finding = await createFinding(findingPayload);
      
      const findingId = finding.findingId || (finding as any).$id || (finding as any).id;
      
      if (!findingId) {
        throw new Error('Finding ID not found in response');
      }

      // Upload files if any
      if (files.length > 0) {
        
        const uploadResults = [];
        for (const file of files) {
          try {
            await uploadAttachment({
              entityType: 'finding', // lowercase as per API example
              entityId: findingId,
              status: 'Open', // Status is required by backend, use 'Open' as default
              retentionUntil: retentionUntil, // Format: YYYY-MM-DD
              isArchived: false,
              file: file,
            });
            uploadResults.push({ file: file.name, success: true });
          } catch (fileError: any) {
          
            uploadResults.push({ file: file.name, success: false, error: fileError?.message });
            // Continue with other files even if one fails
          }
        }
        
        // Show summary of uploads
        // const successCount = uploadResults.filter(r => r.success).length; // Unused
        const failCount = uploadResults.filter(r => !r.success).length;
        if (failCount > 0) {
        } else {
        }
      }

      // Mark checklist item as non-compliant
      try {
        await markChecklistItemNonCompliant(checklistItem.auditItemId);
      } catch (markError: any) {
        // Don't throw error, just log it - finding was created successfully
      }

      // Reset form
      setDescription('');
      setSeverity('');
      setDeadline('');
      setFiles([]);
      setErrors({});
      setWitnesses('');
      setFieldworkStartDate(null);
      setEvidenceDueDate(null);
      
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
    if (submitting) return;

    // Check if form has any data
    const hasData = description.trim() !== '' ||
                   severity !== '' ||
                   deadline !== '' ||
                   witnesses !== '' ||
                   files.length > 0;

    if (hasData) {
      // Show confirmation modal if form has data
      setShowCancelConfirmModal(true);
    } else {
      // No data, close directly
      setDescription('');
      setSeverity('');
      setDeadline('');
      setFiles([]);
      setErrors({});
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    setDescription('');
    setSeverity('');
    setDeadline('');
    setFiles([]);
    setErrors({});
    setWitnesses('');
    setFieldworkStartDate(null);
    setEvidenceDueDate(null);
    setShowCancelConfirmModal(false);
    onClose();
  };

  const handleCancelCancel = () => {
    setShowCancelConfirmModal(false);
  };

  if (!isOpen) return null;
  
  // Calculate min and max dates for deadline input
  const minDate = fieldworkStartDate 
    ? Math.max(fieldworkStartDate.getTime(), new Date().getTime()) 
    : new Date().getTime();
  // Max date is 1 day before Evidence Due date
  const maxDate = evidenceDueDate ? (() => {
    const maxDeadline = new Date(evidenceDueDate);
    maxDeadline.setDate(maxDeadline.getDate() - 1);
    return maxDeadline.getTime();
  })() : undefined;
  
  const minDateStr = new Date(minDate).toISOString().split('T')[0];
  const maxDateStr = maxDate ? new Date(maxDate).toISOString().split('T')[0] : undefined;

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
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Severity <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <svg 
                    className="w-4 h-4 text-gray-400 cursor-help" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold text-amber-300">Major:</span>
                        <span className="ml-1">High severity, requires immediate action</span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-300">Minor:</span>
                        <span className="ml-1">Medium severity, requires improvement</span>
                      </div>
                    </div>
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
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
              {loadingSchedule ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-sm text-gray-500">Loading schedule...</span>
                </div>
              ) : (
                <>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(e.target.value);
                      if (errors.deadline) setErrors(prev => ({ ...prev, deadline: undefined }));
                    }}
                    min={minDateStr}
                    max={maxDateStr}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.deadline ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.deadline && (
                    <p className="mt-1 text-sm text-red-600">{errors.deadline}</p>
                  )}
                  {fieldworkStartDate && evidenceDueDate && (() => {
                    const maxDeadline = new Date(evidenceDueDate);
                    maxDeadline.setDate(maxDeadline.getDate() - 1);
                    const maxDeadlineStr = maxDeadline.toISOString().split('T')[0];
                    return (
                      <p className="mt-1 text-xs text-gray-500">
                        Deadline must be between {fieldworkStartDate.toISOString().split('T')[0]} (Fieldwork Start) and {maxDeadlineStr} 
                      </p>
                    );
                  })()}
                </>
              )}
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
                    ) : !witnesses ? (
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
                            checked={witnesses === user.userId}
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

        

            {/* Two-column layout for date/time */}
            <div className="grid grid-cols-2 gap-4">
              {/* Finding Date - Read-only, auto-filled */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Finding <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={findingDate}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* Finding Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time of Finding
                </label>
                <input
                  type="time"
                  value={findingTime}
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

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(Max 10MB per file)</span>
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.files ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.files && (
                <p className="mt-1 text-sm text-red-600">{errors.files}</p>
              )}
              
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

      {/* Confirmation Modal for Create */}
      {showCreateConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowCreateConfirmModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Create Finding
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to create this finding? The checklist item will be marked as non-compliant.
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCreate}
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Yes, Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateFindingModal;

