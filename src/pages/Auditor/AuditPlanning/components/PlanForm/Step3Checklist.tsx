import React, { useState, useMemo } from 'react';

interface Step3ChecklistProps {
  checklistTemplates: any[];
  selectedTemplateIds: string[];
  onSelectionChange: (ids: string[]) => void;
  level?: string;
  selectedDeptIds?: string[];
  departments?: Array<{ deptId: number | string; name: string }>;
}

export const Step3Checklist: React.FC<Step3ChecklistProps> = ({
  checklistTemplates,
  selectedTemplateIds,
  onSelectionChange,
  level = 'academy',
  selectedDeptIds = [],
  departments = [],
}) => {
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Check which departments are missing templates
  const missingTemplateDepts = useMemo(() => {
    if (level !== 'department' || selectedDeptIds.length === 0) {
      return [];
    }

    const selectedTemplates = checklistTemplates.filter((tpl: any) =>
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
  }, [level, selectedDeptIds, selectedTemplateIds, checklistTemplates, departments]);

  // Filter templates based on selected departments
  const filteredTemplates = useMemo(() => {
    if (level === 'academy') {
      // For academy level, show all templates
      return checklistTemplates;
    }

    // For department level, filter by deptId
    if (selectedDeptIds.length === 0) {
      // If no departments selected, show only templates without deptId (general templates)
      return checklistTemplates.filter((template: any) => 
        template.deptId == null || template.deptId === undefined
      );
    }

    // Normalize selected department IDs to strings for consistent comparison
    const selectedDeptIdsSet = new Set(selectedDeptIds.map(id => String(id).trim()));

    // Debug logging
    console.log('[Step3Checklist] Filtering templates:', {
      level,
      selectedDeptIds,
      selectedDeptIdsSet: Array.from(selectedDeptIdsSet),
      totalTemplates: checklistTemplates.length,
    });

    // When departments are selected, ONLY show templates that belong to those departments
    // Do NOT show general templates (deptId = null) when specific departments are selected
    const filtered = checklistTemplates.filter((template: any) => {
      const templateDeptId = template.deptId;
      
      // If template has no deptId (general template), exclude it when specific departments are selected
      if (templateDeptId == null || templateDeptId === undefined) {
        console.log(`[Step3Checklist] Excluding general template: ${template.title || template.name} (deptId: null) - specific departments selected`);
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
      
      console.log(`[Step3Checklist] Template: ${template.title || template.name}, deptId: ${templateDeptId} (${typeof templateDeptId}), normalized: ${templateDeptIdStr}, matches: ${matches}`);
      
      // Only include if template's deptId matches one of the selected departments
      return matches;
    });

    console.log('[Step3Checklist] Filtered templates count:', filtered.length);
    return filtered;
  }, [checklistTemplates, level, selectedDeptIds]);

  const handleTemplateClick = (templateId: string) => {
    const normalizedId = String(templateId);
    const isSelected = selectedTemplateIds.includes(normalizedId);

    // Toggle selection
    if (isSelected) {
      onSelectionChange(selectedTemplateIds.filter((id) => id !== normalizedId));
    } else {
      onSelectionChange([...selectedTemplateIds, normalizedId]);
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
              ? `You must select at least one template for each selected department (${selectedDeptIds.length} department(s) selected). The first selection will be treated as the primary template for summary info.`
              : 'You can select multiple templates. The first selection will be treated as the primary template for summary info.'}
          </p>
          {missingTemplateDepts.length > 0 && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Missing Templates</p>
              <p className="text-xs text-yellow-700">
                Please select at least one template for: <span className="font-semibold">{missingTemplateDepts.join(', ')}</span>
              </p>
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">
                {level === 'department' && selectedDeptIds.length === 0
                  ? 'Please select departments in Step 2 to see available templates.'
                  : 'No templates available for the selected departments.'}
              </p>
            ) : (
              filteredTemplates.map((template: any) => {
                const templateId = template.templateId;
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
                        <h4 className="text-sm font-semibold text-gray-900">
                          {template.title || template.name || 'Untitled Template'}
                        </h4>
                        {isExpanded && template.description && (
                          <p className="text-xs text-gray-600 mt-2">{template.description}</p>
                        )}
                        {isExpanded && (
                          <div className="flex gap-2 mt-2">
                            {template.version && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                v{template.version}
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
