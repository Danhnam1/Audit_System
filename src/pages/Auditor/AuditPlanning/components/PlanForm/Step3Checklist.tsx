import React from 'react';

interface Step3ChecklistProps {
  checklistTemplates: any[];
  selectedTemplateId: string | null;
  onTemplateSelect: (id: string) => void;
}

export const Step3Checklist: React.FC<Step3ChecklistProps> = ({
  checklistTemplates,
  selectedTemplateId,
  onTemplateSelect,
}) => {
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 3/5: Checklist Template</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a Checklist Template *
          </label>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {checklistTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">No templates available.</p>
            ) : (
              checklistTemplates.map((template: any) => {
                const templateId = template.templateId || template.id || template.$id;
                const isSelected = String(selectedTemplateId) === String(templateId);
                return (
                  <div
                    key={String(templateId)}
                    onClick={() => onTemplateSelect(String(templateId))}
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
                        {template.description && (
                          <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                        )}
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
                      </div>
                      {isSelected && (
                        <div className="ml-3">
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
                        </div>
                      )}
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
