import React, { useState, useMemo } from 'react';

interface Step3ChecklistProps {
  checklistTemplates: any[];
  selectedTemplateId: string | null;
  onTemplateSelect: (id: string) => void;
  level?: string;
  selectedDeptIds?: string[];
}

export const Step3Checklist: React.FC<Step3ChecklistProps> = ({
  checklistTemplates,
  selectedTemplateId,
  onTemplateSelect,
  level = 'academy',
  selectedDeptIds = [],
}) => {
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

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
        console.log(`[Step3Checklist] Excluding general template: ${template.name} (deptId: null) - specific departments selected`);
        return false;
      }
      
      // Normalize template's deptId to string for comparison
      const templateDeptIdStr = String(templateDeptId).trim();
      const matches = selectedDeptIdsSet.has(templateDeptIdStr);
      
      console.log(`[Step3Checklist] Template: ${template.name}, deptId: ${templateDeptId} (${typeof templateDeptId}), matches: ${matches}`);
      
      // Only include if template's deptId matches one of the selected departments
      return matches;
    });

    console.log('[Step3Checklist] Filtered templates count:', filtered.length);
    return filtered;
  }, [checklistTemplates, level, selectedDeptIds]);

  const handleTemplateClick = (templateId: string) => {
    // Toggle expansion
    if (expandedTemplateId === String(templateId)) {
      setExpandedTemplateId(null);
    } else {
      setExpandedTemplateId(String(templateId));
    }
    // Select template
    onTemplateSelect(templateId);
  };

  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 3/5: Checklist Template</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a Checklist Template *
          </label>
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
                const isSelected = String(selectedTemplateId) === String(templateId);
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
                        {isSelected && (
                          <svg
                            className="w-6 h-6 text-primary-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
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
