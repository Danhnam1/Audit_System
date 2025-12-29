import React, { useEffect, useState, useCallback } from 'react';
import MultiSelect from '../../../../../components/MultiSelect';

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

  const isChecked = (id: string | number): boolean => {
    return selectedCriteriaByDept.get('shared')?.has(String(id)) ?? false;
  };

  const handleToggle = useCallback(
    (id: string | number) => {
      const idStr = String(id);
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
    [onSelectedCriteriaByDeptChange]
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Departments * (Select one or more)
          </label>
          {departments.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">No available departments.</p>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Standards (shared for all departments)
        </label>
        {criteria.length === 0 ? (
          <p className="text-sm text-gray-500">No standards available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criteria.map((c: any) => {
              const id = c.criteriaId || c.id || c.$id;
              const label = c.name || c.referenceCode || id;
              const checked = isChecked(id);
              return (
                <label
                  key={String(id)}
                  className="flex items-center gap-2 bg-gray-50 rounded border border-gray-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle(String(id))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
