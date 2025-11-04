import { MainLayout, UsersIcon, SettingsIcon } from '../../../layouts';
import  useAuthStore  from '../../../store/useAuthStore';
import { useState } from 'react';
import { StatCard } from '../../../components';
import { getStatusColor } from '../../../constants';
import authService from '../../../hooks/auth';

interface CreateUserForm {
  fullName: string;
  email: string;
  password: string;
  role: string;
  deptId: string | null;
}

const AdminUserManagement = () => {
  
  const { user } = useAuthStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState<CreateUserForm>({
    fullName: '',
    email: '',
    password: '',
    role: '',
    deptId: null,
  });

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Vui lòng nhập email');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Email không hợp lệ');
      return false;
    }
    if (!formData.password) {
      setError('Vui lòng nhập mật khẩu');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return false;
    }
    if (!formData.role) {
      setError('Vui lòng chọn vai trò');
      return false;
    }
    // if (!formData.deptId) {
    //   setError('Vui lòng chọn phòng ban');
    //   return false;
    // }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        roleName: formData.role,
        deptId: null,
      });

      console.log('=== Registration Response Debug ===');
      console.log('Full response:', response);
      console.log('Response keys:', response ? Object.keys(response) : 'null');
      console.log('Response.status:', response?.status);
      console.log('Response.data:', response?.data);
      console.log('Response.message:', response?.message);
      console.log('Type of response:', typeof response);
      console.log('================================');
      
      // If we reach here without error, registration was successful
      // The API call didn't throw, so it succeeded
      setSuccess('Tạo người dùng thành công!');
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        role: '',
        deptId: null,
      });
   
      // Close form after 2 seconds
      setTimeout(() => {
        setShowCreateForm(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo người dùng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      role: '',
      deptId: null,
    });
    setError('');
    setSuccess('');
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const users = [
    {
      id: 'USR-001',
      fullName: 'John Smith',
      email: 'john.smith@aviation.edu',
  role: 'Auditor',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 09:30',
      createdDate: '2025-01-15',
    },
    {
      id: 'USR-002',
      fullName: 'Sarah Johnson',
      email: 'sarah.j@aviation.edu',
  role: 'Lead Auditor',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 08:15',
      createdDate: '2025-01-20',
    },
    {
      id: 'USR-003',
      fullName: 'Mike Chen',
      email: 'mike.chen@aviation.edu',
  role: 'Auditee Owner',
      department: 'Flight Operations',
      status: 'Active',
      lastLogin: '2025-10-24 16:45',
      createdDate: '2025-02-10',
    },
    {
      id: 'USR-004',
      fullName: 'Emily Davis',
      email: 'emily.d@aviation.edu',
  role: 'CAPA Owner',
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
  role: 'CAPA Owner',
      department: 'Training',
      status: 'Inactive',
      lastLogin: '2025-09-30 14:20',
      createdDate: '2025-02-28',
    },
    {
      id: 'USR-007',
      fullName: 'David Martinez',
      email: 'david.m@aviation.edu',
  role: 'Auditor',
      department: 'Quality Assurance',
      status: 'Active',
      lastLogin: '2025-10-25 08:45',
      createdDate: '2025-04-12',
    },
  ];

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'Auditor': 'bg-primary-100 text-primary-700',
      'Lead Auditor': 'bg-primary-200 text-primary-800',
      'Auditee Owner': 'bg-teal-100 text-teal-700',
      'CAPA Owner': 'bg-gray-100 text-gray-700',
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
    <MainLayout user={layoutUser}>
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
            
            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Enter full name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="abc@gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select 
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Select Role</option>
                      <option value="Admin">Admin</option>
                      <option value="LeadAuditor">Lead Auditor</option>
                      <option value="Auditor">Auditor</option>
                      <option value="AuditeeOwner">Auditee Owner</option>
                      <option value="CAPAOwner">CAPA Owner</option>
                      <option value="Director">Director</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department (Optional)</label>
                    <select 
                      name="deptId"
                      value={formData.deptId || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">No Department</option>
                      <option value="1">Quality Assurance</option>
                      <option value="2">Flight Operations</option>
                      <option value="3">Maintenance</option>
                      <option value="4">Training</option>
                      <option value="5">Safety</option>
                      <option value="6">Ground Operations</option>
                      <option value="7">Executive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password (min 6 characters)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                      minLength={6}
                    />
                  </div>
                
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? 'Creating...' : 'Create User'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
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
                <option value="Lead Auditor">Lead Auditor</option>
                <option value="Auditor">Auditor</option>
                <option value="Auditee Owner">Auditee Owner</option>
                <option value="CAPA Owner">CAPA Owner</option>
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
