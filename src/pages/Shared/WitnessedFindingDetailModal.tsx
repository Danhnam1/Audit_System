import { useState, useEffect } from 'react';
import { getFindingById, type Finding } from '../../api/findings';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { getDepartmentById } from '../../api/departments';
import { getSeverityColor } from '../../constants/statusColors';

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

  useEffect(() => {
    if (isOpen && findingId) {
      loadFinding();
      loadAttachments();
    }
  }, [isOpen, findingId]);

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
      setAttachments(data);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
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

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
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
                    <p className="text-gray-700 whitespace-pre-wrap">{finding.description}</p>
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

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WitnessedFindingDetailModal;
