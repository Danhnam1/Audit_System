import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { getMyWitnessedFindings, witnessConfirmFinding, witnessDisagreeFinding, type Finding } from '../../api/findings';
import { getSeverityColor } from '../../constants/statusColors';
import WitnessedFindingDetailModal from '../Shared/WitnessedFindingDetailModal';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';

interface FindingWithAudit extends Finding {
  auditTitle?: string;
  auditType?: string;
}

const CAPAOwnerWitnessedAuditFindings = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const auditTitle = (location.state as any)?.auditTitle || 'Audit Details';

  const [findings, setFindings] = useState<FindingWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  
  // Witness confirmation states
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedFindingForReject, setSelectedFindingForReject] = useState<FindingWithAudit | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    const fetchWitnessedFindings = async () => {
      try {
        setLoading(true);

        const witnessedFindings = await getMyWitnessedFindings();

        const filteredFindings = witnessedFindings
          .filter((finding) => {
            const findingAuditId = finding.audit?.auditId || finding.auditId;
            return findingAuditId === auditId;
          })
          .map((finding) => ({
            ...finding,
            auditTitle: finding.audit?.title || 'N/A',
            auditType: finding.audit?.type || 'N/A',
          }));

        setFindings(filteredFindings);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching witnessed findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    if (auditId) {
      fetchWitnessedFindings();
    }
  }, [auditId]);

  const calculateDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const handleViewDetail = (findingId: string) => {
    setSelectedFindingId(findingId);
    setShowDetailModal(true);
  };

  const handleBack = () => {
    navigate('/capa-owner/my-witnessed');
  };

  const handleConfirmWitness = async (finding: FindingWithAudit) => {
    if (window.confirm(`Are you sure you want to confirm this finding: "${finding.title}"?`)) {
      setSubmittingAction(true);
      try {
        const findingIdToConfirm = finding.findingId;
        await witnessConfirmFinding(findingIdToConfirm);
        toast.success('Finding confirmed successfully!');

        // Update local state immediately so Approve/Reject buttons disappear without needing a reload
        setFindings(prev =>
          prev.map(f =>
            f.findingId === findingIdToConfirm
              ? {
                  ...f,
                  status: 'Confirmed',
                }
              : f
          )
        );

        // Dispatch event to notify other components (e.g., FindingDetailModal) about root cause changes
        // Small delay to ensure backend has updated
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
            detail: { findingId: findingIdToConfirm }
          }));
        }, 500);
      } catch (err: any) {
        console.error('Error confirming witness:', err);
        toast.error(getUserFriendlyErrorMessage(err, 'Failed to confirm finding. Please try again.'));
      } finally {
        setSubmittingAction(false);
      }
    }
  };

  const handleRejectClick = (finding: FindingWithAudit) => {
    setSelectedFindingForReject(finding);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedFindingForReject) return;
    
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setSubmittingAction(true);
    try {
      const findingIdToReject = selectedFindingForReject.findingId;
      await witnessDisagreeFinding(findingIdToReject, rejectReason.trim());
      toast.success('Finding rejected successfully. Auditor will be notified.');

      // Update local state immediately so Approve/Reject buttons disappear without needing a reload
      setFindings(prev =>
        prev.map(f =>
          f.findingId === findingIdToReject
            ? {
                ...f,
                status: 'WitnessDisagreed',
              }
            : f
        )
      );

      // Dispatch event to notify other components (e.g., FindingDetailModal) about root cause changes
      // Small delay to ensure backend has updated
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
          detail: { findingId: findingIdToReject }
        }));
      }, 500);
      
      // Close modal
      setShowRejectModal(false);
      setSelectedFindingForReject(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('Error rejecting witness:', err);
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to reject finding. Please try again.'));
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filter findings by status
  const filteredFindings = statusFilter === 'All' 
    ? findings 
    : findings.filter(f => f.status === statusFilter);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Audits</span>
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{auditTitle}</h1>
          <p className="text-gray-600">Witnessed Findings for this Audit (CAPA Owner - View Only)</p>
        </div>

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All</option>
              <option value="PendingWitnessConfirmation">Pending Confirmation</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Rejected">Rejected</option>
              <option value="Open">Open</option>
              <option value="Received">Received</option>
              <option value="Closed">Closed</option>
            </select>
            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredFindings.length} of {findings.length} findings
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading findings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">
              {statusFilter === 'All' ? 'No findings found for this audit.' : `No findings with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Deadline
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-black uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredFindings.map((finding, idx) => {
                    const daysRemaining = finding.deadline ? calculateDaysRemaining(finding.deadline) : null;
                    return (
                      <tr key={finding.findingId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{idx + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{finding.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(
                              finding.severity
                            )}`}
                          >
                            {finding.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              finding.status === 'PendingWitnessConfirmation'
                                ? 'bg-purple-100 text-purple-700'
                                : finding.status === 'Confirmed'
                                ? 'bg-green-100 text-green-700'
                                : finding.status === 'Rejected'
                                ? 'bg-red-100 text-red-700'
                                : finding.status === 'Open'
                                ? 'bg-blue-100 text-blue-700'
                                : finding.status === 'Received'
                                ? 'bg-yellow-100 text-yellow-700'
                                : finding.status === 'Closed'
                                ? 'bg-gray-100 text-gray-700'
                                : finding.status === 'Return'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {finding.status === 'PendingWitnessConfirmation' 
                              ? 'Pending Confirmation' 
                              : finding.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {finding.deadline ? (
                            <div>
                              <div className="text-sm text-gray-900">
                                {new Date(finding.deadline).toLocaleDateString('vi-VN')}
                              </div>
                              {daysRemaining !== null && (
                                <div
                                  className={`text-xs font-medium ${
                                    daysRemaining < 0
                                      ? 'text-red-600'
                                      : daysRemaining <= 3
                                      ? 'text-orange-600'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  {daysRemaining < 0
                                    ? `${Math.abs(daysRemaining)} days overdue`
                                    : `${daysRemaining} days left`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-[#5b6166]">No deadline</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {finding.status === 'PendingWitnessConfirmation' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleConfirmWitness(finding)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Confirm this finding"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm
                              </button>
                              <button
                                onClick={() => handleRejectClick(finding)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject this finding"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject
                              </button>
                            </div>
                          ) : finding.status === 'Open' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleConfirmWitness(finding)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Approve this finding"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectClick(finding)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject this finding"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject
                              </button>
                              <button
                                onClick={() => handleViewDetail(finding.findingId)}
                                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center gap-1"
                                title="View finding details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                View
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleViewDetail(finding.findingId)}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Witnessed Finding Detail Modal */}
      {showDetailModal && selectedFindingId && (
        <WitnessedFindingDetailModal
          isOpen={showDetailModal}
          findingId={selectedFindingId}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFindingId(null);
          }}
        />
      )}

      {/* Reject Finding Modal */}
      {showRejectModal && selectedFindingForReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Reject Finding</h3>
              <p className="text-sm text-gray-600 mt-1">
                Finding: {selectedFindingForReject.title}
              </p>
            </div>

            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Please explain why you are rejecting this finding..."
                disabled={submittingAction}
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be sent to the auditor for review.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedFindingForReject(null);
                  setRejectReason('');
                }}
                disabled={submittingAction}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submittingAction || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingAction ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Submit Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default CAPAOwnerWitnessedAuditFindings;


