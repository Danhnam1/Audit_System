import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pagination, Button } from '../../../components';
import { getAuditCriteria, createAuditCriterion, updateAuditCriterion, deleteAuditCriterion, type AuditCriterionDto, type CreateCriterionDto } from '../../../api/auditCriteria';
import { toast } from 'react-toastify';
import { getStatusColor } from '../../../constants';

const AdminCriteriaManagement = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [criteria, setCriteria] = useState<AuditCriterionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateCriterionDto>({ name: '', description: '', referenceCode: '', publishedBy: null });
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<{ criteriaId: string | null } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [criterionToDelete, setCriterionToDelete] = useState<AuditCriterionDto | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load criteria from API on mount
  const fetchCriteria = async () => {
    setLoading(true);
    try {
      const res = await getAuditCriteria();
      console.log('Fetched criteria:', res);
      setCriteria(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load criteria', err);
      toast.error('Failed to load criteria. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCriteria();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      setCreating(true);
      await createAuditCriterion({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        referenceCode: form.referenceCode?.trim() || undefined,
        publishedBy: form.publishedBy?.trim() || null,
      });
      setForm({ name: '', description: '', referenceCode: '', publishedBy: null });
      setShowCreateForm(false);
      toast.success('Criteria created successfully!');
      await fetchCriteria();
    } catch (err: any) {
      console.error('Failed to create criteria', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to create criteria: ' + errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (criterion: AuditCriterionDto) => {
    setForm({
      name: criterion.name || '',
      description: criterion.description || '',
      referenceCode: criterion.referenceCode || '',
      publishedBy: criterion.publishedBy || null,
    });
    setEditingCriterion({ criteriaId: criterion.criteriaId || null });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCriterion?.criteriaId) return;
    if (!form.name?.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      setUpdating(true);
      await updateAuditCriterion(editingCriterion.criteriaId, {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        referenceCode: form.referenceCode?.trim() || undefined,
        publishedBy: form.publishedBy?.trim() || null,
      });
      setEditOpen(false);
      setEditingCriterion(null);
      toast.success('Criteria updated successfully!');
      await fetchCriteria();
    } catch (err: any) {
      console.error('Failed to update criteria', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to update criteria: ' + errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (criterion: AuditCriterionDto) => {
    setCriterionToDelete(criterion);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCriterionToDelete(null);
  };

  const handleDelete = async () => {
    if (!criterionToDelete?.criteriaId) return;
    try {
      await deleteAuditCriterion(criterionToDelete.criteriaId);
      toast.success('You have successfully deleted the criteria.');
      closeDeleteModal();
      await fetchCriteria();
    } catch (err: any) {
      console.error('Failed to delete criteria', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to delete criteria: ' + errorMessage);
    }
  };

  // Pagination
  const paginatedCriteria = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return criteria.slice(start, end);
  }, [criteria, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(criteria.length / itemsPerPage);

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Criteria Management</h1>
            <p className="text-gray-600 text-sm mt-1">Create, update, and manage audit criteria (standards)</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="primary"
            size="md"
          >
            + Create Criteria
          </Button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Create Criteria Form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Create New Criteria</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    type="text"
                    placeholder="e.g., CAAV Circular 40/2015"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Code</label>
                  <input
                    value={form.referenceCode || ''}
                    onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
                    type="text"
                    placeholder="e.g., CAAV"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Criteria description..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Published By</label>
                <input
                  value={form.publishedBy || ''}
                  onChange={(e) => setForm({ ...form, publishedBy: e.target.value || null })}
                  type="text"
                  placeholder="e.g., CAAV, ICAO"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={creating} isLoading={creating} variant="primary" size="md">
                  Create Criteria
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
            <h2 className="text-lg font-semibold text-primary-600 mb-4">Edit Criteria</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    type="text"
                    placeholder="Criteria name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Code</label>
                  <input
                    value={form.referenceCode || ''}
                    onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
                    type="text"
                    placeholder="Reference code"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Description"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Published By</label>
                <input
                  value={form.publishedBy || ''}
                  onChange={(e) => setForm({ ...form, publishedBy: e.target.value || null })}
                  type="text"
                  placeholder="Published by"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={updating} isLoading={updating} variant="primary" size="md">
                  Save Changes
                </Button>
                <Button 
                  type="button"
                  onClick={() => { setEditOpen(false); setEditingCriterion(null); }}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Criteria Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Criteria List</h2>
          </div>
          
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">No.</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Reference Code</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Published By</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedCriteria.map((criterion, idx) => {
                      const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={criterion.criteriaId || criterion.$id || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className="text-sm font-medium text-primary-600">{rowNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-gray-900">{criterion.name}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700">{criterion.referenceCode || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-700 line-clamp-2">{criterion.description || '—'}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700">{criterion.publishedBy || '—'}</span>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(criterion.status || 'Active')}`}>
                              {criterion.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                onClick={() => openEdit(criterion)}
                                variant="primary"
                                size="sm"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => openDeleteModal(criterion)}
                                variant="danger"
                                size="sm"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedCriteria.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          No criteria found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && criterionToDelete && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeDeleteModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Criteria
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure to delete this criteria?
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
                  variant="danger"
                  size="md"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </MainLayout>
  );
};

export default AdminCriteriaManagement;

