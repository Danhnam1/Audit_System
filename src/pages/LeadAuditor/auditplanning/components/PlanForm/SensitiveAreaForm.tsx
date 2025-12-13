import React, { useState, useEffect } from 'react';
import { getDepartmentSensitiveAreaByDeptId } from '../../../../../api/departmentSensitiveAreas';
import { getDefaultNotesByDepartments } from '../../../../../constants/sensitiveAreas';

interface SensitiveAreaFormProps {
  sensitiveFlag: boolean;
  sensitiveAreas: string[];
  sensitiveNotes: string;
  onFlagChange: (flag: boolean) => void;
  onAreasChange: (areas: string[]) => void;
  onNotesChange: (notes: string) => void;
  selectedDeptIds?: string[];
  departments?: Array<{ deptId: number | string; name: string }>;
}

interface DepartmentArea {
  deptId: string;
  deptName: string;
  areas: string[];
}

export const SensitiveAreaForm: React.FC<SensitiveAreaFormProps> = ({
  sensitiveFlag,
  sensitiveAreas,
  sensitiveNotes,
  onFlagChange,
  onAreasChange,
  onNotesChange,
  selectedDeptIds = [],
  departments = [],
}) => {
  const [departmentAreas, setDepartmentAreas] = useState<DepartmentArea[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load sensitive areas for each selected department (from API)
  useEffect(() => {
    const loadSuggestions = async () => {
      if (selectedDeptIds.length === 0) {
        setDepartmentAreas([]);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const areasPromises = selectedDeptIds.map(async (deptId) => {
          const dept = departments.find((d) => String(d.deptId) === String(deptId));
          const deptName = dept?.name || deptId;
          
          try {
            const dataArray = await getDepartmentSensitiveAreaByDeptId(deptId);
            // Extract area names from array of records
            const areas = dataArray.map(item => item.sensitiveArea).filter(Boolean);
            return {
              deptId: String(deptId),
              deptName,
              areas,
            };
          } catch (error) {
            console.error(`Failed to load sensitive areas for department ${deptId}`, error);
            return {
              deptId: String(deptId),
              deptName,
              areas: [],
            };
          }
        });
        
        const results = await Promise.all(areasPromises);
        setDepartmentAreas(results.filter((r) => r.areas.length > 0));
      } catch (error) {
        console.error('Failed to load suggested sensitive areas', error);
        setDepartmentAreas([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, [selectedDeptIds, departments]);

  // Auto-fill default notes when departments change (from API)
  useEffect(() => {
    const loadDefaultNotes = async () => {
      if (selectedDeptIds.length > 0 && !sensitiveNotes) {
        try {
          const defaultNotes = await getDefaultNotesByDepartments(selectedDeptIds);
          if (defaultNotes) {
            onNotesChange(defaultNotes);
          }
        } catch (error) {
          console.error('Failed to load default notes', error);
        }
      }
    };
    loadDefaultNotes();
  }, [selectedDeptIds, sensitiveNotes, onNotesChange]);

  // Format: "area name - department name"
  const formatAreaName = (area: string, deptName: string) => {
    return `${area} - ${deptName}`;
  };

  // Check if area (formatted) is selected
  const isAreaSelected = (area: string, deptName: string) => {
    const formatted = formatAreaName(area, deptName);
    return sensitiveAreas.includes(formatted);
  };

  // Toggle area selection
  const toggleArea = (area: string, deptName: string) => {
    const formatted = formatAreaName(area, deptName);
    if (isAreaSelected(area, deptName)) {
      // Remove
      onAreasChange(sensitiveAreas.filter((a) => a !== formatted));
    } else {
      // Add
      onAreasChange([...sensitiveAreas, formatted]);
    }
  };

  return (
    <div className="rounded-xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <input
          type="checkbox"
          checked={sensitiveFlag}
          onChange={(e) => onFlagChange(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-2 border-primary-300 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
        />
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900 mb-1">Sensitive Area / Access Control</h3>
          <p className="text-sm text-gray-600">
            If the plan includes sensitive areas, enable the flag and select the areas to trigger permission
            controls (QR/escort/verify code later).
          </p>
        </div>
      </div>

      {sensitiveFlag && (
        <div className="mt-4">
          {/* Sensitive areas from selected departments */}
          {loadingSuggestions ? (
            <div className="bg-white border-2 border-primary-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-3 text-sm text-primary-700">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
                <span>Loading sensitive areas...</span>
              </div>
            </div>
          ) : departmentAreas.length > 0 ? (
            <div className="bg-white border-2 border-primary-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-primary-600 rounded-full"></div>
                <label className="text-sm font-bold text-gray-900">
                  Sensitive Areas from Selected Departments
                </label>
              </div>
              {departmentAreas.map((deptArea, deptIdx) => (
                <div key={deptArea.deptId} className={`${deptIdx > 0 ? 'pt-4 border-t border-gray-200' : ''}`}>
                  <p className="text-sm font-semibold text-primary-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                    {deptArea.deptName}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {deptArea.areas.map((area) => {
                      const formatted = formatAreaName(area, deptArea.deptName);
                      const isSelected = isAreaSelected(area, deptArea.deptName);
                      return (
                        <label
                          key={`${deptArea.deptId}-${area}`}
                          className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'bg-primary-100 text-primary-900 border-2 border-primary-500 shadow-sm font-medium'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-primary-300 hover:bg-primary-50 hover:shadow-sm'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleArea(area, deptArea.deptName)}
                            className="w-4 h-4 rounded border-2 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                          />
                          <span>{formatted}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedDeptIds.length > 0 ? (
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-xl">ℹ</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">No Sensitive Areas Configured</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    No sensitive areas configured for selected departments. Contact Admin to configure master data.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-xl">📋</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Select Departments First</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Select departments in Step 2 to view their sensitive areas.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

