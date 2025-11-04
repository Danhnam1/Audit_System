import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';

interface Finding {
  id: number;
  findingId: string;
  title: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';
  progress: number;
  dueDate: string;
  assignedTasks: number;
  completedTasks: number;
}

const FindingsProgress = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Not Started' | 'In Progress' | 'Completed' | 'Overdue'>('All');

  // Mock data
  const findings: Finding[] = [
    {
      id: 1,
      findingId: 'F-2024-001',
      title: 'ISO 9001:2015 - Document Control Review',
      status: 'In Progress',
      progress: 60,
      dueDate: '2024-11-15',
      assignedTasks: 5,
      completedTasks: 3,
    },
    {
      id: 2,
      findingId: 'F-2024-002',
      title: 'Quality Management Process Audit',
      status: 'In Progress',
      progress: 40,
      dueDate: '2024-11-20',
      assignedTasks: 4,
      completedTasks: 1,
    },
    {
      id: 3,
      findingId: 'F-2024-003',
      title: 'Training Records Verification',
      status: 'Overdue',
      progress: 25,
      dueDate: '2024-11-03',
      assignedTasks: 3,
      completedTasks: 0,
    },
    {
      id: 4,
      findingId: 'F-2024-004',
      title: 'Internal Audit Report Review',
      status: 'Completed',
      progress: 100,
      dueDate: '2024-10-30',
      assignedTasks: 2,
      completedTasks: 2,
    },
    {
      id: 5,
      findingId: 'F-2024-005',
      title: 'Corrective Action Implementation',
      status: 'Not Started',
      progress: 0,
      dueDate: '2024-11-25',
      assignedTasks: 6,
      completedTasks: 0,
    },
  ];

  const filteredFindings = filter === 'All' ? findings : findings.filter(f => f.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Not Started': return 'bg-gray-100 text-gray-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-600';
    if (progress >= 70) return 'bg-blue-600';
    if (progress >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const stats = {
    total: findings.length,
    inProgress: findings.filter(f => f.status === 'In Progress').length,
    completed: findings.filter(f => f.status === 'Completed').length,
    overdue: findings.filter(f => f.status === 'Overdue').length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Findings Progress</h1>
            <p className="text-gray-600 mt-1">Track the progress of your assigned findings</p>
          </div>
          <button
            onClick={() => navigate('/capa-owner')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Quick Actions - Sub-navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/capa-owner/todo')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left border-l-4 border-yellow-500"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800">View To-Do List</h3>
                <p className="text-sm text-gray-600">Manage your tasks</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/capa-owner/deadlines')}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left border-l-4 border-red-500"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800">Check Deadlines</h3>
                <p className="text-sm text-gray-600">Monitor urgent tasks</p>
              </div>
            </div>
          </button>

          <button
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left border-l-4 border-green-500 cursor-not-allowed opacity-60"
            disabled
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800">Update Status</h3>
                <p className="text-sm text-gray-600">Update task status</p>
              </div>
            </div>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Findings</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['All', 'Not Started', 'In Progress', 'Completed', 'Overdue'] as const).map((status) => (
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

        {/* Findings List */}
        <div className="space-y-4">
          {filteredFindings.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No findings found for the selected filter</p>
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <div key={finding.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{finding.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status)}`}>
                          {finding.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Finding ID: {finding.findingId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Due Date</p>
                      <p className="font-semibold text-gray-800">{new Date(finding.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm font-semibold text-gray-800">{finding.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(finding.progress)}`}
                        style={{ width: `${finding.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks Info */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-xs text-gray-600">Total Tasks</p>
                        <p className="text-lg font-semibold text-gray-800">{finding.assignedTasks}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Completed</p>
                        <p className="text-lg font-semibold text-green-600">{finding.completedTasks}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Remaining</p>
                        <p className="text-lg font-semibold text-orange-600">{finding.assignedTasks - finding.completedTasks}</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                      View Details
                    </button>
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

export default FindingsProgress;
