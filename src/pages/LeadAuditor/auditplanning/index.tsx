import { MainLayout } from '../../../layouts';
import { PageHeader } from '../../../components';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import type { AuditPlan, AuditPlanDetails } from '../../../types/auditPlan';
import { getChecklistTemplates } from '../../../api/checklists';
import { 
  getAuditPlanById,
  getAuditApprovals,
  approveForwardDirector,
  declinedPlanContent,
  getSensitiveDepartments,
} from '../../../api/audits';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAuditTeam } from '../../../api/auditTeam';
import { getDepartments } from '../../../api/departments';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { unwrap, normalizePlanDetails } from '../../../utils/normalize';
import { useUserId } from '../../../store/useAuthStore';

// Import custom hooks
import { useAuditPlanFilters } from '../../../hooks/useAuditPlanFilters';

// Import helper functions
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor } from '../../../constants';
import { getCriterionName, getDepartmentName } from '../../../helpers/auditPlanHelpers';

// Import components
import { FilterBar } from './components/FilterBar';
import { PlanTable } from './components/PlanTable';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';

// Lead Auditor sees plans in review / execution flow, including rejected states:
// - PendingReview            : waiting Lead review (submitted by Auditor)
// - PendingDirectorApproval  : already forwarded to Director
// - InProgress               : audit is being executed
// - Approved                 : approved by Director
// - Declined                 : rejected by Lead Auditor
// - Rejected                 : rejected by Director
// Note: Draft plans are created by Auditors, not Lead Auditors
const LEAD_AUDITOR_VISIBLE_STATUSES = [
  'pendingreview',
  'pendingdirectorapproval',
  'inprogress',
  'approved',
  'declined',
  'rejected',
];

const LeadAuditorAuditPlanning = () => {
  const { user } = useAuth();
  const currentUserId = useUserId();

  // Data fetching states
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  // UI: tabs for plans when more than pageSize
  const [activePlansTab, setActivePlansTab] = useState<number>(1);
  const pageSize = 10;


  // All users for permission checks (Lead Auditor doesn't need permission check, but keep for consistency)
  const [, setAllUsers] = useState<any[]>([]);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);

  // Lead Auditor can see all plans (no filtering by user)
  // Only show plans that are submitted for review (not Draft - those are created by Auditors)
  const visiblePlans = useMemo(() => {
    return existingPlans.filter((plan) => {
      const normStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
      return LEAD_AUDITOR_VISIBLE_STATUSES.includes(normStatus);
    });
  }, [existingPlans]);

  // Use filter hook limited to visible statuses
  const filterState = useAuditPlanFilters(visiblePlans);

  


  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Ensure departments are loaded for filters and modals
  const ensureDepartmentsLoaded = async (): Promise<Array<{ deptId: number | string; name: string }>> => {
    if (departments && departments.length > 0) return departments;
    try {
      const res: any = await getDepartments();
      const list = (res || []).map((d: any) => ({
        deptId: d.deptId ?? d.$id ?? d.id,
        name: d.name || d.code || '—',
      }));
      setDepartments(list);
      return list;
    } catch (err) {
      console.error('ensureDepartmentsLoaded: failed to load departments', err);
      return departments;
    }
  };


  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getChecklistTemplates();
        setChecklistTemplates(Array.isArray(data) ? data : []);

        try {
          const crit = await getAuditCriteria();
          setCriteria(Array.isArray(crit) ? crit : []);
        } catch (e) {
          console.error('Failed to load audit criteria', e);
        }

        try {
          const users = await getAdminUsers();
          setAllUsers(Array.isArray(users) ? users : []);
          const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
          const auditors = (users || []).filter((u: any) => norm(u.roleName) === 'auditor');
          const owners = (users || []).filter((u: any) => norm(u.roleName) === 'auditeeowner');
          setAuditorOptions(auditors);
          setOwnerOptions(owners);
        } catch (e) {
          console.error('Failed to load users for team', e);
        }

      } catch (err) {
        console.error('Failed to load checklist templates', err);
      }
    };
    load();
  }, []);

  // Load departments for filter
  useEffect(() => {
    const loadDepartmentsForFilter = async () => {
      if (departments.length === 0) {
        await ensureDepartmentsLoaded();
      }
    };
    loadDepartmentsForFilter();
  }, []);

  // Load audit plans
  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const merged = await getPlansWithDepartments();
      
      // Enrich plans with rejectedBy information for rejected/declined plans
      // Backend sets status to "Declined" when Lead Auditor rejects
      // Backend sets status to "Rejected" when Director rejects
      const enrichedPlans = merged.map((plan: any) => {
        const planStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
        if (planStatus === 'declined') {
          return { ...plan, rejectedBy: 'Lead Auditor' };
        } else if (planStatus === 'rejected') {
          return { ...plan, rejectedBy: 'Director' };
        }
        return plan;
      });
      
      setExistingPlans(enrichedPlans);
    } catch (error) {
      setExistingPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Load audit teams for all plans
  useEffect(() => {
    const loadAuditTeams = async () => {
      try {
        const teams = await getAuditTeam();
        const teamsArray = unwrap(teams) || [];
        // Filter out AuditeeOwner from audit teams (same as Auditor)
        const filteredTeams = Array.isArray(teamsArray) 
          ? teamsArray.filter((m: any) => {
              const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
              return role !== 'auditeeowner';
            })
          : [];
        setAuditTeams(filteredTeams);
      } catch (err) {
        console.error('Failed to load audit teams', err);
        setAuditTeams([]);
      }
    };
    loadAuditTeams();
  }, []);

  const hydrateTemplateSelection = async (
    auditId: string,
    fallbackTemplateId?: string | number | null
  ) => {
    const normalizedFallback =
      fallbackTemplateId != null ? [String(fallbackTemplateId)] : [];
    if (!auditId) {
      setTemplatesForSelectedPlan([]);
      return;
    }

    try {
      const maps = await getAuditChecklistTemplateMapsByAudit(String(auditId));
      const normalizedRecords = (maps || [])
        .map((map: any) => ({
          raw: map,
          templateId:
            map.templateId ??
            map.checklistTemplateId ??
            map.template?.templateId ??
            map.template?.id,
        }))
        .filter((x: any) => x.templateId != null);

      if (normalizedRecords.length > 0) {
        const templateCards = normalizedRecords.map((x: any) => {
          const tplFromList = checklistTemplates.find(
            (tpl: any) =>
              String(tpl.templateId || tpl.id || tpl.$id) === String(x.templateId)
          );
          return {
            templateId: x.templateId,
            id: x.templateId,
            $id: x.templateId,
            name: tplFromList?.title || tplFromList?.name || `Template ${x.templateId}`,
            title: tplFromList?.title || tplFromList?.name || `Template ${x.templateId}`,
            version: tplFromList?.version,
            description: tplFromList?.description,
            deptId: tplFromList?.deptId,
          };
        });
        setTemplatesForSelectedPlan(templateCards);
      } else if (normalizedFallback.length > 0) {
        const fallbackTpl = checklistTemplates.find(
          (tpl: any) =>
            String(tpl.templateId || tpl.id || tpl.$id) === normalizedFallback[0]
        );
        if (fallbackTpl) {
          setTemplatesForSelectedPlan([{
            templateId: normalizedFallback[0],
            id: normalizedFallback[0],
            $id: normalizedFallback[0],
            name: fallbackTpl.title || fallbackTpl.name || `Template ${normalizedFallback[0]}`,
            title: fallbackTpl.title || fallbackTpl.name || `Template ${normalizedFallback[0]}`,
            version: fallbackTpl.version,
            description: fallbackTpl.description,
            deptId: fallbackTpl.deptId,
          }]);
        } else {
          setTemplatesForSelectedPlan([]);
        }
      } else {
        setTemplatesForSelectedPlan([]);
      }
    } catch (err) {
      console.error('Failed to load template maps', err);
      setTemplatesForSelectedPlan([]);
    }
  };

  // Only show Approve/Reject when any status field (on plan or nested audit) is PendingReview
  // Note: PendingReview status is no longer used, so this function always returns false
  const canReviewPlan = (plan: any) => {
    // Lead Auditor can review plans with PendingReview status
    const planStatus = String(plan?.status || '').toLowerCase().replace(/\s+/g, '');
    return planStatus === 'pendingreview';
  };

  const handleViewDetails = async (auditId: string) => {
    try {
      const deptList = await ensureDepartmentsLoaded();

      try {
        const rawDetails = await getAuditPlanById(auditId);

        // Fetch schedules separately if not included in main response
        let schedulesData = rawDetails?.schedules;
        if (
          !schedulesData ||
          (!schedulesData.values &&
            !schedulesData.$values &&
            !Array.isArray(schedulesData))
        ) {
          try {
            const schedulesResponse = await getAuditSchedules(auditId);
            const schedulesArray = unwrap(schedulesResponse);
            schedulesData = { values: schedulesArray };
          } catch (scheduleErr) {
            schedulesData = { values: [] };
          }
        }

        // Merge schedules into rawDetails
        const detailsWithSchedules = {
          ...rawDetails,
          schedules: schedulesData,
        };

        // Load sensitive areas from API
        let sensitiveAreasByDept: Record<number, string[]> = {};
        let sensitiveFlag = false;
        let sensitiveAreas: string[] = [];
        
        try {
          const sensitiveDepts = await getSensitiveDepartments(auditId);
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
        } catch (sensitiveErr) {
          console.warn('[handleViewDetails] Failed to load sensitive areas:', sensitiveErr);
        }

        // Load approvals history only if plan is rejected
        let latestRejectionComment: string | null = null;
        const planStatus = String(
          detailsWithSchedules.status ||
            detailsWithSchedules.audit?.status ||
            ""
        ).toLowerCase();
        const isRejected = planStatus.includes("rejected");
        
        if (isRejected) {
          latestRejectionComment =
            detailsWithSchedules.comment ||
            detailsWithSchedules.note || 
            detailsWithSchedules.audit?.comment ||
            detailsWithSchedules.audit?.note ||
            null;
          
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(
                detailsWithSchedules.auditId ||
                  detailsWithSchedules.id ||
                  auditId
              )
                .trim()
                .toLowerCase();
              
              const related = approvals.filter((a: any) => {
                const approvalAuditId = String(
                  a.auditId || a.audit?.auditId || a.audit?.id || ""
                )
                  .trim()
                  .toLowerCase();
                return (
                  approvalAuditId === currentAuditId && approvalAuditId !== ""
                );
              });
              
              if (related.length > 0) {
                const rejected = related
                  .filter((a: any) => {
                    const approvalStatus = String(a.status || "").toLowerCase();
                    return (
                      approvalStatus.includes("rejected") ||
                      approvalStatus === "rejected"
                    );
                  })
                  .sort((a: any, b: any) => {
                    const aTime = new Date(
                      a.approvedAt || a.createdAt || 0
                    ).getTime();
                    const bTime = new Date(
                      b.approvedAt || b.createdAt || 0
                    ).getTime();
                    return bTime - aTime;
                  });
                
                if (rejected.length > 0) {
                  latestRejectionComment =
                    rejected[0].comment ||
                    rejected[0].rejectionComment || 
                    rejected[0].note || 
                    rejected[0].reason || 
                    null;
                }
              }
            } catch (approvalErr) {
              console.warn('Failed to load approval history', approvalErr);
            }
          }
        }

        // Normalize plan details
        const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
        const detailsWithRejection = normalizePlanDetails(
          {
            ...detailsWithSchedules,
            latestRejectionComment,
            sensitiveFlag,
            sensitiveAreas,
            sensitiveAreasByDept,
          },
          {
            departments: deptList,
            criteriaList: criteria,
            users: allUsers,
          }
        );

        setSelectedPlanDetails(detailsWithRejection);
        await hydrateTemplateSelection(
          auditId,
          detailsWithRejection.templateId
        );
        setShowDetailsModal(true);
        return;
      } catch (apiError) {
        const planFromTable = existingPlans.find(
          (p) => p.auditId === auditId || p.id === auditId
        );

        if (!planFromTable) {
          toast.error('Plan not found');
          return;
        }

        // Fallback: use basic plan data from table
        // Try to load sensitive areas even in fallback case
        let fallbackSensitiveAreasByDept: Record<number, string[]> = {};
        try {
          const sensitiveDepts = await getSensitiveDepartments(auditId);
          if (sensitiveDepts && sensitiveDepts.length > 0) {
            sensitiveDepts.forEach((sd: any) => {
              const deptId = Number(sd.deptId);
              let areasArray: string[] = [];
              
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
              
              if (deptId && areasArray.length > 0) {
                fallbackSensitiveAreasByDept[deptId] = areasArray
                  .filter((area: string) => area && typeof area === 'string' && area.trim())
                  .map((a: string) => a.trim());
              }
            });
          }
        } catch (sensitiveErr) {
          console.warn('[handleViewDetails fallback] Failed to load sensitive areas:', sensitiveErr);
        }

        const basicDetails: AuditPlanDetails = {
          ...planFromTable,
          schedules: { values: [] },
          auditTeams: { values: [] },
          scopeDepartments: planFromTable.scopeDepartments || { values: [] },
          sensitiveAreasByDept: fallbackSensitiveAreasByDept,
        } as any;

        setSelectedPlanDetails(basicDetails);
        await hydrateTemplateSelection(auditId, basicDetails.templateId);
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch plan details", error);
      toast.error("Failed to load plan details: " + ((error as any)?.message || "Unknown error"));
    }
  };



  // NOTE: Create/Edit/Delete functionality has been moved to Auditor role
  // LeadAuditor can only view, approve, and reject plans

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
        <PageHeader
          title="Audit Planning"
          subtitle="Review and approve audit plans submitted by Auditors"
        />
        {/* Plans Table with Filters */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-100">
          <FilterBar
            filterDepartment={filterState.filterDepartment}
            sortDateOrder={filterState.sortDateOrder}
            filterStatus={filterState.filterStatus}
            searchQuery={filterState.searchQuery}
            departments={departments}
            onFilterDepartmentChange={filterState.setFilterDepartment}
            onSortDateOrderChange={filterState.setSortDateOrder}
            onFilterStatusChange={filterState.setFilterStatus}
            onSearchQueryChange={filterState.setSearchQuery}
            onClearFilters={filterState.clearFilters}
            filteredCount={filterState.filteredPlans.length}
            totalCount={visiblePlans.length}
          />

          <PlanTable
            filteredPlans={filterState.filteredPlans.slice(
              (activePlansTab - 1) * pageSize,
              activePlansTab * pageSize
            )}
            existingPlans={visiblePlans}
            loadingPlans={loadingPlans}
            onViewDetails={handleViewDetails}
            onEditPlan={undefined}
            onDeletePlan={undefined}
            onUpload={undefined}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            startIndex={(activePlansTab - 1) * pageSize}
          />

          {/* Tabs / pagination placed at bottom, centered like the design */}
          {(() => {
            const totalPlans = filterState.filteredPlans.length;
            const totalPages = Math.ceil(totalPlans / pageSize);
            
            if (totalPages <= 1) return null;
            
            return (
              <div className="px-6 py-4 border-t bg-white flex items-center justify-center gap-3">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setActivePlansTab(pageNum)}
                    className={`px-4 py-2 rounded font-medium transition ${
                      activePlansTab === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedPlanDetails && (() => {
          const canReview = canReviewPlan(selectedPlanDetails);
          // Check if plan is Draft status (for Lead Auditor to forward to Director directly)
          const planStatus = String(selectedPlanDetails.status || '').toLowerCase().replace(/\s+/g, '');
          const isDraft = planStatus === 'draft';
          // Only Draft plans can use "Submit to Director" button
          // PendingReview plans should use "Approve & Forward" button instead
          const canForwardToDirector = isDraft;
          
          return (
            <PlanDetailsModal
              showModal={showDetailsModal}
              selectedPlanDetails={selectedPlanDetails}
              templatesForPlan={templatesForSelectedPlan}
              onClose={() => {
                setShowDetailsModal(false);
                setSelectedPlanDetails(null);
                setTemplatesForSelectedPlan([]);
              }}
              onForwardToDirector={canForwardToDirector ? async (auditId: string, comment?: string) => {
                try {
                  await approveForwardDirector(auditId, { comment });
                  await fetchPlans();
                  toast.success('Plan forwarded to Director successfully.');
                  setShowDetailsModal(false);
                  setSelectedPlanDetails(null);
                } catch (err: any) {
                  console.error('Failed to forward plan to Director', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to forward plan. Please try again.'));
                }
              } : undefined}
              onRejectPlan={canReview ? async (auditId: string, comment?: string) => {
                try {
                  await declinedPlanContent(auditId, { comment: comment || '' });
                  await fetchPlans();
                  toast.success('Plan rejected successfully.');
                  setShowDetailsModal(false);
                  setSelectedPlanDetails(null);
                } catch (err: any) {
                  console.error('Failed to reject plan', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to reject plan. Please try again.'));
                }
              } : undefined}
              onApprove={canReview ? async (auditId: string, comment?: string) => {
                try {
                  await approveForwardDirector(auditId, { comment });
                  await fetchPlans();
                  toast.success('Plan approved and forwarded to Director successfully.');
                  setShowDetailsModal(false);
                  setSelectedPlanDetails(null);
                } catch (err: any) {
                  console.error('Failed to approve plan', err);
                  const errorMessage = err?.response?.data?.message || err?.message || String(err);
                  const statusCode = err?.response?.status;
                  
                  // Check if the plan status was actually updated by fetching the plan details
                  if (statusCode === 500) {
                    try {
                      // Fetch the plan details directly to check if status was updated
                      const updatedPlanDetails = await getAuditPlanById(auditId);
                      const updatedStatus = String(updatedPlanDetails?.status || updatedPlanDetails?.audit?.status || '').toLowerCase().replace(/\s+/g, '');
                      
                      if (updatedStatus === 'pendingdirectorapproval') {
                        // Plan was actually approved despite the error
                        await fetchPlans();
                        toast.success('Plan approved and forwarded to Director successfully. (Notification may have failed)');
                        setShowDetailsModal(false);
                        setSelectedPlanDetails(null);
                      } else {
                        toast.error('Failed to approve plan: ' + errorMessage);
                      }
                    } catch (checkErr) {
                      console.error('Failed to check plan status', checkErr);
                      toast.error('Failed to approve plan: ' + errorMessage);
                    }
                  } else {
                    toast.error('Failed to approve plan: ' + errorMessage);
                  }
                }
              } : undefined}
              approveButtonText={canReview ? 'Approve & Forward' : undefined}
            currentUserId={currentUserId}
            auditTeamsForPlan={auditTeams.filter((m: any) => {
              const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
              if (!currentAuditId) return false;
              const teamAuditId = String(m?.auditId || "").trim();
              return (
                teamAuditId === String(currentAuditId).trim() ||
                teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
              );
            })}
            getCriterionName={(id: string) => getCriterionName(id, criteria)}
            getDepartmentName={(id: string | number) => {
              return getDepartmentName(id, departments);
            }}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            getAuditTypeBadgeColor={getAuditTypeBadgeColor}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            getTemplateName={(tid) => {
              const t = checklistTemplates.find(
                (tpl: any) =>
                  String(tpl.templateId || tpl.id || tpl.$id) === String(tid)
              );
              return t?.title || t?.name || `Template ${String(tid ?? "")}`;
            }}
          />
          );
        })()}

      </div>
    </MainLayout>
  );
};

export default LeadAuditorAuditPlanning;
