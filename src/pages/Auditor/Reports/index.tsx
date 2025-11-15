import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useEffect, useMemo, useState } from 'react';
import { getStatusColor } from '../../../constants';
import { StatCard, LineChartCard, BarChartCard, PieChartCard } from '../../../components';
import { getAuditPlans, getAuditChartLine, getAuditChartPie, getAuditChartBar, getAuditSummary, exportAuditPdf } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';

const SQAStaffReports = () => {
  const { user } = useAuth();

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Audit list and selected audit
  const [audits, setAudits] = useState<any[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);

  // Chart datasets
  const [lineData, setLineData] = useState<Array<{ month: string; count: number }>>([]);
  const [pieData, setPieData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [barData, setBarData] = useState<Array<{ department: string; count: number }>>([]);

  // Derived datasets for summary rendering
  const severityEntries = useMemo(() => Object.entries(summary?.severityBreakdown || {}), [summary]);
  const severityTotal = useMemo(
    () => severityEntries.reduce((acc, [, v]) => acc + (Number(v as any) || 0), 0),
    [severityEntries]
  );
  const deptRows = useMemo(() => unwrap(summary?.byDepartment), [summary]);
  const rootCauseRows = useMemo(() => unwrap(summary?.byRootCause), [summary]);
  const findingsRows = useMemo(() => unwrap(summary?.findings), [summary]);
  const [search, setSearch] = useState('');
  const filteredFindings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return findingsRows;
    return findingsRows.filter((f: any) => {
      const hay = [
        f?.title,
        f?.description,
        f?.severity,
        f?.status,
        f?.createdByUser?.fullName,
        String(f?.deptId)
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [findingsRows, search]);

  // Severity colors
  const severityColor = (sev: string) => {
    const k = String(sev || '').toLowerCase();
    if (k.includes('critical') || k.includes('high')) return '#ef4444';
    if (k.includes('major') || k.includes('medium')) return '#f59e0b';
    return '#3b82f6'; // minor/low default
  };

  // Load audits list
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAuditPlans();
        const arr = unwrap(res);
        setAudits(arr);
        const firstId = arr?.[0]?.auditId || arr?.[0]?.id || arr?.[0]?.$id || '';
        if (firstId) setSelectedAuditId(String(firstId));
      } catch (err) {
        console.error('Failed to load audits for Reports', err);
      }
    };
    load();
  }, []);

  // Load charts when audit changes
  useEffect(() => {
    const loadCharts = async () => {
      if (!selectedAuditId) return;
      setLoadingCharts(true);
      try {
        const [lineRes, pieRes, barRes] = await Promise.all([
          getAuditChartLine(selectedAuditId),
          getAuditChartPie(selectedAuditId),
          getAuditChartBar(selectedAuditId),
        ]);

        const lineVals = unwrap(lineRes).map((it: any) => {
          const m = String(it.month || it.label || '');
          // Try to convert YYYY-MM to short month
          let monLabel = m;
          try {
            const d = new Date(m.length === 7 ? m + '-01' : m);
            monLabel = d.toLocaleString('en-US', { month: 'short' });
          } catch {}
          return { month: monLabel, count: Number(it.count || 0) };
        });
        setLineData(lineVals);

        const pieVals = unwrap(pieRes).map((it: any) => ({
          name: it.severity || it.label || 'N/A',
          value: Number(it.count || 0),
          color: severityColor(String(it.severity || it.label || '')),
        }));
        setPieData(pieVals);

        const barVals = unwrap(barRes).map((it: any) => ({
          department: it.department || it.label || '—',
          count: Number(it.count || 0),
        }));
        setBarData(barVals);
      } catch (err) {
        console.error('Failed to load charts', err);
        setLineData([]); setPieData([]); setBarData([]);
      } finally {
        setLoadingCharts(false);
      }
    };
    loadCharts();
  }, [selectedAuditId]);

  // Load summary when audit changes (does not alter charts)
  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedAuditId) return;
      try {
        const sum = await getAuditSummary(selectedAuditId);
        setSummary(sum);
      } catch (err) {
        console.error('Failed to load summary', err);
        setSummary(null);
      }
    };
    loadSummary();
  }, [selectedAuditId]);

  const handleExportPdf = async () => {
    if (!selectedAuditId) return;
    try {
      const blob = await exportAuditPdf(selectedAuditId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = summary?.title || 'audit-report';
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export PDF failed', err);
      alert('Xuất PDF thất bại. Vui lòng thử lại.');
    }
  };

  const reports = [
    { id: 'RPT-2025-001', auditId: 'AUD-2025-001', title: 'Annual Safety Audit - Final Report', type: 'Final Report', status: 'Pending Review', createdDate: '2025-10-22', findings: 5, capas: 3 },
    { id: 'RPT-2025-002', auditId: 'AUD-2025-002', title: 'Maintenance Quality Check - Draft', type: 'Draft Report', status: 'In Progress', createdDate: '2025-10-20', findings: 8, capas: 5 },
    { id: 'RPT-2025-003', auditId: 'AUD-2025-003', title: 'Training Compliance Review - Final Report', type: 'Final Report', status: 'Approved', createdDate: '2025-10-15', findings: 3, capas: 2 },
  ];

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Draft Report': 'bg-gray-100 text-gray-700 border-gray-200',
      'Final Report': 'bg-primary-100 text-primary-700 border-primary-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Report Management</h1>
            <p className="text-gray-600 text-sm mt-1">Create and manage audit reports</p>
          </div>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">+ Generate New Report</button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Reports" value={reports.length} icon={<svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} variant="primary" />
          <StatCard title="Pending Review" value={reports.filter(r => r.status === 'Pending Review').length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} variant="primary-light" />
          <StatCard title="In Progress" value={reports.filter(r => r.status === 'In Progress').length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} variant="primary-light" />
          <StatCard title="Approved" value={reports.filter(r => r.status === 'Approved').length} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} variant="primary-dark" />
        </div>

        {/* Audit selector */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Audit:</label>
            <select
              value={selectedAuditId}
              onChange={(e) => setSelectedAuditId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {audits.map((a: any) => (
                <option key={String(a.auditId || a.id || a.$id)} value={String(a.auditId || a.id || a.$id)}>
                  {a.title || a.name || String(a.auditId || a.id)}
                </option>
              ))}
            </select>
            {loadingCharts && <span className="text-xs text-gray-500">Đang tải biểu đồ...</span>}
            <button
              onClick={handleExportPdf}
              className="ml-auto bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-md text-sm"
              disabled={!selectedAuditId}
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LineChartCard
            title="Findings theo tháng"
            data={lineData}
            xAxisKey="month"
            lines={[{ dataKey: 'count', stroke: '#0369a1', name: 'Findings' }]}
          />
          <PieChartCard title="Mức độ Findings (theo tháng)" data={pieData} />
        </div>

        <BarChartCard
          title="Số Findings theo phòng ban (theo tháng)"
          data={barData}
          xAxisKey="department"
          bars={[{ dataKey: 'count', fill: '#0369a1', name: 'Findings' }]}
        />

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Reports</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Report ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Findings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CAPAs</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{report.id}</span></td>
                    <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{report.title}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{report.auditId}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(report.type)}`}>{report.type}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>{report.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-semibold">{report.findings}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{report.capas}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{report.createdDate}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={handleExportPdf} className="text-primary-600 hover:text-primary-700 text-sm font-medium">Export PDF</button>
                        {report.status === 'In Progress' && (<>
                          <span className="text-gray-300">|</span>
                          <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary section - clearer, card-based UI */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-600">Summary Findings</h2>
            <span className="text-xs text-gray-500">Tổng quan theo audit đã chọn</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: audit info + key metrics */}
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="mb-4">
                <div className="text-sm text-gray-500">Audit</div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-gray-900">{summary?.title || '—'}</div>
                  {summary?.status && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100">
                      {summary.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {summary?.startDate ? new Date(summary.startDate).toLocaleDateString() : '—'}
                  <span className="mx-1">→</span>
                  {summary?.endDate ? new Date(summary.endDate).toLocaleDateString() : '—'}
                </div>
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
            </div>

            {/* Right: severity breakdown as progress */}
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Severity Breakdown</div>
              <div className="space-y-2">
                {severityEntries.map(([name, val]) => {
                  const count = Number(val as any) || 0;
                  const pct = severityTotal ? Math.round((count * 100) / severityTotal) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-700">{name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: severityColor(String(name)) }}
                        />
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

          {/* Tables: Department and Root Cause */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">BY DEPARTMENT</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-700">Department</th>
                      <th className="text-right px-3 py-2 text-gray-700">Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptRows.map((it: any, idx: number) => (
                      <tr key={`${it.deptName || it.department || idx}`}>
                        <td className="px-3 py-2">{it.deptName || it.department || '—'}</td>
                        <td className="px-3 py-2 text-right">{Number(it.count || 0)}</td>
                      </tr>
                    ))}
                    {deptRows.length === 0 && (
                      <tr><td className="px-3 py-2 text-gray-500" colSpan={2}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">By ROOT CAUSE</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-700">Root Cause</th>
                      <th className="text-right px-3 py-2 text-gray-700">Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rootCauseRows.map((it: any, idx: number) => (
                      <tr key={`${it.rootCause || idx}`}>
                        <td className="px-3 py-2">{it.rootCause || '—'}</td>
                        <td className="px-3 py-2 text-right">{Number(it.count || 0)}</td>
                      </tr>
                    ))}
                    {rootCauseRows.length === 0 && (
                      <tr><td className="px-3 py-2 text-gray-500" colSpan={2}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Findings details */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-600">Findings Details</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề, mô tả, severity, status..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-700">Title</th>
                  <th className="text-left px-3 py-2 text-gray-700">Severity</th>
                  <th className="text-left px-3 py-2 text-gray-700">Department</th>
                  <th className="text-left px-3 py-2 text-gray-700">Status</th>
                  <th className="text-left px-3 py-2 text-gray-700">Deadline</th>
                  <th className="text-left px-3 py-2 text-gray-700">Created By</th>
                  <th className="text-left px-3 py-2 text-gray-700">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFindings.map((f: any, idx: number) => (
                  <tr key={f.findingId || idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{f.title || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ borderColor: '#e5e7eb', color: severityColor(String(f.severity)) }}
                      >
                        {f.severity || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{f.deptName || f.department || f.deptId || '—'}</td>
                    <td className="px-3 py-2">{f.status || '—'}</td>
                    <td className="px-3 py-2">{f.deadline ? new Date(f.deadline).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2">{f.createdByUser?.fullName || '—'}</td>
                    <td className="px-3 py-2">{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {filteredFindings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Không có dữ liệu</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <h2 className="text-lg font-semibold text-primary-600 mb-4">Report Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-blue-100 p-2 rounded-lg"><span className="text-xl">📄</span></div><h3 className="font-semibold text-gray-800">Initial Audit Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Standard template for first-time audits with comprehensive sections.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-green-100 p-2 rounded-lg"><span className="text-xl">🔄</span></div><h3 className="font-semibold text-gray-800">Follow-up Audit Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Template for follow-up audits tracking CAPA implementation.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-purple-100 p-2 rounded-lg"><span className="text-xl">⚡</span></div><h3 className="font-semibold text-gray-800">Quick Summary Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Simplified template for executive summaries and brief audits.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SQAStaffReports;
