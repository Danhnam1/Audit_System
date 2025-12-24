import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditSummary, approveAuditReport, rejectAuditReport, getAuditFullDetail } from '../../../api/audits';
import { returnFinding } from '../../../api/findings';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';
import { Button } from '../../../components/Button';
import AuditReportsTable from './components/AuditReportsTable';
import DepartmentsSection from './components/DepartmentsSection';
import { getAuditTeam, getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import { getAllReportRequests, type ViewReportRequest } from '../../../api/reportRequest';
import { getAuditPlans } from '../../../api/audits';
import SummaryTab from './components/SummaryTab';
import { 
  createAuditPlanRevisionRequest, 
  getAuditPlanRevisionRequestsByAuditId,
  type ViewAuditPlanRevisionRequest 
} from '../../../api/auditPlanRevisionRequest';
import EditScheduleAndTeamModal from './components/EditScheduleAndTeamModal';
import { updateAuditSchedule, addAuditSchedule, deleteAuditSchedule, getAuditSchedules } from '../../../api/auditSchedule';
import { addTeamMember, deleteTeamMember } from '../../../api/auditTeam';

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
  const [showViewModal, setShowViewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'departments' | 'summary'>('departments');
  const [selectedDeptKey, setSelectedDeptKey] = useState<string>('');
  const lastAuditIdRef = useRef<string>('');
  const [selectedFindingId, setSelectedFindingId] = useState<string>('');
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved'>('all');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [findingsSearch, setFindingsSearch] = useState<string>('');
  const [findingsSeverity, setFindingsSeverity] = useState<string>('all');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveAuditId, setApproveAuditId] = useState<string | null>(null);
  const [rejectAuditId, setRejectAuditId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);
  
  // Extension request states
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionComment, setExtensionComment] = useState('');
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [revisionRequests, setRevisionRequests] = useState<ViewAuditPlanRevisionRequest[]>([]);
  // Map of auditId -> revision requests (for checking extension approval)
  const [revisionRequestsMap, setRevisionRequestsMap] = useState<Record<string, ViewAuditPlanRevisionRequest[]>>({});
  
  // Edit Schedule & Team states
  const [showEditScheduleTeamModal, setShowEditScheduleTeamModal] = useState(false);
  const [editScheduleTeamAuditId, setEditScheduleTeamAuditId] = useState<string | null>(null);
  const [auditPeriodDates, setAuditPeriodDates] = useState<{ periodFrom?: string; periodTo?: string }>({});
  const [scheduleChanges, setScheduleChanges] = useState<any[]>([]);
  const [teamChanges, setTeamChanges] = useState<any[]>([]);
  // Track audits that have already edited schedule & team once (FE guard)
  const [editedScheduleTeamOnce, setEditedScheduleTeamOnce] = useState<Set<string>>(new Set());

  const [showReturnFindingModal, setShowReturnFindingModal] = useState(false);
  const [returnFindingNote, setReturnFindingNote] = useState('');
  const [returningFindingId, setReturningFindingId] = useState<string | null>(null);


  // Force reloading summary data even if selectedAuditId doesn't change (e.g. after Director approves)
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  
  // New tables: InProgress audits and their report requests

  const reload = useCallback(async () => {
    try {
      const [teamsRes, usersRes, reportRequestsRes, auditsRes] = await Promise.all([
        getAuditTeam(),
        getAdminUsers(),
        getAllReportRequests().catch(() => []), // Get all ReportRequests (submitted by Auditors)
        getAuditPlans().catch(() => []) // Get all audits to merge with ReportRequests
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
      
      // Get ReportRequests (submitted by Auditors)
      const rawReportRequests = Array.isArray(reportRequestsRes) ? reportRequestsRes as ViewReportRequest[] : [];
      
      // Debug: Group ReportRequests by auditId to see how many exist
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        const groupedByAuditId = rawReportRequests.reduce((acc, rr) => {
          const auditId = String(rr.auditId || '').trim();
          if (!auditId) return acc;
          if (!acc[auditId]) acc[auditId] = [];
          acc[auditId].push(rr);
          return acc;
        }, {} as Record<string, ViewReportRequest[]>);
        
        Object.entries(groupedByAuditId).forEach(([auditId, requests]) => {
          if (requests.length > 1) {
          
          }
        });
      }
      
      // So we compare: max(completedAt, requestedAt) for each ReportRequest to find the most recent action
      const reportRequestMap = new Map<string, ViewReportRequest>();
      rawReportRequests.forEach((rr) => {
        const auditId = String(rr.auditId || '').trim();
        if (!auditId) return;
        const key = auditId.toLowerCase();
        const existing = reportRequestMap.get(key) as any;
        
        if (!existing) {
          reportRequestMap.set(key, rr);
        } else {
          // Compare timestamps to find the LATEST action
          const existingCompletedAt = existing.completedAt ? new Date(existing.completedAt).getTime() : 0;
          const currentCompletedAt = rr.completedAt ? new Date(rr.completedAt).getTime() : 0;
          const existingRequestedAt = existing.requestedAt ? new Date(existing.requestedAt).getTime() : 0;
          const currentRequestedAt = rr.requestedAt ? new Date(rr.requestedAt).getTime() : 0;
          
          // Get the latest timestamp for each ReportRequest (completedAt or requestedAt, whichever is newer)
          // This handles both cases:
          // 1. Resubmit: new ReportRequest has requestedAt > old ReportRequest's completedAt
          // 2. Reject/Approve: same ReportRequest gets completedAt updated
          const existingLatest = Math.max(existingCompletedAt, existingRequestedAt);
          const currentLatest = Math.max(currentCompletedAt, currentRequestedAt);
          
          // Use the ReportRequest with the latest timestamp
          if (currentLatest > existingLatest) {
            reportRequestMap.set(key, rr);
            // Debug log in development
            if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            
            }
          } else if (currentLatest === existingLatest) {
            // If timestamps are equal, prefer the one with status "Pending" (newer submission)
            const existingStatus = String(existing.status || '').toLowerCase();
            const currentStatus = String(rr.status || '').toLowerCase();
            if (currentStatus === 'pending' && existingStatus !== 'pending') {
              reportRequestMap.set(key, rr);
              if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
              }
            }
          }
          // Otherwise keep existing
        }
      });
      const reportRequests = Array.from(reportRequestMap.values()) as ViewReportRequest[];
      
      // Get all audits to merge with ReportRequests
      const auditsList = unwrap(auditsRes);
      const allAudits = Array.isArray(auditsList) ? auditsList : [];
      
      // Create a map of audits by auditId for quick lookup
      const auditMap = new Map<string, any>();
      allAudits.forEach((a: any) => {
        const auditId = String(a.auditId || a.id || a.$id || '');
        if (auditId) {
          auditMap.set(auditId.toLowerCase(), a);
          auditMap.set(auditId, a);
        }
      });
      
      // Filter audits with status InProgress for new table (removed unused)
      // const inProgressAuditsList = allAudits.filter((a: any) => {
      //   const auditStatus = String(a.status || a.state || '').trim();
      //   const normalizedAuditStatus = auditStatus.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
      //   return normalizedAuditStatus === 'inprogress';
      // });
      
      // Combine reports from ReportRequests (submitted by Auditors)
      const combinedReports: any[] = [];
      
      // Add reports from latest ReportRequest per auditId (submitted by Auditors)
      reportRequests.forEach((rr) => {
        const auditId = String(rr.auditId || '');
        if (!auditId) return;
        
        // Get audit details from auditMap
        const audit = auditMap.get(auditId.toLowerCase()) || auditMap.get(auditId);
        
        // Debug: Log if audit not found in auditMap
        if (!audit && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
          console.warn(`[LeadReports] Audit not found in auditMap for ReportRequest:`, {
            auditId,
            reportRequestId: rr.reportRequestId,
            status: rr.status,
            requestedAt: rr.requestedAt,
            auditMapKeys: Array.from(auditMap.keys()).slice(0, 10), // First 10 keys for debugging
          });
        }
        
        if (!audit) {
          // Audit không tồn tại trong auditMap → không hiển thị
          if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            
          }
          return; // Skip this report
        }
        
        // Kiểm tra status của audit - chỉ hiển thị nếu status là "InProgress"
        const auditStatus = String(audit.status || audit.state || '').trim();
        const normalizedAuditStatus = auditStatus.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
        
        // Chỉ hiển thị nếu audit status là "InProgress" (hỗ trợ các format: InProgress, In-Progress, In Progress)
        // Loại bỏ tất cả các status khác: Approved, Pending, Draft, Rejected, Closed, etc.
        const isInProgress = normalizedAuditStatus === 'inprogress';
        
      
        
        if (!isInProgress) {
       
          return; // Skip this report
        }
        
        // Lấy status của report request để hiển thị (bao gồm cả Approved)
        const reportRequestStatus = String(rr.status || '').trim();
        
        
        
        // Backend returns "Returned" (capital R) when reject, normalize to lowercase for comparison
        const finalStatus = rr.status || 'Pending';
        
       
        
        // Create report object from ReportRequest
        const reportObj: any = {
          auditId: auditId,
          id: auditId,
          $id: auditId,
          status: finalStatus,
          state: finalStatus,
          approvalStatus: finalStatus,
          title: audit?.title || audit?.name || rr.title || `Audit ${auditId}`,
          name: audit?.title || audit?.name || rr.title,
          startDate: audit?.startDate,
          createdAt: rr.requestedAt || audit?.createdAt,
          createdDate: rr.requestedAt || audit?.createdDate,
          createdBy: rr.requestedBy,
          submittedBy: rr.requestedBy,
          submittedByUser: rr.requestedBy,
          createdByUser: rr.requestedBy,
          reportRequestId: rr.reportRequestId,
          note: rr.note,
        };
        
        combinedReports.push(reportObj);
      });
      
     
      
      // Filter chỉ lấy status: Pending, Approved, Returned
      const allowedStatuses = ['pending', 'approved', 'returned'];
      const filtered = combinedReports.filter((p: any) => {
        const rawStatus = p.status || p.state || p.approvalStatus || '';
        const reportStatus = String(rawStatus).toLowerCase().replace(/\s+/g, '');
        const hasAllowedStatus = allowedStatuses.includes(reportStatus);
        
        // Debug: Log reports that are filtered out
        if (!hasAllowedStatus && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
          console.warn(`[LeadReports] Report filtered out due to status:`, {
            title: p.title,
            auditId: p.auditId,
            rawStatus: rawStatus,
            normalizedStatus: reportStatus,
            allowedStatuses: allowedStatuses
          });
        }
        
        if (!hasAllowedStatus) return false;
        
        // Check if audit belongs to this Lead Auditor
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
        
        // If Lead Auditor role, show all reports with allowed status
        // Otherwise, only show reports where user is lead of the audit
        if (isLeadAuditorRole) {
          return true; // Lead Auditor sees all reports with Pending/Approved/Returned status
        }
        return auditMatchesLead(p);
      });
      
      const sorted = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : (a.requestedAt ? new Date(a.requestedAt).getTime() : 0));
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : (b.requestedAt ? new Date(b.requestedAt).getTime() : 0));
        return dateB - dateA;
      });
      
   
      
      setAudits(sorted);
      
      // Load revision requests for all audits to check extension approval
      const revisionMap: Record<string, ViewAuditPlanRevisionRequest[]> = {};
      const revisionPromises = sorted.map(async (audit: any) => {
        const auditId = String(audit.auditId || audit.id || audit.$id || '');
        if (auditId) {
          try {
            const requests = await getAuditPlanRevisionRequestsByAuditId(auditId).catch(() => []);
            revisionMap[auditId] = Array.isArray(requests) ? requests : [];
            
            // Debug log (only in development)
            if (revisionMap[auditId].length > 0 && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
            }
          } catch (err) {
            revisionMap[auditId] = [];
          }
        }
      });
      await Promise.all(revisionPromises);
      setRevisionRequestsMap(revisionMap);
    } catch (err) {
      console.error('Failed to load audits for Lead Reports', err);
      setAudits([]);
    }
  }, [user, isLeadAuditorRole]);

  useEffect(() => {
    reload();
    
    // Auto-reload every 30 seconds to catch new ReportRequests when Auditor resubmits
    const intervalId = setInterval(() => {
      reload();
    }, 30000); // 30 seconds
    
    // Also reload when window regains focus (user switches back to tab)
    const handleFocus = () => {
      reload();
    };
    window.addEventListener('focus', handleFocus);
    
    // Listen for report submission events to reload immediately
    const handleReportSubmitted = () => {
      reload();
    };
    window.addEventListener('reportSubmitted', handleReportSubmitted);
    document.addEventListener('reportSubmitted', handleReportSubmitted);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('reportSubmitted', handleReportSubmitted);
      document.removeEventListener('reportSubmitted', handleReportSubmitted);
    };
  }, [reload]);

  // Listen for Director's extension approval so "Edit Schedule & Team" button appears without full reload
  useEffect(() => {
    const handleExtensionApproved = async (event: Event) => {
      const detail: any = (event as CustomEvent).detail || {};
      const auditId: string | undefined = detail.auditId;
      if (!auditId) return;

      try {
        const requests = await getAuditPlanRevisionRequestsByAuditId(auditId).catch(() => []);
        setRevisionRequestsMap((prev) => ({
          ...prev,
          [auditId]: Array.isArray(requests) ? requests : [],
        }));

        // Nếu đang mở đúng audit này thì refresh luôn phần summary & danh sách request
        if (String(selectedAuditId || '') === String(auditId)) {
          setRevisionRequests(Array.isArray(requests) ? requests : []);
          setSummaryReloadKey((k) => k + 1);
        }
      } catch (err) {
        console.error('Failed to refresh revision requests after extension approval event:', err);
      }
    };

    window.addEventListener('auditExtensionApproved', handleExtensionApproved as EventListener);
    return () => {
      window.removeEventListener('auditExtensionApproved', handleExtensionApproved as EventListener);
    };
  }, [selectedAuditId]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedAuditId) return;
      try {
        const [sum, requests] = await Promise.all([
          getAuditSummary(selectedAuditId),
          getAuditPlanRevisionRequestsByAuditId(selectedAuditId).catch(() => [])
        ]);
        setSummary(sum);
        setRevisionRequests(requests);
        setActiveTab('departments');
        if (lastAuditIdRef.current !== selectedAuditId) {
          setSelectedDeptKey('');
          setSelectedFindingId('');
          lastAuditIdRef.current = selectedAuditId;
        }
      } catch (err) {
        console.error('Failed to load summary', err);
        setSummary(null);
      }
    };
    loadSummary();
  }, [selectedAuditId, summaryReloadKey]);

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
      
      // Map status from AuditReports API: Pending, Approved, Returned
      let status: string;
      let displayStatus: string; // Status để hiển thị trên UI
      
      // Normalize và check status (case-insensitive, remove spaces)
      const normalizedStatus = norm;
      
      if (normalizedStatus === 'pending') {
        status = 'Pending';
        displayStatus = 'Pending';
      } else if (normalizedStatus === 'approved' || normalizedStatus.includes('approved') || normalizedStatus.includes('approve')) {
        status = 'Approved';
        displayStatus = 'Approved';
      } else if (normalizedStatus.includes('return') || normalizedStatus.includes('reject') || normalizedStatus === 'returned') {
        status = 'Returned';
        displayStatus = 'Returned';
      } else {
        // Fallback: check rawStatus again with different normalization
        const rawNorm = String(rawStatus).toLowerCase().trim();
        if (rawNorm === 'approved' || rawNorm.includes('approve')) {
          status = 'Approved';
          displayStatus = 'Approved';
        } else if (rawNorm.includes('return') || rawNorm.includes('reject')) {
          status = 'Returned';
          displayStatus = 'Returned';
        } else {
          status = rawStatus;
          displayStatus = rawStatus;
        }
      }
      
      const createdBy = getCreatedByLabel(a);
      
      // Check if there's an approved extension request (revision request)
      // Backend returns revision status as "Approved" (with capital A)
      const auditRevisionRequests = revisionRequestsMap[auditId] || [];
      const hasApprovedExtension = auditRevisionRequests.some((req: ViewAuditPlanRevisionRequest) => {
        const reqStatus = String(req.status || '').trim();
        // Check for approved status (case-insensitive)
        return reqStatus.toLowerCase() === 'approved';
      });
      
   
      
      // Only allow Edit Schedule & Team button when extension request has been approved by Director
      const isDirectorApproved = hasApprovedExtension;
      
      return { 
        auditId, 
        title, 
        status, // Backend status (Pending, Approved, Returned)
        displayStatus, // Frontend display (same as status)
        createdBy, 
        rawStatus, 
        isDirectorApproved 
      };
    });
  }, [audits, adminUsers, revisionRequestsMap]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') {
      list = list.filter(r => {
        const s = String(r.status || '').toLowerCase().replace(/\s+/g, '');
        // Filter theo status từ AuditReports: Pending, Approved, Returned
        if (statusFilter === 'submitted') {
          // Submitted = Pending
          return s === 'pending';
        }
        if (statusFilter === 'approved') {
          // Approved filter shows Approved reports (after Director approval)
          return s === 'approved';
        }
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
    const s = String(status || '').toLowerCase().trim();
    if (!s) return false;
    
    // If status is already Approved, Returned, or Rejected, no decision needed
    // Check exact matches first, then partial matches
    if (s === 'approved' || s === 'returned' || s === 'rejected') {
      return false;
    }
    
    // Check for partial matches (case-insensitive)
    if (s.includes('approve') || s.includes('reject') || s.includes('return')) {
      return false;
    }
    
    // Only show buttons for Pending/Submitted/UnderReview statuses
    return s.includes('submit') || s === 'pending' || s.includes('underreview') || s.includes('under review');
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
      
      toast.success('Approved the Audit Report successfully.');
      closeApproveModal();
      // After approve, hide details until user explicitly clicks View again
      setShowViewModal(false);
      setSelectedAuditId('');
      
      // Reload immediately to get updated data
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
      // Include schedule and team changes in rejection note if any
      let rejectionNote = rejectNote.trim();
      if (scheduleChanges.length > 0 || teamChanges.length > 0) {
        const changesNote = [
          '\n\n--- Changes Made ---',
          scheduleChanges.length > 0 ? `\nSchedules: ${scheduleChanges.length} updated` : '',
          teamChanges.length > 0 ? `\nTeam Members: ${teamChanges.length} updated` : '',
        ].filter(Boolean).join('');
        rejectionNote += changesNote;
      }
      
      await rejectAuditReport(rejectAuditId, { note: rejectionNote });
      
      toast.success('Rejected the Audit Report successfully.');
      closeRejectModal();
      // Clear changes after rejection
      setScheduleChanges([]);
      setTeamChanges([]);
      
      // Wait a bit for backend to process the rejection before reloading
      // This ensures the ReportRequest status is updated to "Returned"
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload to get updated data
      await reload();
    } catch (err: any) {
      console.error('Reject failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
    } finally {
      setActionLoading('');
    }
  };

  const openEditScheduleTeamModal = async (auditId: string) => {
    const auditKey = String(auditId).toLowerCase().trim();
    if (editedScheduleTeamOnce.has(auditKey)) {
      toast.error('Schedule & Team can only be edited once.');
      return;
    }
    setEditScheduleTeamAuditId(auditId);
    setShowEditScheduleTeamModal(true);
    
    // Try to get period dates from full audit detail
    try {
      const fullDetail = await getAuditFullDetail(auditId);
      const audit = fullDetail?.audit || fullDetail?.Audit || fullDetail;
      
      if (audit) {
        // Priority order: auditPlan.periodFrom/periodTo first (most accurate), then audit.periodFrom/periodTo, then startDate/endDate
        const periodFrom = audit.auditPlan?.periodFrom 
                          || audit.auditPlan?.PeriodFrom
                          || audit.periodFrom 
                          || audit.PeriodFrom
                          || audit.auditPlan?.startDate
                          || audit.auditPlan?.StartDate
                          || audit.startDate 
                          || audit.StartDate;
        const periodTo = audit.auditPlan?.periodTo
                        || audit.auditPlan?.PeriodTo
                        || audit.periodTo 
                        || audit.PeriodTo
                        || audit.auditPlan?.endDate
                        || audit.auditPlan?.EndDate
                        || audit.endDate 
                        || audit.EndDate;
        
     
        
        // Convert to YYYY-MM-DD format, avoiding timezone shifts
        const formatDate = (date: any): string | undefined => {
          if (!date) return undefined;
          if (typeof date === 'string') {
            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
            // If it's a datetime string, extract just the date part before converting
            if (date.includes('T')) {
              const datePart = date.split('T')[0];
              if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
            }
            // Parse and format, but use local date to avoid timezone shift
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
              // Use local date components to avoid timezone issues
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } else if (date instanceof Date && !isNaN(date.getTime())) {
            // Use local date components to avoid timezone issues
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          return undefined;
        };

        const formattedFrom = formatDate(periodFrom);
        const formattedTo = formatDate(periodTo);
        

        setAuditPeriodDates({
          periodFrom: formattedFrom,
          periodTo: formattedTo,
        });
      } else {
        // Fallback to getAuditPeriodDates
        const dates = getAuditPeriodDates(auditId);
        setAuditPeriodDates(dates);
      }
    } catch (err) {
      console.warn('Failed to load full audit detail, using fallback:', err);
      // Fallback to getAuditPeriodDates
      const dates = getAuditPeriodDates(auditId);
      setAuditPeriodDates(dates);
    }
  };

  // Get audit period dates for validation
  const getAuditPeriodDates = useMemo(() => {
    return (auditId: string): { periodFrom?: string; periodTo?: string } => {
      // Find audit in audits list
      const audit = audits.find((a: any) => {
        const aId = String(a.auditId || a.id || a.$id || '');
        return aId.toLowerCase() === auditId.toLowerCase();
      });

      if (audit) {
        // Priority order: auditPlan.periodFrom/periodTo first (most accurate), then audit.periodFrom/periodTo, then startDate/endDate
        const periodFrom = audit.auditPlan?.periodFrom 
                          || audit.auditPlan?.PeriodFrom
                          || audit.periodFrom 
                          || audit.PeriodFrom
                          || audit.periodFromDate 
                          || audit.period_from
                          || audit.auditPlan?.startDate
                          || audit.auditPlan?.StartDate
                          || audit.startDate 
                          || audit.StartDate;
        const periodTo = audit.auditPlan?.periodTo
                        || audit.auditPlan?.PeriodTo
                        || audit.periodTo 
                        || audit.PeriodTo
                        || audit.periodToDate
                        || audit.period_to
                        || audit.auditPlan?.endDate
                        || audit.auditPlan?.EndDate
                        || audit.endDate 
                        || audit.EndDate;
        
      
        
        // Convert to YYYY-MM-DD format, avoiding timezone shifts
        const formatDate = (date: any): string | undefined => {
          if (!date) return undefined;
          if (typeof date === 'string') {
            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
            // If it's a datetime string, extract just the date part before converting
            if (date.includes('T')) {
              const datePart = date.split('T')[0];
              if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
            }
            // Parse and format, but use local date to avoid timezone shift
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
              // Use local date components to avoid timezone issues
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } else if (date instanceof Date && !isNaN(date.getTime())) {
            // Use local date components to avoid timezone issues
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          return undefined;
        };

        const formattedFrom = formatDate(periodFrom);
        const formattedTo = formatDate(periodTo);
    

        return {
          periodFrom: formattedFrom,
          periodTo: formattedTo,
        };
      }

      return {};
    };
  }, [audits]);

  const closeEditScheduleTeamModal = () => {
    setShowEditScheduleTeamModal(false);
    setEditScheduleTeamAuditId(null);
  };

  const handleSaveScheduleAndTeam = async (schedules: any[], teamMembers: any[]) => {
 
    
    if (!editScheduleTeamAuditId) {
      return;
    }

    try {
      // Load current schedules and team to compare
      // Use getAuditTeam() to get full team data with auditTeamId, then filter by auditId
      const [currentSchedulesRes, allTeamsRes, currentTeamRes] = await Promise.all([
        getAuditSchedules(editScheduleTeamAuditId),
        getAuditTeam().catch(() => []), // Fallback to empty array if fails
        getAuditorsByAuditId(editScheduleTeamAuditId),
      ]);

      const currentSchedules = unwrap(currentSchedulesRes) || [];
      const allTeams = Array.isArray(allTeamsRes) ? allTeamsRes : [];
      const currentTeamFromAuditors = unwrap(currentTeamRes) || [];
      
      // Try to get full team data with auditTeamId from getAuditTeam()
      // Filter by auditId to get team members with full IDs
      // Check multiple possible field names for auditId
      const auditIdStr = String(editScheduleTeamAuditId);
      const currentTeamWithIds = allTeams.filter((t: any) => {
        const tAuditId = String(
          t.auditId 
          || t.AuditId 
          || t.audit?.id 
          || t.audit?.$id
          || t.audit?.auditId
          || ''
        );
        return tAuditId === auditIdStr;
      });
      
   
      
      // Create a map of userId -> team member with auditTeamId
      const teamMap = new Map<string, any>();
      currentTeamWithIds.forEach((t: any) => {
        const uid = String(t.userId || t.UserId || t.id || t.$id || '').trim();
        if (uid) {
          // Get auditTeamId from various possible fields
          const teamId = t.auditTeamId 
            || t.AuditTeamId 
            || t.id 
            || t.$id
            || t.Id;
          if (teamId) {
            teamMap.set(uid, { ...t, auditTeamId: teamId });
          } else {
            teamMap.set(uid, t);
          }
        }
      });
      
      // Merge with currentTeamFromAuditors, preserving auditTeamId from teamMap
      const currentTeam = currentTeamFromAuditors.map((m: any) => {
        const uid = String(m.userId || m.UserId || m.id || m.$id || '').trim();
        const teamWithId = teamMap.get(uid);
        if (teamWithId) {
          // Merge: use data from currentTeamFromAuditors but add auditTeamId from teamWithId
          const teamId = teamWithId.auditTeamId 
            || teamWithId.AuditTeamId
            || teamWithId.id 
            || teamWithId.$id
            || teamWithId.Id;
          return {
            ...m,
            auditTeamId: teamId,
            id: teamId || m.id,
            $id: teamId || m.$id,
          };
        }
        return m;
      });
      
  
      // Update schedules
      for (const schedule of schedules) {
        const scheduleId = schedule.scheduleId ? String(schedule.scheduleId) : null;
        
        if (scheduleId) {
          // Validate scheduleId format (should be a valid GUID)
          const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!guidRegex.test(scheduleId)) {
         
            throw new Error(`Invalid scheduleId format: ${scheduleId}. Expected GUID format.`);
          }
          
          // Update existing - backend receives scheduleId via route, NOT in body
          // UpdateAuditSchedule DTO only has: MilestoneName, DueDate, Notes, Status
          // Ensure dueDate is in correct format (ISO string with time)
          // Format date to avoid timezone shift: use 12:00:00 UTC (midday) to prevent date shift
          let dueDateValue = schedule.dueDate || '';
          if (dueDateValue && !dueDateValue.includes('T')) {
            // If it's just a date (YYYY-MM-DD), format as ISO datetime with 12:00:00 UTC
            // Using 12:00:00 UTC (midday) prevents timezone shift that causes date to be off by 1 day
            const dateParts = dueDateValue.split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10);
              const day = parseInt(dateParts[2], 10);
              // Format as YYYY-MM-DDTHH:mm:ssZ with 12:00:00 UTC to avoid timezone shift
              dueDateValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`;
            } else {
              // Fallback: try to parse and format
              try {
                const date = new Date(dueDateValue);
                if (!isNaN(date.getTime())) {
                  const year = date.getUTCFullYear();
                  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                  const day = String(date.getUTCDate()).padStart(2, '0');
                  dueDateValue = `${year}-${month}-${day}T12:00:00Z`;
                } else {
                  dueDateValue = dueDateValue + 'T12:00:00Z';
                }
              } catch {
                dueDateValue = dueDateValue + 'T12:00:00Z';
              }
            }
          }
          
          // Validate required fields
          if (!schedule.milestoneName || !schedule.milestoneName.trim()) {
            throw new Error(`Missing required field: milestoneName for schedule ${scheduleId}`);
          }
          
          if (!dueDateValue) {
            throw new Error(`Missing required field: dueDate for schedule ${scheduleId}`);
          }
          
          const updatePayload: any = {
            milestoneName: schedule.milestoneName.trim(),
            dueDate: dueDateValue,
            notes: schedule.notes || '', // Ensure notes is not undefined
            status: schedule.status || 'Active',
          };
          
       
          // DO NOT include id or auditId in update payload - scheduleId is in route
          try {
            const result = await updateAuditSchedule(scheduleId, updatePayload);
         
          } catch (updateErr: any) {
        
            throw updateErr; // Re-throw to stop execution
          }
        } else {
          // Add new - CreateAuditSchedule DTO requires: AuditId, MilestoneName, DueDate, Notes (optional), Status (optional)
          // Ensure dueDate is in correct format (ISO string with time)
          // Format date to avoid timezone shift: use 12:00:00 UTC (midday) to prevent date shift
          let dueDateValue = schedule.dueDate || '';
          if (dueDateValue && !dueDateValue.includes('T')) {
            // If it's just a date (YYYY-MM-DD), format as ISO datetime with 12:00:00 UTC
            // Using 12:00:00 UTC (midday) prevents timezone shift that causes date to be off by 1 day
            const dateParts = dueDateValue.split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10);
              const day = parseInt(dateParts[2], 10);
              // Format as YYYY-MM-DDTHH:mm:ssZ with 12:00:00 UTC to avoid timezone shift
              dueDateValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`;
            } else {
              // Fallback: try to parse and format
              try {
                const date = new Date(dueDateValue);
                if (!isNaN(date.getTime())) {
                  const year = date.getUTCFullYear();
                  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                  const day = String(date.getUTCDate()).padStart(2, '0');
                  dueDateValue = `${year}-${month}-${day}T12:00:00Z`;
                } else {
                  dueDateValue = dueDateValue + 'T12:00:00Z';
                }
              } catch {
                dueDateValue = dueDateValue + 'T12:00:00Z';
              }
            }
          }
          
          const addPayload: any = {
            auditId: editScheduleTeamAuditId,
            milestoneName: schedule.milestoneName || '',
            dueDate: dueDateValue,
            notes: schedule.notes || '', // Ensure notes is not undefined
            status: schedule.status || 'Active',
          };
          // Explicitly remove id and scheduleId to prevent undefined values
          delete addPayload.id;
          delete addPayload.scheduleId;
          await addAuditSchedule(addPayload);
        }
      }

      // Delete removed schedules
      const scheduleIds = schedules.filter(s => s.scheduleId).map(s => s.scheduleId);
      for (const currentSchedule of currentSchedules) {
        const currentId = currentSchedule.scheduleId || currentSchedule.id;
        if (!scheduleIds.includes(currentId)) {
          await deleteAuditSchedule(currentId);
        }
      }

      // Update team members - only if teamMembers array is provided (not empty)
      // If teamMembers is empty, it means user only edited schedule, not team - skip team update
      let teamUpdateErrors: any[] = [];
      
      // Only update team if teamMembers array has items (user actually edited team)
      // Empty array means user only edited schedule, so we skip team update to preserve existing team
      if (teamMembers.length > 0) {
        try {
          // Build sets of userIds for comparison
          const selectedUserIds = new Set<string>(
            teamMembers.map((m: any) => String(m.userId || '').trim()).filter(Boolean)
          );

        // Current auditors (exclude AuditeeOwner)
        const currentAuditors = (currentTeam || []).filter((m: any) => {
          const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
          return role !== 'auditeeowner';
        });

        const currentUserIds = new Set<string>();
        currentAuditors.forEach((m: any) => {
          const uid = String(m.userId || m.id || m.$id || '').trim();
          if (uid) currentUserIds.add(uid);
        });

     

        // 1) Add new members: in selectedUserIds but not in currentUserIds
        for (const userId of Array.from(selectedUserIds)) {
          if (!currentUserIds.has(userId)) {
            try {
        
              await addTeamMember({
                auditId: editScheduleTeamAuditId,
                userId,
                roleInTeam: 'Auditor',
                isLead: false,
              });
            } catch (addErr: any) {
        
              teamUpdateErrors.push({ userId, error: addErr });
            }
          }
        }

        // 2) Delete removed members: in currentUserIds but not in selectedUserIds
        // This will run even if teamMembers is empty (user unchecked all)
        for (const currentMember of currentAuditors) {
          const uid = String(currentMember.userId || currentMember.id || currentMember.$id || '').trim();
          
          // Try multiple fields to get auditTeamId for deletion
          // API might return: auditTeamId, id, $id, AuditTeamId, etc.
          const currentId = currentMember.auditTeamId 
            || currentMember.AuditTeamId 
            || currentMember.id 
            || currentMember.$id
            || currentMember.Id
            || (currentMember as any).auditTeam?.id
            || (currentMember as any).auditTeam?.$id;
          
          // Log full member structure for debugging
         
          
          if (!uid) {
        
            continue;
          }
          
          if (!currentId) {
          
            teamUpdateErrors.push({ 
              member: currentMember, 
              error: new Error('Missing auditTeamId - cannot delete without ID'),
              userId: uid,
            });
            continue;
          }

          if (!selectedUserIds.has(uid)) {
            try {
            
              await deleteTeamMember(String(currentId));
            } catch (deleteErr: any) {
            
              teamUpdateErrors.push({ member: currentMember, error: deleteErr, userId: uid });
            }
          }
        }
        } catch (outerErr: any) {
          teamUpdateErrors.push({ error: outerErr });
        }
      } else {
      }
      
      // Show warning if there were team update errors, but don't block the success flow
      if (teamUpdateErrors.length > 0) {
        toast.warning(`Schedule updated successfully, but ${teamUpdateErrors.length} team member update(s) failed.`);
      }

      // Store changes for potential rejection note
      setScheduleChanges(schedules);
      setTeamChanges(teamMembers);


      // Store auditId before closing modal
      const auditIdToNotify = String(editScheduleTeamAuditId);
      const auditKey = auditIdToNotify.toLowerCase().trim();
      
      // Show success message (even if some team updates failed)
      if (teamUpdateErrors && teamUpdateErrors.length === 0) {
        toast.success('Schedule and team updated successfully.');
      } else if (teamUpdateErrors && teamUpdateErrors.length > 0) {
        toast.warning(`Schedule updated successfully, but ${teamUpdateErrors.length} team member update(s) failed.`);
      } else {
        toast.success('Schedule updated successfully.');
      }
      
      // Mark this audit as edited once (prevent further edits - FE guard)
      setEditedScheduleTeamOnce((prev) => {
        const next = new Set(prev);
        next.add(auditKey);
        return next;
      });

      closeEditScheduleTeamModal();
      
      // Reload data first
      await reload();
      
      // Notify PlanDetailsModal and other components to refresh AFTER reload
      // Use multiple attempts to ensure modal receives the event
      // Also dispatch to localStorage for cross-tab communication
      try {
        const eventData = { 
          auditId: auditIdToNotify,
          timestamp: Date.now(),
          action: 'scheduleTeamUpdated'
        };
        
        const dispatchRefreshEvent = (attempt: number = 0) => {
          // Dispatch CustomEvent for same-tab communication
          const event = new CustomEvent('auditPlanUpdated', {
            detail: eventData,
            bubbles: true,
            cancelable: true
          });
          
          window.dispatchEvent(event);
          document.dispatchEvent(event); // Also dispatch on document
          
     
        };
        
        // Dispatch immediately
        dispatchRefreshEvent(0);
        
        // Dispatch after short delays to ensure modal catches it
        setTimeout(() => dispatchRefreshEvent(1), 100);
        setTimeout(() => dispatchRefreshEvent(2), 300);
        setTimeout(() => dispatchRefreshEvent(3), 500);
        setTimeout(() => dispatchRefreshEvent(4), 1000);
        setTimeout(() => dispatchRefreshEvent(5), 2000);
        
        // Also use localStorage event for cross-tab communication
        try {
          const storageData = {
            ...eventData,
            _timestamp: Date.now()
          };
          localStorage.setItem('auditPlanUpdated', JSON.stringify(storageData));
          
          // Trigger storage event manually for same-tab
          const storageEvent = new StorageEvent('storage', {
            key: 'auditPlanUpdated',
            newValue: JSON.stringify(eventData),
            storageArea: localStorage
          });
          window.dispatchEvent(storageEvent);
        } catch (storageErr) {
          console.warn(' Failed to use localStorage for event:', storageErr);
        }
      } catch (err) {
        console.error(' Failed to dispatch update event:', err);
      }
    } catch (err: any) {
      console.error('Failed to save schedule and team', err);
      throw err;
    }
  };

  // Handle request extension (Lead Auditor)
  const handleRequestExtension = async () => {
    if (!selectedAuditId) return;
    if (!extensionComment.trim()) {
      toast.error('Please enter a comment explaining why you need an extension.');
      return;
    }
    
    setExtensionLoading(true);
    try {
      await createAuditPlanRevisionRequest({
        auditId: selectedAuditId,
        comment: extensionComment.trim(),
      });
      toast.success('Extension request sent to Director successfully.');
      setShowExtensionModal(false);
      setExtensionComment('');
      // Reload revision requests
      const requests = await getAuditPlanRevisionRequestsByAuditId(selectedAuditId);
      setRevisionRequests(requests);
    } catch (err: any) {
      console.error('Request extension failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to request extension: ' + errorMessage);
    } finally {
      setExtensionLoading(false);
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
    if (!showViewModal) return;
    if (activeTab !== 'departments') return;
    if (selectedDeptKey) return;
    if (departmentEntries.length > 0) {
      setSelectedDeptKey(departmentEntries[0].key);
    }
  }, [showViewModal, activeTab, departmentEntries, selectedDeptKey]);

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
            // Mở modal khi bấm View
            setSelectedAuditId(id);
            setSummaryReloadKey((k) => k + 1); // force reload summary even if same id
            setShowViewModal(true);
          }}
          onApprove={openApproveModal}
          onReject={openRejectModal}
          onEditScheduleAndTeam={openEditScheduleTeamModal}
        editedScheduleTeamOnce={editedScheduleTeamOnce}
          actionLoading={actionLoading}
          actionMsg={actionMsg}
          getStatusColor={getStatusColor}
          reportSearch={reportSearch}
          setReportSearch={setReportSearch}
        />

        {/* View Details Modal */}
        {showViewModal && selectedAuditId && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowViewModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-900">Report Details</h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('departments')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'departments' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >Departments</button>
                    <button
                      onClick={() => setActiveTab('summary')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'summary' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >Summary</button>
                  </div>
                  {/* Request Extension Button - Only show if report is submitted and not rejected */}
                  {(() => {
                    const selectedAudit = audits.find(a => String(a.auditId || a.id || a.$id) === selectedAuditId);
                    const status = selectedAudit?.status || '';
                    const canRequestExtension = needsDecision(status);
                    // Check if there's already a pending request
                    const hasPendingRequest = revisionRequests.some(r => r.status === 'Pending');
                    
                    if (!canRequestExtension || hasPendingRequest) return null;
                    
                    return (
                      <button
                        onClick={() => {
                          setShowViewModal(false);
                          setShowExtensionModal(true);
                        }}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Request Extension
                      </button>
                    );
                  })()}
                </div>
                {activeTab === 'departments' ? (
                  <DepartmentsSection
                    departmentEntries={departmentEntries}
                    selectedDeptKey={selectedDeptKey}
                    setSelectedDeptKey={setSelectedDeptKey}
                    findings={findingsForSelectedDept}
                    onViewFinding={(finding) => {
                      setSelectedFindingId(String(finding?.findingId || ''));
                      setShowFindingModal(true);
                    }}
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

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
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
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={closeApproveModal}
                    className="rounded-md font-semibold shadow-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    size="md"
                    onClick={handleApprove}
                    disabled={actionLoading === approveAuditId}
                    isLoading={actionLoading === approveAuditId}
                    className="rounded-md font-semibold shadow-sm"
                  >
                    {actionLoading === approveAuditId ? 'Approving...' : 'Approve'}
                  </Button>
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
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={closeRejectModal}
                    className="rounded-md font-semibold shadow-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={handleReject}
                    disabled={actionLoading === rejectAuditId}
                    isLoading={actionLoading === rejectAuditId}
                    className="rounded-md font-semibold shadow-sm"
                  >
                    {actionLoading === rejectAuditId ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Request Extension Modal */}
        {showExtensionModal && selectedAuditId && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowExtensionModal(false);
                setExtensionComment('');
              }}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Request Extension for Evidence Due Date
                    </h3>
                    <p className="text-xs text-gray-500">Request Director to extend the deadline for submitting evidence</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for extension request:
                  </label>
                  <textarea
                    value={extensionComment}
                    onChange={(e) => setExtensionComment(e.target.value)}
                    placeholder="Explain why you need an extension for evidence due date..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    rows={5}
                  />
                </div>

                {/* Show existing requests if any */}
                {revisionRequests.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Previous Requests:</p>
                    <div className="space-y-2">
                      {revisionRequests.map((req) => (
                        <div key={req.requestId} className="text-xs text-gray-600">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {req.status === 'Pending' ? '⏳ Pending' : 
                               req.status === 'Approved' ? '✅ Approved' : 
                               req.status === 'Rejected' ? '❌ Rejected' : req.status}
                            </span>
                            <span className="text-gray-500">
                              {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          {req.comment && (
                            <p className="mt-1 text-gray-500 line-clamp-2">{req.comment}</p>
                          )}
                          {req.responseComment && (
                            <p className="mt-1 text-gray-600">
                              <span className="font-medium">Response:</span> {req.responseComment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowExtensionModal(false);
                      setExtensionComment('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestExtension}
                    disabled={extensionLoading || !extensionComment.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {extensionLoading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Finding Details Modal */}
        {showFindingModal && selectedFindingId && createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"
              onClick={() => setShowFindingModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-slideUp">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Finding Details</h2>
                    <p className="text-xs text-gray-500 mt-0.5">View complete finding information</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFindingModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all p-2 rounded-lg"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {(() => {
                  const selectedFinding = findingsForSelectedDept.find((f: any) => 
                    String(f?.findingId || '') === selectedFindingId
                  );
                  
                  if (!selectedFinding) {
                    return (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-gray-500 font-medium">Finding not found</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-5">
                        {/* Title */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 leading-relaxed">{selectedFinding?.title || '—'}</div>
                        </div>

                        {/* Description */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Description</label>
                          </div>
                          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedFinding?.description || '—'}</div>
                        </div>

                        {/* Severity & Status */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Severity</label>
                            </div>
                            <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${String(selectedFinding?.severity||'').toLowerCase().includes('major') ? 'bg-amber-100 text-amber-800 border border-amber-200' : String(selectedFinding?.severity||'').toLowerCase().includes('minor') ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                              {selectedFinding?.severity || '—'}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Status</label>
                            </div>
                            <div className="text-sm font-medium text-gray-800">{selectedFinding?.status || '—'}</div>
                          </div>
                        </div>

                        {/* Audit Item */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Audit Item</label>
                          </div>
                          <div className="text-sm text-gray-800 leading-relaxed">{selectedFinding?.auditItem?.questionTextSnapshot || selectedFinding?.auditItem?.section || '—'}</div>
                        </div>

                        {/* Created By, Created, Deadline */}
                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Created By</label>
                            </div>
                            <div className="text-sm font-medium text-gray-800">{selectedFinding?.createdByUser?.fullName || selectedFinding?.createdByUser?.email || '—'}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Created</label>
                              </div>
                              <div className="text-sm font-medium text-gray-800">
                                {selectedFinding?.createdAt ? new Date(selectedFinding.createdAt).toLocaleDateString('en-GB') : '—'}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Deadline</label>
                              </div>
                              <div className="text-sm font-medium text-gray-800">
                                {selectedFinding?.deadline ? new Date(selectedFinding.deadline).toLocaleDateString('en-GB') : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Attachments */}
                      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <label className="text-sm font-bold text-gray-900">Attachments</label>
                          <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {unwrapValues(selectedFinding?.attachments).length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {unwrapValues(selectedFinding?.attachments).length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                              <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm text-gray-500 font-medium">No attachments</p>
                            </div>
                          ) : (
                            unwrapValues(selectedFinding?.attachments).map((att: any, idx: number) => {
                              const name = att?.fileName || att?.documentName || att?.name || att?.originalName || `Attachment ${idx+1}`;
                              const url = att?.blobPath || att?.url || att?.link || att?.path;
                              return (
                                <div key={idx} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 transition-colors">
                                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                                    {url && (
                                      <div className="text-xs text-gray-500 mt-0.5">Click to open</div>
                                    )}
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
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                {(() => {
                  const selectedFinding = findingsForSelectedDept.find((f: any) => 
                    String(f?.findingId || '') === selectedFindingId
                  );
                  const isReturned = selectedFinding && String(selectedFinding?.status || '').toLowerCase() === 'return';
                  
                  if (isReturned) {
                    return (
                      <div className="flex items-center gap-2 px-6 py-2.5 bg-orange-100 text-orange-700 font-medium rounded-lg border border-orange-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Returned
                      </div>
                    );
                  }
                  
                  return (
                    <button
                      onClick={() => {
                        setReturningFindingId(selectedFindingId);
                        setReturnFindingNote('');
                        setShowReturnFindingModal(true);
                      }}
                      className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-all shadow-sm flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Return
                    </button>
                  );
                })()}
                <button
                  onClick={() => setShowFindingModal(false)}
                  className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Return Finding Modal */}
        {showReturnFindingModal && returningFindingId && createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowReturnFindingModal(false);
                setReturnFindingNote('');
                setReturningFindingId(null);
              }}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Return Finding</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Provide a reason for returning this finding</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={returnFindingNote}
                    onChange={(e) => setReturnFindingNote(e.target.value)}
                    placeholder="Enter reason for returning this finding..."
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowReturnFindingModal(false);
                      setReturnFindingNote('');
                      setReturningFindingId(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!returnFindingNote.trim()) {
                        toast.error('Please enter a reason for returning this finding.');
                        return;
                      }
                      
                      if (!returningFindingId) return;
                      
                      try {
                        setActionLoading(returningFindingId);
                        await returnFinding(returningFindingId, returnFindingNote.trim());
                        
                        toast.success('Finding returned successfully.');
                        setShowReturnFindingModal(false);
                        setShowFindingModal(false);
                        setReturnFindingNote('');
                        setReturningFindingId(null);
                        
                        // Reload data
                        setTimeout(async () => {
                          await reload();
                        }, 1000);
                      } catch (error: any) {
                        console.error('Failed to return finding:', error);
                        toast.error(error?.response?.data?.message || error?.message || 'Failed to return finding.');
                      } finally {
                        setActionLoading('');
                      }
                    }}
                    disabled={!returnFindingNote.trim() || actionLoading === returningFindingId}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                  >
                    {actionLoading === returningFindingId ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Returning...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Return Finding
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Schedule & Team Modal */}
        {showEditScheduleTeamModal && editScheduleTeamAuditId && (
          <EditScheduleAndTeamModal
            show={showEditScheduleTeamModal}
            auditId={editScheduleTeamAuditId}
            onClose={closeEditScheduleTeamModal}
            onSave={handleSaveScheduleAndTeam}
            periodFrom={auditPeriodDates.periodFrom}
            periodTo={auditPeriodDates.periodTo}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default AuditorLeadReports;

