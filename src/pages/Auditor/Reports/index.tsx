import { MainLayout } from '../../../layouts';
import { PageHeader } from '../../../components';
import { useAuth } from '../../../contexts';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getStatusColor } from '../../../constants';
import { StatCard, BarChartCard, PieChartCard } from '../../../components';
import { getAuditPlans, getAuditChartLine, getAuditChartPie, getAuditChartBar, getAuditSummary, exportAuditPdf, submitAudit, getAuditReportNote } from '../../../api/audits';
import { getReportRequestByAuditId, getAllReportRequests, type ViewReportRequest } from '../../../api/reportRequest';
import { getDepartments } from '../../../api/departments';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { getDepartmentName as resolveDeptName } from '../../../helpers/auditPlanHelpers';
import { uploadMultipleAuditDocuments, getAuditDocuments } from '../../../api/auditDocuments';
import { getAuditTeam } from '../../../api/auditTeam';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import { getAuditPlanRevisionRequestsByAuditId, type ViewAuditPlanRevisionRequest } from '../../../api/auditPlanRevisionRequest';
import { getAuditChecklistItems } from '../../../api/checklists';
import { unwrap } from '../../../utils/normalize';
import FilterBar, { type ActiveFilters } from '../../../components/filters/FilterBar';
import { toast } from 'react-toastify';
import FindingDetailModal from '../../Shared/FindingDetailModal';

const SQAStaffReports = () => {
  const { user } = useAuth();

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Audit list and selected audit
  const [audits, setAudits] = useState<any[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const selectedAuditIdRef = useRef<string>('');
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
  const [rejectSchedules, setRejectSchedules] = useState<any[]>([]);
  const [loadingRejectSchedules, setLoadingRejectSchedules] = useState(false);
  const [uploadedAudits, setUploadedAudits] = useState<Set<string>>(new Set());
  const [leadAuditIds, setLeadAuditIds] = useState<Set<string>>(new Set());
  const [leadAuditorNames, setLeadAuditorNames] = useState<Record<string, string>>({}); // auditId -> Lead Auditor name
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);
  const [reportRequests, setReportRequests] = useState<Record<string, ViewReportRequest>>({});
  const [allReportRequests, setAllReportRequests] = useState<ViewReportRequest[]>([]);
  const [selectedInProgressAuditId] = useState<string>('');
  
  // Extension request states
  const [, setExtensionRequests] = useState<Record<string, ViewAuditPlanRevisionRequest[]>>({});
  

  // Chart datasets
  const [, setLineData] = useState<Array<{ month: string; count: number }>>([]);
  const [pieData, setPieData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [barData, setBarData] = useState<Array<{ department: string; count: number }>>([]);
  const [findingsMap, setFindingsMap] = useState<Record<string, number>>({});
  // Dynamic filter states (single filter active for findings)
  const [findingFilters, setFindingFilters] = useState<ActiveFilters>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [auditChecklistItems, setAuditChecklistItems] = useState<any[] | null>(null);
  const [summaryTab, setSummaryTab] = useState<'finding' | 'nofindings' | 'checklistitems'>('finding');
  const [overdueDeptFilter, setOverdueDeptFilter] = useState<string>('all');
  const [compliantStatusFilter, setCompliantStatusFilter] = useState<'all' | 'compliant' | 'noncompliant'>('all');
  const [compliantDeptFilter, setCompliantDeptFilter] = useState<string>('all');
  // Filters for No Findings tab
  const [nofindingsDeptFilter, setNofindingsDeptFilter] = useState<string>('all');
  // Filters for Checklist items tab
  const [checklistitemsStatusFilter, setChecklistitemsStatusFilter] = useState<'all' | 'overdue' | 'active' | 'return'>('all');
  const [checklistitemsDeptFilter, setChecklistitemsDeptFilter] = useState<string>('all');
  // Track recently updated audit statuses to prevent overwriting during reload
  const recentlyUpdatedStatusesRef = useRef<Map<string, { status: string; timestamp: number }>>(new Map());
  // Attachments modal state
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<any[]>([]);
  const [selectedFindingTitle, setSelectedFindingTitle] = useState<string>('');
  // Finding detail modal state
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);

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
      
      // Hiển thị TẤT CẢ findings (bao gồm cả Closed) để tổng số và chi tiết luôn khớp
      const allFindings = unwrap(m?.findings) || [];
      
      return {
        key: `${mNum || idx}`,
        monthNum: mNum,
        label,
        total: Number(m?.total ?? 0),
        open: Number(m?.open ?? 0),
        overdue: Number(m?.overdue ?? 0),
        items: allFindings,
      };
    });
  }, [summary]);

  // Checklist overview (overdue + compliant) for selected audit
  // NOTE: Backend checklist items không có deptId, nên dùng "section" như phòng ban logic.
  const checklistOverview = useMemo(() => {
    if (!auditChecklistItems || auditChecklistItems.length === 0) {
      return {
        totalOverdue: 0,
        totalCompliant: 0,
        overdueByDept: [] as Array<{ deptId: string; deptName: string; overdue: number; compliant: number }>,
        overdueItems: [] as any[],
      };
    }

    const byDeptMap = new Map<string, { deptId: string; overdue: number; compliant: number }>();
    const overdueItems: any[] = [];
    const compliantItems: any[] = [];
    let totalOverdue = 0;
    let totalCompliant = 0;

    auditChecklistItems.forEach((item: any) => {
      const rawStatus = String(item.status || '').toLowerCase();
      const isOverdue = rawStatus === 'overdue' || rawStatus.includes('overdue');
      const isCompliant = rawStatus === 'compliant' || rawStatus.includes('compliant');

      // Use section (e.g. "Flight Operations") as logical department key/label
      const sectionRaw =
        item.section ||
        item.departmentName ||
        item.deptName ||
        item.department ||
        '';
      const key = String(sectionRaw || '—').trim();

      if (!byDeptMap.has(key)) {
        byDeptMap.set(key, { deptId: key, overdue: 0, compliant: 0 });
      }
      const agg = byDeptMap.get(key)!;

      if (isOverdue) {
        agg.overdue += 1;
        totalOverdue += 1;
        overdueItems.push(item);
      }
      if (isCompliant) {
        agg.compliant += 1;
        totalCompliant += 1;
        compliantItems.push(item);
      }
    });

    const overdueByDept = Array.from(byDeptMap.values()).map((row) => ({
      deptId: row.deptId,
      deptName: row.deptId || '—', // section label
      overdue: row.overdue,
      compliant: row.compliant,
    }));

    return {
      totalOverdue,
      totalCompliant,
      overdueByDept,
      overdueItems,
      compliantItems,
    };
  }, [auditChecklistItems]);

  // Get unique departments from checklist items
  const checklistDepartments = useMemo(() => {
    const deptSet = new Set<string>();
    if (auditChecklistItems) {
      auditChecklistItems.forEach((item: any) => {
        const deptName =
          item.section ||
          item.departmentName ||
          item.deptName ||
          item.department ||
          '';
        if (deptName) deptSet.add(String(deptName).trim());
      });
    }
    return Array.from(deptSet).sort();
  }, [auditChecklistItems]);

  // Compliant items only (for "No Findings" tab)
  const compliantItemsOnly = useMemo(() => {
    if (!auditChecklistItems) return [];
    let filtered = auditChecklistItems.filter((item: any) => {
      const rawStatus = String(item.status || '').toLowerCase();
      // Check noncompliant first (because "noncompliant" contains "compliant")
      const isNonCompliant = rawStatus === 'noncompliant' || rawStatus === 'non-compliant' || rawStatus.includes('noncompliant') || rawStatus.includes('non-compliant');
      // Then check compliant (exact match or contains, but not if it's noncompliant)
      const isCompliant = !isNonCompliant && (rawStatus === 'compliant' || rawStatus.includes('compliant'));
      return isCompliant;
    });
    
    // Filter by department
    if (nofindingsDeptFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        const deptName =
          item.section ||
          item.departmentName ||
          item.deptName ||
          item.department ||
          '';
        return String(deptName).trim() === nofindingsDeptFilter;
      });
    }
    
    return filtered;
  }, [auditChecklistItems, nofindingsDeptFilter]);

  // Overdue + Active + Return items (for "Checklist items" tab)
  const overdueAndActiveItems = useMemo(() => {
    if (!auditChecklistItems) return [];
    let filtered = auditChecklistItems.filter((item: any) => {
      const rawStatus = String(item.status || '').toLowerCase().trim();
      const isOverdue = rawStatus === 'overdue' || rawStatus.includes('overdue');
      const isActive = rawStatus === 'active';
      const isReturn = rawStatus === 'return' || rawStatus === 'returned' || rawStatus.includes('return');
      
      // Filter by status
      if (checklistitemsStatusFilter === 'all') {
        return isOverdue || isActive || isReturn;
      } else if (checklistitemsStatusFilter === 'overdue') {
        return isOverdue;
      } else if (checklistitemsStatusFilter === 'active') {
        return isActive;
      } else if (checklistitemsStatusFilter === 'return') {
        return isReturn;
      }
      return false;
    });
    
    // Filter by department
    if (checklistitemsDeptFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        const deptName =
          item.section ||
          item.departmentName ||
          item.deptName ||
          item.department ||
          '';
        return String(deptName).trim() === checklistitemsDeptFilter;
      });
    }
    
    return filtered;
  }, [auditChecklistItems, checklistitemsStatusFilter, checklistitemsDeptFilter]);

  // Filtered overdue items
  const filteredOverdueItems = useMemo(() => {
    if (!checklistOverview.overdueItems) return [];
    let filtered = [...checklistOverview.overdueItems];
    if (overdueDeptFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        const deptName =
          item.section ||
          item.departmentName ||
          item.deptName ||
          item.department ||
          '';
        return String(deptName).trim() === overdueDeptFilter;
      });
    }
    return filtered;
  }, [checklistOverview.overdueItems, overdueDeptFilter]);

  // Filtered compliant items (includes both compliant and non-compliant)
  const filteredCompliantItems = useMemo(() => {
    if (!auditChecklistItems) return [];
    let filtered: any[] = [];
    
    // Get all items that are either compliant or non-compliant (not overdue)
    auditChecklistItems.forEach((item: any) => {
      const rawStatus = String(item.status || '').toLowerCase();
      const isOverdue = rawStatus === 'overdue' || rawStatus.includes('overdue');
      
      // Check noncompliant first (because "noncompliant" contains "compliant")
      const isNonCompliant = rawStatus === 'noncompliant' || rawStatus === 'non-compliant' || rawStatus.includes('noncompliant') || rawStatus.includes('non-compliant');
      // Then check compliant (exact match or contains, but not if it's noncompliant)
      const isCompliant = !isNonCompliant && (rawStatus === 'compliant' || rawStatus.includes('compliant'));
      
      if (!isOverdue) {
        // Include both compliant and non-compliant (but not overdue)
        // Also include Return status items when filter is 'all'
        if (compliantStatusFilter === 'all') {
          filtered.push(item); // Includes Return and all other non-overdue statuses
        } else if (compliantStatusFilter === 'compliant' && isCompliant) {
          filtered.push(item);
        } else if (compliantStatusFilter === 'noncompliant' && isNonCompliant) {
          filtered.push(item);
        }
        // Note: Return items are included when filter is 'all'
      }
    });

    // Filter by department
    if (compliantDeptFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        const deptName =
          item.section ||
          item.departmentName ||
          item.deptName ||
          item.department ||
          '';
        return String(deptName).trim() === compliantDeptFilter;
      });
    }
    return filtered;
  }, [auditChecklistItems, compliantStatusFilter, compliantDeptFilter]);

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

  // Small internal component for KPI cards in the summary modal
  const SummaryCard = ({
    title,
    value,
    valueClassName = '',
  }: {
    title: string;
    value: React.ReactNode;
    valueClassName?: string;
  }) => (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm px-3 py-3">
      <p className="text-[11px] font-medium text-gray-500 tracking-wide">{title}</p>
      <p className={`mt-1 text-xl font-semibold text-gray-900 ${valueClassName}`}>{value}</p>
    </div>
  );

  // Load audits list (only Open) and departments
  const reloadReports = useCallback(async () => {
    try {
      const [res, depts, teamsRes, usersRes, allReportRequestsRes] = await Promise.all([
        getAuditPlans(), 
        getDepartments(),
        getAuditTeam(),
        getAdminUsers(),
        getAllReportRequests().catch(() => [])
      ]);
      
      // Set all report requests
      setAllReportRequests(Array.isArray(allReportRequestsRes) ? allReportRequestsRes : []);
      
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
      const leadAuditorNamesMap: Record<string, string> = {};
      
      if (normalizedCurrentUserId) {
        teams.forEach((m: any) => {
          // Try multiple userId fields and normalize for comparison
          const memberUserId = m?.userId;
          if (memberUserId) {
            const normalizedMemberUserId = String(memberUserId).toLowerCase().trim();
            // Match if userIds match (case-insensitive)
            if (normalizedMemberUserId === normalizedCurrentUserId) {
              // Collect all possible auditId formats
              const auditId = m?.auditId;
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
      
      // Build Lead Auditor names map for all audits
      teams.forEach((m: any) => {
        if (m?.isLead === true) {
          const auditId = m?.auditId;
          if (auditId) {
            const auditIdStr = String(auditId).trim();
            if (auditIdStr && !leadAuditorNamesMap[auditIdStr]) {
              // Try to get name from member data or lookup from adminUsers
              let leadName = m?.fullName || m?.name || '';
              if (!leadName && m?.userId) {
                const leadUser = users.find((u: any) => {
                  const uId = u?.userId || (u as any)?.$id || (u as any)?.id;
                  return String(uId).toLowerCase().trim() === String(m.userId).toLowerCase().trim();
                });
                leadName = leadUser?.fullName || leadUser?.email || '';
              }
              if (leadName) {
                leadAuditorNamesMap[auditIdStr] = leadName;
              }
            }
          }
        }
      });
      
      // Set lead audit IDs and names
      setLeadAuditIds(leadAuditIdsSet);
      setLeadAuditorNames(leadAuditorNamesMap);
      
      // Get audit IDs where current user is the creator
      const creatorAuditIds = new Set<string>();
      if (normalizedCurrentUserId) {
        const arrForCreator = unwrap(res);
        (Array.isArray(arrForCreator) ? arrForCreator : []).forEach((a: any) => {
          // Get createdBy from audit (try multiple fields)
          const createdBy = a?.createdBy || a?.createdByUser?.userId || a?.createdByUser?.id || a?.createdByUser?.$id;
          const createdByStr = createdBy ? String(createdBy).toLowerCase().trim() : null;
          
          if (createdByStr === normalizedCurrentUserId) {
            // Add all possible auditId formats
            const auditId = a?.auditId || a?.id || a?.$id;
            if (auditId) {
              const auditIdStr = String(auditId).trim();
              if (auditIdStr) {
                creatorAuditIds.add(auditIdStr);
                creatorAuditIds.add(auditIdStr.toLowerCase());
              }
            }
          }
        });
      }
      
      // Debug logging (only in development mode)
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
       
      }
      {/*Sửa Status để fill*/}
      const arr = unwrap(res);
      const isVisibleStatus = (s: any) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        if (!v) return false;

        // ReportRequest statuses (source of truth for reports)
        const isPending = v === 'pending' || v.includes('pending');
        const isApproved = v === 'approved' || v.includes('approved') || v.includes('approve');
        const isReturned = v === 'returned' || v.includes('return') || v.includes('rejected') || v.includes('reject');

        // Audit plan statuses (for audits not yet submitted)
        const isOpenLike =
          v.includes('inprogress') || v === 'inprogress';
        const isSubmittedLike =
          v.includes('submit') || v.includes('submitted') || v.includes('underreview');
        const isCompletedLike =
          v.includes('closed') || v.includes('completed') || v.includes('complete');

        // Show if matches any of these statuses
        return isPending || isApproved || isReturned || isOpenLike || isSubmittedLike || isCompletedLike;
      };
      
      // First, filter audits by user membership (must be in audit team OR be the creator)
      // Don't filter by status yet - we need to load ReportRequest status first
      const userAudits = (Array.isArray(arr) ? arr : []).filter((a: any) => {
        // Check if user is in audit team OR is the creator
        const hasTeamAccess = normalizedCurrentUserId && userAuditIds.size > 0;
        const hasCreatorAccess = normalizedCurrentUserId && creatorAuditIds.size > 0;
        
        if (!hasTeamAccess && !hasCreatorAccess) {
          return false;
        }
        
        // Check if this audit is in user's audit list (team member) OR creator list
        // Try all possible auditId formats
        const auditIdCandidates = [
          a.auditId,
          a.id,
          a.$id
        ].filter(Boolean).map(id => String(id).trim());
        
        // Check if any auditId format matches (team member OR creator)
        const isUserAudit = auditIdCandidates.some(auditId => {
          // Check team membership
          if (userAuditIds.has(auditId)) return true;
          if (userAuditIds.has(auditId.toLowerCase())) return true;
          
          // Check creator access
          if (creatorAuditIds.has(auditId)) return true;
          if (creatorAuditIds.has(auditId.toLowerCase())) return true;
          
          // Try lowercase version for team
          const lowerAuditId = auditId.toLowerCase();
          if (Array.from(userAuditIds).some(uid => uid.toLowerCase() === lowerAuditId)) return true;
          
          // Try lowercase version for creator
          if (Array.from(creatorAuditIds).some(uid => uid.toLowerCase() === lowerAuditId)) return true;
          
          return false;
        });
        
        return isUserAudit;
      });
      
      // Load ReportRequest status cho TẤT CẢ user audits (before filtering by status)
      // This ensures we can filter based on ReportRequest status even if audit status doesn't match
      const reportRequestsMap: Record<string, ViewReportRequest> = {};
      try {
        await Promise.all(
          userAudits.map(async (audit: any) => {
            const auditId = String(audit.auditId || audit.id || audit.$id || '').trim();
            if (auditId) {
              try {
                const reportRequest = await getReportRequestByAuditId(auditId);
                if (reportRequest) {
                  // Check if this audit was recently updated (within last 5 seconds)
                  const recentUpdate = recentlyUpdatedStatusesRef.current.get(auditId);
                  if (recentUpdate && (Date.now() - recentUpdate.timestamp < 5000)) {
                    // Use the recently updated status instead of API response
                    reportRequestsMap[auditId] = {
                      ...reportRequest,
                      status: recentUpdate.status
                    } as ViewReportRequest;
                    if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
                    }
                  } else {
                    reportRequestsMap[auditId] = reportRequest;
                  }
                }
              } catch (err) {
                // Ignore errors for individual report requests
              }
            }
          })
        );
        setReportRequests(reportRequestsMap);
      } catch (err) {
        console.error('Failed to load report requests', err);
      }
      
      // Filter by status: ONLY use ReportRequest status if exists, otherwise use audit status
      // ReportRequest is the source of truth for report status (Pending, Approved, Returned)
      // Audit plan status is for planning phase, not report phase
      const filtered = userAudits.filter((a: any) => {
        const auditId = String(a.auditId || a.id || a.$id || '').trim();
        const reportRequest = reportRequestsMap[auditId];
        
        // If ReportRequest exists, use its status (source of truth for reports)
        if (reportRequest?.status) {
          const reportRequestStatus = String(reportRequest.status).toLowerCase().replace(/\s+/g, '');
          // ReportRequest statuses: Pending, Approved, Returned
          // All of these should be visible in Reports page
          return isVisibleStatus(reportRequestStatus);
        }
        
        // If no ReportRequest, check audit status (for audits not yet submitted)
        // Only show audits that are in progress or submitted (not yet have ReportRequest)
        const auditStatus = a.status || a.state || a.approvalStatus;
        return isVisibleStatus(auditStatus);
      });
      
      // Apply preserved statuses to filtered audits before setting state
      const filteredWithPreservedStatuses = filtered.map(a => {
        const auditId = String(a.auditId || a.id || a.$id || '').trim();
        const recentUpdate = recentlyUpdatedStatusesRef.current.get(auditId);
        if (recentUpdate && (Date.now() - recentUpdate.timestamp < 5000)) {
          return { ...a, status: recentUpdate.status, state: recentUpdate.status, approvalStatus: recentUpdate.status };
        }
        return a;
      });
      
      setAudits(filteredWithPreservedStatuses);
      
      // Initialize file input refs for all audits
      filtered.forEach((a: any) => {
        const auditId = normalizeId(String(a.auditId || a.id || a.$id || ''));
        if (auditId && !fileInputRefs.current[auditId]) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx';
          input.multiple = true;
          input.style.display = 'none';
          input.onchange = (e: any) => {
            onFileSelected(String(a.auditId || a.id || a.$id || ''), e);
          };
          document.body.appendChild(input);
          fileInputRefs.current[auditId] = input;
        }
      });
      
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
      // Preserve selectedAuditId if it still exists in the filtered list
      // Use ref to get the latest selectedAuditId value (avoid stale closure)
      const currentSelectedId = String(selectedAuditIdRef.current || selectedAuditId || '').trim();
      const currentSelectedExists = currentSelectedId && filtered.some((a: any) => {
        const auditId = String(a.auditId || a.id || a.$id || '').trim();
        return auditId === currentSelectedId;
      });
      if (currentSelectedExists) {
        // Keep the current selected audit
        // Don't change selectedAuditId or close summary
      } else {
        // Current selected audit no longer exists, select first one or clear
        const firstId = filtered?.[0]?.auditId || filtered?.[0]?.id || filtered?.[0]?.$id || '';
        if (firstId) {
          const newId = String(firstId);
          selectedAuditIdRef.current = newId;
          setSelectedAuditId(newId);
        } else {
          selectedAuditIdRef.current = '';
          setSelectedAuditId('');
          setShowSummary(false);
        }
      }
    } catch (err) {
      console.error('Failed to load audits for Reports', err);
      setAudits([]);
    }
  }, [user]);

  useEffect(() => {
    reloadReports();
    
    // Auto-reload every 30 seconds to catch status changes from Lead Auditor
    // This ensures Auditor sees "Returned" status when Lead Auditor rejects
    const intervalId = setInterval(() => {
      reloadReports();
    }, 30000); // 30 seconds
    
    // Also reload when window regains focus (user switches back to tab)
    // This ensures immediate update when user returns to the page
    const handleFocus = () => {
      reloadReports();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reloadReports]);

  // Fetch reject notes ONLY for audits that have ReportRequest with status "Returned"
  // Don't call API if ReportRequest doesn't exist yet (audit hasn't been submitted)
  // IMPORTANT: Preserve existing rejectNotes when reportRequests changes (e.g., during reloadReports)
  useEffect(() => {
    // Only load notes for audits that:
    // 1. Have a ReportRequest (already submitted at least once)
    // 2. AND ReportRequest status is "Returned"
    const returnedIds: string[] = [];

    // Check reportRequests directly - this is the source of truth
    Object.keys(reportRequests).forEach(auditId => {
      const reportRequest = reportRequests[auditId];
      if (reportRequest) {
        const reportStatus = String(reportRequest.status || '').toLowerCase();
        // Only load note if ReportRequest exists AND status is "returned"
        if (reportStatus === 'returned') {
        if (!returnedIds.includes(auditId)) {
          returnedIds.push(auditId);
          }
        }
      }
    });

    // Note: We only load notes for audits that have ReportRequest with status "Returned"
    // This prevents calling API for audits that haven't been submitted yet (no ReportRequest exists)
    // The reportRequests state is loaded from API in reloadReports(), so it's the source of truth

    // Only load notes that are missing - preserve existing notes
    // This prevents losing rejectNotes when reportRequests is reloaded
    const missing = returnedIds.filter((id) => {
      // Only load if note doesn't exist or is empty
      const existingNote = rejectNotes[id];
      return !existingNote || existingNote.trim().length === 0;
    });
    
    if (!missing.length) {
      return;
    }

    let cancelled = false;
    const loadNotes = async () => {
      const results = await Promise.allSettled(missing.map((id) => getAuditReportNote(id)));
      
      if (cancelled) {
        return;
      }
      
      const patch: Record<string, string> = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          const note = res.value ?? '';
          // Only set if note is not empty
          if (note && note.trim().length > 0) {
          patch[missing[idx]] = note;
          }
        }
      });
      
      if (Object.keys(patch).length) {
        // Merge with existing notes - don't overwrite existing notes
        setRejectNotes((prev) => ({ ...prev, ...patch }));
      }
    };

    loadNotes().catch((err) => console.error('Failed to load reject notes', err));
    return () => {
      cancelled = true;
    };
  }, [reportRequests]); // Only depend on reportRequests - rejectNotes is preserved in the filter logic

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

  // Sync selectedAuditIdRef with selectedAuditId state
  useEffect(() => {
    selectedAuditIdRef.current = selectedAuditId;
  }, [selectedAuditId]);

  // Load summary and extension requests when audit changes
  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedAuditId) return;
      const currentAuditId = selectedAuditId; // Capture current auditId to check for changes
      setSummaryTab('finding');
      try {
        const [sum, requests] = await Promise.all([
          getAuditSummary(currentAuditId),
          getAuditPlanRevisionRequestsByAuditId(currentAuditId).catch(() => [])
        ]);
        // Only update summary if selectedAuditId hasn't changed during the async call
        // This prevents race conditions where reloadReports() might change selectedAuditId
        if (String(selectedAuditId) === String(currentAuditId)) {
          setSummary(sum);
          setExtensionRequests(prev => ({ ...prev, [currentAuditId]: requests }));
          const total = Number((sum as any)?.totalFindings ?? 0);
          if (!isNaN(total)) {
            setFindingsMap((prev) => ({ ...prev, [String(currentAuditId)]: total }));
          }

          // Load checklist items for this audit (used for overdue/compliant overview)
          try {
            const items = await getAuditChecklistItems(currentAuditId);
            if (String(selectedAuditId) === String(currentAuditId)) {
              setAuditChecklistItems(Array.isArray(items) ? items : unwrap(items));
            }
          } catch (checkErr) {
            console.error('Failed to load audit checklist items for overview', checkErr);
            // Don't clear checklist items on error - keep existing data
          }
        }
      } catch (err) {
        console.error('Failed to load summary', err);
        // Don't clear summary on error - keep existing data to prevent UI flicker
        // This ensures findings details don't disappear when there's a temporary API error
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
  const isSubmittedStatus = (s: any, auditId?: string) => {
    // Check status từ ReportRequest trước (priority - this is the source of truth)
    if (auditId) {
      const reportRequest = reportRequests[auditId];
      if (reportRequest && reportRequest.status) {
        const reportStatus = String(reportRequest.status || '').toLowerCase().replace(/\s+/g, '');
        // If ReportRequest exists and has status, use it
        // Pending = submitted (waiting for review)
        // Approved = submitted and approved
        // Returned = rejected, NOT submitted
        if (reportStatus === 'pending' || reportStatus === 'approved') {
          return true; // These are submitted statuses
        }
        if (reportStatus === 'returned') {
          return false; // Returned is rejected, not submitted
        }
      }
    }
    
    // Fallback: Check status từ Audit
    const v = String(s || '').toLowerCase().replace(/\s+/g, '');
    const auditStatusMatch = v.includes('submitted') || 
           v === 'pendingreview' || 
           v === 'pending' ||
           v.includes('pendingreview') ||
           v.includes('pending');
    
    return auditStatusMatch;
  };

  // Only allow export/upload when report request is approved
  const isReportApproved = useCallback(
    (auditId: string) => {
      const rr = reportRequests[auditId];
      const status = String(rr?.status || '').toLowerCase().trim();
      return status === 'approved' || status.includes('approved');
    },
    [reportRequests]
  );

  const selectedAuditRow = useMemo(() => {
    const sid = String(selectedAuditId || '');
    return (audits || []).find((a: any) => String(a.auditId || a.id || a.$id) === sid);
  }, [audits, selectedAuditId]);

  // NOTE: Previously we restricted export/upload to the creator only.
  // Now we allow any team member (already filtered in `reloadReports`) once the report is Closed/Completed.

  // Handle update overdue items after extension approved
  // const handleUpdateOverdueItems = async () => {
  //   if (!selectedAuditId) return;
    
  //   setUpdatingOverdue(selectedAuditId);
  //   try {
  //     const result = await updateOverdueToActiveByAuditId(selectedAuditId);
  //     toast.success(`Successfully updated ${result.updatedCount || 0} checklist item(s) from Overdue to Active.`);
  //     // Reload summary to reflect changes
  //     const sum = await getAuditSummary(selectedAuditId);
  //     setSummary(sum);
  //   } catch (err: any) {
  //     console.error('Failed to update overdue items:', err);
  //     const errorMessage = err?.response?.data?.message || err?.message || 'Failed to update overdue items';
  //     toast.error(errorMessage);
  //   } finally {
  //     setUpdatingOverdue('');
  //   }
  // };

  const handleSubmitToLead = async () => {
    if (!selectedAuditId) return;
    
    const auditIdStr = String(selectedAuditId).trim();
    const isLeadAuditor = leadAuditIds.has(auditIdStr) || leadAuditIds.has(auditIdStr.toLowerCase());
    
    // Validate: Only Lead Auditor of the team can submit
    if (!isLeadAuditor) {
      toast.error('Only Lead Auditor of the team can submit reports.');
      return;
    }
    
    try {
      setSubmitLoading(true);
      await submitAudit(selectedAuditId);
      
      // Sau khi submit thành công, cập nhật ReportRequest status ngay lập tức
      // Backend sẽ trả về "Pending" sau khi submit
      const newStatus = 'Pending';
      
      // Track this update to prevent reload from overriding it
      recentlyUpdatedStatusesRef.current.set(String(selectedAuditId), { 
        status: newStatus, 
        timestamp: Date.now() 
      });
      
      // Update reportRequests immediately để button chuyển về "Submitted" ngay
      const updatedReportRequest: ViewReportRequest = {
        ...reportRequests[selectedAuditId],
        auditId: selectedAuditId,
        status: newStatus,
        requestedAt: new Date().toISOString(),
      } as ViewReportRequest;
      
      setReportRequests(prev => ({
        ...prev,
        [selectedAuditId]: updatedReportRequest
      }));
      
      // Update allReportRequests để modal có thể hiển thị status mới ngay lập tức
      setAllReportRequests(prev => {
        const existingIndex = prev.findIndex(r => r.auditId === selectedAuditId);
        if (existingIndex >= 0) {
          // Update existing report request
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: newStatus,
            requestedAt: new Date().toISOString(),
          };
          return updated;
        } else {
          // Add new report request if doesn't exist
          return [...prev, updatedReportRequest];
        }
      });
      
      // Update audits state immediately để UI cập nhật ngay
      setAudits(prev =>
        prev.map(a => {
          const id = String(a.auditId || a.id || a.$id);
          const targetId = String(selectedAuditId);
          if (id === targetId) {
            return { ...a, status: newStatus, state: newStatus, approvalStatus: newStatus };
          }
          return a;
        })
      );
      
      // Clear reject note since report has been resubmitted
      setRejectNotes(prev => {
        const updated = { ...prev };
        delete updated[selectedAuditId];
        return updated;
      });
      
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
  
      }
      
      toast.success(`Submit successfully. Status: ${newStatus}`);
      setShowSubmitModal(false);
      
      // Dispatch event to notify LeadReports page to reload
      try {
        const event = new CustomEvent('reportSubmitted', {
          detail: { auditId: selectedAuditId, status: newStatus },
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);
        document.dispatchEvent(event);
      } catch (err) {
        console.warn('[Reports] Failed to dispatch reportSubmitted event:', err);
      }
      
      // Reload to sync with backend - state has already been updated above for immediate UI feedback
      // reloadReports will merge with current state, so table won't disappear
      await reloadReports();
    } catch (err: any) {
      console.error('Submit to Lead Auditor failed', err);
      
      // Extract error message from various possible formats
      let errorMessage = 'Failed to submit to Lead Auditor';
      
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data?.message) {
          errorMessage = data.message;
        } else if (data?.Message) {
          errorMessage = data.Message;
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.Error) {
          errorMessage = data.Error;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Special handling for "ReportRequest not found" error
      if (errorMessage.toLowerCase().includes('reportrequest not found')) {
        errorMessage = 'ReportRequest not found. Please contact administrator or try again.';
      }
      
      toast.error(errorMessage);
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
    // Check if currently uploading
    if (uploadLoading[auditId]) {
      toast.error('Upload is already in progress. Please wait.');
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


  // Filter InProgress audits
  const inProgressAudits = useMemo(() => {
    return audits.filter((a: any) => {
      const status = String(a.status || a.state || a.approvalStatus || '').toLowerCase().replace(/\s+/g, '');
      return status.includes('inprogress') || status === 'inprogress' || status.includes('in progress');
    });
  }, [audits]);

  // Build InProgress audit rows
  const inProgressRows = useMemo(() => {
    return inProgressAudits.map((a: any, idx: number) => {
      const id = String(a.auditId || a.id || a.$id || `audit_${idx}`);
      const title = a.title || a.name || `Audit ${idx + 1}`;
      const type = a.type || a.auditType || a.category || '—';
      const status = 'In Progress';
      const createdRaw = a.createdAt || a.startDate || a.createdDate || a.start;
      const createdDate = createdRaw ? new Date(createdRaw).toISOString().slice(0, 10) : '';
      const findings = (findingsMap[id] ?? a.totalFindings ?? a.findingsCount ?? a.findingCount ?? 0) as number;
      
      // Get created by label
      const src = a?.createdByUser || a?.createdBy || a?.submittedBy;
      let createdBy = '—';
      if (src) {
        const normalize = (v: any) => String(v || '').toLowerCase().trim();
        if (typeof src === 'string') {
          const sNorm = normalize(src);
          const found = adminUsers.find(u => {
            const id = u.userId || (u as any).$id;
            const email = u.email;
            return (id && normalize(id) === sNorm) || (email && normalize(email) === sNorm);
          });
          createdBy = found?.fullName || found?.email || src;
        } else if (src.fullName) {
          createdBy = src.fullName;
        } else if (src.email) {
          createdBy = src.email;
        }
      }
      
      return {
        id,
        auditId: id,
        title,
        type,
        status,
        findings,
        createdDate,
        createdBy,
      };
    });
  }, [inProgressAudits, findingsMap, adminUsers]);

  // Filter report requests by selected InProgress audit
  const filteredReportRequests = useMemo(() => {
    if (!selectedInProgressAuditId) {
      // If no audit selected, show all report requests for InProgress audits
      const inProgressAuditIds = new Set(inProgressAudits.map((a: any) => String(a.auditId || a.id || a.$id || '')));
      return allReportRequests.filter(r => inProgressAuditIds.has(r.auditId));
    }
    // Filter by selected audit
    return allReportRequests.filter(r => r.auditId === selectedInProgressAuditId);
  }, [allReportRequests, selectedInProgressAuditId, inProgressAudits]);


  // Build report request rows
  const reportRequestRows = useMemo(() => {
    return filteredReportRequests.map((r, idx) => {
      const requestedByUser = adminUsers.find(u => {
        const userId = u.userId || (u as any).$id;
        return userId === r.requestedBy || String(userId) === String(r.requestedBy);
      });
      
      const requestedBy = requestedByUser?.fullName || requestedByUser?.email || r.requestedBy || '—';
      const status = r.status || '—';
      const requestedAt = r.requestedAt ? new Date(r.requestedAt).toLocaleString('vi-VN') : '—';
      const completedAt = r.completedAt ? new Date(r.completedAt).toLocaleString('vi-VN') : '—';
      
      // Get audit details
      const audit = audits.find((a: any) => {
        const auditId = String(a.auditId || a.id || a.$id || '');
        return auditId === r.auditId;
      });
      const auditTitle = audit?.title || audit?.name || r.auditId || '—';
      const auditType = audit?.type || audit?.auditType || audit?.category || '—';
      const findings = (findingsMap[r.auditId] ?? audit?.totalFindings ?? audit?.findingsCount ?? audit?.findingCount ?? 0) as number;
      
      return {
        id: r.reportRequestId || `req_${idx}`,
        reportRequestId: r.reportRequestId,
        auditId: r.auditId,
        auditTitle,
        auditType,
        findings,
        requestedBy,
        status,
        requestedAt,
        completedAt,
        note: r.note || '—',
        filePath: r.filePath || '—',
      };
    });
  }, [filteredReportRequests, adminUsers, audits, findingsMap]);


  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
        <PageHeader
          title="Report Management"
          subtitle="Create and manage audit reports"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slideInRight animate-delay-100">
          <StatCard title="Total Report Requests" value={reportRequestRows.length} icon={<svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} variant="primary" />
          <StatCard title="Returned" value={reportRequestRows.filter(r => String(r.status || '').toLowerCase().includes('returned')).length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} variant="primary-light" />
          <StatCard title="Pending" value={reportRequestRows.filter(r => String(r.status || '').toLowerCase().includes('pending')).length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} variant="primary-light" />
        </div>

        {/* Audit selector */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 animate-slideUp animate-delay-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Audit:</label>
              {audits.length > 0 ? (
                <select
                  value={selectedAuditId}
                  onChange={(e) => {
                    const value = e.target.value;
                    selectedAuditIdRef.current = value;
                    setSelectedAuditId(value);
                  }}
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
            {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
              {/* <LineChartCard
                title="Findings (Monthly)"
                data={lineData}
                xAxisKey="month"
                lines={[{ dataKey: 'count', stroke: '#0369a1', name: 'Findings' }]}
              /> */}
              <PieChartCard title="Severity of Findings" data={pieData} />
              <BarChartCard
              title="Number of Findings by Department "
              data={barData}
              xAxisKey="department"
              bars={[{ dataKey: 'count', fill: '#0369a1', name: 'Findings' }]}
            />
            {/* </div> */}

            
          </>
        ) : audits.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-100 text-yellow-700 text-sm rounded-xl px-4 py-3">
            There is no audit report to view the chart
          </div>
        ) : null}

        {/* In Progress Audits Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200">
          <div className="bg-white p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">In Progress Audits</h2>
            <p className="text-sm text-gray-500 mt-1">Audits currently in progress</p>
          </div>
          <div className="overflow-x-auto font-noto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-bold text-black">#</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">Title</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Type</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Report Status</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Created By</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Created Date</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {inProgressRows.map((audit, idx) => (
                  <tr 
                    key={audit.auditId} 
                    className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                      selectedInProgressAuditId === audit.auditId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">{idx + 1}</td>
                    <td className="px-6 py-4"><span className="text-ms font-bold text-black">{audit.title}</span></td>
                    <td className="px-6 py-4 text-center"><span className="text-ms text-[#5b6166]">{audit.type}</span></td>
                    <td className="px-6 py-4 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(audit.status)}`}>{audit.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {(() => {
                        const reportRequest = allReportRequests.find(r => r.auditId === audit.auditId);
                        const reportStatus = reportRequest?.status || 'Not Submitted';
                        const statusColorClass = getStatusColor(reportStatus);
                        return (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColorClass}`}>
                            {reportStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-ms text-[#5b6166]">{audit.createdBy || '—'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="text-ms text-[#5b6166]">{audit.createdDate || '—'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = String(audit.auditId);
                            // Mở modal summary để xem chi tiết và submit
                            selectedAuditIdRef.current = id;
                            setSelectedAuditId(id);
                            setShowSummary(true);
                          }}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Report Summary"
                          aria-label="View Report Summary"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {(() => {
                          const auditIdStr = String(audit.auditId);
                          const auditIdNorm = normalizeId(auditIdStr);
                          const approved = isReportApproved(auditIdStr);
                          const disableExport = !approved;
                          const disableUpload =
                            !approved ||
                            uploadedAudits.has(auditIdNorm) ||
                            uploadLoading[auditIdNorm];
                          const tooltip = approved
                            ? uploadedAudits.has(auditIdNorm)
                              ? 'Already uploaded'
                              : 'Upload signed report'
                            : 'Export / Upload are available only after the report request is approved.';
                          return (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!approved) {
                                    toast.error('Cannot export. Report request must be approved by Lead Auditor.');
                                    return;
                                  }
                                  handleExportPdfForRow(auditIdStr, audit.title);
                                }}
                                disabled={disableExport}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  disableExport
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                }`}
                                title={approved ? 'Export PDF' : tooltip}
                                aria-label="Export PDF"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!approved) {
                                    toast.error('Cannot upload. Report request must be approved by Lead Auditor.');
                                    return;
                                  }
                                  onClickUpload(auditIdStr);
                                }}
                                disabled={disableUpload}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  disableUpload
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
                                }`}
                                title={tooltip}
                                aria-label="Upload Signed Report"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
                {inProgressRows.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-6 text-sm text-gray-500 text-center">No in progress audits found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary section - now shown in a modal for better focus */}
        {showSummary && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowSummary(false)}
            />

            {/* Modal container */}
            <div
              ref={summaryRef}
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-primary-100"
            >
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-gray-900">Audit Report Summary</h2>
                    
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const st = selectedAuditRow?.status || selectedAuditRow?.state || selectedAuditRow?.approvalStatus;
                      const auditIdStr = String(selectedAuditId || '').trim();
                      const reportRequest = reportRequests[auditIdStr];
                      const reportStatus = reportRequest?.status || '';
                      const statusToCheck = reportStatus || st;
                      const isReportRejected = String(reportStatus).toLowerCase() === 'returned';
                      const rejected = isReportRejected || isRejectedStatus(statusToCheck);
                      const submitted = isSubmittedStatus(statusToCheck, auditIdStr);
                      const completed = isCompletedStatus(statusToCheck);
                      const isLeadAuditor = auditIdStr && (leadAuditIds.has(auditIdStr) || leadAuditIds.has(auditIdStr.toLowerCase()));

                      // Hide button only if audit is completed/closed/approved
                      if (completed) {
                        return null;
                      }

                      const key = String(selectedAuditId || '').trim();
                      const hasRejectNote = key && rejectNotes[key] && rejectNotes[key].trim().length > 0;
                      
                      // Disable if: loading, no audit selected, already submitted (not rejected), rejected without note, or NOT Lead Auditor of team
                      // Only Lead Auditor of the team can submit (isLead === true in AuditTeam)
                      const disabled = submitLoading 
                        || !selectedAuditId 
                        || (submitted && !rejected) 
                        || (rejected && !hasRejectNote) 
                        || !isLeadAuditor; // Only Lead Auditor of team can submit

                      // Get Lead Auditor name for this audit
                      const leadAuditorName = leadAuditorNames[auditIdStr] || 'Lead Auditor';

                      let label = submitLoading
                        ? 'Submitting...'
                        : submitted && !rejected
                          ? reportStatus ? `Submitted (${reportStatus})` : 'Submitted'
                          : rejected
                            ? hasRejectNote
                              ? 'Resubmit to Lead Auditor'
                              : 'Loading reject reason...'
                            : !isLeadAuditor
                              ? `Only Lead of the team: ${leadAuditorName} can submit`
                            : 'Submit to Lead Auditor';

                      return (
                        <button
                          onClick={() => setShowSubmitModal(true)}
                          disabled={disabled}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition-all ${
                            disabled
                              ? 'bg-amber-300 cursor-not-allowed text-white'
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                          title={
                            disabled && submitted && !rejected
                              ? 'Report has been submitted and is pending review'
                              : disabled && !isLeadAuditor
                              ? 'Only Lead Auditor of the team can submit reports'
                              : undefined
                          }
                        >
                          {label}
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => setShowSummary(false)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label="Close summary"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
            {/* Section 1: Alerts + small summary title */}
            <div className="flex items-center justify-between mb-4">
             
              <div className="flex items-center gap-3">
                {(() => {
                  // Only show reject reason button if:
                  // 1. ReportRequest status is "Returned" (source of truth)
                  // 2. AND there's a reject note from Lead Auditor
                  const key = String(selectedAuditRow?.auditId || selectedAuditId || '');
                  const reportRequest = reportRequests[key];
                  const reportStatus = reportRequest?.status || '';
                  const isReportRejected = String(reportStatus).toLowerCase() === 'returned';
                  
                  if (!isReportRejected) {
                    return null;
                  }
                  
                  const noteFromApi = key ? rejectNotes[key] : '';
                  const hasRejectNote = noteFromApi && noteFromApi.trim().length > 0;
                  
                  // Only show if has a reject note from Lead Auditor
                  if (!hasRejectNote) {
                    return null;
                  }
                  
                  const reason = noteFromApi || 
                    (summary as any)?.reason || (summary as any)?.note ||
                      (selectedAuditRow as any)?.reason || (selectedAuditRow as any)?.note;
                  
                  return (
                    <button
                      onClick={async () => {
                        const reasonText = reason ? String(reason) : 'No reason provided. Please edit and resubmit.';
                        setRejectReasonText(reasonText);
                        
                        // Parse rejection note to check for schedule changes
                        const hasScheduleChanges = reasonText.includes('--- Changes Made ---') && 
                                                  reasonText.includes('Schedules:') && 
                                                  reasonText.includes('updated');
                        
                        if (hasScheduleChanges && selectedAuditId) {
                          // Load schedules for this audit
                          setLoadingRejectSchedules(true);
                          try {
                            const schedulesRes = await getAuditSchedules(selectedAuditId);
                            const schedulesData = unwrap(schedulesRes);
                            const schedulesList = Array.isArray(schedulesData) ? schedulesData : [];
                            setRejectSchedules(schedulesList);
                          } catch (err) {
                            console.error('Failed to load schedules for rejection modal', err);
                            setRejectSchedules([]);
                          } finally {
                            setLoadingRejectSchedules(false);
                          }
                        } else {
                          setRejectSchedules([]);
                        }
                        
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
              </div>
            </div>
            {/* Tabs: Finding | No Findings | Checklist items */}
            <div className="border-b border-gray-100">
              <nav className="flex gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setSummaryTab('finding')}
                  className={`pb-2 border-b-2 transition-colors ${
                    summaryTab === 'finding'
                      ? 'border-primary-600 text-primary-700 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Finding
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTab('nofindings')}
                  className={`pb-2 border-b-2 transition-colors ${
                    summaryTab === 'nofindings'
                      ? 'border-primary-600 text-primary-700 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  No Findings
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTab('checklistitems')}
                  className={`pb-2 border-b-2 transition-colors ${
                    summaryTab === 'checklistitems'
                      ? 'border-primary-600 text-primary-700 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Checklist items
                </button>
              </nav>
            </div>

            {/* TAB 1: Finding (Non-compliant findings) */}
            {summaryTab === 'finding' && (
              <>
                {/* KPI cards – high level overview */}
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <SummaryCard title="Total Findings" value={summary?.totalFindings ?? 0} />
                </div>

                {/* Severity + Findings by Department */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Severity Breakdown */}
                  <div className="rounded-lg border border-gray-100 p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">Severity Breakdown</h3>
                      <span className="text-[11px] text-gray-500">
                        Distribution of findings by severity.
                      </span>
                    </div>
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
                            <span className="w-20 text-right text-xs text-gray-700">
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                      {severityEntries.length === 0 && (
                        <div className="text-sm text-gray-500">No data</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Findings by Department */}
                  <div className="rounded-lg border border-gray-100 p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">Findings by Department</h3>
                      <span className="text-[11px] text-gray-500">
                        Total findings per department.
                      </span>
                    </div>
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
                            const name =
                              it.deptName ||
                              (deptIdLike != null
                                ? resolveDeptName(String(deptIdLike), departments)
                                : '') ||
                              it.department ||
                              '—';
                            const count = Number(it.count || 0);
                            const highlight =
                              count > 0 ? 'text-amber-600 font-semibold' : 'text-gray-700';
                            return (
                              <tr key={`${name}-${idx}`}>
                                <td className="px-3 py-2">{name}</td>
                                <td className={`px-3 py-2 text-right ${highlight}`}>{count}</td>
                              </tr>
                            );
                          })}
                          {deptRows.length === 0 && (
                            <tr>
                              <td className="px-3 py-2 text-gray-500" colSpan={2}>
                                No data
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Findings details by month */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                  <div className="space-y-3 mb-4">
                    <h2 className="text-lg font-semibold text-primary-600">Findings Details</h2>
                    <div className="flex flex-wrap gap-3 items-center">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search finding..."
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-60"
                      />
                      <FilterBar
                        singleMode
                        definitions={[
                          { id: 'dept', label: 'Department', type: 'select', getOptions: () => Array.from(new Set(monthsFindings.flatMap(m => m.items.map((f: any) => f.deptId != null ? resolveDeptName(String(f.deptId), departments) : '')))).filter(Boolean).sort().map(d => ({ value: d, label: d })) },
                          { id: 'severity', label: 'Severity', type: 'select', getOptions: () => Array.from(new Set(monthsFindings.flatMap(m => m.items.map((f: any) => f.severity)))).filter(Boolean).sort().map(s => ({ value: String(s).toLowerCase(), label: String(s) })) },
                          { id: 'deadline', label: 'Deadline', type: 'dateRange' }
                        ]}
                        active={findingFilters}
                        onChange={setFindingFilters}
                      />
                      {Object.keys(findingFilters).length > 0 && (
                        <button onClick={() => setFindingFilters({})} className="text-xs text-gray-500 hover:text-gray-700">
                          Reset filters
                        </button>
                      )}
                    </div>
                  </div>

                  {(filteredMonths.length ? filteredMonths : monthsFindings).map((m) => (
                    <div key={m.key} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between mb-2">
                        
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            Total: {m.total}
                          </span>
                          
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
                              <th className="text-left px-3 py-2 text-gray-700">Deadline</th>
                              {/* <th className="text-left px-3 py-2 text-gray-700">Attachments</th> */}
                              <th className="text-left px-3 py-2 text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(filteredMonths.length ? m.items : m.items).map((f: any, idx: number) => (
                              <tr key={f.findingId || idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{idx + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {f.title || '—'}
                                </td>
                                
                                <td className="px-3 py-2">
                                  {(f.deptId != null ? resolveDeptName(String(f.deptId), departments) : '—') || '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium border"
                                    style={{
                                      borderColor: '#e5e7eb',
                                      color: severityColor(String(f.severity)),
                                    }}
                                  >
                                    {f.severity || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {f.deadline ? new Date(f.deadline).toLocaleDateString() : '—'}
                                </td>
                                {/* <td className="px-3 py-2">
                                  {(() => {
                                    const attachments = unwrap(f?.attachments) || [];
                                    if (attachments.length === 0) return <span className="text-xs text-gray-400">—</span>;
                                    return (
                                      <button
                                        onClick={() => {
                                          setSelectedAttachments(attachments);
                                          setSelectedFindingTitle(f?.title || 'Finding Attachments');
                                          setShowAttachmentsModal(true);
                                        }}
                                        className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors cursor-pointer"
                                        title={`Click to view ${attachments.length} attachment(s)`}
                                      >
                                        <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        <span className="text-xs text-primary-600 font-medium">{attachments.length}</span>
                                      </button>
                                    );
                                  })()}
                                </td> */}
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => {
                                      setSelectedFinding(f);
                                      setShowFindingModal(true);
                                    }}
                                    className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 border border-primary-200 rounded-lg transition-colors flex items-center gap-1.5"
                                    title="View details"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {m.items.length === 0 && (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-3 py-4 text-center text-gray-500"
                                >
                                  No data available.
                                </td>
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
              </>
            )}

            {/* TAB 2: No Findings (Compliant items only) */}
            {summaryTab === 'nofindings' && (
              <>
                <div className="mt-8">
                  <div className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-700">
                        Compliant Checklist Items
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={nofindingsDeptFilter}
                          onChange={(e) => setNofindingsDeptFilter(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="all">All Departments</option>
                          {checklistDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-72">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-700">#</th>
                            <th className="px-3 py-2 text-left text-gray-700">Department</th>
                            <th className="px-3 py-2 text-left text-gray-700">Question</th>
                            <th className="px-3 py-2 text-left text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {compliantItemsOnly.length > 0 ? (
                            compliantItemsOnly.map((item: any, idx: number) => {
                              const deptName =
                                item.section ||
                                item.departmentName ||
                                item.deptName ||
                                item.department ||
                                '—';
                              const question =
                                item.questionTextSnapshot ||
                                item.questionText ||
                                item.title ||
                                '—';
                              const status = item.status || '—';
                              const statusColorClass = getStatusColor(status);
                              return (
                                <tr
                                  key={item.auditChecklistItemId || item.itemId || idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-3 py-2 whitespace-nowrap">{idx + 1}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{deptName}</td>
                                  <td className="px-3 py-2">
                                    <span className="line-clamp-2">{question}</span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColorClass}`}>
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                                No compliant checklist items.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB 3: Checklist items (Overdue + Active) */}
            {summaryTab === 'checklistitems' && (
              <>
                <div className="mt-8">
                  <div className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-700">
                        Overdue, Active & Return Checklist Items
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={checklistitemsStatusFilter}
                          onChange={(e) => setChecklistitemsStatusFilter(e.target.value as 'all' | 'overdue' | 'active' | 'return')}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="all">All Status</option>
                          <option value="overdue">Overdue</option>
                          <option value="active">Active</option>
                          <option value="return">Return</option>
                        </select>
                        <select
                          value={checklistitemsDeptFilter}
                          onChange={(e) => setChecklistitemsDeptFilter(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="all">All Departments</option>
                          {checklistDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-72">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-700">#</th>
                            <th className="px-3 py-2 text-left text-gray-700">Department</th>
                            <th className="px-3 py-2 text-left text-gray-700">Question</th>
                            <th className="px-3 py-2 text-left text-gray-700">Status</th>
                            <th className="px-3 py-2 text-left text-gray-700">Due date</th>
                            <th className="px-3 py-2 text-left text-gray-700">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {overdueAndActiveItems.length > 0 ? (
                            overdueAndActiveItems.map((item: any, idx: number) => {
                              const deptName =
                                item.section ||
                                item.departmentName ||
                                item.deptName ||
                                item.department ||
                                '—';
                              const question =
                                item.questionTextSnapshot ||
                                item.questionText ||
                                item.title ||
                                '—';
                              const status = item.status || '—';
                              const dueDate = item.dueDate || item.dueDateSnapshot || null;
                              const notes = item.comment || item.notes || item.reason || item.response || '—';
                              const statusColorClass = getStatusColor(status);

                              return (
                                <tr
                                  key={item.auditChecklistItemId || item.itemId || idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-3 py-2 whitespace-nowrap">{idx + 1}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{deptName}</td>
                                  <td className="px-3 py-2">
                                    <span className="line-clamp-2">{question}</span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColorClass}`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {dueDate ? new Date(dueDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="line-clamp-2 text-xs text-gray-700">{notes}</span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                                No overdue or active checklist items.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
              </div>
            </div>
          </div>,
          document.body
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
                
                <div className="mb-6 space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for rejection:
                  </label>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {rejectReasonText.split('--- Changes Made ---')[0].trim()}
                    </p>
                  </div>
                  </div>
                  
                  {/* Show schedule changes if available */}
                  {rejectReasonText.includes('--- Changes Made ---') && rejectReasonText.includes('Schedules:') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule Changes:
                      </label>
                      {loadingRejectSchedules ? (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs text-gray-500">Loading schedules...</p>
                        </div>
                      ) : rejectSchedules.length > 0 ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-h-64 overflow-y-auto">
                          <div className="space-y-2">
                            {rejectSchedules.map((schedule: any, idx: number) => {
                              const milestoneName = schedule.milestoneName || schedule.milestone || `Schedule ${idx + 1}`;
                              const dueDate = schedule.dueDate ? new Date(schedule.dueDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              }) : 'N/A';
                              
                              return (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-blue-100">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{milestoneName}</p>
                                    <p className="text-xs text-gray-500">Due Date: {dueDate}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                          No schedule details available
                        </div>
                      )}
                    </div>
                  )}
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

        {/* Attachments Modal */}
        {showAttachmentsModal && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowAttachmentsModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Attachments</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedFindingTitle}</p>
                </div>
                <button
                  onClick={() => setShowAttachmentsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedAttachments.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">No attachments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAttachments.map((att: any, idx: number) => {
                      const name = att?.fileName || att?.documentName || att?.name || att?.originalName || `Attachment ${idx + 1}`;
                      const url = att?.blobPath || att?.url || att?.link || att?.path;
                      const size = att?.fileSize || att?.size;
                      const sizeDisplay = size ? (size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(2)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`) : '';
                      const uploadedAt = att?.uploadedAt || att?.createdAt || att?.uploadDate;
                      
                      return (
                        <div key={idx} className="flex items-center gap-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 transition-colors">
                          <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              {sizeDisplay && <span>{sizeDisplay}</span>}
                              {uploadedAt && (
                                <span>
                                  {new Date(uploadedAt).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          {url ? (
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex-shrink-0 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Open
                            </a>
                          ) : (
                            <span className="flex-shrink-0 px-3 py-2 text-xs text-gray-500 bg-gray-200 rounded-lg">No link</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
                <button
                  onClick={() => setShowAttachmentsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Finding Detail Modal */}
        {showFindingModal && selectedFinding && (
          <FindingDetailModal
            isOpen={showFindingModal}
            onClose={() => {
              setShowFindingModal(false);
              setSelectedFinding(null);
            }}
            finding={selectedFinding}
            showReturnAction={false}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffReports;
