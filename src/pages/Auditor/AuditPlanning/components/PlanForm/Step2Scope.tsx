import React, { useEffect, useState, useMemo, useCallback } from 'react';
import MultiSelect from '../../../../../components/MultiSelect';
import { getAuditsByPeriod, getAuditScopeDepartmentsByAuditId } from '../../../../../api/audits';
import { getCriteriaForAudit, getCriteriaForAuditByDepartment } from '../../../../../api/auditCriteriaMap';
import { unwrap } from '../../../../../utils/normalize';

interface Step2ScopeProps {
  level: string;
  selectedDeptIds: string[];
  departments: Array<{ deptId: number | string; name: string }>;
  criteria: any[];
  selectedCriteriaIds: string[];
  onLevelChange: (value: string) => void;
  onSelectedDeptIdsChange: (value: string[]) => void;
  onSelectedCriteriaByDeptChange?: (map: Map<string, Set<string>>) => void; // New prop to pass selectedCriteriaByDept to parent
  selectedCriteriaByDeptMap?: Map<string, Set<string>>; // Controlled map from parent to rehydrate when remount
  periodFrom?: string;
  periodTo?: string;
  editingAuditId?: string | null;
}

export const Step2Scope: React.FC<Step2ScopeProps> = ({
  level,
  selectedDeptIds,
  departments,
  criteria,
  onLevelChange,
  onSelectedDeptIdsChange,
  onSelectedCriteriaByDeptChange,
  selectedCriteriaByDeptMap,
  periodFrom,
  periodTo,
  editingAuditId,
}) => {
  // Map: deptId -> Set of used criteria IDs for that department
  const [usedCriteriaByDept, setUsedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());
  // Map lựa chọn tiêu chuẩn theo từng phòng ban (hoặc 'shared' khi dùng chung)
  const [selectedCriteriaByDept, setSelectedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());
  const [useSharedStandards, setUseSharedStandards] = useState<boolean>(false);

  // Helper to shallow-compare two Map<string, Set<string>>
  const isSameSelectionMap = useCallback(
    (a?: Map<string, Set<string>>, b?: Map<string, Set<string>>) => {
      if (!a || !b) return false;
      if (a.size !== b.size) return false;
      for (const [key, setA] of a.entries()) {
        const setB = b.get(key);
        if (!setB || setA.size !== setB.size) return false;
        for (const value of setA) {
          if (!setB.has(value)) return false;
        }
      }
      return true;
    },
    []
  );

  // Rehydrate local map from parent when remount (e.g., navigating steps)
  // Only update when the incoming map is actually different to avoid
  // re-render loops that can make checkboxes flicker.
  useEffect(() => {
    if (selectedCriteriaByDeptMap && selectedCriteriaByDeptMap.size > 0) {
      setSelectedCriteriaByDept((prev) => {
        if (isSameSelectionMap(prev, selectedCriteriaByDeptMap)) return prev;
        return new Map(selectedCriteriaByDeptMap);
      });
    }
  }, [selectedCriteriaByDeptMap, isSameSelectionMap]);

  // Load used criteria for each department separately
  useEffect(() => {
    const loadUsedCriteria = async () => {
      if (level !== 'department' || selectedDeptIds.length === 0 || !periodFrom || !periodTo) {
        setUsedCriteriaByDept(new Map());
        return;
      }

      try {
        console.log('[Step2Scope] Loading used criteria for departments:', selectedDeptIds, 'period:', periodFrom, 'to', periodTo);
        
        // Lấy tất cả audits trong period
        const auditsInPeriod = await getAuditsByPeriod(periodFrom, periodTo);
        console.log('[Step2Scope] Raw audits response:', auditsInPeriod);
        
        // Unwrap response to handle different formats
        const auditsArray = unwrap(auditsInPeriod);
        console.log('[Step2Scope] Processed audits array:', auditsArray.length, 'audits');
        
        // Filter out inactive and deleted audits
        const activeAudits = auditsArray.filter((a: any) => {
          const status = String(a.status || '').toLowerCase().replace(/\s+/g, '');
          const isActive = status !== 'inactive' && status !== 'deleted';
          if (!isActive) {
            console.log('[Step2Scope] Filtered out inactive/deleted audit:', a.auditId || a.id, 'status:', status);
          }
          return isActive;
        });
        
        console.log('[Step2Scope] Active audits:', activeAudits.length);
        
        // Filter out current audit if editing
        const otherAudits = editingAuditId
          ? activeAudits.filter((a: any) => String(a.auditId || a.id) !== String(editingAuditId))
          : activeAudits;

        console.log('[Step2Scope] Other audits (excluding current):', otherAudits.length);

        // Initialize map for each selected department
        const usedCriteriaMap = new Map<string, Set<string>>();
        selectedDeptIds.forEach((deptId) => {
          usedCriteriaMap.set(String(deptId), new Set<string>());
        });

        // Với mỗi audit, check xem có trùng department không và lưu criteria theo từng department
        for (const audit of otherAudits) {
          try {
            const auditId = String(audit.auditId || audit.id);
            const scopeDepts = await getAuditScopeDepartmentsByAuditId(auditId);
            
            // Unwrap scope departments response
            const scopeDeptArray = unwrap(scopeDepts);
            console.log(`[Step2Scope] Audit ${auditId} has ${scopeDeptArray.length} scope departments`);
            
            // Với mỗi scope department của audit này, nếu trùng với selectedDeptIds thì lấy criteria cụ thể cho department đó
            for (const sd of scopeDeptArray) {
              const deptId = String(sd.deptId);
              if (selectedDeptIds.includes(deptId)) {
                console.log(`[Step2Scope] Audit ${auditId} has department ${deptId}, fetching criteria for this department...`);
                
                try {
                  // Sử dụng API mới: lấy criteria cụ thể cho department này trong audit này
                  const deptCriteria = await getCriteriaForAuditByDepartment(auditId, Number(deptId));
                  const criteriaArray = unwrap(deptCriteria);
                  
                  // Thêm criteria vào set của department này
                  const deptCriteriaSet = usedCriteriaMap.get(deptId) || new Set<string>();
                  if (Array.isArray(criteriaArray)) {
                    criteriaArray.forEach((c: any) => {
                      const criteriaId = String(c.criteriaId || c.id || c);
                      deptCriteriaSet.add(criteriaId);
                      console.log(`[Step2Scope] Added used criteria ${criteriaId} for department ${deptId} from audit ${auditId}`);
                    });
                  }
                  usedCriteriaMap.set(deptId, deptCriteriaSet);
                } catch (deptErr) {
                  console.warn(`[Step2Scope] Failed to get criteria for audit ${auditId} department ${deptId}:`, deptErr);
                  // Fallback: nếu API mới fail, thử dùng API cũ
                  try {
                    const auditCriteria = await getCriteriaForAudit(auditId);
                    const criteriaArray = unwrap(auditCriteria);
                    const deptCriteriaSet = usedCriteriaMap.get(deptId) || new Set<string>();
                    if (Array.isArray(criteriaArray)) {
                      criteriaArray.forEach((c: any) => {
                        const criteriaId = String(c.criteriaId || c.id || c);
                        deptCriteriaSet.add(criteriaId);
                      });
                    }
                    usedCriteriaMap.set(deptId, deptCriteriaSet);
                  } catch (fallbackErr) {
                    console.warn(`[Step2Scope] Fallback also failed for audit ${auditId}:`, fallbackErr);
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`[Step2Scope] Failed to get criteria for audit ${audit.auditId}:`, err);
          }
        }

        // Log detailed info for each department
        console.log('[Step2Scope] Used criteria by department:', 
          Array.from(usedCriteriaMap.entries()).map(([deptId, criteriaSet]) => {
            const dept = departments.find((d) => String(d.deptId) === deptId);
            return `${deptId} (${dept?.name || 'Unknown'}): ${criteriaSet.size} criteria - ${criteriaSet.size > 0 ? 'HAS CONFLICT' : 'NO CONFLICT'}`;
          })
        );
        
        // Only set departments that have conflicts (non-empty sets)
        // If a department has no conflicts, it won't be in the map, which means hasConflict will be false
        const finalMap = new Map<string, Set<string>>();
        usedCriteriaMap.forEach((criteriaSet, deptId) => {
          if (criteriaSet.size > 0) {
            finalMap.set(deptId, criteriaSet);
          }
        });
        
        console.log('[Step2Scope] Final map (only departments with conflicts):', 
          Array.from(finalMap.entries()).map(([deptId, criteriaSet]) => 
            `${deptId}: ${criteriaSet.size} criteria`
          )
        );
        
        setUsedCriteriaByDept(finalMap);
      } catch (error) {
        console.error('[Step2Scope] Error loading used criteria:', error);
        setUsedCriteriaByDept(new Map());
      }
    };

    loadUsedCriteria();
  }, [level, selectedDeptIds, periodFrom, periodTo, editingAuditId]);

  // Get filtered criteria for a specific department
  // Only filter if there are used criteria (conflict case), otherwise show all (no conflict case)
  const getFilteredCriteriaForDept = useMemo(() => {
    return (deptId: string) => {
      if (level !== 'department') {
        return criteria;
      }

      const usedCriteriaSet = usedCriteriaByDept.get(String(deptId));
      
      // Case 1: No conflict - department not in map (undefined) or empty set, show all criteria
      if (!usedCriteriaSet || usedCriteriaSet.size === 0) {
        console.log(`[Step2Scope] getFilteredCriteriaForDept: No conflict for ${deptId}, returning all ${criteria.length} criteria`);
        return criteria;
      }

      // Case 2: Has conflict - filter out used criteria
      const filtered = criteria.filter((c: any) => {
        const id = String(c.criteriaId || c.id || c.$id);
        return !usedCriteriaSet.has(id);
      });
      console.log(`[Step2Scope] getFilteredCriteriaForDept: Has conflict for ${deptId}, filtered to ${filtered.length} criteria (from ${criteria.length})`);
      return filtered;
    };
  }, [criteria, level, usedCriteriaByDept]);

  // Memoize selection map to avoid creating new objects on every render
  const selectionMap = useMemo(() => selectedCriteriaByDept, [selectedCriteriaByDept]);

  // Check if a criteria is selected for a specific department
  const isChecked = (deptId: string, id: string | number): boolean => {
    return selectionMap.get(deptId)?.has(String(id)) ?? false;
  };

  // Handle toggle - ONLY update local state, do NOT call parent setState here
  const handleToggle = useCallback((deptId: string, id: string | number) => {
    const idStr = String(id);
    
    setSelectedCriteriaByDept((prevMap) => {
      const mapCopy = new Map(prevMap);

      const prevSet = mapCopy.get(deptId) ?? new Set<string>();
      const newSet = new Set(prevSet);

      if (newSet.has(idStr)) {
        newSet.delete(idStr);
      } else {
        newSet.add(idStr);
      }

      mapCopy.set(deptId, newSet);

      return mapCopy;
    });
  }, []);

  // Sync selectedCriteriaByDept to parent whenever it changes
  // Guard against redundant calls to prevent rapid re-rendering
  const lastSentRef = React.useRef<Map<string, Set<string>> | null>(null);
  useEffect(() => {
    if (onSelectedCriteriaByDeptChange) {
      if (!lastSentRef.current || !isSameSelectionMap(lastSentRef.current, selectedCriteriaByDept)) {
        lastSentRef.current = selectedCriteriaByDept;
        onSelectedCriteriaByDeptChange(selectedCriteriaByDept);
      }
    }
  }, [selectedCriteriaByDept, onSelectedCriteriaByDeptChange, isSameSelectionMap]);

  // Clean up selections when departments change (department level only)
  // Important: do NOT depend on selectedCriteriaByDept to avoid overwrite loops after click
  useEffect(() => {
    if (level !== 'department') return;
  
    setSelectedCriteriaByDept((prev) => {
      const allowed = new Set(selectedDeptIds.map(String));
      let changed = false;
      const next = new Map<string, Set<string>>();
  
      prev.forEach((val, key) => {
        if (allowed.has(key) || key === 'shared' || key === 'academy') {
          next.set(key, val);
        } else {
          changed = true;
        }
      });
  
      return changed ? next : prev;
    });
  }, [level, selectedDeptIds]);

  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 2/5: Scope</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
          >
            <option value="academy">Entire Aviation Academy</option>
            <option value="department">Department</option>
          </select>
        </div>

        {level === 'department' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departments * (Select one or more)
            </label>
            {departments.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  No available departments. All departments have been used in this period.
                </p>
              </div>
            ) : (
              <MultiSelect
                options={departments.map((d) => ({
                  label: d.name,
                  value: String(d.deptId),
                }))}
                value={selectedDeptIds}
                onChange={onSelectedDeptIdsChange}
                placeholder="Select departments..."
              />
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Standards:</label>
          
          {level === 'academy' ? (
            // Academy level: show all criteria
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criteria.length === 0 && (
              <p className="text-sm text-gray-500">No standards available.</p>
            )}
            {criteria.map((c: any) => {
              const id = c.criteriaId || c.id || c.$id;
              const label = c.name || c.referenceCode || id;
                const checked = isChecked('academy', id);
              return (
                <label
                  key={String(id)}
                  className="flex items-center gap-2 bg-gray-50 rounded border border-gray-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                      onChange={() => handleToggle('academy', String(id))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              );
            })}
          </div>
          ) : selectedDeptIds.length === 0 ? (
            // Department level but no departments selected
            <p className="text-sm text-gray-500">Please select at least one department to see available standards.</p>
          ) : (() => {
            // Group departments into: with conflict and without conflict
            const deptsWithConflict: Array<{ deptId: string; deptName: string; usedCriteriaSet: Set<string> }> = [];
            const deptsWithoutConflict: Array<{ deptId: string; deptName: string }> = [];

            selectedDeptIds.forEach((deptId) => {
              const dept = departments.find((d) => String(d.deptId) === String(deptId));
                const deptName = dept?.name || `Department ${deptId}`;
              const deptIdStr = String(deptId);
              const usedCriteriaSet = usedCriteriaByDept.get(deptIdStr);
              
              if (usedCriteriaSet !== undefined && usedCriteriaSet.size > 0) {
                // Has conflict
                deptsWithConflict.push({ deptId: deptIdStr, deptName, usedCriteriaSet });
              } else {
                // No conflict
                deptsWithoutConflict.push({ deptId: deptIdStr, deptName });
              }
            });

            return (
              <div className="space-y-4">
                {/* Option to use shared standards for departments without conflict */}
                {deptsWithoutConflict.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSharedStandards}
                        onChange={(e) => setUseSharedStandards(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        Use shared standards for other departments
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {useSharedStandards 
                        ? 'All other departments will share the same standards selection.'
                        : 'Each department will have its own standards selection.'}
                    </p>
                  </div>
                )}

                {/* Departments with conflict - show separately with filtered criteria */}
                {deptsWithConflict.map(({ deptId, deptName, usedCriteriaSet }) => {
                  const deptIdStr = String(deptId);
                  const filteredCriteriaForDept = getFilteredCriteriaForDept(deptIdStr);
                  
                  return (
                    <div key={deptId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        {deptName}
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          ({usedCriteriaSet.size} criteria already used in this period)
                        </span>
                      </h4>
                      <p className="text-xs text-gray-500 mb-3">
                        Showing only criteria that have not been selected for this department in the same timeframe.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredCriteriaForDept.length === 0 ? (
                          <p className="text-sm text-gray-500 col-span-2">
                            All criteria have been selected for this department in the same timeframe.
                          </p>
                        ) : (
                          filteredCriteriaForDept.map((c: any) => {
                            const id = c.criteriaId || c.id || c.$id;
                            const label = c.name || c.referenceCode || id;
                            const checked = isChecked(deptIdStr, id);
                            return (
                              <label
                                key={`${deptId}-${id}`}
                                className="flex items-center gap-2 bg-white rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggle(deptIdStr, String(id))}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Departments without conflict */}
                {deptsWithoutConflict.length > 0 && (
                  useSharedStandards ? (
                    // Show together in one section
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        Other Departments
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {criteria.length === 0 ? (
                          <p className="text-sm text-gray-500 col-span-2">No standards available.</p>
                        ) : (
                          criteria.map((c: any) => {
                            const id = c.criteriaId || c.id || c.$id;
                            const label = c.name || c.referenceCode || id;
                            const checked = isChecked('shared', id);
                            return (
                              <label
                                key={`no-conflict-shared-${id}`}
                                className="flex items-center gap-2 bg-white rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggle('shared', String(id))}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    // Show separately for each department
                    deptsWithoutConflict.map(({ deptId, deptName }) => (
                      <div key={deptId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          {deptName}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {criteria.length === 0 ? (
                            <p className="text-sm text-gray-500 col-span-2">No standards available.</p>
                          ) : (
                            criteria.map((c: any) => {
                              const id = c.criteriaId || c.id || c.$id;
                              const label = c.name || c.referenceCode || id;
                              const checked = isChecked(String(deptId), id);
                              return (
                                <label
                                  key={`no-conflict-${deptId}-${id}`}
                                  className="flex items-center gap-2 bg-white rounded border border-gray-200 px-3 py-2 hover:bg-gray-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggle(String(deptId), String(id))}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <span className="text-sm text-gray-700">{label}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
