import { useState, useMemo } from 'react';
import { DataTable, type TableColumn } from '../../../../components/DataTable';
import { approveFindingActionHigherLevel, rejectFindingActionHigherLevel } from '../../../../api/findings';
import { getActionsByFinding, updateActionProgressPercent, type Action } from '../../../../api/actions';
import { getAttachments, updateAttachmentStatus } from '../../../../api/attachments';
import { toast } from 'react-toastify';
import type { Finding } from '../../../../api/findings';

interface FindingsTabProps {
  findings: Finding[];
  loading: boolean;
}

const FindingsTab: React.FC<FindingsTabProps> = ({ findings, loading }) => {
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedFindingActions, setSelectedFindingActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'reject'>('approve');
  const [feedbackText, setFeedbackText] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };



  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower.includes('high') || severityLower.includes('critical')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (severityLower.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    if (severityLower.includes('low') || severityLower.includes('minor')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'open' || statusLower === 'pending') {
      return 'bg-blue-100 text-blue-800';
    }
    if (statusLower === 'closed' || statusLower === 'resolved') {
      return 'bg-gray-100 text-gray-800';
    }
    if (statusLower === 'in progress' || statusLower === 'in-progress') {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const handleViewFindingDetail = async (finding: Finding) => {
    setSelectedFinding(finding);
    setShowActionsModal(true);
    setLoadingActions(true);
    setSelectedFindingActions([]);
    
    try {
      // Load actions related to this finding
      const actions = await getActionsByFinding(finding.findingId);
      setSelectedFindingActions(Array.isArray(actions) ? actions : []);
    } catch (err: any) {
      console.error('Failed to load actions', err);
      toast.error('Failed to load actions: ' + (err?.message || 'Unknown error'));
      setSelectedFindingActions([]);
    } finally {
      setLoadingActions(false);
        }
  };

  const handleRejectClick = (action: Action) => {
    setSelectedAction(action);
    setFeedbackType('reject');
    setFeedbackText('');
    setShowFeedbackModal(true);
  };

  const handleApproveClick = (action: Action) => {
    setSelectedAction(action);
    setFeedbackType('approve');
    setFeedbackText('');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAction) return;
    
    if (feedbackType === 'reject' && !feedbackText.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessingAction(true);
    try {
      if (feedbackType === 'approve') {
        // IMPORTANT: Approve only attachments with status "Open" before approving the action
        try {
          const attachments = await getAttachments('Action', selectedAction.actionId);
          const openAttachments = attachments.filter(att => att.status?.toLowerCase() === 'open');
          const rejectedAttachments = attachments.filter(att => att.status?.toLowerCase() === 'rejected');
          
          console.log(`📋 [FindingsTab] Approving action: ${selectedAction.actionId}`);
          console.log(`📎 Attachments to approve (Open status): ${openAttachments.length}`);
          console.log(`❌ Attachments NOT to approve (Rejected status): ${rejectedAttachments.length}`);
          
          if (openAttachments.length > 0) {
            console.log(`✅ [FindingsTab] Approving ${openAttachments.length} attachment(s) with "Open" status...`);
            const approvePromises = openAttachments.map(async (attachment) => {
              try {
                await updateAttachmentStatus(attachment.attachmentId, 'Approved');
                console.log(`  ✓ Approved attachment: ${attachment.fileName}`);
              } catch (err: any) {
                console.error(`  ✗ Failed to approve attachment ${attachment.fileName}:`, err);
              }
            });
            await Promise.all(approvePromises);
            console.log(`✅ [FindingsTab] Approved ${openAttachments.length} attachment(s)`);
          }
        } catch (attErr) {
          console.warn('Could not load/approve attachments:', attErr);
        }
        
        await approveFindingActionHigherLevel(selectedAction.actionId, feedbackText || '');
        toast.success('Action approved successfully');
      } else {
        await rejectFindingActionHigherLevel(selectedAction.actionId, feedbackText);
        
        // Reset progress to 0 when action is rejected
        try {
          await updateActionProgressPercent(selectedAction.actionId, 0);
          console.log('✅ [FindingsTab] Progress reset to 0 after rejection');
        } catch (progressError: any) {
          console.error('⚠️ [FindingsTab] Failed to reset progress:', progressError);
          // Don't fail the whole operation if progress reset fails
        }
        
        toast.success('Action rejected successfully');
      }
      
      setShowFeedbackModal(false);
      setSelectedAction(null);
      setFeedbackText('');
      
      // Reload actions
      if (selectedFinding) {
        const actions = await getActionsByFinding(selectedFinding.findingId);
        setSelectedFindingActions(Array.isArray(actions) ? actions : []);
      }
    } catch (err: any) {
      console.error('Failed to process action', err);
      toast.error('Failed to process action: ' + (err?.message || 'Unknown error'));
    } finally {
      setProcessingAction(false);
    }
  };

  const findingColumns: TableColumn<Finding>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Title',
      render: (finding) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-semibold text-gray-900">{finding.title || 'Untitled Finding'}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      cellClassName: 'whitespace-nowrap',
      render: (finding) => (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(finding.severity || '')}`}>
          {finding.severity || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cellClassName: 'whitespace-nowrap',
      render: (finding) => (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(finding.status || '')}`}>
          {finding.status || 'N/A'}
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      cellClassName: 'whitespace-nowrap',
      render: (finding) => (
        <p className="text-sm text-gray-900">{finding.deadline ? formatDate(finding.deadline) : 'N/A'}</p>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      cellClassName: 'whitespace-nowrap text-center',
      render: (finding) => (
        <button
          onClick={() => handleViewFindingDetail(finding)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          view
        </button>
      ),
    },
  ], []);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading findings...</p>
          </div>
        </div>
      ) : findings.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 text-lg font-medium">No findings found</p>
          <p className="text-gray-500 text-sm mt-2">No findings for this audit.</p>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Total findings: 
              <span className="font-semibold text-gray-900 ml-1">{findings.length}</span>
            </p>
          </div>
          <DataTable
            columns={findingColumns}
            data={findings}
            loading={false}
            loadingMessage="Loading findings..."
            emptyState="No findings found."
            rowKey={(finding, index) => finding.findingId || index}
            getRowClassName={() => 'transition-colors hover:bg-gray-50'}
          />
        </div>
      )}

      {/* Actions Modal */}
      {showActionsModal && selectedFinding && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowActionsModal(false);
              setSelectedFinding(null);
              setSelectedFindingActions([]);
            }}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Actions for Finding</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedFinding.title || 'Finding Details'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowActionsModal(false);
                    setSelectedFinding(null);
                    setSelectedFindingActions([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
            </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingActions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading actions...</p>
                  </div>
                </div>
                ) : selectedFindingActions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No actions found for this finding</p>
                  </div>
              ) : (
                <div className="space-y-6">
                    {selectedFindingActions.map((action) => (
                      <div
                        key={action.actionId}
                        className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h4 className="text-xl font-bold text-gray-900">
                                  {action.title || 'Untitled Action'}
                                </h4>
                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${getStatusColor(action.status || '')}`}>
                                  {action.status || 'N/A'}
                                </span>
                  </div>
                              {action.description && (
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border-l-4 border-primary-500">
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {action.description}
                    </p>
                  </div>
                              )}
                        </div>
                      </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t-2 border-gray-200">
                            <div className="bg-blue-50 rounded-lg p-3">
                              <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Progress</span>
                        <div className="mt-1">
                                <div className="w-full bg-blue-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${action.progressPercent ?? 0}%` }}
                                  ></div>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 mt-1">{action.progressPercent ?? 0}%</p>
                        </div>
                      </div>
                            <div className="bg-purple-50 rounded-lg p-3">
                              <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Due Date</span>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{action.dueDate ? formatDate(action.dueDate) : 'N/A'}</p>
                      </div>
                            {action.reviewFeedback && (
                              <div className="bg-amber-50 rounded-lg p-3 md:col-span-1">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Review Feedback</span>
                                <p className="text-sm text-gray-900 mt-1 line-clamp-2">{action.reviewFeedback}</p>
                      </div>
                            )}
                      </div>

                          {/* Approve/Reject Buttons - Only show if status is Approved */}
                          {action.status === 'Approved' && (
                            <div className="mt-6 pt-4 border-t-2 border-gray-200 flex items-center justify-end gap-3">
                              <button
                                onClick={() => handleRejectClick(action)}
                                className="px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg bg-red-500 hover:bg-red-600 text-white transform hover:scale-105 active:scale-95"
                              >
                                ✕ Reject
                              </button>
                              <button
                                onClick={() => handleApproveClick(action)}
                                className="px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg bg-green-500 hover:bg-green-600 text-white transform hover:scale-105 active:scale-95"
                              >
                                ✓ Accept
                              </button>
                        </div>
                      )}
                    </div>
                  </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowActionsModal(false);
                    setSelectedFinding(null);
                    setSelectedFindingActions([]);
                  }}
                  className="px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedAction && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowFeedbackModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                <h3 className="text-xl font-bold text-white">
                  {feedbackType === 'approve' ? '✓ Approve Action' : '✕ Reject Action'}
                </h3>
                <p className="text-sm text-white/90 mt-1">
                  {selectedAction.title || 'Untitled Action'}
                </p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Feedback {feedbackType === 'reject' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={feedbackType === 'approve' ? 'Enter feedback (optional)...' : 'Enter reason for rejection...'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    rows={4}
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowFeedbackModal(false);
                      setSelectedAction(null);
                      setFeedbackText('');
                    }}
                    className="px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
                    disabled={processingAction}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={processingAction || (feedbackType === 'reject' && !feedbackText.trim())}
                    className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                      feedbackType === 'approve'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processingAction ? 'Processing...' : feedbackType === 'approve' ? '✓ Confirm Approval' : '✕ Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FindingsTab;

