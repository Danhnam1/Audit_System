import React from 'react';
import { getStatusColor } from '../../../../constants';
import type { ChecklistTemplate, FindingRecord } from './types';

interface FindingListProps {
  checklistTemplates: ChecklistTemplate[];
  openChecklist: (template: ChecklistTemplate) => void;
  audits: { id: string; title: string }[];
  selectedAudit: string;
  setSelectedAudit: (val: string) => void;
  filteredFindings: FindingRecord[];
  getSeverityColor: (severity: string) => string;
  onOpenInterview: (finding: FindingRecord) => void;
  onOpenImmediateAction: (finding: FindingRecord) => void;
}

const FindingList: React.FC<FindingListProps> = ({
  checklistTemplates,
  openChecklist,
  audits,
  selectedAudit,
  setSelectedAudit,
  filteredFindings,
  getSeverityColor,
  onOpenInterview,
  onOpenImmediateAction,
}) => {
  return (
    <>
      {/* Only show Checklist Templates if provided (backwards compatibility) */}
      {checklistTemplates.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Available Checklists</h2>
            <p className="text-sm text-primary-50 mt-1">Select a checklist to start execution</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Checklist Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checklistTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{template.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{template.name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{template.auditType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{template.department}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                        {template.totalItems}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        template.status === 'Active' ? getStatusColor('Approved') :
                        template.status === 'Draft' ? getStatusColor('Draft') :
                        'bg-gray-400 text-white'
                      }`}>
                        {template.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => openChecklist(template)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Start Execution
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by Audit:</label>
          <select 
            value={selectedAudit}
            onChange={(e) => setSelectedAudit(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Audits</option>
            {audits.map(a => <option key={a.id} value={a.id}>{a.id} - {a.title}</option>)}
          </select>
          <span className="text-sm text-gray-600">
            Showing {filteredFindings.length} finding(s)
          </span>
        </div>
      </div>

      {/* Findings Table */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
          <h2 className="text-lg font-semibold text-white">Findings List</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFindings.map((finding) => (
                <tr key={finding.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-primary-600">{finding.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{finding.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{finding.description.substring(0, 50)}...</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{finding.auditId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{finding.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status)}`}>
                      {finding.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{finding.dueDate}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <button
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
                        title="View finding"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-primary-200 bg-white text-primary-700 hover:bg-primary-50 transition-colors font-medium"
                        title="Edit finding"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l10.96-10.96a2 2 0 000-2.828l-1.172-1.172a2 2 0 00-2.828 0L5.293 15.707A1 1 0 005 16.414V20z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onOpenInterview(finding)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors font-medium"
                        title="Interview / Observation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75c-3.728 0-6.75 2.574-6.75 5.75s3.022 5.75 6.75 5.75c.64 0 1.26-.07 1.846-.2l3.904 2.15a.75.75 0 001.1-.66v-3.007c1.192-1.02 1.9-2.38 1.9-4.033 0-3.176-3.022-5.75-6.75-5.75z" />
                        </svg>
                        <span>Interview / Observation</span>
                      </button>
                      <button
                        onClick={() => onOpenImmediateAction(finding)}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium"
                        title="Immediate Action"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Immediate Action</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default FindingList;
