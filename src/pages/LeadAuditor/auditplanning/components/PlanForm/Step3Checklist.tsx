import React, { useState } from 'react';

interface Step3ChecklistProps {
  checklistTemplates: any[];
  selectedTemplateIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export const Step3Checklist: React.FC<Step3ChecklistProps> = ({
  checklistTemplates,
  selectedTemplateIds,
  onSelectionChange,
}) => {
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  const handleTemplateClick = (templateId: string) => {
    const normalizedId = String(templateId);
    const isSelected = selectedTemplateIds.includes(normalizedId);

    if (isSelected) {
      onSelectionChange(selectedTemplateIds.filter((id) => id !== normalizedId));
    } else {
      onSelectionChange([...selectedTemplateIds, normalizedId]);
    }

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
            Select one or more Checklist Templates *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Multiple selections are allowed. The first selection will be set as the primary template.
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {checklistTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">No templates available.</p>
            ) : (
              checklistTemplates.map((template: any) => {
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
