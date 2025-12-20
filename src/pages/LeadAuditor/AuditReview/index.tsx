import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useEffect, useState, useMemo } from 'react';
import AuditReviewList from './components/AuditReviewList';
import { FilterBar } from './components/FilterBar';
// PlanReviewPanel previously provided inline actions; we removed inline panel to avoid duplicate UI with modal
// import PlanReviewPanel from './components/PlanReviewPanel';
import { getAuditPlanById, approveForwardDirector, declinedPlanContent, getSensitiveDepartments } from '../../../api/audits';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { normalizePlanDetails, unwrap } from '../../../utils/normalize';
import { getChecklistTemplates } from '../../../api/checklists';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { getDepartments } from '../../../api/departments';
import { getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { toast } from 'react-toastify';
import { EditScheduleAndTeamModal } from './components/EditScheduleAndTeamModal';
import { updateAuditSchedule, addAuditSchedule, deleteAuditSchedule } from '../../../api/auditSchedule';
import { addTeamMember, deleteTeamMember } from '../../../api/auditTeam';

const SQAHeadAuditReview = () => {
  const { user } = useAuth();
  const [selectedPlanFull, setSelectedPlanFull] = useState<any | null>(null);
  const [pendingPlans, setPendingPlans] = useState<any[]>([]);
  const [pendingDirectorPlans, setPendingDirectorPlans] = useState<any[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<any[]>([]);
  const [rejectedPlans, setRejectedPlans] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'pending-director' | 'approved' | 'rejected'>('pending');
  const [showEditScheduleTeamModal, setShowEditScheduleTeamModal] = useState(false);
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<{
    schedules: any[];
    teamMembers: any[];
  } | null>(null);

  // Filter state
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [sortDateOrder, setSortDateOrder] = useState<string>('desc'); // Default: newest first
  const [filterStatus, setFilterStatus] = useState<string>('');

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const loadPlans = async () => {
    setLoading(true);
    try {
  // fetch plans, admin users, departments, criteria, and checklist templates in parallel
  const [resPlans, adminUsers, deptsRes, critRes, templatesRes] = await Promise.all([
    getPlansWithDepartments(), 
    getAdminUsers(), 
    getDepartments(), 
    getAuditCriteria(),
    getChecklistTemplates()
  ]);

  // normalize list wrapper variations (array | { $values: [] } | { values: [] })
  let list: any = unwrap(resPlans);

      // Split into Pending, Approved, Rejected
      // Improved logic to distinguish between:
      // - PendingReview: Waiting for Lead Auditor review
      // - PendingDirectorApproval: Waiting for Director approval (already forwarded)
      // - Approved/InProgress: Director has approved
      // - Rejected: Director has rejected
      const isPending = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        // Only plans waiting for Lead Auditor review (not yet forwarded to Director)
        return v.includes('pendingreview') && !v.includes('pendingdirector');
      };
      const isPendingDirectorApproval = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        // Plans forwarded to Director, waiting for approval/rejection
        return v.includes('pendingdirectorapproval') || v.includes('pendingdirector');
      };
      const isApproved = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        // Director has approved - status is Approved or InProgress (after Director approval)
        // Exclude PendingDirectorApproval (that's still waiting)
        const isApprovedStatus = (v === 'approved' || v === 'approve') && !v.includes('pending');
        const isInProgress = (v === 'inprogress' || v === 'in progress');
        return isApprovedStatus || isInProgress;
      };
      const isRejected = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        // Director has rejected
        return v === 'rejected' || (v.includes('reject') && !v.includes('pending'));
      };
      
      const pending = list.filter((p: any) => isPending(p.status || p.state));
      const pendingDirector = list.filter((p: any) => isPendingDirectorApproval(p.status || p.state));
      const approved = list.filter((p: any) => isApproved(p.status || p.state));
      const rejected = list.filter((p: any) => isRejected(p.status || p.state));
      // normalize departments list from API
      const deptList = Array.isArray(deptsRes)
        ? deptsRes.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
        : [];
      setDepartments(deptList);

      // Normalize each plan for display in the list: derive department names if possible
      // Build deptMap with multiple possible id keys so lookups by numeric id or $id both work
      const deptMap = (Array.isArray(deptList) ? deptList : []).reduce((acc: any, d: any) => {
        const name = d.name || d.deptName || d.code || String(d.deptId ?? d.$id ?? d.id ?? '');
        const keys = [d.deptId, d.$id, d.id].filter(Boolean);
        keys.forEach((k: any) => {
          acc[String(k)] = name;
        });
        // also index by the stringified numeric deptId if present
        if (d.deptId !== undefined && d.deptId !== null) {
          acc[String(Number(d.deptId))] = name;
        }
        return acc;
      }, {} as any);

      // build user map from adminUsers so we can resolve submitter/creator names
      const users = Array.isArray(adminUsers) ? adminUsers : [];
      const userMap = users.reduce((acc: any, u: any) => {
        const keys = [u.userId, u.id, u.$id, u.email, u.fullName].filter(Boolean).map((k: any) => String(k).toLowerCase());
        keys.forEach((k: string) => (acc[k] = u));
        return acc;
      }, {} as any);

      const normalizeForList = (p: any) => {
        const scopeArr = unwrap(p.scopeDepartments || p.scope || p.scopeDepartment);
        const deptNames = (scopeArr || [])
          .map((d: any) => d.deptName || deptMap[String(d.deptId ?? d.id ?? d.$id ?? d.departmentId ?? d.deptCode)] || d.deptId || d.id || d.$id || d.departmentId || d.deptCode || d.name || String(d))
          .filter(Boolean);

        let finalDeptNames = deptNames.length > 0 ? deptNames : [];
        if (finalDeptNames.length === 0 && p.department) {
          // p.department might be an id; try to resolve using deptMap
          const lookup = deptMap[String(p.department)];
          if (lookup) finalDeptNames = [lookup];
          else finalDeptNames = [p.department];
        }

        // no debug logs; keep fallback behavior

        // Resolve createdBy/submittedBy to a user object (fullName) when possible
        let createdByUser = p.createdByUser;
        // If createdByUser is a primitive id/string, try to look up
        if (createdByUser && typeof createdByUser === 'string') {
          const lookup = userMap[String(createdByUser).toLowerCase()];
          if (lookup) createdByUser = lookup;
          else createdByUser = { fullName: createdByUser };
        }
        // If no createdByUser, try p.createdBy or p.submittedBy or p.submittedByUser
        if (!createdByUser) {
          const candidate = p.createdBy || p.submittedBy || p.submittedByUser;
          if (candidate) {
            const lookup = userMap[String(candidate).toLowerCase()];
            createdByUser = lookup || { fullName: String(candidate) };
          }
        }

        return {
          ...p,
          department: finalDeptNames.length > 0 ? finalDeptNames.join(', ') : 'N/A',
          scopeDepartments: scopeArr,
          createdByUser,
        };
      };

      const pendingNormalized = pending.map(normalizeForList);
      const pendingDirectorNormalized = pendingDirector.map(normalizeForList);
      const approvedNormalized = approved.map(normalizeForList);
      const rejectedNormalized = rejected.map(normalizeForList);
      
      // Sort by newest first (by createdAt or startDate)
      const sortByNewest = (a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA; // Newest first
      };
      
      // Store all plans (will be filtered later)
      setPendingPlans(pendingNormalized.sort(sortByNewest));
      setPendingDirectorPlans(pendingDirectorNormalized.sort(sortByNewest));
      setApprovedPlans(approvedNormalized.sort(sortByNewest));
      setRejectedPlans(rejectedNormalized.sort(sortByNewest));
      const usersArr = Array.isArray(adminUsers) ? adminUsers : [];
      const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
      const auditors = usersArr.filter((u: any) => norm(u.roleName) === 'auditor');
      const owners = usersArr.filter((u: any) => norm(u.roleName) === 'auditeeowner');
      setOwnerOptions(owners);
      setAuditorOptions(auditors);
      setCriteriaList(Array.isArray(critRes) ? critRes : []);
      setChecklistTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    } catch (err) {
      console.error('Failed to load audit plans for review', err);
      setPendingPlans([]);
      setPendingDirectorPlans([]);
      setApprovedPlans([]);
      setRejectedPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  // Filter and sort plans based on filter criteria
  const filteredPendingPlans = useMemo(() => {
    let filtered = pendingPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [pendingPlans, filterDepartment, sortDateOrder, filterStatus]);

  const filteredApprovedPlans = useMemo(() => {
    let filtered = approvedPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [approvedPlans, filterDepartment, sortDateOrder, filterStatus]);

  const filteredRejectedPlans = useMemo(() => {
    let filtered = rejectedPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [rejectedPlans, filterDepartment, sortDateOrder, filterStatus]);

  // Filter for pending director plans
  const filteredPendingDirectorPlans = useMemo(() => {
    let filtered = pendingDirectorPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [pendingDirectorPlans, filterDepartment, sortDateOrder, filterStatus]);

  // Get current filtered plans based on active tab
  const currentFilteredPlans = 
    activeTab === 'pending' ? filteredPendingPlans :
    activeTab === 'pending-director' ? filteredPendingDirectorPlans :
    activeTab === 'approved' ? filteredApprovedPlans :
    filteredRejectedPlans;
  
  const currentTotalPlans = 
    activeTab === 'pending' ? pendingPlans.length :
    activeTab === 'pending-director' ? pendingDirectorPlans.length :
    activeTab === 'approved' ? approvedPlans.length :
    rejectedPlans.length;

  // Clear all filters
  const clearFilters = () => {
    setFilterDepartment('');
    setSortDateOrder('desc'); // Reset to default: newest first
    setFilterStatus('');
  };

  const handleForwardToDirector = async (auditId: string, comment?: string) => {
    try {
      await approveForwardDirector(auditId, { comment });
      await loadPlans();
      toast.success('Plan forwarded to Director successfully.');
      setSelectedPlanFull(null);
    } catch (err: any) {
      console.error('Failed to forward to director', err);
      alert('Failed to forward to Director: ' + (err?.response?.data?.message || err?.message || String(err)));
    }
  };

  const handleReject = async (auditId: string, comment?: string) => {
    try {
      // Include pending changes in rejection comment if any
      let rejectionComment = comment || '';
      if (pendingChanges && (pendingChanges.schedules.length > 0 || pendingChanges.teamMembers.length > 0)) {
        const changesSummary: string[] = [];
        
        if (pendingChanges.schedules.length > 0) {
          changesSummary.push('\n\nSchedule Changes:');
          pendingChanges.schedules.forEach((change: any) => {
            if (change.action === 'add') {
              changesSummary.push(`- Added: ${change.data?.milestoneName} (Due: ${change.data?.dueDate})`);
            } else if (change.action === 'update') {
              changesSummary.push(`- Updated: ${change.data?.milestoneName} (Due: ${change.data?.dueDate})`);
            } else if (change.action === 'delete') {
              changesSummary.push(`- Deleted: Schedule ID ${change.scheduleId}`);
            }
          });
        }
        
        if (pendingChanges.teamMembers.length > 0) {
          changesSummary.push('\nTeam Changes:');
          pendingChanges.teamMembers.forEach((change: any) => {
            if (change.action === 'add') {
              changesSummary.push(`- Added: User ID ${change.data?.userId} (Role: ${change.data?.roleInTeam})`);
            } else if (change.action === 'delete') {
              changesSummary.push(`- Removed: Team Member ID ${change.teamId}`);
            }
          });
        }
        
        rejectionComment = (comment || '') + changesSummary.join('\n');
      }
      
      // Lead Auditor declines the plan content (separate endpoint from Director reject)
      await declinedPlanContent(auditId, { comment: rejectionComment });
      await loadPlans();
      toast.success('Plan rejected successfully.');
      setSelectedPlanFull(null);
      setPendingChanges(null);
    } catch (err: any) {
      console.error('Failed to reject plan', err);
      const errorMessage =
        err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to reject plan: ' + errorMessage);
    }
  };

  const handleEditScheduleAndTeam = (auditId: string) => {
    setEditingAuditId(auditId);
    setShowEditScheduleTeamModal(true);
  };

  const handleSaveScheduleAndTeam = async (changes: {
    schedules: Array<{ scheduleId?: string; action: 'add' | 'update' | 'delete'; data?: any }>;
    teamMembers: Array<{ teamId?: string; action: 'add' | 'delete'; data?: any }>;
  }) => {
    if (!editingAuditId) return;

    try {
      // Apply schedule changes
      for (const scheduleChange of changes.schedules) {
        if (scheduleChange.action === 'add') {
          await addAuditSchedule({
            auditId: editingAuditId,
            milestoneName: scheduleChange.data!.milestoneName,
            dueDate: scheduleChange.data!.dueDate,
            notes: scheduleChange.data!.notes || '',
            status: scheduleChange.data!.status || 'Pending',
          });
        } else if (scheduleChange.action === 'update' && scheduleChange.scheduleId) {
          await updateAuditSchedule(scheduleChange.scheduleId, {
            milestoneName: scheduleChange.data!.milestoneName,
            dueDate: scheduleChange.data!.dueDate,
            notes: scheduleChange.data!.notes || '',
            status: scheduleChange.data!.status || 'Pending',
          });
        } else if (scheduleChange.action === 'delete' && scheduleChange.scheduleId) {
          await deleteAuditSchedule(scheduleChange.scheduleId);
        }
      }

      // Apply team changes
      for (const teamChange of changes.teamMembers) {
        if (teamChange.action === 'add') {
          await addTeamMember({
            auditId: editingAuditId,
            userId: teamChange.data!.userId,
            roleInTeam: teamChange.data!.roleInTeam || 'Auditor',
            isLead: teamChange.data!.isLead || false,
          });
        } else if (teamChange.action === 'delete' && teamChange.teamId) {
          await deleteTeamMember(teamChange.teamId);
        }
      }

      // Store changes for potential rejection
      setPendingChanges({
        schedules: changes.schedules,
        teamMembers: changes.teamMembers,
      });

      // Reload plan details to show updated data
      if (selectedPlanFull && String(selectedPlanFull.auditId || selectedPlanFull.id) === editingAuditId) {
        await handleSelectPlan(editingAuditId);
      }

      toast.success('Schedule and team updated successfully');
    } catch (error: any) {
      console.error('Failed to save schedule and team changes:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to save changes');
      throw error;
    }
  };

  const handleSelectPlan = async (auditId: string) => {
    setLoading(true);
    try {
      // Fetch plan details, schedules, and sensitive areas in parallel
      const [details, schedulesResponse, sensitiveDeptsResponse] = await Promise.allSettled([
        getAuditPlanById(auditId),
        getAuditSchedules(auditId),
        getSensitiveDepartments(auditId),
      ]);

      // Extract successful responses
      const detailsData = details.status === 'fulfilled' ? details.value : null;
      const schedulesData = schedulesResponse.status === 'fulfilled' 
        ? { values: unwrap(schedulesResponse.value) || [] }
        : { values: [] };
      const sensitiveDepts = sensitiveDeptsResponse.status === 'fulfilled' 
        ? sensitiveDeptsResponse.value 
        : [];

      // Process sensitive areas
      let sensitiveFlag = false;
      let sensitiveAreas: string[] = [];
      let sensitiveAreasByDept: Record<number, string[]> = {};

      if (sensitiveDepts && sensitiveDepts.length > 0) {
        sensitiveFlag = sensitiveDepts.some((sd: any) => sd.sensitiveFlag === true);
        const allAreas = new Set<string>();

        sensitiveDepts.forEach((sd: any) => {
          const deptId = Number(sd.deptId);
          let areasArray: string[] = [];

          // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
          if (Array.isArray(sd.Areas)) {
            areasArray = sd.Areas;
          } else if (sd.Areas && typeof sd.Areas === 'string') {
            try {
              const parsed = JSON.parse(sd.Areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
            } catch {
              areasArray = [sd.Areas];
            }
          } else if (sd.Areas && typeof sd.Areas === 'object' && sd.Areas.$values) {
            areasArray = Array.isArray(sd.Areas.$values) ? sd.Areas.$values : [];
          } else if (Array.isArray(sd.areas)) {
            areasArray = sd.areas;
          } else if (sd.areas && typeof sd.areas === 'string') {
            try {
              const parsed = JSON.parse(sd.areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
            } catch {
              areasArray = [sd.areas];
            }
          } else if (sd.areas && typeof sd.areas === 'object' && sd.areas.$values) {
            areasArray = Array.isArray(sd.areas.$values) ? sd.areas.$values : [];
          }

          // Store areas by deptId
          if (deptId && areasArray.length > 0) {
            sensitiveAreasByDept[deptId] = areasArray
              .filter((area: string) => area && typeof area === 'string' && area.trim())
              .map((a: string) => a.trim());
          }

          areasArray.forEach((area: string) => {
            if (area && typeof area === 'string' && area.trim()) {
              allAreas.add(area.trim());
            }
          });
        });

        sensitiveAreas = Array.from(allAreas);
      }

      if (!detailsData) {
        throw new Error('Failed to load plan details');
      }

      // Merge schedules into details if not already present
      const detailsWithSchedules = {
        ...detailsData,
        schedules: detailsData.schedules || schedulesData,
      };

      const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
      const normalized = normalizePlanDetails(detailsWithSchedules, { 
        departments: departments || [], 
        criteriaList: criteriaList || [], 
        users: allUsers 
      });

      // Add sensitive areas data to normalized details
      const normalizedWithSensitive = {
        ...normalized,
        sensitiveFlag,
        sensitiveAreas,
        sensitiveAreasByDept,
      };

      setSelectedPlanFull(normalizedWithSensitive);

      // update plans list with department name derived from normalized details
      const deptNames = ((normalized.scopeDepartments?.values || []) as any).map((d: any) => d.deptName || d.name).filter(Boolean);
      setPendingPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setPendingDirectorPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setApprovedPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setRejectedPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
    } catch (err) {
      console.error('Failed to load plan details', err);
      alert('Unable to load plan details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    total: pendingPlans.length + pendingDirectorPlans.length + approvedPlans.length + rejectedPlans.length,
    pending: pendingPlans.length,
    pendingDirector: pendingDirectorPlans.length,
    approved: approvedPlans.length,
    rejected: rejectedPlans.length,
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary-600">Audit Review</h1>
            <p className="text-gray-600 text-sm mt-1">Review and approve audit plans submitted by Auditor</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Plans</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Director</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingDirector}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Director Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Director Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-primary-100">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setActiveTab('pending-director')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'pending-director'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pending Director <span className="ml-1">({stats.pendingDirector})</span>
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'approved'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Director Approved ({stats.approved})
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'rejected'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Director Rejected ({stats.rejected})
              </button>
            </div>
          </div>
        </div>

        {!selectedPlanFull ? (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
              <h2 className="text-lg font-semibold text-white">
                {activeTab === 'pending' ? 'Pending Audit Plans' : 
                 activeTab === 'pending-director' ? 'Pending Director Approval' :
                 activeTab === 'approved' ? 'Director Approved Plans' : 
                 'Director Rejected Plans'}
              </h2>
            </div>

            <FilterBar
              filterDepartment={filterDepartment}
              sortDateOrder={sortDateOrder}
              filterStatus={filterStatus}
              departments={departments}
              onFilterDepartmentChange={setFilterDepartment}
              onSortDateOrderChange={setSortDateOrder}
              onFilterStatusChange={setFilterStatus}
              onClearFilters={clearFilters}
              filteredCount={currentFilteredPlans.length}
              totalCount={currentTotalPlans}
            />

            <AuditReviewList
              title={activeTab === 'pending' ? 'Pending Audit Plans' : 
                     activeTab === 'pending-director' ? 'Pending Director Approval' :
                     activeTab === 'approved' ? 'Director Approved Plans' : 
                     'Director Rejected Plans'}
              plans={currentFilteredPlans}
              onSelect={(id) => void handleSelectPlan(id)}
              getDepartmentName={(id:any)=> getDepartmentName(id, departments)}
            />
            {loading && <p className="text-sm text-gray-500 mt-2 px-6 pb-4">Loading...</p>}
          </div>
        ) : (
          <>
            {/* Show the auditor modal UI so Lead Auditor sees identical details */}
            <PlanDetailsModal
              showModal={true}
              selectedPlanDetails={selectedPlanFull}
              onClose={() => {
                setSelectedPlanFull(null);
                setPendingChanges(null);
              }}
              // Chỉ cho phép hành động khi bất kỳ field status nào chứa PendingReview
              {
                ...(() => {
                  const normalize = (s: any) =>
                    String(s || '')
                      .toLowerCase()
                      .replace(/\s+/g, '');

                  const candidates = [
                    selectedPlanFull?.status,
                    selectedPlanFull?.state,
                    selectedPlanFull?.approvalStatus,
                    selectedPlanFull?.statusName,
                  ];

                  const isPendingReview = candidates.some((s) =>
                    normalize(s).includes('pendingreview')
                  );

                  const auditId = selectedPlanFull?.auditId || selectedPlanFull?.id;
                  
                  return isPendingReview
                    ? { 
                        onForwardToDirector: handleForwardToDirector, 
                        onRejectPlan: handleReject,
                        onEditScheduleAndTeam: auditId ? () => handleEditScheduleAndTeam(String(auditId)) : undefined,
                      }
                    : {};
                })()
              }
              getCriterionName={(id: any) => String(id)}
              getDepartmentName={(id: any) => getDepartmentName(id, departments)}
              getStatusColor={getStatusColor}
              getBadgeVariant={getBadgeVariant}
              ownerOptions={ownerOptions}
              auditorOptions={auditorOptions}
              getTemplateName={(tid) => {
                const t = checklistTemplates.find((tpl: any) => String(tpl.templateId) === String(tid));
                return  t?.name || `Template ${String(tid ?? '')}`;
              }}
            />
            {/* Inline review panel removed to avoid duplicate UI behind the modal. Actions are available in the modal. */}
          </>
        )}

        {/* Edit Schedule & Team Modal */}
        {showEditScheduleTeamModal && editingAuditId && (
          <EditScheduleAndTeamModal
            showModal={showEditScheduleTeamModal}
            auditId={editingAuditId}
            onClose={() => {
              setShowEditScheduleTeamModal(false);
              setEditingAuditId(null);
            }}
            onSave={handleSaveScheduleAndTeam}
            originalSchedules={selectedPlanFull?.schedules?.values || []}
            originalTeamMembers={selectedPlanFull?.auditTeams?.values || []}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default SQAHeadAuditReview;
