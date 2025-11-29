import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import FindingDetailModal from '../../../pages/Auditor/FindingManagement/FindingDetailModal';
import { createAction, getActionsByAssignedDept, type Action, approveActionWithFeedback, rejectAction } from '../../../api/actions';
import { getAdminUsersByDepartment } from '../../../api/adminUsers';
import { markFindingAsReceived } from '../../../api/findings';
import { Pagination } from '../../../components';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';

const FindingsProgress = () => {
  const { user } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingForAssign, setSelectedFindingForAssign] = useState<Finding | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffMembers, setStaffMembers] = useState<Array<{ userId: string; fullName: string; email?: string }>>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [showAssignConfirmModal, setShowAssignConfirmModal] = useState(false);
  const [selectedStaffError, setSelectedStaffError] = useState('');
  const [dueDateError, setDueDateError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'progress'>('all');
  const [actions, setActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionForReview, setSelectedActionForReview] = useState<Action | null>(null);
  const [processingReview, setProcessingReview] = useState(false);
  const itemsPerPage = 10;

  // Get user's department ID from token
  const getUserDeptId = (): number | null => {
    const token = localStorage.getItem('auth-storage');
    if (!token) return null;
    
    try {
      const authData = JSON.parse(token);
      const jwtToken = authData?.state?.token;
      if (jwtToken) {
        const base64Url = jwtToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const deptId = payload['DeptId'];
        return deptId ? parseInt(deptId) : null;
      }
    } catch (err) {
      console.error('Error parsing token:', err);
    }
    return null;
  };

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const deptId = getUserDeptId();
        if (!deptId) {
          setError('Department ID not found in token');
          return;
        }

        const data = await getFindingsByDepartment(deptId);
        setFindings(data);
      } catch (err: any) {
        console.error('Error fetching findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, []);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Filter findings based on active tab
  const getFilteredFindings = () => {
    return findings;
  };

  const filteredFindings = getFilteredFindings();

  // Load actions when progress tab is selected
  useEffect(() => {
    if (activeTab === 'progress') {
      const loadActions = async () => {
        const deptId = getUserDeptId();
        if (!deptId) return;

        setLoadingActions(true);
        try {
          const actionsData = await getActionsByAssignedDept(deptId);
          setActions(actionsData || []);
        } catch (err: any) {
          console.error('Error loading actions:', err);
          setActions([]);
        } finally {
          setLoadingActions(false);
        }
      };

      loadActions();
    }
  }, [activeTab]);

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };


  // Get severity badge color
  const getSeverityBadgeColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower === 'high' || severityLower === 'major') return 'bg-red-100 text-red-700';
    if (severityLower === 'medium') return 'bg-yellow-100 text-yellow-700';
    if (severityLower === 'low' || severityLower === 'minor') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Load staff members for assignment (only CAPAOwner role)
  const loadStaffMembers = async (deptId?: number) => {
    if (!deptId) return;
    
    setLoadingStaff(true);
    try {
      const users = await getAdminUsersByDepartment(deptId);
      // Filter only CAPAOwner role
      const capaOwners = (users || []).filter((user: any) => 
        user.roleName?.toLowerCase() === 'capaowner'
      );
      setStaffMembers(capaOwners.map((user: any) => ({
        userId: user.userId || user.id,
        fullName: user.fullName || user.name || user.email || 'Unknown',
        email: user.email,
      })));
    } catch (err: any) {
      console.error('Error loading staff members:', err);
      setStaffMembers([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Handle assign finding - show confirmation first
  const handleAssign = () => {
    // Reset errors
    setSelectedStaffError('');
    setDueDateError('');

    // Validate fields
    let hasError = false;

    if (!selectedStaff) {
      setSelectedStaffError('Please select a staff member');
      hasError = true;
    }

    if (!dueDate) {
      setDueDateError('Please select a due date');
      hasError = true;
    }

    if (!selectedFindingForAssign) {
      // This shouldn't happen, but handle it silently
      return;
    }

    // If validation passes, show confirmation modal
    if (!hasError) {
      setShowAssignConfirmModal(true);
    }
  };

  // Confirm and actually assign finding (create action)
  const handleConfirmAssign = async () => {
    if (!selectedFindingForAssign) {
      return;
    }

    setShowAssignConfirmModal(false);
    setSubmittingAssign(true);

    try {
      // First, mark finding as received
      await markFindingAsReceived(selectedFindingForAssign.findingId);
      
      // Then, create action
      await createAction({
        findingId: selectedFindingForAssign.findingId,
        title: selectedFindingForAssign.title,
        description: selectedFindingForAssign.description || '',
        assignedTo: selectedStaff,
        assignedDeptId: selectedFindingForAssign.deptId || 0,
        progressPercent: 0,
        dueDate: new Date(dueDate).toISOString(),
        reviewFeedback: '',
      });

      // Reset form and close modal
      setSelectedStaff('');
      setDueDate('');
      setSelectedStaffError('');
      setDueDateError('');
      setSelectedFindingForAssign(null);
      setShowAssignModal(false);
      
      // Optionally reload findings
      const deptId = getUserDeptId();
      if (deptId) {
        const data = await getFindingsByDepartment(deptId);
        setFindings(data);
      }
    } catch (err: any) {
      console.error('Error creating action:', err);
      // Show error in UI instead of alert
      setSelectedStaffError(err?.message || 'Failed to create action');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle close assign modal
  const handleCloseAssignModal = () => {
    setSelectedStaff('');
    setDueDate('');
    setSelectedStaffError('');
    setDueDateError('');
    setSelectedFindingForAssign(null);
    setShowAssignModal(false);
  };


  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

  // Pagination calculations
  const getTotalPages = () => {
    if (activeTab === 'progress') {
      return Math.ceil(actions.length / itemsPerPage);
    }
    return Math.ceil(filteredFindings.length / itemsPerPage);
  };

  const totalPages = getTotalPages();
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFindings = filteredFindings.slice(startIndex, endIndex);
  const paginatedActions = actions.slice(startIndex, endIndex);

  // Reset to page 1 when findings/actions or active tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [findings.length, actions.length, activeTab]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Findings Progress
          </h1>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading findings...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Findings Table */}
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-gray-200 bg-gray-50">
                <div className="flex space-x-1 px-4 sm:px-6" role="tablist">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'all'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    role="tab"
                  >
                    Findings List
                  </button>
                  <button
                    onClick={() => setActiveTab('progress')}
                    className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'progress'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    role="tab"
                  >
                    Progress
                  </button>
                </div>
              </div>

              {/* Progress Tab - Actions List */}
              {activeTab === 'progress' ? (
                loadingActions ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading actions...</p>
                  </div>
                ) : actions.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No actions found for your department</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Progress
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedActions.map((action) => (
                          <tr key={action.actionId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="text-sm font-medium text-gray-900 line-clamp-2">
                                {action.title}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary-600 h-2 rounded-full transition-all"
                                    style={{ width: `${action.progressPercent || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-600 min-w-[3rem]">
                                  {action.progressPercent || 0}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(action.dueDate)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 justify-end">
                                {action.status?.toLowerCase() === 'reviewed' && (
                                  <button
                                    onClick={() => {
                                      setSelectedActionId(action.actionId);
                                      setShowActionDetailModal(true);
                                      setSelectedActionForReview(action);
                                    }}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors active:scale-95"
                                    title="Review Action"
                                  >
                                    Review
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedActionId(action.actionId);
                                    setShowActionDetailModal(true);
                                    setSelectedActionForReview(null);
                                  }}
                                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95"
                                  title="View Details"
                                >
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Findings List Tabs */
                filteredFindings.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No findings found for your department</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Severity
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Deadline
                          </th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedFindings.map((finding) => (
                          <tr key={finding.findingId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="text-sm font-medium text-gray-900 line-clamp-2">
                                {finding.title}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityBadgeColor(finding.severity)}`}>
                                {finding.severity || 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(finding.deadline)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 justify-end">
                                {finding.status?.toLowerCase() === 'received' ? (
                                  <button
                                    disabled
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                    title="Already Assigned"
                                  >
                                    Assigned
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedFindingForAssign(finding);
                                      setShowAssignModal(true);
                                      loadStaffMembers(finding.deptId);
                                    }}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors active:scale-95"
                                    title="Assign Finding"
                                  >
                                    Assign
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedFindingId(finding.findingId);
                                    setShowDetailModal(true);
                                  }}
                                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95"
                                  title="View Details"
                                >
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Pagination */}
              {((activeTab === 'progress' && actions.length > 0) || (activeTab !== 'progress' && filteredFindings.length > 0)) && (
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Finding Detail Modal */}
        {selectedFindingId && (
          <FindingDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedFindingId(null);
            }}
            findingId={selectedFindingId}
          />
        )}

        {/* Assign Finding Modal */}
        {showAssignModal && selectedFindingForAssign && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCloseAssignModal}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Assign Finding</h2>
                  <button
                    onClick={handleCloseAssignModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Finding Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Finding
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{selectedFindingForAssign.title}</p>
                    </div>
                  </div>

                  {/* Staff Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Assign To (CAPA Owner) <span className="text-red-500">*</span>
                    </label>
                    {loadingStaff ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-gray-500">Loading CAPA owners...</span>
                      </div>
                    ) : (
                      <select
                        value={selectedStaff}
                        onChange={(e) => {
                          setSelectedStaff(e.target.value);
                          if (selectedStaffError) setSelectedStaffError('');
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                          selectedStaffError ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select CAPA Owner</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.userId} value={staff.userId}>
                            {staff.fullName} {staff.email ? `(${staff.email})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedStaffError && (
                      <p className="mt-1 text-xs text-red-600">{selectedStaffError}</p>
                    )}
                    {staffMembers.length === 0 && !loadingStaff && !selectedStaffError && (
                      <p className="mt-1 text-xs text-gray-500">No CAPA Owners found in this department</p>
                    )}
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        if (dueDateError) setDueDateError('');
                      }}
                      min={today}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        dueDateError ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {dueDateError && (
                      <p className="mt-1 text-xs text-red-600">{dueDateError}</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={handleCloseAssignModal}
                    disabled={submittingAssign}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={submittingAssign || !selectedStaff}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAssign ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Confirmation Modal */}
        {showAssignConfirmModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowAssignConfirmModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm Assign
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to assign this finding? The finding will be marked as received and an action will be created.
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignConfirmModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAssign}
                    disabled={submittingAssign}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAssign ? 'Assigning...' : 'Yes, Assign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Detail Modal */}
        {selectedActionId && (
          <ActionDetailModal
            isOpen={showActionDetailModal}
            onClose={() => {
              setShowActionDetailModal(false);
              setSelectedActionId(null);
              setSelectedActionForReview(null);
            }}
            actionId={selectedActionId}
            showReviewButtons={!!selectedActionForReview}
            onApprove={async (feedback) => {
              if (selectedActionForReview) {
                setProcessingReview(true);
                try {
                  await approveActionWithFeedback(selectedActionForReview.actionId, feedback || '');
                  setShowActionDetailModal(false);
                  setSelectedActionId(null);
                  setSelectedActionForReview(null);
                  // Reload actions
                  const deptId = getUserDeptId();
                  if (deptId) {
                    const actionsData = await getActionsByAssignedDept(deptId);
                    setActions(actionsData || []);
                  }
                } catch (err: any) {
                  console.error('Error approving action:', err);
                  // Don't show alert, just log error
                } finally {
                  setProcessingReview(false);
                }
              }
            }}
            onReject={async (feedback) => {
              if (selectedActionForReview) {
                setProcessingReview(true);
                try {
                  await rejectAction(selectedActionForReview.actionId, feedback || '');
                  setShowActionDetailModal(false);
                  setSelectedActionId(null);
                  setSelectedActionForReview(null);
                  // Reload actions
                  const deptId = getUserDeptId();
                  if (deptId) {
                    const actionsData = await getActionsByAssignedDept(deptId);
                    setActions(actionsData || []);
                  }
                } catch (err: any) {
                  console.error('Error rejecting action:', err);
                  // Don't show alert, just log error
                } finally {
                  setProcessingReview(false);
                }
              }
            }}
            isProcessing={processingReview}
          />
        )}

      </div>
    </MainLayout>
  );
};

export default FindingsProgress;
