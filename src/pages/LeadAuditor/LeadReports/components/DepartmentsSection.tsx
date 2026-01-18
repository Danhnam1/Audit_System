import React from 'react';
import { unwrap } from '../../../../utils/normalize';
import { getSeverityColor } from '../../../../constants/statusColors';

interface DeptEntry { key: string; name: string; count: number; deptId?: any }

interface Props {
  departmentEntries: DeptEntry[];
  selectedDeptKey: string;
  setSelectedDeptKey: (key: string) => void;
  findings: any[];
  onViewFinding: (finding: any) => void;
  findingsSearch: string;
  setFindingsSearch: (v: string) => void;
  findingsSeverity: string;
  setFindingsSeverity: (v: string) => void;
  onViewAttachments?: (attachments: any[], findingTitle: string) => void;
  selectedFindings?: Set<string>;
  requiredFindings?: Set<string>;
  onSelectFinding?: (findingId: string, isSelected: boolean) => void;
}

const DepartmentsSection: React.FC<Props> = ({
  departmentEntries,
  selectedDeptKey,
  setSelectedDeptKey,
  findings,
  onViewFinding,
  findingsSearch,
  setFindingsSearch,
  findingsSeverity,
  setFindingsSeverity,
  onViewAttachments,
  selectedFindings = new Set(),
  requiredFindings = new Set(),
  onSelectFinding
}) => {
  const filteredFindings = findings.filter((f: any) => {
    const sev = String(f?.severity || '').toLowerCase();
    if (findingsSeverity && findingsSeverity !== 'all') {
      if (findingsSeverity === 'major' && !sev.includes('major')) return false;
      if (findingsSeverity === 'minor' && !sev.includes('minor')) return false;
      if (findingsSeverity === 'other' && (sev.includes('major') || sev.includes('minor'))) return false;
    }
    if (findingsSearch.trim()) {
      const q = findingsSearch.trim().toLowerCase();
      const hay = [
        f?.title,
        f?.description,
        f?.auditItem?.questionTextSnapshot,
        f?.auditItem?.section,
        f?.status,
        f?.severity
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return (
    <>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Departments in this report</h3>
        {departmentEntries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {departmentEntries.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDeptKey(d.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedDeptKey === d.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >{d.name} <span className="ml-1 text-[10px] opacity-80">({d.count})</span></button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No departments found</div>
        )}
      </div>
      {selectedDeptKey ? (
        <div className="rounded-lg border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-700">Findings for: <span className="text-primary-700">{departmentEntries.find(d=>d.key===selectedDeptKey)?.name || selectedDeptKey}</span></h4>
              <span className="text-xs text-gray-500">{filteredFindings.length} items</span>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                value={findingsSearch}
                onChange={(e) => setFindingsSearch(e.target.value)}
                placeholder="Search findings..."
                className="flex-1 md:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
              />
              <select
                value={findingsSeverity}
                onChange={(e) => setFindingsSeverity(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="all">All Sev.</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase w-12">
                    {onSelectFinding && (
                      <input
                        type="checkbox"
                        checked={filteredFindings.length > 0 && filteredFindings.every((f: any) => {
                          const fid = String(f?.findingId || '');
                          return selectedFindings.has(fid);
                        })}
                        onChange={(e) => {
                          filteredFindings.forEach((f: any) => {
                            const fid = String(f?.findingId || '');
                            onSelectFinding?.(fid, e.target.checked);
                          });
                        }}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                    )}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Severity</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Created</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Deadline</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Attachments</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFindings.map((f: any, i: number) => {
                  const fid = String(f?.findingId || i);
                  const created = f?.createdAt ? new Date(f.createdAt).toLocaleDateString() : '';
                  const deadline = f?.deadline ? new Date(f.deadline).toLocaleDateString() : '';
                  const isReturned = String(f?.status || '').toLowerCase() === 'return';
                  const isSelected = selectedFindings.has(fid);
                  const isRequired = requiredFindings.has(fid);
                  return (
                    <tr 
                      key={fid} 
                      className={`hover:bg-gray-50 ${isReturned ? 'border-l-4 border-orange-500' : ''} ${isSelected ? 'bg-orange-50' : ''} ${isRequired ? 'bg-green-50 border-l-4 border-green-500' : ''}`}
                    >
                      <td className="px-4 py-2 text-sm">
                        {onSelectFinding && (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isRequired}
                              onChange={(e) => onSelectFinding(fid, e.target.checked)}
                              className={`w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 ${isRequired ? 'cursor-not-allowed opacity-60' : ''}`}
                              title={isRequired ? 'Required due to approved extension request' : ''}
                            />
                           
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{f?.title || '—'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(f?.severity || '')}`}>{f?.severity || '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{created}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{deadline}</td>
                      <td className="px-4 py-2 text-sm">
                        {(() => {
                          const attachments = unwrap(f?.attachments) || [];
                          if (attachments.length === 0) return <span className="text-xs text-gray-400">—</span>;
                          return (
                            <button
                              onClick={() => {
                                if (onViewAttachments) {
                                  onViewAttachments(attachments, f?.title || 'Finding Attachments');
                                }
                              }}
                              className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors cursor-pointer"
                              title={`Click to view ${attachments.length} attachment(s)`}
                            >
                              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <span className="text-xs text-primary-600 font-medium">{attachments.length}</span>
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">
                        <button
                          onClick={() => onViewFinding(f)}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >Details</button>
                      </td>
                    </tr>
                  );
                })}
                {filteredFindings.length === 0 && (
                  <tr><td colSpan={onSelectFinding ? 7 : 6} className="px-4 py-6 text-sm text-gray-500">No findings match current filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Select a department to view findings</div>
      )}
    </>
  );
};

export default DepartmentsSection;

