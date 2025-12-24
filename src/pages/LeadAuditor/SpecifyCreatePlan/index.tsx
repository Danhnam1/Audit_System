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

type AssignmentViewMode = 'all' | 'assigned' | 'responses' | 'created';

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
  // Date filter for Created tab
  const [createdDate, setCreatedDate] = useState<string>('');



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
        
        if (assignmentsData && assignmentsData.length > 0) {
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
        const approved = allAssignments.filter((a: AuditPlanAssignment) => 
          String(a.status || '').toLowerCase() === 'approved'
        );
        const rejected = allAssignments.filter((a: AuditPlanAssignment) => 
          String(a.status || '').toLowerCase() === 'rejected'
        );
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
  }, [assignmentViewMode]);

  // Get assigned auditor IDs (convert to strings for comparison)
  const assignedAuditorIds = assignments.map((a) => String(a.auditorId));

  // Get available auditors (not yet assigned)
  const availableAuditors = auditors.filter(
    (a) => !assignedAuditorIds.includes(String(a.userId || ''))
  );

  // Get assigned auditors with their details and audit info (dedupe by auditorId, keep latest assignedDate)
  const assignedAuditors = (() => {
    // Sort by assignedDate desc then pick first per auditorId
    const sorted = [...assignments].sort(
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
    if (createdDate) {
      filteredAuditsByAuditor = new Map<string, any[]>();
      auditsByAuditor.forEach((audits, auditorId) => {
        const filteredAudits = audits.filter((audit: any) => {
          const auditCreatedDate = audit.createdDate || audit.createdAt || audit.startDate || audit.periodFrom || audit.PeriodFrom;
          if (!auditCreatedDate) return false;
          
          const auditDate = new Date(auditCreatedDate);
          const filterDate = new Date(createdDate);
          // Filter: show audits created on or after the selected date
          return auditDate >= filterDate;
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
      }

      const result = await createAuditPlanAssignment(assignmentPayload);


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

            {/* Tabs for switching views */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setAssignmentViewMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'all'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Available ({availableAuditors.length})
              </button>
              <button
                onClick={() => setAssignmentViewMode('assigned')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'assigned'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Assigned ({assignedAuditors.length})
              </button>
              <button
                onClick={() => setAssignmentViewMode('responses')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'responses'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Responses ({approvedAssignments.length + rejectedAssignments.length})
              </button>
              <button
                onClick={() => setAssignmentViewMode('created')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  assignmentViewMode === 'created'
                    ? 'bg-white text-primary-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Created ({createdAuditors.length})
              </button>
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
                <AuditorSelectionTable
                  auditors={availableAuditors}
                  selectedAuditorId={selectedAuditorId}
                  onSelectionChange={(id) => {
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
                  <AssignedAuditorsList
                    assignedAuditors={assignedAuditors}
                    onRemove={handleRemove}
                  />
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
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Approved Assignments</h3>
                            <p className="text-sm text-gray-600">{approvedAssignments.length} auditor(s) approved</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        {approvedAssignments.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No assignments have been approved yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {approvedAssignments.map((assignment) => {
                              const auditor = auditors.find((a) => String(a.userId || '') === String(assignment.auditorId));
                              return (
                                <div key={assignment.assignmentId} className="border border-green-100 rounded-lg p-4 bg-green-50/50 hover:bg-green-50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold">
                                          {auditor?.fullName?.charAt(0) || 'A'}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-gray-900">{auditor?.fullName || 'Unknown Auditor'}</p>
                                          <p className="text-sm text-gray-600">{auditor?.email || 'N/A'}</p>
                                        </div>
                                      </div>
                                      {assignment.remarks && (
                                        <p className="text-sm text-gray-700 mt-2 pl-13">
                                          <span className="font-medium">Remarks:</span> {assignment.remarks}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-2 pl-13">
                                        Assigned: {new Date(assignment.assignedDate).toLocaleString('vi-VN')}
                                      </p>
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                      Approved
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rejected Assignments */}
                    <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Rejected Assignments</h3>
                            <p className="text-sm text-gray-600">{rejectedAssignments.length} auditor(s) rejected</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        {rejectedAssignments.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No assignments have been rejected yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {rejectedAssignments.map((assignment) => {
                              const auditor = auditors.find((a) => String(a.userId || '') === String(assignment.auditorId));
                              const rejectionInfo = allRejections.find((r: any) => {
                                const rejections = toArray(r.rejections);
                                return rejections.some((rej: any) => rej.assignmentId === assignment.assignmentId);
                              });
                              const latestRejection = rejectionInfo ? toArray(rejectionInfo.rejections)[0] : null;
                              return (
                                <div key={assignment.assignmentId} className="border border-red-100 rounded-lg p-4 bg-red-50/50 hover:bg-red-50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold">
                                          {auditor?.fullName?.charAt(0) || 'A'}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-gray-900">{auditor?.fullName || 'Unknown Auditor'}</p>
                                          <p className="text-sm text-gray-600">{auditor?.email || 'N/A'}</p>
                                        </div>
                                      </div>
                                      {latestRejection?.rejectionReason && (
                                        <div className="mt-3 pl-13 p-3 bg-white rounded border border-red-200">
                                          <p className="text-sm font-medium text-gray-900 mb-1">Rejection reason:</p>
                                          <p className="text-sm text-gray-700">{latestRejection.rejectionReason}</p>
                                        </div>
                                      )}
                                      {assignment.remarks && (
                                        <p className="text-sm text-gray-600 mt-2 pl-13">
                                          <span className="font-medium">Original Remarks:</span> {assignment.remarks}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-2 pl-13">
                                        Assigned: {new Date(assignment.assignedDate).toLocaleString('vi-VN')}
                                        {latestRejection?.rejectedAt && (
                                          <> • Rejected: {new Date(latestRejection.rejectedAt).toLocaleString('vi-VN')}</>
                                        )}
                                      </p>
                                    </div>
                                    <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                                      Rejected
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
                {/* Date Filter Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Creation Date</h3>
                  <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Creation Date
                    </label>
                    <input
                      type="date"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  {createdDate && (
                    <button
                      onClick={() => {
                        setCreatedDate('');
                      }}
                      className="mt-4 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

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
                          {createdDate ? 'No plans found for selected creation date' : 'No plans created yet'}
                        </p>
                        <p className="text-gray-500 text-sm">
                          {createdDate 
                            ? 'Try adjusting your creation date filter or clear it to see all created plans.'
                            : 'Auditors will appear here once they create their first audit plan.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {createdAuditors.map((item) => (
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

