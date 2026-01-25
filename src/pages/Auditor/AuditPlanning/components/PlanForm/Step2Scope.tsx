import React, { useEffect, useState, useCallback } from 'react';
// import MultiSelect from '../../../../../components/MultiSelect';

interface Step2ScopeProps {
  level: string;
  selectedDeptIds: string[];
  departments: Array<{ deptId: number | string; name: string }>;
  criteria: any[];
  selectedCriteriaIds: string[];
  onLevelChange: (value: string) => void;
  onSelectedDeptIdsChange: (value: string[]) => void;
  onSelectedCriteriaByDeptChange?: (map: Map<string, Set<string>>) => void;
  selectedCriteriaByDeptMap?: Map<string, Set<string>>;
  onCriteriaRemove?: (id: string) => Promise<boolean>;
}

/**
 * Scope selection now uses ONE shared standards list for all departments.
 */
export const Step2Scope: React.FC<Step2ScopeProps> = ({
  level,
  selectedDeptIds,
  departments,
  criteria,
  selectedCriteriaIds,
  onLevelChange,
  onSelectedDeptIdsChange,
  onSelectedCriteriaByDeptChange,
  selectedCriteriaByDeptMap,
  onCriteriaRemove,
}) => {
  const [selectedCriteriaByDept, setSelectedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());

  // Rehydrate from parent or selectedCriteriaIds
  useEffect(() => {
    if (selectedCriteriaByDeptMap && selectedCriteriaByDeptMap.size > 0) {
      setSelectedCriteriaByDept(new Map(selectedCriteriaByDeptMap));
    } else if (selectedCriteriaIds.length > 0) {
      const map = new Map<string, Set<string>>();
      map.set('shared', new Set(selectedCriteriaIds.map((id) => String(id))));
      setSelectedCriteriaByDept(map);
      onSelectedCriteriaByDeptChange?.(map);
    }
  }, [selectedCriteriaByDeptMap, selectedCriteriaIds, onSelectedCriteriaByDeptChange]);

  const handleToggle = useCallback(
    async (id: string | number) => {
      const idStr = String(id);

      // Determine if removing
      const currentSet = selectedCriteriaByDept.get('shared');
      const isRemoving = currentSet ? currentSet.has(idStr) : false;

      if (isRemoving && onCriteriaRemove) {
        try {
          const shouldProceed = await onCriteriaRemove(idStr);
          if (!shouldProceed) return;
        } catch (e) {
          return;
        }
      }

      setSelectedCriteriaByDept((prevMap) => {
        const mapCopy = new Map(prevMap);
        const prevSet = mapCopy.get('shared') ?? new Set<string>();
        const newSet = new Set(prevSet);

        if (newSet.has(idStr)) {
          newSet.delete(idStr);
        } else {
          newSet.add(idStr);
        }

        mapCopy.set('shared', newSet);
        onSelectedCriteriaByDeptChange?.(mapCopy);
        return mapCopy;
      });
    },
    [onSelectedCriteriaByDeptChange, selectedCriteriaByDept, onCriteriaRemove]
  );

  return (
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
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Departments * (Select one or more)
          </label>

          {/* Selected Departments Tags */}
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedDeptIds.map((deptId) => {
              const dept = departments.find(d => String(d.deptId) === String(deptId));
              return (
                <div
                  key={deptId}
                  className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 text-sm"
                >
                  <span>{dept?.name || deptId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newIds = selectedDeptIds.filter(id => id !== deptId);
                      onSelectedDeptIdsChange(newIds);
                    }}
                    className="ml-1 hover:text-blue-900 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add Department Dropdown */}
          <div className="relative">
            <DepartmentDropdown
              departments={departments}
              selectedDeptIds={selectedDeptIds}
              onSelect={(deptId) => {
                onSelectedDeptIdsChange([...selectedDeptIds, deptId]);
              }}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Standards
        </label>
        {criteria.length === 0 ? (
          <p className="text-sm text-gray-500">No standards available.</p>
        ) : (
          <div className="space-y-3">
            {/* Selected Standards Tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {(() => {
                // Get all selected IDs from the 'shared' set
                const sharedSet = selectedCriteriaByDept.get('shared');
                const selectedIds = sharedSet ? Array.from(sharedSet) : [];

                return selectedIds.map((id) => {
                  const c = criteria.find((item: any) =>
                    String(item.criteriaId || item.id || item.$id) === String(id)
                  );
                  const label = c ? (c.name || c.referenceCode || id) : id;

                  return (
                    <div
                      key={String(id)}
                      className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100 text-sm"
                    >
                      <span className="truncate max-w-[200px]" title={label}>{label}</span>
                      <button
                        type="button"
                        onClick={() => handleToggle(String(id))}
                        className="ml-1 hover:text-green-900 focus:outline-none"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Add Standard Dropdown */}
            <div className="relative">
              <StandardDropdown
                criteria={criteria}
                selectedIds={selectedCriteriaByDept.get('shared') ? Array.from(selectedCriteriaByDept.get('shared')!) : []}
                onSelect={(id) => handleToggle(String(id))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DepartmentDropdown = ({
  departments,
  selectedDeptIds,
  onSelect
}: {
  departments: Array<{ deptId: number | string; name: string }>;
  selectedDeptIds: string[];
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter available departments
  const availableDepts = departments.filter(d => !selectedDeptIds.includes(String(d.deptId)));

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-dashed border-gray-300 rounded text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Department
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-64 bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {availableDepts.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No more departments available</div>
          ) : (
            availableDepts.map((department) => (
              <button
                key={department.deptId}
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                onClick={() => {
                  onSelect(String(department.deptId));
                  setIsOpen(false);
                }}
              >
                {department.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const StandardDropdown = ({
  criteria,
  selectedIds,
  onSelect
}: {
  criteria: any[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter available criteria
  const availableCriteria = criteria.filter((c: any) => {
    const id = String(c.criteriaId || c.id || c.$id);
    return !selectedIds.includes(id);
  });

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-dashed border-gray-300 rounded text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Standard
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-80 bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {availableCriteria.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No more standards available</div>
          ) : (
            availableCriteria.map((c: any) => {
              const id = String(c.criteriaId || c.id || c.$id);
              const label = c.name || c.referenceCode || id;
              return (
                <button
                  key={id}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-b border-gray-50 last:border-0"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
