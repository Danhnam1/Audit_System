import React from 'react';
import { Button } from '../../../../components';

interface Row {
  auditId: string;
  title: string;
  status: string;
  createdDate: string;
}

interface Props {
  rows: Row[];
  statusFilter: 'all' | 'submitted' | 'completed';
  setStatusFilter: (v: 'all' | 'submitted' | 'completed') => void;
  reportSearch: string;
  setReportSearch: (v: string) => void;
  needsDecision: (status: string) => boolean;
  onView: (auditId: string) => void;
  onApprove: (auditId: string) => void;
  onReject: (auditId: string) => void;
  actionLoading: string;
  actionMsg: string | null;
  getStatusColor: (status: string) => string;
}

const AuditReportsTable: React.FC<Props> = ({
  rows,
  statusFilter,
  setStatusFilter,
  reportSearch,
  setReportSearch,
  needsDecision,
  onView,
  onApprove,
  onReject,
  actionLoading,
  actionMsg,
  getStatusColor
}) => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
        <h2 className="text-lg font-semibold text-white">Audit Reports</h2>
      </div>
      <div className="px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex-1">
          <input
            value={reportSearch}
            onChange={(e) => setReportSearch(e.target.value)}
            placeholder="Search title..."
            className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r, idx) => (
              <tr key={r.auditId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">{idx + 1}</td>
                <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{r.title}</span></td>
                <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{r.createdDate}</span></td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-3 items-center justify-center">
                    <Button 
                      onClick={() => onView(r.auditId)} 
                      size="sm" 
                      variant="secondary"
                    >
                      View
                    </Button>
                    {needsDecision(r.status) && (
                      <>
                        <button
                          onClick={() => onApprove(r.auditId)}
                          disabled={actionLoading === r.auditId}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${actionLoading === r.auditId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Approved') + ' hover:opacity-90'}`}
                        >
                          {actionLoading === r.auditId ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => onReject(r.auditId)}
                          disabled={actionLoading === r.auditId}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${actionLoading === r.auditId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Rejected') + ' hover:opacity-90'}`}
                        >
                          {actionLoading === r.auditId ? 'Rejecting...' : 'Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>No matching reports.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {actionMsg && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-700">{actionMsg}</div>
      )}
    </div>
  );
};

export default AuditReportsTable;

