import { MainLayout, DashboardIcon, UsersIcon, DepartmentIcon, BackupIcon, ChartBarIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { StatCard } from '../../../components';
import { getStatusColor } from '../../../constants';

const AdminDepartmentManagement = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
    { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
    { icon: <DepartmentIcon />, label: 'Department Management', path: '/admin/departments' },
    { icon: <BackupIcon />, label: 'Backup & Restore', path: '/admin/backup' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const departments = [
    {
      id: 'DEPT-001',
      name: 'Quality Assurance',
      code: 'QA',
      headName: 'Sarah Johnson',
      headEmail: 'sarah.j@aviation.edu',
      staffCount: 12,
      activeAudits: 5,
      status: 'Active',
      createdDate: '2024-01-15',
    },
    {
      id: 'DEPT-002',
      name: 'Flight Operations',
      code: 'FO',
      headName: 'Mike Chen',
      headEmail: 'mike.chen@aviation.edu',
      staffCount: 28,
      activeAudits: 3,
      status: 'Active',
      createdDate: '2024-01-15',
    },
    {
      id: 'DEPT-003',
      name: 'Maintenance',
      code: 'MAINT',
      headName: 'David Martinez',
      headEmail: 'david.m@aviation.edu',
      staffCount: 35,
      activeAudits: 8,
      status: 'Active',
      createdDate: '2024-01-15',
    },
    {
      id: 'DEPT-004',
      name: 'Training',
      code: 'TRN',
      headName: 'Emily Davis',
      headEmail: 'emily.d@aviation.edu',
      staffCount: 18,
      activeAudits: 2,
      status: 'Active',
      createdDate: '2024-01-20',
    },
    {
      id: 'DEPT-005',
      name: 'Safety',
      code: 'SAF',
      headName: 'Robert Wilson',
      headEmail: 'robert.w@aviation.edu',
      staffCount: 15,
      activeAudits: 6,
      status: 'Active',
      createdDate: '2024-02-01',
    },
    {
      id: 'DEPT-006',
      name: 'Ground Operations',
      code: 'GO',
      headName: 'Lisa Anderson',
      headEmail: 'lisa.a@aviation.edu',
      staffCount: 22,
      activeAudits: 1,
      status: 'Active',
      createdDate: '2024-03-10',
    },
    {
      id: 'DEPT-007',
      name: 'Executive',
      code: 'EXEC',
      headName: 'John Smith',
      headEmail: 'john.smith@aviation.edu',
      staffCount: 8,
      activeAudits: 0,
      status: 'Active',
      createdDate: '2024-01-10',
    },
    {
      id: 'DEPT-008',
      name: 'IT Services',
      code: 'IT',
      headName: 'Not Assigned',
      headEmail: '-',
      staffCount: 0,
      activeAudits: 0,
      status: 'Inactive',
      createdDate: '2024-09-15',
    },
  ];

  // Using imported getStatusColor from constants

  const stats = {
    total: departments.length,
    active: departments.filter(d => d.status === 'Active').length,
    totalStaff: departments.reduce((sum, d) => sum + d.staffCount, 0),
    totalAudits: departments.reduce((sum, d) => sum + d.activeAudits, 0),
  };

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Department Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage organizational departments and structure</p>
          </div>
          <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create Department
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Departments" value={stats.total.toString()} icon={<DepartmentIcon />} variant="primary" />
          <StatCard title="Active Departments" value={stats.active.toString()} icon={<DepartmentIcon />} variant="primary-light" />
          <StatCard title="Total Staff" value={stats.totalStaff.toString()} icon={<UsersIcon />} variant="primary-medium" />
          <StatCard title="Active Audits" value={stats.totalAudits.toString()} icon={<ChartBarIcon />} variant="primary-dark" />
        </div>

        {/* Create Department Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Create New Department</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Aircraft Engineering"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., AE"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Head *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option>Select Department Head</option>
                    <option>John Smith</option>
                    <option>Sarah Johnson</option>
                    <option>Mike Chen</option>
                    <option>Emily Davis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    placeholder="dept.head@aviation.edu"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Department description and responsibilities..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">
                  Create Department
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

        {/* Departments Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Departments List</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Dept ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department Head</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Staff Count</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Active Audits</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{dept.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{dept.name}</p>
                        <p className="text-xs text-gray-500">Created: {dept.createdDate}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dept.headName}</p>
                        <p className="text-xs text-gray-500">{dept.headEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">
                        {dept.staffCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">
                        {dept.activeAudits}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dept.status)}`}>
                        {dept.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          View Staff
                        </button>
                        {dept.status === 'Inactive' && (
                          <>
                            <span className="text-gray-300">|</span>
                            <button className="text-green-600 hover:text-green-700 text-sm font-medium">
                              Activate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h3 className="text-lg font-semibold text-primary-600 mb-4">Top Departments by Staff</h3>
            <div className="space-y-3">
              {departments
                .sort((a, b) => b.staffCount - a.staffCount)
                .slice(0, 5)
                .map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded bg-primary-100 text-primary-700 text-xs font-bold">
                        {dept.code}
                      </span>
                      <span className="text-sm text-gray-700">{dept.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{dept.staffCount} staff</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h3 className="text-lg font-semibold text-primary-600 mb-4">Top Departments by Active Audits</h3>
            <div className="space-y-3">
              {departments
                .sort((a, b) => b.activeAudits - a.activeAudits)
                .slice(0, 5)
                .map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded bg-primary-100 text-primary-700 text-xs font-bold">
                        {dept.code}
                      </span>
                      <span className="text-sm text-gray-700">{dept.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{dept.activeAudits} audits</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminDepartmentManagement;
