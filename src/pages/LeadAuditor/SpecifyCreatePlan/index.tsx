import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import {
  getAuditPlanAssignments,
  createAuditPlanAssignment,
  deleteAuditPlanAssignment,
  getAllRejections,
  type AuditPlanAssignment,
} from '../../../api/auditPlanAssignment';
import { toast } from 'react-toastify';
import { AuditorSelectionTable } from './components/AuditorSelectionTable';
import { AssignedAuditorsList } from './components/AssignedAuditorsList';
import { AuditorAssignmentsView } from './components/AuditorAssignmentsView';
import { useUserId } from '../../../store/useAuthStore';
import { createNotification } from '../../../api/notifications';
import { getAuditPlans } from '../../../api/audits';
import { StatCard } from '../../../components/StatCard';
import { Pagination } from '../../../components/Pagination';

type AssignmentViewMode = 'all' | 'assigned' | 'responses' | 'created';

const ITEMS_PER_PAGE = 10;

const SpecifyCreatePlan = () => {
  const { user } = useAuth();
  const userIdFromToken = useUserId();
  const [auditors, setAuditors] = useState<AdminUserDto[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUserDto[]>([]); // Store all users to find LeadAuditor
  const [assignments, setAssignments] = useState<AuditPlanAssignment[]>([]);
  const [selectedAuditorId, setSelectedAuditorId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // DRL files state - Map<auditorId, File[]>
  const [drlFiles, setDrlFiles] = useState<Map<string, File[]>>(new Map());
  
  const [assignmentViewMode, setAssignmentViewMode] = useState<AssignmentViewMode>('all');
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [allRejections, setAllRejections] = useState<any[]>([]);
  const [loadingRejections, setLoadingRejections] = useState(false);
  const [approvedAssignments, setApprovedAssignments] = useState<AuditPlanAssignment[]>([]);
  const [rejectedAssignments, setRejectedAssignments] = useState<AuditPlanAssignment[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  // Date filter for all tabs
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  // Pagination states for each tab
  const [availablePage, setAvailablePage] = useState(1);
  const [assignedPage, setAssignedPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);

  // Reset pagination when filter changes
  useEffect(() => {
    setAvailablePage(1);
    setAssignedPage(1);
    setApprovedPage(1);
    setRejectedPage(1);
    setCreatedPage(1);
  }, [filterStartDate, filterEndDate]);

  // Debug: Log when selectedAuditorId changes
  useEffect(() => {
    console.log('[SpecifyCreatePlan] selectedAuditorId changed:', selectedAuditorId);
  }, [selectedAuditorId]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;
  const normalizedRole = (user?.roleName || '').toLowerCase().replace(/\s+/g, '');
  const isAuditor = normalizedRole === 'auditor';
  const isLead = normalizedRole === 'leadauditor' || normalizedRole === 'lead';

  const toArray = (input: any) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (input.$values && Array.isArray(input.$values)) return input.$values;
    return [];
  };

  // Load auditors, assignments, and all audits
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [usersData, assignmentsData, auditsData] = await Promise.all([
          getAdminUsers(),
          getAuditPlanAssignments(),
          getAuditPlans(),
        ]);

        // Filter only auditors
        const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
        const auditorList = (usersData || []).filter(
          (u: AdminUserDto) => norm(u.roleName || '') === 'auditor'
        );

        setAuditors(auditorList);
        setAllUsers(usersData || []); // Store all users for finding LeadAuditor userId
        setAssignments(assignmentsData || []);
        
        // Unwrap and store all audits for matching with assignments
        const { unwrap } = await import('../../../utils/normalize');
        const auditsList = unwrap(auditsData);
        const auditsArray = Array.isArray(auditsList) ? auditsList : [];
        setAllAudits(auditsArray);
        
        // Debug: Log assignment data to see format
        console.log('[SpecifyCreatePlan] Loaded assignments:', assignmentsData);
        console.log('[SpecifyCreatePlan] Loaded all audits:', auditsArray.length);
        if (assignmentsData && assignmentsData.length > 0) {
          console.log('[SpecifyCreatePlan] Sample assignment:', assignmentsData[0]);
          console.log('[SpecifyCreatePlan] Sample assignment auditorId type:', typeof assignmentsData[0]?.auditorId);
        }
      } catch (error: any) {
        console.error('Failed to load data', error);
        toast.error('Failed to load auditors and assignments');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load all rejections for Lead Auditor
  useEffect(() => {
    const loadRejections = async () => {
      if (!isLead) return;
      setLoadingRejections(true);
      try {
        const data = await getAllRejections();
        setAllRejections(toArray(data));
      } catch (error: any) {
        console.error('Failed to load rejections', error);
        toast.error('Failed to load rejections');
      } finally {
        setLoadingRejections(false);
      }
    };

    loadRejections();
  }, [isLead]);

  // Load approved and rejected assignments for Responses tab
  useEffect(() => {
    const loadResponses = async () => {
      if (assignmentViewMode !== 'responses') return;
      setLoadingResponses(true);
      try {
        const allAssignments = await getAuditPlanAssignments();
        let approved = allAssignments.filter((a: AuditPlanAssignment) => 
          String(a.status || '').toLowerCase() === 'approved'
        );
        let rejected = allAssignments.filter((a: AuditPlanAssignment) => 
          String(a.status || '').toLowerCase() === 'rejected'
        );
        
        // Apply date filter if provided
        if (filterStartDate || filterEndDate) {
          approved = approved.filter((a: AuditPlanAssignment) => {
            const assignedDate = new Date(a.assignedDate || '');
            if (filterStartDate && assignedDate < new Date(filterStartDate)) return false;
            if (filterEndDate && assignedDate > new Date(filterEndDate + 'T23:59:59')) return false;
            return true;
          });
          rejected = rejected.filter((a: AuditPlanAssignment) => {
            const assignedDate = new Date(a.assignedDate || '');
            if (filterStartDate && assignedDate < new Date(filterStartDate)) return false;
            if (filterEndDate && assignedDate > new Date(filterEndDate + 'T23:59:59')) return false;
            return true;
          });
        }
        
        setApprovedAssignments(approved);
        setRejectedAssignments(rejected);
      } catch (error: any) {
        console.error('Failed to load responses', error);
        toast.error('Failed to load auditor responses');
      } finally {
        setLoadingResponses(false);
      }
    };

    loadResponses();
  }, [assignmentViewMode, filterStartDate, filterEndDate]);

  // Get assigned auditor IDs (convert to strings for comparison)
  const assignedAuditorIds = assignments.map((a) => String(a.auditorId));

  // Get available auditors (not yet assigned, and filter by date if provided)
  const availableAuditors = (() => {
    // If filter date is provided, we need to check if auditor was assigned within the date range
    if (filterStartDate || filterEndDate) {
      // Filter out auditors who were assigned within the date range
      const filteredAssignedIds = assignments
        .filter((a) => {
          const assignedDate = new Date(a.assignedDate || '');
          if (filterStartDate && assignedDate < new Date(filterStartDate)) return false;
          if (filterEndDate && assignedDate > new Date(filterEndDate + 'T23:59:59')) return false;
          return true;
        })
        .map((a) => String(a.auditorId));
      
      return auditors.filter(
        (a) => !filteredAssignedIds.includes(String(a.userId || ''))
      );
    }
    
    // No filter: return all available auditors
    return auditors.filter(
      (a) => !assignedAuditorIds.includes(String(a.userId || ''))
    );
  })();

  // Get assigned auditors with their details and audit info (dedupe by auditorId, keep latest assignedDate)
  const assignedAuditors = (() => {
    // Filter by date if provided
    let filteredAssignments = assignments;
    if (filterStartDate || filterEndDate) {
      filteredAssignments = assignments.filter((a) => {
        const assignedDate = new Date(a.assignedDate || '');
        if (filterStartDate && assignedDate < new Date(filterStartDate)) return false;
        if (filterEndDate && assignedDate > new Date(filterEndDate + 'T23:59:59')) return false;
        return true;
      });
    }
    
    // Sort by assignedDate desc then pick first per auditorId
    const sorted = [...filteredAssignments].sort(
      (a, b) => new Date(b.assignedDate || '').getTime() - new Date(a.assignedDate || '').getTime()
    );
    const latestByAuditor = new Map<string, AuditPlanAssignment>();
    sorted.forEach((a) => {
      const key = String(a.auditorId || '');
      if (key && !latestByAuditor.has(key)) {
        latestByAuditor.set(key, a);
      }
    });
    const deduped = Array.from(latestByAuditor.values());
    
    return deduped.map((assignment) => {
      const auditor = auditors.find(
        (a) => String(a.userId || '') === String(assignment.auditorId || '')
      );
      
      // Find audit created by this auditor (from all audits)
      let auditInfo: { startDate?: string; endDate?: string } | null = null;
      if (allAudits.length > 0) {
        const audit = allAudits.find((a: any) => {
          const createdBy = a.createdBy || a.createdByUserId || a.auditorId || a.userId;
          return String(createdBy) === String(assignment.auditorId);
        });
        
        if (audit) {
          auditInfo = {
            startDate: audit.startDate || audit.periodFrom || audit.PeriodFrom,
            endDate: audit.endDate || audit.periodTo || audit.PeriodTo
          };
        }
      }
      
      if (!auditor) {
        return {
          ...assignment,
          auditor: {
            userId: assignment.auditorId,
            fullName: 'Unknown Auditor',
            email: 'N/A',
          } as AdminUserDto,
          auditInfo
        };
      }
      
      return { ...assignment, auditor, auditInfo };
    }) as Array<AuditPlanAssignment & { auditor: AdminUserDto; auditInfo?: { startDate?: string; endDate?: string } | null }>;
  })();

  // Get auditors who have created plans (with date filter)
  const createdAuditors = (() => {
    if (!allAudits || allAudits.length === 0) return [];

    // Group audits by createdBy (auditorId)
    const auditsByAuditor = new Map<string, any[]>();
    
    allAudits.forEach((audit: any) => {
      const createdBy = audit.createdBy || audit.createdByUserId || audit.auditorId || audit.userId;
      if (!createdBy) return;
      
      const auditorId = String(createdBy);
      if (!auditsByAuditor.has(auditorId)) {
        auditsByAuditor.set(auditorId, []);
      }
      auditsByAuditor.get(auditorId)!.push(audit);
    });

    // Filter by creation date if provided
    let filteredAuditsByAuditor = auditsByAuditor;
    if (filterStartDate || filterEndDate) {
      filteredAuditsByAuditor = new Map<string, any[]>();
      auditsByAuditor.forEach((audits, auditorId) => {
        const filteredAudits = audits.filter((audit: any) => {
          const auditCreatedDate = audit.createdDate || audit.createdAt || audit.startDate || audit.periodFrom || audit.PeriodFrom;
          if (!auditCreatedDate) return false;
          
          const auditDate = new Date(auditCreatedDate);
          if (filterStartDate && auditDate < new Date(filterStartDate)) return false;
          if (filterEndDate && auditDate > new Date(filterEndDate + 'T23:59:59')) return false;
          return true;
        });
        
        if (filteredAudits.length > 0) {
          filteredAuditsByAuditor.set(auditorId, filteredAudits);
        }
      });
    }

    // Map to auditor info with audit details
    return Array.from(filteredAuditsByAuditor.entries()).map(([auditorId, audits]) => {
      const auditor = auditors.find(
        (a) => String(a.userId || '') === auditorId
      );
      
      // Get the latest audit (most recent createdDate)
      const latestAudit = audits.sort((a: any, b: any) => {
        const dateA = new Date(a.createdDate || a.createdAt || a.startDate || a.periodFrom || a.PeriodFrom || 0);
        const dateB = new Date(b.createdDate || b.createdAt || b.startDate || b.periodFrom || b.PeriodFrom || 0);
        return dateB.getTime() - dateA.getTime();
      })[0];

      const auditInfo = {
        auditId: latestAudit.auditId || latestAudit.id,
        title: latestAudit.title || latestAudit.name || 'Untitled Audit',
        startDate: latestAudit.startDate || latestAudit.periodFrom || latestAudit.PeriodFrom,
        endDate: latestAudit.endDate || latestAudit.periodTo || latestAudit.PeriodTo,
        createdDate: latestAudit.createdDate || latestAudit.createdAt || latestAudit.startDate || latestAudit.periodFrom || latestAudit.PeriodFrom,
        planCount: audits.length
      };

      if (!auditor) {
        return {
          auditorId,
          auditor: {
            userId: auditorId,
            fullName: 'Unknown Auditor',
            email: 'N/A',
          } as AdminUserDto,
          auditInfo
        };
      }

      return {
        auditorId,
        auditor,
        auditInfo
      };
    });
  })();

  // If auditor accesses this screen, show their assignment inbox to approve/reject
  if (isAuditor) {
    return (
      <MainLayout user={layoutUser}>
        <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Plan Creation Assignments</h1>
            <p className="text-gray-600 text-sm mt-1">
              Approve or reject plan creation permissions assigned by Lead Auditor.
            </p>
          </div>
          {/* Lead Auditor chỉ xem/duyệt, không cần callback permission */}
          <AuditorAssignmentsView />
        </div>
      </MainLayout>
    );
  }

  // Handle assign auditor
  const handleAssign = async () => {
    console.log('[SpecifyCreatePlan] handleAssign called:', { selectedAuditorId, user, userIdFromToken });
    
    if (!selectedAuditorId) {
      toast.warning('Please select an auditor');
      return;
    }

    // Validate remarks
    if (!remarks || remarks.trim() === '') {
      toast.warning('Please enter remarks');
      return;
    }

    // Get userId from token (JWT) instead of user object
    const assignByUserId = userIdFromToken || (user as any)?.$id;
    
    if (!assignByUserId) {
      toast.error('User information not available');
      return;
    }

    setSubmitting(true);
    try {
      const assignedDate = new Date().toISOString();

      // Find the selected auditor to get their ID (UUID string)
      const selectedAuditor = auditors.find(
        (a) => String(a.userId || '') === String(selectedAuditorId || '')
      );
      
      if (!selectedAuditor) {
        toast.error('Selected auditor not found');
        setSubmitting(false);
        return;
      }
      
      // Backend expects userId (GUID) of Auditor
      // Use userId field (not $id) - this is the GUID that backend expects
      let auditorIdForApi: string = '';
      if (selectedAuditor.userId && typeof selectedAuditor.userId === 'string' && selectedAuditor.userId.length > 0) {
        auditorIdForApi = selectedAuditor.userId;
      } else if (selectedAuditorId && typeof selectedAuditorId === 'string' && selectedAuditorId.length > 0) {
        auditorIdForApi = String(selectedAuditorId);
      }
      
      if (!auditorIdForApi || auditorIdForApi.trim() === '') {
        toast.error('Invalid auditor ID - userId not found');
        setSubmitting(false);
        return;
      }
      
      // Backend expects userId (GUID) of LeadAuditor (the person assigning)
      // Need to get userId from allUsers list where roleName is "LeadAuditor"
      // Priority: Find in allUsers by email > userIdFromToken > user.$id
      let assignByForApi: string = '';
      
      // First, try to find current user in allUsers list by email
      if (user?.email && allUsers.length > 0) {
        const currentUserInList = allUsers.find((u: any) => {
          const uEmail = String(u?.email || '').toLowerCase().trim();
          const userEmail = String(user.email || '').toLowerCase().trim();
          return uEmail && userEmail && uEmail === userEmail;
        });
        
        if (currentUserInList?.userId) {
          assignByForApi = String(currentUserInList.userId);
        }
      }
      
      // Fallback to userIdFromToken or user.$id
      if (!assignByForApi) {
        if (assignByUserId && typeof assignByUserId === 'string' && assignByUserId.length > 0) {
          assignByForApi = String(assignByUserId);
        } else if ((user as any)?.$id && typeof (user as any).$id === 'string' && (user as any).$id.length > 0) {
          assignByForApi = String((user as any).$id);
        }
      }
      
      if (!assignByForApi || assignByForApi.trim() === '') {
        toast.error('Invalid user ID for assignment - cannot find LeadAuditor userId');
        setSubmitting(false);
        return;
      }

      console.log('[SpecifyCreatePlan] Calling API with:', {
        selectedAuditorId,
        selectedAuditor,
        auditorIdForApi,
        auditorIdForApiType: typeof auditorIdForApi,
        assignByForApi,
        assignByForApiType: typeof assignByForApi,
        assignedDate,
      });

      // Ensure remarks is not empty (already validated above, but double-check)
      const remarksValue = remarks.trim();
      if (!remarksValue) {
        toast.error('Remarks cannot be empty');
        setSubmitting(false);
        return;
      }

      // Get DRL files for selected auditor (before clearing selection)
      const drlFilesList = selectedAuditorId ? drlFiles.get(selectedAuditorId) || [] : [];
      const auditorIdToClear = selectedAuditorId; // Store for cleanup
      
      // Create assignment with files if DRL files are provided
      const assignmentPayload: any = {
        auditorId: auditorIdForApi, // UUID string
        assignBy: assignByForApi, // UUID string
        assignedDate,
        remarks: remarksValue, // Ensure it's a non-empty string
      };
      
      // Add files if DRL files are provided
      if (drlFilesList.length > 0) {
        (assignmentPayload as any).files = drlFilesList;
        console.log('[SpecifyCreatePlan] Creating assignment with DRL files:', drlFilesList.map(f => f.name));
      }

      const result = await createAuditPlanAssignment(assignmentPayload);

      console.log('[SpecifyCreatePlan] API response:', result);

      // Reload assignments and auditors to get fresh data
      try {
        const [updatedAssignments, updatedUsers] = await Promise.all([
          getAuditPlanAssignments(),
          getAdminUsers(),
        ]);
        
        // Filter only auditors
        const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
        const auditorList = (updatedUsers || []).filter(
          (u: AdminUserDto) => norm(u.roleName || '') === 'auditor'
        );
        
        setAuditors(auditorList);
        setAllUsers(updatedUsers || []);
        setAssignments(updatedAssignments || []);
        
        console.log('[SpecifyCreatePlan] Reloaded assignments:', updatedAssignments);
        console.log('[SpecifyCreatePlan] Reloaded auditors:', auditorList);
      } catch (reloadError) {
        console.error('[SpecifyCreatePlan] Failed to reload data:', reloadError);
        // Still try to reload assignments even if users fail
        const updatedAssignments = await getAuditPlanAssignments();
        setAssignments(updatedAssignments || []);
      }

      setSelectedAuditorId(null);
      setRemarks(''); // Reset remarks after successful assignment

      // Send notification to the assigned auditor
      try {
        const fileNames = drlFilesList.map(f => f.name).join(', ');
        const notificationMessage = drlFilesList.length > 0
          ? `You have been granted permission to create audit plans. ${drlFilesList.length} DRL template(s) ${drlFilesList.length === 1 ? 'has' : 'have'} been attached: ${fileNames}`
          : `You have been granted permission to create audit plans.`;
        
        await createNotification({
          userId: auditorIdForApi,
          title: 'Plan Creation Permission Assigned',
          message: notificationMessage,
          remarks: remarks.trim() || 'Assigned permission to create audit plans', // Use remarks from form or default message
          entityType: 'AuditPlanAssignment',
          entityId: result?.assignmentId || '',
          category: 'AuditTeam',
        });
        console.log('[SpecifyCreatePlan] Notification sent to auditor', drlFilesList.length > 0 ? `with ${drlFilesList.length} DRL file(s)` : '');
      } catch (notifError) {
        // Don't fail the whole operation if notification fails
        console.error('[SpecifyCreatePlan] Failed to send notification:', notifError);
      }

      // Remove DRL files for assigned auditor after successful assignment
      if (auditorIdToClear) {
        setDrlFiles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(auditorIdToClear);
          return newMap;
        });
      }

      toast.success('Successfully assigned plan creation permission');
    } catch (error: any) {
      console.error('Failed to assign auditor', error);
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to assign auditor';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle remove assignment
  const handleRemove = async (assignmentId: string, auditorName: string) => {
    if (!window.confirm(`Remove plan creation permission from ${auditorName}?`)) {
      return;
    }

    try {
      // Validate assignmentId
      if (!assignmentId || assignmentId.trim() === '') {
        toast.error('Invalid assignment ID');
        return;
      }
      
      // Backend requires deletion by assignmentId (GUID)
      await deleteAuditPlanAssignment(assignmentId);
      
      // Reload assignments and auditors
      try {
        const [updatedAssignments, updatedUsers] = await Promise.all([
          getAuditPlanAssignments(),
          getAdminUsers(),
        ]);
        
        const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
        const auditorList = (updatedUsers || []).filter(
          (u: AdminUserDto) => norm(u.roleName || '') === 'auditor'
        );
        
        setAuditors(auditorList);
        setAllUsers(updatedUsers || []);
        setAssignments(updatedAssignments || []);
      } catch (reloadError) {
        console.error('[handleRemove] Failed to reload data:', reloadError);
        const updatedAssignments = await getAuditPlanAssignments();
        setAssignments(updatedAssignments || []);
      }

      toast.success(`Removed plan creation permission from ${auditorName}`);
    } catch (error: any) {
      console.error('Failed to remove assignment', error);
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to remove assignment';
      toast.error(errorMsg);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">
            Specify Create Plan
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Select auditors who can create audit plans
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Quick Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Auditors"
            value={auditors.length}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Assigned"
            value={assignedAuditors.length}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Available"
            value={availableAuditors.length}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-medium"
          />
        </div>

        {/* Auditors Management Section - Combined Layout */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          {/* Header with Tabs */}
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center justify-between mb-4">
              <div>
            <h2 className="text-lg font-semibold text-white">
                  Auditors Management
            </h2>
                <p className="text-primary-100 text-sm mt-1">
                  Manage auditor assignments and permissions
                </p>
              </div>
            </div>

            {/* Tabs and Date Filter - Same row */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Tabs for switching views */}
              <div className="flex gap-2 flex-wrap flex-1">
              <button
                onClick={() => {
                  setAssignmentViewMode('all');
                  setAvailablePage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'all'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Available ({availableAuditors.length})
              </button>
              <button
                onClick={() => {
                  setAssignmentViewMode('assigned');
                  setAssignedPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'assigned'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Assigned ({assignedAuditors.length})
              </button>
              <button
                onClick={() => {
                  setAssignmentViewMode('responses');
                  setApprovedPage(1);
                  setRejectedPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'responses'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Responses ({approvedAssignments.length + rejectedAssignments.length})
              </button>
              <button
                onClick={() => {
                  setAssignmentViewMode('created');
                  setCreatedPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'created'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Created ({createdAuditors.length})
              </button>
              </div>

              {/* Date Filter - Simple inline */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-white whitespace-nowrap">
                  Filter:
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  placeholder="From"
                  className="px-3 py-2 border border-white/30 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 w-36"
                />
                <span className="text-white text-sm">-</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  placeholder="To"
                  className="px-3 py-2 border border-white/30 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 w-36"
                />
                {(filterStartDate || filterEndDate) && (
                  <button
                    onClick={() => {
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="px-3 py-2 text-sm font-medium text-white hover:text-white/80 transition-colors"
                    title="Clear filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {/* Available Auditors View */}
            {assignmentViewMode === 'all' && (
              <>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="mt-2 text-gray-600">Loading auditors...</p>
              </div>
            ) : availableAuditors.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium text-lg mb-2">All Auditors Assigned</p>
                    <p className="text-gray-500 text-sm">
                      All auditors have been granted plan creation permission.
                    </p>
              </div>
            ) : (
              <>
                {/* Calculate pagination for Available tab */}
                {(() => {
                  const totalPages = Math.ceil(availableAuditors.length / ITEMS_PER_PAGE);
                  const startIndex = (availablePage - 1) * ITEMS_PER_PAGE;
                  const endIndex = startIndex + ITEMS_PER_PAGE;
                  const paginatedAuditors = availableAuditors.slice(startIndex, endIndex);
                  
                  return (
                    <>
                      <AuditorSelectionTable
                        auditors={paginatedAuditors}
                        selectedAuditorId={selectedAuditorId}
                        onSelectionChange={(id) => {
                          console.log('[SpecifyCreatePlan] onSelectionChange called with:', id);
                          setSelectedAuditorId(id);
                        }}
                        drlFiles={drlFiles}
                        onDrlFileChange={(auditorId, files) => {
                          setDrlFiles((prev) => {
                            const newMap = new Map(prev);
                            if (files && files.length > 0) {
                              // Merge with existing files if any
                              const existingFiles = newMap.get(auditorId) || [];
                              const allFiles = [...existingFiles, ...files];
                              // Remove duplicates based on file name and size
                              const uniqueFiles = allFiles.filter((file, index, self) =>
                                index === self.findIndex(f => f.name === file.name && f.size === file.size)
                              );
                              newMap.set(auditorId, uniqueFiles);
                            } else {
                              newMap.delete(auditorId);
                            }
                            return newMap;
                          });
                        }}
                      />
                      
                      {/* Pagination for Available tab */}
                      {totalPages > 1 && (
                        <div className="mt-6">
                          <Pagination
                            currentPage={availablePage}
                            totalPages={totalPages}
                            onPageChange={(page) => {
                              setAvailablePage(page);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Remarks Input */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <label htmlFor="remarks" className="block text-sm font-semibold text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                    Remarks <span className="text-red-500">*</span>
                        </div>
                  </label>
                  <textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter remarks for this assignment (e.g., reason, special instructions, etc.)..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                  />
                      <div className="mt-2 flex items-start gap-2">
                        <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-gray-600">
                          This field is required. Please provide a reason or note for this assignment. This will be sent to the auditor as a notification.
                  </p>
                      </div>
                </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedAuditorId(null);
                          setRemarks('');
                        }}
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-lg font-medium transition-all duration-150 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedAuditorId || !remarks.trim() || submitting}
                        className={`px-8 py-2.5 rounded-lg font-semibold transition-all duration-150 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none ${
                      selectedAuditorId && remarks.trim() && !submitting
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Assigning...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Assign Permission
                          </span>
                        )}
                  </button>
                </div>
              </>
            )}
              </>
            )}

            {/* Assigned Auditors View */}
            {assignmentViewMode === 'assigned' && (
              <>
                {assignedAuditors.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium text-lg mb-2">
                      No Assignments Yet
                    </p>
                    <p className="text-gray-500 text-sm">
                      Start by selecting an auditor from the Available tab above.
                    </p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const totalPages = Math.ceil(assignedAuditors.length / ITEMS_PER_PAGE);
                      const startIndex = (assignedPage - 1) * ITEMS_PER_PAGE;
                      const endIndex = startIndex + ITEMS_PER_PAGE;
                      const paginatedAssigned = assignedAuditors.slice(startIndex, endIndex);
                      
                      return (
                        <>
                          <AssignedAuditorsList
                            assignedAuditors={paginatedAssigned}
                            onRemove={handleRemove}
                          />
                          
                          {/* Pagination for Assigned tab */}
                          {totalPages > 1 && (
                            <div className="mt-6">
                              <Pagination
                                currentPage={assignedPage}
                                totalPages={totalPages}
                                onPageChange={(page) => {
                                  setAssignedPage(page);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </>
            )}

            {/* Responses View - Approved & Rejected */}
            {assignmentViewMode === 'responses' && (
              <div className="space-y-6">
                {loadingResponses ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-sm text-gray-600 font-medium">Loading responses...</span>
                  </div>
                ) : (
                  <>
                    {/* Approved Assignments */}
                    <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-full bg-green-200 flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Approved Assignments</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{approvedAssignments.length} auditor(s) approved</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 bg-white">
                        {approvedAssignments.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-600 font-medium">No assignments have been approved yet.</p>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const totalPages = Math.ceil(approvedAssignments.length / ITEMS_PER_PAGE);
                              const startIndex = (approvedPage - 1) * ITEMS_PER_PAGE;
                              const endIndex = startIndex + ITEMS_PER_PAGE;
                              const paginatedApproved = approvedAssignments.slice(startIndex, endIndex);
                              
                              return (
                                <>
                                  <div className="space-y-3">
                                    {paginatedApproved.map((assignment) => {
                                      const auditor = auditors.find((a) => String(a.userId || '') === String(assignment.auditorId));
                                      return (
                                        <div 
                                          key={assignment.assignmentId} 
                                          className="bg-white border-l-4 border-green-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-green-400"
                                        >
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-4 mb-3">
                                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-base shadow-sm flex-shrink-0">
                                                  {auditor?.fullName?.charAt(0) || 'A'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-semibold text-gray-900 text-base truncate">{auditor?.fullName || 'Unknown Auditor'}</p>
                                                  <p className="text-sm text-gray-600 truncate mt-0.5">{auditor?.email || 'N/A'}</p>
                                                </div>
                                              </div>
                                              {assignment.remarks && (
                                                <div className="ml-16 mb-3 p-3 bg-green-50/50 border border-green-100 rounded-lg">
                                                  <p className="text-sm text-gray-700 leading-relaxed">
                                                    <span className="font-medium text-green-700">Remarks:</span>{' '}
                                                    <span className="text-gray-600">{assignment.remarks}</span>
                                                  </p>
                                                </div>
                                              )}
                                              <div className="ml-16 flex items-center gap-2 text-xs text-gray-500">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span className="font-medium">Assigned:</span>
                                                <span>{new Date(assignment.assignedDate).toLocaleString('vi-VN')}</span>
                                              </div>
                                            </div>
                                            <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex-shrink-0">
                                              Approved
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Pagination for Approved */}
                                  {totalPages > 1 && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                      <Pagination
                                        currentPage={approvedPage}
                                        totalPages={totalPages}
                                        onPageChange={(page) => {
                                          setApprovedPage(page);
                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Rejected Assignments */}
                    <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-full bg-red-200 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Rejected Assignments</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{rejectedAssignments.length} auditor(s) rejected</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 bg-white">
                        {rejectedAssignments.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-600 font-medium">No assignments have been rejected yet.</p>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const totalPages = Math.ceil(rejectedAssignments.length / ITEMS_PER_PAGE);
                              const startIndex = (rejectedPage - 1) * ITEMS_PER_PAGE;
                              const endIndex = startIndex + ITEMS_PER_PAGE;
                              const paginatedRejected = rejectedAssignments.slice(startIndex, endIndex);
                              
                              return (
                                <>
                                  <div className="space-y-3">
                                    {paginatedRejected.map((assignment) => {
                                      const auditor = auditors.find((a) => String(a.userId || '') === String(assignment.auditorId));
                                      const rejectionInfo = allRejections.find((r: any) => {
                                        const rejections = toArray(r.rejections);
                                        return rejections.some((rej: any) => rej.assignmentId === assignment.assignmentId);
                                      });
                                      const latestRejection = rejectionInfo ? toArray(rejectionInfo.rejections)[0] : null;
                                      return (
                                        <div 
                                          key={assignment.assignmentId} 
                                          className="bg-white border-l-4 border-red-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-red-400"
                                        >
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-4 mb-3">
                                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold text-base shadow-sm flex-shrink-0">
                                                  {auditor?.fullName?.charAt(0) || 'A'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-semibold text-gray-900 text-base truncate">{auditor?.fullName || 'Unknown Auditor'}</p>
                                                  <p className="text-sm text-gray-600 truncate mt-0.5">{auditor?.email || 'N/A'}</p>
                                                </div>
                                              </div>
                                              {latestRejection?.rejectionReason && (
                                                <div className="ml-16 mb-3 p-3 bg-red-50/50 border border-red-100 rounded-lg">
                                                  <p className="text-sm font-medium text-red-700 mb-1.5">Rejection reason:</p>
                                                  <p className="text-sm text-gray-700 leading-relaxed">{latestRejection.rejectionReason}</p>
                                                </div>
                                              )}
                                              {assignment.remarks && (
                                                <div className="ml-16 mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                  <p className="text-sm text-gray-700 leading-relaxed">
                                                    <span className="font-medium text-gray-800">Original Remarks:</span>{' '}
                                                    <span className="text-gray-600">{assignment.remarks}</span>
                                                  </p>
                                                </div>
                                              )}
                                              <div className="ml-16 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                <div className="flex items-center gap-1.5">
                                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                  </svg>
                                                  <span className="font-medium">Assigned:</span>
                                                  <span>{new Date(assignment.assignedDate).toLocaleString('vi-VN')}</span>
                                                </div>
                                                {latestRejection?.rejectedAt && (
                                                  <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    <span className="font-medium text-red-600">Rejected:</span>
                                                    <span>{new Date(latestRejection.rejectedAt).toLocaleString('vi-VN')}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <span className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex-shrink-0">
                                              Rejected
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Pagination for Rejected */}
                                  {totalPages > 1 && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                      <Pagination
                                        currentPage={rejectedPage}
                                        totalPages={totalPages}
                                        onPageChange={(page) => {
                                          setRejectedPage(page);
                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Created View - Auditors who have created plans */}
            {assignmentViewMode === 'created' && (
              <div className="space-y-6">
                {/* Created Auditors List */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b border-primary-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Created Plans</h3>
                        <p className="text-sm text-gray-600">{createdAuditors.length} auditor(s) have created plans</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {createdAuditors.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-medium text-lg mb-2">
                          {(filterStartDate || filterEndDate) ? 'No plans found for selected date range' : 'No plans created yet'}
                        </p>
                        <p className="text-gray-500 text-sm">
                          {(filterStartDate || filterEndDate)
                            ? 'Try adjusting your date filter or clear it to see all created plans.'
                            : 'Auditors will appear here once they create their first audit plan.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const totalPages = Math.ceil(createdAuditors.length / ITEMS_PER_PAGE);
                          const startIndex = (createdPage - 1) * ITEMS_PER_PAGE;
                          const endIndex = startIndex + ITEMS_PER_PAGE;
                          const paginatedCreated = createdAuditors.slice(startIndex, endIndex);
                          
                          return (
                            <>
                              <div className="space-y-4">
                                {paginatedCreated.map((item) => (
                                  <div key={item.auditorId} className="border border-primary-100 rounded-lg p-4 bg-primary-50/50 hover:bg-primary-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                                            {item.auditor?.fullName?.charAt(0) || 'A'}
                                          </div>
                                          <div>
                                            <p className="font-semibold text-gray-900">{item.auditor?.fullName || 'Unknown Auditor'}</p>
                                            <p className="text-sm text-gray-600">{item.auditor?.email || 'N/A'}</p>
                                          </div>
                                        </div>
                                        {item.auditInfo && (
                                          <div className="mt-3 pl-13 space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                              <span className="font-medium">Latest Plan:</span>
                                              <span>{item.auditInfo.title}</span>
                                            </div>
                                            {item.auditInfo.createdDate && (
                                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-medium">Created:</span>
                                                <span>{new Date(item.auditInfo.createdDate).toLocaleString('en-US')}</span>
                                              </div>
                                            )}
                                            {(item.auditInfo.startDate || item.auditInfo.endDate) && (
                                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-medium">Period:</span>
                                                <span>
                                                  {item.auditInfo.startDate 
                                                    ? new Date(item.auditInfo.startDate).toLocaleDateString('en-US')
                                                    : 'N/A'}
                                                  {' - '}
                                                  {item.auditInfo.endDate 
                                                    ? new Date(item.auditInfo.endDate).toLocaleDateString('en-US')
                                                    : 'N/A'}
                                                </span>
                                              </div>
                                            )}
                                            {item.auditInfo.planCount > 1 && (
                                              <div className="flex items-center gap-2 text-xs text-primary-600 font-medium">
                                                <span>Total Plans Created: {item.auditInfo.planCount}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <span className="px-3 py-1 bg-primary-100 text-primary-800 text-xs font-semibold rounded-full">
                                        Created
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Pagination for Created tab */}
                              {totalPages > 1 && (
                                <div className="mt-6">
                                  <Pagination
                                    currentPage={createdPage}
                                    totalPages={totalPages}
                                    onPageChange={(page) => {
                                      setCreatedPage(page);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Lead Auditor - rejected assignments overview */}
        {isLead && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Rejected plan assignments</h3>
                <p className="text-sm text-gray-500">
                  Summary of all times auditors rejected plan creation assignments.
                </p>
              </div>
              {loadingRejections && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  Loading...
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Auditor</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rejection Count</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Latest Reason</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Latest Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assignment Id</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(allRejections || []).map((item, idx) => {
                    const rejections = toArray(item.rejections);
                    const latest = rejections[0];
                    return (
                      <tr key={item.userId || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700">
                              {item.fullName ? item.fullName.charAt(0) : 'A'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{item.fullName || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{item.email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.rejectionCount ?? rejections.length ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{latest?.rejectionReason || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {latest?.rejectionDate
                            ? new Date(latest.rejectionDate).toLocaleString('vi-VN')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{latest?.assignmentId || '—'}</td>
                      </tr>
                    );
                  })}
                  {!loadingRejections && (allRejections || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        No rejection information available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </MainLayout>
  );
};

export default SpecifyCreatePlan;

