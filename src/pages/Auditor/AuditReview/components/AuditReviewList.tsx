import React from 'react';
import { Button } from '../../../../components';
import { getStatusColor } from '../../../../constants';

interface AuditSummary {
  auditId?: string;
  id?: string;
  title?: string;
  department?: string;
  submittedBy?: string;
  submittedDate?: string;
  scopeDepartments?: Array<{ deptId?: string | number; deptName?: string }> | { values?: Array<{ deptId?: string | number; deptName?: string }> };
  createdByUser?: { fullName?: string };
  createdBy?: string;
  startDate?: string;
  schedules?: { values?: Array<{ dueDate?: string }> };
}

interface Props {
  plans: AuditSummary[];
  onSelect: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  getDepartmentName?: (id: any) => string;
  title?: string;
}

export const AuditReviewList: React.FC<Props> = ({ plans, onSelect, onApprove, onReject, getDepartmentName }) => {
  if (plans.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-500">
        No plans found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">NO</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted By</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {plans.map((audit, idx) => (
            <tr key={audit.auditId || audit.id || idx} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{idx + 1}</span></td>
              <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{audit.title}</span></td>
              <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{
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
                  if (audit.department) {
                    return getDepartmentName ? getDepartmentName(audit.department) : audit.department;
                  }
                  return 'N/A';
                })()
              }</span></td>
              <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{audit.createdByUser?.fullName || audit.createdBy || audit.submittedBy || 'N/A'}</span></td>
              <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.startDate ? new Date(audit.startDate).toLocaleDateString() : (audit.schedules?.values?.[0]?.dueDate ? new Date(audit.schedules.values[0].dueDate).toLocaleDateString() : audit.submittedDate || 'N/A')}</span></td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={() => onSelect(String(audit.auditId || audit.id))} size="sm" variant="secondary">
                    View
                  </Button>
                  {onApprove && (
                    <button
                      onClick={() => onApprove(String(audit.auditId || audit.id))}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Approved') + ' hover:opacity-90'}`}
                    >
                      Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      onClick={() => onReject(String(audit.auditId || audit.id))}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Rejected') + ' hover:opacity-90'}`}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditReviewList;

