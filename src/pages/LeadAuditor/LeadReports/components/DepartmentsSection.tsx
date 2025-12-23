import React from 'react';

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
  setFindingsSeverity
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
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Severity</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Created</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Deadline</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFindings.map((f: any, i: number) => {
                  const fid = String(f?.findingId || i);
                  const created = f?.createdAt ? new Date(f.createdAt).toLocaleDateString() : '';
                  const deadline = f?.deadline ? new Date(f.deadline).toLocaleDateString() : '';
                  const isReturned = String(f?.status || '').toLowerCase() === 'return';
                  return (
                    <tr 
                      key={fid} 
                      className={`hover:bg-gray-50 ${isReturned ? 'border-l-4 border-orange-500' : ''}`}
                    >
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{f?.title || '—'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${String(f?.severity||'').toLowerCase().includes('major') ? 'bg-amber-100 text-amber-700' : String(f?.severity||'').toLowerCase().includes('minor') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{f?.severity || '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{f?.status || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{created}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{deadline}</td>
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
                  <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-500">No findings match current filters</td></tr>
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

