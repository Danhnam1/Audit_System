import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { getAllAuditAssignmentRequests, approveAuditAssignmentRequest, rejectAuditAssignmentRequest } from '../../../api/auditAssignments';
import { toast } from 'react-toastify';

interface AuditAssignmentRequest {
  requestId: string;
  auditId: string;
  deptId: number;
  auditAssignmentId: string;
  createdBy: string;
  reasonRequest: string;
  actualAuditDate: string;
  createdAt: string;
  status: string;
  auditTitle?: string;
  departmentName?: string;
  createdByName?: string;
}

const LeadAuditorRequestManagement = () => {
  const [requests, setRequests] = useState<AuditAssignmentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AuditAssignmentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await getAllAuditAssignmentRequests();
      let requestsData: AuditAssignmentRequest[] = [];
      
      if (response?.$values && Array.isArray(response.$values)) {
        requestsData = response.$values;
      } else if (Array.isArray(response)) {
        requestsData = response;
      } else if (response?.data) {
        const data = response.data;
        if (data?.$values && Array.isArray(data.$values)) {
          requestsData = data.$values;
        } else if (Array.isArray(data)) {
          requestsData = data;
        }
      }
      
      setRequests(requestsData);
    } catch (error) {
      console.error('Failed to load requests:', error);
      toast.error('Failed to load requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };


  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApproveClick = (request: AuditAssignmentRequest) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleRejectClick = (request: AuditAssignmentRequest) => {
    setSelectedRequest(request);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(selectedRequest.requestId);
    try {
      await approveAuditAssignmentRequest(selectedRequest.requestId);
      toast.success('Request approved successfully');
      setShowApproveModal(false);
      setSelectedRequest(null);
      await loadRequests(); // Reload requests
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }

    setActionLoading(selectedRequest.requestId);
    try {
      await rejectAuditAssignmentRequest(selectedRequest.requestId, rejectReason.trim());
      toast.success('Request rejected successfully');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
      await loadRequests(); // Reload requests
    } catch (error: any) {
      console.error('Failed to reject request:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = filterStatus === 'All' 
    ? requests 
    : requests.filter(req => req.status?.toLowerCase() === filterStatus.toLowerCase());

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Request Management</h1>
          <p className="text-blue-100">View and manage audit assignment requests</p>
        </div>

        {/* Filter and Stats */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Total: <span className="font-semibold">{requests.length}</span></span>
              <span className="text-yellow-600">Pending: <span className="font-semibold">{requests.filter(r => r.status?.toLowerCase() === 'pending').length}</span></span>
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading requests...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Audit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual Audit Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.requestId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.auditTitle || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {request.departmentName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {request.createdByName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(request.actualAuditDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={request.reasonRequest}>
                          {request.reasonRequest || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(request.status)}`}>
                          {request.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {request.status?.toLowerCase() === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveClick(request)}
                              disabled={actionLoading === request.requestId}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectClick(request)}
                              disabled={actionLoading === request.requestId}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              if (!actionLoading) {
                setShowApproveModal(false);
                setSelectedRequest(null);
              }
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Approve Request</h3>
                <button
                  onClick={() => {
                    if (!actionLoading) {
                      setShowApproveModal(false);
                      setSelectedRequest(null);
                    }
                  }}
                  disabled={actionLoading === selectedRequest.requestId}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audit</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.auditTitle || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.departmentName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.createdByName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Audit Date</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {formatDate(selectedRequest.actualAuditDate)}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Are you sure you want to approve this request?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    if (!actionLoading) {
                      setShowApproveModal(false);
                      setSelectedRequest(null);
                    }
                  }}
                  disabled={actionLoading === selectedRequest.requestId}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={actionLoading === selectedRequest.requestId}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading === selectedRequest.requestId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Approving...
                    </>
                  ) : (
                    'Approve'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              if (!actionLoading) {
                setShowRejectModal(false);
                setSelectedRequest(null);
                setRejectReason('');
              }
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reject Request</h3>
                <button
                  onClick={() => {
                    if (!actionLoading) {
                      setShowRejectModal(false);
                      setSelectedRequest(null);
                      setRejectReason('');
                    }
                  }}
                  disabled={actionLoading === selectedRequest.requestId}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audit</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.auditTitle || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.departmentName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedRequest.createdByName || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Audit Date</label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {formatDate(selectedRequest.actualAuditDate)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this request..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    disabled={actionLoading === selectedRequest.requestId}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    if (!actionLoading) {
                      setShowRejectModal(false);
                      setSelectedRequest(null);
                      setRejectReason('');
                    }
                  }}
                  disabled={actionLoading === selectedRequest.requestId}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading === selectedRequest.requestId || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading === selectedRequest.requestId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Rejecting...
                    </>
                  ) : (
                    'Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default LeadAuditorRequestManagement;

