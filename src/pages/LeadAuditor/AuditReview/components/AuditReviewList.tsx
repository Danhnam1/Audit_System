import React from 'react';

interface AuditSummary {
  auditId?: string;
  id?: string;
  title?: string;
  department?: string;
  priority?: string;
  findings?: number;
  submittedBy?: string;
  submittedDate?: string;
  // optional detailed fields returned from backend
  scopeDepartments?: Array<{ deptId?: string | number; deptName?: string }> | { values?: Array<{ deptId?: string | number; deptName?: string }> };
  createdByUser?: { fullName?: string };
  createdBy?: string;
  startDate?: string;
  schedules?: { values?: Array<{ dueDate?: string }> };
}

interface Props {
  plans: AuditSummary[];
  onSelect: (id: string) => void;
  getDepartmentName?: (id: any) => string;
}

export const AuditReviewList: React.FC<Props> = ({ plans, onSelect, getDepartmentName }) => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
        <h2 className="text-lg font-semibold text-white">Pending Audit Plans</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Findings</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted By</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.map((audit) => (
              <tr key={audit.auditId || audit.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{audit.auditId || audit.id}</span></td>
                <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{audit.title}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{
                  // normalize scope array whether it's an array or { values: [] }
                  (() => {
                    const scopeArr = Array.isArray(audit.scopeDepartments) ? audit.scopeDepartments : (audit.scopeDepartments?.values || []);
                    if (Array.isArray(scopeArr) && scopeArr.length > 0) {
                      return scopeArr
                        .map((d: any) => {
                          if (d.deptName) return d.deptName;
                          const id = d.deptId ?? d.id ?? d.$id ?? d.departmentId ?? d.deptCode ?? d.name;
                          if (getDepartmentName && id !== undefined && id !== null) return getDepartmentName(id);
                          return id;
                        })
                        .filter(Boolean)
                        .join(', ');
                    }
                    // fallback: audit.department might be an id
                    if (audit.department) {
                      return getDepartmentName ? getDepartmentName(audit.department) : audit.department;
                    }
                    return 'N/A';
                  })()
                }</span></td>
                <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border text-gray-700`}>{audit.priority}</span></td>
                <td className="px-6 py-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">{audit.findings ?? 0}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{audit.createdByUser?.fullName || audit.createdBy || audit.submittedBy || 'N/A'}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.startDate ? new Date(audit.startDate).toLocaleDateString() : (audit.schedules?.values?.[0]?.dueDate ? new Date(audit.schedules.values[0].dueDate).toLocaleDateString() : audit.submittedDate || 'N/A')}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => onSelect(String(audit.auditId || audit.id))} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150">Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditReviewList;
