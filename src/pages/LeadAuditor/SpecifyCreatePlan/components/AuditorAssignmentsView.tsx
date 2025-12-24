import { useState, useEffect } from 'react';
import {
  getAuditPlanAssignmentsByAuditor,
  approveAuditPlanAssignment,
  rejectAuditPlanAssignment,
  getRejectionCount,
} from '../../../../api/auditPlanAssignment';
import { useUserId } from '../../../../store/useAuthStore';
import { getAdminUsers, type AdminUserDto } from '../../../../api/adminUsers';
import { toast } from 'react-toastify';

interface AssignmentFile {
  fileName?: string;
  fileUrl?: string;
  fileId?: string;
  attachmentId?: string;
}

interface AssignmentWithLeadAuditor {
  assignmentId?: string;
  auditorId: number | string;
  assignBy: number | string;
  assignedDate: string;
  remarks?: string;
  status?: string;
  filePaths?: string | string[]; // JSON string or array of file URLs from backend
  files?: AssignmentFile[];
  attachments?: AssignmentFile[];
  leadAuditorName?: string;
  leadAuditorEmail?: string;
}

interface AuditorAssignmentsViewProps {
  // Optional callback: dùng ở màn hình Auditor Planning để set quyền tạo plan ngay sau khi approve
  onPermissionGranted?: () => void;
}

export const AuditorAssignmentsView = ({ onPermissionGranted }: AuditorAssignmentsViewProps) => {
  const userIdFromToken = useUserId();
  const [assignments, setAssignments] = useState<AssignmentWithLeadAuditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setAllUsers] = useState<AdminUserDto[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectFiles, setRejectFiles] = useState<File[]>([]);
  const [rejectionCount, setRejectionCount] = useState<number>(0);
  const [rejections, setRejections] = useState<any[]>([]);
  const [expandedProcessedIds, setExpandedProcessedIds] = useState<Set<string>>(new Set());

  // Filter states - Set default From date to today
  const getTodayDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };
  const [filterStartDate, setFilterStartDate] = useState<string>(getTodayDate());
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Helper: load assignments + users + rejection stats
  const loadData = async () => {
    if (!userIdFromToken) {
      console.warn('[AuditorAssignmentsView] No userIdFromToken available');
      return;
    }

    setLoading(true);
    try {
      const [assignmentsData, usersData, rejectionStats] = await Promise.all([
        getAuditPlanAssignmentsByAuditor(userIdFromToken),
        getAdminUsers(),
        getRejectionCount().catch((err) => {
          console.error('[AuditorAssignmentsView] Failed to load rejection count', err);
          return { rejectionCount: 0, rejections: [] };
        }),
      ]);

      setRejectionCount(rejectionStats.rejectionCount ?? 0);
      setRejections(rejectionStats.rejections || []);
      setAllUsers(usersData || []);

      // Enrich assignments with Lead Auditor info
      const enrichedAssignments: AssignmentWithLeadAuditor[] = (assignmentsData || []).map((assignment) => {
        const leadAuditor = (usersData || []).find((u: AdminUserDto) => {
          const assignByStr = String(assignment.assignBy || '').trim();
          const userIdStr = String(u.userId || '').trim();
          return assignByStr && userIdStr && assignByStr === userIdStr;
        });

       
        return {
          ...assignment,
          leadAuditorName: leadAuditor?.fullName || 'Unknown',
          leadAuditorEmail: leadAuditor?.email || 'N/A',
        };
      });

      enrichedAssignments.sort((a, b) => {
        const dateA = new Date(a.assignedDate || '').getTime();
        const dateB = new Date(b.assignedDate || '').getTime();
        return dateB - dateA;
      });

      setAssignments(enrichedAssignments);
    } catch (error: any) {
      console.error('[AuditorAssignmentsView] Failed to load data:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, [userIdFromToken]);

  // Separate assignments into pending and processed
  const pendingAssignments = assignments.filter((assignment) => {
    const status = String(assignment.status || '').toLowerCase().trim();
    return status !== 'approved' && status !== 'rejected';
  });

  const processedAssignments = assignments.filter((assignment) => {
    const status = String(assignment.status || '').toLowerCase().trim();
    return status === 'approved' || status === 'rejected';
  });

  // Get rejection details for an assignment
  const getRejectionDetails = (assignmentId?: string) => {
    if (!assignmentId) return null;
    return rejections.find((r: any) => {
      const rejectionAssignments = Array.isArray(r.rejections) ? r.rejections : (r.rejections?.$values || []);
      return rejectionAssignments.some((rej: any) => rej.assignmentId === assignmentId);
    });
  };

  // Filter assignments by date
  const filterByDate = (assignmentList: AssignmentWithLeadAuditor[]) => {
    return assignmentList.filter((assignment) => {
      if (!filterStartDate && !filterEndDate) return true;
      const assignedDate = new Date(assignment.assignedDate || '');
      const startDate = filterStartDate ? new Date(filterStartDate) : null;
      const endDate = filterEndDate ? new Date(filterEndDate) : null;
      if (startDate && endDate) return assignedDate >= startDate && assignedDate <= endDate;
      if (startDate) return assignedDate >= startDate;
      if (endDate) return assignedDate <= endDate;
      return true;
    });
  };

  const filteredPendingAssignments = filterByDate(pendingAssignments);
  const filteredProcessedAssignments = filterByDate(processedAssignments);

  const handleDownloadFile = async (file: AssignmentFile) => {
    if (!file.fileUrl) {
      toast.warning('File URL not available');
      return;
    }
    try {
      window.open(file.fileUrl, '_blank');
    } catch (error: any) {
      console.error('[AuditorAssignmentsView] Failed to download file:', error);
      toast.error('Failed to download file');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Use English-friendly format while keeping day-first ordering
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getAllFiles = (assignment: AssignmentWithLeadAuditor): AssignmentFile[] => {
    const files: AssignmentFile[] = [];
    
    // Check files array
    if (assignment.files && Array.isArray(assignment.files)) {
      files.push(...assignment.files);
    }
    
    // Check attachments array
    if (assignment.attachments && Array.isArray(assignment.attachments)) {
      files.push(...assignment.attachments);
    }
    
    // Parse filePaths if it exists (JSON string from backend)
    if (assignment.filePaths) {
      
      // If filePaths is already an array
      if (Array.isArray(assignment.filePaths)) {
        assignment.filePaths.forEach((filePath: string, index: number) => {
          const fileName = typeof filePath === 'string' ? filePath.split('/').pop() || `File ${index + 1}` : `File ${index + 1}`;
          files.push({
            fileUrl: typeof filePath === 'string' ? filePath : '',
            fileName: fileName,
            fileId: `filepath-${index}`,
          });
        });
      }
      // If filePaths is a JSON string
      else if (typeof assignment.filePaths === 'string') {
        try {
          const filePathsArray = JSON.parse(assignment.filePaths);
          if (Array.isArray(filePathsArray)) {
            filePathsArray.forEach((filePath: string, index: number) => {
              // Extract filename from URL or path
              const fileName = filePath.split('/').pop() || `File ${index + 1}`;
              files.push({
                fileUrl: filePath,
                fileName: fileName,
                fileId: `filepath-${index}`,
              });
            });
          }
        } catch (err) {
          console.warn('[AuditorAssignmentsView] Failed to parse filePaths as JSON:', err);
          // If parsing fails, try to use filePaths as a single URL
          if (assignment.filePaths.startsWith('http') || assignment.filePaths.startsWith('/')) {
            const fileName = assignment.filePaths.split('/').pop() || 'File';
            files.push({
              fileUrl: assignment.filePaths,
              fileName: fileName,
              fileId: 'filepath-0',
            });
          }
        }
      }
    }
    
    
    return files;
  };

  const handleApprove = async (assignmentId?: string) => {
    if (!assignmentId) return;
    try {
      setActionLoadingId(assignmentId);
      await approveAuditPlanAssignment(assignmentId);
      toast.success('Assignment approved');

      // Reload assignments so status & permission-related data are up to date
      await loadData();

      // Thông báo cho parent (nếu có) là auditor đã được cấp quyền tạo plan
      if (onPermissionGranted) {
        try {
          onPermissionGranted();
        } catch (err) {
          console.error('[AuditorAssignmentsView] onPermissionGranted callback error', err);
        }
      }
    } catch (error: any) {
      console.error('[AuditorAssignmentsView] Approve failed', error);
      toast.error(error?.response?.data?.message || 'Approve failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetRejectForm = () => {
    setRejectingId(null);
    setRejectReason('');
    setRejectFiles([]);
  };

  const handleReject = async (assignmentId?: string) => {
    if (!assignmentId) return;
    if (!rejectReason.trim()) {
      toast.warning('Please enter the reason for rejecting this assignment');
      return;
    }
    try {
      setActionLoadingId(assignmentId);
      await rejectAuditPlanAssignment(assignmentId, { rejectionReason: rejectReason, files: rejectFiles });
      toast.success('Assignment rejected');
      resetRejectForm();

      // Reload assignments & rejection stats so UI reflects latest status
      await loadData();
    } catch (error: any) {
      console.error('[AuditorAssignmentsView] Reject failed', error);
      toast.error(error?.response?.data?.message || 'Reject failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold">
          {rejectionCount}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Rejection count</p>
          <p className="text-xs text-gray-500">
            Total number of plan assignment requests you have rejected.
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Filter by assignment date
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              min={filterStartDate || undefined}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
        {(filterStartDate !== getTodayDate() || filterEndDate) && (
          <button
            onClick={() => {
              setFilterStartDate(getTodayDate());
              setFilterEndDate('');
            }}
            className="mt-4 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-sm text-gray-600 font-medium">
            Loading assignments...
          </span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Assignments Section */}
          {filteredPendingAssignments.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary-200 to-transparent"></div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pending Assignments ({filteredPendingAssignments.length})
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary-200 to-transparent"></div>
              </div>
              
              {filteredPendingAssignments.map((assignment) => {
                const allFiles = getAllFiles(assignment);
                return (
                  <div
                    key={assignment.assignmentId || `${assignment.auditorId}-${assignment.assignedDate}`}
                    className="bg-white rounded-lg border-2 border-primary-200 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">
                                Assignment Request
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Requires your response
                              </p>
                            </div>
                          </div>
                          <div className="ml-13 space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span><span className="font-medium">Assigned on:</span> {formatDate(assignment.assignedDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span><span className="font-medium">Assigned by:</span> {assignment.leadAuditorName} ({assignment.leadAuditorEmail})</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {assignment.remarks && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-blue-900 mb-1">
                                Notes from Lead Auditor:
                              </p>
                              <p className="text-sm text-blue-800 whitespace-pre-wrap">{assignment.remarks}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* DRL Templates - Show before actions */}
                      {allFiles.length > 0 && (
                        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012 2H7a2 2 0 00-2 2v16a2 2 0 002 2z" />
                            </svg>
                            DRL Templates ({allFiles.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {allFiles.map((file, index) => (
                              <div
                                key={file.fileId || file.attachmentId || index}
                                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {file.fileName || 'Unnamed File'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadFile(file)}
                                  className="ml-3 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleApprove(assignment.assignmentId)}
                          disabled={actionLoadingId === assignment.assignmentId}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-60 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        >
                          {actionLoadingId === assignment.assignmentId ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Approve
                        </button>

                        <button
                          onClick={() => {
                            setRejectingId(assignment.assignmentId || null);
                            setRejectReason('');
                            setRejectFiles([]);
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-amber-800 bg-gradient-to-r from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300 border-2 border-amber-300 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                  </div>

                      {rejectingId === assignment.assignmentId && (
                        <div className="mt-6 border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 space-y-4 shadow-md">
                          <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86L12 5 5.07 19z" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-amber-900 mb-2">
                                Rejection Reason <span className="text-red-600">*</span>
                              </p>
                              <textarea
                                className="w-full rounded-lg border-2 border-amber-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Please provide a detailed reason for rejecting this assignment..."
                              />
                            </div>
                          </div>

                          <div>
                            <label className=" text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              Attachments (Optional)
                            </label>
                            <input
                              type="file"
                              multiple
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : [];
                                setRejectFiles(files);
                              }}
                              className="w-full px-4 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            {rejectFiles.length > 0 && (
                              <p className="mt-2 text-xs text-amber-700">
                                {rejectFiles.length} file(s) selected
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => handleReject(assignment.assignmentId)}
                              disabled={actionLoadingId === assignment.assignmentId || !rejectReason.trim()}
                              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-60 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                            >
                              {actionLoadingId === assignment.assignmentId ? (
                                <>
                                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Confirm Rejection
                                </>
                              )}
                            </button>
                            <button
                              onClick={resetRejectForm}
                              className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // No pending assignments - show history
            filteredProcessedAssignments.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-base font-bold text-blue-900 mb-1">
                        No Pending Assignments
                      </p>
                      <p className="text-sm text-blue-800">
                        {filterStartDate || filterEndDate
                          ? 'There are no pending assignments in the selected date range. Showing assignment history below.'
                          : 'You have no pending assignments. Below is your assignment history.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Assignment History ({filteredProcessedAssignments.length})
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                </div>
              </div>
            ) : (
              // No assignments at all
              <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-50 rounded-full mb-4 shadow-sm">
                  <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-800 font-bold text-xl mb-2">
                  No Assignments Yet
                </p>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  {filterStartDate || filterEndDate
                    ? 'There are no assignments in the selected date range. Try adjusting your filters.'
                    : 'You have not received any plan creation assignments from the Lead Auditor yet.'}
                </p>
              </div>
            )
          )}

          {/* Processed Assignments History */}
          {filteredProcessedAssignments.length > 0 && (
            <div className="space-y-4">
              {filteredPendingAssignments.length > 0 && (
                <div className="flex items-center gap-3 mt-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Assignment History ({filteredProcessedAssignments.length})
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                </div>
              )}
              
              {filteredProcessedAssignments.map((assignment) => {
                const allFiles = getAllFiles(assignment);
                const status = String(assignment.status || '').toLowerCase().trim();
                const isApproved = status === 'approved';
                const isRejected = status === 'rejected';
                const rejectionDetails = getRejectionDetails(assignment.assignmentId);
                const isExpanded = expandedProcessedIds.has(assignment.assignmentId || '');

                // Get latest rejection info
                let latestRejection: any = null;
                if (rejectionDetails) {
                  const rejectionList = Array.isArray(rejectionDetails.rejections) 
                    ? rejectionDetails.rejections 
                    : (rejectionDetails.rejections?.$values || []);
                  latestRejection = rejectionList[0]; // Most recent rejection
                }

                // Count evidence files
                const evidenceCount = latestRejection?.files && Array.isArray(latestRejection.files) 
                  ? latestRejection.files.length 
                  : 0;

                return (
                  <div
                    key={assignment.assignmentId || `${assignment.auditorId}-${assignment.assignedDate}`}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Assignment Header - Clickable */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedProcessedIds);
                        if (isExpanded) {
                          newExpanded.delete(assignment.assignmentId || '');
                        } else {
                          newExpanded.add(assignment.assignmentId || '');
                        }
                        setExpandedProcessedIds(newExpanded);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-900">
                              Assignment #{assignment.assignmentId?.substring(0, 8) || 'N/A'}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                isApproved
                                  ? 'bg-green-100 text-green-800'
                                  : isRejected
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {assignment.status}
                            </span>
                          </div>
                          {assignment.remarks && (
                            <p className="text-xs text-gray-600 mt-1 ml-7">
                              Remarks: {assignment.remarks}
                            </p>
                          )}
                          <div className="mt-2 ml-7 flex items-center gap-4">
                            <span className="text-xs text-gray-500">
                              Assigned on:{' '}
                              <span className="font-medium">{formatDate(assignment.assignedDate)}</span>
                            </span>
                            <span className="text-xs text-gray-500">
                              Assigned by:{' '}
                              <span className="font-medium">{assignment.leadAuditorName}</span>
                            </span>
                            {isRejected && evidenceCount > 0 && (
                              <span className="text-xs text-gray-500">
                                Evidence:{' '}
                                <span className="font-medium text-primary-600">{evidenceCount}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isRejected && evidenceCount > 0 && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              {evidenceCount} file{evidenceCount > 1 ? 's' : ''}
                            </span>
                          )}
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                          {isApproved && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm font-semibold text-green-800">
                                  Approved
                                </p>
                              </div>
                              <p className="text-sm text-green-700">
                                You approved this assignment on {formatDate(assignment.assignedDate)}
                              </p>
                            </div>
                          )}

                          {isRejected && latestRejection && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm font-semibold text-red-800">
                                  Rejected
                                </p>
                              </div>
                              {latestRejection.rejectionReason && (
                                <div className="mb-3">
                                  <p className="text-sm font-medium text-red-700 mb-1">
                                    Rejection reason:
                                  </p>
                                  <p className="text-sm text-red-600 whitespace-pre-wrap">{latestRejection.rejectionReason}</p>
                                </div>
                              )}
                              {latestRejection.rejectedAt && (
                                <p className="text-xs text-red-600">
                                  Rejected on: {formatDate(latestRejection.rejectedAt)}
                                </p>
                              )}
                              {latestRejection.files && Array.isArray(latestRejection.files) && latestRejection.files.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <p className="text-sm font-medium text-red-700 mb-2">
                                    Attached evidence:
                                  </p>
                                  <div className="space-y-2">
                                    {latestRejection.files.map((file: any, index: number) => (
                                      <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-red-200">
                                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-sm text-red-700 flex-1">{file.fileName || `File ${index + 1}`}</span>
                                        {file.fileUrl && (
                                          <button
                                            onClick={() => window.open(file.fileUrl, '_blank')}
                                            className="text-xs text-red-600 hover:text-red-700 underline"
                                          >
                                            Download
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DRL Templates */}
                          {allFiles.length > 0 ? (
                            <div className="pt-4 border-t border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012 2H7a2 2 0 00-2 2v16a2 2 0 002 2z" />
                                </svg>
                                DRL Templates ({allFiles.length})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {allFiles.map((file, index) => (
                                  <div
                                    key={file.fileId || file.attachmentId || index}
                                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {file.fileName || 'Unnamed File'}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDownloadFile(file)}
                                      className="ml-3 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="pt-4 border-t border-gray-200">
                              <p className="text-sm text-gray-500 italic">No files attached</p>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

