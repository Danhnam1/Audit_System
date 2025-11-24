import { MainLayout, DepartmentIcon, UsersIcon, ChartBarIcon } from '../../../layouts';
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

      // Build map deptId -> Auditee Owner fullName
      const ownerMap: Record<string, string> = {}
      ;(userRes || []).forEach((u: any) => {
        const roleNormalized = String(u.roleName || '').toLowerCase().replace(/\s+/g, '')
        if (roleNormalized === 'auditeeowner' && u.deptId != null) {
          ownerMap[String(u.deptId)] = u.fullName || u.email || 'Unknown'
        }
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
        staffCount: d.staffCount ?? 0,
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
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Department Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage organizational departments and structure</p>
          </div>
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="primary"
            size="md"
          >
            + Create Department
          </Button>
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
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Departments List</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Auditee Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedDepartments.map((dept, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                  <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{rowNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{dept.name}</p>
                        
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-lg bg-primary-100 text-primary-700 text-xs font-bold">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-800">{dept.description}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-800">{dept.ownerName}</span>
                    </td>
                    {/* <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">
                        {dept.activeAudits}
                      </span>
                    </td> */}
                    {/* <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dept.status)}`}>
                        {dept.status}
                      </span>
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <Button onClick={() => openEdit(dept)} variant="primary" size="sm">
                          Edit
                        </Button>
                        <Button 
                          onClick={() => openDeleteModal(dept)} 
                          disabled={deletingId === (dept.deptId ?? dept.id)}
                          isLoading={deletingId === (dept.deptId ?? dept.id)}
                          variant="danger" 
                          size="sm"
                        >
                          Delete
                        </Button>
                        {dept.status === 'Inactive' && (
                          <Button variant="success" size="sm">
                              Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {paginatedDepartments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-sm text-gray-500 text-center">
                      Không có department nào
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
