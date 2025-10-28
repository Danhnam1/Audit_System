import { MainLayout, DashboardIcon, UsersIcon, DepartmentIcon, BackupIcon, SettingsIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { StatCard } from '../../../components';
import { getStatusColor } from '../../../constants';

const AdminUserManagement = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
    { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
    { icon: <DepartmentIcon />, label: 'Department Management', path: '/admin/departments' },
    { icon: <BackupIcon />, label: 'Backup & Restore', path: '/admin/backup' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const users = [
    {
      id: 'USR-001',
      fullName: 'John Smith',
      email: 'john.smith@aviation.edu',
      role: 'SQA Staff',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 09:30',
      createdDate: '2025-01-15',
    },
    {
      id: 'USR-002',
      fullName: 'Sarah Johnson',
      email: 'sarah.j@aviation.edu',
      role: 'SQA Head',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 08:15',
      createdDate: '2025-01-20',
    },
    {
      id: 'USR-003',
      fullName: 'Mike Chen',
      email: 'mike.chen@aviation.edu',
      role: 'Department Head',
      department: 'Flight Operations',
      status: 'Active',
      lastLogin: '2025-10-24 16:45',
      createdDate: '2025-02-10',
    },
    {
      id: 'USR-004',
      fullName: 'Emily Davis',
      email: 'emily.d@aviation.edu',
      role: 'Department Staff',
      department: 'Maintenance',
      status: 'Active',
      lastLogin: '2025-10-25 07:00',
      createdDate: '2025-03-05',
    },
    {
      id: 'USR-005',
      fullName: 'Robert Wilson',
      email: 'robert.w@aviation.edu',
      role: 'Director',
      department: 'Executive',
      status: 'Active',
      lastLogin: '2025-10-25 10:00',
      createdDate: '2025-01-10',
    },
    {
      id: 'USR-006',
      fullName: 'Lisa Anderson',
      email: 'lisa.a@aviation.edu',
      role: 'Department Staff',
      department: 'Training',
      status: 'Inactive',
      lastLogin: '2025-09-30 14:20',
      createdDate: '2025-02-28',
    },
    {
      id: 'USR-007',
      fullName: 'David Martinez',
      email: 'david.m@aviation.edu',
      role: 'SQA Staff',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 08:45',
      createdDate: '2025-04-12',
    },
  ];

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'SQA Staff': 'bg-primary-100 text-primary-700',
      'SQA Head': 'bg-primary-200 text-primary-800',
      'Department Head': 'bg-teal-100 text-teal-700',
      'Department Staff': 'bg-gray-100 text-gray-700',
      'Director': 'bg-primary-300 text-primary-900',
      'Admin': 'bg-primary-200 text-primary-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  // Using imported getStatusColor from constants

  const filteredUsers = users.filter(u => {
    const roleMatch = filterRole === 'all' || u.role === filterRole;
    const statusMatch = filterStatus === 'all' || u.status === filterStatus;
    return roleMatch && statusMatch;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'Active').length,
    inactive: users.filter(u => u.status === 'Inactive').length,
    roles: new Set(users.map(u => u.role)).size,
  };

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">User Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage system users and permissions</p>
          </div>
          <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create User
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Users" value={stats.total.toString()} icon={<UsersIcon />} variant="primary" />
          <StatCard title="Active Users" value={stats.active.toString()} icon={<UsersIcon />} variant="primary-light" />
          <StatCard title="Inactive Users" value={stats.inactive.toString()} icon={<UsersIcon />} variant="gray" />
          <StatCard title="Unique Roles" value={stats.roles.toString()} icon={<SettingsIcon />} variant="primary-medium" />
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Create New User</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    placeholder="user@aviation.edu"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option>Select Role</option>
                    <option>Admin</option>
                    <option>SQA Head</option>
                    <option>SQA Staff</option>
                    <option>Department Head</option>
                    <option>Department Staff</option>
                    <option>Director</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option>Select Department</option>
                    <option>Quality Assurance</option>
                    <option>Flight Operations</option>
                    <option>Maintenance</option>
                    <option>Training</option>
                    <option>Safety</option>
                    <option>Ground Operations</option>
                    <option>Executive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">
                  Create User
                </button>
                <button 
                  onClick={() => setShowCreateForm(false)}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Role:</label>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="SQA Head">SQA Head</option>
                <option value="SQA Staff">SQA Staff</option>
                <option value="Department Head">Department Head</option>
                <option value="Department Staff">Department Staff</option>
                <option value="Director">Director</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <span className="text-sm text-gray-600">
              Showing {filteredUsers.length} of {users.length} user(s)
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Users List</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((usr) => (
                  <tr key={usr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{usr.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm mr-3">
                          {usr.fullName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{usr.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{usr.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(usr.role)}`}>
                        {usr.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{usr.department}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(usr.status)}`}>
                        {usr.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{usr.lastLogin}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          Reset Password
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-gray-700 hover:text-gray-900 text-sm font-medium">
                          {usr.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
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

export default AdminUserManagement;
