import React from 'react';
import { Button } from '../../../../components/Button';


interface Row {
  auditId: string;
  title: string;
  status: string; // Backend status (InProgress)
  displayStatus: string; // Frontend display (Waiting)
  createdBy: string;
  rawStatus?: string;
  isDirectorApproved?: boolean;
}

interface Props {
  rows: Row[];
  statusFilter: 'all' | 'submitted' | 'approved';
  setStatusFilter: (v: 'all' | 'submitted' | 'approved') => void;
  reportSearch: string;
  setReportSearch: (v: string) => void;
  needsDecision: (status: string) => boolean;
  onView: (auditId: string) => void;
  onApprove: (auditId: string) => void;
  onReject: (auditId: string) => void;
  onEditScheduleAndTeam?: (auditId: string) => void;
  editedScheduleTeamOnce?: Set<string>;
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
  onEditScheduleAndTeam,
  editedScheduleTeamOnce,
  actionLoading,
  actionMsg,
  getStatusColor
}) => {
  // Check if status allows editing schedule and team (Director approved)
  // Button hiển thị khi:
  // 1. Có extension request (revision request) đã được Director approve (isDirectorApproved = true)
  // 2. VÀ report status KHÔNG phải "Returned" (không bị reject) - kể cả sau khi đã edit
  // 3. VÀ report status KHÔNG phải "Approved" (chưa được approve)
  const canEditScheduleAndTeam = (auditId: string, status: string, rawStatus?: string, isDirectorApproved?: boolean) => {
    // Normalize status (check both status and rawStatus for edge cases)
    const statusLower = String(status || '').toLowerCase().trim().replace(/\s+/g, '');
    const rawStatusLower = String(rawStatus || '').toLowerCase().trim().replace(/\s+/g, '');
    const key = String(auditId || '').toLowerCase().trim();
    if (editedScheduleTeamOnce?.has(key)) return false; // already edited once
    
    // Nếu report đã bị reject (Returned) - ẩn button ngay cả khi đã edit trước đó
    // Check multiple variations: returned, reject, rejected
    if (statusLower === 'returned' || 
        statusLower.includes('return') || 
        statusLower.includes('reject') ||
        rawStatusLower === 'returned' ||
        rawStatusLower.includes('return') ||
        rawStatusLower.includes('reject')) {
      return false;
    }
    
    // Nếu report đã được approve - ẩn button
    if (statusLower === 'approved' || 
        statusLower.includes('approve') ||
        rawStatusLower === 'approved' ||
        rawStatusLower.includes('approve')) {
      return false;
    }
    
    // Nếu có Director approval (bao gồm cả extension request đã approved), cho phép edit
    // Nhưng chỉ khi status không phải Returned hoặc Approved (đã check ở trên)
    return isDirectorApproved === true;
  };
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
              <option value="approved">Approved</option>
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
                      {canEditScheduleAndTeam(r.auditId, r.status, r.rawStatus, r.isDirectorApproved) && onEditScheduleAndTeam && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onEditScheduleAndTeam(r.auditId)}
                          className="text-xs rounded-md font-semibold shadow-sm"
                          title="Edit Schedule & Team - Update audit schedule and team members"
                          leftIcon={
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          }
                        >
                          Edit Schedule & Team
                        </Button>
                      )}
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
                        
                        return needsDecision(r.status) ? (
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => onApprove(r.auditId)}
                              disabled={actionLoading === `${r.auditId}:approve` || actionLoading === `${r.auditId}:reject`}
                              isLoading={actionLoading === `${r.auditId}:approve`}
                              className="text-xs rounded-md font-semibold shadow-sm"
                              leftIcon={
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              }
                            >
                              {actionLoading === `${r.auditId}:approve` ? 'Approving...' : 'Approve'}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => onReject(r.auditId)}
                              disabled={actionLoading === `${r.auditId}:approve` || actionLoading === `${r.auditId}:reject`}
                              isLoading={actionLoading === `${r.auditId}:reject`}
                              className="text-xs rounded-md font-semibold shadow-sm"
                              leftIcon={
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              }
                            >
                              {actionLoading === `${r.auditId}:reject` ? 'Rejecting...' : 'Reject'}
                            </Button>
                          </>
                        ) : null;
                      })()}
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

