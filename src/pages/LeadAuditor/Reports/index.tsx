import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditSummary, approveAuditReport, rejectAuditReport } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';

const LeadAuditorReports = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<any[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [summary, setSummary] = useState<any | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'completed'>('all');

  const isRelevantToLead = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (!s) return false;
    // Only show Submitted and Completed states
    return (
      s.includes('submit') || s.includes('submitted') ||
      s.includes('approve') || s.includes('completed') || s.includes('complete')
    );
  };

  const reload = useCallback(async () => {
    try {
      const res = await getAuditPlans();
      const list = unwrap(res);
      const all = (Array.isArray(list) ? list : []).map((p: any) => ({ ...p }));
      const filtered = all.filter((p: any) => isRelevantToLead(p.status || p.state || p.approvalStatus));
      setAudits(filtered);
    } catch (err) {
      console.error('Failed to load audits for LeadAuditor Reports', err);
      setAudits([]);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedAuditId) return;
      try {
        const sum = await getAuditSummary(selectedAuditId);
        setSummary(sum);
      } catch (err) {
        console.error('Failed to load summary', err);
        setSummary(null);
      } finally {}
    };
    loadSummary();
  }, [selectedAuditId]);

  useEffect(() => {
    if (showSummary) {
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showSummary, selectedAuditId]);

  const rows = useMemo(() => {
    return (Array.isArray(audits) ? audits : []).map((a: any, idx: number) => {
      const id = String(a.auditId || a.id || a.$id || `audit_${idx}`);
      const title = a.title || a.name || `Audit ${idx + 1}`;
      const rawStatus = a.status || a.state || '—';
      const norm = String(rawStatus).toLowerCase().replace(/\s+/g, '');
      const status = norm.includes('approve') ? 'Completed' : (norm.includes('submit') ? 'Submitted' : rawStatus);
      const createdRaw = a.createdAt || a.startDate || a.createdDate || a.start;
      const createdDate = createdRaw ? new Date(createdRaw).toISOString().slice(0, 10) : '';
      return { auditId: id, title, status, createdDate };
    });
  }, [audits]);

  const filteredRows = useMemo(() => {
    const list = rows;
    if (statusFilter === 'all') return list;
    return list.filter((r) => {
      const s = String(r.status || '').toLowerCase().replace(/\s+/g, '');
      if (statusFilter === 'submitted') return s.includes('submit');
      if (statusFilter === 'completed') return s.includes('completed');
      return true;
    });
  }, [rows, statusFilter]);

  const needsDecision = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (!s) return false;
    if (s.includes('approve') || s.includes('reject') || s.includes('completed')) return false; // already decided
    return s.includes('submit') || s.includes('pending') || s.includes('under review') || s.includes('underreview');
  };

  const handleApprove = async (auditId: string) => {
    setActionLoading(auditId);
    setActionMsg(null);
    try {
      await approveAuditReport(auditId);
      setAudits(prev => prev.map(a => String(a.auditId || a.id || a.$id) === auditId ? { ...a, status: 'Completed' } : a));
      setActionMsg(`Audit ${auditId} đã chuyển trạng thái thành Completed.`);
      // Optionally refresh from backend to keep in sync
      // await reload();
    } catch (err) {
      console.error('Approve failed', err);
      setActionMsg('Approve thất bại. Vui lòng thử lại.');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (auditId: string) => {
    setActionLoading(auditId);
    setActionMsg(null);
    try {
      await rejectAuditReport(auditId, {});
      setAudits(prev => prev.map(a => String(a.auditId || a.id || a.$id) === auditId ? { ...a, status: 'Rejected' } : a));
      setActionMsg(`Audit ${auditId} đã bị reject.`);
    } catch (err) {
      console.error('Reject failed', err);
      setActionMsg('Reject thất bại. Vui lòng thử lại.');
    } finally {
      setActionLoading('');
    }
  };

  const severityEntries = useMemo(() => {
    const obj = summary?.severityBreakdown || {};
    return Object.entries(obj).filter(([k]) => k && !String(k).startsWith('$'));
  }, [summary]);
  const severityTotal = useMemo(() => severityEntries.reduce((acc, [, v]) => acc + (Number(v as any) || 0), 0), [severityEntries]);

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Reports</h1>
            <p className="text-gray-600 text-sm mt-1">View audit reports submitted by Auditors</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Reports</h2>
          </div>

          <div className="px-6 py-3 flex items-center gap-3">
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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((r) => (
                  <tr key={r.auditId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{r.title}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{r.auditId}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{r.createdDate}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-3 items-center">
                        <button onClick={() => { setSelectedAuditId(r.auditId); setShowSummary(true); }} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        {needsDecision(r.status) && (
                          <>
                            <button
                              onClick={() => handleApprove(r.auditId)}
                              disabled={actionLoading === r.auditId}
                              className={`text-sm font-medium px-2 py-1 rounded-md shadow-sm transition-colors ${actionLoading === r.auditId ? 'bg-teal-300 cursor-not-allowed text-white' : 'bg-teal-500 hover:bg-teal-600 text-white'}`}
                            >{actionLoading === r.auditId ? 'Đang duyệt...' : 'Approve'}</button>
                            <button
                              onClick={() => handleReject(r.auditId)}
                              disabled={actionLoading === r.auditId}
                              className={`text-sm font-medium px-2 py-1 rounded-md shadow-sm transition-colors ${actionLoading === r.auditId ? 'bg-gray-300 cursor-not-allowed text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                            >{actionLoading === r.auditId ? 'Đang xử lý...' : 'Reject'}</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>Không có báo cáo phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {actionMsg && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-700">{actionMsg}</div>
          )}
        </div>

        {showSummary && (
          <div ref={summaryRef} className="bg-white rounded-xl border border-primary-100 shadow-md p-6 scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">Summary Findings</h2>
                <span className="text-xs text-gray-500">Tổng quan theo audit đã chọn</span>
              </div>
              {/* Lead Auditor only reviews; export is done by Auditor after approval */}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-xl font-semibold text-primary-700">{summary?.totalFindings ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Open</div>
                <div className="text-xl font-semibold text-amber-600">{summary?.openFindings ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Closed</div>
                <div className="text-xl font-semibold text-green-600">{summary?.closedFindings ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Overdue</div>
                <div className="text-xl font-semibold text-red-600">{summary?.overdueFindings ?? 0}</div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Severity Breakdown</div>
              <div className="space-y-2">
                {severityEntries.map(([name, val]) => {
                  const count = Number(val as any) || 0;
                  const pct = severityTotal ? Math.round((count * 100) / severityTotal) : 0;
                  const lc = String(name).toLowerCase();
                  const color = lc.includes('critical') || lc.includes('high') ? '#ef4444' : lc.includes('major') || lc.includes('medium') ? '#f59e0b' : '#3b82f6';
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-700">{name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className="w-20 text-right text-sm text-gray-700">{count} ({pct}%)</span>
                    </div>
                  );
                })}
                {severityEntries.length === 0 && (
                  <div className="text-sm text-gray-500">No data</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default LeadAuditorReports;
