import React from 'react';
import type { ChecklistItem, FindingDraft } from './types';

interface CreateFindingModalProps {
  visible: boolean;
  currentItemForFinding: ChecklistItem | null;
  newFinding: FindingDraft;
  setNewFinding: React.Dispatch<React.SetStateAction<FindingDraft>>;
  onClose: () => void;
  onSave: () => void;
  getCriticalityColor: (criticality: string) => string;
}

const CreateFindingModal: React.FC<CreateFindingModalProps> = ({
  visible,
  currentItemForFinding,
  newFinding,
  setNewFinding,
  onClose,
  onSave,
  getCriticalityColor,
}) => {
  if (!visible || !currentItemForFinding) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-primary-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Create Finding</h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Checklist Item Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-1">Checklist Item</p>
            <p className="text-base font-semibold text-gray-900">{currentItemForFinding.item}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <span>Standard: {currentItemForFinding.standardRef}</span>
              <span>•</span>
              <span>Category: {currentItemForFinding.category}</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded font-medium ${getCriticalityColor(currentItemForFinding.criticality)}`}>
                {currentItemForFinding.criticality}
              </span>
            </div>
          </div>

          {/* Finding Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Finding Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['Major', 'Minor', 'Observation'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setNewFinding(prev => ({ ...prev, findingType: type }))}
                  className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    newFinding.findingType === type
                      ? type === 'Major' ? 'border-primary-900 bg-primary-900 text-white' :
                        type === 'Minor' ? 'border-primary-600 bg-primary-600 text-white' :
                        'border-primary-300 bg-primary-300 text-primary-900'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Finding Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newFinding.title}
              onChange={(e) => setNewFinding(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter finding title..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={newFinding.description}
              onChange={(e) => setNewFinding(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Describe the finding in detail..."
            />
          </div>

          {/* Root Cause */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Root Cause Analysis
            </label>
            <textarea
              rows={3}
              value={newFinding.rootCause}
              onChange={(e) => setNewFinding(prev => ({ ...prev, rootCause: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Identify the root cause (optional)..."
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence / Attachment
            </label>
            <input
              type="file"
              onChange={(e) => setNewFinding(prev => ({ ...prev, evidence: e.target.files?.[0] }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Finding
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFindingModal;
