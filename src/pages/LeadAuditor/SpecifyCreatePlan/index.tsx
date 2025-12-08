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
import { getPeriodStatus, type PeriodStatusResponse } from '../../../api/audits';

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

  // Debug: Log when selectedAuditorId changes
  useEffect(() => {
    console.log('[SpecifyCreatePlan] selectedAuditorId changed:', selectedAuditorId);
  }, [selectedAuditorId]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load auditors and existing assignments
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [usersData, assignmentsData] = await Promise.all([
          getAdminUsers(),
          getAuditPlanAssignments(),
        ]);

        // Filter only auditors
        const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
        const auditorList = (usersData || []).filter(
          (u: AdminUserDto) => norm(u.roleName || '') === 'auditor'
        );

        setAuditors(auditorList);
        setAllUsers(usersData || []); // Store all users for finding LeadAuditor userId
        setAssignments(assignmentsData || []);
        
        // Debug: Log assignment data to see format
        console.log('[SpecifyCreatePlan] Loaded assignments:', assignmentsData);
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

  // Load period status when dates change
  useEffect(() => {
    const loadPeriodStatus = async () => {
      if (!periodStartDate || !periodEndDate) {
        setPeriodStatus(null);
        return;
      }

      if (new Date(periodStartDate) >= new Date(periodEndDate)) {
        setPeriodStatus(null);
        return;
      }

      setLoadingPeriodStatus(true);
      try {
        const status = await getPeriodStatus(periodStartDate, periodEndDate);
        setPeriodStatus(status);
      } catch (error: any) {
        console.error('Failed to load period status', error);
        setPeriodStatus(null);
      } finally {
        setLoadingPeriodStatus(false);
      }
    };

    // Debounce API call
    const timeoutId = setTimeout(() => {
      loadPeriodStatus();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [periodStartDate, periodEndDate]);

  // Get assigned auditor IDs (convert to strings for comparison)
  const assignedAuditorIds = assignments.map((a) => String(a.auditorId));

  // Get available auditors (not yet assigned)
  const availableAuditors = auditors.filter(
    (a) => !assignedAuditorIds.includes(String(a.userId || ''))
  );

  // Get assigned auditors with their details
  const assignedAuditors = assignments
    .map((assignment) => {
      // Compare as strings since both are GUID strings
      const auditor = auditors.find(
        (a) => String(a.userId || '') === String(assignment.auditorId || '')
      );
      return auditor ? { ...assignment, auditor } : null;
    })
    .filter(Boolean) as Array<AuditPlanAssignment & { auditor: AdminUserDto }>;

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
        {/* Period Status Card */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">
              Period Status & Audit Count
            </h2>
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
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading period status...</span>
              </div>
            ) : periodStatus ? (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Audits</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {periodStatus.currentAuditCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Max Allowed</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {periodStatus.maxAuditsAllowed}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Remaining Slots</p>
                    <p className={`text-2xl font-bold ${
                      periodStatus.remainingSlots > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {periodStatus.remainingSlots}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      periodStatus.isExpired
                        ? 'bg-yellow-100 text-yellow-800'
                        : periodStatus.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {periodStatus.isExpired
                        ? 'Expired'
                        : periodStatus.isActive
                        ? 'Active'
                        : 'Upcoming'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Can Assign New Plans
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {periodStatus.canAssignNewPlans
                          ? 'Lead Auditor can assign auditors to create new plans'
                          : 'Cannot assign new plans. Period is active and slots are full.'}
                      </p>
                    </div>
                    <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      periodStatus.canAssignNewPlans
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {periodStatus.canAssignNewPlans ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-500">
                      {periodStatus.currentAuditCount} / {periodStatus.maxAuditsAllowed}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        periodStatus.currentAuditCount >= periodStatus.maxAuditsAllowed
                          ? 'bg-red-500'
                          : periodStatus.currentAuditCount >= periodStatus.maxAuditsAllowed * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
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

        {/* Available Auditors Section */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">
              Available Auditors
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="mt-2 text-gray-600">Loading auditors...</p>
              </div>
            ) : availableAuditors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                All auditors have been assigned plan creation permission.
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
                <div className="mt-6">
                  <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks for this assignment..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This field is required. Please provide a reason or note for this assignment.
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleAssign}
                    disabled={!selectedAuditorId || !remarks.trim() || submitting}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                      selectedAuditorId && remarks.trim() && !submitting
                        ? 'bg-primary-600 hover:bg-primary-700 text-white cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Assigned Auditors Section */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">
              Assigned Auditors ({assignedAuditors.length})
            </h2>
          </div>

          <div className="p-6">
            {assignedAuditors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No auditors have been assigned plan creation permission yet.
              </div>
            ) : (
              <AssignedAuditorsList
                assignedAuditors={assignedAuditors}
                onRemove={handleRemove}
              />
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SpecifyCreatePlan;

