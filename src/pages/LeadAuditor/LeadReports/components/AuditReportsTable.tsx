import React from 'react';


interface Row {
  auditId: string;
  title: string;
  status: string;
  createdBy: string;
}

interface Props {
  rows: Row[];
  statusFilter: 'all' | 'submitted' | 'closed';
  setStatusFilter: (v: 'all' | 'submitted' | 'closed') => void;
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
      <div className="bg-white p-4">
        <div className="px-2 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex-1">
            <input
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Search title..."
              className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto font-noto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-bold text-black">#</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-black">Audit Title</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-black">Status</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-black">Created By</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-black">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {rows.map((r, idx) => (
                <tr key={r.auditId} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">{idx + 1}</td>
                  <td className="px-6 py-4"><span className="text-ms font-bold text-black">{r.title}</span></td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="text-ms text-[#5b6166]">{r.createdBy || '—'}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 items-center justify-center">
                      <button
                        onClick={() => onView(r.auditId)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {needsDecision(r.status) && (
                        <>
                          <button
                            onClick={() => onApprove(r.auditId)}
                            disabled={actionLoading === r.auditId}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white"
                          >
                            {actionLoading === r.auditId ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => onReject(r.auditId)}
                            disabled={actionLoading === r.auditId}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white"
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
      </div>
      );
};

      export default AuditReportsTable;

