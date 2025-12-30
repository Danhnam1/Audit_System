import { MainLayout } from '../../../layouts';
import { PageHeader } from '../../../components';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { AuditPlan, AuditPlanDetails } from '../../../types/auditPlan';
import { getChecklistTemplates, createAuditChecklistItemsFromTemplate } from '../../../api/checklists';
import { 
  createAudit, 
  addAuditScopeDepartment,
  getAuditPlanById,
  getAuditApprovals,
  approveForwardDirector,
  declinedPlanContent,
  setSensitiveFlag,
  getSensitiveDepartments,
  completeUpdateAuditPlan,
  deleteAuditPlan,
} from '../../../api/audits';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { addCriterionToAudit } from '../../../api/auditCriteriaMap';
import { getAdminUsers } from '../../../api/adminUsers';
import { addTeamMember, getAuditTeam } from '../../../api/auditTeam';
import { getDepartments } from '../../../api/departments';
import { addAuditSchedule, getAuditSchedules } from '../../../api/auditSchedule';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../constants/audit';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { syncAuditChecklistTemplateMaps, getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { unwrap, normalizePlanDetails } from '../../../utils/normalize';
import { useUserId } from '../../../store/useAuthStore';
import { 
  validateBeforeCreateAudit, 
  validateBeforeAddDepartment,
  validateDepartmentWithConditions,
  validateScheduleMilestones,
} from '../../../helpers/businessRulesValidation';

// Import custom hooks
import { useAuditPlanForm } from '../../../hooks/useAuditPlanForm';
import { useAuditPlanFilters } from '../../../hooks/useAuditPlanFilters';

// Import helper functions
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { getCriterionName, getDepartmentName } from '../../../helpers/auditPlanHelpers';

// Import components
import { FilterBar } from './components/FilterBar';
import { PlanTable } from './components/PlanTable';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { toast } from 'react-toastify';
import { Step1BasicInfo } from './components/PlanForm/Step1BasicInfo';
import { Step2Scope } from './components/PlanForm/Step2Scope';
import { Step3Checklist } from './components/PlanForm/Step3Checklist';
import { Step4Team } from './components/PlanForm/Step4Team';
import { Step5Schedule } from './components/PlanForm/Step5Schedule';
import { SensitiveAreaForm } from './components/PlanForm/SensitiveAreaForm';
import { PermissionPreviewPanel } from './components/PlanForm/PermissionPreviewPanel';
import { loadPlanDetailsForEdit } from './components/editPlanService';

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

  // Use custom hooks for form state management
  const formState = useAuditPlanForm();

  // Data fetching states
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  // Store selected criteria by department (Map<deptId, Set<criteriaId>>)
  const [selectedCriteriaByDept, setSelectedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());
  // UI: tabs for plans when more than pageSize
  const [activePlansTab, setActivePlansTab] = useState<number>(1);
  const pageSize = 10;

  // Conflict warning modal state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<{
    conflicts?: {
      departmentIds: number[];
      audits: Array<{
        auditId: string;
        title: string;
        startDate: string;
        endDate: string;
        scope?: string[];
        status?: string; // Status of conflicting audit
        overlapDays?: number; // Number of overlapping days
      }>;
    };
    usedCriteriaIds: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical'; // Conflict severity level
    hasScopeOverlap?: boolean; // Whether there's scope overlap
  } | null>(null);
  

  // Filtered criteria (exclude criteria used in conflicting audits)
  const [filteredCriteria, setFilteredCriteria] = useState<any[]>([]);

  // Original selected auditors from plan (when editing) - always show these in dropdown
  const [_originalSelectedAuditorIds, setOriginalSelectedAuditorIds] = useState<string[]>([]);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Submitting state
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

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

  // Helpers: date and schedule validations
  const toDate = (s?: string | null) => (s ? new Date(s) : null);

  const scheduleErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const points: Array<{ key: keyof typeof formState; value: string; label: string } | null> = [
      formState.kickoffMeeting ? { key: 'kickoffMeeting' as any, value: formState.kickoffMeeting, label: 'Kickoff Meeting' } : null,
      formState.fieldworkStart ? { key: 'fieldworkStart' as any, value: formState.fieldworkStart, label: 'Fieldwork Start' } : null,
      formState.evidenceDue ? { key: 'evidenceDue' as any, value: formState.evidenceDue, label: 'Evidence Due' } : null,
      formState.capaDue ? { key: 'capaDue' as any, value: formState.capaDue, label: 'CAPA Due' } : null,
      formState.draftReportDue ? { key: 'draftReportDue' as any, value: formState.draftReportDue, label: 'Draft Report Due' } : null,
    ].filter(Boolean) as any[];

    // Get period dates for validation
    const periodFromDate = toDate(formState.periodFrom);
    const periodToDate = toDate(formState.periodTo);

    // Check if schedule dates are within period range
    if (periodFromDate && periodToDate) {
      points.forEach((p) => {
        if (!p) return;
        const scheduleDate = toDate(p.value);
        if (scheduleDate) {
          if (scheduleDate < periodFromDate) {
            errs[p.key] = `Date must be on or after Period From (${formState.periodFrom}).`;
          } else if (scheduleDate > periodToDate) {
            errs[p.key] = `Date must be on or before Period To (${formState.periodTo}).`;
          }
        }
      });
    }

    // Duplicate check among filled dates
    const seen = new Map<string, number[]>();
    points.forEach((p, idx) => {
      const k = (p as any).value as string;
      const list = seen.get(k) ?? [];
      list.push(idx);
      seen.set(k, list);
    });
    seen.forEach((idxs) => {
      if (idxs.length > 1) {
        idxs.forEach((i) => {
          const k = points[i]!.key as string;
          // Only add duplicate error if not already has period range error
          if (!errs[k]) {
          errs[k] = 'Dates must be unique (no duplicates).';
          }
        });
      }
    });

    // Strictly increasing order check (each later must be > previous)
    for (let i = 1; i < points.length; i++) {
      const prev = toDate(points[i - 1]!.value);
      const curr = toDate(points[i]!.value);
      if (prev && curr && curr.getTime() <= prev.getTime()) {
        const k = points[i]!.key as string;
        errs[k] = `${points[i]!.label} must be after ${points[i - 1]!.label}.`;
      }
    }

    // Business Rule: Validate minimum 5-day gaps between milestones
    const scheduleValidation = validateScheduleMilestones(
      formState.fieldworkStart,
      formState.evidenceDue,
      formState.capaDue,
      formState.draftReportDue
    );
    
    // Merge schedule validation errors (only add if field doesn't already have an error)
    Object.entries(scheduleValidation.errors).forEach(([field, message]) => {
      if (!errs[field]) {
        errs[field] = message;
      }
    });

    return errs;
  }, [
    formState.kickoffMeeting,
    formState.fieldworkStart,
    formState.evidenceDue,
    formState.draftReportDue,
    formState.capaDue,
    formState.periodFrom,
    formState.periodTo,
  ]);

  // Validation functions for each step
  const validateStep1 = useMemo(() => {
    const basicFieldsValid = (
      formState.title.trim() !== '' &&
      formState.auditType.trim() !== '' &&
      formState.goal.trim() !== '' &&
      formState.periodFrom !== '' &&
      formState.periodTo !== ''
    );
    
    if (!basicFieldsValid) return false;
    
    // Validate period dates and minimum 16 days gap
    const fromDate = new Date(formState.periodFrom);
    const toDate = new Date(formState.periodTo);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return false;
    }
    
    if (fromDate.getTime() > toDate.getTime()) {
      return false;
    }
    
    // Business Rule: Period must be at least 16 days
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    const MIN_PERIOD_DAYS = 16;
    
    return daysDiff >= MIN_PERIOD_DAYS;
  }, [formState.title, formState.auditType, formState.goal, formState.periodFrom, formState.periodTo]);

  const validateStep2 = useMemo(() => {
    if (formState.level === 'department') {
      return formState.selectedDeptIds.length > 0 && formState.selectedCriteriaIds.length > 0;
    }
    return formState.selectedCriteriaIds.length > 0;
  }, [formState.level, formState.selectedDeptIds, formState.selectedCriteriaIds]);

  const validateStep3 = useMemo(() => {
    return Array.isArray(formState.selectedTemplateIds) && formState.selectedTemplateIds.length > 0;
  }, [formState.selectedTemplateIds]);

  const validateStep4 = useMemo(() => {
    // For Lead Auditor: they are the Lead Auditor themselves, so we don't need to check selectedLeadId
    // Only check that at least 2 auditors are selected (including the Lead Auditor themselves)
    return formState.selectedAuditorIds.length >= 2;
  }, [formState.selectedAuditorIds]);

  const validateStep5 = useMemo(() => {
    // Step 5 is optional, but if dates are filled, they must be valid
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    return scheduleErrorMessages.length === 0;
  }, [scheduleErrors]);

  const canContinue = useMemo(() => {
    switch (formState.currentStep) {
      case 1:
        return validateStep1;
      case 2:
        return validateStep2;
      case 3:
        return validateStep3;
      case 4:
        return validateStep4;
      case 5:
        return validateStep5;
      default:
        return false;
    }
  }, [formState.currentStep, validateStep1, validateStep2, validateStep3, validateStep4, validateStep5]);

  // Load departments when level changes to 'department'
  useEffect(() => {
    const loadDepts = async () => {
      if (departments.length > 0) return;
      try {
        const res: any = await getDepartments();
        const list = (res || []).map((d: any) => ({
          deptId: d.deptId ?? d.$id ?? d.id,
          name: d.name || d.code || '—',
        }));
        setDepartments(list);
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    if (formState.level === 'department' && departments.length === 0) {
      loadDepts();
    }
  }, [formState.level, departments.length]);

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

  // Keep owner selection consistent with scope
  useEffect(() => {
    if (formState.level === 'academy' && formState.selectedOwnerId) {
      formState.setSelectedOwnerId('');
    }
  }, [formState.level]);

  useEffect(() => {
    if (!formState.selectedOwnerId) return;
    const owner = ownerOptions.find((o: any) => String(o.userId) === String(formState.selectedOwnerId));
    if (!owner) {
      formState.setSelectedOwnerId('');
      return;
    }
    if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
      const ownerDeptInSelection = formState.selectedDeptIds.includes(String(owner.deptId ?? ''));
      if (!ownerDeptInSelection) {
        formState.setSelectedOwnerId('');
      }
    }
  }, [formState.selectedDeptIds, ownerOptions, formState.level]);

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
      setExistingPlans(merged);
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
        setAuditTeams(Array.isArray(teamsArray) ? teamsArray : []);
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
  const canReviewPlan = (_plan: any) => {
    // PendingReview status has been removed from the system
    return false;
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


  // Helper: Check if form has any data entered
  const hasFormData = useMemo(() => {
    return (
      formState.title.trim() !== '' ||
      formState.goal.trim() !== '' ||
      formState.periodFrom !== '' ||
      formState.periodTo !== '' ||
      formState.auditType !== 'Internal' ||
      formState.level !== 'academy' ||
      formState.selectedDeptIds.length > 0 ||
      formState.selectedCriteriaIds.length > 0 ||
      formState.selectedTemplateIds.length > 0 ||
      formState.selectedLeadId !== '' ||
      formState.selectedAuditorIds.length > 0 ||
      formState.kickoffMeeting !== '' ||
      formState.fieldworkStart !== '' ||
      formState.evidenceDue !== '' ||
      formState.draftReportDue !== '' ||
      formState.capaDue !== ''
    );
  }, [
    formState.title,
    formState.goal,
    formState.periodFrom,
    formState.periodTo,
    formState.auditType,
    formState.level,
    formState.selectedDeptIds,
    formState.selectedCriteriaIds,
    formState.selectedTemplateIds,
    formState.selectedLeadId,
    formState.selectedAuditorIds,
    formState.kickoffMeeting,
    formState.fieldworkStart,
    formState.evidenceDue,
    formState.draftReportDue,
    formState.capaDue,
  ]);

  // Validation function for plan period
  const validatePlanPeriod = (from: string, to: string, showToast: boolean = false): boolean => {
    if (!from || !to) {
      if (showToast) toast.warning('Please select both start and end dates.');
      return false;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      if (showToast) toast.warning('Invalid date format.');
      return false;
    }
    if (fromDate.getTime() > toDate.getTime()) {
      if (showToast) toast.warning('Invalid period: Start date must be earlier than or equal to the end date.');
      return false;
    }
    
    // Business Rule: Period must be at least 16 days
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    const MIN_PERIOD_DAYS = 16;
    
    if (daysDiff < MIN_PERIOD_DAYS) {
      if (showToast) toast.warning(`Invalid period: Period must be at least ${MIN_PERIOD_DAYS} days. Current period is ${daysDiff} day(s).`);
      return false;
    }
    
    return true;
  };

  // Handler: Submit plan (with validation and conflict checking)
  const handleSubmitPlan = async () => {
    // Block immediately when starting to submit
    setIsSubmittingPlan(true);
    
    try {
    // Client-side validation
    if (!formState.title.trim()) {
      toast.warning('Please enter a title for the plan.');
      formState.setCurrentStep(1);
        setIsSubmittingPlan(false);
      return;
    }
    if (!formState.periodFrom || !formState.periodTo) {
      toast.warning('Please select the start and end dates.');
      formState.setCurrentStep(1);
        setIsSubmittingPlan(false);
      return;
    }

      if (!validatePlanPeriod(formState.periodFrom, formState.periodTo, true)) {
      formState.setCurrentStep(1);
        setIsSubmittingPlan(false);
      return;
    }
    if (!formState.selectedTemplateIds.length) {
      toast.warning('Please select at least one Checklist Template (Step 3).');
      formState.setCurrentStep(3);
        setIsSubmittingPlan(false);
      return;
    }
    if (formState.level === 'department') {
      if (formState.selectedDeptIds.length === 0) {
        toast.warning('Please select at least one department for the Department scope (Step 2).');
        formState.setCurrentStep(2);
          setIsSubmittingPlan(false);
        return;
      }
      const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
      if (ownersForDepts.length === 0) {
        if (!window.confirm('⚠️ The selected departments do not have an Auditee Owner yet.\n\nDo you want to continue creating the audit plan?')) {
          formState.setCurrentStep(4);
            setIsSubmittingPlan(false);
          return;
        }
      }
    }

    // Schedule constraints: unique dates and strictly increasing order
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    if (scheduleErrorMessages.length > 0) {
      toast.error('Invalid schedule:\n\n' + scheduleErrorMessages.join('\n'));
      formState.setCurrentStep(5);
        setIsSubmittingPlan(false);
      return;
    }

    const primaryTemplateId = formState.selectedTemplateIds[0];

      const basicPayload: any = {
      title: formState.title || 'Untitled Plan',
      type: formState.auditType || 'Internal',
      scope: formState.level === 'academy' ? 'Academy' : 'Department',
      templateId: primaryTemplateId || undefined,
      startDate: formState.periodFrom ? new Date(formState.periodFrom).toISOString() : undefined,
      endDate: formState.periodTo ? new Date(formState.periodTo).toISOString() : undefined,
      status: 'Draft',
      isPublished: false,
      objective: formState.goal || '',
    };

      let auditId: string;

      // Check if we're in edit mode but editingAuditId is missing
      if (formState.isEditMode && !formState.editingAuditId) {
        console.error('WARNING: isEditMode is true but editingAuditId is empty!');
        toast.error('Cannot update: Missing audit ID. Please try editing again.');
        setIsSubmittingPlan(false);
        return;
      }

      if (formState.isEditMode && formState.editingAuditId) {
        // Use complete-update API for edit mode
        auditId = formState.editingAuditId;

        // Use basicPayload that was already prepared above
        const completeUpdatePayload = basicPayload;

        try {
          await completeUpdateAuditPlan(auditId, completeUpdatePayload);
        } catch (apiError) {
          console.error('Complete-update API failed:', apiError);
          throw apiError;
        }
      } else {
        // Create new audit - Business Rule Validation
        const startDate = formState.periodFrom;
        const endDate = formState.periodTo;
        
        if (startDate && endDate) {
          // Get department IDs to validate
          let deptIdsToValidate: number[] = [];
          if (formState.level === 'academy') {
            deptIdsToValidate = departments.map((d) => Number(d.deptId));
          } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
            deptIdsToValidate = formState.selectedDeptIds.map((id) => Number(id));
          }
          
          // Validate with conditions (check overlapping time + same department → check scope)
          const validation = await validateBeforeCreateAudit(
            startDate,
            endDate,
            deptIdsToValidate,
            formState.selectedCriteriaIds
          );

          // If there are conflicts, save conflict data and show modal
          if (validation.warnings.length > 0) {
            const deptValidation = await validateDepartmentWithConditions(
              null,
              deptIdsToValidate,
              startDate,
              endDate,
              formState.selectedCriteriaIds
            );

            if (deptValidation.conflicts && deptValidation.conflicts.audits.length > 0) {
              // Check for Rule 3: Trùng time + department + checklist
              // Get templates used in conflicting audits
              const conflictingAuditsWithSameTemplates: any[] = [];
              
              for (const audit of deptValidation.conflicts.audits) {
                try {
                  const auditId = String(audit.auditId);
                  const templateMaps = await getAuditChecklistTemplateMapsByAudit(auditId);
                  const mapsArray = unwrap(templateMaps);
                  
                  // Get template IDs used in this conflicting audit
                  const auditTemplateIds = new Set(
                    mapsArray.map((m: any) => String(m.templateId || m.id || ''))
                  );
                  
                  // Check if any selected template matches
                  const hasMatchingTemplate = formState.selectedTemplateIds.some((selectedId) =>
                    auditTemplateIds.has(String(selectedId))
                  );
                  
                  if (hasMatchingTemplate) {
                    conflictingAuditsWithSameTemplates.push({
                      ...audit,
                      templateIds: Array.from(auditTemplateIds),
                    });
                  }
                } catch (err) {
                  console.warn(`Failed to get templates for audit ${audit.auditId}:`, err);
                }
              }
              
              // Rule 3: Trùng time + department + checklist → Show modal with English message
              if (conflictingAuditsWithSameTemplates.length > 0) {
                setConflictData({
                  conflicts: {
                    departmentIds: deptValidation.conflicts.departmentIds,
                    audits: conflictingAuditsWithSameTemplates,
                  },
                  usedCriteriaIds: [],
                  severity: 'critical',
                  hasScopeOverlap: true,
                });
                setShowConflictModal(true);
                setIsSubmittingPlan(false);
                return;
              }
              
              // Rule 2: Trùng time + department, khác checklist → Filter criteria
              // Extract used criteria IDs from conflicting audits
              const usedCriteriaIds = new Set<string>();
              deptValidation.conflicts.audits.forEach((audit) => {
                if (audit.scope && Array.isArray(audit.scope)) {
                  audit.scope.forEach((criteriaId) => {
                    usedCriteriaIds.add(String(criteriaId));
                  });
                }
              });

              // Filter criteria to exclude used ones
              const filtered = criteria.filter((c: any) => {
                const id = String(c.criteriaId || c.id || c.$id);
                return !usedCriteriaIds.has(id);
              });

              setFilteredCriteria(filtered);
              setConflictData({
                conflicts: deptValidation.conflicts,
                usedCriteriaIds: Array.from(usedCriteriaIds),
                severity: 'medium',
                hasScopeOverlap: false,
              });
              setShowConflictModal(true);

              // Don't throw error, just show modal warning
              setIsSubmittingPlan(false);
              return;
            } else {
              setFilteredCriteria([]);
              setConflictData(null);
            }
          } else {
            setFilteredCriteria([]);
            setConflictData(null);
          }

          // Only reject if there are errors (not warnings)
          if (validation.errors.length > 0) {
            validation.errors.forEach((error) => {
              toast.error(error);
            });
            setIsSubmittingPlan(false);
            throw new Error('Validation failed. Please check the errors above.');
          }
        }
        
        const resp = await createAudit(basicPayload);
        auditId = resp?.auditId || resp?.id || resp;

        if (!auditId) {
          throw new Error('No auditId returned from createAudit API');
        }
      }

      const newAuditId = auditId;

      // For create mode, keep existing separate API calls
      if (!formState.isEditMode) {
      try {
        await syncAuditChecklistTemplateMaps({
          auditId: String(newAuditId),
          templateIds: formState.selectedTemplateIds,
        });
      } catch (templateMapErr) {
          console.error('Failed to sync checklist templates', templateMapErr);
        toast.error('Failed to save checklist template mappings. Please retry from Step 3.');
      }

        // Attach departments with validation
      try {
        let deptIdsToAttach: string[] = [];
        
        if (formState.level === 'academy') {
          deptIdsToAttach = departments.map((d) => String(d.deptId));
        } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
          deptIdsToAttach = formState.selectedDeptIds;
        }
        
        if (deptIdsToAttach.length > 0) {
            const startDate = formState.periodFrom;
            const endDate = formState.periodTo;
            
          const deptResults = await Promise.allSettled(
              deptIdsToAttach.map(async (deptId) => {
                // Validate department before adding
                if (startDate && endDate) {
                  const deptValidation = await validateBeforeAddDepartment(
                    String(newAuditId),
                    Number(deptId),
                    startDate,
                    endDate
                  );
                  
                  if (!deptValidation.isValid) {
                    toast.error(`Department validation failed: ${deptValidation.message}`);
                    throw new Error(deptValidation.message);
                  }
                }
                
                return await addAuditScopeDepartment(String(newAuditId), Number(deptId));
              })
          );
            
          const failedDepts = deptResults.filter((r) => r.status === 'rejected');
          if (failedDepts.length > 0) {
              console.error('Some departments failed to attach:', failedDepts);
              toast.warning(`${failedDepts.length} department(s) failed to attach. Please check the errors above.`);
            }
            
            // Create checklist items from template for all successfully attached departments
            // This should happen regardless of sensitive flag
            const successfulDepts = deptResults
              .filter((r) => r.status === 'fulfilled')
              .map((r) => (r as PromiseFulfilledResult<any>).value)
              .filter(Boolean);
            
            if (successfulDepts.length > 0 && formState.selectedTemplateIds.length > 0) {
              try {
                const checklistPromises = successfulDepts.map(async (sd: any) => {
                  const sdDeptId = Number(sd.deptId || sd.$deptId);
                  if (!sdDeptId || isNaN(sdDeptId)) return null;
                  
                  try {
                    await createAuditChecklistItemsFromTemplate(
                      String(newAuditId),
                      sdDeptId
                    );
                    return { deptId: sdDeptId, success: true };
                  } catch (err) {
                    console.error(`Failed to create checklist items for department ${sdDeptId}:`, err);
                    return { deptId: sdDeptId, success: false };
                  }
                });
                
                const checklistResults = await Promise.allSettled(checklistPromises);
                const failedChecklists = checklistResults.filter(
                  (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)
                ).length;
                
                if (failedChecklists > 0) {
                  console.warn(`${failedChecklists} department(s) failed to create checklist items`);
                }
                // Don't show toast for checklist creation - it's expected behavior
              } catch (checklistErr: any) {
                console.error('Failed to create checklist items from template:', checklistErr);
                // Don't block plan creation if checklist creation fails
              }
            }
            
            // Set sensitive flags for departments if enabled
            if (formState.sensitiveFlag && formState.sensitiveAreas.length > 0) {
              try {
                const successfulDepts = deptResults
                  .filter((r) => r.status === 'fulfilled')
                  .map((r) => (r as PromiseFulfilledResult<any>).value)
                  .filter(Boolean);
                
                // Parse sensitive areas
                const deptNamesWithAreas = new Set<string>();
                const areasByDeptName = new Map<string, string[]>();

                formState.sensitiveAreas.forEach((formattedArea: string) => {
                  const parts = formattedArea.split(' - ');
                  if (parts.length >= 2) {
                    const deptName = parts.slice(1).join(' - ');
                    deptNamesWithAreas.add(deptName);

                    if (!areasByDeptName.has(deptName)) {
                      areasByDeptName.set(deptName, []);
                    }
                    areasByDeptName.get(deptName)!.push(formattedArea);
                  }
                });

                const deptIdsWithAreas = new Set<number>();
                const allDepts = formState.level === 'academy'
                  ? departments
                  : departments.filter((d) => formState.selectedDeptIds.includes(String(d.deptId)));

                allDepts.forEach((dept) => {
                  const deptName = dept.name || '';
                  if (deptNamesWithAreas.has(deptName)) {
                    deptIdsWithAreas.add(Number(dept.deptId));
                  }
                });

                const sensitivePromises = successfulDepts
                  .filter((sd: any) => {
                    const sdDeptId = Number(sd.deptId || sd.$deptId);
                    return deptIdsWithAreas.has(sdDeptId);
                  })
                  .map((sd: any) => {
                    const scopeDeptId = sd.auditScopeId || sd.AuditScopeId || sd.scopeDeptId || sd.$scopeDeptId || sd.id || sd.auditScopeDepartmentId;
                    if (!scopeDeptId) return null;

                    const sdDeptId = Number(sd.deptId || sd.$deptId);
                    const dept = allDepts.find((d) => Number(d.deptId) === sdDeptId);
                    const deptName = dept?.name || '';
                    const deptAreas = areasByDeptName.get(deptName) || [];
                    
                    return setSensitiveFlag(String(scopeDeptId), {
                      sensitiveFlag: true,
                      areas: deptAreas,
                      notes: formState.sensitiveNotes || '',
                    });
                  })
                  .filter(Boolean);
                
                if (sensitivePromises.length > 0) {
                  const results = await Promise.allSettled(sensitivePromises);
                  const successful = results.filter((r) => r.status === 'fulfilled').length;
                  const failed = results.filter((r) => r.status === 'rejected').length;
                  
                  if (failed > 0) {
                    toast.warning(`${failed} sensitive flag(s) could not be saved.`);
                  } else if (successful > 0) {
                    toast.success(`Sensitive flags saved successfully for ${successful} department(s).`);
                  }
                }
              } catch (sensitiveErr: any) {
                console.error('Failed to set sensitive flags:', sensitiveErr);
                toast.warning('Plan created but sensitive flags could not be saved. Please update manually.');
              }
          }
          }
        } catch (scopeErr) {
          console.error('Attach departments to audit failed', scopeErr);
      }

      // Attach criteria
        try {
          const criteriaSet = new Set<string>();

          if (selectedCriteriaByDept.size > 0) {
            selectedCriteriaByDept.forEach((criteriaIds) => {
              criteriaIds.forEach((id) => criteriaSet.add(String(id)));
            });
          } else if (formState.selectedCriteriaIds.length > 0) {
            formState.selectedCriteriaIds.forEach((id) => criteriaSet.add(String(id)));
          }

          if (criteriaSet.size > 0) {
          await Promise.allSettled(
              Array.from(criteriaSet).map((criteriaId) =>
                addCriterionToAudit(String(newAuditId), String(criteriaId))
              )
          );
          } else {
            toast.warning('No criteria selected to attach to audit.');
        }
        } catch (critErr: any) {
          console.error('Attach criteria to audit failed', critErr);
          toast.error('Failed to attach criteria to audit. Please try again.');
      }

      // Add team members
      try {
        const calls: Promise<any>[] = [];
        const auditorSet = new Set<string>(formState.selectedAuditorIds);
          
          // For Lead Auditor: use currentUserId as Lead Auditor if selectedLeadId is not set
          const leadAuditorId = formState.selectedLeadId || currentUserId || '';
          if (leadAuditorId) auditorSet.add(leadAuditorId);

        auditorSet.forEach((uid) => {
            const isLead = uid === leadAuditorId;
          calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'Auditor', isLead }));
        });

        if (formState.level === 'academy') {
          const uniqueOwnerIds = Array.from(new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)));
          uniqueOwnerIds.forEach((uid) => {
            calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'AuditeeOwner', isLead: false }));
          });
        } else {
          const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
          ownersForDepts.forEach((owner: any) => {
            if (owner.userId) {
              calls.push(addTeamMember({ auditId: String(newAuditId), userId: String(owner.userId), roleInTeam: 'AuditeeOwner', isLead: false }));
            }
          });
        }

        if (calls.length) {
          await Promise.allSettled(calls);
        }
      } catch (teamErr) {
          console.error('Attach team failed', teamErr);
      }

      // Post schedules
      try {
        const schedulePairs = [
          { name: MILESTONE_NAMES.KICKOFF, date: formState.kickoffMeeting },
          { name: MILESTONE_NAMES.FIELDWORK, date: formState.fieldworkStart },
          { name: MILESTONE_NAMES.EVIDENCE, date: formState.evidenceDue },
          { name: MILESTONE_NAMES.CAPA, date: formState.capaDue },
            { name: MILESTONE_NAMES.DRAFT, date: formState.draftReportDue },
          ].filter((pair) => pair.date);

        if (schedulePairs.length > 0) {
            const schedulePromises = schedulePairs.map((pair) =>
            addAuditSchedule({
              auditId: String(newAuditId),
              milestoneName: pair.name,
              dueDate: new Date(pair.date).toISOString(),
              status: SCHEDULE_STATUS.PLANNED,
              notes: '',
            })
          );
          await Promise.allSettled(schedulePromises);
        }
      } catch (scheduleErr) {
          console.error('Failed to post schedules', scheduleErr);
        }
      }

      // Refresh plans list
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error('Failed to refresh plans list', refreshErr);
      }

      // Save edit mode state before resetting form
      const wasEditMode = formState.isEditMode;
      
      // If modal is open and we just updated, refresh the plan details
      if (wasEditMode && showDetailsModal && selectedPlanDetails) {
        const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
        if (currentAuditId) {
          try {
            await handleViewDetails(String(currentAuditId));
          } catch (refreshErr) {
            console.error('Failed to refresh plan details after update:', refreshErr);
          }
        }
      }

      // Reset form (closes form after successful creation)
      formState.resetForm();
      setOriginalSelectedAuditorIds([]);

      const successMsg = wasEditMode
        ? 'Audit plan updated successfully.'
        : 'Create Audit plan successfully.';
      toast.success(successMsg);
    } catch (err: any) {
      const serverMsg = err?.response?.data || err?.response || err?.message || err;
      console.error('Create audit failed', err, serverMsg);
      let errorMessage = 'Failed to create audit plan.';
      try {
        if (typeof serverMsg === 'object') {
          errorMessage = serverMsg?.message || JSON.stringify(serverMsg, null, 2);
        } else {
          errorMessage = String(serverMsg) || err?.message || String(err);
        }
      } catch (e) {
        errorMessage = err?.message || String(err);
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Handler: Edit plan
  const handleEditPlan = async (auditId: string) => {
    try {
      // Load plan details using service
      const detailsWithId = await loadPlanDetailsForEdit(
        auditId,
        existingPlans
      );

      // Load sensitive areas from API and add to details
      try {
        const sensitiveDepts = await getSensitiveDepartments(auditId);
        
        if (sensitiveDepts && sensitiveDepts.length > 0) {
          const sensitiveFlag = sensitiveDepts.some((sd: any) => sd.sensitiveFlag === true);
          const allAreas = new Set<string>();
          const sensitiveAreasByDept: Record<number, string[]> = {};
          const sensitiveDeptIds: string[] = [];
          
          sensitiveDepts.forEach((sd: any) => {
            const deptId = Number(sd.deptId);
            
            if (sd.sensitiveFlag === true) {
              sensitiveDeptIds.push(String(deptId));
            }
            
            let areasArray: string[] = [];
            if (Array.isArray(sd.Areas)) {
              areasArray = sd.Areas;
            } else if (sd.Areas && typeof sd.Areas === "string") {
              try {
                const parsed = JSON.parse(sd.Areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
              } catch {
                areasArray = [sd.Areas];
              }
            } else if (sd.Areas?.$values && Array.isArray(sd.Areas.$values)) {
              areasArray = sd.Areas.$values;
            } else if (Array.isArray(sd.areas)) {
              areasArray = sd.areas;
            } else if (sd.areas && typeof sd.areas === "string") {
              try {
                const parsed = JSON.parse(sd.areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
              } catch {
                areasArray = [sd.areas];
              }
            } else if (sd.areas?.$values && Array.isArray(sd.areas.$values)) {
              areasArray = sd.areas.$values;
            }
            
            if (deptId && areasArray.length > 0) {
              sensitiveAreasByDept[deptId] = areasArray
                .filter((area: string) => area && typeof area === "string" && area.trim())
                .map((a: string) => a.trim());
              
              areasArray.forEach((area: string) => {
                if (area && typeof area === "string" && area.trim()) {
                  allAreas.add(area.trim());
                }
              });
            }
          });
          
          // Add sensitive data to details
          detailsWithId.sensitiveFlag = sensitiveFlag;
          detailsWithId.sensitiveAreas = Array.from(allAreas);
          detailsWithId.sensitiveAreasByDept = sensitiveAreasByDept;
          detailsWithId.sensitiveDeptIds = sensitiveDeptIds;
        }
      } catch (sensitiveErr) {
        console.error('[handleEditPlan] Failed to load sensitive areas:', sensitiveErr);
      }
      
      // Use formState.loadPlanForEdit with the best-effort details (including sensitive data)
      formState.loadPlanForEdit(detailsWithId);

      // Wait a bit to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store original selected auditors from plan (always show these in dropdown)
      let originalAuditorIds = formState.selectedAuditorIds.map((id) =>
        String(id)
      );

      // Fallback: if no auditors loaded yet, fetch audit team by auditId
      if (originalAuditorIds.length === 0) {
        try {
          const teamsByAudit = await getAuditTeam();
          const filteredTeams = (teamsByAudit || []).filter((t: any) => {
            const role = String(t.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
            return role !== 'auditeeowner';
          });
          const teamIds = filteredTeams
            .filter((t: any) => String(t.auditId || t.auditPlanId || t.planId) === String(auditId))
            .map((t: any) => String(t.userId || t.id || t.$id || "").trim())
            .filter(Boolean);
          if (teamIds.length > 0) {
            originalAuditorIds = teamIds;
            formState.setSelectedAuditorIds(teamIds);
          }
        } catch (fallbackTeamErr) {
          console.warn("[handleEditPlan] Fallback load audit team failed:", fallbackTeamErr);
        }
      }

      setOriginalSelectedAuditorIds(originalAuditorIds);

      // Load criteria by department if needed
      if (detailsWithId.scopeDepartments?.values) {
        const criteriaMap = new Map<string, Set<string>>();
        const scopeDepts = unwrap(detailsWithId.scopeDepartments);
        scopeDepts.forEach((sd: any) => {
          const deptId = String(sd.deptId || sd.$deptId || '');
          if (deptId) {
            criteriaMap.set(deptId, new Set());
          }
        });
        if (detailsWithId.criteria?.values) {
          const criteriaList = unwrap(detailsWithId.criteria);
          criteriaList.forEach((c: any) => {
            const criteriaId = String(c.criteriaId || c.id || c.$id || '');
            if (criteriaId) {
              // Add to all departments (shared criteria)
              criteriaMap.forEach((set) => set.add(criteriaId));
            }
          });
        }
        setSelectedCriteriaByDept(criteriaMap);
      }

      formState.setShowForm(true);
      formState.setCurrentStep(1);
    } catch (error: any) {
      console.error('Failed to load plan for editing:', error);
      toast.error('Failed to load plan details: ' + (error?.message || 'Unknown error'));
    }
  };

  // Handler: Delete plan
  const handleDeletePlan = async (auditId: string) => {
    setPlanToDelete(auditId);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPlanToDelete(null);
  };

  const confirmDeletePlan = async () => {
    if (!planToDelete) return;
    
    try {
      await deleteAuditPlan(planToDelete);
      await fetchPlans();
      toast.success('Plan deleted successfully.');
      closeDeleteModal();
    } catch (error: any) {
      console.error('Failed to delete plan:', error);
      toast.error('Failed to delete plan: ' + (error?.message || 'Unknown error'));
    }
  };


  return (
    <MainLayout user={layoutUser}>
      <PageHeader
        title="Audit Planning"
        subtitle="Review and approve audit plans submitted by Auditors"
      />

      <div className="px-6 pb-6 space-y-6">
        {/* Form Modal for creating/editing plans */}
        {formState.showForm &&
          createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={() => {
                  if (hasFormData || formState.isEditMode) {
                    if (
                      window.confirm(
                        "Are you sure you want to cancel? All unsaved changes will be lost."
                      )
                    ) {
                      formState.resetForm();
                      setOriginalSelectedAuditorIds([]);
                    }
                  } else {
                    formState.setShowForm(false);
                    formState.setCurrentStep(1);
                  }
                }}
              />
              
              {/* Modal */}
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-auto max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">
                      {formState.isEditMode
                        ? "Edit Audit Plan"
                        : "Create New Audit Plan"}
              </h2>
              {formState.isEditMode && (
                      <span className="px-3 py-1 bg-white/20 text-white text-sm font-medium rounded-md">
                        Edit Mode
                </span>
              )}
                  </div>
                  <button
                    onClick={() => {
                      if (hasFormData || formState.isEditMode) {
                        if (
                          window.confirm(
                            "Are you sure you want to cancel? All unsaved changes will be lost."
                          )
                        ) {
                          formState.resetForm();
                          setOriginalSelectedAuditorIds([]);
                        }
                      } else {
                        formState.setShowForm(false);
                        formState.setCurrentStep(1);
                      }
                    }}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
            </div>

            {/* Progress Stepper */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                    {[
                      { num: 1, label: "Basic Info" },
                      { num: 2, label: "Scope" },
                      { num: 3, label: "Checklist" },
                      { num: 4, label: "Team" },
                      { num: 5, label: "Schedule" },
                    ].map((step, idx) => (
                      <div key={step.num} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                              formState.currentStep === step.num
                                ? "bg-primary-600 text-white ring-4 ring-primary-100"
                                : formState.currentStep > step.num
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {formState.currentStep > step.num ? "✓" : step.num}
                      </div>
                          <span
                            className={`text-xs mt-1 font-medium ${
                              formState.currentStep === step.num 
                                ? "text-primary-600"
                                : formState.currentStep > step.num
                                  ? "text-green-600"
                                  : "text-gray-500"
                            }`}
                          >
                            {step.label}
                      </span>
                    </div>
                        {idx < 4 && (
                          <div
                            className={`h-1 flex-1 mx-2 rounded transition-all ${
                              formState.currentStep > step.num
                                ? "bg-green-500"
                                : "bg-gray-200"
                            }`}
                          ></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
              {formState.currentStep === 1 && (
                    <>
                <Step1BasicInfo
                  title={formState.title}
                  auditType={formState.auditType}
                  goal={formState.goal}
                  periodFrom={formState.periodFrom}
                  periodTo={formState.periodTo}
                  onTitleChange={formState.setTitle}
                  onAuditTypeChange={formState.setAuditType}
                  onGoalChange={formState.setGoal}
                        onPeriodFromChange={(value: string) => {
                          formState.setPeriodFrom(value);
                          validatePlanPeriod(value, formState.periodTo, true);
                        }}
                        onPeriodToChange={(value: string) => {
                          formState.setPeriodTo(value);
                          validatePlanPeriod(formState.periodFrom, value, true);
                        }}
                        editingAuditId={formState.editingAuditId}
                        level={formState.level}
                        selectedDeptIds={formState.selectedDeptIds}
                />
                    </>
              )}

              {formState.currentStep === 2 && (
                <div className="space-y-4">
                  <Step2Scope
                    level={formState.level}
                    selectedDeptIds={formState.selectedDeptIds}
                    departments={departments}
                        criteria={
                          filteredCriteria.length > 0 && conflictData
                            ? filteredCriteria
                            : criteria
                        }
                    selectedCriteriaIds={formState.selectedCriteriaIds}
                        onLevelChange={(value) => {
                          formState.setLevel(value);
                          if (value === 'academy' && formState.sensitiveFlag) {
                            formState.setSensitiveFlag(false);
                            formState.setSensitiveAreas([]);
                            formState.setSensitiveNotes('');
                          }
                        }}
                        onSelectedDeptIdsChange={(value) => {
                          formState.setSelectedDeptIds(value);
                          setFilteredCriteria([]);
                          setConflictData(null);
                          setShowConflictModal(false);
                        }}
                        selectedCriteriaByDeptMap={selectedCriteriaByDept}
                        onSelectedCriteriaByDeptChange={(map) => {
                          setSelectedCriteriaByDept(map);
                          const union = new Set<string>();
                          map.forEach((set) => set.forEach((id) => union.add(String(id))));
                          formState.setSelectedCriteriaIds(Array.from(union));
                    }}
                  />
                  <SensitiveAreaForm
                    sensitiveFlag={formState.sensitiveFlag}
                    sensitiveAreas={formState.sensitiveAreas}
                    sensitiveNotes={formState.sensitiveNotes}
                        onFlagChange={(flag) => {
                          formState.setSensitiveFlag(flag);
                          if (flag) {
                            if (formState.level !== 'department') {
                              formState.setLevel('department');
                            }
                          } else {
                            formState.setSelectedDeptIds([]);
                            formState.setSensitiveAreas([]);
                            formState.setSensitiveNotes('');
                          }
                        }}
                    onAreasChange={formState.setSensitiveAreas}
                    onNotesChange={formState.setSensitiveNotes}
                    selectedDeptIds={formState.selectedDeptIds}
                    departments={departments}
                        level={formState.level}
                  />
                </div>
              )}

              {formState.currentStep === 3 && (
                <Step3Checklist
                  checklistTemplates={checklistTemplates}
                  selectedTemplateIds={formState.selectedTemplateIds}
                  onSelectionChange={formState.setSelectedTemplateIds}
                      level={formState.level}
                      selectedDeptIds={formState.selectedDeptIds}
                      departments={departments}
                      periodFrom={formState.periodFrom}
                      periodTo={formState.periodTo}
                      editingAuditId={formState.editingAuditId}
                />
              )}

              {formState.currentStep === 4 && (
                <div className="space-y-3">
                  <Step4Team
                    level={formState.level}
                    selectedDeptIds={formState.selectedDeptIds}
                    selectedAuditorIds={formState.selectedAuditorIds}
                    sensitiveFlag={formState.sensitiveFlag}
                    auditorOptions={auditorOptions}
                    ownerOptions={ownerOptions}
                    departments={departments}
                    onAuditorsChange={formState.setSelectedAuditorIds}
                        periodFrom={formState.periodFrom}
                        periodTo={formState.periodTo}
                        editingAuditId={formState.editingAuditId}
                  />
                      <PermissionPreviewPanel
                        sensitiveFlag={formState.sensitiveFlag}
                      />
                </div>
              )}

              {formState.currentStep === 5 && (
                <Step5Schedule
                  kickoffMeeting={formState.kickoffMeeting}
                  fieldworkStart={formState.fieldworkStart}
                  evidenceDue={formState.evidenceDue}
                  draftReportDue={formState.draftReportDue}
                  capaDue={formState.capaDue}
                  onKickoffChange={formState.setKickoffMeeting}
                  onFieldworkChange={formState.setFieldworkStart}
                  onEvidenceChange={formState.setEvidenceDue}
                  onDraftReportChange={formState.setDraftReportDue}
                  onCapaChange={formState.setCapaDue}
                  errors={scheduleErrors}
                  periodFrom={formState.periodFrom}
                  periodTo={formState.periodTo}
                />
              )}
                </div>

                {/* Modal Footer - Navigation Buttons */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
                  <div className="flex justify-between gap-3">
                <button
                  onClick={() => {
                    if (formState.currentStep > 1) {
                      formState.setCurrentStep(formState.currentStep - 1);
                    } else {
                      if (hasFormData || formState.isEditMode) {
                            if (
                              window.confirm(
                                "Are you sure you want to cancel? All unsaved changes will be lost."
                              )
                            ) {
                          formState.resetForm();
                              setOriginalSelectedAuditorIds([]);
                        }
                    } else {
                      formState.setShowForm(false);
                      formState.setCurrentStep(1);
                      }
                    }
                  }}
                      className="border-2 border-gray-400 text-gray-700 hover:bg-gray-100 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                      {formState.currentStep === 1 ? "Cancel" : "← Back"}
                </button>

                <div className="flex gap-3">
                  {formState.currentStep < 5 && (
                    <button
                      onClick={() => {
                        if (canContinue) {
                          formState.setCurrentStep(formState.currentStep + 1);
                        } else {
                              let message = "";
                          switch (formState.currentStep) {
                            case 1:
                                  // Check if period validation failed due to minimum days
                                  if (formState.periodFrom && formState.periodTo) {
                                    const fromDate = new Date(formState.periodFrom);
                                    const toDate = new Date(formState.periodTo);
                                    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
                                      const MS_PER_DAY = 24 * 60 * 60 * 1000;
                                      const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
                                      const MIN_PERIOD_DAYS = 16;
                                      
                                      if (daysDiff < MIN_PERIOD_DAYS) {
                                        message = `Period must be at least ${MIN_PERIOD_DAYS} days. Current period is ${daysDiff} day(s). Please adjust Period From and Period To.`;
                                      } else {
                                        message = "Please fill in the information: Title, Type, Period From, and Period To.";
                                      }
                                    } else {
                                      message = "Please fill in the information: Title, Type, Period From, and Period To.";
                                    }
                                  } else {
                                    message = "Please fill in the information: Title, Type, Period From, and Period To.";
                                  }
                              break;
                            case 2:
                                  message = formState.level === "department"
                                    ? "Please select at least 1 department and 1 inspection criterion"
                                    : "Please select at least 1 inspection criterion";
                              break;
                            case 3:
                                  if (formState.level === "department" && formState.selectedDeptIds.length > 0) {
                                    const selectedTemplates = checklistTemplates.filter((tpl: any) =>
                                      formState.selectedTemplateIds.includes(String(tpl.templateId || tpl.id || tpl.$id))
                                    );
                                    const selectedDeptIdsSet = new Set(formState.selectedDeptIds.map((id) => String(id).trim()));
                                    const deptIdsWithTemplates = new Set<string>();
                                    selectedTemplates.forEach((tpl: any) => {
                                      const tplDeptId = tpl.deptId;
                                      if (tplDeptId != null && tplDeptId !== undefined) {
                                        deptIdsWithTemplates.add(String(tplDeptId).trim());
                                      }
                                    });
                                    const missingDepts = Array.from(selectedDeptIdsSet).filter(
                                      (deptId) => !deptIdsWithTemplates.has(deptId)
                                    );
                                    if (missingDepts.length > 0) {
                                      const deptNames = missingDepts
                                        .map((deptId) => {
                                          const dept = departments.find((d) => String(d.deptId) === deptId);
                                          return dept?.name || deptId;
                                        })
                                        .join(", ");
                                      message = `Please select at least one template for each selected department. Missing templates for: ${deptNames}`;
                                    } else {
                                      message = "Please select a Checklist Template.";
                                    }
                                  } else {
                                    message = "Please select a Checklist Template.";
                                  }
                              break;
                            case 4:
                                  message = "Please select at least 2 auditors.";
                              break;
                            default:
                                  message = "Please fill in all information before continuing.";
                          }
                          toast.warning(message);
                        }
                      }}
                      disabled={!canContinue}
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                        canContinue
                              ? "bg-primary-600 hover:bg-primary-700 text-white cursor-pointer"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Continue →
                    </button>
                  )}
                  {formState.currentStep === 5 && (
                    <>
                      <button
                        onClick={handleSubmitPlan}
                            disabled={isSubmittingPlan}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                            {isSubmittingPlan
                              ? (formState.isEditMode ? "Updating..." : "Creating...")
                              : (formState.isEditMode ? " Update Plan" : " Submit Plan")}
                      </button>
                      {formState.isEditMode && (
                        <button
                          onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to cancel? All unsaved changes will be lost."
                                  )
                                ) {
                              formState.resetForm();
                                  setOriginalSelectedAuditorIds([]);
                            }
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
            </div>,
            document.body
        )}

        {/* Plans Table with Filters */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-100">
          <FilterBar
            filterDepartment={filterState.filterDepartment}
            sortDateOrder={filterState.sortDateOrder}
            filterStatus={filterState.filterStatus}
            departments={departments}
            onFilterDepartmentChange={filterState.setFilterDepartment}
            onSortDateOrderChange={filterState.setSortDateOrder}
            onFilterStatusChange={filterState.setFilterStatus}
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
            onEditPlan={handleEditPlan}
            onDeletePlan={handleDeletePlan}
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
          // Check if plan is Draft status (for Lead Auditor to forward)
          const planStatus = String(selectedPlanDetails.status || '').toLowerCase().replace(/\s+/g, '');
          const isDraft = planStatus === 'draft';
          const canForwardDraft = isDraft; // Lead Auditor can forward Draft plans to Director
          
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
              onForwardToDirector={canForwardDraft ? async (auditId: string, comment?: string) => {
                try {
                  await approveForwardDirector(auditId, { comment });
                  await fetchPlans();
                  toast.success('Plan forwarded to Director successfully.');
                  setShowDetailsModal(false);
                  setSelectedPlanDetails(null);
                } catch (err: any) {
                  console.error('Failed to forward plan to Director', err);
                  toast.error('Failed to forward plan: ' + (err?.response?.data?.message || err?.message || String(err)));
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
                  toast.error('Failed to reject plan: ' + (err?.response?.data?.message || err?.message || String(err)));
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
                  toast.error('Failed to approve plan: ' + (err?.response?.data?.message || err?.message || String(err)));
                }
              } : undefined}
              approveButtonText={canReview ? 'Approve & Forward' : undefined}
            currentUserId={currentUserId}
            auditTeamsForPlan={(() => {
              if (!selectedPlanDetails?.auditId && !selectedPlanDetails?.id)
                return [];
              const currentAuditId = String(
                selectedPlanDetails.auditId || selectedPlanDetails.id
              ).trim();
              return auditTeams.filter((m: any) => {
                const teamAuditId = String(m?.auditId || "").trim();
                return (
                  teamAuditId === currentAuditId ||
                  teamAuditId.toLowerCase() === currentAuditId.toLowerCase()
                );
              });
            })()}
            getCriterionName={(id: string) => getCriterionName(id, criteria)}
            getDepartmentName={(id: string | number) => {
              return getDepartmentName(id, departments);
            }}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
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

        {/* Conflict Warning Modal */}
        {showConflictModal &&
          conflictData &&
          createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictData(null);
                  setFilteredCriteria([]);
                }}
              />

              {/* Modal */}
              <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {conflictData.severity === 'critical' 
                          ? 'Conflict Detected'
                          : 'Warning: Department Conflict'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {conflictData.severity === 'critical'
                          ? 'There is already an audit with the same information you entered.'
                          : `There are ${conflictData.conflicts?.audits.length || 0} audit plan(s) auditing this department.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    {conflictData.severity === 'critical' ? (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                        <p className="text-sm font-medium text-red-800">
                          ⚠️ There is already an audit with the same information you entered.
                        </p>
                        <p className="text-sm text-red-700 mt-2">
                          Please modify your plan to avoid conflicts with existing audits.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                        <p className="text-sm font-medium text-yellow-800">
                          💡 Please select different audit criteria from those audits.
                        </p>
                      </div>
                    )}

                    {conflictData.conflicts &&
                      conflictData.conflicts.audits.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            Các audit plan đang kiểm định phòng ban này:
                          </h4>
                          <div className="space-y-2">
                            {conflictData.conflicts.audits.map((audit, idx) => (
                              <div
                                key={audit.auditId || idx}
                                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {audit.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Thời gian:{" "}
                                  {new Date(audit.startDate).toLocaleDateString(
                                    "vi-VN"
                                  )}{" "}
                                  -{" "}
                                  {new Date(audit.endDate).toLocaleDateString(
                                    "vi-VN"
                                  )}
                                </p>
                                {audit.scope && audit.scope.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-gray-700">
                                      Criteria used:
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {audit.scope.map((criteriaId, cIdx) => {
                                        const criteriaName =
                                          criteria.find(
                                            (c: any) =>
                                              String(
                                                c.criteriaId || c.id || c.$id
                                              ) === String(criteriaId)
                                          )?.name || criteriaId;
                                        return (
                                          <span
                                            key={cIdx}
                                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded"
                                          >
                                            {criteriaName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {(audit as any).templateIds && (audit as any).templateIds.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-gray-700">
                                      Checklist templates used:
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(audit as any).templateIds.map((templateId: string, tIdx: number) => {
                                        const templateName = checklistTemplates.find(
                                          (t: any) => String(t.templateId || t.id || t.$id) === String(templateId)
                                        )?.title || checklistTemplates.find(
                                          (t: any) => String(t.templateId || t.id || t.$id) === String(templateId)
                                        )?.name || `Template ${templateId}`;
                                        return (
                                          <span
                                            key={tIdx}
                                            className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded"
                                          >
                                            {templateName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {conflictData.usedCriteriaIds.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-2">
                          Các tiêu chuẩn đã được ẩn (đã được sử dụng trong audit
                          plan trên):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {conflictData.usedCriteriaIds.map((criteriaId) => {
                            const criteriaName =
                              criteria.find(
                                (c: any) =>
                                  String(c.criteriaId || c.id || c.$id) ===
                                  String(criteriaId)
                              )?.name || criteriaId;
                            return (
                              <span
                                key={criteriaId}
                                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded line-through"
                              >
                                {criteriaName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowConflictModal(false);
                      setConflictData(null);
                      setFilteredCriteria([]);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  {conflictData.severity !== 'critical' && (
                    <button
                      onClick={async () => {
                        // Continue anyway - user acknowledges the conflict
                        setShowConflictModal(false);
                        setConflictData(null);
                        setFilteredCriteria([]);
                        // Retry submit
                        await handleSubmitPlan();
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-600 hover:bg-primary-700 text-white"
                    >
                      Continue anyway
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal &&
          createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={closeDeleteModal}
              />
              
              {/* Modal */}
              <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Confirm Delete
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Are you sure you want to delete this audit plan permanently?
                  </p>
                  
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeDeleteModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeletePlan}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete
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

export default LeadAuditorAuditPlanning;
