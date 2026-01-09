import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pagination, Button } from '../../../components';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  getChecklistItemsByTemplate,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  type ChecklistTemplateDto,
  type CreateChecklistTemplateDto,
  type ChecklistItemDto,
  type CreateChecklistItemDto,
} from '../../../api/checklists';
import { getDepartments } from '../../../api/departments';
import { toast } from 'react-toastify';

const AdminChecklistManagement = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templateForm, setTemplateForm] = useState<CreateChecklistTemplateDto>({
    name: '',
    version: '',
    description: '',
    deptId: null,
    // status: 'Active',
    isActive: true,
  });
  const [departments, setDepartments] = useState<Array<{ deptId: number; name: string }>>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ templateId: string | null } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ChecklistTemplateDto | null>(null);
  
  // ChecklistItems management
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplateDto | null>(null);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [items, setItems] = useState<ChecklistItemDto[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [itemForm, setItemForm] = useState<CreateChecklistItemDto>({
    templateId: '',
    section: '',
    order: 0,
    questionText: '',
    answerType: 'Text',
    // status: 'Active',
    severityDefault: 'Medium',
  });
  const [editingItem, setEditingItem] = useState<{ itemId: string | null } | null>(null);
  const [updatingItem, setUpdatingItem] = useState(false);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ChecklistItemDto | null>(null);
  const [orderError, setOrderError] = useState<string>('');
  const [updatingOrders, setUpdatingOrders] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load templates from API on mount
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await getChecklistTemplates();
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load checklist templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await getDepartments();
        setDepartments(
          (depts || []).map((d: any) => ({
            deptId: d.deptId || d.id,
            name: d.name || '',
          })).filter((d: any) => d.deptId != null)
        );
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    loadDepartments();
  }, []);

  // Load items when template is selected
  const fetchItems = async (templateId: string) => {
    if (!templateId) return;
    setLoadingItems(true);
    try {
      const res = await getChecklistItemsByTemplate(templateId);
      setItems(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load checklist items. Please try again.');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name?.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      setCreating(true);
      const createPayload: any = {
        name: templateForm.name.trim(),
        status: templateForm.status || 'Active',
        isActive: templateForm.isActive ?? true,
      };
      
      // Only include optional fields if they have values
      if (templateForm.version?.trim()) {
        createPayload.version = templateForm.version.trim();
      }
      if (templateForm.description?.trim()) {
        createPayload.description = templateForm.description.trim();
      }
      // Include deptId only if it has a value (not null/undefined)
      if (templateForm.deptId != null && templateForm.deptId !== undefined) {
        createPayload.deptId = templateForm.deptId;
      }
      
      await createChecklistTemplate(createPayload);
      setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
      setShowCreateForm(false);
      toast.success('Checklist template created successfully!');
      await fetchTemplates();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to create template: ' + errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (template: ChecklistTemplateDto) => {
    setShowCreateForm(false);
    setTemplateForm({
      name: template.name || '',
      version: template.version || '',
      description: template.description || '',
      deptId: template.deptId ?? null,
      status: template.status || 'Active',
      isActive: template.isActive ?? true,
    });
    setEditingTemplate({ templateId: template.templateId || template.$id || null });
    setEditOpen(true);
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate?.templateId) return;
    if (!templateForm.name?.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      setUpdating(true);
      const updatePayload: any = {
        name: templateForm.name.trim(),
        status: templateForm.status || 'Active',
        isActive: templateForm.isActive ?? true,
      };
      
      // Only include optional fields if they have values
      if (templateForm.version?.trim()) {
        updatePayload.version = templateForm.version.trim();
      }
      if (templateForm.description?.trim()) {
        updatePayload.description = templateForm.description.trim();
      }
      // Include deptId - only if it has a value, otherwise don't send the field
      // Some backends prefer undefined over null for optional fields
      if (templateForm.deptId != null && templateForm.deptId !== undefined) {
        updatePayload.deptId = templateForm.deptId;
      }
      
      
      await updateChecklistTemplate(editingTemplate.templateId, updatePayload);
      setEditOpen(false);
      setEditingTemplate(null);
      toast.success('Checklist template updated successfully!');
      await fetchTemplates();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to update template: ' + errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (template: ChecklistTemplateDto) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setTemplateToDelete(null);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const id = templateToDelete.templateId || templateToDelete.$id;
    if (!id) return;

    try {
      // Backend will set isActive to false when delete is called
      await deleteChecklistTemplate(String(id));
      await fetchTemplates();
      closeDeleteModal();
      toast.success('Checklist template deleted successfully!');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to delete template: ' + errorMessage);
    }
  };

  const openItemsModal = async (template: ChecklistTemplateDto) => {
    setSelectedTemplate(template);
    setShowItemsModal(true);
    const templateId = template.templateId || template.$id;
    if (templateId) {
      await fetchItems(String(templateId));
    }
  };

  const closeItemsModal = () => {
    setShowItemsModal(false);
    setSelectedTemplate(null);
    setItems([]);
    setShowItemForm(false);
    setEditingItem(null);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    if (!itemForm.questionText?.trim()) {
      toast.error('Question text is required.');
      return;
    }
    
    // Validate order uniqueness
    const orderValue = itemForm.order || 0;
    const orderExists = items.some(item => item.order === orderValue);
    if (orderExists) {
      setOrderError(`Order ${orderValue} already exists. Please choose a different order.`);
      toast.error(`Order ${orderValue} already exists. Please choose a different order.`);
      return;
    }
    
    setOrderError('');
    const templateId = selectedTemplate.templateId || selectedTemplate.$id;
    if (!templateId) return;

    try {
      setCreatingItem(true);
      await createChecklistItem({
        templateId: String(templateId),
        section: itemForm.section?.trim() || undefined,
        order: orderValue,
        questionText: itemForm.questionText.trim(),
        answerType: itemForm.answerType || 'Text',
        status: itemForm.status || 'Active',
        severityDefault: itemForm.severityDefault || 'Medium',
      });
      setItemForm({
        templateId: '',
        section: '',
        order: 0,
        questionText: '',
        answerType: 'Text',
        status: 'Active',
        severityDefault: 'Medium',
      });
      setOrderError('');
      setShowItemForm(false);
      toast.success('Checklist item created successfully!');
      await fetchItems(String(templateId));
    } catch (err: any) {
      console.error('Failed to create item', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to create item: ' + errorMessage);
    } finally {
      setCreatingItem(false);
    }
  };

  const openEditItem = (item: ChecklistItemDto) => {
    setItemForm({
      templateId: item.templateId || '',
      section: item.section || '',
      order: item.order || 0,
      questionText: item.questionText || '',
      answerType: item.answerType || 'Text',
      status: item.status || 'Active',
      severityDefault: item.severityDefault || 'Medium',
    });
    setOrderError('');
    setEditingItem({ itemId: item.itemId || item.$id || null });
    setShowItemForm(true);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.itemId || !selectedTemplate) return;
    if (!itemForm.questionText?.trim()) {
      toast.error('Question text is required.');
      return;
    }
    
    // Validate order uniqueness (exclude current item being edited)
    const orderValue = itemForm.order || 0;
    const orderExists = items.some(item => {
      const itemId = item.itemId || item.$id;
      const editingItemId = editingItem.itemId;
      return item.order === orderValue && itemId !== editingItemId;
    });
    if (orderExists) {
      setOrderError(`Order ${orderValue} already exists. Please choose a different order.`);
      toast.error(`Order ${orderValue} already exists. Please choose a different order.`);
      return;
    }
    
    setOrderError('');
    const templateId = selectedTemplate.templateId || selectedTemplate.$id;
    if (!templateId) return;

    try {
      setUpdatingItem(true);
      await updateChecklistItem(editingItem.itemId, {
        section: itemForm.section?.trim() || undefined,
        order: orderValue,
        questionText: itemForm.questionText.trim(),
        answerType: itemForm.answerType || 'Text',
        status: itemForm.status || 'Active',
        severityDefault: itemForm.severityDefault || 'Medium',
      });
      setOrderError('');
      setShowItemForm(false);
      setEditingItem(null);
      toast.success('Checklist item updated successfully!');
      await fetchItems(String(templateId));
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to update item: ' + errorMessage);
    } finally {
      setUpdatingItem(false);
    }
  };

  const openDeleteItemModal = (item: ChecklistItemDto) => {
    setItemToDelete(item);
    setShowDeleteItemModal(true);
  };

  const closeDeleteItemModal = () => {
    setShowDeleteItemModal(false);
    setItemToDelete(null);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !selectedTemplate) return;
    const id = itemToDelete.itemId || itemToDelete.$id;
    if (!id) return;
    const templateId = selectedTemplate.templateId || selectedTemplate.$id;
    if (!templateId) return;

    try {
      await deleteChecklistItem(String(id));
      await fetchItems(String(templateId));
      closeDeleteItemModal();
      toast.success('Checklist item deleted successfully!');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to delete item: ' + errorMessage);
    }
  };

  // Filter templates to only show active ones (isActive !== false)
  const activeTemplates = useMemo(() => {
    return templates.filter((template) => template.isActive !== false);
  }, [templates]);

  // Sort items by order for display
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [items]);

  // Handle drag end - update order of items
  const buildItemUpdatePayload = (
    item: ChecklistItemDto,
    overrides: Partial<CreateChecklistItemDto> = {}
  ) => {
    const templateId = item.templateId || selectedTemplate?.templateId || selectedTemplate?.$id || '';
    return {
      templateId: String(templateId),
      section: item.section || undefined,
      order: item.order ?? 0,
      questionText: item.questionText || '',
      answerType: item.answerType || 'Text',
      status: item.status || 'Active',
      severityDefault: item.severityDefault || 'Medium',
      ...overrides,
    };
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedTemplate) return;

    const oldIndex = sortedItems.findIndex(
      (item) => (item.itemId || item.$id) === active.id
    );
    const newIndex = sortedItems.findIndex(
      (item) => (item.itemId || item.$id) === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const templateId = selectedTemplate.templateId || selectedTemplate.$id;
    if (!templateId) return;

    const previousItems = items;
    const reorderedItems = arrayMove(sortedItems, oldIndex, newIndex);
    const updatedItems = reorderedItems.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));
    const previousOrderMap = previousItems.reduce<Record<string, number | undefined>>((acc, item) => {
      const itemId = item.itemId || item.$id;
      if (itemId) {
        acc[itemId] = item.order;
      }
      return acc;
    }, {});

    setItems(updatedItems);

    try {
      setUpdatingOrders(true);

      for (const item of updatedItems) {
        const itemId = item.itemId || item.$id;
        if (!itemId) continue;
        if (previousOrderMap[itemId] === item.order) continue;

        await updateChecklistItem(String(itemId), buildItemUpdatePayload(item));
        }

      await fetchItems(String(templateId));
      toast.success('Items order updated successfully!');
    } catch (err: any) {
      setItems(previousItems);
      toast.error('Failed to update items order. Please try again.');
    } finally {
      setUpdatingOrders(false);
    }
  };

  // Sortable Row Component
  const SortableRow = ({ item, index }: { item: ChecklistItemDto; index: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: item.itemId || item.$id || `item-${index}`,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={`hover:bg-gray-50 ${isDragging ? 'bg-gray-100' : ''}`}
      >
        <td className="px-4 py-2 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
              title="Drag to reorder"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            <span className="text-sm text-gray-700">{item.order ?? index + 1}</span>
          </div>
        </td>
        <td className="px-4 py-2 text-center">
          <span className="text-sm text-gray-700">{item.section || '—'}</span>
        </td>
        <td className="px-4 py-2 text-center">
          <p className="text-sm text-gray-700 line-clamp-2">{item.questionText}</p>
        </td>
        <td className="px-4 py-2 text-center whitespace-nowrap">
          <span className="text-sm text-gray-700">{item.answerType || 'Text'}</span>
        </td>
        <td className="px-4 py-2 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => openEditItem(item)}
              className="p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => openDeleteItemModal(item)}
              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
  };

  // Pagination logic
  const totalPages = Math.ceil(activeTemplates.length / itemsPerPage);
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return activeTemplates.slice(startIndex, endIndex);
  }, [activeTemplates, currentPage]);

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-6 animate-slideInLeft">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Checklist Management</h1>
            <p className="text-[#5b6166] text-sm mt-1">Create, update, and manage checklist templates and items</p>
          </div>
          <button
            onClick={() => {
              setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
              setEditOpen(false);
              setEditingTemplate(null);
              setShowCreateForm(true);
            }}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:shadow-lg text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-md"
          >
            + Create Template
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Create Template Modal */}
        {showCreateForm && createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
              onClick={() => {
                setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                setShowCreateForm(false);
              }}
            />
            
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto animate-slideUp">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 rounded-t-xl flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Create New Checklist Template</h2>
                <button
                  onClick={() => {
                    setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                    setShowCreateForm(false);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleCreateTemplate} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        type="text"
                        placeholder="Template name"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                      <input
                        value={templateForm.version || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, version: e.target.value })}
                        type="text"
                        placeholder="e.g., 1.0"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={templateForm.description || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      rows={3}
                      placeholder="Template description..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow resize-none"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={templateForm.deptId || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, deptId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                    >
                      <option value="">Select Department (Optional)</option>
                      {departments.map((dept) => (
                        <option key={dept.deptId} value={dept.deptId}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={creating} isLoading={creating} variant="primary" size="md">
                      Create Template
                    </Button>
                    <Button 
                      type="button"
                      onClick={() => {
                        setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                        setShowCreateForm(false);
                      }}
                      variant="secondary"
                      size="md"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Template Modal */}
        {editOpen && createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
              onClick={() => {
                setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                setEditOpen(false);
                setEditingTemplate(null);
              }}
            />
            
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto animate-slideUp">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 rounded-t-xl flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Edit Checklist Template</h2>
                <button
                  onClick={() => {
                    setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                    setEditOpen(false);
                    setEditingTemplate(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleUpdateTemplate} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        type="text"
                        placeholder="Template name"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                      <input
                        value={templateForm.version || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, version: e.target.value })}
                        type="text"
                        placeholder="Version"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={templateForm.description || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      rows={3}
                      placeholder="Description"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow resize-none"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={templateForm.deptId || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, deptId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                    >
                      <option value="">Select Department (Optional)</option>
                      {departments.map((dept) => (
                        <option key={dept.deptId} value={dept.deptId}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={updating} isLoading={updating} variant="primary" size="md">
                      Save Changes
                    </Button>
                    <Button 
                      type="button"
                      onClick={() => {
                        setTemplateForm({ name: '', version: '', description: '', deptId: null, status: 'Active', isActive: true });
                        setEditOpen(false);
                        setEditingTemplate(null);
                      }}
                      variant="secondary"
                      size="md"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Templates Table */}
        {!loading && (
          <>
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200 font-noto">
              <div className="bg-white p-4">
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">No.</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Version</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedTemplates.map((template, idx) => {
                      const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={template.templateId || template.$id || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-700">{rowNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-ms font-bold text-black">{template.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-ms text-[#5b6166]">{template.version || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-ms text-[#5b6166]">
                              {template.deptId
                                ? departments.find((d) => d.deptId === template.deptId)?.name || `Dept ${template.deptId}`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-ms text-[#5b6166] line-clamp-2">{template.description || '—'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openItemsModal(template)}
                                className="p-1.5 text-blue-600 hover:bg-gray-100 rounded transition-colors"
                                title="Manage Items"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEdit(template)}
                                className="p-1.5 text-orange-400 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(template)}
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
                    {paginatedTemplates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          No templates found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {activeTemplates.length > 0 && (
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
          </>
        )}

        {loading && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            Loading templates...
          </div>
        )}
      </div>

      {/* Delete Template Confirmation Modal */}
      {showDeleteModal && templateToDelete && createPortal(
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
                Are you sure to delete this checklist template?
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
                  onClick={handleDeleteTemplate}
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

      {/* Checklist Items Modal */}
      {showItemsModal && selectedTemplate && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            onClick={closeItemsModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">
                  Checklist Items - {selectedTemplate.name}
                </h3>
                <button
                  onClick={closeItemsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <Button
                  onClick={() => {
                    // Auto-fill section with department name from template
                    let sectionValue = '';
                    if (selectedTemplate.deptId != null) {
                      const dept = departments.find(d => d.deptId === selectedTemplate.deptId);
                      sectionValue = dept?.name || String(selectedTemplate.deptId);
                    }
                    setItemForm({
                      templateId: selectedTemplate.templateId || selectedTemplate.$id || '',
                      section: sectionValue,
                      order: items.length,
                      questionText: '',
                      answerType: 'Text',
                      status: 'Active',
                      severityDefault: 'Medium',
                    });
                    setOrderError('');
                    setEditingItem(null);
                    setShowItemForm(true);
                  }}
                  variant="primary"
                  size="sm"
                >
                  + Add Item
                </Button>
              </div>

              {/* Create/Edit Item Form */}
              {showItemForm && (
                <form
                  onSubmit={editingItem ? handleUpdateItem : handleCreateItem}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4"
                >
                  <h4 className="text-md font-semibold text-gray-900 mb-3">
                    {editingItem ? 'Edit Item' : 'Create New Item'}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                        <input
                          value={itemForm.section || ''}
                          onChange={(e) => setItemForm({ ...itemForm, section: e.target.value })}
                          type="text"
                          placeholder="Section name"
                          readOnly={!editingItem}
                          className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ${
                            !editingItem 
                              ? 'bg-gray-100 cursor-not-allowed' 
                              : 'focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                          }`}
                        />
                        {!editingItem && (
                          <p className="text-xs text-gray-500 mt-1">
                            Auto-filled with department name from template
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                        <input
                          value={itemForm.order || 0}
                          onChange={(e) => {
                            const newOrder = parseInt(e.target.value) || 0;
                            setItemForm({ ...itemForm, order: newOrder });
                            // Clear error when user changes order
                            if (orderError) {
                              setOrderError('');
                            }
                          }}
                          type="number"
                          min="0"
                          className={`w-full border rounded-lg px-3 py-2 text-sm ${
                            orderError
                              ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                          }`}
                        />
                        {orderError && (
                          <p className="text-xs text-red-600 mt-1">{orderError}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
                      <textarea
                        value={itemForm.questionText}
                        onChange={(e) => setItemForm({ ...itemForm, questionText: e.target.value })}
                        rows={2}
                        placeholder="Enter question text"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Answer Type</label>
                         <select
                           value={itemForm.answerType || 'Text'}
                           onChange={(e) => setItemForm({ ...itemForm, answerType: e.target.value })}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                         >
                           {/* <option value="Text">Text</option> */}
                           <option value="Yes/No">Yes/No</option>
                           {/* <option value="Number">Number</option> */}
                           {/* <option value="Date">Date</option> */}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Severity Default</label>
                         <select
                           value={itemForm.severityDefault || 'Medium'}
                           onChange={(e) => setItemForm({ ...itemForm, severityDefault: e.target.value })}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                         >
                           <option value="Major">Major</option>
                           <option value="Medium">Medium</option>
                           
                           <option value="Minor">Minor</option>
                         </select>
                       </div>
                     </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={creatingItem || updatingItem} isLoading={creatingItem || updatingItem} variant="primary" size="sm">
                        {editingItem ? 'Save Changes' : 'Create Item'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setShowItemForm(false);
                          setEditingItem(null);
                          setOrderError('');
                        }}
                        variant="secondary"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {/* Items Table */}
              {loadingItems || updatingOrders ? (
                <div className="text-center py-8 text-gray-500">
                  {updatingOrders ? 'Updating order...' : 'Loading items...'}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Order</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Section</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Question</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Answer Type</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <SortableContext
                        items={sortedItems.map((item) => item.itemId || item.$id || '')}
                        strategy={verticalListSortingStrategy}
                      >
                        <tbody className="divide-y divide-gray-200">
                          {sortedItems.map((item, idx) => (
                            <SortableRow key={item.itemId || item.$id || idx} item={item} index={idx} />
                          ))}
                          {sortedItems.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                No items found. Click "Add Item" to create one.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Item Confirmation Modal */}
      {showDeleteItemModal && itemToDelete && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            onClick={closeDeleteItemModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto animate-slideUp">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure to delete this checklist item?
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  onClick={closeDeleteItemModal}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDeleteItem}
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

export default AdminChecklistManagement;

