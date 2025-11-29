import { useState, useEffect } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';
import { getMyAssignedActions, type Action } from '../../api/actions';
import ActionDetailModal from './ActionDetailModal';
import StartActionModal from './StartActionModal';

interface Task {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  originalStatus: string; // Original status from API
  dueDate: string | null;
  assignedBy: string;
  createdAt: string;
  progressPercent: number;
  reviewFeedback?: string | null; // Review feedback from API
}

const AssignedTasks = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'action' | 'reject'>('action');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedStartActionId, setSelectedStartActionId] = useState<string | null>(null);
  const [showReviewFeedbackModal, setShowReviewFeedbackModal] = useState(false);
  const [selectedReviewFeedback, setSelectedReviewFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const actions = await getMyAssignedActions();
        console.log('Actions from API:', actions);
        
        // Map API actions to Task interface
        const mappedTasks: Task[] = actions.map((action) => {
          console.log('Mapping action:', action.actionId, 'reviewFeedback:', action.reviewFeedback);
          // Determine UI status based on API status and due date
          let uiStatus: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' = 'Pending';
          
          if (action.status === 'Closed' || action.closedAt) {
            uiStatus = 'Completed';
          } else if (action.progressPercent > 0) {
            uiStatus = 'In Progress';
          } else if (action.status === 'Approved' || action.status === 'Open') {
            // Check if overdue
            if (action.dueDate) {
              const dueDate = new Date(action.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              if (dueDate < today) {
                uiStatus = 'Overdue';
              } else {
                uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
              }
            } else {
              uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
            }
          }
          
          return {
            actionId: action.actionId,
            findingId: action.findingId,
            title: action.title,
            description: action.description,
            status: uiStatus,
            originalStatus: action.status, // Keep original status from API
            dueDate: action.dueDate || null,
            assignedBy: action.assignedBy || '',
            createdAt: action.createdAt || '',
            progressPercent: action.progressPercent || 0,
            reviewFeedback: action.reviewFeedback, // Keep review feedback (can be string, null, or undefined)
          };
        });
        
        setTasks(mappedTasks);
      } catch (err: any) {
        console.error('Error fetching assigned tasks:', err);
        setError(err?.response?.data?.message || 'Failed to load assigned tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Filter tasks based on active tab
  const filteredTasksByTab = activeTab === 'reject' 
    ? tasks.filter(task => {
        // Filter actions with status "Declined" or "Rejected"
        const statusLower = task.originalStatus?.toLowerCase() || '';
        return statusLower === 'declined' || statusLower === 'rejected';
      })
    : tasks.filter(task => {
        // For action tab, exclude Declined/Rejected
        const statusLower = task.originalStatus?.toLowerCase() || '';
        return statusLower !== 'declined' && statusLower !== 'rejected';
      });

  // Sort tasks: Continue first, Start second, Completed last
  const sortedTasks = [...filteredTasksByTab].sort((a, b) => {
    // Get priority: Continue = 1, Start = 2, Completed = 3
    const getPriority = (progress: number) => {
      if (progress > 0 && progress < 100) return 1; // Continue
      if (progress === 0) return 2; // Start
      return 3; // Completed (100%)
    };
    
    const priorityA = getPriority(a.progressPercent);
    const priorityB = getPriority(b.progressPercent);
    
    return priorityA - priorityB;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent === 0) return 'bg-gray-300';
    if (percent <= 25) return 'bg-red-500';
    if (percent <= 50) return 'bg-yellow-500';
    if (percent <= 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const formatDate = (dateString: string | null) => {
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

  const handleViewDetail = (actionId: string) => {
    setSelectedActionId(actionId);
    setShowDetailModal(true);
  };

  const handleStart = (actionId: string) => {
    setSelectedStartActionId(actionId);
    setShowStartModal(true);
  };

  const handleStartSuccess = () => {
    // Reload tasks after successful start
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const actions = await getMyAssignedActions();
        
        const mappedTasks: Task[] = actions.map((action) => {
          let uiStatus: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' = 'Pending';
          
          if (action.status === 'Closed' || action.closedAt) {
            uiStatus = 'Completed';
          } else if (action.progressPercent > 0) {
            uiStatus = 'In Progress';
          } else if (action.status === 'Approved' || action.status === 'Open') {
            if (action.dueDate) {
              const dueDate = new Date(action.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              if (dueDate < today) {
                uiStatus = 'Overdue';
              } else {
                uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
              }
            } else {
              uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
            }
          }
          
          return {
            actionId: action.actionId,
            findingId: action.findingId,
            title: action.title,
            description: action.description,
            status: uiStatus,
            originalStatus: action.status, // Keep original status from API
            dueDate: action.dueDate || null,
            assignedBy: action.assignedBy || '',
            createdAt: action.createdAt || '',
            progressPercent: action.progressPercent || 0,
            reviewFeedback: action.reviewFeedback, // Keep review feedback (can be string, null, or undefined)
          };
        });
        
        setTasks(mappedTasks);
      } catch (err: any) {
        console.error('Error fetching assigned tasks:', err);
        setError(err?.response?.data?.message || 'Failed to load assigned tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Assigned Tasks</h1>
        </div>

        {/* Action Tab Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs */}
          <div className="flex space-x-1 px-4 sm:px-6 border-b border-gray-200" role="tablist">
            <button
              onClick={() => setActiveTab('action')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'action'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
            >
              Action
            </button>
            <button
              onClick={() => setActiveTab('reject')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'reject'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
            >
              Reject Action
            </button>
          </div>

          {/* Action Tab Content */}
          {(activeTab === 'action' || activeTab === 'reject') && (
            <div className="p-4 sm:p-6">
              {/* Loading State */}
              {loading && (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-500 mt-2">Loading tasks...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm sm:text-base">{error}</p>
                </div>
              )}

              {/* Tasks List */}
              {!loading && !error && (
                <div className="divide-y divide-gray-200">
                  {sortedTasks.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center">
                      <p className="text-gray-500 text-sm sm:text-base">No tasks found</p>
                    </div>
                  ) : (
                    sortedTasks.map((task) => (
                      <div key={task.actionId} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                        {/* Title, Due Date, Status and Start Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                          {/* Exclamation mark icon for reject tab - at the start */}
                          {activeTab === 'reject' && (
                            <button
                              onClick={() => {
                                const feedback = task.reviewFeedback;
                                console.log('Clicking feedback button, task.reviewFeedback:', task.reviewFeedback, 'Type:', typeof task.reviewFeedback, 'Full task:', task);
                                // Check if feedback exists and is not empty string
                                if (feedback && typeof feedback === 'string' && feedback.trim() !== '') {
                                  setSelectedReviewFeedback(feedback);
                                } else {
                                  setSelectedReviewFeedback('No feedback available');
                                }
                                setShowReviewFeedbackModal(true);
                              }}
                              className="p-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-full transition-colors flex-shrink-0"
                              title="View Review Feedback"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </button>
                          )}
                          <h3 className="text-sm sm:text-base font-semibold text-gray-800 break-words flex-1 min-w-0">
                            {task.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {task.dueDate && (
                              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                Due: {formatDate(task.dueDate)}
                              </span>
                            )}
                            {activeTab === 'reject' ? (
                              <button
                                onClick={() => handleStart(task.actionId)}
                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap min-w-[80px]"
                              >
                                Retry
                              </button>
                            ) : task.progressPercent === 100 ? (
                              <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap min-w-[80px] text-center inline-block">
                                Completed
                              </span>
                            ) : task.progressPercent > 0 ? (
                              <button
                                onClick={() => handleStart(task.actionId)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap min-w-[80px]"
                              >
                                Continue
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStart(task.actionId)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap min-w-[80px]"
                              >
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetail(task.actionId)}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                              title="View Details"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {task.progressPercent > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">Progress</span>
                              <span className="text-xs font-medium text-gray-800">{task.progressPercent}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`${getProgressColor(task.progressPercent)} h-1.5 rounded-full transition-all`}
                                style={{ width: `${task.progressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Detail Modal */}
        {selectedActionId && (
          <ActionDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedActionId(null);
            }}
            actionId={selectedActionId}
          />
        )}

        {/* Start Action Modal */}
        {selectedStartActionId && (
          <StartActionModal
            isOpen={showStartModal}
            onClose={() => {
              setShowStartModal(false);
              setSelectedStartActionId(null);
            }}
            onSuccess={handleStartSuccess}
            actionId={selectedStartActionId}
          />
        )}

        {/* Review Feedback Modal */}
        {showReviewFeedbackModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowReviewFeedbackModal(false);
                setSelectedReviewFeedback(null);
              }}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Review Feedback</h2>
                  <button
                    onClick={() => {
                      setShowReviewFeedbackModal(false);
                      setSelectedReviewFeedback(null);
                    }}
                    className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap break-words">
                      {selectedReviewFeedback || 'No feedback available'}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end">
                  <button
                    onClick={() => {
                      setShowReviewFeedbackModal(false);
                      setSelectedReviewFeedback(null);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AssignedTasks;
