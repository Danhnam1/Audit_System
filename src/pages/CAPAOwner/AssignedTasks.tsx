import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: number;
  findingId: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  dueDate: string;
  assignedBy: string;
  createdAt: string;
}

const AssignedTasks = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed' | 'Overdue'>('All');

  // Mock data
  const tasks: Task[] = [
    {
      id: 1,
      findingId: 'F-2024-001',
      title: 'ISO 9001:2015 - Document Control Review',
      description: 'Review and verify document control procedures compliance',
      priority: 'High',
      status: 'Pending',
      dueDate: '2024-11-15',
      assignedBy: 'Nguyễn Văn A',
      createdAt: '2024-11-01',
    },
    {
      id: 2,
      findingId: 'F-2024-002',
      title: 'Quality Management Process Audit',
      description: 'Conduct audit on quality management processes',
      priority: 'Medium',
      status: 'In Progress',
      dueDate: '2024-11-20',
      assignedBy: 'Trần Thị B',
      createdAt: '2024-10-28',
    },
    {
      id: 3,
      findingId: 'F-2024-003',
      title: 'Training Records Verification',
      description: 'Verify training records for compliance',
      priority: 'High',
      status: 'Overdue',
      dueDate: '2024-11-03',
      assignedBy: 'Nguyễn Văn A',
      createdAt: '2024-10-25',
    },
    {
      id: 4,
      findingId: 'F-2024-004',
      title: 'Internal Audit Report Review',
      description: 'Review and validate internal audit findings',
      priority: 'Low',
      status: 'Completed',
      dueDate: '2024-10-30',
      assignedBy: 'Lê Văn C',
      createdAt: '2024-10-20',
    },
  ];

  const filteredTasks = filter === 'All' ? tasks : tasks.filter(task => task.status === filter);

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
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewDetail = (taskId: number) => {
    navigate(`/capa-owner/tasks/${taskId}`);
  };

  const handleUploadEvidence = (taskId: number) => {
    navigate(`/capa-owner/upload-evidence/${taskId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Assigned Tasks</h1>
            <p className="text-gray-600 mt-1">View and manage your assigned audit tasks</p>
          </div>
          <button
            onClick={() => navigate('/capa-owner')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No tasks found for the selected filter</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{task.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Finding ID</p>
                          <p className="font-medium text-gray-800">{task.findingId}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Assigned By</p>
                          <p className="font-medium text-gray-800">{task.assignedBy}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Due Date</p>
                          <p className="font-medium text-gray-800">{new Date(task.dueDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Created</p>
                          <p className="font-medium text-gray-800">{new Date(task.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetail(task.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                    {task.status !== 'Completed' && (
                      <button
                        onClick={() => handleUploadEvidence(task.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Upload Evidence
                      </button>
                    )}
                    {task.status === 'Pending' && (
                      <button
                        onClick={() => navigate(`/capa-owner/tasks/${task.id}/confirm`)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        Confirm Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AssignedTasks;
