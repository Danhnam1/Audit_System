import { useState, useEffect } from 'react';
import { getFindingById, type Finding, witnessConfirmFinding, witnessDisagreeFinding } from '../../api/findings';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { getDepartmentById } from '../../api/departments';
import { getSeverityColor } from '../../constants/statusColors';
import { toast } from 'react-toastify';

interface WitnessedFindingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId: string;
}

const WitnessedFindingDetailModal = ({ isOpen, onClose, findingId }: WitnessedFindingDetailModalProps) => {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [witnessName, setWitnessName] = useState<string>('');
  const [departmentName, setDepartmentName] = useState<string>('');
  const [createdByName, setCreatedByName] = useState<string>('');
  const [descriptionHeight, setDescriptionHeight] = useState<number>(120);
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    if (isOpen && findingId) {
      loadFinding();
      loadAttachments();
    }
  }, [isOpen, findingId]);

  // Auto-adjust textarea height based on content
  useEffect(() => {
    if (finding?.description) {
      const textarea = document.getElementById('finding-description-textarea');
      if (textarea) {
        // Reset height to calculate scrollHeight
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Set height with min and max constraints
        const newHeight = Math.min(Math.max(scrollHeight, 120), 300);
        setDescriptionHeight(newHeight);
        textarea.style.height = `${newHeight}px`;
      }
    }
  }, [finding?.description]);

  const loadFinding = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingById(findingId);
      setFinding(data);
      
      // Fetch witness name
      if (data?.witnessId) {
        try {
          const witnessUser = await getUserById(data.witnessId);
          setWitnessName(witnessUser?.fullName || '');
        } catch (err) {
          console.error('Error loading witness:', err);
          setWitnessName('Unknown');
        }
      }
      
      // Fetch createdBy user details
      if (data?.createdBy) {
        try {
          const createdByUser = await getUserById(data.createdBy);
          setCreatedByName(createdByUser?.fullName || '');
        } catch (err) {
          console.error('Error loading created by user:', err);
          setCreatedByName('Unknown');
        }
      }
      
      // Fetch department name
      if (data?.deptId) {
        try {
          const dept = await getDepartmentById(data.deptId);
          setDepartmentName(dept?.name || '');
        } catch (err) {
          console.error('Error loading department:', err);
          setDepartmentName('Unknown');
        }
      }
    } catch (err: any) {
      console.error('Error loading finding:', err);
      setError(err?.message || 'Failed to load finding details');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('finding', findingId);
      // Filter out inactive attachments
      const activeAttachments = (data || []).filter(att => (att.status || '').toLowerCase() !== 'inactive');
      setAttachments(activeAttachments);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const downloadUrl = attachment.filePath || attachment.blobPath;
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleApprove = async () => {
    if (!finding) return;
    
    try {
      await witnessConfirmFinding(finding.findingId);
      toast.success('Finding confirmed successfully!');
      
      // Reload finding to get updated status
      await loadFinding();
    } catch (err: any) {
      console.error('Error confirming witness:', err);
      toast.error(err?.message || 'Failed to confirm finding');
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!finding) return;
    
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setSubmittingReject(true);
    try {
      await witnessDisagreeFinding(finding.findingId, rejectReason.trim());
      toast.success('Finding rejected successfully. Auditor will be notified.');
      
      // Close modal and reload finding
      setShowRejectModal(false);
      setRejectReason('');
      await loadFinding();
    } catch (err: any) {
      console.error('Error rejecting witness:', err);
      toast.error(err?.message || 'Failed to reject finding');
    } finally {
      setSubmittingReject(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-white">Finding Details (Witness View)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : finding ? (
            <div className="space-y-6">
              {/* Finding Info */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        finding.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                        finding.status === 'Received' ? 'bg-yellow-100 text-yellow-700' :
                        finding.status === 'Closed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {finding.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{finding.title}</h3>
                    <div className="mt-3">
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Description</label>
                      <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                        <textarea
                          id="finding-description-textarea"
                          readOnly
                          value={finding.description || ''}
                          className="w-full p-3 bg-transparent text-gray-700 resize-none focus:outline-none border-0"
                          style={{ 
                            minHeight: '120px', 
                            maxHeight: '300px', 
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'block',
                            width: '100%',
                            height: `${descriptionHeight}px`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Department</label>
                    <p className="text-gray-900 font-medium">{departmentName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created By</label>
                    <p className="text-gray-900 font-medium">{createdByName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Witness</label>
                    <p className="text-gray-900 font-medium">{witnessName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Deadline</label>
                    <p className="text-gray-900 font-medium">
                      {finding.deadline ? new Date(finding.deadline).toLocaleDateString('vi-VN') : 'No deadline'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created Date</label>
                    <p className="text-gray-900 font-medium">
                      {finding.createdAt ? new Date(finding.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                  {finding.source && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Source</label>
                      <p className="text-gray-900 font-medium">{finding.source}</p>
                    </div>
                  )}
                  {finding.externalAuditorName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">External Auditor</label>
                      <p className="text-gray-900 font-medium">{finding.externalAuditorName}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attachments ({attachments.length})
                </h4>
                {loadingAttachments ? (
                  <div className="text-gray-500 text-sm">Loading attachments...</div>
                ) : attachments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.attachmentId}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(2)} KB` : 'Unknown size'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(attachment)}
                          className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm bg-gray-50 rounded-lg p-4 text-center">
                    No attachments available
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer - always visible */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-3">
            {finding?.status === 'Open' && (
              <>
                <button
                  onClick={handleApprove}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={handleRejectClick}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-red-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-lg font-semibold text-white">Reject Finding</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Please provide a reason for rejecting this finding:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={4}
                placeholder="Enter rejection reason..."
                disabled={submittingReject}
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                disabled={submittingReject}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={submittingReject || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingReject && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WitnessedFindingDetailModal;
