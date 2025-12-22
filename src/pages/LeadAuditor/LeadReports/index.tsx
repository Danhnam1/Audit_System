import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditSummary, approveAuditReport, rejectAuditReport, getAuditFullDetail } from '../../../api/audits';
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
  // Track recently updated audit statuses to prevent overwriting during reload
  const recentlyUpdatedStatusesRef = useRef<Map<string, { status: string; timestamp: number }>>(new Map());
  // Force reloading summary data even if selectedAuditId doesn't change (e.g. after Director approves)
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

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
      // For each auditId, prioritize ReportRequest with status "Approved" or "Returned" (after approve/reject)
      // If no approved/rejected, then keep the latest by requestedAt
      const reportRequestMap = new Map<string, ViewReportRequest>();
      rawReportRequests.forEach((rr) => {
        const auditId = String(rr.auditId || '').trim();
        if (!auditId) return;
        const key = auditId.toLowerCase();
        const existing = reportRequestMap.get(key) as any;
        
        if (!existing) {
          reportRequestMap.set(key, rr);
        } else {
          // Check status priority: Approved/Returned > Pending
          const existingStatus = String(existing.status || '').toLowerCase().trim();
          const currentStatus = String(rr.status || '').toLowerCase().trim();
          
          const existingIsFinal = existingStatus === 'approved' || existingStatus === 'returned' || existingStatus.includes('approve') || existingStatus.includes('return');
          const currentIsFinal = currentStatus === 'approved' || currentStatus === 'returned' || currentStatus.includes('approve') || currentStatus.includes('return');
          
          if (currentIsFinal && !existingIsFinal) {
            // Current has final status (Approved/Returned), existing doesn't -> use current
            reportRequestMap.set(key, rr);
          } else if (!currentIsFinal && existingIsFinal) {
            // Existing has final status, current doesn't -> keep existing
            // Do nothing, keep existing
          } else {
            // Both have same priority -> use the latest by requestedAt
            const existingTime = existing.requestedAt ? new Date(existing.requestedAt).getTime() : 0;
            const currentTime = rr.requestedAt ? new Date(rr.requestedAt).getTime() : 0;
            if (currentTime >= existingTime) {
              reportRequestMap.set(key, rr);
            }
          }
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
      
      // Combine reports from ReportRequests (submitted by Auditors)
      const combinedReports: any[] = [];
      
      // Add reports from latest ReportRequest per auditId (submitted by Auditors)
      reportRequests.forEach((rr) => {
        const auditId = String(rr.auditId || '');
        if (!auditId) return;
        
        // Check if this report already exists in combinedReports
        const exists = combinedReports.some((r: any) => {
          const rAuditId = String(r.auditId || r.id || r.$id || '');
          return rAuditId.toLowerCase() === auditId.toLowerCase();
        });
        
        if (!exists) {
          // Get audit details from auditMap
          const audit = auditMap.get(auditId.toLowerCase()) || auditMap.get(auditId);
          
          // Use ReportRequest status (already prioritized by Approved/Returned status)
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
        } else {
          // Update existing report with ReportRequest status if it's more recent or has final status
          const existingIndex = combinedReports.findIndex((r: any) => {
            const rAuditId = String(r.auditId || r.id || r.$id || '');
            return rAuditId.toLowerCase() === auditId.toLowerCase();
          });
          
          if (existingIndex >= 0) {
            const existing = combinedReports[existingIndex];
            const existingStatus = String(existing.status || '').toLowerCase().trim();
            const newStatus = String(rr.status || '').toLowerCase().trim();
            
            // Check if new status is final (Approved/Returned) and existing is not
            const existingIsFinal = existingStatus === 'approved' || existingStatus === 'returned' || existingStatus.includes('approve') || existingStatus.includes('return');
            const newIsFinal = newStatus === 'approved' || newStatus === 'returned' || newStatus.includes('approve') || newStatus.includes('return');
            
            // Update status if new is final or if both are same priority and new is more recent
            if (newIsFinal && !existingIsFinal) {
              // New has final status, existing doesn't -> update
              existing.status = rr.status;
              existing.state = rr.status;
              existing.approvalStatus = rr.status;
            } else if (rr.status && !existingIsFinal && !newIsFinal) {
              // Both are pending, update to latest
              existing.status = rr.status;
              existing.state = rr.status;
              existing.approvalStatus = rr.status;
            }
            
            if (rr.note) {
              existing.note = rr.note;
            }
            
            if (rr.requestedBy) {
              existing.submittedBy = rr.requestedBy;
              existing.submittedByUser = rr.requestedBy;
            }
            existing.reportRequestId = rr.reportRequestId;
          }
        }
      });
      
      // Filter chỉ lấy status: Pending, Approved, Returned
      const allowedStatuses = ['pending', 'approved', 'returned'];
      const filtered = combinedReports.filter((p: any) => {
        const reportStatus = String(p.status || p.state || p.approvalStatus || '').toLowerCase().replace(/\s+/g, '');
        const hasAllowedStatus = allowedStatuses.includes(reportStatus);
        
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
      
      // Merge with recently updated statuses to prevent overwriting
      const updatedSorted = sorted.map((a: any) => {
        const auditId = String(a.auditId || a.id || a.$id || '');
        const recentUpdate = recentlyUpdatedStatusesRef.current.get(auditId);
        if (recentUpdate && Date.now() - recentUpdate.timestamp < 10000) { // Keep for 10 seconds
          return { ...a, status: recentUpdate.status, state: recentUpdate.status, approvalStatus: recentUpdate.status };
        }
        return a;
      });
      
      setAudits(updatedSorted);
      
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
              console.log(`[LeadReports] Loaded ${revisionMap[auditId].length} revision requests for audit ${auditId}:`, revisionMap[auditId]);
            }
          } catch (err) {
            console.error(`Failed to load revision requests for audit ${auditId}`, err);
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

  useEffect(() => { reload(); }, [reload]);

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
          setExpandedFindingId('');
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
      
      // Debug log (only in development)
      if (auditRevisionRequests.length > 0 && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
        console.log(`[LeadReports] Audit ${auditId} revision requests:`, auditRevisionRequests.map(r => ({ id: r.requestId, status: r.status })));
      }
      if (hasApprovedExtension && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
        console.log(`[LeadReports] ✅ Audit ${auditId} has approved extension request - enabling Edit Schedule & Team button`);
      }
      
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
        if (statusFilter === 'closed') {
          // Closed = Approved
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
      
      // Update status immediately in local state
      const updatedStatus = 'Approved';
      recentlyUpdatedStatusesRef.current.set(String(approveAuditId), { 
        status: updatedStatus, 
        timestamp: Date.now() 
      });
      
      setAudits(prev =>
        prev.map(a => {
          const id = String(a.auditId || a.id || a.$id);
          const targetId = String(approveAuditId);
          if (id === targetId) {
            return { ...a, status: updatedStatus, state: updatedStatus, approvalStatus: updatedStatus };
          }
          return a;
        })
      );
      
      toast.success('Approved the Audit Report successfully.');
      closeApproveModal();
      // After approve, hide details until user explicitly clicks View again
      setShowSummary(false);
      setSelectedAuditId('');
      
      // Wait longer before reloading to ensure backend has updated
      // Use a longer delay to ensure backend has processed the approval
      setTimeout(async () => {
        await reload();
      }, 2000);
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
      
      // Update status immediately in local state
      const updatedStatus = 'Returned';
      recentlyUpdatedStatusesRef.current.set(String(rejectAuditId), { 
        status: updatedStatus, 
        timestamp: Date.now() 
      });
      
      setAudits(prev => prev.map(a => {
        const id = String(a.auditId || a.id || a.$id);
        const targetId = String(rejectAuditId);
        if (id === targetId) {
          return { ...a, status: updatedStatus, state: updatedStatus, approvalStatus: updatedStatus };
        }
        return a;
      }));
      
      toast.success('Rejected the Audit Report successfully.');
      closeRejectModal();
      // Clear changes after rejection
      setScheduleChanges([]);
      setTeamChanges([]);
      
      // Wait longer before reloading to ensure backend has updated
      // Use a longer delay to ensure backend has processed the rejection
      setTimeout(async () => {
        await reload();
      }, 2000);
    } catch (err: any) {
      console.error('Reject failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
    } finally {
      setActionLoading('');
    }
  };

  const openEditScheduleTeamModal = async (auditId: string) => {
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
        
        console.log('🔍 Loaded period dates from full detail:', {
          auditId,
          auditKeys: Object.keys(audit),
          hasAuditPlan: !!audit.auditPlan,
          auditPlanKeys: audit.auditPlan ? Object.keys(audit.auditPlan) : [],
          periodFromRaw: periodFrom,
          periodToRaw: periodTo,
          auditPlanPeriodFrom: audit.auditPlan?.periodFrom,
          auditPlanPeriodTo: audit.auditPlan?.periodTo,
          auditStartDate: audit.startDate,
          auditEndDate: audit.endDate,
        });
        
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
        
        console.log('📅 Formatted period dates:', {
          periodFrom: formattedFrom,
          periodTo: formattedTo,
        });

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
        
        console.log('🔍 Getting period dates for audit:', auditId, {
          auditKeys: Object.keys(audit),
          hasAuditPlan: !!audit.auditPlan,
          auditPlanKeys: audit.auditPlan ? Object.keys(audit.auditPlan) : [],
          periodFromRaw: periodFrom,
          periodToRaw: periodTo,
          hasPeriodFrom: !!periodFrom,
          hasPeriodTo: !!periodTo,
          auditPlanPeriodFrom: audit.auditPlan?.periodFrom,
          auditPlanPeriodTo: audit.auditPlan?.periodTo,
        });
        
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
        
        console.log('📅 Formatted period dates:', {
          periodFrom: formattedFrom,
          periodTo: formattedTo
        });

        return {
          periodFrom: formattedFrom,
          periodTo: formattedTo,
        };
      }

      console.warn('⚠️ Audit not found for period dates:', auditId);
      return {};
    };
  }, [audits]);

  const closeEditScheduleTeamModal = () => {
    setShowEditScheduleTeamModal(false);
    setEditScheduleTeamAuditId(null);
  };

  const handleSaveScheduleAndTeam = async (schedules: any[], teamMembers: any[]) => {
    console.log('🚀 handleSaveScheduleAndTeam called', {
      auditId: editScheduleTeamAuditId,
      schedulesCount: schedules.length,
      teamMembersCount: teamMembers.length
    });
    
    if (!editScheduleTeamAuditId) {
      console.warn('⚠️ No editScheduleTeamAuditId, returning early');
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
      
      console.log('🔍 Filtering teams by auditId:', {
        auditId: auditIdStr,
        allTeamsCount: allTeams.length,
        currentTeamWithIdsCount: currentTeamWithIds.length,
        sampleAllTeam: allTeams[0],
        sampleFilteredTeam: currentTeamWithIds[0],
      });
      
      // Merge: prefer currentTeamWithIds (has auditTeamId), fallback to currentTeamFromAuditors
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
      
      console.log('🔍 Team data loaded and merged:', {
        allTeamsCount: allTeams.length,
        currentTeamWithIdsCount: currentTeamWithIds.length,
        currentTeamFromAuditorsCount: currentTeamFromAuditors.length,
        mergedCurrentTeamCount: currentTeam.length,
        teamMapSize: teamMap.size,
        sampleTeamMember: currentTeam[0],
        sampleTeamWithId: currentTeamWithIds[0],
      });

      // Update schedules
      for (const schedule of schedules) {
        const scheduleId = schedule.scheduleId ? String(schedule.scheduleId) : null;
        
        if (scheduleId) {
          // Update existing - backend receives scheduleId via route, NOT in body
          // UpdateAuditSchedule DTO only has: MilestoneName, DueDate, Notes, Status
          // Ensure dueDate is in correct format (ISO string with time)
          let dueDateValue = schedule.dueDate || '';
          if (dueDateValue && !dueDateValue.includes('T')) {
            // If it's just a date (YYYY-MM-DD), convert to ISO datetime
            dueDateValue = new Date(dueDateValue + 'T00:00:00').toISOString();
          }
          
          const updatePayload: any = {
            milestoneName: schedule.milestoneName || '',
            dueDate: dueDateValue,
            notes: schedule.notes || '', // Ensure notes is not undefined
            status: schedule.status || 'Active',
          };
          
          console.log('📝 Updating schedule:', {
            scheduleId,
            milestoneName: updatePayload.milestoneName,
            dueDate: updatePayload.dueDate,
            originalDueDate: schedule.dueDate,
            fullPayload: updatePayload
          });
          // DO NOT include id or auditId in update payload - scheduleId is in route
          try {
            const result = await updateAuditSchedule(scheduleId, updatePayload);
            console.log('✅ Schedule updated successfully:', {
              scheduleId,
              result: result?.data || result
            });
          } catch (updateErr: any) {
            console.error('❌ Failed to update schedule:', {
              scheduleId,
              error: updateErr?.response?.data || updateErr?.message || updateErr,
              status: updateErr?.response?.status
            });
            throw updateErr; // Re-throw to stop execution
          }
        } else {
          // Add new - CreateAuditSchedule DTO requires: AuditId, MilestoneName, DueDate, Notes (optional), Status (optional)
          // Ensure dueDate is in correct format (ISO string with time)
          let dueDateValue = schedule.dueDate || '';
          if (dueDateValue && !dueDateValue.includes('T')) {
            // If it's just a date (YYYY-MM-DD), convert to ISO datetime
            dueDateValue = new Date(dueDateValue + 'T00:00:00').toISOString();
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

      // Update team members - always compare with current team, even if teamMembers is empty
      // This ensures that if user unchecks all and only selects 2, we still delete the unchecked ones
      let teamUpdateErrors: any[] = [];
      try {
        // Build sets of userIds for comparison (empty set if teamMembers is empty)
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

        console.log('🔍 Team update comparison:', {
          selectedUserIds: Array.from(selectedUserIds),
          currentUserIds: Array.from(currentUserIds),
          teamMembersLength: teamMembers.length,
        });

        // 1) Add new members: in selectedUserIds but not in currentUserIds
        for (const userId of Array.from(selectedUserIds)) {
          if (!currentUserIds.has(userId)) {
            try {
              console.log('📝 Adding team member (diff-based):', {
                auditId: editScheduleTeamAuditId,
                userId,
              });
              await addTeamMember({
                auditId: editScheduleTeamAuditId,
                userId,
                roleInTeam: 'Auditor',
                isLead: false,
              });
            } catch (addErr: any) {
              console.error('❌ Failed to add team member (diff-based):', {
                userId,
                error: addErr?.response?.data || addErr?.message || addErr,
                status: addErr?.response?.status,
              });
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
          console.log('🔍 Processing team member for deletion:', {
            userId: uid,
            auditTeamId: currentId,
            memberKeys: Object.keys(currentMember),
            memberStructure: currentMember,
          });
          
          if (!uid) {
            console.warn('⚠️ Skipping team member (missing userId):', {
              currentMember,
              memberKeys: Object.keys(currentMember),
            });
            continue;
          }
          
          if (!currentId) {
            console.error('❌ Cannot delete team member - missing auditTeamId:', {
              userId: uid,
              fullName: currentMember.fullName || 'Unknown',
              memberKeys: Object.keys(currentMember),
              memberStructure: currentMember,
            });
            teamUpdateErrors.push({ 
              member: currentMember, 
              error: new Error('Missing auditTeamId - cannot delete without ID'),
              userId: uid,
            });
            continue;
          }

          if (!selectedUserIds.has(uid)) {
            try {
              console.log('🗑 Deleting team member (diff-based):', {
                auditTeamId: currentId,
                userId: uid,
                fullName: currentMember.fullName || 'Unknown',
              });
              await deleteTeamMember(String(currentId));
              console.log('✅ Successfully deleted team member:', uid);
            } catch (deleteErr: any) {
              console.error('❌ Failed to delete team member (diff-based):', {
                auditTeamId: currentId,
                userId: uid,
                fullName: currentMember.fullName || 'Unknown',
                error: deleteErr?.response?.data || deleteErr?.message || deleteErr,
                status: deleteErr?.response?.status,
                responseData: deleteErr?.response?.data,
              });
              teamUpdateErrors.push({ member: currentMember, error: deleteErr, userId: uid });
            }
          }
        }
      } catch (outerErr: any) {
        console.error('❌ Team diff update failed:', outerErr);
        teamUpdateErrors.push({ error: outerErr });
      }
      
      // Show warning if there were team update errors, but don't block the success flow
      if (teamUpdateErrors.length > 0) {
        console.warn('⚠️ Some team member updates failed:', teamUpdateErrors);
        toast.warning(`Schedule updated successfully, but ${teamUpdateErrors.length} team member update(s) failed.`);
      }

      // Store changes for potential rejection note
      setScheduleChanges(schedules);
      setTeamChanges(teamMembers);

      // Note: We don't update audit status here because:
      // 1. This is the Reports page, not Planning page
      // 2. Status update requires valid status from AuditStatus table
      // 3. Schedule/team updates don't necessarily require status change
      // If status update is needed, it should be done separately with proper status validation

      // Store auditId before closing modal
      const auditIdToNotify = String(editScheduleTeamAuditId);
      console.log('📝 Schedule and team saved for audit:', auditIdToNotify);
      
      // Show success message (even if some team updates failed)
      if (teamUpdateErrors && teamUpdateErrors.length === 0) {
        toast.success('Schedule and team updated successfully.');
      } else if (teamUpdateErrors && teamUpdateErrors.length > 0) {
        toast.warning(`Schedule updated successfully, but ${teamUpdateErrors.length} team member update(s) failed.`);
      } else {
        toast.success('Schedule updated successfully.');
      }
      
      closeEditScheduleTeamModal();
      
      // Reload data first
      await reload();
      
      // Notify PlanDetailsModal and other components to refresh AFTER reload
      // Use multiple attempts to ensure modal receives the event
      // Also dispatch to localStorage for cross-tab communication
      console.log('📢 Starting to dispatch refresh events for audit:', auditIdToNotify);
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
          
          console.log(`✅ [Attempt ${attempt}] Dispatched auditPlanUpdated event for audit:`, auditIdToNotify, {
            eventType: event.type,
            detail: event.detail,
            bubbles: event.bubbles
          });
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
          console.log('💾 Saved to localStorage:', storageData);
          
          // Trigger storage event manually for same-tab
          const storageEvent = new StorageEvent('storage', {
            key: 'auditPlanUpdated',
            newValue: JSON.stringify(eventData),
            storageArea: localStorage
          });
          window.dispatchEvent(storageEvent);
          console.log('📦 Dispatched storage event');
        } catch (storageErr) {
          console.warn('⚠️ Failed to use localStorage for event:', storageErr);
        }
      } catch (err) {
        console.error('❌ Failed to dispatch update event:', err);
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
              setSummaryReloadKey((k) => k + 1); // force reload summary even if same id
              setShowSummary(true);
            }
          }}
          onApprove={openApproveModal}
          onReject={openRejectModal}
          onEditScheduleAndTeam={openEditScheduleTeamModal}
          actionLoading={actionLoading}
          actionMsg={actionMsg}
          getStatusColor={getStatusColor}
          reportSearch={reportSearch}
          setReportSearch={setReportSearch}
        />
        {showSummary && (
          <div ref={summaryRef} className="bg-white rounded-xl border border-primary-100 shadow-md p-6 scroll-mt-24">
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
                    onClick={() => setShowExtensionModal(true)}
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

