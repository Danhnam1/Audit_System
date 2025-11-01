import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { StatCard } from '../../../components';

const AdminDashboard = () => {
  const { user } = useAuth();


  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const navigationCards = [
    { title: 'Department Management', description: 'Create, update, and manage departments', color: 'from-primary-500 to-primary-600', link: '/admin/departments', stats: '8 Departments' },
    { title: 'User Management', description: 'Manage user accounts and roles', color: 'from-primary-400 to-primary-500', link: '/admin/users', stats: '142 Users' },
    { title: 'Backup & Restore', description: 'Database backup and restore operations', color: 'from-primary-600 to-primary-700', link: '/admin/backup', stats: 'Last: Today' },
  ];

  const recentActivities = [
    { user: 'John Smith', action: 'Created new user account', department: 'Flight Operations', time: '10 mins ago', type: 'create' },
    { user: 'Jane Doe', action: 'Updated department settings', department: 'Maintenance', time: '25 mins ago', type: 'update' },
    { user: 'Mike Wilson', action: 'Performed system backup', department: 'System', time: '1 hour ago', type: 'backup' },
    { user: 'Sarah Connor', action: 'Deleted inactive user', department: 'Training', time: '2 hours ago', type: 'delete' },
    { user: 'Tom Hardy', action: 'Updated user role', department: 'Safety', time: '3 hours ago', type: 'update' },
  ];

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      create: 'bg-teal-100 text-teal-700',
      update: 'bg-primary-100 text-primary-700',
      delete: 'bg-gray-200 text-gray-700',
      backup: 'bg-primary-200 text-primary-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Administrator Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">System Management & Configuration</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value="142" icon={<svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} variant="primary" />
          <StatCard title="Total Departments" value="8" icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} variant="primary-light" />
          <StatCard title="Last Backup" value="Today" icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>} variant="primary-medium" />
          <StatCard title="System Health" value="98%" icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} variant="primary-dark" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {navigationCards.map((card, index) => (
            <div key={index} className="bg-white rounded-xl border border-primary-100 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group overflow-hidden">
              <div className={`bg-gradient-to-r ${card.color} p-6 text-white`}>
                <h3 className="text-xl font-bold mb-1">{card.title}</h3>
                <p className="text-sm opacity-90">{card.description}</p>
              </div>
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">{card.stats}</span>
                  <button className="text-primary-600 hover:text-primary-700 font-medium text-sm group-hover:translate-x-1 transition-transform">Manage →</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary"><h2 className="text-lg font-semibold text-white">Recent Activities</h2></div>
          <div className="divide-y divide-gray-200">
            {recentActivities.map((activity, index) => (
              <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}> <div className="w-2 h-2 rounded-full bg-current"></div> </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{activity.action}</p>
                        <p className="text-xs text-gray-500 mt-1">Department: <span className="font-medium">{activity.department}</span></p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{activity.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200"><button className="text-primary-600 hover:text-primary-700 text-sm font-medium">View All Activities →</button></div>
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center gap-2">Create User</button>
            <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center gap-2">Create Department</button>
            <button className="bg-primary-800 hover:bg-primary-900 text-white px-4 py-3 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center gap-2">Backup Now</button>
            <button className="border-2 border-primary-400 text-primary-600 hover:bg-primary-50 px-4 py-3 rounded-lg font-medium transition-all duration-150 flex items-center justify-center gap-2">View Reports</button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
