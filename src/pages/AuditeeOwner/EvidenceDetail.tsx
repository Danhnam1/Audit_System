import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { getFindingById, type Finding } from '../../api/findings';
import { getActionsByFinding, approveActionWithFeedback, rejectAction, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { toast } from 'react-toastify';

interface ActionWithAttachments extends Action {
  attachments: Attachment[];
  assignedUserName?: string;
}

const EvidenceDetail = () => {
  const { findingId } = useParams<{ findingId: string }>();
  const navigate = useNavigate();

  const [finding, setFinding] = useState<Finding | null>(null);
  const [findingAttachments, setFindingAttachments] = useState<Attachment[]>([]);
  const [actions, setActions] = useState<ActionWithAttachments[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState('');
  const [pendingApproveActionId, setPendingApproveActionId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingRejectActionId, setPendingRejectActionId] = useState<string | null>(null);

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

      // Fetch attachments and user info for each action
      const actionsWithAttachments = await Promise.all(
        actionsData.map(async (action) => {
          try {
            const attachments = await getAttachments('Action', action.actionId);
            let assignedUserName = action.assignedTo;

            // Fetch user name if assignedTo is a valid GUID
            if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              try {
                console.log('[EvidenceDetail] Fetching user info for:', action.assignedTo);
                const user = await getUserById(action.assignedTo);
                console.log('[EvidenceDetail] User data received:', user);
                assignedUserName = user.fullName || user.email || action.assignedTo;
                console.log('[EvidenceDetail] Assigned user name:', assignedUserName);
              } catch (err) {
                console.warn(`Failed to fetch user info for ${action.assignedTo}`, err);
              }
            }

            return { ...action, attachments, assignedUserName };
          } catch (err) {
            console.warn(`Failed to fetch attachments for action ${action.actionId}`, err);
            return { ...action, attachments: [], assignedUserName: action.assignedTo };
          }
        })
      );

      setActions(actionsWithAttachments);
    } catch (err: any) {
      console.error('Failed to fetch data', err);
      toast.error('Unable to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [findingId]);

  const handleApprove = (actionId: string) => {
    setPendingApproveActionId(actionId);
    setFeedbackValue('');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!pendingApproveActionId) return;
    setProcessingActionId(pendingApproveActionId);
    try {
      await approveActionWithFeedback(pendingApproveActionId, feedbackValue);
      toast.success('Action approved successfully!');
      setShowFeedbackModal(false);
      setPendingApproveActionId(null);
      setFeedbackValue('');
      await fetchData();
    } catch (err: any) {
      console.error('Failed to approve action', err);
      toast.error(err?.response?.data?.message || 'Unable to approve action');
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleReject = (actionId: string) => {
    setPendingRejectActionId(actionId);
    setFeedbackValue('');
    setShowRejectModal(true);
  };

  const handleSubmitRejectFeedback = async () => {
    if (!pendingRejectActionId) return;
    setProcessingActionId(pendingRejectActionId);
    try {
      await rejectAction(pendingRejectActionId, feedbackValue);
      toast.success('Action rejected!');
      setShowRejectModal(false);
      setPendingRejectActionId(null);
      setFeedbackValue('');
      await fetchData();
    } catch (err: any) {
      console.error('Failed to reject action', err);
      toast.error(err?.response?.data?.message || 'Unable to reject action');
    } finally {
      setProcessingActionId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      Open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
      Active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
      InProgress: { label: 'In progress', color: 'bg-yellow-100 text-yellow-700' },
      Reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700' },
      Approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
      ApprovedAuditor: { label: 'Approved by auditor', color: 'bg-teal-100 text-teal-700' },
      Rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
      Closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
      Received: { label: 'Received', color: 'bg-indigo-100 text-indigo-700' },
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
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading data...</div>
        </div>
      </MainLayout>
    );
  }

  if (!finding) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Finding not found</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/auditee-owner/review-evidence')}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm sm:text-base w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Finding & Actions Detail</h1>
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
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                📎 Finding Attachments ({findingAttachments.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {findingAttachments.map((file) => (
                  <a
                    key={file.attachmentId}
                    href={file.filePath || file.blobPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
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
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Actions ({actions.length})
            </h2>
          </div>

          {actions.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No actions available</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {actions.map((action) => (
                <div key={action.actionId} className="p-4 sm:p-6">
                  {/* Action Header */}
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{action.title}</h3>
                        {getStatusBadge(action.status)}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3">{action.description}</p>
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
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-1">💬 Review feedback:</p>
                          <p className="text-sm text-gray-600">{action.reviewFeedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {(action.status === 'Reviewed' || action.status === 'InProgress' || action.status === 'Active' || action.status === 'Open') && (
                      <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:ml-4">
                        <button
                          onClick={() => handleApprove(action.actionId)}
                          disabled={processingActionId === action.actionId}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {processingActionId === action.actionId ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(action.actionId)}
                          disabled={processingActionId === action.actionId}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {processingActionId === action.actionId ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    )}
                    {/* Feedback Modal for Approve */}
                    {showFeedbackModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                          <h3 className="text-lg font-semibold mb-4">Enter feedback for approval</h3>
                          <textarea
                            className="w-full border border-gray-300 rounded p-2 mb-4 min-h-[80px]"
                            placeholder="Add feedback (optional)"
                            value={feedbackValue}
                            onChange={e => setFeedbackValue(e.target.value)}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                              onClick={() => { setShowFeedbackModal(false); setPendingApproveActionId(null); }}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                              onClick={handleSubmitFeedback}
                              disabled={processingActionId === pendingApproveActionId}
                              type="button"
                            >
                              {processingActionId === pendingApproveActionId ? 'Processing...' : 'Confirm approval'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback Modal for Reject */}
                    {showRejectModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                          <h3 className="text-lg font-semibold mb-4">Enter rejection reason</h3>
                          <textarea
                            className="w-full border border-gray-300 rounded p-2 mb-4 min-h-[80px]"
                            placeholder="Provide a rejection reason (required)"
                            value={feedbackValue}
                            onChange={e => setFeedbackValue(e.target.value)}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                              onClick={() => { setShowRejectModal(false); setPendingRejectActionId(null); }}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                              onClick={handleSubmitRejectFeedback}
                              disabled={processingActionId === pendingRejectActionId || !feedbackValue.trim()}
                              type="button"
                            >
                              {processingActionId === pendingRejectActionId ? 'Processing...' : 'Confirm rejection'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Feedback Modal */}
                    {showFeedbackModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                          <h3 className="text-lg font-semibold mb-4">Enter feedback for approval</h3>
                          <textarea
                            className="w-full border border-gray-300 rounded p-2 mb-4 min-h-[80px]"
                            placeholder="Add feedback (optional)"
                            value={feedbackValue}
                            onChange={e => setFeedbackValue(e.target.value)}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                              onClick={() => { setShowFeedbackModal(false); setPendingApproveActionId(null); }}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                              onClick={handleSubmitFeedback}
                              disabled={processingActionId === pendingApproveActionId}
                              type="button"
                            >
                              {processingActionId === pendingApproveActionId ? 'Processing...' : 'Confirm approval'}
                            </button>
                          </div>
                        </div>
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
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        📎 Action Evidence ({action.attachments.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {action.attachments.map((file) => (
                          <a
                            key={file.attachmentId}
                            href={file.filePath || file.blobPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
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
    </MainLayout>
  );
};

export default EvidenceDetail;

