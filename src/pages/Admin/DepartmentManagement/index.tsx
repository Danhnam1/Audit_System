import { MainLayout, DepartmentIcon, UsersIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { StatCard, Pagination, Button } from '../../../components';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../../api/departments';
import { getAdminUsers } from '../../../api/adminUsers';
import { toast } from 'react-toastify';

const AdminDepartmentManagement = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [departments, setDepartments] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingDept, setEditingDept] = useState<{ deptId: number | null } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<any | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load departments from API on mount
  const fetchDepartmentsAndOwners = async () => {
    setLoading(true)
    try {
      // Fetch departments and users in parallel
      const [deptRes, userRes] = await Promise.all([
        getDepartments(),
        getAdminUsers(),
      ])

      // Build helper maps: deptId -> Auditee Owner fullName, deptId -> staff count
      const ownerMap: Record<string, string> = {}
      const staffCountMap: Record<string, number> = {}
      ;(userRes || []).forEach((u: any) => {
        if (u.deptId == null) return
        const deptKey = String(u.deptId)

        // capture owner name based on role
        const roleNormalized = String(u.roleName || '').toLowerCase().replace(/\s+/g, '')
        if (roleNormalized === 'auditeeowner') {
          ownerMap[deptKey] = u.fullName || u.email || 'Unknown'
        }

        // increment staff count
        staffCountMap[deptKey] = (staffCountMap[deptKey] || 0) + 1
      })

      // Map backend department shape to UI row shape with owner name
      const mapped = (deptRes || []).map((d: any, idx: number) => ({
        id: d.deptId ?? d.$id ?? `DEPT-${idx + 1}`,
        deptId: d.deptId ?? null,
        name: d.name || d.code || 'Unnamed',
        code: d.code || '-',
        ownerName: ownerMap[String(d.deptId ?? d.$id ?? '')] || '—',
        headName: d.headName || 'Not Assigned',
        headEmail: d.headEmail || '-',
        staffCount: staffCountMap[String(d.deptId ?? d.$id ?? '')] ?? 0,
        activeAudits: d.activeAudits ?? 0,
        createdDate: d.createdAt || d.createAt || null,
        description: d.description || '',
      }))
      setDepartments(mapped)
    } catch (err) {
      console.error('Failed to load departments', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartmentsAndOwners()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.code?.trim()) return
    try {
      setCreating(true)
      await createDepartment({ name: form.name.trim(), code: form.code.trim(), description: form.description?.trim() || '' })
      setForm({ name: '', code: '', description: '' })
      setShowCreateForm(false)
      toast.success('Department created successfully!')
      await fetchDepartmentsAndOwners()
    } catch (err) {
      console.error('Failed to create department', err)
      toast.error('Failed to create department. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (dept: any) => {
    setForm({ name: dept.name || '', code: dept.code || '', description: dept.description || '' })
    setEditingDept({ deptId: dept.deptId ?? dept.id ?? null })
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDept?.deptId) return
    if (!form.name?.trim() || !form.code?.trim()) return
    try {
      setUpdating(true)
      await updateDepartment(editingDept.deptId, { name: form.name.trim(), code: form.code.trim(), description: form.description?.trim() || '' })
      setEditOpen(false)
      setEditingDept(null)
      toast.success('Department updated successfully!')
      await fetchDepartmentsAndOwners()
    } catch (err) {
      console.error('Failed to update department', err)
      toast.error('Failed to update department. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const openDeleteModal = (dept: any) => {
    setDeptToDelete(dept);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeptToDelete(null);
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    const id = deptToDelete.deptId ?? deptToDelete.id;
    if (!id) return;
    
    try {
      setDeletingId(Number(id));
      await deleteDepartment(id);
      await fetchDepartmentsAndOwners();
      closeDeleteModal();
      toast.success('You have successfully deleted the department.');
    } catch (err) {
      console.error('Failed to delete department', err);
      toast.error('Failed to delete department. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Using imported getStatusColor from constants

  const stats = {
    total: departments.length,
    active: departments.filter(d => d.status === 'Active').length,
    totalStaff: departments.reduce((sum, d) => sum + d.staffCount, 0),
    totalAudits: departments.reduce((sum, d) => sum + d.activeAudits, 0),
  };

  // Pagination logic
  const totalPages = Math.ceil(departments.length / itemsPerPage);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [departments.length, totalPages, currentPage]);

  const paginatedDepartments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return departments.slice(startIndex, endIndex);
  }, [departments, currentPage]);

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-[#0b112b] border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Department Management</h1>
            <p className="text-white text-sm mt-1">Manage organizational departments and structure</p>
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
          {/* <StatCard title="Active Departments" value={stats.active.toString()} icon={<DepartmentIcon />} variant="primary-light" /> */}
          <StatCard title="Total Staff" value={stats.totalStaff.toString()} icon={<UsersIcon />} variant="primary-medium" />
          {/* <StatCard title="Active Audits" value={stats.totalAudits.toString()} icon={<ChartBarIcon />} variant="primary-dark" /> */}
        </div>

        {loading && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded">
            Loading departments…
          </div>
        )}

        {/* Create Department Form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Create New Department</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    type="text"
                    placeholder="e.g., Aircraft Engineering"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    type="text"
                    placeholder="e.g., AE"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Department description and responsibilities..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={creating} isLoading={creating} variant="primary" size="md">
                  Create Department
                </Button>
                <Button 
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {editOpen && (
          <form onSubmit={handleUpdate} className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Edit Department</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    type="text"
                    placeholder="Department name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    type="text"
                    placeholder="Code"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Description"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={updating} isLoading={updating} variant="primary" size="md">
                  Save Changes
                </Button>
                <Button 
                  type="button"
                  onClick={() => { setEditOpen(false); setEditingDept(null); }}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Departments Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden font-noto">
        <div className="bg-white p-4">
      
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className=" px-6 py-4 text-left text-sm  font-bold text-black uppercase tracking-wider">
                No.
              </th>
              <th className=" w-1/6 px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                Department Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold   text-black uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-4 text-left text-sm  font-bold text-black uppercase tracking-wider">
                Staff
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold   text-black uppercase tracking-wider">
                Description
              </th>
              <th className="w-1/6 px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                Auditee Owner
              </th>
              <th className="px-6 py-4 text-left text-sm  font-bold text-black uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
              <tbody className="bg-white">
                {paginatedDepartments.map((dept, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  
                  return (
                  <tr key={dept.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{rowNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                       
                        <span className="text-ms font-bold text-black">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-ms text-[#5b6166]">{dept.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-ms  text-[#5b6166]">{dept.staffCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-ms  text-[#5b6166]">{dept.description}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-ms font-noto  text-[#5b6166]">{dept.ownerName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(dept)}
                          className="p-1.5 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal(dept)}
                          disabled={deletingId === (dept.deptId ?? dept.id)}
                          className={`p-1.5 rounded transition-colors ${
                            deletingId === (dept.deptId ?? dept.id)
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                          }`}
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
                {paginatedDepartments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-sm text-gray-500 text-center">
                      No departments available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {departments.length > 0 && (
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={closeDeleteModal}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm Delete
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure to delete this department?
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    onClick={closeDeleteModal}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletingId !== null}
                    isLoading={deletingId !== null}
                    variant="danger"
                    size="md"
                  >
                    Delete
                  </Button>
            </div>
          </div>
        </div>
      </div>
        )}
    </MainLayout>
  );
};

export default AdminDepartmentManagement;
