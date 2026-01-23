import React from 'react';
import { Button } from '../../../../components/Button';
import { getAuditTypeBadgeColor } from '../../../../constants/statusColors';


interface Row {
  auditId: string;
  title: string;
  type?: string; // Audit type (e.g., internal, external)
  status: string; // Backend status (InProgress)
  displayStatus: string; // Frontend display (Waiting)
  createdBy: string;
  rawStatus?: string;
  isDirectorApproved?: boolean;
}

interface Props {
  rows: Row[];
  statusFilter: 'all' | 'pending' | 'approved' | 'returned';
  setStatusFilter: (v: 'all' | 'pending' | 'approved' | 'returned') => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  typeOptions: string[];
  reportSearch: string;
  setReportSearch: (v: string) => void;
  onView: (auditId: string) => void;
  onEditScheduleAndTeam?: (auditId: string) => void;
  editedScheduleTeamOnce?: Set<string>;
  actionMsg: string | null;
  getStatusColor: (status: string) => string;
}

const AuditReportsTable: React.FC<Props> = ({
  rows,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  typeOptions,
  reportSearch,
  setReportSearch,
  onView,
  editedScheduleTeamOnce,
  actionMsg,
  getStatusColor
}) => {
  void editedScheduleTeamOnce;
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
      <div className="bg-white p-4">
        <div className="px-2 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="returned">Returned</option>
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
                <th className="px-6 py-4 text-center text-sm font-bold text-black">Type</th>
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
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    {r.type ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getAuditTypeBadgeColor(r.type)}`}>
                        {r.type}
                      </span>
                    ) : (
                      <span className="text-ms text-[#5b6166]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.displayStatus}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="text-ms text-[#5b6166]">{r.createdBy || '—'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2 items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(r.auditId)}
                        className="p-2 rounded-md font-semibold shadow-sm"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                      
                      {(() => {
                        // Double-check: Don't show Approve/Reject buttons if status is Approved or Returned
                        // Check both r.status and r.displayStatus to ensure we catch all cases
                        const statusToCheck = String(r.status || r.displayStatus || r.rawStatus || '').toLowerCase().trim().replace(/\s+/g, '');
                        const isApproved = statusToCheck === 'approved' || statusToCheck.includes('approve');
                        const isReturned = statusToCheck === 'returned' || statusToCheck.includes('return') || statusToCheck.includes('reject');
                        
                        // Only show buttons if needsDecision returns true AND status is not Approved/Returned
                        if (isApproved || isReturned) {
                          return null;
                        }
                        
                        // Approve and Return actions are now only available in Report Details modal footer
                        return null;
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-gray-500" colSpan={6}>No matching reports.</td>
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

