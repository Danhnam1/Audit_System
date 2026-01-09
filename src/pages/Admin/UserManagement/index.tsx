import { MainLayout } from '../../../layouts';
import useAuthStore from '../../../store/useAuthStore';
import { useState, useEffect, useRef } from 'react';
import { Pagination } from '../../../components';
import authService from '../../../hooks/auth';
import { apiClient } from '../../../hooks/axios';
import { getDepartments } from '../../../api/departments';
import { bulkRegisterUsers } from '../../../api/adminUsers';
import { toast } from 'react-toastify';
import { validateRequired, validateEmail, validatePassword, validateSelected, SPECIAL_CHAR_REGEX } from '../../../helpers/formValidation';

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
  const [departments, setDepartments] = useState<Array<{ deptId?: number | string; name?: string }>>([]);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset password modal state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UIUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
  const validateForm = (): boolean => {
    // Validate full name
    const fullNameError = validateRequired(formData.fullName, 'Full name');
    if (fullNameError) {
      toast.error(fullNameError);
      return false;
    }

    // Validate email
    const emailError = validateEmail(formData.email, 'Email');
    if (emailError) {
      toast.error(emailError);
      return false;
    }

    // For edit mode, password is optional; only validate on create
    if (!editingUserId) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast.error(passwordError);
        return false;
      }
    }

    // Validate role
    const roleError = validateSelected(formData.role, 'Role');
    if (roleError) {
      toast.error(roleError);
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
        // Backend expects multipart/form-data with PascalCase keys
        const updateFormData = new FormData()
        updateFormData.append('FullName', formData.fullName)
        updateFormData.append('RoleName', formData.role)
        // Send empty string when no department to align with swagger
        updateFormData.append('DeptId', formData.deptId ? String(Number(formData.deptId)) : '')
        updateFormData.append('IsActive', 'true')
        updateFormData.append('Status', 'Active')
        // avatarFile optional: send an empty blob so backend accepts "required" field
        const emptyAvatar = new Blob([], { type: 'application/octet-stream' })
        updateFormData.append('avatarFile', emptyAvatar, '')

        await apiClient.put(`/admin/AdminUsers/${editingUserId}`, updateFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        } as any)

        toast.success('Edit user sucessfully');
        // refresh list and reset
        await fetchUsers()
        setEditingUserId(null)
        setFormData({ fullName: '', email: '', password: '', role: '', deptId: null })
        setShowCreateForm(false)

        return
      }

      await authService.register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        roleName: formData.role,
        deptId: formData.deptId ? Number(formData.deptId) : null,
      });



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



  // Using imported getStatusColor from constants

  const filteredUsers = users.filter(u => {
    const roleMatch = filterRole === 'all' || u.role === filterRole;
    const statusMatch = filterStatus === 'all' || u.status === filterStatus;
    const searchMatch = searchTerm === '' ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase());
    return roleMatch && statusMatch && searchMatch;
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

  // Handle file selection for import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));

      if (!isValid) {
        toast.error('Please select a valid Excel or CSV file (.xlsx, .xls, .csv)');
        e.target.value = '';
        return;
      }

      setImportFile(file);
    }
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setIsImporting(true);
    try {
      await bulkRegisterUsers(importFile);
      toast.success('Users imported successfully!');

      // Reset and close modal
      setImportFile(null);
      setShowImportModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh user list
      await fetchUsers();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to import users. Please check your file format.';
      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  // Close import modal
  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open reset password modal
  const handleOpenResetPassword = (user: UIUser) => {
    setSelectedUserForReset(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPasswordModal(true);
  };

  // Close reset password modal
  const handleCloseResetPasswordModal = () => {
    setShowResetPasswordModal(false);
    setSelectedUserForReset(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  // Handle reset password
  const handleResetPassword = async () => {
    // Validation
    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!SPECIAL_CHAR_REGEX.test(newPassword)) {
      toast.error('Password must contain at least one special character');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!selectedUserForReset?.email) {
      toast.error('User email not found');
      return;
    }

    setIsResettingPassword(true);
    try {
      await apiClient.post('/Auth/reset-password', {
        email: selectedUserForReset.email,
        newPassword: newPassword
      });

      toast.success(`Password reset successfully for ${selectedUserForReset.fullName}`);
      handleCloseResetPasswordModal();
    } catch (err: any) {
      console.error('Reset password error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="mb-6 px-6">
        <div className="rounded-xl border-b shadow-sm border-primary-100 bg-white px-6 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black">User Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
            >
              + Create User
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Search and Filter Section */}
        <div className="flex items-center justify-between gap-4">
          {/* Search Box */}
          <div className="flex-1 max-w-md flex items-center">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
              />
            </div>
             <div className="flex flex-wrap items-center justify-end gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2"></label>
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
         
          <div className="bg-white rounded-md px-4 p-2 shadow-sm border border-gray-200 gap-3 flex items-center">
            <p className="text-xs text-gray-600 font-medium">Total Users :</p>
            <p className="text-base font-bold text-black">{stats.total}</p>
          </div>
        </div>

        {loadingUsers && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded">
            Loading users…
          </div>
        )}

        {/* Create/Edit User Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
              onClick={handleCancel}
            />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100 animate-slideUp">
              <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">{editingUserId ? 'Edit User' : 'Create New User'}</h2>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Enter full name"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="abc@gmail.com"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department (Optional)</label>
                      <select
                        name="deptId"
                        value={formData.deptId || ''}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      >
                        <option value="">No Department</option>
                        {departments.map(d => (
                          <option key={String(d.deptId)} value={String(d.deptId)}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    {!editingUserId && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="Enter password (min 6 characters)"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                          required
                          minLength={6}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  >
                    {isSubmitting ? (editingUserId ? 'Saving...' : 'Creating...') : (editingUserId ? 'Save Changes' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

    

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden font-noto">
          <div className="bg-white p-4">

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">No.</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedUsers.map((usr, idx) => {
                    const rowNumber = startIndex + idx + 1;
                    return (
                      <tr key={usr.userId || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{rowNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
                              {usr.fullName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-ms font-bold text-black">{usr.fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-ms text-[#5b6166]">{usr.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-ms text-[#5b6166]">{usr.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-ms font-noto text-[#5b6166]">{usr.department}</span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(usr)}
                              className="p-1.5 text-orange-400 hover:bg-gray-100 rounded transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleOpenResetPassword(usr)}
                              className="p-1.5 text-yellow-600 hover:bg-gray-100 rounded transition-colors"
                              title="Reset Password"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(usr.userId)}
                              className="p-1.5 text-red-600 hover:bg-gray-100 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                        No users available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredUsers.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import Users Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-slideUp">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-semibold text-white">Import Users from File</h2>
              <button
                onClick={handleCloseImportModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel/CSV File *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="import-file-input"
                  />
                  <label
                    htmlFor="import-file-input"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">
                      {importFile ? importFile.name : 'Click to select file'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Supported formats: .xlsx, .xls, .csv
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">File Format:</h3>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Columns: FullName, Email, Password, RoleName, DeptId</li>
                  <li>RoleName values: Admin, LeadAuditor, Auditor, AuditeeOwner, CAPAOwner, Director</li>
                  <li>DeptId is optional (can be empty)</li>
                  <li>Password must be at least 6 characters with special character</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBulkImport}
                  disabled={!importFile || isImporting}
                  className={`flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${!importFile || isImporting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {isImporting ? 'Importing...' : 'Import Users'}
                </button>
                <button
                  onClick={handleCloseImportModal}
                  disabled={isImporting}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUserForReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-slideUp">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-semibold text-white">Reset Password</h2>
              <button
                onClick={handleCloseResetPasswordModal}
                disabled={isResettingPassword}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              {/* User Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                    {selectedUserForReset.fullName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedUserForReset.fullName}</p>
                    <p className="text-xs text-gray-600">{selectedUserForReset.email}</p>
                  </div>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={isResettingPassword}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters with at least one special character
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={isResettingPassword}
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-yellow-800">
                  This action will reset the user's password. The user will need to use the new password to log in.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || !newPassword || !confirmPassword}
                  className={`flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${isResettingPassword || !newPassword || !confirmPassword ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  onClick={handleCloseResetPasswordModal}
                  disabled={isResettingPassword}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AdminUserManagement;
