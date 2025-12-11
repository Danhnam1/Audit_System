import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pagination, Button } from '../../../components';
import { getAuditCriteria, createAuditCriterion, updateAuditCriterion, deleteAuditCriterion, type AuditCriterionDto, type CreateCriterionDto } from '../../../api/auditCriteria';
import { toast } from 'react-toastify';

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
        publishedBy: '', // Always send empty string as backend requires this field
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
        publishedBy: '', // Always send empty string as backend requires this field
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
      <div>
        {/* Header */}
        <div className="mb-6 px-6 animate-slideInLeft">
          <div className="rounded-xl border-b shadow-sm border-primary-100 bg-white px-6 py-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Criteria Management</h1>
              <p className="text-gray-600 text-sm mt-1">Create, update, and manage audit criteria (standards)</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
            >
              + Create Criteria
            </button>
          </div>
        </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Create Criteria Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
              onClick={() => setShowCreateForm(false)}
            />
            
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100 animate-slideUp">
              <form onSubmit={handleCreate} className="flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Create New Criteria</h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
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
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        type="text"
                        placeholder="e.g., CAAV Circular 40/2015"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference Code</label>
                      <input
                        value={form.referenceCode || ''}
                        onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
                        type="text"
                        placeholder="e.g., CAAV"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={form.description || ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={4}
                      placeholder="Criteria description..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                    ></textarea>
                  </div>

                  <input type="hidden" value="" />
                </div>

                <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                  <Button 
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} isLoading={creating} variant="primary" size="md">
                    Create Criteria
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
              onClick={() => { setEditOpen(false); setEditingCriterion(null); }}
            />
            
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100 animate-slideUp">
              <form onSubmit={handleUpdate} className="flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Edit Criteria</h2>
                  <button
                    type="button"
                    onClick={() => { setEditOpen(false); setEditingCriterion(null); }}
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
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        type="text"
                        placeholder="Criteria name"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference Code</label>
                      <input
                        value={form.referenceCode || ''}
                        onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
                        type="text"
                        placeholder="Reference code"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={form.description || ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={4}
                      placeholder="Description"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                    ></textarea>
                  </div>

                  <input type="hidden" value="" />
                </div>

                <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                  <Button 
                    type="button"
                    onClick={() => { setEditOpen(false); setEditingCriterion(null); }}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updating} isLoading={updating} variant="primary" size="md">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Criteria Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200 font-noto">
          <div className="bg-white p-4">
          
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">No.</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Reference Code</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedCriteria.map((criterion, idx) => {
                      const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={criterion.criteriaId || criterion.$id || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-700">{rowNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-ms font-bold text-black">{criterion.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-ms text-[#5b6166]">{criterion.referenceCode || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-ms text-[#5b6166] line-clamp-2">{criterion.description || '—'}</p>
                          </td>
                          
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(criterion)}
                                className="p-1.5 text-orange-400 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(criterion)}
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
                    {paginatedCriteria.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-sm text-gray-500 text-center">
                          No criteria found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {criteria.length > 0 && (
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
      </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && criterionToDelete && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            onClick={closeDeleteModal}
          />
          
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto animate-slideUp">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Delete
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

