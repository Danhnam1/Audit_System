import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { getFindingsByDepartment, type Finding } from '../../api/findings';
import { getActionsByFinding, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { useDeptId } from '../../store/useAuthStore';
import { toast } from 'react-toastify';

interface ActionWithUserName extends Action {
  assignedUserName?: string;
}

interface FindingWithDetails extends Finding {
  actions: ActionWithUserName[];
  findingAttachments: Attachment[];
  actionAttachments: Record<string, Attachment[]>; // actionId -> attachments
}

const ReviewEvidence = () => {
  const navigate = useNavigate();
  const deptId = useDeptId();
  const [findings, setFindings] = useState<FindingWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Fetch findings with all related data
  const fetchFindings = async () => {
    if (!deptId) {
      toast.error('Không tìm thấy thông tin phòng ban');
      return;
    }

    setLoading(true);
    try {
      // 1. Get all findings for department
      const findingsData = await getFindingsByDepartment(deptId);

      // 2. For each finding, fetch actions and attachments
      const findingsWithDetails = await Promise.all(
        findingsData.map(async (finding) => {
          try {
            // Get actions for this finding
            const actions = await getActionsByFinding(finding.findingId);
            console.log(`[ReviewEvidence] Finding ${finding.findingId} has ${actions.length} actions:`, actions);
            
            // Fetch user names for actions
            const actionsWithUserNames = await Promise.all(
              actions.map(async (action) => {
                let assignedUserName = action.assignedTo;
                if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  try {
                    console.log('[ReviewEvidence] Fetching user for:', action.assignedTo);
                    const user = await getUserById(action.assignedTo);
                    console.log('[ReviewEvidence] User data:', user);
                    assignedUserName = user.fullName || user.email || action.assignedTo;
                    console.log('[ReviewEvidence] User name:', assignedUserName);
                  } catch (err) {
                    console.warn(`Failed to fetch user info for ${action.assignedTo}`, err);
                  }
                }
                return { ...action, assignedUserName };
              })
            );

            // Get finding attachments
            const findingAttachments = await getAttachments('finding', finding.findingId);

            // Get attachments for each action
            const actionAttachments: Record<string, Attachment[]> = {};
            for (const action of actionsWithUserNames) {
              try {
                const attachments = await getAttachments('Action', action.actionId);
                actionAttachments[action.actionId] = attachments;
              } catch (err) {
                console.warn(`Failed to fetch attachments for action ${action.actionId}`, err);
                actionAttachments[action.actionId] = [];
              }
            }

            return {
              ...finding,
              actions: actionsWithUserNames,
              findingAttachments,
              actionAttachments,
            };
          } catch (err) {
            console.error(`Error fetching details for finding ${finding.findingId}`, err);
            return {
              ...finding,
              actions: [],
              findingAttachments: [],
              actionAttachments: {},
            };
          }
        })
      );

      setFindings(findingsWithDetails);
      console.log('[ReviewEvidence] Total findings loaded:', findingsWithDetails.length);
      console.log('[ReviewEvidence] Findings with actions:', findingsWithDetails.filter(f => f.actions.length > 0).length);
    } catch (err: any) {
      console.error('Failed to fetch findings', err);
      toast.error('Không thể tải danh sách findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [deptId]);

  // Refresh when component becomes visible (e.g., when navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && deptId) {
        console.log('[ReviewEvidence] Page became visible, refreshing...');
        fetchFindings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [deptId]);

  const handleViewDetail = (findingId: string) => {
    navigate(`/auditee-owner/evidence-detail/${findingId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'Open': { label: 'Mở', color: 'bg-blue-100 text-blue-700' },
      'Active': { label: 'Hoạt động', color: 'bg-blue-100 text-blue-700' },
      'InProgress': { label: 'Đang xử lý', color: 'bg-yellow-100 text-yellow-700' },
      'Reviewed': { label: 'Đã xem xét', color: 'bg-purple-100 text-purple-700' },
      'Approved': { label: 'Đã duyệt', color: 'bg-green-100 text-green-700' },
      'ApprovedAuditor': { label: 'Auditor đã duyệt', color: 'bg-teal-100 text-teal-700' },
      'Rejected': { label: 'Đã từ chối', color: 'bg-red-100 text-red-700' },
      'Closed': { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700' },
      'Received': { label: 'Đã nhận', color: 'bg-indigo-100 text-indigo-700' },
    };
    const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter findings based on action status
  const filteredFindings = findings.filter(finding => {
    if (filter === 'all') return true;
    // Check if any action has the matching status
    return finding.actions.some(action => {
      if (filter === 'pending') return action.status === 'InProgress' || action.status === 'Reviewed';
      if (filter === 'approved') return action.status === 'Approved' || action.status === 'ApprovedAuditor';
      if (filter === 'rejected') return action.status === 'Rejected';
      return false;
    });
  });

  const stats = {
    pending: findings.filter(f => f.actions.some(a => a.status === 'InProgress' || a.status === 'Reviewed')).length,
    approved: findings.filter(f => f.actions.some(a => a.status === 'Approved' || a.status === 'ApprovedAuditor')).length,
    rejected: findings.filter(f => f.actions.some(a => a.status === 'Rejected')).length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Review evidence </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Xem xét và phê duyệt minh chứng từ nhân viên</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Tất cả ({findings.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Chờ duyệt ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Đã duyệt ({stats.approved})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Đã từ chối ({stats.rejected})
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-600">Chờ duyệt</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-600">Đã duyệt</div>
            <div className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{stats.approved}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-600">Đã từ chối</div>
            <div className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{stats.rejected}</div>
          </div>
        </div>

        {/* Evidence List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách Findings & Actions</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center text-gray-600">Đang tải dữ liệu...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Không có dữ liệu</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFindings.map((finding) => (
                <div key={finding.findingId} className="p-3 sm:p-4 lg:p-6 hover:bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      {/* Finding Info */}
                      <div className="mb-3 sm:mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <span className="text-base sm:text-lg font-semibold text-gray-900">
                            Finding: {finding.title}
                          </span>
                          {getStatusBadge(finding.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                        <div className="text-sm text-gray-500">
                          <p>Severity: <span className="font-medium">{finding.severity}</span></p>
                          <p>Deadline: <span className="font-medium">{formatDate(finding.deadline || '')}</span></p>
                          <p>Created: {formatDate(finding.createdAt)}</p>
                        </div>
                      </div>

                      {/* Finding Attachments */}
                      {finding.findingAttachments.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            📎 Finding Attachments ({finding.findingAttachments.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {finding.findingAttachments.map((file) => (
                              <a
                                key={file.attachmentId}
                                href={file.filePath || file.blobPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm hover:bg-blue-100 transition-colors"
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-gray-700">{file.fileName}</span>
                                <span className="text-gray-500 text-xs">({formatFileSize(file.fileSize)})</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {finding.actions.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Actions ({finding.actions.length}):</p>
                          {finding.actions.map((action) => (
                            <div key={action.actionId} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-900">{action.title}</span>
                                    {getStatusBadge(action.status)}
                                  </div>
                                  <p className="text-xs text-gray-600">{action.description}</p>
                                  <div className="text-xs text-gray-500 mt-1">
                                    <p>Assigned To: <span className="font-medium text-gray-700">{action.assignedUserName || action.assignedTo}</span></p>
                                    <p>Progress: {action.progressPercent}%</p>
                                    <p>Due: {formatDate(action.dueDate || '')}</p>
                                    <p className="text-gray-400">Status: {action.status}</p>
                                  </div>
                                  {action.reviewFeedback && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                      <p className="font-semibold text-gray-700 mb-1">💬 Phản hồi đánh giá:</p>
                                      <p className="text-gray-600">{action.reviewFeedback}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Attachments */}
                              {finding.actionAttachments[action.actionId]?.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-gray-700 mb-1">
                                    📎 Action Evidence ({finding.actionAttachments[action.actionId].length}):
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {finding.actionAttachments[action.actionId].map((file) => (
                                      <a
                                        key={file.attachmentId}
                                        href={file.filePath || file.blobPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs hover:bg-gray-100 transition-colors"
                                      >
                                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-gray-700">{file.fileName}</span>
                                        <span className="text-gray-500">({formatFileSize(file.fileSize)})</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-gray-500 italic">Không có action nào</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleViewDetail(finding.findingId)}
                      className="w-full sm:w-auto sm:ml-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ReviewEvidence;

