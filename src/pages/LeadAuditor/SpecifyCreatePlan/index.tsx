import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import {
  getAuditPlanAssignments,
  createAuditPlanAssignment,
  deleteAuditPlanAssignment,
  type AuditPlanAssignment,
} from '../../../api/auditPlanAssignment';
import { toast } from 'react-toastify';
import { AuditorSelectionTable } from './components/AuditorSelectionTable';
import { AssignedAuditorsList } from './components/AssignedAuditorsList';
import { useUserId } from '../../../store/useAuthStore';
import { createNotification } from '../../../api/notifications';
import { getPeriodStatus, type PeriodStatusResponse, getAuditPlans, getAuditsByPeriod } from '../../../api/audits';
import { StatCard } from '../../../components/StatCard';
import { getStatusColor } from '../../../constants/statusColors';

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
  
  // Period management state
  const [periodStartDate, setPeriodStartDate] = useState<string>('');
  const [periodEndDate, setPeriodEndDate] = useState<string>('');
  const [periodStatus, setPeriodStatus] = useState<PeriodStatusResponse | null>(null);
  const [loadingPeriodStatus, setLoadingPeriodStatus] = useState(false);
  const [assignmentsInPeriod, setAssignmentsInPeriod] = useState<AuditPlanAssignment[]>([]);
  const [loadingAssignmentsInPeriod, setLoadingAssignmentsInPeriod] = useState(false);
  const [assignmentViewMode, setAssignmentViewMode] = useState<'all' | 'assigned' | 'period'>('all');
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [auditsInPeriod, setAuditsInPeriod] = useState<any[]>([]);

  // Debug: Log when selectedAuditorId changes
  useEffect(() => {
    console.log('[SpecifyCreatePlan] selectedAuditorId changed:', selectedAuditorId);
  }, [selectedAuditorId]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

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

  // Load period status and assignments when dates change
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!periodStartDate || !periodEndDate) {
        setPeriodStatus(null);
        setAssignmentsInPeriod([]);
        setAssignmentViewMode('all'); // Reset to 'all' when no period dates
        return;
      }

      if (new Date(periodStartDate) >= new Date(periodEndDate)) {
        setPeriodStatus(null);
        setAssignmentsInPeriod([]);
        setAssignmentViewMode('all');
        return;
      }

      // Auto-switch to period view when valid dates are selected
      setAssignmentViewMode('period');

      setLoadingPeriodStatus(true);
      setLoadingAssignmentsInPeriod(true);
      
      try {
        // Load period status and audits in period (as text/plain or JSON)
        const [status, auditsData] = await Promise.all([
          getPeriodStatus(periodStartDate, periodEndDate),
          getAuditsByPeriod(periodStartDate, periodEndDate),
        ]);
        
        setPeriodStatus(status);
        
        // Unwrap response from /api/Audits/by-period
        const { unwrap } = await import('../../../utils/normalize');
        
        // Debug: Log raw response
        console.log('[SpecifyCreatePlan] Raw auditsData response:', auditsData);
        console.log('[SpecifyCreatePlan] auditsData.$values:', (auditsData as any)?.$values);
        console.log('[SpecifyCreatePlan] auditsData.$values length:', (auditsData as any)?.$values?.length);
        
        // Some environments return text/plain (string). Parse if needed.
        let parsedAuditsData: any = auditsData;
        if (typeof auditsData === 'string') {
          try {
            parsedAuditsData = JSON.parse(auditsData);
            console.log('[SpecifyCreatePlan] Parsed auditsData from string');
          } catch (err) {
            console.warn('[SpecifyCreatePlan] Failed to parse auditsData string', err);
          }
        }
        
        const auditsList = unwrap(parsedAuditsData);
        const auditsArray = Array.isArray(auditsList) ? auditsList : [];
        
        console.log('[SpecifyCreatePlan] After unwrap - auditsArray length:', auditsArray.length);
        console.log('[SpecifyCreatePlan] After unwrap - auditsArray:', auditsArray.map((a: any) => ({
          auditId: a.auditId || a.id,
          title: a.title,
          createdBy: a.createdBy,
          startDate: a.startDate,
          endDate: a.endDate,
        })));
        
        // Extract unique auditor IDs from audits (createdBy field)
        const auditorIdsFromAudits = Array.from(new Set(
          auditsArray.map((a: any) => a.createdBy).filter(Boolean)
        ));
        
        console.log('[SpecifyCreatePlan] Unique auditor IDs from audits:', auditorIdsFromAudits);
        
        // Create assignments from audits for display in-period
        const assignmentsFromAudits: AuditPlanAssignment[] = auditorIdsFromAudits.map((auditorId: string) => {
          const audit = auditsArray.find((a: any) => a.createdBy === auditorId);
          return {
            assignmentId: `audit-${auditorId}-${audit?.auditId || ''}`,
            auditorId: auditorId,
            assignBy: '', // not provided
            assignedDate: audit?.createdAt || new Date().toISOString(),
            remarks: audit?.remarks || '',
            status: audit?.status || 'Active',
          };
        });
        
        console.log('[SpecifyCreatePlan] Created assignments from audits:', assignmentsFromAudits.length);
        
        setAssignmentsInPeriod(assignmentsFromAudits);
        setAuditsInPeriod(auditsArray);
      } catch (error: any) {
        console.error('Failed to load period data', error);
        setPeriodStatus(null);
        setAssignmentsInPeriod([]);
        setAuditsInPeriod([]);
      } finally {
        setLoadingPeriodStatus(false);
        setLoadingAssignmentsInPeriod(false);
      }
    };

    // Debounce API call
    const timeoutId = setTimeout(() => {
      loadPeriodData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [periodStartDate, periodEndDate]);

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

  // Get assigned auditors in the selected period with their details and audit info
  const assignedAuditorsInPeriod = assignmentsInPeriod
    .map((assignment) => {
      const auditor = auditors.find(
        (a) => String(a.userId || '') === String(assignment.auditorId || '')
      );
      
      // Find audit created by this auditor (from audits in period)
      let auditInfo: { startDate?: string; endDate?: string } | null = null;
      if (auditsInPeriod.length > 0) {
        const audit = auditsInPeriod.find((a: any) => {
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

      const result = await createAuditPlanAssignment({
        auditorId: auditorIdForApi, // UUID string
        assignBy: assignByForApi, // UUID string
        assignedDate,
        remarks: remarksValue, // Ensure it's a non-empty string
      });

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
        await createNotification({
          userId: auditorIdForApi,
          title: 'Plan Creation Permission Assigned',
          message: `You have been granted permission to create audit plans.`,
          remarks: remarks.trim() || 'Assigned permission to create audit plans', // Use remarks from form or default message
          entityType: 'AuditPlanAssignment',
          entityId: result?.assignmentId || '',
          category: 'AuditTeam',
        });
        console.log('[SpecifyCreatePlan] Notification sent to auditor');
      } catch (notifError) {
        // Don't fail the whole operation if notification fails
        console.error('[SpecifyCreatePlan] Failed to send notification:', notifError);
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

        {/* Period Status Card */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-to-r from-primary-600 to-primary-700">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Period Status & Audit Count
              </h2>
              <p className="text-primary-100 text-sm mt-1">
                Monitor audit creation capacity for the selected period
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period Start Date
                </label>
                <input
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period End Date
                </label>
                <input
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                  min={periodStartDate || undefined}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {loadingPeriodStatus ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-3 text-sm text-gray-600 font-medium">Loading period status...</span>
              </div>
            ) : periodStatus ? (
              <div className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-gray-600 mb-3">Current Audits</p>
                    <p className="text-4xl font-bold text-primary-600">
                      {periodStatus.currentAuditCount}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-gray-600 mb-3">Max Allowed</p>
                    <p className="text-4xl font-bold text-gray-800">
                      {periodStatus.maxAuditsAllowed}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-gray-600 mb-3">Remaining</p>
                    <p className={`text-4xl font-bold ${
                      periodStatus.remainingSlots > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {periodStatus.remainingSlots}
                    </p>
                  </div>
                </div>
                
                {/* Assignment Status */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Assignment Status
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {periodStatus.canAssignNewPlans
                            ? 'You can assign auditors to create new plans'
                            : 'Cannot assign new plans. Period is active and all slots are full.'}
                        </p>
                      </div>
                      <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        periodStatus.canAssignNewPlans
                          ? getStatusColor('Approved')
                          : getStatusColor('Rejected')
                      }`}>
                        {periodStatus.canAssignNewPlans ? 'Allowed' : 'Not Allowed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Assigned</span>
                    <span className="text-sm text-gray-500">
                      {periodStatus.currentAuditCount} / {periodStatus.maxAuditsAllowed}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        periodStatus.currentAuditCount >= periodStatus.maxAuditsAllowed
                          ? 'bg-red-600'
                          : periodStatus.currentAuditCount >= periodStatus.maxAuditsAllowed * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-teal-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          (periodStatus.currentAuditCount / periodStatus.maxAuditsAllowed) * 100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : periodStartDate && periodEndDate ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Please select a valid date range (End Date must be after Start Date).
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Please select a period (Start Date and End Date) to view audit count and status.
                </p>
              </div>
            )}
          </div>
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
            <div className="flex gap-2">
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
              {periodStartDate && periodEndDate && (
                <button
                  onClick={() => setAssignmentViewMode('period')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    assignmentViewMode === 'period'
                      ? 'bg-white text-primary-700 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  In Period ({assignedAuditorsInPeriod.length})
                </button>
              )}
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
                    console.log('[SpecifyCreatePlan] onSelectionChange called with:', id);
                    setSelectedAuditorId(id);
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
            {(assignmentViewMode === 'assigned' || assignmentViewMode === 'period') && (
              <>
                {assignmentViewMode === 'period' && loadingAssignmentsInPeriod ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-sm text-gray-600 font-medium">Loading assignments...</span>
          </div>
                ) : (assignmentViewMode === 'assigned' ? assignedAuditors : assignedAuditorsInPeriod).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
        </div>
                    <p className="text-gray-700 font-medium text-lg mb-2">
                      {assignmentViewMode === 'assigned' ? 'No Assignments Yet' : 'No Assignments in This Period'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {assignmentViewMode === 'assigned'
                        ? 'Start by selecting an auditor from the Available tab above.'
                        : 'No auditors have been assigned to create plans for this period yet.'
                      }
                    </p>
              </div>
            ) : (
              <AssignedAuditorsList
                    assignedAuditors={assignmentViewMode === 'assigned' ? assignedAuditors : assignedAuditorsInPeriod}
                onRemove={handleRemove}
              />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SpecifyCreatePlan;

