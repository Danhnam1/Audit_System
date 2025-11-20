import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditSummary, approveAuditReport, rejectAuditReport } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';
import AuditReportsTable from './components/AuditReportsTable.tsx';
import DepartmentsSection from './components/DepartmentsSection.tsx';
import SummaryTab from './components/SummaryTab.tsx';

const LeadAuditorReports = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<any[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [summary, setSummary] = useState<any | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<'departments' | 'summary'>('departments');
  const [selectedDeptKey, setSelectedDeptKey] = useState<string>('');
  const lastAuditIdRef = useRef<string>('');
  const [expandedFindingId, setExpandedFindingId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'completed'>('all');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [findingsSearch, setFindingsSearch] = useState<string>('');
  const [findingsSeverity, setFindingsSeverity] = useState<string>('all');

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
        setActiveTab('departments');
        // Only reset department selection if we changed to a different audit
        if (lastAuditIdRef.current !== selectedAuditId) {
          setSelectedDeptKey('');
          setExpandedFindingId('');
          lastAuditIdRef.current = selectedAuditId;
        }
      } catch (err) {
        console.error('Failed to load summary', err);
        setSummary(null);
      }
    };
    loadSummary();
  }, [selectedAuditId]);
  // Rows for audits table
  const rows = useMemo(() => {
    return (Array.isArray(audits) ? audits : []).map((a: any, idx: number) => {
      const auditId = String(a.auditId || a.id || a.$id || `audit_${idx}`);
      const title = a.title || a.name || `Audit ${idx + 1}`;
      const rawStatus = a.status || a.state || a.approvalStatus || '—';
      const norm = String(rawStatus).toLowerCase().replace(/\s+/g, '');
      const status = norm.includes('approve') || norm.includes('complete') ? 'Completed' : (norm.includes('submit') ? 'Submitted' : rawStatus);
      const createdRaw = a.createdAt || a.startDate || a.createdDate || a.start;
      const createdDate = createdRaw ? new Date(createdRaw).toISOString().slice(0, 10) : '';
      return { auditId, title, status, createdDate };
    });
  }, [audits]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') {
      list = list.filter(r => {
        const s = String(r.status || '').toLowerCase().replace(/\s+/g, '');
        if (statusFilter === 'submitted') return s.includes('submit');
        if (statusFilter === 'completed') return s.includes('complete');
        return true;
      });
    }
    if (reportSearch.trim()) {
      const q = reportSearch.trim().toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [rows, statusFilter, reportSearch]);

  const needsDecision = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (!s) return false;
    if (s.includes('approve') || s.includes('reject') || s.includes('completed') || s.includes('complete') || s.includes('return')) return false; // already decided
    return s.includes('submit') || s.includes('pending') || s.includes('underreview') || s.includes('under review');
  };

  const handleApprove = async (auditId: string) => {
    setActionLoading(auditId);
    setActionMsg(null);
    try {
      await approveAuditReport(auditId);
      setAudits(prev => prev.map(a => String(a.auditId || a.id || a.$id) === auditId ? { ...a, status: 'Completed' } : a));
      const title = rows.find(r => r.auditId === auditId)?.title || 'Audit';
      setActionMsg(`${title} status changed to Completed.`);
    } catch (err) {
      console.error('Approve failed', err);
      setActionMsg('Approve thất bại. Vui lòng thử lại.');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (auditId: string) => {
    const reason = (window.prompt('Nhập lý do từ chối (note cho Auditor):', '') || '').trim();
    if (!reason) {
      alert('Vui lòng nhập lý do từ chối.');
      return;
    }
    setActionLoading(auditId);
    setActionMsg(null);
    try {
      await rejectAuditReport(auditId, { reason });
      setAudits(prev => prev.map(a => String(a.auditId || a.id || a.$id) === auditId ? { ...a, status: 'Returned' } : a));
      const title = rows.find(r => r.auditId === auditId)?.title || 'Audit';
      setActionMsg(`${title} đã bị returned. Lý do: ${reason}`);
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

  // Helpers to normalize $values wrappers
  const unwrapValues = (v: any): any[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v.$values && Array.isArray(v.$values)) return v.$values;
    return [];
  };

  const makeDeptKey = (nameOrId: any, fallback?: any): string => {
    const raw = nameOrId != null ? nameOrId : fallback != null ? fallback : '';
    return String(raw)
      .trim()
      .toLowerCase()
      .replace(/[–—]/g, ' ') // normalize en/em dashes
      .replace(/[^a-z0-9\s_-]+/g, '')
      .replace(/[\s_]+/g, '-');
  };

  const makeDeptKeyVariants = (deptId: any, section: any, deptName?: any): string[] => {
    const variants: string[] = [];
    const push = (v: any) => {
      if (v == null) return;
      const k = makeDeptKey(v);
      if (k && !variants.includes(k)) variants.push(k);
    };
    push(deptId);
    push(section);
    push(deptName);
    if (typeof section === 'string') push(section.replace(/[–—-]/g, ' '));
    if (typeof deptName === 'string') push(deptName.replace(/[–—-]/g, ' '));
    return variants;
  };

  // Flatten all findings (support multiple summary shapes)
  const allFindings = useMemo(() => {
    if (!summary) return [] as any[];
    const items: any[] = [];
    // findingsByMonth -> months[].findings[]
    const months = unwrapValues(summary.findingsByMonth);
    months.forEach((m: any) => unwrapValues(m?.findings).forEach((f: any) => items.push(f)));
    // direct summary.findings[]
    unwrapValues(summary.findings).forEach((f: any) => items.push(f));
    // byDepartment[].findings[]
    unwrapValues(summary.byDepartment).forEach((d: any) => {
      unwrapValues(d?.findings).forEach((f: any) => items.push(f));
    });
    return items;
  }, [summary]);

  // Department entries
  const departmentEntries = useMemo(() => {
    const list: Array<{ key: string; name: string; count: number; deptId?: any }> = [];
    const byDept = unwrapValues(summary?.byDepartment);
    if (byDept.length) {
      // Build count map from actual findings (deptId -> count) to attempt mapping when deptId missing in summary.byDepartment
      const countByDeptId = new Map<number, number>();
      allFindings.forEach((f: any) => {
        if (typeof f?.deptId === 'number') {
          countByDeptId.set(f.deptId, (countByDeptId.get(f.deptId) || 0) + 1);
        }
      });
      const assignedIds = new Set<number>();
      byDept.forEach((d: any) => {
        const name = d?.deptName || d?.name || 'Unknown';
        const count = Number(d?.count || 0);
        let deptId = d?.deptId;
        if (deptId == null) {
          // Try infer deptId by unique count match
            for (const [id, c] of countByDeptId.entries()) {
              if (c === count && !assignedIds.has(id)) {
                deptId = id;
                assignedIds.add(id);
                break;
              }
            }
        }
        const key = makeDeptKey(name, name); // keep key based on readable name for UI stability
        list.push({ key, name: String(name), count, deptId });
      });
      return list;
    }
    const map = new Map<string, { name: string; count: number; deptId?: any }>();
    allFindings.forEach((f: any) => {
      const sectionName = f?.auditItem?.section;
      const generatedName = sectionName || (f?.deptId != null ? `Dept ${f.deptId}` : 'Unknown');
      const key = makeDeptKey(f?.deptId ?? sectionName, generatedName);
      const cur = map.get(key) || { name: generatedName, count: 0, deptId: f?.deptId };
      cur.count += 1;
      map.set(key, cur);
    });
    map.forEach((v, k) => list.push({ key: k, name: v.name, count: v.count, deptId: v.deptId }));
    return list;
  }, [summary, allFindings]);

  const findingsForSelectedDept = useMemo(() => {
    if (!selectedDeptKey) return [] as any[];
    const deptEntry = departmentEntries.find(d => d.key === selectedDeptKey);
    const matched = allFindings.filter((f: any) => {
      const variants = makeDeptKeyVariants(
        f?.deptId,
        f?.auditItem?.section,
        f?.deptName || f?.departmentName || f?.department?.name
      );
      // Match by variants OR direct deptId equality inferred from summary.byDepartment
      return variants.includes(selectedDeptKey) || (deptEntry?.deptId != null && f?.deptId === deptEntry.deptId);
    });
    return matched;
  }, [allFindings, selectedDeptKey, departmentEntries]);

  // Auto-select first department only once per audit (when none selected yet)
  useEffect(() => {
    if (!showSummary) return;
    if (activeTab !== 'departments') return;
    if (selectedDeptKey) return; // user already chose
    if (departmentEntries.length > 0) {
      setSelectedDeptKey(departmentEntries[0].key);
    }
  }, [showSummary, activeTab, departmentEntries, selectedDeptKey]);

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
        <AuditReportsTable
          rows={filteredRows}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          needsDecision={needsDecision}
          onView={(id: string) => { setSelectedAuditId(id); setShowSummary(true); }}
          onApprove={handleApprove}
          onReject={handleReject}
          actionLoading={actionLoading}
          actionMsg={actionMsg}
          getStatusColor={getStatusColor}
          reportSearch={reportSearch}
          setReportSearch={setReportSearch}
        />
        {showSummary && (
          <div ref={summaryRef} className="bg-white rounded-xl border border-primary-100 shadow-md p-6 scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'departments' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >Departments</button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'summary' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >Summary</button>
            </div>
            {activeTab === 'departments' ? (
              <DepartmentsSection
                departmentEntries={departmentEntries}
                selectedDeptKey={selectedDeptKey}
                setSelectedDeptKey={setSelectedDeptKey}
                findings={findingsForSelectedDept}
                expandedFindingId={expandedFindingId}
                setExpandedFindingId={setExpandedFindingId}
                unwrapValues={unwrapValues}
                findingsSearch={findingsSearch}
                setFindingsSearch={setFindingsSearch}
                findingsSeverity={findingsSeverity}
                setFindingsSeverity={setFindingsSeverity}
              />
            ) : (
              <SummaryTab
                summary={summary}
                severityEntries={severityEntries}
                severityTotal={severityTotal}
              />
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default LeadAuditorReports;
