import React from 'react';
import MultiSelect from '../../../../../components/MultiSelect';

interface Step2ScopeProps {
  level: string;
  selectedDeptIds: string[];
  departments: Array<{ deptId: number | string; name: string }>;
  criteria: any[];
  selectedCriteriaIds: string[];
  onLevelChange: (value: string) => void;
  onSelectedDeptIdsChange: (value: string[]) => void;
  onCriteriaToggle: (id: string) => void;
}

export const Step2Scope: React.FC<Step2ScopeProps> = ({
  level,
  selectedDeptIds,
  departments,
  criteria,
  selectedCriteriaIds,
  onLevelChange,
  onSelectedDeptIdsChange,
  onCriteriaToggle,
}) => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criteria.length === 0 && (
              <p className="text-sm text-gray-500">No standards available.</p>
            )}
            {criteria.map((c: any) => {
              const id = c.criteriaId || c.id || c.$id;
              const label = c.name || c.referenceCode || id;
              const checked = selectedCriteriaIds.includes(String(id));
              return (
                <label
                  key={String(id)}
                  className="flex items-center gap-2 bg-gray-50 rounded border border-gray-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onCriteriaToggle(String(id))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
