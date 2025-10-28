import React from 'react';
import type { FindingRecord, InterviewLog } from './types';

interface InterviewObservationModalProps {
  visible: boolean;
  currentFinding: FindingRecord | null;
  newInterview: Omit<InterviewLog, 'id' | 'date'>;
  setNewInterview: React.Dispatch<React.SetStateAction<Omit<InterviewLog, 'id' | 'date'>>>;
  onClose: () => void;
  onSave: () => void;
}

const InterviewObservationModal: React.FC<InterviewObservationModalProps> = ({
  visible,
  currentFinding,
  newInterview,
  setNewInterview,
  onClose,
  onSave,
}) => {
  if (!visible || !currentFinding) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-primary px-6 py-4 border-b border-primary-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Interview / Observation logger</h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Finding Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Finding</label>
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm font-medium text-primary-900">{currentFinding.id}</p>
              <p className="text-xs text-gray-600 mt-1">{currentFinding.title}</p>
            </div>
          </div>
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={newInterview.type === 'Interview'}
                  onChange={() => setNewInterview(prev => ({ ...prev, type: 'Interview' }))}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Interview</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={newInterview.type === 'Observation'}
                  onChange={() => setNewInterview(prev => ({ ...prev, type: 'Observation' }))}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Observation</span>
              </label>
            </div>
          </div>

          {/* Person/Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Person/Role: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newInterview.personRole}
              onChange={(e) => setNewInterview(prev => ({ ...prev, personRole: e.target.value }))}
              placeholder="Mr. A - Instructor"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary: <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={newInterview.summary}
              onChange={(e) => setNewInterview(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Key Q/A or observation ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments:</label>
            <input
              type="file"
              multiple
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            
          </div>

          {/* Link to checklist item (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Link to Item (optional)</label>
            <input
              type="text"
              value={newInterview.linkToItem}
              onChange={(e) => setNewInterview(prev => ({ ...prev, linkToItem: e.target.value }))}
              placeholder="e.g., CCREC-ATT-03"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewObservationModal;
