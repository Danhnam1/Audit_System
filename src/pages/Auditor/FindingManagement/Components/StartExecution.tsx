import React, { useState } from 'react';
import type { ChecklistItem, ChecklistTemplate, FindingDraft, ImmediateAction, ResultType } from './types';

interface StartExecutionProps {
  selectedChecklist: ChecklistTemplate;
  checklist: ChecklistItem[];
  findingDrafts: FindingDraft[];
  showDailyWrapUp: boolean;
  setShowDailyWrapUp: (show: boolean) => void;
  immediateActions: ImmediateAction[];
  generateDailyWrapUp: () => {
    date: string;
    itemsChecked: number;
    totalItems: number;
    findings: number;
    majorFindings: number;
    immediateActions: number;
    interviewsObservations: number;
  };
  setItemResult: (id: number, result: ResultType) => void;
  setItemRemarks: (id: number, remarks: string) => void;
  openFindingModal: (item: ChecklistItem) => void;
  closeChecklist: () => void;
  submitExecution: () => void;
  // getCriticalityColor: (criticality: string) => string;
  getFindingTypeColor: (type: string) => string;
}

const StartExecution: React.FC<StartExecutionProps> = ({
  selectedChecklist,
  checklist,
  findingDrafts,
  setItemResult,
  setItemRemarks,
  openFindingModal,
  closeChecklist,
  submitExecution,
  // getCriticalityColor,
  getFindingTypeColor,
}) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNoteItem, setCurrentNoteItem] = useState<ChecklistItem | null>(null);
  const [tempNote, setTempNote] = useState('');

  const openNoteModal = (item: ChecklistItem) => {
    setCurrentNoteItem(item);
    setTempNote(item.remarks || '');
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (currentNoteItem) {
      setItemRemarks(currentNoteItem.id, tempNote);
      setShowNoteModal(false);
      setCurrentNoteItem(null);
      setTempNote('');
    }
  };

  const closeNoteModal = () => {
    setShowNoteModal(false);
    setCurrentNoteItem(null);
    setTempNote('');
  };

  return (
    <>
      {/* Execution Header */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-primary-600">{selectedChecklist.name}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedChecklist.code} • {selectedChecklist.department}
            </p>
          </div>
          <button
            onClick={closeChecklist}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ✕ Close
          </button>
        </div>
        
        {/* Progress */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Conform: <span className="font-semibold">{checklist.filter(i => i.result === 'Compliant').length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-700">Non-conform: <span className="font-semibold">{checklist.filter(i => i.result === 'Non-compliant').length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-700">Observation: <span className="font-semibold">{checklist.filter(i => i.result === 'Observation').length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary-600"></div>
            <span className="text-gray-700">Findings Created: <span className="font-semibold">{findingDrafts.length}</span></span>
          </div>
        </div>
      </div>
      

      {/* Checklist Execution Table */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
          <h2 className="text-lg font-semibold text-white">4.1 Checklist Runner - Execute Items</h2>
          <p className="text-sm text-white opacity-90 mt-1">Record result for each item → Auto-create Finding for Non-conform</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">No.</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Checklist Item + Guidance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-28">Standard Ref</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">Category</th>
                {/* <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">Criticality</th> */}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-40">Status (3.2)</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Note + Evidence</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {checklist.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-700">{item.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{item.item}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{item.standardRef}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(item.criticality)}`}> */}
                      {/* {item.criticality}
                    </span> */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {/* Radio buttons for result status */}
                      <div className="flex gap-2">
                        <label className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          item.result === 'Compliant' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`result-${item.id}`}
                            checked={item.result === 'Compliant'}
                            onChange={() => setItemResult(item.id, 'Compliant')}
                            className="w-3 h-3"
                          />
                          <span>Conform</span>
                        </label>
                        <label className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          item.result === 'Non-compliant' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`result-${item.id}`}
                            checked={item.result === 'Non-compliant'}
                            onChange={() => {
                              setItemResult(item.id, 'Non-compliant');
                              // Auto-open finding modal for Non-conform
                              setTimeout(() => openFindingModal(item), 100);
                            }}
                            className="w-3 h-3"
                          />
                          <span>Non-conform</span>
                        </label>
                      </div>
                      <label className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        item.result === 'Observation' 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                        <input
                          type="radio"
                          name={`result-${item.id}`}
                          checked={item.result === 'Observation'}
                          onChange={() => setItemResult(item.id, 'Observation')}
                          className="w-3 h-3"
                        />
                        <span>Observation</span>
                      </label>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {/* Note preview (if exists) */}
                    {item.remarks && (
                      <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                        <p className="font-medium text-gray-600 mb-1">Note:</p>
                        <p className="line-clamp-2">{item.remarks}</p>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => openNoteModal(item)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
                        title={item.remarks ? 'Edit note' : 'Add note'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l10.96-10.96a2 2 0 000-2.828l-1.172-1.172a2 2 0 00-2.828 0L5.293 15.707A1 1 0 005 16.414V20z" />
                        </svg>
                        <span>{item.remarks ? 'Edit Note' : 'Add Note'}</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
                        title="Upload photo evidence"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h4l2-3h6l2 3h4a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm3 8l3-3 4 4 5-5 3 3" />
                        </svg>
                        <span>Upload</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
                        title="Attach link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.172-1.172M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.172 1.172" />
                        </svg>
                        <span>Attach Link</span>
                      </button>
                      {/* <button
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
                        title="Pick from Preparation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.172a2 2 0 001.414-.586l.828-.828A2 2 0 0112.828 3H19a2 2 0 012 2v2H3V7zm0 4h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z" />
                        </svg>
                        <span>Pick from Prep</span>
                      </button> */}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.result === 'Non-compliant' && (
                      <button
                        onClick={() => openFindingModal(item)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-primary-600 hover:bg-primary-700 text-white"
                      >
                         Create Finding 
                      </button>
                    )}
                    {item.result === 'Observation' && (
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs font-semibold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Observation recorded</span>
                      </div>
                    )}
                    {item.result === 'Compliant' && (
                      <div className="text-center text-sm text-green-600 font-medium">
                         Compliant
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Findings Created (3.3) */}
      {findingDrafts.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-yellow-50">
            <h3 className="text-lg font-semibold text-yellow-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              3.3 Findings Created ({findingDrafts.length})
            </h3>
            <p className="text-sm text-yellow-800 mt-1">
              Major: {findingDrafts.filter(f => f.findingType === 'Major').length} • 
              Minor: {findingDrafts.filter(f => f.findingType === 'Minor').length} • 
              Observation: {findingDrafts.filter(f => f.findingType === 'Observation').length}
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {findingDrafts.map((draft, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getFindingTypeColor(draft.findingType)}`}>
                          {draft.findingType}
                        </span>
                        <span className="text-sm text-gray-600">Item #{draft.checklistItemId}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{draft.title}</p>
                      <p className="text-sm text-gray-600">{draft.description}</p>
                      {draft.rootCause && (
                        <p className="text-xs text-gray-500 mt-1">Root Cause: {draft.rootCause}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-primary-100 shadow-md p-4">
        <button
          onClick={closeChecklist}
          className="text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Checklists
        </button>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{checklist.filter(i => i.result).length}</span>/{checklist.length} items completed
          </div>
          <button
            onClick={submitExecution}
            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Close Run & Submit
          </button>
        </div>
      </div>

      {/* Note Modal */}
      {showNoteModal && currentNoteItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-primary">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Add/Edit Note</h3>
                <button
                  onClick={closeNoteModal}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Item Reference */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-600 font-medium mb-1">Checklist Item #{currentNoteItem.id}</p>
                <p className="text-sm font-medium text-gray-900">{currentNoteItem.item}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {currentNoteItem.standardRef}
                  </span>
                  {/* <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(currentNoteItem.criticality)}`}>
                    {currentNoteItem.criticality}
                  </span> */}
                </div>
              </div>

              {/* Note Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (summary, observations, context...)
                </label>
                <textarea
                  value={tempNote}
                  onChange={(e) => setTempNote(e.target.value)}
                  placeholder="Enter your note here... (e.g., 'Checked 5 files, all compliant', 'Missing signature on page 3', etc.)"
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {tempNote.length} characters
                </p>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-900 mb-1">💡 Tips for good notes:</p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Be specific and concise</li>
                  <li>Include relevant details (what/who/when/where)</li>
                  <li>For Non-conform: describe what was observed vs. what was expected</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={closeNoteModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-sm"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StartExecution;
