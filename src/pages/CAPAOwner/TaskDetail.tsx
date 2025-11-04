import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useParams, useNavigate } from 'react-router-dom';

interface TaskDetail {
  id: number;
  findingId: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  assignedBy: string;
  createdAt: string;
  requirements: string[];
  notes: string;
}

const TaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Mock data
  const task: TaskDetail = {
    id: Number(taskId),
    findingId: 'F-2024-001',
    title: 'ISO 9001:2015 - Document Control Review',
    description: 'Review and verify document control procedures compliance with ISO 9001:2015 standards. Ensure all documents are properly controlled, reviewed, and approved.',
    priority: 'High',
    status: 'Pending',
    dueDate: '2024-11-15',
    assignedBy: 'Nguyễn Văn A',
    createdAt: '2024-11-01',
    requirements: [
      'Review all controlled documents',
      'Verify document approval process',
      'Check document version control',
      'Validate document distribution records',
      'Submit evidence of compliance',
    ],
    notes: 'Please focus on critical documents first. Contact me if you need any clarification.',
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleConfirmTask = () => {
    setShowConfirmModal(false);
    // API call to confirm task
    alert('Task confirmed successfully!');
  navigate('/capa-owner/tasks');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Task Details</h1>
            <p className="text-gray-600 mt-1">Task #{taskId}</p>
          </div>
          <button
            onClick={() => navigate('/capa-owner/tasks')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Tasks
          </button>
        </div>

        {/* Task Details Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-800">{task.title}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
              </div>
              <p className="text-gray-600">{task.description}</p>
            </div>
          </div>

          {/* Task Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 mb-1">Finding ID</p>
              <p className="font-semibold text-gray-800">{task.findingId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Assigned By</p>
              <p className="font-semibold text-gray-800">{task.assignedBy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Due Date</p>
              <p className="font-semibold text-gray-800">{new Date(task.dueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Created Date</p>
              <p className="font-semibold text-gray-800">{new Date(task.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Requirements */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Requirements</h3>
            <ul className="space-y-2">
              {task.requirements.map((req, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes from Assignor</h3>
              <p className="text-gray-700">{task.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            {task.status === 'Pending' && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Confirm Task
              </button>
            )}
            {task.status !== 'Completed' && (
              <button
                onClick={() => navigate(`/capa-owner/upload-evidence/${taskId}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Upload Evidence
              </button>
            )}
            <button
              onClick={() => navigate('/capa-owner/todo')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Add to To-Do
            </button>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Task</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to confirm this task? You will be responsible for completing it by the due date.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmTask}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default TaskDetail;
