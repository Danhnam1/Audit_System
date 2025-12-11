import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditSummary, approveAuditReport, rejectAuditReport } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';
import AuditReportsTable from './components/AuditReportsTable';
import DepartmentsSection from './components/DepartmentsSection';
import { getAuditTeam } from '../../../api/auditTeam';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import SummaryTab from './components/SummaryTab';

const AuditorLeadReports = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;
  const normalizedRole =
    String((user as any)?.group_code || (user as any)?.role || '')
      .toLowerCase()
      .replace(/\s+/g, '');
  const isLeadAuditorRole = normalizedRole === 'leadauditor';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'closed'>('all');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [findingsSearch, setFindingsSearch] = useState<string>('');
  const [findingsSeverity, setFindingsSeverity] = useState<string>('all');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveAuditId, setApproveAuditId] = useState<string | null>(null);
  const [rejectAuditId, setRejectAuditId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);

  const isRelevantToLead = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (!s) return false;
    return (
      s.includes('submit') ||
      s.includes('submitted') ||
      s.includes('approve') ||
      s.includes('completed') ||
      s.includes('complete') ||
      s.includes('closed')
    );
  };

  const reload = useCallback(async () => {
    try {
      const [res, teamsRes, usersRes] = await Promise.all([
        getAuditPlans(),
        getAuditTeam(),
        getAdminUsers()
      ]);
      
      const users = Array.isArray(usersRes) ? usersRes : [];
      setAdminUsers(users);
      let currentUserId: string | null = null;
      if (user?.email) {
        const found = users.find((u: any) => {
          const uEmail = String(u?.email || '').toLowerCase().trim();
          const userEmail = String(user.email).toLowerCase().trim();
          return uEmail === userEmail;
        });
        if (found?.userId) {
          currentUserId = String(found.userId);
        } else if (found?.$id) {
          currentUserId = String(found.$id);
        }
      }
      if (!currentUserId && (user as any)?.userId) {
        currentUserId = String((user as any).userId);
      }
      const normalizedCurrentUserId = currentUserId ? String(currentUserId).toLowerCase().trim() : null;
      
      const addAuditId = (set: Set<string>, value: any) => {
        if (value == null) return;
        const str = String(value).trim();
        if (!str) return;
        set.add(str);
        set.add(str.toLowerCase());
      };
      
      const teams = Array.isArray(teamsRes) ? teamsRes : [];
      const leadAuditIds = new Set<string>();
      if (normalizedCurrentUserId) {
        teams.forEach((m: any) => {
          const memberUserId = m?.userId ?? m?.id ?? m?.$id;
          const normalizedMemberId = memberUserId != null ? String(memberUserId).toLowerCase().trim() : null;
          // Trước đây chỉ check m?.isLead; giờ Lead Auditor là role hệ thống,
          // nếu user có role Lead Auditor thì chỉ cần thuộc team là được phép xem.
          const isLeadForThisAudit = isLeadAuditorRole
            ? normalizedMemberId === normalizedCurrentUserId
            : (m?.isLead && normalizedMemberId === normalizedCurrentUserId);
          if (isLeadForThisAudit) {
            addAuditId(leadAuditIds, m?.auditId);
            addAuditId(leadAuditIds, m?.auditPlanId);
            addAuditId(leadAuditIds, m?.planId);
          }
        });
      }
      
      const list = unwrap(res);
      const all = (Array.isArray(list) ? list : []).map((p: any) => ({ ...p }));
      
      const auditMatchesLead = (audit: any) => {
        const candidates = [
          audit.auditId,
          audit.id,
          audit.$id,
          audit.planId,
          audit.auditPlanId,
        ]
          .filter((v: any) => v != null)
          .map((v: any) => String(v).trim())
          .filter(Boolean);
        if (!candidates.length) return false;
        return candidates.some((id: string) => leadAuditIds.has(id) || leadAuditIds.has(id.toLowerCase()));
      };
      
      // Nếu user là Lead Auditor (role hệ thống), cho phép xem mọi audit có trạng thái
      // liên quan (Submitted/Closed/Approved...), không bắt buộc cờ isLead.
      const filtered = all.filter((p: any) => {
        const isRelevant = isRelevantToLead(p.status || p.state || p.approvalStatus);
        if (!isRelevant) return false;
        if (isLeadAuditorRole) return true;
        const isLeadAudit = auditMatchesLead(p);
        return isLeadAudit;
      });
      
      const sorted = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      });
      
      setAudits(sorted);
    } catch (err) {
      console.error('Failed to load audits for Lead Reports', err);
      setAudits([]);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedAuditId) return;
      try {
        const sum = await getAuditSummary(selectedAuditId);
        setSummary(sum);
        setActiveTab('departments');
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

  const rows = useMemo(() => {
    const getCreatedByLabel = (a: any): string => {
      const src =
        a?.createdByUser ||
        a?.submittedByUser ||
        a?.createdBy ||
        a?.submittedBy;
      if (!src) return '—';

      const normalize = (v: any) => String(v || '').toLowerCase().trim();

      if (typeof src === 'string') {
        const sNorm = normalize(src);
        const found = (adminUsers || []).find(u => {
          const id = u.userId || (u as any).$id;
          const email = u.email;
          return (id && normalize(id) === sNorm) || (email && normalize(email) === sNorm);
        });
        if (found?.fullName) return found.fullName;
        if (found?.email) return found.email;
        return src;
      }

      if (src.fullName) return src.fullName;
      if (src.email) return src.email;

      const id = src.userId || src.id || src.$id;
      if (id) {
        const idNorm = normalize(id);
        const foundById = (adminUsers || []).find(u => {
          const uid = u.userId || (u as any).$id;
          return uid && normalize(uid) === idNorm;
        });
        if (foundById?.fullName) return foundById.fullName;
        if (foundById?.email) return foundById.email;
        return String(id);
      }

      return '—';
    };

    return (Array.isArray(audits) ? audits : []).map((a: any, idx: number) => {
      const auditId = String(a.auditId || a.id || a.$id || `audit_${idx}`);
      const title = a.title || a.name || `Audit ${idx + 1}`;
      const rawStatus = a.status || a.state || a.approvalStatus || '—';
      const norm = String(rawStatus).toLowerCase().replace(/\s+/g, '');
      let status: string;
      if (norm.includes('return') || norm.includes('reject')) {
        status = 'Returned';
      } else if (norm.includes('closed')) {
        status = 'Closed';
      } else if (norm.includes('submit') || norm.includes('submitted') || norm.includes('underreview')) {
        status = 'Submitted';
      } else if (norm.includes('open') || norm === 'inprogress' || norm.includes('draft')) {
        status = 'Open';
      } else {
        status = rawStatus;
      }
      const createdBy = getCreatedByLabel(a);
      return { auditId, title, status, createdBy };
    });
  }, [audits, adminUsers]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') {
      list = list.filter(r => {
        const s = String(r.status || '').toLowerCase().replace(/\s+/g, '');
        if (statusFilter === 'submitted') return s.includes('submit');
        if (statusFilter === 'closed') return s.includes('closed') || s.includes('complete');
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
    if (s.includes('approve') || s.includes('reject') || s.includes('return')) return false;
    return s.includes('submit') || s.includes('pending') || s.includes('underreview') || s.includes('under review');
  };

  const openApproveModal = (auditId: string) => {
    setApproveAuditId(auditId);
    setShowApproveModal(true);
  };

  const openRejectModal = (auditId: string) => {
    setRejectAuditId(auditId);
    setRejectNote('');
    setShowRejectModal(true);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setApproveAuditId(null);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectAuditId(null);
    setRejectNote('');
  };

  const handleApprove = async () => {
    if (!approveAuditId) return;
    setActionLoading(approveAuditId);
    setActionMsg(null);
    try {
      await approveAuditReport(approveAuditId);
      setAudits(prev =>
        prev.map(a =>
          String(a.auditId || a.id || a.$id) === approveAuditId ? { ...a, status: 'Closed' } : a,
        ),
      );
      toast.success('Closed the Audit Report successfully.');
      closeApproveModal();
      // After approve, hide details until user explicitly clicks View again
      setShowSummary(false);
      setSelectedAuditId('');
      await reload();
    } catch (err: any) {
      console.error('Approve failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Approve failed: ' + errorMessage);
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!rejectAuditId) return;
    if (!rejectNote.trim()) {
      toast.error('Please enter a reason for rejection.');
      return;
    }
    setActionLoading(rejectAuditId);
    setActionMsg(null);
    try {
      await rejectAuditReport(rejectAuditId, { note: rejectNote.trim() });
      setAudits(prev => prev.map(a => String(a.auditId || a.id || a.$id) === rejectAuditId ? { ...a, status: 'Returned' } : a));
      toast.success('Rejected the Audit Report successfully.');
      closeRejectModal();
      await reload();
    } catch (err: any) {
      console.error('Reject failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
    } finally {
      setActionLoading('');
    }
  };

  const severityEntries = useMemo(() => {
    const obj = summary?.severityBreakdown || {};
    return Object.entries(obj).filter(([k]) => k && !String(k).startsWith('$'));
  }, [summary]);
  const severityTotal = useMemo(() => severityEntries.reduce((acc, [, v]) => acc + (Number(v as any) || 0), 0), [severityEntries]);

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
      .replace(/[–—]/g, ' ')
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

  const allFindings = useMemo(() => {
    if (!summary) return [] as any[];
    const items: any[] = [];

    // New backend shape: findingsInAudit.$values[].findings.$values[]
    const byAudit = unwrapValues((summary as any).findingsInAudit);
    byAudit.forEach((m: any) =>
      unwrapValues(m?.findings).forEach((f: any) => items.push(f)),
    );

    // Legacy: findingsByMonth -> months[].findings[]
    const months = unwrapValues((summary as any).findingsByMonth);
    months.forEach((m: any) =>
      unwrapValues(m?.findings).forEach((f: any) => items.push(f)),
    );

    // direct summary.findings[]
    unwrapValues((summary as any).findings).forEach((f: any) => items.push(f));

    // byDepartment[].findings[]
    unwrapValues((summary as any).byDepartment).forEach((d: any) => {
      unwrapValues(d?.findings).forEach((f: any) => items.push(f));
    });

    return items;
  }, [summary]);

  const departmentEntries = useMemo(() => {
    const list: Array<{ key: string; name: string; count: number; deptId?: any }> = [];
    const byDept = unwrapValues(summary?.byDepartment);
    if (byDept.length) {
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
            for (const [id, c] of countByDeptId.entries()) {
              if (c === count && !assignedIds.has(id)) {
                deptId = id;
                assignedIds.add(id);
                break;
              }
            }
        }
        const key = makeDeptKey(name, name);
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
      return variants.includes(selectedDeptKey) || (deptEntry?.deptId != null && f?.deptId === deptEntry.deptId);
    });
    return matched;
  }, [allFindings, selectedDeptKey, departmentEntries]);

  useEffect(() => {
    if (!showSummary) return;
    if (activeTab !== 'departments') return;
    if (selectedDeptKey) return;
    if (departmentEntries.length > 0) {
      setSelectedDeptKey(departmentEntries[0].key);
    }
  }, [showSummary, activeTab, departmentEntries, selectedDeptKey]);

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-6 animate-slideInLeft">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-black">Lead Reports</h1>
          <p className="text-[#5b6166] text-sm mt-1">View and approve audit reports (as Lead Auditor)</p>
        </div>
      </div>
      <div className="px-6 pb-6 space-y-6">
        <AuditReportsTable
          rows={filteredRows}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          needsDecision={needsDecision}
          onView={(id: string) => {
            // Toggle mở/đóng details khi bấm View
            if (showSummary && selectedAuditId === id) {
              setShowSummary(false);
              setSelectedAuditId('');
            } else {
              setSelectedAuditId(id);
              setShowSummary(true);
            }
          }}
          onApprove={openApproveModal}
          onReject={openRejectModal}
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

        {/* Approve Confirmation Modal */}
        {showApproveModal && approveAuditId && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={closeApproveModal}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Approve Audit Report
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to approve this audit report?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={closeApproveModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading === approveAuditId}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${actionLoading === approveAuditId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Approved') + ' hover:opacity-90'}`}
                  >
                    {actionLoading === approveAuditId ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Reject Confirmation Modal */}
        {showRejectModal && rejectAuditId && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={closeRejectModal}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Reject Audit Report
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please provide a reason for rejecting this audit report:
                </p>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Enter rejection reason (note)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                />
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={closeRejectModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading === rejectAuditId}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${actionLoading === rejectAuditId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Rejected') + ' hover:opacity-90'}`}
                  >
                    {actionLoading === rejectAuditId ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </MainLayout>
  );
};

export default AuditorLeadReports;

