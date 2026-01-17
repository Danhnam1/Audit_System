import React, { useState, useMemo, useEffect } from 'react';
import { getAuditChecklistTemplateMapsByAudit } from '../../../../../api/auditChecklistTemplateMaps';
import { getAuditsByPeriod, getAuditScopeDepartmentsByAuditId } from '../../../../../api/audits';
import { unwrap } from '../../../../../utils/normalize';

interface Step3ChecklistProps {
  checklistTemplates: any[];
  selectedTemplateIds: string[];
  onSelectionChange: (ids: string[]) => void;
  level?: string;
  selectedDeptIds?: string[];
  departments?: Array<{ deptId: number | string; name: string }>;
  periodFrom?: string;
  periodTo?: string;
  editingAuditId?: string | null;
}

export const Step3Checklist: React.FC<Step3ChecklistProps> = ({
  checklistTemplates,
  selectedTemplateIds,
  onSelectionChange,
  level = 'academy',
  selectedDeptIds = [],
  departments = [],
  periodFrom,
  periodTo,
  editingAuditId,
}) => {
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [usedTemplateIds, setUsedTemplateIds] = useState<Set<string>>(new Set());
  const [deptFilterId, setDeptFilterId] = useState<string>('all');

  // Match Admin behavior: only hide templates when isActive === false
  const activeChecklistTemplates = useMemo(() => {
    return (checklistTemplates || []).filter(
      (template: any) => template?.isActive !== false && template?.IsActive !== false
    );
  }, [checklistTemplates]);

  const deptNameById = useMemo(() => {
    const map = new Map<string, string>();
    (departments || []).forEach((d) => {
      if (d?.deptId == null) return;
      map.set(String(d.deptId), d.name);
    });
    return map;
  }, [departments]);

  const templateDeptIds = useMemo(() => {
    const ids = new Set<string>();
    (activeChecklistTemplates || []).forEach((t: any) => {
      if (t?.deptId == null) return;
      ids.add(String(t.deptId).trim());
    });
    return Array.from(ids);
  }, [activeChecklistTemplates]);

  const hasGeneralTemplates = useMemo(() => {
    return (activeChecklistTemplates || []).some((t: any) => t?.deptId == null);
  }, [activeChecklistTemplates]);

  const deptFilterOptions = useMemo(() => {
    // Department level: filter options should follow selected departments (Step 2)
    if (level === 'department' && selectedDeptIds.length > 0) {
      const ids = selectedDeptIds.map((id) => String(id).trim());
      return ids;
    }

    // Academy (Entire Aviation Academy) or no depts selected: derive from templates
    return templateDeptIds;
  }, [level, selectedDeptIds, templateDeptIds]);

  // Keep department filter valid when selected departments change
  useEffect(() => {
    if (deptFilterId === 'all') return;

    // In department level, only allow filtering by selected departments
    if (level === 'department') {
      // "General" doesn't apply at department level (general templates are already excluded there)
      if (deptFilterId === '__general__') {
        setDeptFilterId('all');
        return;
      }

      if (selectedDeptIds.length > 0) {
        const selectedSet = new Set((selectedDeptIds || []).map((id) => String(id).trim()));
        if (!selectedSet.has(String(deptFilterId).trim())) {
          setDeptFilterId('all');
        }
      }
    } else {
      // In academy level, keep filter if it's still present in templates
      if (deptFilterId !== '__general__') {
        const availableSet = new Set((templateDeptIds || []).map((id) => String(id).trim()));
        if (!availableSet.has(String(deptFilterId).trim())) {
          setDeptFilterId('all');
        }
      } else if (!hasGeneralTemplates) {
        setDeptFilterId('all');
      }
    }
  }, [level, selectedDeptIds, deptFilterId]);

  const templateDeptMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    (activeChecklistTemplates || []).forEach((tpl: any) => {
      const id = String(tpl.templateId || tpl.id || tpl.$id || '');
      if (!id) return;
      const deptId = tpl.deptId != null ? String(tpl.deptId) : undefined;
      map[id] = deptId;
    });
    return map;
  }, [activeChecklistTemplates]);

  // Load used templates for selected departments (không filter theo thời gian, chỉ filter theo department)
  useEffect(() => {
    const loadUsedTemplates = async () => {
      if (level !== 'department' || selectedDeptIds.length === 0) {
        setUsedTemplateIds(new Set());
        return;
      }

      try {
        
        // Lấy audits trong period để check (cần period để có audits, nhưng không filter template theo thời gian)
        // Nếu không có period, không thể check được
        if (!periodFrom || !periodTo) {
          setUsedTemplateIds(new Set());
          return;
        }

        const auditsInPeriod = await getAuditsByPeriod(periodFrom, periodTo);
        
        // Unwrap response to handle different formats
        let auditsToCheck = unwrap(auditsInPeriod);
        
        // Filter out inactive and deleted audits
        auditsToCheck = auditsToCheck.filter((a: any) => {
          const status = String(a.status || '').toLowerCase().replace(/\s+/g, '');
          const isActive = status !== 'inactive' && status !== 'deleted';
          if (!isActive) {
          }
          return isActive;
        });
        
        
        // Filter out current audit if editing
        if (editingAuditId) {
          auditsToCheck = auditsToCheck.filter((a: any) => 
            String(a.auditId || a.id) !== String(editingAuditId)
          );
        }

        const usedTemplateSet = new Set<string>();

        // Với mỗi audit, check xem có trùng department không
        // Lưu ý: Chỉ filter những template đã được chọn của phòng đó, không quan tâm thời gian
        for (const audit of auditsToCheck) {
          try {
            const auditId = String(audit.auditId || audit.id);
            const scopeDepts = await getAuditScopeDepartmentsByAuditId(auditId);
            
            // Unwrap scope departments response
            const scopeDeptArray = unwrap(scopeDepts);
            
            // Check xem audit này có department nào trùng với selectedDeptIds không
            const hasMatchingDept = scopeDeptArray.some((sd: any) => 
              selectedDeptIds.includes(String(sd.deptId))
            );

            if (hasMatchingDept) {
              
              // Lấy checklist templates đã được dùng trong audit này
              const templateMaps = await getAuditChecklistTemplateMapsByAudit(auditId);
              
              // Unwrap template maps response
              const mapsArray = unwrap(templateMaps);
              
              mapsArray.forEach((map: any) => {
                const templateId = String(map.templateId || map.id || map);
                usedTemplateSet.add(templateId);
              });
            }
          } catch (err) {
            console.warn(`[Step3Checklist] Failed to get templates for audit ${audit.auditId}:`, err);
          }
        }

        setUsedTemplateIds(usedTemplateSet);
      } catch (error) {
        console.error('[Step3Checklist] Error loading used templates:', error);
        setUsedTemplateIds(new Set());
      }
    };

    loadUsedTemplates();
  }, [level, selectedDeptIds, periodFrom, periodTo, editingAuditId]);

  // Check which departments are missing templates
  const missingTemplateDepts = useMemo(() => {
    if (level !== 'department' || selectedDeptIds.length === 0) {
      return [];
    }

    const selectedTemplates = activeChecklistTemplates.filter((tpl: any) =>
      selectedTemplateIds.includes(String(tpl.templateId || tpl.id || tpl.$id))
    );

    const selectedDeptIdsSet = new Set(selectedDeptIds.map(id => String(id).trim()));
    const deptIdsWithTemplates = new Set<string>();

    selectedTemplates.forEach((tpl: any) => {
      const tplDeptId = tpl.deptId;
      if (tplDeptId != null && tplDeptId !== undefined) {
        deptIdsWithTemplates.add(String(tplDeptId).trim());
      }
    });

    const missing = Array.from(selectedDeptIdsSet).filter(deptId => !deptIdsWithTemplates.has(deptId));
    return missing.map(deptId => {
      const dept = departments.find(d => String(d.deptId) === deptId);
      return dept?.name || deptId;
    });
  }, [level, selectedDeptIds, selectedTemplateIds, activeChecklistTemplates, departments]);

  // Filter templates based on selected departments AND exclude used templates
  const filteredTemplates = useMemo(() => {
    let templates = activeChecklistTemplates;

    // First filter by department
    if (level === 'academy') {
      // For academy level, show all templates
      templates = activeChecklistTemplates;
    } else if (selectedDeptIds.length === 0) {
      // If no departments selected, show only templates without deptId (general templates)
      templates = activeChecklistTemplates.filter((template: any) => 
        template.deptId == null || template.deptId === undefined
      );
    } else {
      // Normalize selected department IDs to strings for consistent comparison
      const selectedDeptIdsSet = new Set(selectedDeptIds.map(id => String(id).trim()));

      // When departments are selected, ONLY show templates that belong to those departments
      templates = activeChecklistTemplates.filter((template: any) => {
        const templateDeptId = template.deptId;
        
        // If template has no deptId (general template), exclude it when specific departments are selected
        if (templateDeptId == null || templateDeptId === undefined) {
          return false;
        }
        
        // Normalize template's deptId to string for comparison
        const templateDeptIdStr = String(templateDeptId).trim();
        
        // Try to match with selectedDeptIdsSet
        let matches = selectedDeptIdsSet.has(templateDeptIdStr);
        
        // Also try number comparison if string comparison fails
        if (!matches) {
          const templateDeptIdNum = Number(templateDeptId);
          if (!isNaN(templateDeptIdNum)) {
            matches = Array.from(selectedDeptIdsSet).some(selectedId => {
              const selectedNum = Number(selectedId);
              return !isNaN(selectedNum) && selectedNum === templateDeptIdNum;
            });
          }
        }
        
        return matches;
      });
    }

    // Then filter out used templates (chỉ filter những template chưa được chọn của phòng đó)
    if (level === 'department' && selectedDeptIds.length > 0 && usedTemplateIds.size > 0) {
      // const beforeFilter = templates.length; // Unused, kept for debugging if needed
      templates = templates.filter((template: any) => {
        const templateId = String(template.templateId || template.id || template.$id);
        const isUsed = usedTemplateIds.has(templateId);
        if (isUsed) {
        }
        return !isUsed;
      });
    } else {
    }

    return templates;
  }, [activeChecklistTemplates, level, selectedDeptIds, usedTemplateIds]);

  // Apply UI department filter (narrowing within already-scope-filtered templates)
  const visibleTemplates = useMemo(() => {
    if (!deptFilterId || deptFilterId === 'all') return filteredTemplates;
    if (deptFilterId === '__general__') {
      return (filteredTemplates || []).filter((t: any) => t?.deptId == null);
    }
    const filterStr = String(deptFilterId).trim();
    return (filteredTemplates || []).filter((t: any) => String(t?.deptId ?? '').trim() === filterStr);
  }, [filteredTemplates, level, deptFilterId]);

  const handleTemplateClick = (templateId: string) => {
    const normalizedId = String(templateId);
    const isSelected = selectedTemplateIds.includes(normalizedId);
    const templateDeptId = templateDeptMap[normalizedId];

    // Department level: only 1 template per department
    if (level === 'department' && templateDeptId) {
      if (isSelected) {
        // Deselect current
        onSelectionChange(selectedTemplateIds.filter((id) => id !== normalizedId));
      } else {
        // Replace any selection from the same department
        const next = selectedTemplateIds.filter(
          (id) => templateDeptMap[String(id)] !== templateDeptId
        );
        next.push(normalizedId);
        onSelectionChange(next);
      }
    } else {
      // Other levels: allow multi-select toggle
      if (isSelected) {
        onSelectionChange(selectedTemplateIds.filter((id) => id !== normalizedId));
      } else {
        onSelectionChange([...selectedTemplateIds, normalizedId]);
      }
    }

    // Toggle expansion
    if (expandedTemplateId === normalizedId) {
      setExpandedTemplateId(null);
    } else {
      setExpandedTemplateId(normalizedId);
    }
  };

  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 3/5: Checklist Template</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a Checklist Template *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            {level === 'department' && selectedDeptIds.length > 0
              ? `You must select exactly one template for each selected department (${selectedDeptIds.length} department(s) selected). The first selection will be treated as the primary template for summary info.`
              : 'You can select multiple templates. The first selection will be treated as the primary template for summary info.'}
          </p>
          {level === 'department' && selectedDeptIds.length > 0 && usedTemplateIds.size > 0 && (
            <p className="text-xs text-gray-500 mb-2">
Only display checklist templates that have not been selected for this room.            </p>
          )}
          {missingTemplateDepts.length > 0 && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Missing Templates</p>
              <p className="text-xs text-yellow-700">
                Please select at least one template for: <span className="font-semibold">{missingTemplateDepts.join(', ')}</span>
              </p>
            </div>
          )}
          {/* Department filter (UI-only) */}
          {(deptFilterOptions.length > 0 || hasGeneralTemplates) && (
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Filter by department:</span>
                <select
                  value={deptFilterId}
                  onChange={(e) => setDeptFilterId(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value="all">All</option>
                  {hasGeneralTemplates && level !== 'department' && (
                    <option value="__general__">General</option>
                  )}
                  {deptFilterOptions.map((idStr) => {
                    const id = String(idStr);
                    const name = deptNameById.get(id) || id;
                    return (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <span className="text-xs text-gray-500">
                Showing {visibleTemplates.length} / {filteredTemplates.length}
              </span>
            </div>
          )}
          {/* Select All / Clear All for currently visible templates */}
          {visibleTemplates.length > 0 && level !== 'department' && (
            <div className="mb-2 flex items-center justify-end">
              {(() => {
                const allIds = visibleTemplates.map((t: any) => String(t.templateId || t.id || t.$id));
                const allSelected =
                  allIds.length > 0 &&
                  allIds.every((id) => selectedTemplateIds.includes(id));

                const handleSelectAllToggle = () => {
                  if (allSelected) {
                    // Clear only those templates that are in the current filtered list
                    const remaining = selectedTemplateIds.filter(
                      (id) => !allIds.includes(String(id))
                    );
                    onSelectionChange(remaining);
                  } else {
                    const union = new Set<string>(selectedTemplateIds);
                    allIds.forEach((id) => union.add(String(id)));
                    onSelectionChange(Array.from(union));
                  }
                };

                return (
                  <button
                    type="button"
                    onClick={handleSelectAllToggle}
                    className="px-3 py-1 text-xs border rounded text-gray-700 hover:bg-gray-100"
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                );
              })()}
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">
                {level === 'department' && selectedDeptIds.length === 0
                  ? 'Please select departments in Step 2 to see available templates.'
                  : 'No templates available for the selected departments.'}
              </p>
            ) : (
              visibleTemplates.map((template: any) => {
                const templateId = String(template.templateId || template.id || template.$id || '');
                const deptId = template.deptId != null ? String(template.deptId) : '';
                const deptName = deptId ? (deptNameById.get(deptId) || deptId) : '';
                const normalizedId = String(templateId);
                const isSelected = selectedTemplateIds.includes(normalizedId);
                const isExpanded = expandedTemplateId === String(templateId);
                return (
                  <div
                    key={String(templateId)}
                    onClick={() => handleTemplateClick(String(templateId))}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {template.title || template.name || 'Untitled Template'}
                          </h4>
                          {deptName && (
                            <span className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 rounded border border-gray-200">
                              {deptName}
                            </span>
                          )}
                        </div>
                        {isExpanded && template.description && (
                          <p className="text-xs text-gray-600 mt-2">{template.description}</p>
                        )}
                        {isExpanded && (
                          <div className="flex gap-2 mt-2">
                            {template.version && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {template.version}
                              </span>
                            )}
                            {template.category && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                                {template.category}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected}
                          className="w-5 h-5 text-primary-600 border-gray-300 rounded"
                        />
                        {template.description && (
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
