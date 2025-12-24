import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { getDepartments } from '../../../api/departments';
import { toast } from 'react-toastify';
import {
  getDepartmentSensitiveAreas,
  createDepartmentSensitiveArea,
  updateDepartmentSensitiveArea,
  deleteDepartmentSensitiveArea,
  type DepartmentSensitiveAreaDto,
} from '../../../api/departmentSensitiveAreas';
import { FaShieldAlt, FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSearch, FaFilter, FaChevronDown } from 'react-icons/fa';

/**
 * Page for Admin to manage sensitive areas master data for each department
 * Master data này sẽ được suggest khi Auditor tạo audit plan
 */
const SensitiveAreaManagement = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  // Grouped by deptId: Map<deptId, { deptId, deptName, areas: Array<{id, sensitiveArea, level, defaultNotes}> }>
  const [departmentSensitiveAreas, setDepartmentSensitiveAreas] = useState<Map<string, {
    deptId: number | string;
    deptName: string;
    areas: Array<{ id?: number | string; sensitiveArea: string; level?: string; defaultNotes?: string }>;
  }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterHasArea, setFilterHasArea] = useState<'all' | 'has' | 'no'>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingData, setEditingData] = useState<{ deptId: string; data: DepartmentSensitiveAreaDto | null } | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesModalContent, setNotesModalContent] = useState<{ deptName: string; areas: Array<{ area: string; notes: string }> } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalContent, setDeleteModalContent] = useState<{ deptId: string; deptName: string; areas: Array<{ id?: number | string; sensitiveArea: string; level?: string }> } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load departments
      const deptRes: any = await getDepartments();
      const deptList = (deptRes || []).map((d: any) => ({
        deptId: d.deptId ?? d.$id ?? d.id,
        name: d.name || d.code || '—',
      }));
      setDepartments(deptList);

      // Load sensitive areas master data
      try {
        const sensitiveData = await getDepartmentSensitiveAreas();
        
        // Group records by deptId (each area is a separate record)
        const dataMap = new Map<string, {
          deptId: number | string;
          deptName: string;
          areas: Array<{ id?: number | string; sensitiveArea: string; level?: string; defaultNotes?: string }>;
        }>();
        
        if (Array.isArray(sensitiveData) && sensitiveData.length > 0) {
          sensitiveData.forEach((item: DepartmentSensitiveAreaDto) => {
            
            // Skip items with empty sensitiveArea (they might be invalid records)
            if (!item.sensitiveArea || item.sensitiveArea.trim() === '') {
              return; // Skip this item
            }
            
            const normalizedDeptId = String(item.deptId);
            const matchingDept = deptList.find((d: { deptId: number | string; name: string }) => String(d.deptId) === normalizedDeptId);
            
            if (matchingDept) {
              const finalDeptId = String(matchingDept.deptId);
              const existing = dataMap.get(finalDeptId);
              
              const areaData = {
                id: item.id,
                sensitiveArea: item.sensitiveArea.trim(), // Trim whitespace
                level: item.level || '',
                defaultNotes: item.defaultNotes || '',
              };
              
              
              if (existing) {
                // Add area to existing department
                existing.areas.push(areaData);
              } else {
                // Create new entry for department
                dataMap.set(finalDeptId, {
                  deptId: finalDeptId,
                  deptName: matchingDept.name,
                  areas: [areaData],
                });
              }
            } else {
              console.warn('[SensitiveAreaManagement] No matching department found for deptId:', normalizedDeptId, 'item:', item);
            }
          });
        }
        setDepartmentSensitiveAreas(dataMap);
      } catch (sensitiveErr: any) {
        // If API returns 404, it means no data yet (not an error)
        if (sensitiveErr?.response?.status === 404) {
          setDepartmentSensitiveAreas(new Map()); // Initialize empty map - no data yet
        } else {
          console.error('[SensitiveAreaManagement] Error loading sensitive areas:', sensitiveErr);
          toast.error('Failed to load sensitive areas: ' + (sensitiveErr?.response?.data?.message || sensitiveErr?.message || 'Unknown error'));
          setDepartmentSensitiveAreas(new Map());
        }
      }
    } catch (err) {
      console.error('Failed to load data', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddArea = (deptId: string) => {
    const input = newAreaInput.get(deptId)?.trim() || '';
    if (!input) return;

    const current = departmentSensitiveAreas.get(deptId);
    const dept = departments.find((d) => String(d.deptId) === deptId);

    if (current) {
      // Check if area already exists
      if (current.areas.some(a => a.sensitiveArea === input)) {
        setNewAreaInput(new Map(newAreaInput.set(deptId, '')));
        return;
      }
      // Add new area (without id - will be created on save)
      const updated = {
        ...current,
        areas: [...current.areas, { sensitiveArea: input, level: '', defaultNotes: '' }],
      };
      setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(deptId, updated)));
    } else {
      const newDept = {
        deptId: Number(deptId),
        deptName: dept?.name || deptId,
        areas: [{ sensitiveArea: input, level: '', defaultNotes: '' }],
      };
      setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(deptId, newDept)));
    }
    setNewAreaInput(new Map(newAreaInput.set(deptId, '')));
  };

  const handleRemoveArea = (deptId: string, areaIndex: number) => {
    const current = departmentSensitiveAreas.get(deptId);
    if (current) {
      const updated = {
        ...current,
        areas: current.areas.filter((_, idx) => idx !== areaIndex),
      };
      setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(deptId, updated)));
    }
  };

  const handleEdit = (deptId: string) => {
    const data = departmentSensitiveAreas.get(deptId);
    const dept = departments.find((d) => String(d.deptId) === deptId);
    // Convert grouped data to old format for modal (backward compatibility)
    const modalData: DepartmentSensitiveAreaDto = data ? {
      deptId: data.deptId,
      deptName: data.deptName,
      sensitiveArea: '', // Not used in modal
      defaultNotes: data.areas[0]?.defaultNotes || '',
    } : {
      deptId: Number(deptId),
      deptName: dept?.name || deptId,
      sensitiveArea: '',
      defaultNotes: '',
    };
    setEditingData({
      deptId,
      data: modalData,
    });
    setShowEditModal(true);
  };

  const handleSave = async (deptId: string) => {
    const data = departmentSensitiveAreas.get(deptId);
    if (!data || data.areas.length === 0) {
      return;
    }

    try {
      setLoading(true);
      
      // Save each area as a separate record
      const savePromises = data.areas.map(async (area) => {
        if (area.id) {
          // Update existing record
          return await updateDepartmentSensitiveArea(area.id, {
            deptId: data.deptId,
            sensitiveArea: area.sensitiveArea,
            level: area.level || '',
            defaultNotes: area.defaultNotes || '',
          });
        } else {
          // Create new record
          return await createDepartmentSensitiveArea({
            deptId: data.deptId,
            sensitiveArea: area.sensitiveArea,
            level: area.level || '',
            defaultNotes: area.defaultNotes || '',
          });
        }
      });
      
      await Promise.all(savePromises);
      toast.success(`Sensitive areas saved for ${data.deptName || deptId}`);
      
      // Reload data to get latest from server
      await loadData();
      setShowEditModal(false);
      setEditingData(null);
    } catch (error: any) {
      console.error('[SensitiveAreaManagement] Failed to save sensitive areas:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save sensitive areas';
      toast.error(errorMessage);
      // Reload data to get latest state
      try {
        await loadData();
      } catch (reloadErr) {
        console.error('[SensitiveAreaManagement] Failed to reload after save error:', reloadErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (deptId: string) => {
    const data = departmentSensitiveAreas.get(deptId);
    if (!data || data.areas.length === 0) return;

    setDeleteModalContent({
      deptId,
      deptName: data.deptName,
      areas: data.areas,
    });
    setShowDeleteModal(true);
  };

  const handleDeleteArea = async (areaId: number | string) => {
    if (!areaId) return;

    try {
      setLoading(true);
      await deleteDepartmentSensitiveArea(areaId);
      toast.success('Sensitive area deleted successfully');
      // Reload data
      await loadData();
      // Update modal content if still open
      if (deleteModalContent) {
        const updatedAreas = deleteModalContent.areas.filter(area => area.id !== areaId);
        if (updatedAreas.length === 0) {
          // Close modal if no areas left
          setShowDeleteModal(false);
          setDeleteModalContent(null);
        } else {
          setDeleteModalContent({
            ...deleteModalContent,
            areas: updatedAreas,
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to delete sensitive area', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete sensitive area';
      toast.error(errorMessage);
      // Reload data to get latest state
      try {
        await loadData();
      } catch (reloadErr) {
        console.error('Failed to reload after delete error:', reloadErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!deleteModalContent || deleteModalContent.areas.length === 0) return;

    try {
      setLoading(true);
      // Delete all area records that have an id (saved records)
      const areasToDelete = deleteModalContent.areas.filter(area => area.id);
      const deletePromises = areasToDelete.map(area => deleteDepartmentSensitiveArea(area.id!));
      
      await Promise.all(deletePromises);
      toast.success(`All sensitive areas deleted for ${deleteModalContent.deptName}`);
      // Reload data
      await loadData();
      // Close modal
      setShowDeleteModal(false);
      setDeleteModalContent(null);
    } catch (error: any) {
      console.error('Failed to delete all sensitive areas', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete sensitive areas';
      toast.error(errorMessage);
      // Reload data to get latest state
      try {
        await loadData();
      } catch (reloadErr) {
        console.error('Failed to reload after delete error:', reloadErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const getDeptLevel = (deptId: string): 'high' | 'medium' | 'low' | 'none' => {
    const config = departmentSensitiveAreas.get(deptId);
    if (!config || !config.areas || config.areas.length === 0) return 'none';
    const levels = config.areas.map((a) => String(a.level || '').toLowerCase());
    if (levels.some((l) => l.includes('high'))) return 'high';
    if (levels.some((l) => l.includes('medium'))) return 'medium';
    if (levels.some((l) => l.includes('low'))) return 'low';
    return 'none';
  };

  // Filter and search departments
  const filteredDepartments = useMemo(() => {
    let filtered = departments;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((dept: { deptId: number | string; name: string }) => 
        dept.name.toLowerCase().includes(query) || 
        String(dept.deptId).includes(query)
      );
    }

    // Filter by level (High/Medium/Low)
    if (filterLevel !== 'all') {
      filtered = filtered.filter((dept: { deptId: number | string; name: string }) => {
        const deptId = String(dept.deptId);
        const level = getDeptLevel(deptId);
        return level === filterLevel;
      });
    }

    // Filter by has area (có khu vực hay không)
    if (filterHasArea !== 'all') {
      filtered = filtered.filter((dept: { deptId: number | string; name: string }) => {
        const deptId = String(dept.deptId);
        const config = departmentSensitiveAreas.get(deptId);
        const hasConfig = config && config.areas && config.areas.length > 0;
        return filterHasArea === 'has' ? hasConfig : !hasConfig;
      });
    }

    return filtered;
  }, [departments, searchQuery, filterLevel, filterHasArea, departmentSensitiveAreas]);

  // Statistics
  const stats = useMemo(() => {
    // Total areas: count all sensitive areas across all departments
    let totalAreas = 0;
    let highLevel = 0;
    let mediumLevel = 0;
    let lowLevel = 0;
    
    departmentSensitiveAreas.forEach((config) => {
      if (config.areas && Array.isArray(config.areas)) {
        totalAreas += config.areas.length;
        config.areas.forEach(area => {
          const level = (area.level || '').toLowerCase();
          if (level.includes('high')) highLevel++;
          else if (level.includes('medium')) mediumLevel++;
          else lowLevel++;
        });
      }
    });

    const configured = departments.filter((dept: { deptId: number | string; name: string }) => {
      const deptId = String(dept.deptId);
      const config = departmentSensitiveAreas.get(deptId);
      return config && config.areas && config.areas.length > 0;
    }).length;
    const unconfigured = departments.length - configured;
    return { totalAreas, highLevel, mediumLevel, lowLevel, configured, unconfigured };
  }, [departments, departmentSensitiveAreas]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 pb-10 pt-8 space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-primary-100 bg-white shadow-sm px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500 font-semibold">Admin · Safety</p>
                <h1 className="text-3xl font-bold text-gray-900">Restricted Area Management</h1>
                <p className="text-sm text-gray-600">Manage sensitive areas by department with quick filters and inline editing.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const firstUnconfigured = filteredDepartments.find((d: { deptId: number | string; name: string }) => {
                      const deptId = String(d.deptId);
                      const config = departmentSensitiveAreas.get(deptId);
                      return !config || !config.areas || config.areas.length === 0;
                    });
                    if (firstUnconfigured) {
                      handleEdit(String(firstUnconfigured.deptId));
                    } else {
                      toast.info('All departments are configured');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold shadow-sm hover:bg-primary-700 transition-all duration-150 hover:shadow-md"
                >
                  <FaPlus className="w-4 h-4" />
                  Add Area
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalAreas}</div>
                <div className="text-xs text-gray-500">Total Areas</div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.highLevel}</div>
                <div className="text-xs text-gray-500">High Level</div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.mediumLevel}</div>
                <div className="text-xs text-gray-500">Medium Level</div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.lowLevel}</div>
                <div className="text-xs text-gray-500">Low Level</div>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="col-span-1 md:col-span-2 relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search area, room, building or department..."
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                />
              </div>
              <div className="relative">
                <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as 'all' | 'high' | 'medium' | 'low')}
                  className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white appearance-none cursor-pointer"
                >
                  <option value="all">All Levels</option>
                  <option value="high">High Level</option>
                  <option value="medium">Medium Level</option>
                  <option value="low">Low Level</option>
                </select>
                <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={filterHasArea}
                  onChange={(e) => setFilterHasArea(e.target.value as 'all' | 'has' | 'no')}
                  className="w-full pl-4 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white appearance-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="has">Has Area</option>
                  <option value="no">No Area</option>
                </select>
                <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">Departments: {departments.length}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">Configured: {stats.configured}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">Unconfigured: {stats.unconfigured}</span>
            </div>
          </div>

        {/* Table */}
        {loading && !departmentSensitiveAreas.size ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-200">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
            <p className="mt-5 text-sm font-medium text-gray-600">Loading...</p>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
              <FaSearch className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Found</h3>
            <p className="text-sm text-gray-600">
              {searchQuery || filterLevel !== 'all' || filterHasArea !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No data available.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Department</th>
                    <th className="w-[25%] px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Area</th>
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Level</th>
                    <th className="w-[25%] px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Notes</th>
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredDepartments.map((dept: { deptId: number | string; name: string }) => {
                    const deptId = String(dept.deptId);
                    const sensitiveData = departmentSensitiveAreas.get(deptId);
                    const hasConfig = sensitiveData && sensitiveData.areas && sensitiveData.areas.length > 0;
                    const level = getDeptLevel(deptId);
                    
                    return (
                      <tr key={deptId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{dept.name}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {hasConfig && sensitiveData.areas.length > 0 ? (
                              sensitiveData.areas.map((area, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200"
                                >
                                  {area.sensitiveArea}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {level === 'high' && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                              High
                            </span>
                          )}
                          {level === 'medium' && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                              Medium
                            </span>
                          )}
                          {level === 'low' && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                              Low
                            </span>
                          )}
                          {level === 'none' && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {hasConfig && sensitiveData.areas.length > 0 ? (
                            (() => {
                              // Check if any area has notes
                              const hasAnyNotes = sensitiveData.areas.some(area => area.defaultNotes && area.defaultNotes.trim() !== '');
                              
                              if (hasAnyNotes) {
                                return (
                                  <button
                                    onClick={() => {
                                      const areasWithNotes = sensitiveData.areas
                                        .filter(area => area.defaultNotes && area.defaultNotes.trim() !== '')
                                        .map(area => ({
                                          area: area.sensitiveArea,
                                          notes: area.defaultNotes || '',
                                        }));
                                      
                                      setNotesModalContent({
                                        deptName: dept.name,
                                        areas: areasWithNotes,
                                      });
                                      setShowNotesModal(true);
                                    }}
                                    className="text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium text-xs"
                                    title="Click to view all notes for this department"
                                  >
                                    Click for details
                                  </button>
                                );
                              } else {
                                return <span className="text-xs text-gray-400">—</span>;
                              }
                            })()
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(deptId)}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Update"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            {hasConfig && (
                              <button
                                onClick={() => handleDeleteClick(deptId)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredDepartments.length} / {departments.length} areas
              </p>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingData.data?.id ? 'Edit' : 'Add New'} Restricted Area
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingData(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Department: <span className="font-semibold">{editingData.data?.deptName || ''}</span></p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Add New Sensitive Area
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newAreaInput.get(editingData.deptId) || ''}
                      onChange={(e) => setNewAreaInput(new Map(newAreaInput.set(editingData.deptId, e.target.value)))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddArea(editingData.deptId);
                        }
                      }}
                      placeholder="Enter sensitive area name..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      onClick={() => handleAddArea(editingData.deptId)}
                      disabled={!newAreaInput.get(editingData.deptId)?.trim()}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {(() => {
                  const currentData = departmentSensitiveAreas.get(editingData.deptId);
                  const areas = currentData?.areas || [];
                  return areas.length > 0 && (
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700">
                        Sensitive Areas ({areas.length})
                      </label>
                      {areas.map((area, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">Area #{idx + 1}</span>
                            <button
                              onClick={() => handleRemoveArea(editingData.deptId, idx)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remove area"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Area Name *
                            </label>
                            <input
                              type="text"
                              value={area.sensitiveArea}
                              onChange={(e) => {
                                const currentData = departmentSensitiveAreas.get(editingData.deptId);
                                if (currentData) {
                                  const updated = {
                                    ...currentData,
                                    areas: currentData.areas.map((a, i) => i === idx ? { ...a, sensitiveArea: e.target.value } : a),
                                  };
                                  setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(editingData.deptId, updated)));
                                }
                              }}
                              placeholder="e.g., Airside Ramp, Secure Server Room"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Level
                            </label>
                            <select
                              value={area.level || ''}
                              onChange={(e) => {
                                const currentData = departmentSensitiveAreas.get(editingData.deptId);
                                if (currentData) {
                                  const updated = {
                                    ...currentData,
                                    areas: currentData.areas.map((a, i) => i === idx ? { ...a, level: e.target.value } : a),
                                  };
                                  setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(editingData.deptId, updated)));
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            >
                              <option value="">Select level</option>
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Default Notes
                            </label>
                            <textarea
                              value={area.defaultNotes || ''}
                              onChange={(e) => {
                                const currentData = departmentSensitiveAreas.get(editingData.deptId);
                                if (currentData) {
                                  const updated = {
                                    ...currentData,
                                    areas: currentData.areas.map((a, i) => i === idx ? { ...a, defaultNotes: e.target.value } : a),
                                  };
                                  setDepartmentSensitiveAreas(new Map(departmentSensitiveAreas.set(editingData.deptId, updated)));
                                }
                              }}
                              rows={3}
                              placeholder="Enter default notes for this area..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingData(null);
                    loadData();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(editingData.deptId)}
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaCheck className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && deleteModalContent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Delete Sensitive Areas</h2>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteModalContent(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Department: <span className="font-semibold">{deleteModalContent.deptName}</span></p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-700">
                    Select areas to delete ({deleteModalContent.areas.length} {deleteModalContent.areas.length === 1 ? 'area' : 'areas'})
                  </p>
                  {deleteModalContent.areas.filter(area => area.id).length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Delete All
                    </button>
                  )}
                </div>
                {deleteModalContent.areas.length > 0 ? (
                  <div className="space-y-2">
                    {deleteModalContent.areas.map((area, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{area.sensitiveArea || `Area #${idx + 1}`}</p>
                          {area.level && (
                            <p className="text-xs text-gray-500 mt-1">Level: {area.level}</p>
                          )}
                          {!area.id && (
                            <p className="text-xs text-amber-600 mt-1">(Not saved yet - will be removed from list)</p>
                          )}
                        </div>
                        {area.id ? (
                          <button
                            onClick={() => handleDeleteArea(area.id!)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                          >
                            <FaTrash className="w-3 h-3" />
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 px-3 py-1.5">Unsaved</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <p className="text-sm text-gray-600">No areas to delete</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteModalContent(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes Modal */}
        {showNotesModal && notesModalContent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Notes</h2>
                  <button
                    onClick={() => {
                      setShowNotesModal(false);
                      setNotesModalContent(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Department: <span className="font-semibold">{notesModalContent.deptName}</span></p>
              </div>
              <div className="p-6 space-y-4">
                {notesModalContent.areas.length > 0 ? (
                  notesModalContent.areas.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Area: {item.area}</h3>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes || 'No notes available'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <p className="text-sm text-gray-600">No notes available</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowNotesModal(false);
                    setNotesModalContent(null);
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </MainLayout>
  );
};

export default SensitiveAreaManagement;
