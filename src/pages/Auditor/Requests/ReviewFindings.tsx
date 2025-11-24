import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { getFindingsByCreator, approveFindingAction, returnFindingAction, type Finding } from '../../../api/findings';
import { getActionsByFinding, type Action } from '../../../api/actions';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { useUserId } from '../../../store/useAuthStore';

interface ActionWithDetails extends Action {
  attachments: Attachment[];
  assignedUserName?: string;
}

interface FindingWithActions extends Finding {
  actions: ActionWithDetails[];
  findingAttachments: Attachment[];
}

const ReviewFindings = () => {
  const userId = useUserId();
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingWithActions[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'returned'>('all');
  const [selectedAction, setSelectedAction] = useState<ActionWithDetails | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'return'>('approve');
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchFindings = async () => {
    console.log('[ReviewFindings] Current userId:', userId);
    
    if (!userId) {
      toast.error('Không tìm thấy thông tin user');
      console.error('[ReviewFindings] userId is missing');
      return;
    }

    setLoading(true);
    try {
      // Get findings created by this auditor
      const findingsData = await getFindingsByCreator(userId);

      // Fetch actions and attachments for each finding
      const findingsWithActions = await Promise.all(
        findingsData.map(async (finding) => {
          try {
            const actions = await getActionsByFinding(finding.findingId);
            console.log(`[ReviewFindings] Finding ${finding.findingId} actions:`, actions);

            // Get finding attachments
            const findingAttachments = await getAttachments('finding', finding.findingId);

            // Fetch user names and attachments for each action
            const actionsWithDetails = await Promise.all(
              actions.map(async (action) => {
                let assignedUserName = action.assignedTo;
                const attachments = await getAttachments('Action', action.actionId).catch(() => []);

                // Fetch user name if GUID
                if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  try {
                    const userInfo = await getUserById(action.assignedTo);
                    assignedUserName = userInfo.fullName || userInfo.email || action.assignedTo;
                  } catch (err) {
                    console.warn('Failed to fetch user', err);
                  }
                }

                return { ...action, attachments, assignedUserName };
              })
            );

            return {
              ...finding,
              actions: actionsWithDetails,
              findingAttachments,
            };
          } catch (err) {
            console.error(`Error fetching finding ${finding.findingId}`, err);
            return {
              ...finding,
              actions: [],
              findingAttachments: [],
            };
          }
        })
      );

      setFindings(findingsWithActions);
    } catch (err: any) {
      console.error('Failed to fetch findings', err);
      toast.error('Không thể tải danh sách findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [userId]);

  const handleViewDetail = (findingId: string) => {
    navigate(`/auditor/review-findings/${findingId}`);
  };

  const handleApproveClick = (action: ActionWithDetails) => {
    setSelectedAction(action);
    setFeedbackType('approve');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const handleReturnClick = (action: ActionWithDetails) => {
    setSelectedAction(action);
    setFeedbackType('return');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAction) return;

    if (feedbackType === 'return' && !feedback.trim()) {
      toast.error('Vui lòng nhập feedback khi trả lại action');
      return;
    }

    setProcessing(true);
    try {
      if (feedbackType === 'approve') {
        await approveFindingAction(selectedAction.actionId, feedback);
        toast.success('Đã phê duyệt action thành công!');
      } else {
        await returnFindingAction(selectedAction.actionId, feedback);
        toast.success('Đã trả lại action để xử lý!');
      }

      setShowFeedbackModal(false);
      setSelectedAction(null);
      setFeedback('');
      await fetchFindings();
    } catch (err: any) {
      console.error('Failed to process action', err);
      toast.error(err?.response?.data?.message || 'Không thể xử lý action');
    } finally {
      setProcessing(false);
    }
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
      'Returned': { label: 'Đã trả lại', color: 'bg-orange-100 text-orange-700' },
      'Closed': { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700' },
    };
    const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Filter findings based on action status
  const filteredFindings = findings.filter(finding => {
    if (filter === 'all') return true;
    return finding.actions.some(action => {
      if (filter === 'pending') return action.status === 'Approved'; // Approved by AuditeeOwner, pending Auditor review
      if (filter === 'approved') return action.status === 'ApprovedAuditor';
      if (filter === 'returned') return action.status === 'Returned';
      return false;
    });
  });

  const stats = {
    pending: findings.filter(f => f.actions.some(a => a.status === 'Approved')).length,
    approved: findings.filter(f => f.actions.some(a => a.status === 'ApprovedAuditor')).length,
    returned: findings.filter(f => f.actions.some(a => a.status === 'Returned')).length,
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Review Findings</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Xem xét và phê duyệt actions từ Auditee</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
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
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Chờ duyệt ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Đã duyệt ({stats.approved})
          </button>
          <button
            onClick={() => setFilter('returned')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'returned' ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Đã trả lại ({stats.returned})
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
            <div className="text-xs sm:text-sm text-gray-600">Đã trả lại</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">{stats.returned}</div>
          </div>
        </div>

        {/* Findings List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">My Findings & Actions</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Đang tải dữ liệu...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Không có dữ liệu</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFindings.map((finding) => (
                <div key={finding.findingId} className="p-3 sm:p-4 lg:p-6 hover:bg-gray-50">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 space-y-3 sm:space-y-4">
                    {/* Finding Info */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{finding.title}</h3>
                        {getStatusBadge(finding.status)}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-2">{finding.description}</p>
                      <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                        <p>Severity: <span className="font-medium">{finding.severity}</span></p>
                        <p>Deadline: <span className="font-medium">{formatDate(finding.deadline || '')}</span></p>
                      </div>
                    </div>

                    {/* Finding Attachments */}
                    {finding.findingAttachments.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                          📎 Finding Attachments ({finding.findingAttachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {finding.findingAttachments.map((file) => (
                            <a
                              key={file.attachmentId}
                              href={file.filePath || file.blobPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-white rounded-lg text-xs sm:text-sm hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-gray-700 truncate max-w-[150px] sm:max-w-none">{file.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {finding.actions.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs sm:text-sm font-semibold text-gray-700">Actions ({finding.actions.length})</p>
                        {finding.actions.map((action) => {
                          console.log('[Action]', action.title, 'Status:', action.status);
                          return (
                          <div key={action.actionId} className="p-3 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{action.title}</span>
                                  {getStatusBadge(action.status)}
                                </div>
                                <p className="text-xs text-gray-600">{action.description}</p>
                                <div className="text-xs text-gray-500 space-y-1">
                                  <p>Assigned: <span className="font-medium text-gray-700">{action.assignedUserName || action.assignedTo}</span></p>
                                  <p>Progress: {action.progressPercent}%</p>
                                  <p>Due: {formatDate(action.dueDate || '')}</p>
                                </div>
                                {action.reviewFeedback && (
                                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                    <p className="font-semibold text-gray-700 mb-1">💬 Feedback:</p>
                                    <p className="text-gray-600">{action.reviewFeedback}</p>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons - Only show for Approved status (waiting for Auditor review) */}
                              {action.status === 'Approved' && (
                                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                                  <button
                                    onClick={() => handleApproveClick(action)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm whitespace-nowrap"
                                  >
                                    ✓ Phê duyệt
                                  </button>
                                  <button
                                    onClick={() => handleReturnClick(action)}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm whitespace-nowrap"
                                  >
                                    ↩ Trả lại
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Action Attachments */}
                            {action.attachments.length > 0 && (
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  📎 Evidence ({action.attachments.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {action.attachments.map((file) => (
                                    <a
                                      key={file.attachmentId}
                                      href={file.filePath || file.blobPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs hover:bg-green-100 transition-colors"
                                    >
                                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span className="text-gray-700 truncate max-w-[100px]">{file.fileName}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                      
                  {/* View Detail Button */}
                  <button
                    onClick={() => handleViewDetail(finding.findingId)}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              {feedbackType === 'approve' ? '✓ Phê duyệt Action' : '↩ Trả lại Action'}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Action: {selectedAction.title}</p>
              <p className="text-xs text-gray-600">{selectedAction.description}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {feedbackType === 'return' ? 'Feedback (Bắt buộc)' : 'Feedback (Tùy chọn)'}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder={feedbackType === 'return' 
                  ? 'Nhập lý do trả lại action...' 
                  : 'Nhập feedback nếu cần...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleSubmitFeedback}
                disabled={processing || (feedbackType === 'return' && !feedback.trim())}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  feedbackType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processing ? 'Đang xử lý...' : feedbackType === 'approve' ? 'Xác nhận phê duyệt' : 'Xác nhận trả lại'}
              </button>
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setSelectedAction(null);
                  setFeedback('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ReviewFindings;
