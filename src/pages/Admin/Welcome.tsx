import { MainLayout, DashboardIcon, UsersIcon, AuditIcon, ReportsIcon, DatabaseIcon, SettingsIcon, type SidebarTheme } from '../../layouts';
import { useAuth } from '../../contexts';

const AdminWelcome = () => {
  const { user } = useAuth();

  // Custom logo for Admin
  const adminLogo = (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
          <path d="M10 2L3 7v6c0 5.5 3.8 7.7 7 9 3.2-1.3 7-3.5 7-9V7l-7-5z" />
        </svg>
      </div>
      <span className="font-bold text-lg text-gray-800">AMS Admin</span>
    </div>
  );

  // Admin menu items
  const adminMenuItems = [
    {
      icon: <DashboardIcon />,
      label: 'Dashboard',
      path: '/admin',
    },
    {
      icon: <UsersIcon />,
      label: 'User Management',
      path: '/admin/users',
    },
    {
      icon: <AuditIcon />,
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      badge: '12',
    },
    {
      icon: <ReportsIcon />,
      label: 'Reports',
      path: '/admin/reports',
    },
    {
      icon: <DatabaseIcon />,
      label: 'Database',
      path: '/admin/database',
    },
    {
      icon: <SettingsIcon />,
      label: 'Settings',
      path: '/admin/settings',
    },
  ];

  // Admin teams/departments
  const departments = [
    { id: '1', name: 'IT Department', initial: 'IT' },
    { id: '2', name: 'HR Department', initial: 'HR' },
    { id: '3', name: 'Finance', initial: 'F' },
  ];

  // Convert auth user to layout user format
  const layoutUser = user ? {
    name: user.fullName,
    avatar: undefined,
  } : undefined;

  // Custom Sidebar theme (optional - sử dụng global primary colors)
  const adminSidebarTheme: SidebarTheme = {
    activeBg: 'bg-primary-50',
    activeText: 'text-primary-600',
    inactiveText: 'text-gray-700',
    hoverBg: 'hover:bg-gray-100',
    avatarBg: 'bg-primary-100',
    avatarText: 'text-primary-600',
    badgeBg: 'bg-primary-100',
    badgeText: 'text-primary-600',
  };

  return (
    <MainLayout
      logo={adminLogo}
      menuItems={adminMenuItems}
      teams={departments}
      user={layoutUser}
      sidebarTheme={adminSidebarTheme}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-primary rounded-lg p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Welcome, {user?.fullName}!</h1>
          <p className="mt-2 text-primary-100 text-base sm:text-lg">System Administrator Portal</p>
          <p className="mt-4 text-xs sm:text-sm text-primary-200">
            You are logged in as <span className="font-semibold">{user?.role}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">2,543</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+12.5%</span>
              <span className="ml-2 text-gray-600">from last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Audits</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">45</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+8.2%</span>
              <span className="ml-2 text-gray-600">from last week</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Departments</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">12</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">No change</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">98%</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">Excellent</span>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">User</th>
                  <th scope="col" className="px-6 py-3">Action</th>
                  <th scope="col" className="px-6 py-3">Department</th>
                  <th scope="col" className="px-6 py-3">Time</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">John Doe</td>
                  <td className="px-6 py-4">Created new audit</td>
                  <td className="px-6 py-4">IT Department</td>
                  <td className="px-6 py-4">5 mins ago</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                      Completed
                    </span>
                  </td>
                </tr>
                <tr className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">Jane Smith</td>
                  <td className="px-6 py-4">Updated user permissions</td>
                  <td className="px-6 py-4">HR Department</td>
                  <td className="px-6 py-4">15 mins ago</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
                      In Progress
                    </span>
                  </td>
                </tr>
                <tr className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">Bob Johnson</td>
                  <td className="px-6 py-4">Generated report</td>
                  <td className="px-6 py-4">Finance</td>
                  <td className="px-6 py-4">1 hour ago</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                      Completed
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminWelcome;
