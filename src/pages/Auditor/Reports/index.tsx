import { MainLayout } from '../../../layouts';
import { HiOutlineDownload, HiOutlineUpload } from 'react-icons/hi';
import { useAuth } from '../../../contexts';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getStatusColor } from '../../../constants';
import { StatCard, LineChartCard, BarChartCard, PieChartCard } from '../../../components';
import { getAuditPlans, getAuditChartLine, getAuditChartPie, getAuditChartBar, getAuditSummary, exportAuditPdf, submitAudit, getAuditReportNote } from '../../../api/audits';
import { getDepartments } from '../../../api/departments';
import { getDepartmentName as resolveDeptName } from '../../../helpers/auditPlanHelpers';
import { uploadMultipleAuditDocuments, getAuditDocuments } from '../../../api/auditDocuments';
import { getAuditTeam } from '../../../api/auditTeam';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import { unwrap } from '../../../utils/normalize';
import FilterBar, { type ActiveFilters } from '../../../components/filters/FilterBar';
import { toast } from 'react-toastify';

const SQAStaffReports = () => {
  const { user } = useAuth();

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Audit list and selected audit
  const [audits, setAudits] = useState<any[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [uploadLoading, setUploadLoading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [uploadedAudits, setUploadedAudits] = useState<Set<string>>(new Set());
  const [leadAuditIds, setLeadAuditIds] = useState<Set<string>>(new Set());
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);

  // Chart datasets
  const [lineData, setLineData] = useState<Array<{ month: string; count: number }>>([]);
  const [pieData, setPieData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [barData, setBarData] = useState<Array<{ department: string; count: number }>>([]);
  const [findingsMap, setFindingsMap] = useState<Record<string, number>>({});
  // Dynamic filter states (single filter active for reports)
  const [reportFilters, setReportFilters] = useState<ActiveFilters>({});
  const [findingFilters, setFindingFilters] = useState<ActiveFilters>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  // Derived datasets for summary rendering
  const severityEntries = useMemo(() => {
    const obj = summary?.severityBreakdown || {};
    return Object.entries(obj).filter(([k]) => k && !String(k).startsWith('$'));
  }, [summary]);
  const severityTotal = useMemo(
    () => severityEntries.reduce((acc, [, v]) => acc + (Number(v as any) || 0), 0),
    [severityEntries]
  );
  const deptRows = useMemo(() => unwrap(summary?.byDepartment), [summary]);
  const [search, setSearch] = useState('');
  const monthsFindings = useMemo(() => {
    // Backend mới dùng findingsInAudit.$values, vẫn giữ compat với findingsByMonth nếu có
    const src: any =
      (summary as any)?.findingsByMonth != null
        ? (summary as any).findingsByMonth
        : (summary as any)?.findingsInAudit;

    const raw = unwrap(src);
    return raw.map((m: any, idx: number) => {
      const mNum = Number(m?.month ?? m?.monthNumber ?? 0);
      const label =
        isNaN(mNum) || mNum < 1 || mNum > 12
          ? String(m?.month || m?.label || `Month ${idx + 1}`)
          : new Date(2000, mNum - 1, 1).toLocaleString('vi-VN', { month: 'long' });
      return {
        key: `${mNum || idx}`,
        monthNum: mNum,
        label,
        total: Number(m?.total ?? 0),
        open: Number(m?.open ?? 0),
        closed: Number(m?.closed ?? 0),
        overdue: Number(m?.overdue ?? 0),
        items: unwrap(m?.findings),
      };
    });
  }, [summary]);

  // Chuẩn hóa id (tránh lệch hoa/thường, khoảng trắng)
  const normalizeId = (id: string | number | null | undefined) =>
    String(id ?? '')
      .toLowerCase()
      .trim();

  // (Removed meta caches not needed for new simplified report filters)

  const filteredMonths = useMemo(() => {
    const q = search.trim().toLowerCase();
    const keys = Object.keys(findingFilters);
    const activeKey = keys[0]; // singleMode ensures at most one
    return monthsFindings.map(m => ({
      ...m,
      items: m.items.filter((f: any) => {
        if (q) {
          const hay = [f?.title, f?.description, f?.severity, f?.status, f?.createdByUser?.fullName, String(f?.deptId)].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (!activeKey) return true;
        switch (activeKey) {
          case 'dept': {
            const deptVal = findingFilters.dept as string | undefined;
            if (!deptVal) return true;
            const resolved = f?.deptId != null ? resolveDeptName(String(f.deptId), departments) : '';
            return deptVal === resolved || deptVal === String(f.deptId);
          }
          case 'status': {
            const statusVal = findingFilters.status as string | undefined;
            if (!statusVal) return true;
            const st = String(f?.status || '').toLowerCase().replace(/\s+/g, '');
            return st.includes(statusVal.toLowerCase().replace(/\s+/g, ''));
          }
          case 'severity': {
            const severityVal = findingFilters.severity as string | undefined;
            if (!severityVal) return true;
            const sev = String(f?.severity || '').toLowerCase();
            return sev === severityVal.toLowerCase();
          }
          case 'deadline': {
            const dl = findingFilters.deadline as { from?: string; to?: string } | undefined;
            if (!dl || (!dl.from && !dl.to)) return true;
            if (!f?.deadline) return false;
            const dStr = new Date(f.deadline).toISOString().slice(0, 10);
            if (dl.from && dStr < dl.from) return false;
            if (dl.to && dStr > dl.to) return false;
            return true;
          }
          default:
            return true;
        }
      })
    })).filter(m => m.items.length > 0);
  }, [monthsFindings, search, findingFilters, departments]);

  // Severity colors
  const severityColor = (sev: string) => {
    const k = String(sev || '').toLowerCase();
    if (k.includes('critical') || k.includes('high')) return '#ef4444';
    if (k.includes('major') || k.includes('medium')) return '#f59e0b';
    return '#3b82f6'; // minor/low default
  };

  // Load audits list (only Open) and departments
  const reloadReports = useCallback(async () => {
    try {
      const [res, depts, teamsRes, usersRes] = await Promise.all([
        getAuditPlans(), 
        getDepartments(),
        getAuditTeam(),
        getAdminUsers()
      ]);
      
      // Get current user's userId - try multiple methods
      const users = Array.isArray(usersRes) ? usersRes : [];
      setAdminUsers(users);
      let currentUserId: string | null = null;
      
      // Find by email (ProfileResponse doesn't have userId, need to look it up from AdminUsers)
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
      
      // Normalize currentUserId for comparison (lowercase, trim)
      const normalizedCurrentUserId = currentUserId ? String(currentUserId).toLowerCase().trim() : null;
      // normalizedCurrentEmail no longer used after removing "creator-only" restriction for export/upload
      // Get audit IDs where current user is a team member
      const teams = Array.isArray(teamsRes) ? teamsRes : [];
      const userAuditIds = new Set<string>();
      const leadAuditIdsSet = new Set<string>();
      
      if (normalizedCurrentUserId) {
        teams.forEach((m: any) => {
          // Try multiple userId fields and normalize for comparison
          const memberUserId = m?.userId || m?.id || m?.$id;
          if (memberUserId) {
            const normalizedMemberUserId = String(memberUserId).toLowerCase().trim();
            // Match if userIds match (case-insensitive)
            if (normalizedMemberUserId === normalizedCurrentUserId) {
              // Collect all possible auditId formats
              const auditId = m?.auditId || m?.auditPlanId || m?.planId || m?.id;
              if (auditId) {
                const auditIdStr = String(auditId).trim();
                if (auditIdStr) {
                  userAuditIds.add(auditIdStr);
                  // Also add lowercase version for case-insensitive matching
                  userAuditIds.add(auditIdStr.toLowerCase());
                  
                  // Check if user is Lead Auditor for this audit
                  if (m?.isLead === true) {
                    leadAuditIdsSet.add(auditIdStr);
                    leadAuditIdsSet.add(auditIdStr.toLowerCase());
                  }
                }
              }
            }
          }
        });
      }
      
      // Set lead audit IDs
      setLeadAuditIds(leadAuditIdsSet);
      
      // Debug logging (only in development mode)
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        console.log('[Reports] Filtering audits:', {
          currentUserId: normalizedCurrentUserId,
          userAuditIds: Array.from(userAuditIds),
          totalTeams: teams.length,
          totalAudits: Array.isArray(res) ? res.length : 0
        });
      }
      {/*Sửa Status để fill*/}
      const arr = unwrap(res);
      const isVisibleStatus = (s: any) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        if (!v) return false;

        const isOpenLike =
          v.includes('inprogress') || v === 'inprogress';

        const isSubmittedLike =
          v.includes('submit') || v.includes('submitted') || v.includes('underreview');

        const isCompletedLike =
          v.includes('closed') || v.includes('completed') || v.includes('complete') || v.includes('approve') || v.includes('approved');

        const isReturnedLike =
          v.includes('return') || v.includes('rejected') || v.includes('reject');

        return isOpenLike || isSubmittedLike || isCompletedLike || isReturnedLike;
      };
      
      // Filter audits: must match status AND user must be in audit team
      const filtered = (Array.isArray(arr) ? arr : []).filter((a: any) => {
        // First check status
        const statusMatch = isVisibleStatus(a.status || a.state || a.approvalStatus);
        if (!statusMatch) return false;
        
        // If user is not in any audit team, don't show any audits
        if (!normalizedCurrentUserId || userAuditIds.size === 0) {
          return false;
        }
        
        // Check if this audit is in user's audit list
        // Try all possible auditId formats
        const auditIdCandidates = [
          a.auditId,
          
        ].filter(Boolean).map(id => String(id).trim());
        
        // Check if any auditId format matches
        const isUserAudit = auditIdCandidates.some(auditId => {
          // Direct match
          if (userAuditIds.has(auditId)) return true;
          // Case-insensitive match
          if (userAuditIds.has(auditId.toLowerCase())) return true;
          // Try lowercase version
          const lowerAuditId = auditId.toLowerCase();
          return Array.from(userAuditIds).some(uid => uid.toLowerCase() === lowerAuditId);
        });
        
        return isUserAudit;
      });
      
      setAudits(filtered);
      
      // Check which audits already have uploaded documents
      const uploadedSet = new Set<string>();
      const checkUploads = async () => {
        const completedAudits = filtered.filter((a: any) => {
          const status = String(a.status || a.state || a.approvalStatus || '').toLowerCase();
          return status.includes('closed') || status.includes('completed');
        });
        
        const uploadChecks = await Promise.allSettled(
          completedAudits.map(async (a: any) => {
            const auditId = String(a.auditId || a.id || a.$id || '');
            if (!auditId) return null;
            try {
              const docs = await getAuditDocuments(auditId);
              const docsArr = unwrap(docs);
              if (Array.isArray(docsArr) && docsArr.length > 0) {
                // Nếu audit đã từng upload báo cáo, lưu vào uploadedAudits (dùng id đã normalize)
                return normalizeId(auditId);
              }
            } catch (err) {
              console.error(`Failed to check documents for audit ${auditId}`, err);
            }
            return null;
          })
        );
        
        uploadChecks.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            uploadedSet.add(result.value);
          }
        });
        
        setUploadedAudits(uploadedSet);
      };
      
      checkUploads().catch(err => console.error('Failed to check uploaded documents', err));
      
      // normalize departments list from API
      const deptList = Array.isArray(depts)
        ? depts.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
        : [];
      setDepartments(deptList);
      
      const firstId = filtered?.[0]?.auditId || filtered?.[0]?.id || filtered?.[0]?.$id || '';
      if (firstId) setSelectedAuditId(String(firstId));
      else {
        setSelectedAuditId('');
        setShowSummary(false);
      }
    } catch (err) {
      console.error('Failed to load audits for Reports', err);
      setAudits([]);
    }
  }, [user]);

  useEffect(() => {
    reloadReports();
  }, [reloadReports]);

  // Fetch reject notes for any audits already marked Returned/Rejected
  useEffect(() => {
    const arr = Array.isArray(audits) ? audits : [];
    const returnedIds = arr
      .filter((audit: any) => {
        const state = audit.status || audit.state || audit.approvalStatus;
        const norm = String(state || '').toLowerCase();
        return norm.includes('reject') || norm.includes('return');
      })
      .map((audit: any) => String(audit.auditId || audit.id || audit.$id || ''))
      .filter(Boolean);

    const missing = returnedIds.filter((id) => !(id in rejectNotes));
    if (!missing.length) return;

    let cancelled = false;
    const loadNotes = async () => {
      const results = await Promise.allSettled(missing.map((id) => getAuditReportNote(id)));
      if (cancelled) return;
      const patch: Record<string, string> = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          patch[missing[idx]] = res.value ?? '';
        }
      });
      if (Object.keys(patch).length) {
        setRejectNotes((prev) => ({ ...prev, ...patch }));
      }
    };

    loadNotes().catch((err) => console.error('Failed to load reject notes', err));
    return () => {
      cancelled = true;
    };
  }, [audits, rejectNotes]);

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
          } catch { }
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
        const total = Number((sum as any)?.totalFindings ?? 0);
        if (!isNaN(total)) {
          setFindingsMap((prev) => ({ ...prev, [String(selectedAuditId)]: total }));
        }
      } catch (err) {
        console.error('Failed to load summary', err);
        setSummary(null);
      }
    };
    loadSummary();
  }, [selectedAuditId]);

  // Backfill findings counts only (simplified)
  useEffect(() => {
    const fillCounts = async () => {
      const ids = (Array.isArray(audits) ? audits : [])
        .map((a: any) => String(a.auditId || a.id || a.$id || ''))
        .filter(Boolean);
      const missing = ids.filter((id) => findingsMap[id] == null);
      if (!missing.length) return;
      let cancelled = false;
      try {
        const results = await Promise.allSettled(missing.map(id => getAuditSummary(id)));
        if (cancelled) return;
        const patch: Record<string, number> = {};
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            const s: any = res.value;
            const total = Number(s?.totalFindings ?? s?.total ?? 0);
            if (!isNaN(total)) patch[missing[i]] = total;
          }
        });
        if (Object.keys(patch).length) setFindingsMap(prev => ({ ...prev, ...patch }));
      } catch { }
      return () => { cancelled = true; };
    };
    fillCounts();
  }, [audits, findingsMap]);

  // Smooth scroll to summary when shown or audit changes while visible
  useEffect(() => {
    if (showSummary) {
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showSummary, selectedAuditId]);

  const isCompletedStatus = (s: any) => {
    const v = String(s || '').toLowerCase();
    return v.includes('closed') || v.includes('completed') || v.includes('approve');
  };
  const isRejectedStatus = (s: any) => {
    const v = String(s || '').toLowerCase().trim();
    // Only consider as rejected if it's explicitly "rejected" or "returned", not "submitted"
    return (v === 'rejected' || v === 'returned' || v.includes('rejected') || v.includes('returned')) && !v.includes('submit');
  };
  const isSubmittedStatus = (s: any) => {
    const v = String(s || '').toLowerCase().replace(/\s+/g, '');
    return v.includes('submitted');
  };

  const selectedAuditRow = useMemo(() => {
    const sid = String(selectedAuditId || '');
    return (audits || []).find((a: any) => String(a.auditId || a.id || a.$id) === sid);
  }, [audits, selectedAuditId]);

  // NOTE: Previously we restricted export/upload to the creator only.
  // Now we allow any team member (already filtered in `reloadReports`) once the report is Closed/Completed.

  const handleSubmitToLead = async () => {
    if (!selectedAuditId) return;
    
    // Validate: Lead Auditor cannot submit
    const auditIdStr = String(selectedAuditId).trim();
    const isLeadAuditor = leadAuditIds.has(auditIdStr) || leadAuditIds.has(auditIdStr.toLowerCase());
    if (isLeadAuditor) {
      toast.error('Lead Auditor cannot submit reports. Only regular Auditors can submit.');
      return;
    }
    
    try {
      setSubmitLoading(true);
      await submitAudit(selectedAuditId);
      toast.success('Submit successfully.');
      setShowSubmitModal(false);
      // After submit, this list only shows Open audits so we refresh to remove the submitted one
      await reloadReports();
    } catch (err: any) {
      console.error('Submit to Lead Auditor failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to submit to Lead Auditor: ' + errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  const onClickUpload = (auditIdRaw: string) => {
    const auditId = normalizeId(auditIdRaw);
    // Check if already uploaded
    if (uploadedAudits.has(auditId)) {
      toast.error('This report has already been uploaded. It cannot be uploaded again.');
      return;
    }
    fileInputRefs.current[auditId]?.click();
  };

  const onFileSelected = async (auditIdRaw: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const auditId = normalizeId(auditIdRaw);
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !auditId) {
      e.target.value = '';
      return;
    }
    
    // Validate: Check if already uploaded
    if (uploadedAudits.has(auditId)) {
      toast.error('This report has already been uploaded. It cannot be uploaded again.');
      e.target.value = '';
      return;
    }
    
    // Double check by fetching documents (history upload)
    try {
      const existingDocs = await getAuditDocuments(auditIdRaw);
      const existingArr = unwrap(existingDocs);
      if (Array.isArray(existingArr) && existingArr.length > 0) {
        toast.error('This report has already been uploaded. It cannot be uploaded again.');
        e.target.value = '';
        setUploadedAudits(prev => new Set(prev).add(auditId));
        return;
      }
    } catch (err) {
      console.error('Failed to check existing documents', err);
      // Continue with upload if check fails
    }
    
    try {
      setUploadLoading(prev => ({ ...prev, [auditId]: true }));
      
      // Always use the multiple-upload API, even for a single file
        await uploadMultipleAuditDocuments(auditIdRaw, files);
      
      const successMessage = files.length === 1 
        ? 'Signed report uploaded successfully.' 
        : `Successfully uploaded ${files.length} file(s).`;
      
      toast.success(successMessage);
      e.target.value = '';
      
      // Mark as uploaded (UI will immediately show "Uploaded" & disable the button)
      // Không cần reloadReports ở đây để tránh phải reload lại trang mới thấy trạng thái Uploaded
      // và cũng tránh việc state uploadedAudits bị ghi đè bởi dữ liệu cũ từ API.
      setUploadedAudits(prev => new Set(prev).add(auditId));
    } catch (err) {
      console.error('Upload signed report failed', err);
      const errorMessage = 'Upload failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setUploadLoading(prev => ({ ...prev, [auditId]: false }));
    }
  };

  const handleExportPdfForRow = async (auditId: string, title: string) => {
    try {
      const blob = await exportAuditPdf(auditId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'audit-report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export PDF failed', err);
      alert('Export PDF failed. Please try again.');
    }
  };

  // Build table rows from backend audits list
  const reportRows = useMemo(() => {
    const getCreatedByLabel = (a: any): string => {
      const src =
        a?.createdByUser ||
        a?.createdBy ||
        a?.submittedBy;
      if (!src) return '—';

      const normalize = (v: any) => String(v || '').toLowerCase().trim();

      if (typeof src === 'string') {
        const sNorm = normalize(src);
        const found = adminUsers.find(u => {
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
        const foundById = adminUsers.find(u => {
          const uid = u.userId || (u as any).$id;
          return uid && normalize(uid) === idNorm;
        });
        if (foundById?.fullName) return foundById.fullName;
        if (foundById?.email) return foundById.email;
        return String(id);
      }

      return '—';
    };

    const arr = Array.isArray(audits) ? audits : [];
    return arr.map((a: any, idx: number) => {
      const id = String(a.auditId || a.id || a.$id || `audit_${idx}`);
      const title = a.title || a.name || `Audit ${idx + 1}`;
      const type = a.type || a.auditType || a.category || '—';
      const rawStatus = a.status || a.state || a.approvalStatus || '—';
      const norm = String(rawStatus).toLowerCase().replace(/\s+/g, '');
      let status: string;
      if (norm.includes('return') || norm.includes('reject')) {
        status = 'Returned';
      } else if (norm.includes('approve') || norm.includes('complete') || norm.includes('closed')) {
        status = 'Closed';
      } else if (norm.includes('submit') || norm.includes('submitted') || norm.includes('underreview')) {
        status = 'Submitted';
      } else if (norm.includes('open') || norm === 'inprogress' || norm.includes('draft')) {
        status = 'In Progress';
      } else {
        status = rawStatus;
      }
      const createdRaw = a.createdAt || a.startDate || a.createdDate || a.start;
      const createdDate = createdRaw ? new Date(createdRaw).toISOString().slice(0, 10) : '';
      const createdBy = getCreatedByLabel(a);
      const findings = (findingsMap[id] ?? a.totalFindings ?? a.findingsCount ?? a.findingCount ?? 0) as number;
      // const capas = a.capaCount ?? a.capaTotal ?? 0;
      return { id, auditId: id, title, type, status, findings, createdDate, createdBy };
    });
  }, [audits, findingsMap, adminUsers]);

  const filteredReportRows = useMemo(() => {
    let rows = reportRows;
    // Only one filter active (singleMode). Determine which key.
    const keys = Object.keys(reportFilters);
    if (!keys.length) return rows;
    const k = keys[0];
    const val = reportFilters[k];
    switch (k) {
      case 'status': {
        if (val) rows = rows.filter(r => String(r.status || '').toLowerCase().replace(/\s+/g, '').includes(String(val).toLowerCase().replace(/\s+/g, '')));
        break;
      }
      case 'type': {
        if (val) rows = rows.filter(r => r.type === val);
        break;
      }
      case 'date': {
        if (val === 'asc') rows = [...rows].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
        else if (val === 'desc') rows = [...rows].sort((a, b) => b.createdDate.localeCompare(a.createdDate));
        break;
      }
      case 'findings': {
        if (val === 'asc') rows = [...rows].sort((a, b) => (a.findings || 0) - (b.findings || 0));
        else if (val === 'desc') rows = [...rows].sort((a, b) => (b.findings || 0) - (a.findings || 0));
        break;
      }
    }
    return rows;
  }, [reportRows, reportFilters]);

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

        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Reports" value={reportRows.length} icon={<svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} variant="primary" />
          <StatCard title="Returned" value={reportRows.filter(r => String(r.status || '').toLowerCase().includes('returned')).length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} variant="primary-light" />
          <StatCard title="Submitted" value={reportRows.filter(r => String(r.status || '').toLowerCase().includes('submitted')).length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} variant="primary-light" />
          <StatCard title="Closed" value={reportRows.filter(r => { const v = String(r.status || '').toLowerCase(); return v.includes('closed'); }).length} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} variant="primary-dark" />
        </div>

        {/* Audit selector */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Audit:</label>
              {audits.length > 0 ? (
                <select
                  value={selectedAuditId}
                  onChange={(e) => setSelectedAuditId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {audits.map((a: any) => {
                    const value = String(a.auditId ?? a.id ?? a.$id ?? '');
                    return (
                      <option key={value || `audit-${a.title}`} value={value}>
                        {a.title || value || 'Audit'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-sm text-gray-500 italic">
                  No report has been assigned to you yet.
                </span>
              )}
            </div>
            {loadingCharts && <span className="text-xs text-gray-500">Loading chart...</span>}
          </div>
        </div>

        {audits.length > 0 && selectedAuditId ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChartCard
                title="Findings (Monthly)"
                data={lineData}
                xAxisKey="month"
                lines={[{ dataKey: 'count', stroke: '#0369a1', name: 'Findings' }]}
              />
              <PieChartCard title="Level of Findings (Monthly)" data={pieData} />
            </div>

            <BarChartCard
              title="Number of Findings by Department (Monthly)"
              data={barData}
              xAxisKey="department"
              bars={[{ dataKey: 'count', fill: '#0369a1', name: 'Findings' }]}
            />
          </>
        ) : audits.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-100 text-yellow-700 text-sm rounded-xl px-4 py-3">
            There is no audit report to view the chart
          </div>
        ) : null}

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Reports</h2>
          </div>
          <div className="px-6 py-3 space-y-3">
            <FilterBar
              singleMode
              definitions={[
                { id: 'type', label: 'Type', type: 'select', getOptions: () => Array.from(new Set(reportRows.map(r => r.type))).filter(t => t && t !== '—').sort().map(t => ({ value: t, label: t })) },
                { id: 'status', label: 'Status', type: 'select', getOptions: () => Array.from(new Set(reportRows.map(r => r.status))).filter(Boolean).sort().map(s => ({ value: String(s).toLowerCase(), label: String(s) })) },
                { id: 'findings', label: 'Findings', type: 'select', getOptions: () => [{ value: 'asc', label: 'Fewest → Most' }, { value: 'desc', label: 'Most → Fewest' }] },
                { id: 'date', label: 'Date', type: 'select', getOptions: () => [{ value: 'asc', label: 'Oldest → Newest' }, { value: 'desc', label: 'Newest → Oldest' }] },
              ]}
              active={reportFilters}
              onChange={setReportFilters}
            />
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{filteredReportRows.length} reports</span>
              {Object.keys(reportFilters).length > 0 && (
                <button
                  onClick={() => setReportFilters({})}
                  className="text-gray-400 hover:text-gray-600"
                >Clear</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Findings</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Created By</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReportRows.map((report, idx) => (
                  <tr key={report.auditId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">{idx + 1}</td>
                    <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{report.title}</span></td>
                    <td className="px-6 py-4 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(report.type)}`}>{report.type}</span></td>
                    <td className="px-6 py-4 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>{report.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-semibold">{report.findings || 0}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-sm text-gray-600">{report.createdBy || '—'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            const id = String(report.auditId);
                            // Toggle mở/đóng summary khi bấm View (same UX as AuditPlanning)
                            if (showSummary && selectedAuditId === id) {
                              setShowSummary(false);
                            } else {
                              setSelectedAuditId(id);
                              setShowSummary(true);
                            }
                          }}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View summary"
                          aria-label="View summary"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {(() => {
                          // Export/Upload is allowed for any team member once the report is Closed/Completed.
                          const auditIdNorm = normalizeId(report.auditId);
                          const canExportUpload = isCompletedStatus(report.status);
                          if (canExportUpload) {
                            return (
                              <>
                                <button
                                  onClick={() =>
                                    handleExportPdfForRow(String(report.auditId), report.title)
                                  }
                                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors"
                                  title="Export PDF"
                                  aria-label="Export PDF"
                                >
                                  <HiOutlineDownload className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    onClickUpload(String(report.auditId))
                                  }
                                  disabled={
                                    uploadLoading[auditIdNorm]
                                  }
                                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={
                                    uploadedAudits.has(auditIdNorm)
                                      ? 'This report has already been uploaded.'
                                      : 'Upload the signed PDF/scan report'
                                  }
                                  aria-label={
                                    uploadedAudits.has(auditIdNorm)
                                      ? 'Uploaded report (click to see message)'
                                      : uploadLoading[auditIdNorm]
                                      ? 'Uploading report'
                                      : 'Upload report'
                                  }
                                >
                                  {uploadLoading[auditIdNorm] ? (
                                    <svg
                                      className="w-4 h-4 animate-spin"
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                                      />
                                    </svg>
                                  ) : (
                                    <HiOutlineUpload className="w-4 h-4" />
                                  )}
                                </button>
                                <input
                                  ref={(el) => {
                                    fileInputRefs.current[auditIdNorm] = el;
                                  }}
                                  type="file"
                                  accept="application/pdf,image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) =>
                                    onFileSelected(String(report.auditId), e)
                                  }
                                />
                              </>
                            );
                          }

                          // Disabled state when report is not in a completed/closed status
                          const tooltip = 'Export/Upload are only available when the report is Closed.';

                          return (
                            <>
                              <button
                                disabled
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-300 text-gray-500 cursor-not-allowed"
                                title={tooltip}
                                aria-label="Export PDF (disabled)"
                              >
                                <HiOutlineDownload className="w-4 h-4" />
                              </button>
                              <button
                                disabled
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-300 text-gray-500 cursor-not-allowed"
                                title={tooltip}
                                aria-label="Upload (disabled)"
                              >
                                <HiOutlineUpload className="w-4 h-4" />
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReportRows.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-6 text-sm text-gray-500">No matching reports.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary section - clearer, card-based UI; show after View */}
        {showSummary && (
          <div ref={summaryRef} className="bg-white rounded-xl border border-primary-100 shadow-md p-6 scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">Summary Findings</h2>
                <span className="text-xs text-gray-500">Overview for the selected audit.</span>
              </div>
              <div className="flex items-center gap-3">
                {(() => {
                  // Only show reject reason if:
                  // 1. Status is actually rejected/returned (not submitted)
                  // 2. AND there's a reject note from Lead Auditor
                  const key = String(selectedAuditRow?.auditId || selectedAuditId || '');
                  const noteFromApi = key ? rejectNotes[key] : '';
                  const hasRejectNote = noteFromApi && noteFromApi.trim().length > 0;
                  const isRejected = isRejectedStatus(selectedAuditRow?.status);
                  
                  // Only show if truly rejected AND has a reject note from Lead Auditor
                  if (!isRejected || !hasRejectNote) {
                    return null;
                  }
                  
                  const reason = noteFromApi || 
                    (summary as any)?.reason || (summary as any)?.note ||
                      (selectedAuditRow as any)?.reason || (selectedAuditRow as any)?.note;
                  
                  return (
                    <button
                      onClick={() => {
                        setRejectReasonText(reason ? String(reason) : 'No reason provided. Please edit and resubmit.');
                        setShowRejectReasonModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm font-medium text-red-800">Reject reason</span>
                      <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  );
                })()}
                {(() => {
                  const st = selectedAuditRow?.status || selectedAuditRow?.state || selectedAuditRow?.approvalStatus;
                  const submitted = isSubmittedStatus(st);
                  const completed = isCompletedStatus(st);
                  const rejected = isRejectedStatus(st);
                  const auditIdStr = String(selectedAuditId || '').trim();
                  const isLeadAuditor = auditIdStr && (leadAuditIds.has(auditIdStr) || leadAuditIds.has(auditIdStr.toLowerCase()));
                  
                  // Don't show submit button if user is Lead Auditor or status is Closed
                  if (isLeadAuditor || completed) {
                    return null;
                  }
                  
                  const disabled = submitLoading || !selectedAuditId || submitted;
                  const label = submitLoading
                    ? 'sending...'
                    : submitted
                      ? 'Submitted'
                      : rejected
                        ? 'Resubmit to Lead Auditor'
                        : 'Submit to Lead Auditor';
                  
                  return (
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      disabled={disabled}
                      className={`px-3 py-2 rounded-md text-sm font-medium shadow-sm ${disabled ? 'bg-amber-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
                    >
                      {label}
                    </button>
                  );
                })()}
              </div>
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

            {/* Table: Department */}
            <div className="mt-6">
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
                      {deptRows.map((it: any, idx: number) => {
                        const deptIdLike = it.deptId;
                        const name = it.deptName || (deptIdLike != null ? resolveDeptName(String(deptIdLike), departments) : '') || it.department || '—';
                        return (
                          <tr key={`${name}-${idx}`}>
                            <td className="px-3 py-2">{name}</td>
                            <td className="px-3 py-2 text-right">{Number(it.count || 0)}</td>
                          </tr>
                        );
                      })}
                      {deptRows.length === 0 && (
                        <tr><td className="px-3 py-2 text-gray-500" colSpan={2}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Findings details by month - show after View */}
        {showSummary && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <div className="space-y-3 mb-4">
              <h2 className="text-lg font-semibold text-primary-600">Findings Details</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Free text search..."
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-60"
                />
                <FilterBar
                  singleMode
                  definitions={[
                    { id: 'dept', label: 'Department', type: 'select', getOptions: () => Array.from(new Set(monthsFindings.flatMap(m => m.items.map((f: any) => f.deptId != null ? resolveDeptName(String(f.deptId), departments) : '')))).filter(Boolean).sort().map(d => ({ value: d, label: d })) },
                    { id: 'status', label: 'Status', type: 'select', getOptions: () => Array.from(new Set(monthsFindings.flatMap(m => m.items.map((f: any) => f.status)))).filter(Boolean).sort().map(s => ({ value: String(s).toLowerCase(), label: String(s) })) },
                    { id: 'severity', label: 'Severity', type: 'select', getOptions: () => Array.from(new Set(monthsFindings.flatMap(m => m.items.map((f: any) => f.severity)))).filter(Boolean).sort().map(s => ({ value: String(s).toLowerCase(), label: String(s) })) },
                    { id: 'deadline', label: 'Deadline', type: 'dateRange' }
                  ]}
                  active={findingFilters}
                  onChange={setFindingFilters}
                />
                {Object.keys(findingFilters).length > 0 && (
                  <button onClick={() => setFindingFilters({})} className="text-xs text-gray-500 hover:text-gray-700">Reset filters</button>
                )}
              </div>
            </div>

            {(filteredMonths.length ? filteredMonths : monthsFindings).map((m) => (
              <div key={m.key} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-700">Month {isNaN(m.monthNum) || m.monthNum < 1 ? m.label : m.monthNum}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Total: {m.total}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Open: {m.open}</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">Closed: {m.closed}</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">Overdue: {m.overdue}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-700">#</th>
                        <th className="text-left px-3 py-2 text-gray-700">Title</th>
                        <th className="text-left px-3 py-2 text-gray-700">Dept</th>
                        <th className="text-left px-3 py-2 text-gray-700">Severity</th>
                        <th className="text-left px-3 py-2 text-gray-700">Status</th>
                        <th className="text-left px-3 py-2 text-gray-700">Deadline</th>
                        <th className="text-left px-3 py-2 text-gray-700">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(filteredMonths.length ? m.items : m.items).map((f: any, idx: number) => (
                        <tr key={f.findingId || idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{f.title || '—'}</td>
                          <td className="px-3 py-2">{
                            (f.deptId != null ? resolveDeptName(String(f.deptId), departments) : '—') || '—'
                          }</td>
                          <td className="px-3 py-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium border"
                              style={{ borderColor: '#e5e7eb', color: severityColor(String(f.severity)) }}
                            >
                              {f.severity || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{f.status || '—'}</td>
                          <td className="px-3 py-2">{f.deadline ? new Date(f.deadline).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-2 w-32">
                            {typeof f?.progressPercent === 'number' ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-1.5 rounded-full bg-primary-500"
                                    style={{ width: `${Math.min(Math.max(f.progressPercent, 0), 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 min-w-[2.5rem] text-right">
                                  {Math.round(f.progressPercent)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {m.items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {(!monthsFindings || monthsFindings.length === 0) && (
              <div className="text-sm text-center text-gray-500">No data available.</div>
            )}
          </div>
        )}

        {/* <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
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
        </div> */}

        {/* Submit to Lead Auditor Confirmation Modal */}
        {showSubmitModal && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowSubmitModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Submit to Lead Auditor
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure to submit to Lead Auditor?
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitToLead}
                    disabled={submitLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitLoading ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Reject Reason Modal */}
        {showRejectReasonModal && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowRejectReasonModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Rejection Reason
                    </h3>
                    <p className="text-xs text-gray-500">Report has been rejected by Lead Auditor</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for rejection:
                  </label>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {rejectReasonText}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectReasonModal(false)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Close
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

export default SQAStaffReports;
