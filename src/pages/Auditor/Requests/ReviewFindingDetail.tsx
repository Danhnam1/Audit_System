import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { getFindingById, approveFindingAction, returnFindingAction, type Finding } from '../../../api/findings';
import { getActionsByFinding, type Action } from '../../../api/actions';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';

interface ActionWithDetails extends Action {
  attachments: Attachment[];
  assignedUserName?: string;
}

const ReviewFindingDetail = () => {
  const { findingId } = useParams<{ findingId: string }>();
  const navigate = useNavigate();
  
  const [finding, setFinding] = useState<Finding | null>(null);
  const [findingAttachments, setFindingAttachments] = useState<Attachment[]>([]);
  const [actions, setActions] = useState<ActionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionWithDetails | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'return'>('approve');
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    if (!findingId) return;

    setLoading(true);
    try {
      // Fetch finding
      const findingData = await getFindingById(findingId);
      setFinding(findingData);

      // Fetch finding attachments
      const findingAtts = await getAttachments('finding', findingId);
      setFindingAttachments(findingAtts);

      // Fetch actions
      const actionsData = await getActionsByFinding(findingId);

      // Fetch user names and attachments for each action
      const actionsWithDetails = await Promise.all(
        actionsData.map(async (action) => {
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

      setActions(actionsWithDetails);
    } catch (err: any) {
      console.error('Failed to fetch data', err);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [findingId]);

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
      await fetchData();
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Đang tải dữ liệu...</div>
        </div>
      </MainLayout>
    );
  }

  if (!finding) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Không tìm thấy finding</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/auditor/review-findings')}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm sm:text-base w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Chi tiết Finding & Actions</h1>
        </div>

        {/* Finding Details */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{finding.title}</h2>
                {getStatusBadge(finding.status)}
              </div>
              <p className="text-sm sm:text-base text-gray-600 mb-3">{finding.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-500">Severity:</span>
                  <span className="ml-2 font-medium text-gray-900">{finding.severity}</span>
                </div>
                <div>
                  <span className="text-gray-500">Deadline:</span>
                  <span className="ml-2 font-medium text-gray-900">{formatDate(finding.deadline || '')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 font-medium text-gray-900">{formatDate(finding.createdAt)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 font-medium text-gray-900">{finding.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Finding Attachments */}
          {findingAttachments.length > 0 && (
            <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">
                📎 Finding Attachments ({findingAttachments.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {findingAttachments.map((file) => (
                  <a
                    key={file.attachmentId}
                    href={file.filePath || file.blobPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Actions ({actions.length})
            </h2>
          </div>

          {actions.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Không có action nào</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {actions.map((action) => (
                <div key={action.actionId} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{action.title}</h3>
                        {getStatusBadge(action.status)}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">{action.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-500">Progress:</span>
                          <span className="ml-2 font-medium text-gray-900">{action.progressPercent}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Due Date:</span>
                          <span className="ml-2 font-medium text-gray-900">{formatDate(action.dueDate || '')}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 font-medium text-gray-900">{formatDate(action.createdAt || '')}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Assigned To:</span>
                          <span className="ml-2 font-medium text-gray-900">{action.assignedUserName || action.assignedTo}</span>
                        </div>
                      </div>
                      {action.reviewFeedback && (
                        <div className="mt-3 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">💬 Phản hồi đánh giá:</p>
                          <p className="text-xs sm:text-sm text-gray-600">{action.reviewFeedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {action.status === 'Approved' && (
                      <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:ml-4">
                        <button
                          onClick={() => handleApproveClick(action)}
                          disabled={processing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          ✓ Phê duyệt
                        </button>
                        <button
                          onClick={() => handleReturnClick(action)}
                          disabled={processing}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          ↩ Trả lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${action.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Attachments */}
                  {action.attachments.length > 0 && (
                    <div className="mt-4 p-3 sm:p-4 bg-green-50 rounded-lg">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">
                        📎 Action Evidence ({action.attachments.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {action.attachments.map((file) => (
                          <a
                            key={file.attachmentId}
                            href={file.filePath || file.blobPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
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

export default ReviewFindingDetail;
