import { MainLayout, UsersIcon, SettingsIcon } from '../../../layouts';
import  useAuthStore  from '../../../store/useAuthStore';
import { useState, useEffect } from 'react';
import { StatCard, Pagination } from '../../../components';
import authService from '../../../hooks/auth';
import { apiClient } from '../../../hooks/axios';
import { getDepartments } from '../../../api/departments';
import { toast } from 'react-toastify';

interface CreateUserForm {
  fullName: string;
  email: string;
  password: string;
  role: string;
  deptId: string | null;
}

interface ApiUser {
  $id?: string;
  userId?: string;
  email?: string;
  fullName?: string;
  roleName?: string;
  deptId?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  lastLogin?: string | null;
}

interface UIUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  deptId?: number | string | null;
  status: string;
  lastLogin?: string;
  createdDate?: string | null;
}

const AdminUserManagement = () => {
  
  const { user } = useAuthStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [users, setUsers] = useState<UIUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Array<{deptId?: number | string; name?: string}>>([]);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
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
  };
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      toast.error('Please enter the full name.');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter the email.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Invalid email address.');
      return false;
    }
    // For edit mode, password is optional; only validate on create
    if (!editingUserId) {
      if (!formData.password) {
        toast.error('Please enter the password.');
        return false;
      }
     if (formData.password.length < 6 || !specialCharRegex.test(formData.password)) {
  toast.error('Password must be at least 6 characters and contain at least one special character.');
  return false;
}
    }
    if (!formData.role) {
      toast.error('Please select a role.');
      return false;
    }
    // if (!formData.deptId) {
    //   toast.error('Please select a department.');
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

    try {
      // If editingUserId is set, perform update (PUT) instead of register
      if (editingUserId) {
        const updatePayload = {
          fullName: formData.fullName,
            roleName: formData.role,
          // Send null instead of 0 to indicate no department; backend typically treats null as absence
          deptId: formData.deptId ? Number(formData.deptId) : null,
          isActive: true,
          status: 'Active'
        }

        await apiClient.put(`/admin/AdminUsers/${editingUserId}`, updatePayload)

        toast.success('Edit user sucessfully');
        // refresh list and reset
        await fetchUsers()
        setEditingUserId(null)
        setFormData({ fullName: '', email: '', password: '', role: '', deptId: null })
        setShowCreateForm(false)

        return
      }

      const response = await authService.register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        roleName: formData.role,
        deptId: formData.deptId ? Number(formData.deptId) : null,
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
      await fetchUsers()
      toast.success('User created successfully!');
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        role: '',
        deptId: null,
      });
   
      setShowCreateForm(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.response?.data?.message || err.message || 'An error occurred while creating the user.');
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
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Fetch users from backend (extracted so it can be reused after mutations)
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch departments first so we can map deptId -> name
      let deptMap: Record<string, string> = {}
      try {
        const depts: any = await getDepartments()
        const deptArr = (depts || []).map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
        setDepartments(deptArr)
        deptArr.forEach((d: any) => {
          if (d.deptId != null) deptMap[String(d.deptId)] = d.name || '—'
        })
      } catch (err) {
        // ignore dept fetch errors, we'll show raw id
        console.warn('Failed to fetch departments', err)
      }

  // Use centralized API helper which normalizes envelopes
  const { getAdminUsers } = await import('../../../api/adminUsers');
  const values: ApiUser[] = (await getAdminUsers()) as any;

      const mapped: UIUser[] = (values || []).map(v => {
        const deptIdVal = v.deptId ?? null
        const deptIdStr = String(deptIdVal ?? '').trim()
        // Treat empty string or '0' (backend sentinel) as no department
        const hasDept = deptIdStr !== '' && deptIdStr !== '0'
        const departmentName = hasDept
          ? (deptMap[deptIdStr] || deptIdStr)
          : '—'

        return {
          userId: v.userId || '',
          fullName: v.fullName || 'N/A',
          email: v.email || 'N/A',
          role: v.roleName || 'N/A',
          deptId: deptIdVal,
          department: departmentName,
          status: v.isActive ? 'Active' : 'Inactive',
          lastLogin: v.lastLogin || 'Never',
          createdDate: v.createdAt || null,
        }
      })

      setUsers(mapped)
    } catch (err: any) {
      console.error('Failed to load admin users', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Helper to convert display role to select option value used in the form
  const convertRoleToOption = (roleDisplay: string) => {
    switch (roleDisplay) {
      case 'Lead Auditor':
        return 'LeadAuditor'
      case 'Auditee Owner':
        return 'AuditeeOwner'
      case 'CAPA Owner':
        return 'CAPAOwner'
      default:
        return roleDisplay
    }
  }

  const handleEdit = (u: UIUser) => {
    setFormData({
      fullName: u.fullName,
      email: u.email,
      password: '',
      role: convertRoleToOption(u.role),
      deptId: u.deptId != null ? String(u.deptId) : null,
    })
    setEditingUserId(u.userId)
    setShowCreateForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this user?')
    if (!confirmed) return

    try {
      await apiClient.delete(`/admin/AdminUsers/${id}`)
      toast.success('User deleted successfully!')
      // Refresh list
      fetchUsers()
      // Hide inactive users by default so the deleted (now inactive) user disappears
      setFilterStatus('Active')
    } catch (err: any) {
      console.error('Delete user failed', err)
      toast.error(err?.message || 'Failed to delete user.')
    }
  }

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

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRole, filterStatus]);

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
        {loadingUsers && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            Loading user list...
          </div>
        )}
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
            <h2 className="text-lg font-semibold text-primary-600 mb-4">{editingUserId ? 'Edit User' : 'Create New User'}</h2>

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
                      {departments.map(d => (
                        <option key={String(d.deptId)} value={String(d.deptId)}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  {!editingUserId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter password (min 8 characters)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                
                </div>

                <div className="flex gap-3 pt-2">
                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? (editingUserId ? 'Saving...' : 'Creating...') : (editingUserId ? 'Save Changes' : 'Create User')}
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
                <option value="LeadAuditor">Lead Auditor</option>
                <option value="Auditor">Auditor</option>
                <option value="AuditeeOwner">Auditee Owner</option>
                <option value="CAPAOwner">CAPA Owner</option>
                <option value="Director">Director</option>
              </select>
            </div>
            {/* <div>
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
            </div> */}
           
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  {/* <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th> */}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedUsers.map((usr, idx) => (
                  <tr key={usr.userId || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{startIndex + idx + 1}</span>
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
                    {/* <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(usr.status)}`}>
                        {usr.status}
                      </span>
                    </td> */}
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleEdit(usr)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(usr.userId)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredUsers.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminUserManagement;
