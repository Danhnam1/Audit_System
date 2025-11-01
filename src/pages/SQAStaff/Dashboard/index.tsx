import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getStatusColor, getPriorityColor } from '../../../constants';
import { StatCard, LineChartCard, BarChartCard, PieChartCard } from '../../../components';

const SQAStaffDashboard = () => {
  const { user } = useAuth();


  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const auditsByMonth = [
    { month: 'Jan', completed: 12, inProgress: 5, planned: 3 },
    { month: 'Feb', completed: 15, inProgress: 6, planned: 4 },
    { month: 'Mar', completed: 18, inProgress: 7, planned: 5 },
    { month: 'Apr', completed: 14, inProgress: 8, planned: 6 },
    { month: 'May', completed: 20, inProgress: 6, planned: 4 },
    { month: 'Jun', completed: 17, inProgress: 9, planned: 5 },
    { month: 'Jul', completed: 16, inProgress: 7, planned: 6 },
    { month: 'Aug', completed: 19, inProgress: 8, planned: 5 },
    { month: 'Sep', completed: 21, inProgress: 6, planned: 7 },
    { month: 'Oct', completed: 14, inProgress: 8, planned: 5 },
  ];

  const findingsByStatus = [
    { name: 'Resolved', value: 156, color: '#0369a1' },
    { name: 'In Progress', value: 42, color: '#7dd3fc' },
    { name: 'Open', value: 28, color: '#bae6fd' },
    { name: 'Overdue', value: 12, color: '#082f49' },
  ];

  const auditsByDepartment = [
    { department: 'Flight Ops', audits: 45 },
    { department: 'Maintenance', audits: 38 },
    { department: 'Safety', audits: 52 },
    { department: 'Training', audits: 31 },
    { department: 'Security', audits: 25 },
    { department: 'Ground Ops', audits: 29 },
  ];

  const audits = [
    { 
      id: 'AUD-2025-001', 
      title: 'Annual Safety Audit',
      domain: 'Safety',
      auditLead: 'John Smith',
      status: 'In Progress', 
      progress: 65, 
      nextMilestone: 'Fieldwork Start',
      dueDate: '2025-11-05',
      priority: 'High'
    },
    { 
      id: 'AUD-2025-002', 
      title: 'Maintenance Quality Check',
      domain: 'Maintenance',
      auditLead: 'Sarah Johnson',
      status: 'Under Review', 
      progress: 90, 
      nextMilestone: 'CAPA Due',
      dueDate: '2025-11-08',
      priority: 'Medium'
    },
    { 
      id: 'AUD-2025-003', 
      title: 'Training Compliance Review',
      domain: 'Training',
      auditLead: 'Mike Chen',
      status: 'Draft', 
      progress: 15, 
      nextMilestone: 'Kickoff Meeting',
      dueDate: '2025-11-12',
      priority: 'Low'
    },
    { 
      id: 'AUD-2025-004', 
      title: 'Ground Operations Audit',
      domain: 'Operations',
      auditLead: 'Emily Davis',
      status: 'In Progress', 
      progress: 45, 
      nextMilestone: 'Evidence Due',
      dueDate: '2025-11-10',
      priority: 'High'
    },
    { 
      id: 'AUD-2025-005', 
      title: 'Security Protocol Review',
      domain: 'Security',
      auditLead: 'Robert Lee',
      status: 'Overdue', 
      progress: 80, 
      nextMilestone: 'Draft Report',
      dueDate: '2025-10-28',
      priority: 'Critical'
    },
  ];

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">SQA Staff Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">Welcome back, {user?.fullName}</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Audits"
            value="8"
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Draft Plans"
            value="3"
            icon={
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
            variant="gray"
          />
          <StatCard
            title="Pending Review"
            value="5"
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Overdue Items"
            value="2"
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            variant="primary-dark"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button 
            onClick={() => window.location.href = '/sqa-staff/planning'}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Audit Plan
          </button>
          <button 
            onClick={() => window.location.href = '/sqa-staff/reports'}
            className="border border-primary-400 text-primary-600 hover:bg-primary-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Reports
          </button>
          <button 
            onClick={() => window.location.href = '/sqa-staff/findings'}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Manage Findings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LineChartCard
            title="Audit Trends (2025)"
            data={auditsByMonth}
            xAxisKey="month"
            lines={[
              { dataKey: 'completed', stroke: '#0369a1', name: 'Resolved' },
              { dataKey: 'inProgress', stroke: '#38bdf8', name: 'In Progress' },
              { dataKey: 'planned', stroke: '#bae6fd', name: 'Planned' },
            ]}
          />

          <PieChartCard title="Findings Distribution" data={findingsByStatus} />
        </div>

        <BarChartCard
          title="Audits by Department"
          data={auditsByDepartment}
          xAxisKey="department"
          bars={[{ dataKey: 'audits', fill: '#0369a1', name: 'Total Audits' }]}
        />

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Recent Audit Plans</h2>
            <button 
              onClick={() => window.location.href = '/sqa-staff/planning'}
              className="text-white hover:text-primary-100 text-sm font-medium flex items-center gap-1"
            >
              View All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title & Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Next Milestone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {audits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary-600">{audit.id}</span>
                        {audit.priority === 'Critical' && <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{audit.title}</p>
                      <p className="text-xs text-gray-500">{audit.domain}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{audit.auditLead}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(audit.status)}`}>{audit.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${audit.progress}%` }}></div>
                        </div>
                        <span className="text-sm text-gray-600 font-medium w-10">{audit.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{audit.nextMilestone}</p>
                      <p className={`text-xs ${getPriorityColor(audit.priority)} font-medium`}>Due: {audit.dueDate}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        <span className="text-gray-300">|</span>
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SQAStaffDashboard;
