import { useState, useEffect } from 'react';
import { getAuditPlanAssignmentsByAuditor } from '../../../api/auditPlanAssignment';
import { useUserId } from '../../../store/useAuthStore';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
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
  files?: AssignmentFile[];
  attachments?: AssignmentFile[];
  leadAuditorName?: string;
  leadAuditorEmail?: string;
}

export const AuditorAssignmentsView = () => {
  const userIdFromToken = useUserId();
  const [assignments, setAssignments] = useState<AssignmentWithLeadAuditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<AdminUserDto[]>([]);
  
  // Filter states
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Load assignments and users
  useEffect(() => {
    const loadData = async () => {
      if (!userIdFromToken) {
        console.warn('[AuditorAssignmentsView] No userIdFromToken available');
        return;
      }

      setLoading(true);
      try {
        const [assignmentsData, usersData] = await Promise.all([
          getAuditPlanAssignmentsByAuditor(userIdFromToken),
          getAdminUsers(),
        ]);

        setAllUsers(usersData || []);

        // Enrich assignments with Lead Auditor info
        const enrichedAssignments: AssignmentWithLeadAuditor[] = (assignmentsData || []).map((assignment) => {
          // Find Lead Auditor by assignBy (userId)
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

        // Sort by assignedDate descending (newest first)
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

    loadData();
  }, [userIdFromToken]);

  // Filter assignments by date range
  const filteredAssignments = assignments.filter((assignment) => {
    if (!filterStartDate && !filterEndDate) {
      return true; // No filter
    }

    const assignedDate = new Date(assignment.assignedDate || '');
    const startDate = filterStartDate ? new Date(filterStartDate) : null;
    const endDate = filterEndDate ? new Date(filterEndDate) : null;

    if (startDate && endDate) {
      return assignedDate >= startDate && assignedDate <= endDate;
    } else if (startDate) {
      return assignedDate >= startDate;
    } else if (endDate) {
      return assignedDate <= endDate;
    }

    return true;
  });

  // Handle file download
  const handleDownloadFile = async (file: AssignmentFile) => {
    if (!file.fileUrl) {
      toast.warning('File URL not available');
      return;
    }

    try {
      // Open file in new tab or download
      window.open(file.fileUrl, '_blank');
    } catch (error: any) {
      console.error('[AuditorAssignmentsView] Failed to download file:', error);
      toast.error('Failed to download file');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
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

  // Get all files from assignment (files + attachments)
  const getAllFiles = (assignment: AssignmentWithLeadAuditor): AssignmentFile[] => {
    const files: AssignmentFile[] = [];
    if (assignment.files && Array.isArray(assignment.files)) {
      files.push(...assignment.files);
    }
    if (assignment.attachments && Array.isArray(assignment.attachments)) {
      files.push(...assignment.attachments);
    }
    return files;
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Lọc theo thời gian gửi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Từ ngày
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
              Đến ngày
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
        {(filterStartDate || filterEndDate) && (
          <button
            onClick={() => {
              setFilterStartDate('');
              setFilterEndDate('');
            }}
            className="mt-4 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-sm text-gray-600 font-medium">Đang tải assignments...</span>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium text-lg mb-2">Chưa có assignment nào</p>
          <p className="text-gray-500 text-sm">
            {filterStartDate || filterEndDate
              ? 'Không có assignment nào trong khoảng thời gian đã chọn.'
              : 'Bạn chưa nhận được assignment nào từ Lead Auditor.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const allFiles = getAllFiles(assignment);
            return (
              <div
                key={assignment.assignmentId || `${assignment.auditorId}-${assignment.assignedDate}`}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Assignment #{assignment.assignmentId?.substring(0, 8) || 'N/A'}
                        </h3>
                        {assignment.status && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            assignment.status.toLowerCase() === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {assignment.status}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Ngày gửi:</span>{' '}
                          {formatDate(assignment.assignedDate)}
                        </p>
                        <p>
                          <span className="font-medium">Gửi bởi:</span>{' '}
                          {assignment.leadAuditorName} ({assignment.leadAuditorEmail})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  {assignment.remarks && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Ghi chú:</p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.remarks}</p>
                    </div>
                  )}

                  {/* Files Section */}
                  {allFiles.length > 0 ? (
                    <div className="mt-4 pt-4 border-t border-gray-200">
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
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500 italic">Không có file đính kèm</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

