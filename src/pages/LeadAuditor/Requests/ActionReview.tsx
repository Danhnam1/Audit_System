import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActionsForReview } from '../../../api/actionReview';
import { approveActionHigherLevel, rejectActionHigherLevel } from '../../../api/actionReviewHigherLevel';
import { getFindings, getFindingById } from '../../../api/findings';
import { getAttachments } from '../../../api/attachments';

const ActionReview = () => {
  const queryClient = useQueryClient();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Filtering & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all actions
  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['actions-for-review'],
    queryFn: async () => {
      console.log('🔍 Fetching actions...');
      const res = await getActionsForReview();
      console.log('📦 Actions response:', res);
      console.log('📦 Is array?', Array.isArray(res));
      return Array.isArray(res) ? res : [];
    },
  });

  // Fetch all findings
  const { data: allFindings = [] } = useQuery({
    queryKey: ['findings'],
    queryFn: async () => {
      const res = await getFindings();
      return Array.isArray(res) ? res : [];
    },
  });

  const selectedAction = actions.find((a: any) => a.actionId === selectedActionId);
  const selectedFinding = selectedAction ? allFindings.find((f: any) => f.findingId === selectedAction.findingId) : null;

  // Debug logging
  if (isDetailModalOpen && selectedAction) {
    console.log('Selected Action:', selectedAction);
    console.log('Selected Finding:', selectedFinding);
  }

  // Fetch detailed finding info when modal opens
  const { data: detailedFinding } = useQuery({
    queryKey: ['finding-detail', selectedFinding?.findingId],
    queryFn: async () => {
      if (!selectedFinding?.findingId) return null;
      console.log('Fetching finding details for:', selectedFinding.findingId);
      const result = await getFindingById(selectedFinding.findingId);
      console.log('Finding details result:', result);
      return result;
    },
    enabled: !!selectedFinding?.findingId && isDetailModalOpen,
  });

  // Fetch attachments for selected action
  const { data: actionAttachments = [] } = useQuery({
    queryKey: ['action-attachments', selectedActionId],
    queryFn: async () => {
      if (!selectedActionId) return [];
      const res = await getAttachments('Action', selectedActionId);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!selectedActionId,
  });

  // Fetch attachments for selected finding
  const { data: findingAttachments = [] } = useQuery({
    queryKey: ['finding-attachments', selectedFinding?.findingId],
    queryFn: async () => {
      if (!selectedFinding?.findingId) return [];
      const res = await getAttachments('finding', selectedFinding.findingId);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!selectedFinding?.findingId,
  });

  // Approve mutation (Higher Level)
  const approveMutation = useMutation({
    mutationFn: ({ actionId, feedback }: { actionId: string; feedback?: string }) => 
      approveActionHigherLevel(actionId, feedback),
    onSuccess: () => {
      alert('✅ Action approved at higher level');
      queryClient.invalidateQueries({ queryKey: ['actions-for-review'] });
      closeDetailModal();
    },
    onError: () => {
      alert('❌ Failed to approve action');
    },
  });

  // Reject mutation (Higher Level)
  const rejectMutation = useMutation({
    mutationFn: ({ actionId, feedback }: { actionId: string; feedback: string }) => 
      rejectActionHigherLevel(actionId, feedback),
    onSuccess: () => {
      alert('🔄 Action rejected at higher level');
      queryClient.invalidateQueries({ queryKey: ['actions-for-review'] });
      closeDetailModal();
    },
    onError: () => {
      alert('❌ Failed to reject action');
    },
  });

  // Calculate attachment status summary for actions
  const actionAttachmentSummary = {
    total: actionAttachments.length,
    open: actionAttachments.filter(a => a.status === 'Open').length,
    approved: actionAttachments.filter(a => a.status === 'Approved').length,
    returned: actionAttachments.filter(a => a.status === 'Returned').length,
  };

  // Calculate attachment status summary for findings
  const findingAttachmentSummary = {
    total: findingAttachments.length,
    open: findingAttachments.filter(a => a.status === 'Open').length,
    approved: findingAttachments.filter(a => a.status === 'Approved').length,
    returned: findingAttachments.filter(a => a.status === 'Returned').length,
  };

  // Filter actions (LeadAuditor reviews Approved actions)
  const filteredActions = actions.filter((action: any) => {
    const matchesSearch = action.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          action.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPending = !showPendingOnly || action.status === 'Approved';
    return matchesSearch && matchesPending;
  });

  // Pagination
  const totalPages = Math.ceil(filteredActions.length / itemsPerPage);
  const paginatedActions = filteredActions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePendingToggle = (checked: boolean) => {
    setShowPendingOnly(checked);
    setCurrentPage(1);
  };

  const openDetailModal = (actionId: string) => {
    setSelectedActionId(actionId);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedActionId(null);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      Completed: 'bg-green-100 text-green-800',
      Closed: 'bg-gray-100 text-gray-800',
      Open: 'bg-yellow-100 text-yellow-800',
      Approved: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleApprove = () => {
    if (selectedActionId) {
      const feedback = prompt('✅ Please enter approval feedback (optional):');
      if (feedback !== null) { // User clicked OK (even if empty)
        approveMutation.mutate({ actionId: selectedActionId, feedback: feedback.trim() });
      }
    }
  };

  const handleReject = () => {
    if (selectedActionId) {
      const feedback = prompt('🔄 Please enter rejection feedback (required):');
      if (feedback && feedback.trim()) {
        rejectMutation.mutate({ actionId: selectedActionId, feedback: feedback.trim() });
      } else if (feedback !== null) {
        alert('Feedback is required for rejection');
      }
    }
  };

  if (actionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">📝 Action Review (Higher Level)</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Review and approve auditor-approved actions</p>
      </div>

      {/* Filters */}
      <div className="mb-4 bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
          <div className="flex-1 min-w-full sm:min-w-[300px]">
            <input
              type="text"
              placeholder="🔍 Search by action title or description..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPendingOnly}
              onChange={(e) => handlePendingToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
              Show only approved actions
            </span>
          </label>

          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing <span className="font-semibold">{paginatedActions.length}</span> of <span className="font-semibold">{filteredActions.length}</span> actions
          </div>
        </div>
      </div>

      {/* Actions Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedActions.map((action: any) => (
              <tr key={action.actionId} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{action.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-md">{action.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(action.status)}`}>
                    {action.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${action.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{action.progressPercent}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(action.dueDate).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {action.assignedTo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openDetailModal(action.actionId)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <span className="mr-2">🔍</span>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredActions.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            {searchTerm || showPendingOnly ? 'No actions match your filters' : 'No actions found'}
          </div>
        )}
      </div>

      {/* Actions Cards - Mobile & Tablet */}
      <div className="lg:hidden space-y-4">
        {paginatedActions.map((action: any) => (
          <div key={action.actionId} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 pr-3">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{action.title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{action.description}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadge(action.status)}`}>
                {action.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500">Progress:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${action.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-gray-700 font-medium whitespace-nowrap">{action.progressPercent}%</span>
                </div>
              </div>
              <div>
                <span className="text-gray-500">Due Date:</span>
                <p className="text-gray-900 font-medium mt-1">{new Date(action.dueDate).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Assigned To:</span>
                <p className="text-gray-900 font-medium mt-1">{action.assignedTo}</p>
              </div>
            </div>

            <button
              onClick={() => openDetailModal(action.actionId)}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">🔍</span>
              View Details
            </button>
          </div>
        ))}

        {filteredActions.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-sm">
            {searchTerm || showPendingOnly ? 'No actions match your filters' : 'No actions found'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between bg-white rounded-lg shadow px-4 sm:px-6 py-3 sm:py-4 gap-3">
          <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
            Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
          </div>
          
          <div className="flex flex-wrap gap-1 sm:gap-2 justify-center order-1 sm:order-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">⟪ First</span>
              <span className="sm:hidden">⟪</span>
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">‹ Previous</span>
              <span className="sm:hidden">‹</span>
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1 border rounded text-xs sm:text-sm ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Next ›</span>
              <span className="sm:hidden">›</span>
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Last ⟫</span>
              <span className="sm:hidden">⟫</span>
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">{selectedAction.title}</h2>
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                    <span className={`px-2 py-1 rounded ${getStatusBadge(selectedAction.status)}`}>{selectedAction.status}</span>
                    <span className="whitespace-nowrap">📊 {selectedAction.progressPercent}%</span>
                    <span className="whitespace-nowrap">📅 {new Date(selectedAction.dueDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="ml-2 text-gray-400 hover:text-gray-600 text-2xl font-bold flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Action Details */}
              <div className="mb-4 sm:mb-6 bg-gray-50 rounded-lg p-3 sm:p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Action Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="col-span-1 sm:col-span-2">
                    <span className="font-medium text-gray-700">Action ID:</span>
                    <span className="ml-2 text-gray-600 font-mono text-xs break-all">{selectedAction.actionId}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Created:</span>
                    <span className="ml-2 text-gray-600">{new Date(selectedAction.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Assigned By:</span>
                    <span className="ml-2 text-gray-600">{selectedAction.assignedBy}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Assigned To:</span>
                    <span className="ml-2 text-gray-600">{selectedAction.assignedTo}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Department:</span>
                    <span className="ml-2 text-gray-600">{selectedAction.assignedDeptId}</span>
                  </div>
                  {selectedAction.reviewFeedback && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="font-medium text-gray-700">Review Feedback:</span>
                      <p className="mt-1 text-gray-600">{selectedAction.reviewFeedback}</p>
                    </div>
                  )}
                  <div className="col-span-1 sm:col-span-2">
                    <span className="font-medium text-gray-700">Description:</span>
                    <p className="mt-1 text-gray-600">{selectedAction.description}</p>
                  </div>
                </div>
              </div>

              {/* Finding Details */}
              {(detailedFinding || selectedFinding) && (
                <div className="mb-4 sm:mb-6 bg-yellow-50 rounded-lg p-3 sm:p-4 border border-yellow-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">📋 Related Finding Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="col-span-1 sm:col-span-2">
                      <span className="font-medium text-gray-700">Finding ID:</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs break-all">{detailedFinding?.findingId || selectedFinding?.findingId}</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <span className="font-medium text-gray-700">Title:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{detailedFinding?.title || selectedFinding?.title}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Severity:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(detailedFinding?.severity || selectedFinding?.severity || '')}`}>
                        {detailedFinding?.severity || selectedFinding?.severity}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(detailedFinding?.status || selectedFinding?.status || '')}`}>
                        {detailedFinding?.status || selectedFinding?.status}
                      </span>
                    </div>
                    {detailedFinding?.deadline && (
                      <div>
                        <span className="font-medium text-gray-700">Deadline:</span>
                        <span className="ml-2 text-gray-600">{new Date(detailedFinding.deadline).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                    {detailedFinding?.createdAt && (
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <span className="ml-2 text-gray-600">{new Date(detailedFinding.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                    {detailedFinding?.source && (
                      <div>
                        <span className="font-medium text-gray-700">Source:</span>
                        <span className="ml-2 text-gray-600">{detailedFinding.source}</span>
                      </div>
                    )}
                    {detailedFinding?.externalAuditorName && (
                      <div>
                        <span className="font-medium text-gray-700">Auditor:</span>
                        <span className="ml-2 text-gray-600">{detailedFinding.externalAuditorName}</span>
                      </div>
                    )}
                    <div className="col-span-1 sm:col-span-2">
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="mt-1 text-gray-600">{detailedFinding?.description || selectedFinding?.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Evidence Table */}
              <div className="mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">📎 Action Evidence</h3>
                  {actionAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded whitespace-nowrap">📂 {actionAttachmentSummary.total}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded whitespace-nowrap">🔵 {actionAttachmentSummary.open}</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded whitespace-nowrap">✅ {actionAttachmentSummary.approved}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded whitespace-nowrap">🔄 {actionAttachmentSummary.returned}</span>
                    </div>
                  )}
                </div>
                {actionAttachments.length === 0 ? (
                  <p className="text-gray-400 text-xs sm:text-sm italic text-center py-4 sm:py-6 bg-gray-50 rounded-lg">
                    No evidence attached to this action yet
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Uploaded</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {actionAttachments.map((att) => (
                          <tr key={att.attachmentId} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <a
                                href={att.blobPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-2 text-xs sm:text-sm"
                              >
                                {att.contentType.startsWith('image/') && '🖼️'}
                                {att.contentType === 'application/pdf' && '📄'}
                                {!att.contentType.startsWith('image/') && att.contentType !== 'application/pdf' && '📎'}
                                <span className="truncate max-w-[120px] sm:max-w-xs">{att.fileName}</span>
                              </a>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                              {(att.sizeBytes / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap hidden sm:table-cell">
                              {new Date(att.uploadedAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadge(att.status)}`}>
                                {att.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Finding Evidence Table */}
              <div className="mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">📋 Finding Evidence</h3>
                  {findingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded whitespace-nowrap">📂 {findingAttachmentSummary.total}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded whitespace-nowrap">🔵 {findingAttachmentSummary.open}</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded whitespace-nowrap">✅ {findingAttachmentSummary.approved}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded whitespace-nowrap">🔄 {findingAttachmentSummary.returned}</span>
                    </div>
                  )}
                </div>
                {findingAttachments.length === 0 ? (
                  <p className="text-gray-400 text-xs sm:text-sm italic text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                    No evidence attached to this finding yet
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Uploaded</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {findingAttachments.map((att) => (
                          <tr key={att.attachmentId} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <a
                                href={att.blobPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-2 text-xs sm:text-sm"
                              >
                                {att.contentType.startsWith('image/') && '🖼️'}
                                {att.contentType === 'application/pdf' && '📄'}
                                {!att.contentType.startsWith('image/') && att.contentType !== 'application/pdf' && '📎'}
                                <span className="truncate max-w-[120px] sm:max-w-xs">{att.fileName}</span>
                              </a>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                              {(att.sizeBytes / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap hidden sm:table-cell">
                              {new Date(att.uploadedAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadge(att.status)}`}>
                                {att.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <button
                    onClick={closeDetailModal}
                    className="px-4 sm:px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  >
                    Close
                  </button>
                  {selectedAction.status === 'Approved' && (actionAttachmentSummary.total > 0 || findingAttachmentSummary.total > 0) && 
                   (actionAttachmentSummary.approved < actionAttachmentSummary.total || findingAttachmentSummary.approved < findingAttachmentSummary.total) && (
                    <div className="text-xs sm:text-sm text-amber-600 flex items-center gap-2">
                      ⚠️ Warning: Not all attachments are approved ({actionAttachmentSummary.approved + findingAttachmentSummary.approved}/{actionAttachmentSummary.total + findingAttachmentSummary.total})
                    </div>
                  )}
                </div>
                
                {selectedAction.status === 'Approved' && (
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="hidden sm:inline">✗ Reject Action</span>
                      <span className="sm:hidden">✗ Reject</span>
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="hidden sm:inline">✓ Approve (Final)</span>
                      <span className="sm:hidden">✓ Approve</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionReview;
