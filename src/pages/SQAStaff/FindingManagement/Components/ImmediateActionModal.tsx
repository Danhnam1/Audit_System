import React from 'react';
import type { FindingRecord, ImmediateAction } from './types';

interface ImmediateActionModalProps {
  visible: boolean;
  currentFinding: FindingRecord | null;
  newIA: Omit<ImmediateAction, 'id' | 'status' | 'createdDate'>;
  setNewIA: React.Dispatch<React.SetStateAction<Omit<ImmediateAction, 'id' | 'status' | 'createdDate'>>>;
  onClose: () => void;
  onSave: () => void;
}

const ImmediateActionModal: React.FC<ImmediateActionModalProps> = ({
  visible,
  currentFinding,
  newIA,
  setNewIA,
  onClose,
  onSave,
}) => {
  if (!visible || !currentFinding) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-primary px-6 py-4 border-b border-primary-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Immediate Action (modal)</h3>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Finding:</label>
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm font-medium text-primary-900">{currentFinding.id}</p>
              <p className="text-xs text-gray-600 mt-1">{currentFinding.title}</p>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action *:
            </label>
            <textarea
              rows={3}
              value={newIA.action}
              onChange={(e) => setNewIA(prev => ({ ...prev, action: e.target.value }))}
              placeholder="Temporary manual cross-check ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner *:
            </label>
            <select
              value={newIA.owner}
              onChange={(e) => setNewIA(prev => ({ ...prev, owner: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select owner </option>
              <option value="Regulary Owner">Regulary Owner </option>
              <option value="Department Head">Department Head</option>
              <option value="Safety Manager">Safety Manager</option>
              <option value="Training Manager">Training Manager</option>
            </select>
          </div>

          {/* Due Date/Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due *: <span className="text-xs text-gray-500">({"< 72h"})</span>
            </label>
            <input
              type="datetime-local"
              value={newIA.dueDateTime}
              onChange={(e) => setNewIA(prev => ({ ...prev, dueDateTime: e.target.value }))}
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
            Create IA 
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImmediateActionModal;
