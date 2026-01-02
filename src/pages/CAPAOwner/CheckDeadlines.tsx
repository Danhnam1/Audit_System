import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';
import { getStatusColor } from '../../constants';

interface Deadline {
  id: number;
  taskId: number;
  findingId: string;
  title: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  daysRemaining: number;
}

const CheckDeadlines = () => {
  const navigate = useNavigate();
  // Mock data
  const today = new Date();
  
  const deadlines: Deadline[] = [
    {
      id: 1,
      taskId: 1,
      findingId: 'F-2024-001',
      title: 'ISO 9001:2015 - Document Control Review',
      dueDate: '2024-11-15',
      priority: 'High',
      status: 'In Progress',
      daysRemaining: Math.ceil((new Date('2024-11-15').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    },
    {
      id: 2,
      taskId: 2,
      findingId: 'F-2024-002',
      title: 'Quality Management Process Audit',
      dueDate: '2024-11-20',
      priority: 'Medium',
      status: 'In Progress',
      daysRemaining: Math.ceil((new Date('2024-11-20').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    },
    {
      id: 3,
      taskId: 3,
      findingId: 'F-2024-003',
      title: 'Training Records Verification',
      dueDate: '2024-11-03',
      priority: 'High',
      status: 'Pending',
      daysRemaining: Math.ceil((new Date('2024-11-03').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    },
    {
      id: 4,
      taskId: 5,
      findingId: 'F-2024-005',
      title: 'Preventive Action Plan',
      dueDate: '2024-11-08',
      priority: 'High',
      status: 'Pending',
      daysRemaining: Math.ceil((new Date('2024-11-08').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    },
  ];

  const sortedDeadlines = [...deadlines].sort((a, b) => a.daysRemaining - b.daysRemaining);

  const overdueDeadlines = sortedDeadlines.filter(d => d.daysRemaining < 0);
  const urgentDeadlines = sortedDeadlines.filter(d => d.daysRemaining >= 0 && d.daysRemaining <= 3);
  const upcomingDeadlines = sortedDeadlines.filter(d => d.daysRemaining > 3 && d.daysRemaining <= 7);
  const futureDeadlines = sortedDeadlines.filter(d => d.daysRemaining > 7);

  const getUrgencyColor = (days: number) => {
    if (days < 0) return 'bg-red-100 border-red-500 text-red-800';
    if (days <= 3) return 'bg-orange-100 border-orange-500 text-orange-800';
    if (days <= 7) return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    return 'bg-green-100 border-green-500 text-green-800';
  };

  const getUrgencyLabel = (days: number) => {
    if (days < 0) return `${Math.abs(days)} day(s) overdue`;
    if (days === 0) return 'Due today!';
    if (days === 1) return 'Due tomorrow';
    return `${days} days remaining`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const normalizeStatus = (status: string): string => {
    switch (status) {
      case 'Completed': return 'Completed';
      case 'In Progress': return 'InProgress';
      case 'Pending': return 'Pending';
      default: return status;
    }
  };

  const DeadlineCard = ({ deadline }: { deadline: Deadline }) => (
    <div className={`p-4 rounded-lg border-l-4 ${getUrgencyColor(deadline.daysRemaining)}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-800">{deadline.title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(deadline.priority)}`}>
              {deadline.priority}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(normalizeStatus(deadline.status))}`}>
              {deadline.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <span>Finding: {deadline.findingId}</span>
            <span>Task #{deadline.taskId}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-700">
              Due: {new Date(deadline.dueDate).toLocaleDateString()}
            </span>
            <span className="font-semibold">
              ({getUrgencyLabel(deadline.daysRemaining)})
            </span>
          </div>
        </div>
        {deadline.daysRemaining < 0 && (
          <div className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Check Deadlines</h1>
            <p className="text-gray-600 mt-1">Monitor upcoming deadlines and overdue tasks</p>
          </div>
          <button
            onClick={() => navigate('/capa-owner/progress')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Progress
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overdueDeadlines.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Urgent (≤3 days)</p>
                <p className="text-3xl font-bold text-orange-600">{urgentDeadlines.length}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-3xl font-bold text-yellow-600">{upcomingDeadlines.length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Future</p>
                <p className="text-3xl font-bold text-green-600">{futureDeadlines.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Tasks */}
        {overdueDeadlines.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-red-600">Overdue Tasks</h2>
            </div>
            <div className="space-y-3">
              {overdueDeadlines.map(deadline => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>
        )}

        {/* Urgent Deadlines */}
        {urgentDeadlines.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-orange-600">Urgent - Due Within 3 Days</h2>
            </div>
            <div className="space-y-3">
              {urgentDeadlines.map(deadline => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming This Week */}
        {upcomingDeadlines.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-yellow-600">This Week</h2>
            </div>
            <div className="space-y-3">
              {upcomingDeadlines.map(deadline => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>
        )}

        {/* Future Deadlines */}
        {futureDeadlines.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-green-600">Future Deadlines</h2>
            </div>
            <div className="space-y-3">
              {futureDeadlines.map(deadline => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>
        )}

        {sortedDeadlines.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-lg">No deadlines to display</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckDeadlines;
