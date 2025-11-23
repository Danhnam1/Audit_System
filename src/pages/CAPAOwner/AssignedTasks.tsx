import { useState, useEffect } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';
import { getMyAssignedActions, type Action } from '../../api/actions';
import ActionDetailModal from './ActionDetailModal';

interface Task {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  dueDate: string | null;
  assignedBy: string;
  createdAt: string;
  progressPercent: number;
}

const AssignedTasks = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed' | 'Overdue'>('All');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const actions = await getMyAssignedActions();
        
        // Map API actions to Task interface
        const mappedTasks: Task[] = actions.map((action) => {
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
            dueDate: action.dueDate || null,
            assignedBy: action.assignedBy || '',
            createdAt: action.createdAt || '',
            progressPercent: action.progressPercent || 0,
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

  const filteredTasks = filter === 'All' ? tasks : tasks.filter(task => task.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Assigned Tasks</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">View and manage your assigned audit tasks</p>
          </div>
          <button
            onClick={() => navigate('/capa-owner')}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['All', 'Pending', 'In Progress', 'Completed', 'Overdue'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
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

        {/* Tasks Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center">
                <p className="text-gray-500 text-sm sm:text-base">No tasks found for the selected filter</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.actionId} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="p-3 sm:p-4">
                    {/* Title, Due Date, Status and Eye Icon - All in one row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-800 break-words flex-1 min-w-0">
                        {task.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {task.dueDate && (
                          <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                            Due: {formatDate(task.dueDate)}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
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
                        <button
                          onClick={() => navigate(`/capa-owner/tasks/${task.actionId}/start`)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          Start
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
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${task.progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
      </div>
    </MainLayout>
  );
};

export default AssignedTasks;
