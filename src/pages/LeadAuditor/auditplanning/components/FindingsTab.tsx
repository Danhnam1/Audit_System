import React, { useState, useMemo } from 'react';
import { DataTable, type TableColumn } from '../../../../components/DataTable';
import { getFindingById } from '../../../../api/findings';
import { getUserById } from '../../../../api/adminUsers';
import { getDepartmentById } from '../../../../api/departments';
import { getAttachments } from '../../../../api/attachments';
import { toast } from 'react-toastify';
import type { Finding } from '../../../../api/findings';
import type { Attachment } from '../../../../api/attachments';

interface FindingsTabProps {
  findings: Finding[];
  loading: boolean;
}

const FindingsTab: React.FC<FindingsTabProps> = ({ findings, loading }) => {
  const [showFindingDetailModal, setShowFindingDetailModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [findingAttachments, setFindingAttachments] = useState<Attachment[]>([]);
  const [loadingFindingDetail, setLoadingFindingDetail] = useState(false);
  const [findingCreatedByFullName, setFindingCreatedByFullName] = useState<string>('');
  const [findingReviewerFullName, setFindingReviewerFullName] = useState<string>('');
  const [findingDepartmentName, setFindingDepartmentName] = useState<string>('');

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

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
    setShowFindingDetailModal(true);
    setLoadingFindingDetail(true);
    setFindingCreatedByFullName('');
    setFindingReviewerFullName('');
    setFindingDepartmentName('');
    
    try {
      // Load finding detail
      const findingDetail = await getFindingById(finding.findingId);
      setSelectedFinding(findingDetail);
      
      // Load createdBy user info
      if (findingDetail.createdBy) {
        try {
          const user = await getUserById(findingDetail.createdBy);
          setFindingCreatedByFullName(user?.fullName || 'N/A');
        } catch (err) {
          console.error('Failed to load createdBy user', err);
          setFindingCreatedByFullName('N/A');
        }
      }
      
      // Load reviewer user info
      if (findingDetail.reviewerId) {
        try {
          const reviewer = await getUserById(findingDetail.reviewerId);
          setFindingReviewerFullName(reviewer?.fullName || 'N/A');
        } catch (err) {
          console.error('Failed to load reviewer user', err);
          setFindingReviewerFullName('N/A');
        }
      }
      
      // Load department name
      if (findingDetail.deptId) {
        try {
          const dept = await getDepartmentById(findingDetail.deptId);
          setFindingDepartmentName(dept?.name || 'N/A');
        } catch (err) {
          console.error('Failed to load department', err);
          setFindingDepartmentName('N/A');
        }
      }
      
      // Load attachments
      try {
        const attachments = await getAttachments('finding', finding.findingId);
        setFindingAttachments(attachments);
      } catch (err) {
        console.error('Failed to load attachments', err);
        setFindingAttachments([]);
      }
    } catch (err: any) {
      console.error('Failed to load finding detail', err);
      toast.error('Failed to load finding detail: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingFindingDetail(false);
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

      {/* Finding Detail Modal */}
      {showFindingDetailModal && selectedFinding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white">Finding Details</h3>
                  <p className="text-sm text-white/90 mt-1">Complete finding information</p>
                </div>
                <button
                  onClick={() => {
                    setShowFindingDetailModal(false);
                    setSelectedFinding(null);
                    setFindingAttachments([]);
                    setFindingCreatedByFullName('');
                    setFindingReviewerFullName('');
                    setFindingDepartmentName('');
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-8">
              {loadingFindingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="mt-4 text-gray-600">Loading finding details...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Title */}
                  <div className="bg-primary-50 border-l-4 border-primary-500 p-4 rounded-r-lg">
                    <label className="block text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                    <p className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed">{selectedFinding.title || 'N/A'}</p>
                  </div>

                  {/* Description */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Description</label>
                    <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                      {selectedFinding.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Severity</span>
                        <div className="mt-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(selectedFinding.severity || '')}`}>
                            {selectedFinding.severity || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                        <div className="mt-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedFinding.status || '')}`}>
                            {selectedFinding.status || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Department</span>
                        <p className="text-sm text-gray-900 mt-1">
                          {loadingFindingDetail ? 'Loading...' : findingDepartmentName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Created By</span>
                        <p className="text-sm text-gray-900 mt-1">
                          {loadingFindingDetail ? 'Loading...' : findingCreatedByFullName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Created At</span>
                        <p className="text-sm text-gray-900 mt-1">{formatDateTime(selectedFinding.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Deadline</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedFinding.deadline ? formatDate(selectedFinding.deadline) : 'N/A'}</p>
                      </div>
                      {selectedFinding.reviewerId && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Reviewer</span>
                          <p className="text-sm text-gray-900 mt-1">
                            {loadingFindingDetail ? 'Loading...' : findingReviewerFullName || 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5 border-t border-gray-200 shadow-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowFindingDetailModal(false);
                    setSelectedFinding(null);
                    setFindingAttachments([]);
                    setFindingCreatedByFullName('');
                    setFindingReviewerFullName('');
                    setFindingDepartmentName('');
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
    </>
  );
};

export default FindingsTab;

