import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { AuditPlan, AuditPlanDetails } from '../../../types/auditPlan';
import { getChecklistTemplates } from '../../../api/checklists';
import { 
  createAudit, 
  addAuditScopeDepartment, 
  getAuditApprovals, 
  completeUpdateAuditPlan,
  getAuditPlanById,
  deleteAuditPlan,
  submitToLeadAuditor,
  getAuditScopeDepartmentsByAuditId,
  getAuditPlans
} from '../../../api/audits';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { addCriterionToAudit } from '../../../api/auditCriteriaMap';
import { getAdminUsers } from '../../../api/adminUsers';
import { addTeamMember, getAuditTeam } from '../../../api/auditTeam';
import { getDepartments } from '../../../api/departments';
import { addAuditSchedule, getAuditSchedules } from '../../../api/auditSchedule';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../constants/audit';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { getAuditChecklistTemplateMapsByAudit, syncAuditChecklistTemplateMaps } from '../../../api/auditChecklistTemplateMaps';
import { normalizePlanDetails, unwrap } from '../../../utils/normalize';
import { useUserId } from '../../../store/useAuthStore';
import { hasAuditPlanCreationPermission } from '../../../api/auditPlanAssignment';
import { 
  validateBeforeCreateAudit, 
  validateBeforeAddDepartment
} from '../../../helpers/businessRulesValidation';

// Import custom hooks
import { useAuditPlanForm } from '../../../hooks/useAuditPlanForm';
import { useAuditPlanFilters } from '../../../hooks/useAuditPlanFilters';

// Import helper functions
import { getCriterionName, getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getStatusColor, getBadgeVariant } from '../../../constants';

// Import edit plan service
import { loadPlanDetailsForEdit, prepareCompleteUpdatePayload } from './components/editPlanService';

// Import components
import { FilterBar } from './components/FilterBar';
import { PlanTable } from './components/PlanTable';
import { PlanDetailsModal } from './components/PlanDetailsModal';
import { toast } from 'react-toastify';
import { Step1BasicInfo } from './components/PlanForm/Step1BasicInfo';
import { Step2Scope } from './components/PlanForm/Step2Scope';
import { Step3Checklist } from './components/PlanForm/Step3Checklist';
import { Step4Team } from './components/PlanForm/Step4Team';
import { Step5Schedule } from './components/PlanForm/Step5Schedule';

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const userIdFromToken = useUserId();

  // Use custom hooks for form state management
  const formState = useAuditPlanForm();

  // Check permission to create plans
  const [hasPlanPermission, setHasPlanPermission] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // Data fetching states
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [usedDepartmentIds, setUsedDepartmentIds] = useState<Set<number>>(new Set());
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  // UI: tabs for plans when more than pageSize
  const [activePlansTab, setActivePlansTab] = useState<number>(1);
  const pageSize = 7;

  // Only show plans where current user is in AuditTeam (and status is in allowed list)
  const visiblePlans = useMemo(() => {
    // Determine current user's id for this memo
    const currentId = (() => {
      if (!user) return null;

      const fallbackId =
        (user as any)?.userId ??
        (user as any)?.id ??
        (user as any)?.$id ??
        null;

      if (!allUsers.length) {
        return fallbackId ? String(fallbackId).trim() : null;
      }

      const found = allUsers.find((u: any) => {
        const uEmail = String(u?.email || '').toLowerCase().trim();
        const userEmail = String(user.email || '').toLowerCase().trim();
        return uEmail && userEmail && uEmail === userEmail;
      });

      const resolvedId = found?.userId ?? found?.$id ?? fallbackId;
      return resolvedId != null ? String(resolvedId).trim() : null;
    })();

    // 1) Status filter:
    //    - Chỉ ẩn các plan có trạng thái Inactive
    //    - Các trạng thái khác (kể cả Closed, Rejected, v.v.) đều hiển thị cho Auditor
    const statusFiltered = existingPlans.filter((plan) => {
      const normStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
      return normStatus !== 'inactive';
    });

    // 2) Nếu không xác định được user hiện tại hoặc không có dữ liệu auditTeams, trả về rỗng
    if (!currentId || !auditTeams.length) {
      return [] as AuditPlan[];
    }

    const normalizedCurrentUserId = String(currentId).toLowerCase().trim();

    // 3) Xây set các auditId mà user hiện tại nằm trong AuditTeam (bất kỳ vai trò nào)
    const allowedAuditIds = new Set<string>();
    auditTeams.forEach((m: any) => {
      const memberUserId = m?.userId ?? m?.id ?? m?.$id;
      if (memberUserId == null) return;
      const memberNorm = String(memberUserId).toLowerCase().trim();
      if (!memberNorm || memberNorm !== normalizedCurrentUserId) return;

      const candidates = [m.auditId, m.auditPlanId, m.planId]
        .filter((v: any) => v != null)
        .map((v: any) => String(v).trim())
        .filter(Boolean);

      candidates.forEach((id) => {
        allowedAuditIds.add(id);
        allowedAuditIds.add(id.toLowerCase());
      });
    });

    if (!allowedAuditIds.size) {
      return [] as AuditPlan[];
    }

    const planMatchesUser = (plan: any) => {
      const candidates = [plan.auditId, plan.id, (plan as any).$id]
        .filter((v: any) => v != null)
        .map((v: any) => String(v).trim())
        .filter(Boolean);

      if (!candidates.length) return false;

      return candidates.some((id) => allowedAuditIds.has(id) || allowedAuditIds.has(id.toLowerCase()));
    };

    return statusFiltered.filter(planMatchesUser) as AuditPlan[];
  }, [existingPlans, auditTeams, user, allUsers]);

  // Use filter hook limited to visible statuses & membership
  const filterState = useAuditPlanFilters(visiblePlans);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<any[]>([]);


  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const hydrateTemplateSelection = async (auditId: string, fallbackTemplateId?: string | number | null) => {
    const normalizedFallback = fallbackTemplateId != null ? [String(fallbackTemplateId)] : [];
    if (!auditId) {
      formState.setSelectedTemplateIds(normalizedFallback);
      setTemplatesForSelectedPlan([]);
      return;
    }

    try {
      const maps = await getAuditChecklistTemplateMapsByAudit(String(auditId));
      const normalizedRecords = (maps || [])
        .map((map: any) => ({
          raw: map,
          templateId: map.templateId ?? map.checklistTemplateId ?? map.template?.templateId ?? map.template?.id,
        }))
        .filter((x: any) => x.templateId != null);

      const idList = normalizedRecords.map((x: any) => String(x.templateId));
      const uniqueIds = Array.from(new Set(idList));

      if (uniqueIds.length > 0) {
        formState.setSelectedTemplateIds(uniqueIds);

        const templateCards = normalizedRecords.map((x: any) => {
          const tplFromList = checklistTemplates.find(
            (tpl: any) =>
              String(tpl.templateId || tpl.id || tpl.$id) === String(x.templateId)
          );
          return {
            ...(tplFromList || {}),
            templateId: x.templateId,
          };
        });

        setTemplatesForSelectedPlan(templateCards);
        return;
      }

      setTemplatesForSelectedPlan([]);
    } catch (err) {
      console.warn('Failed to load checklist template maps for audit', auditId, err);
    }

    formState.setSelectedTemplateIds(normalizedFallback);
    setTemplatesForSelectedPlan(
      normalizedFallback.length
        ? checklistTemplates
            .filter((tpl: any) =>
              normalizedFallback.includes(String(tpl.templateId || tpl.id || tpl.$id))
            )
        : []
    );
  };

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
  const validatePlanPeriod = useMemo(() => {
    const validator = (periodFrom?: string, periodTo?: string, showToast = true): boolean => {
      if (!periodFrom || !periodTo) return true;

      const periodStart = new Date(periodFrom).getTime();
      const periodEnd = new Date(periodTo).getTime();

      if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) return true;

      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const startDay = new Date(new Date(periodFrom).getFullYear(), new Date(periodFrom).getMonth(), new Date(periodFrom).getDate()).getTime();

      if (startDay < todayStart) {
        if (showToast) {
          toast.warning('Start date cannot be in the past.');
        }
        return false;
      }

      const MAX_START_OFFSET_DAYS = 180;
      const daysFromToday = Math.floor((startDay - todayStart) / MS_PER_DAY);
      if (daysFromToday > MAX_START_OFFSET_DAYS) {
        if (showToast) {
          toast.warning('Start date cannot be more than 180 days from today.');
        }
        return false;
      }

      if (periodStart > periodEnd) {
        if (showToast) {
          toast.warning('Invalid period: Start date must be earlier than or equal to the end date.');
        }
        return false;
      }

      const MAX_PLAN_DURATION_DAYS = 90;
      const durationInDays = Math.ceil((periodEnd - periodStart) / MS_PER_DAY);
      if (durationInDays > MAX_PLAN_DURATION_DAYS) {
        if (showToast) {
          toast.warning('Audit plans cannot span more than 90 days.');
        }
        return false;
      }

      return true;
    };

    return validator;
  }, []);

  const validateStep1 = useMemo(() => {
    if (
      formState.title.trim() === '' ||
      formState.auditType.trim() === '' ||
      formState.goal.trim() === '' ||
      formState.periodFrom === '' ||
      formState.periodTo === ''
    ) {
      return false;
    }
    return validatePlanPeriod(formState.periodFrom, formState.periodTo, false);
  }, [formState.title, formState.auditType, formState.goal, formState.periodFrom, formState.periodTo, validatePlanPeriod]);

  const validateStep2 = useMemo(() => {
    if (formState.level === 'department') {
      return formState.selectedDeptIds.length > 0 && formState.selectedCriteriaIds.length > 0;
    }
    return formState.selectedCriteriaIds.length > 0;
  }, [formState.level, formState.selectedDeptIds, formState.selectedCriteriaIds]);

  const validateStep3 = useMemo(() => {
    // Basic check: must have at least one template selected
    if (!Array.isArray(formState.selectedTemplateIds) || formState.selectedTemplateIds.length === 0) {
      return false;
    }

    // If level is 'department' and departments are selected, validate that each department has at least one template
    if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
      // Get selected templates with their deptId
      const selectedTemplates = checklistTemplates.filter((tpl: any) =>
        formState.selectedTemplateIds.includes(String(tpl.templateId || tpl.id || tpl.$id))
      );

      // Check if each selected department has at least one template selected
      const selectedDeptIdsSet = new Set(formState.selectedDeptIds.map(id => String(id).trim()));
      const deptIdsWithTemplates = new Set<string>();

      selectedTemplates.forEach((tpl: any) => {
        const tplDeptId = tpl.deptId;
        if (tplDeptId != null && tplDeptId !== undefined) {
          deptIdsWithTemplates.add(String(tplDeptId).trim());
        }
      });

      // Check if all selected departments have at least one template
      for (const deptId of selectedDeptIdsSet) {
        if (!deptIdsWithTemplates.has(deptId)) {
          return false; // At least one department doesn't have a template selected
        }
      }
    }

    return true;
  }, [formState.selectedTemplateIds, formState.level, formState.selectedDeptIds, checklistTemplates]);

  const validateStep4 = useMemo(() => {
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
        deptId: d.deptId ,
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

  // Filter selected templates when departments change (for department level)
  useEffect(() => {
    if (formState.level === 'department' && formState.selectedDeptIds.length > 0 && formState.selectedTemplateIds.length > 0) {
      const selectedDeptIdsSet = new Set(formState.selectedDeptIds.map(id => String(id).trim()));
      
      // Filter selectedTemplateIds to only keep templates that belong to selected departments
      const validTemplateIds = formState.selectedTemplateIds.filter((templateId: string) => {
        const template = checklistTemplates.find(
          (tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(templateId)
        );
        
        if (!template) return false;
        
        const templateDeptId = template.deptId;
        // If template has no deptId, exclude it when specific departments are selected
        if (templateDeptId == null || templateDeptId === undefined) {
          return false;
        }
        
        // Check if template's deptId matches one of the selected departments
        const templateDeptIdStr = String(templateDeptId).trim();
        return selectedDeptIdsSet.has(templateDeptIdStr);
      });
      
      // Only update if there's a change (to avoid infinite loops)
      if (validTemplateIds.length !== formState.selectedTemplateIds.length) {
        console.log('🔍 Filtering selected templates by departments:', {
          before: formState.selectedTemplateIds.length,
          after: validTemplateIds.length,
          selectedDeptIds: formState.selectedDeptIds,
          removed: formState.selectedTemplateIds.filter(id => !validTemplateIds.includes(id))
        });
        formState.setSelectedTemplateIds(validTemplateIds);
      }
    } else if (formState.level === 'department' && formState.selectedDeptIds.length === 0) {
      // If no departments selected, clear all template selections
      if (formState.selectedTemplateIds.length > 0) {
        console.log('🔍 Clearing template selections - no departments selected');
        formState.setSelectedTemplateIds([]);
      }
    }
  }, [formState.level, formState.selectedDeptIds, checklistTemplates]);

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

        try {
          const teams = await getAuditTeam();
          setAuditTeams(Array.isArray(teams) ? teams : []);
        } catch (e) {
          console.error('Failed to load audit teams', e);
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

  // Load used departments in period (Business Rule: Filter departments already used)
  useEffect(() => {
    console.log('[AuditPlanning] 🎯🎯🎯 useEffect triggered for loadUsedDepartments', {
      periodFrom: formState.periodFrom,
      periodTo: formState.periodTo,
      isEditMode: formState.isEditMode,
      editingAuditId: formState.editingAuditId,
      userIdFromToken: userIdFromToken,
      allUsersLength: allUsers.length,
      userEmail: user?.email
    });

    // Early return if no period dates
    if (!formState.periodFrom || !formState.periodTo) {
      console.log('[AuditPlanning] ⚠️ No period dates, clearing used departments');
      setUsedDepartmentIds(new Set());
      return;
    }

    const loadUsedDepartments = async () => {
      console.log('[AuditPlanning] 🔍🔍🔍 START Loading used departments for period:', formState.periodFrom, 'to', formState.periodTo);

      try {
        // Get all audits (including Draft status) and filter by period on frontend
        // This ensures we catch all audits regardless of status
        console.log('[AuditPlanning] 📡 Calling getAuditPlans API to get all audits...');
        const allAuditsResponse = await getAuditPlans();
        console.log('[AuditPlanning] 📡 All audits response (raw):', allAuditsResponse);
        
        const allAuditsList = unwrap(allAuditsResponse);
        console.log('[AuditPlanning] 📡 All audits response (unwrapped):', allAuditsList);
        
        const allAuditsArray = Array.isArray(allAuditsList) ? allAuditsList : [];
        console.log('[AuditPlanning] 📋 Total audits in system:', allAuditsArray.length);
        
        // Get current auditor's userId to exclude their own audits
        let currentAuditorId: string | null = null;
        if (userIdFromToken) {
          currentAuditorId = String(userIdFromToken);
          console.log('[AuditPlanning] 👤 Got auditor ID from token:', currentAuditorId);
        } else if (allUsers.length > 0 && user?.email) {
          console.log('[AuditPlanning] 👤 Looking up auditor ID from allUsers, total users:', allUsers.length);
          const currentUserInList = allUsers.find((u: any) => {
            const uEmail = String(u?.email || '').toLowerCase().trim();
            const userEmail = String(user.email || '').toLowerCase().trim();
            return uEmail && userEmail && uEmail === userEmail;
          });
          if (currentUserInList?.userId) {
            currentAuditorId = String(currentUserInList.userId);
            console.log('[AuditPlanning] 👤 Found auditor ID from allUsers:', currentAuditorId);
          } else {
            console.log('[AuditPlanning] ⚠️ Could not find current user in allUsers list');
          }
        } else {
          console.log('[AuditPlanning] ⚠️ No userIdFromToken and allUsers not loaded yet');
        }
        
        console.log('[AuditPlanning] 👤 Final current auditor ID:', currentAuditorId);
        
        // Filter audits by period (check if period overlaps) AND exclude current auditor's audits
        const periodFromDate = new Date(formState.periodFrom);
        const periodToDate = new Date(formState.periodTo);
        
        console.log('[AuditPlanning] 🔍 Filtering audits by period overlap and excluding current auditor...');
        console.log('[AuditPlanning] 🔍 Period to check:', {
          from: periodFromDate.toISOString(),
          to: periodToDate.toISOString()
        });
        
        const auditsInPeriod = allAuditsArray.filter((audit: any) => {
          // Log full audit object to see structure
          console.log(`[AuditPlanning] 🔍 Checking audit: "${audit.title || audit.auditId}"`, {
            fullAudit: audit,
            periodFrom: audit.periodFrom,
            periodTo: audit.periodTo,
            PeriodFrom: audit.PeriodFrom,
            PeriodTo: audit.PeriodTo,
            startDate: audit.startDate,
            endDate: audit.endDate,
            auditPlan: audit.auditPlan,
            createdBy: audit.createdBy || audit.createdByUserId || audit.auditorId || audit.userId
          });
          
          // Try multiple field names for period dates
          const auditPeriodFrom = audit.periodFrom || audit.PeriodFrom || audit.startDate || 
                                  (audit.auditPlan && audit.auditPlan.periodFrom) ||
                                  (audit.auditPlan && audit.auditPlan.PeriodFrom);
          const auditPeriodTo = audit.periodTo || audit.PeriodTo || audit.endDate ||
                                (audit.auditPlan && audit.auditPlan.periodTo) ||
                                (audit.auditPlan && audit.auditPlan.PeriodTo);
          
          const auditPeriodFromDate = auditPeriodFrom ? new Date(auditPeriodFrom) : null;
          const auditPeriodToDate = auditPeriodTo ? new Date(auditPeriodTo) : null;
          
          console.log(`[AuditPlanning] 🔍 Parsed period dates:`, {
            auditPeriodFrom,
            auditPeriodTo,
            auditPeriodFromDate,
            auditPeriodToDate,
            isValidFrom: auditPeriodFromDate && !isNaN(auditPeriodFromDate.getTime()),
            isValidTo: auditPeriodToDate && !isNaN(auditPeriodToDate.getTime())
          });
          
          if (!auditPeriodFromDate || !auditPeriodToDate || 
              isNaN(auditPeriodFromDate.getTime()) || isNaN(auditPeriodToDate.getTime())) {
            console.log(`[AuditPlanning] ⏭️ Skipping audit "${audit.title || audit.auditId}" - missing or invalid period dates`);
            return false;
          }
          
          // Check if periods overlap: 
          // Periods overlap if: periodFrom <= auditPeriodTo && periodTo >= auditPeriodFrom
          const overlaps = periodFromDate <= auditPeriodToDate && periodToDate >= auditPeriodFromDate;
          
          if (!overlaps) {
            console.log(`[AuditPlanning] ⏭️ Skipping audit "${audit.title || audit.auditId}" - period does not overlap`);
            return false;
          }
          
          // Exclude audits created by current auditor
          const auditCreatedBy = audit.createdBy || audit.createdByUserId || audit.auditorId || audit.userId;
          const auditCreatedById = auditCreatedBy ? String(auditCreatedBy) : null;
          
          console.log(`[AuditPlanning] 🔍 Comparing auditor IDs:`, {
            auditCreatedById,
            currentAuditorId,
            match: currentAuditorId && auditCreatedById && auditCreatedById === currentAuditorId
          });
          
          if (currentAuditorId && auditCreatedById && auditCreatedById === currentAuditorId) {
            console.log(`[AuditPlanning] ⏭️ Skipping audit "${audit.title || audit.auditId}" - created by current auditor (${currentAuditorId})`);
            return false;
          }
          
          console.log(`[AuditPlanning] ✅✅✅ Audit "${audit.title || audit.auditId}" PASSED FILTER - overlaps with period and created by other auditor:`, {
            auditPeriod: `${auditPeriodFromDate.toISOString()} to ${auditPeriodToDate.toISOString()}`,
            searchPeriod: `${periodFromDate.toISOString()} to ${periodToDate.toISOString()}`,
            createdBy: auditCreatedById,
            currentAuditor: currentAuditorId
          });
          
          return true;
        });
        
        console.log('[AuditPlanning] 📋 Found', auditsInPeriod.length, 'audits with overlapping period created by OTHER auditors');
        console.log('[AuditPlanning] 📋 Audits in period details:', auditsInPeriod);
        
        if (auditsInPeriod.length === 0) {
          console.log('[AuditPlanning] ✅ No audits with overlapping period from other auditors, all departments available');
          setUsedDepartmentIds(new Set());
          return;
        }
        
        const auditsArray = auditsInPeriod;

        // Get all departments from these audits
        const usedDeptIds = new Set<number>();
        
        // Load departments from each audit in parallel
        console.log('[AuditPlanning] 📦 Starting to load departments from', auditsArray.length, 'audits...');
        const departmentPromises = auditsArray.map(async (audit: any) => {
          try {
            const auditId = audit.auditId || audit.id || audit.$id;
            if (!auditId) {
              console.warn('[AuditPlanning] ⚠️ Audit missing ID:', audit);
              return [];
            }
            
            // Skip if this is the audit being edited
            if (formState.isEditMode && formState.editingAuditId === String(auditId)) {
              console.log('[AuditPlanning] ⏭️ Skipping current audit being edited:', auditId);
              return [];
            }
            
            console.log(`[AuditPlanning] 📡 Loading departments for audit ${auditId}...`);
            // Get departments for this audit
            const auditDepts = await getAuditScopeDepartmentsByAuditId(String(auditId));
            console.log(`[AuditPlanning] 📡 Departments response for audit ${auditId}:`, auditDepts);
            
            const deptList = unwrap(auditDepts);
            const deptArray = Array.isArray(deptList) ? deptList : [];
            
            console.log(`[AuditPlanning] 📦 Audit "${audit.title || auditId}" has ${deptArray.length} departments:`, deptArray);
            
            const deptIds: number[] = [];
            deptArray.forEach((dept: any) => {
              // Try multiple ways to get deptId
              const deptId = dept.deptId ?? dept.dept?.deptId ?? dept.id ?? dept.$id;
              if (deptId) {
                const deptIdNum = Number(deptId);
                if (!isNaN(deptIdNum) && deptIdNum > 0) {
                  deptIds.push(deptIdNum);
                  const deptName = dept.name ?? dept.dept?.name ?? 'unknown';
                  console.log(`[AuditPlanning] ✅ Found used department: ${deptName} (ID: ${deptIdNum})`);
                } else {
                  console.warn(`[AuditPlanning] ⚠️ Invalid deptId format:`, deptId, 'from dept:', dept);
                }
              } else {
                console.warn(`[AuditPlanning] ⚠️ Department missing ID:`, dept);
              }
            });
            
            console.log(`[AuditPlanning] ✅ Audit ${auditId} returned ${deptIds.length} department IDs:`, deptIds);
            return deptIds;
          } catch (err: any) {
            console.error(`[AuditPlanning] ❌ Failed to load departments for audit ${audit.auditId || audit.id}:`, err);
            console.error(`[AuditPlanning] Error stack:`, err?.stack);
            return [];
          }
        });

        // Wait for all promises to resolve
        console.log('[AuditPlanning] ⏳ Waiting for all department promises to resolve...');
        const allDeptIdArrays = await Promise.all(departmentPromises);
        console.log('[AuditPlanning] ✅ All promises resolved. Results:', allDeptIdArrays);
        
        // Flatten and add to set
        allDeptIdArrays.forEach((deptIds, index) => {
          console.log(`[AuditPlanning] Processing deptIds from audit ${index}:`, deptIds);
          deptIds.forEach(deptId => {
            usedDeptIds.add(deptId);
          });
        });

        setUsedDepartmentIds(usedDeptIds);
        console.log('[AuditPlanning] ✅✅✅ Final used departments SET:', Array.from(usedDeptIds), 'Total:', usedDeptIds.size);
      } catch (error: any) {
        console.error('[AuditPlanning] ❌❌❌ Failed to load used departments:', error);
        console.error('[AuditPlanning] Error type:', typeof error);
        console.error('[AuditPlanning] Error response:', error?.response);
        console.error('[AuditPlanning] Error data:', error?.response?.data);
        console.error('[AuditPlanning] Error message:', error?.message);
        console.error('[AuditPlanning] Error stack:', error?.stack);
        setUsedDepartmentIds(new Set());
      }
    };

    // Call immediately, no debounce to ensure it runs
    console.log('[AuditPlanning] ⏰ Calling loadUsedDepartments immediately...');
    loadUsedDepartments().catch((error) => {
      console.error('[AuditPlanning] ❌❌❌ Error in loadUsedDepartments:', error);
    });
  }, [formState.periodFrom, formState.periodTo, formState.isEditMode, formState.editingAuditId, userIdFromToken, allUsers, user?.email]);

  // Filter departments: remove already used ones
  const availableDepartments = useMemo(() => {
    console.log('[AuditPlanning] 🔄 Computing availableDepartments...', {
      hasPeriod: !!(formState.periodFrom && formState.periodTo),
      periodFrom: formState.periodFrom,
      periodTo: formState.periodTo,
      totalDepartments: departments.length,
      usedCount: usedDepartmentIds.size,
      usedIds: Array.from(usedDepartmentIds)
    });

    // Only filter if we have period dates
    if (!formState.periodFrom || !formState.periodTo) {
      console.log('[AuditPlanning] ⚠️ No period dates, showing all departments');
      return departments;
    }
    
    // If no used departments found yet, show all (might still be loading)
    if (usedDepartmentIds.size === 0) {
      console.log('[AuditPlanning] ⚠️ No used departments found (might still be loading), showing all departments');
      return departments;
    }
    
    const filtered = departments.filter((dept) => {
      const deptId = Number(dept.deptId);
      if (isNaN(deptId)) {
        console.warn('[AuditPlanning] ⚠️ Invalid department ID:', dept);
        return true; // Keep invalid IDs (shouldn't happen)
      }
      const isUsed = usedDepartmentIds.has(deptId);
      if (isUsed) {
        console.log(`[AuditPlanning] 🔴 FILTERING OUT: ${dept.name} (ID: ${deptId}) - already used in period`);
      }
      return !isUsed;
    });
    
    const usedDeptNames = departments
      .filter(d => {
        const id = Number(d.deptId);
        return !isNaN(id) && usedDepartmentIds.has(id);
      })
      .map(d => `${d.name} (ID: ${d.deptId})`);
    
    console.log('[AuditPlanning] ✅ FILTERED DEPARTMENTS RESULT:', {
      total: departments.length,
      used: usedDepartmentIds.size,
      available: filtered.length,
      usedIds: Array.from(usedDepartmentIds),
      usedDeptNames: usedDeptNames,
      availableDeptNames: filtered.map(d => `${d.name} (ID: ${d.deptId})`)
    });
    
    return filtered;
  }, [departments, usedDepartmentIds, formState.periodFrom, formState.periodTo]);

  // Check permission to create plans
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.email) {
        setIsCheckingPermission(false);
        setHasPlanPermission(false);
        return;
      }

      try {
        // Get userId (GUID) from allUsers list by email
        // This is the actual userId that matches the auditorId in assignments
        let currentUserId: string | null = null;
        
        if (allUsers.length > 0) {
          const currentUserInList = allUsers.find((u: any) => {
            const uEmail = String(u?.email || '').toLowerCase().trim();
            const userEmail = String(user.email || '').toLowerCase().trim();
            return uEmail && userEmail && uEmail === userEmail;
          });
          
          if (currentUserInList?.userId) {
            currentUserId = String(currentUserInList.userId);
          }
        }
        
        // Fallback to userIdFromToken if not found in allUsers
        if (!currentUserId && userIdFromToken) {
          currentUserId = String(userIdFromToken);
        }
        
        if (!currentUserId) {
          console.warn('[AuditPlanning] Cannot find userId for permission check');
          setHasPlanPermission(false);
          setIsCheckingPermission(false);
          return;
        }
        
        console.log('[AuditPlanning] Checking permission for userId:', currentUserId);
        
        // Check permission using the actual userId (GUID)
        const hasPermission = await hasAuditPlanCreationPermission(currentUserId);
        console.log('[AuditPlanning] Permission result:', hasPermission);
        setHasPlanPermission(hasPermission);
      } catch (error) {
        console.error('[AuditPlanning] Failed to check plan creation permission', error);
        setHasPlanPermission(false);
      } finally {
        setIsCheckingPermission(false);
      }
    };

    // Wait for allUsers to be loaded before checking permission
    if (allUsers.length > 0 || user?.email) {
      checkPermission();
    }
  }, [userIdFromToken, user?.email, allUsers]);

  // Load audit plans
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (error) {
        console.error('❌ Failed to load audit plans', error);
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
    try {
      const deptList = await ensureDepartmentsLoaded();

      try {
        const rawDetails = await getAuditPlanById(auditId);

        // Fetch schedules separately if not included in main response
        let schedulesData = rawDetails?.schedules;
        if (
          !schedulesData ||
          (!schedulesData.values && !schedulesData.$values && !Array.isArray(schedulesData))
        ) {
          try {
            const schedulesResponse = await getAuditSchedules(auditId);
            const { unwrap } = await import('../../../utils/normalize');
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

        // Load approvals history only if plan is rejected (API is only for getting rejections)
        let latestRejectionComment: string | null = null;
        const planStatus = String(detailsWithSchedules.status || detailsWithSchedules.audit?.status || '').toLowerCase();
        const isRejected = planStatus.includes('rejected');
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          latestRejectionComment = detailsWithSchedules.comment || 
                                  
                                   detailsWithSchedules.note || 
                                   detailsWithSchedules.audit?.comment ||
    
                                   detailsWithSchedules.audit?.note ||
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(detailsWithSchedules.auditId || detailsWithSchedules.id || auditId).trim().toLowerCase();
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
              const related = approvals.filter((a: any) => {
                const approvalAuditId = String(a.auditId || a.audit?.auditId || a.audit?.id || '').trim().toLowerCase();
                return approvalAuditId === currentAuditId && approvalAuditId !== '';
              });
              
              if (related.length > 0) {
                const rejected = related
                  .filter((a: any) => {
                    const approvalStatus = String(a.status || '').toLowerCase();
                    return approvalStatus.includes('rejected') || approvalStatus === 'rejected';
                  })
                  .sort((a: any, b: any) => {
                    const aTime = new Date(a.approvedAt || a.createdAt || 0).getTime();
                    const bTime = new Date(b.approvedAt || b.createdAt || 0).getTime();
                    return bTime - aTime;
                  });
                
                if (rejected.length > 0) {
                  // Try multiple possible field names for comment
                  latestRejectionComment = rejected[0].comment || 
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn('⚠️ Rejection comment not found for audit:', currentAuditId, {
                      rejectedItem: rejected[0],
                      allFields: Object.keys(rejected[0])
                    });
                  }
                }
              } else {
                console.warn('⚠️ No related approvals found for audit:', currentAuditId, {
                  totalApprovals: approvals.length,
                  sampleApproval: approvals[0]
                });
              }
            } catch (approvalErr) {
              console.error('Failed to load audit approvals for plan', approvalErr);
            }
          }
        }

        const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
          departments: deptList,
          criteriaList: criteria,
          users: [...auditorOptions, ...ownerOptions],
        });

        const detailsWithRejection = {
          ...normalizedDetails,
          latestRejectionComment,
        };

        setSelectedPlanDetails(detailsWithRejection);
        await hydrateTemplateSelection(auditId, detailsWithRejection.templateId);
        setShowDetailsModal(true);
        return;
      } catch (apiError) {
        const planFromTable = existingPlans.find((p) => p.auditId === auditId || p.id === auditId);

        if (!planFromTable) {
          throw new Error(
            'Plan not found in table. Backend API /AuditPlan/{id} is also returning 500 error.'
          );
        }

        // Try to fetch schedules even if main API failed
        let schedulesData: { values: any[] } = { values: [] };
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const { unwrap } = await import('../../../utils/normalize');
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          // Failed to fetch schedules separately, using empty array
        }

        // Only fetch approvals if plan is rejected (API is only for getting rejections)
        let latestRejectionComment: string | null = null;
        const planStatus = String(planFromTable.status || '').toLowerCase();
        const isRejected = planStatus.includes('rejected');
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          const planFromTableAny = planFromTable as any;
          latestRejectionComment = planFromTableAny.comment || 
                                   planFromTableAny.rejectionComment || 
                                   planFromTableAny.rejectionReason || 
                                   planFromTableAny.note || 
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(planFromTable.auditId || planFromTable.id || auditId).trim().toLowerCase();
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
              const related = approvals.filter((a: any) => {
                const approvalAuditId = String(a.auditId || a.audit?.auditId || a.audit?.id || '').trim().toLowerCase();
                return approvalAuditId === currentAuditId && approvalAuditId !== '';
              });
              
              if (related.length > 0) {
                const rejected = related
                  .filter((a: any) => {
                    const approvalStatus = String(a.status || '').toLowerCase();
                    return approvalStatus.includes('rejected') || approvalStatus === 'rejected';
                  })
                  .sort((a: any, b: any) => {
                    const aTime = new Date(a.approvedAt || a.createdAt || 0).getTime();
                    const bTime = new Date(b.approvedAt || b.createdAt || 0).getTime();
                    return bTime - aTime;
                  });
                
                if (rejected.length > 0) {
                  // Try multiple possible field names for comment
                  latestRejectionComment = rejected[0].comment || 
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn('⚠️ Rejection comment not found for audit:', currentAuditId, {
                      rejectedItem: rejected[0],
                      allFields: Object.keys(rejected[0])
                    });
                  }
                }
              } else {
                console.warn('⚠️ No related approvals found for audit:', currentAuditId, {
                  totalApprovals: approvals.length,
                  sampleApproval: approvals[0]
                });
              }
            } catch (approvalErr) {
              console.error('Failed to load audit approvals for basic details', approvalErr);
            }
          }
        }

        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: schedulesData,
          createdByUser: {
            fullName: planFromTable.createdBy || 'Unknown',
            email: 'N/A',
            roleName: 'N/A',
          },
          latestRejectionComment,
        };

        alert(
          '⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team) is not available.\nSchedules have been fetched separately.\n\nPlease contact backend team to fix this endpoint.'
        );

        setSelectedPlanDetails(basicDetails);
        await hydrateTemplateSelection(auditId, basicDetails.templateId);
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error('❌ Failed to fetch plan details', error);
      alert('⚠️ Cannot load full plan details\n\n' +
        'The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n' +
        'Error: ' + (error as any)?.message);
    }
  };

  // Helper: Check if current user is the creator of the plan
  const isCurrentUserCreator = useMemo(() => {
    return (plan: AuditPlan): boolean => {
      if (!user || !plan) return false;

      // Get current user's ID
      const fallbackId =
        (user as any)?.userId ??
        (user as any)?.id ??
        (user as any)?.$id ??
        null;

      let currentUserId: string | null = null;
      
      if (!allUsers.length) {
        currentUserId = fallbackId ? String(fallbackId).trim() : null;
      } else {
        const found = allUsers.find((u: any) => {
          const uEmail = String(u?.email || '').toLowerCase().trim();
          const userEmail = String(user.email || '').toLowerCase().trim();
          return uEmail && userEmail && uEmail === userEmail;
        });
        currentUserId = found?.userId ?? found?.$id ?? fallbackId;
        currentUserId = currentUserId != null ? String(currentUserId).trim() : null;
      }

      if (!currentUserId) return false;

      // Get plan's createdBy (could be userId or email)
      const planCreatedBy = plan.createdBy;
      if (!planCreatedBy) return false;

      const normalizedCurrentUserId = String(currentUserId).toLowerCase().trim();
      const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();

      // Compare by userId
      if (normalizedCreatedBy === normalizedCurrentUserId) {
        return true;
      }

      // Compare by email (if createdBy is email)
      const userEmail = String(user.email || '').toLowerCase().trim();
      if (normalizedCreatedBy === userEmail) {
        return true;
      }

      // Also check if createdBy matches any userId in allUsers that matches current user's email
      const createdByUser = allUsers.find((u: any) => {
        const uId = String(u?.userId ?? '').toLowerCase().trim();
        const uEmail = String(u?.email || '').toLowerCase().trim();
        return (uId === normalizedCreatedBy) || (uEmail === normalizedCreatedBy);
      });

      if (createdByUser) {
        const createdByUserEmail = String(createdByUser?.email || '').toLowerCase().trim();
        if (createdByUserEmail === userEmail) {
          return true;
        }
      }

      return false;
    };
  }, [user, allUsers]);

  // Handler: Open delete confirmation modal
  const openDeleteModal = (auditId: string) => {
    // Find the plan to check its status
    const planToDelete = existingPlans.find(p => (p.auditId || p.id) === auditId);
    
    if (!planToDelete) {
      toast.error('Plan not found.');
      return;
    }

    // Normalize status for comparison (remove spaces, convert to lowercase)
    const normalizedStatus = String(planToDelete.status || 'draft').toLowerCase().replace(/\s+/g, '');
    
    // Only allow delete if status is Draft
    if (normalizedStatus !== 'draft') {
      toast.warning('Only Draft status can be deleted.');
      return;
    }

    // Check if current user is the creator of the plan
    if (!isCurrentUserCreator(planToDelete)) {
      toast.warning('Only the creator of the plan can delete it.');
      return;
    }

    
    setPlanToDeleteId(auditId);
    setShowDeleteModal(true);
  };

  // Handler: Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPlanToDeleteId(null);
  };

  // Handler: Delete plan (only allowed for Draft status and by creator)
  const handleDeletePlan = async () => {
    if (!planToDeleteId) return;
    
    // Find the plan to verify permissions
    const planToDelete = existingPlans.find(p => (p.auditId || p.id) === planToDeleteId);
    
    if (!planToDelete) {
      toast.error('Plan not found.');
      closeDeleteModal();
      return;
    }

    // Double-check status (defense in depth)
    const normalizedStatus = String(planToDelete.status || 'draft').toLowerCase().replace(/\s+/g, '');
    if (normalizedStatus !== 'draft') {
      toast.warning('Only Draft status can be deleted.');
      closeDeleteModal();
      return;
    }

    // Double-check creator (defense in depth)
    if (!isCurrentUserCreator(planToDelete)) {
      toast.warning('Only the creator of the plan can delete it.');
      closeDeleteModal();
      return;
    }
    
    try {
      await deleteAuditPlan(planToDeleteId);

      setExistingPlans(prevPlans =>
        prevPlans.filter(p => (p.auditId || p.id) !== planToDeleteId)
      );

      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (err) {
        console.error('Failed to refresh plans after delete', err);
      }
      
      closeDeleteModal();
      toast.success('Audit plan deleted successfully.');
    } catch (error: any) {
      console.error('❌ Failed to delete plan', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error('Delete failed: ' + errorMessage);
    }
  };

  // Handler: Edit plan
  const handleEditPlan = async (auditId: string) => {
    try {
      // Load plan details using service
      const detailsWithId = await loadPlanDetailsForEdit(auditId, existingPlans);
      
      // Use formState.loadPlanForEdit with the best-effort details
      formState.loadPlanForEdit(detailsWithId);
      await hydrateTemplateSelection(auditId, detailsWithId?.templateId);

    } catch (error) {
      console.error('❌ Failed to load plan for editing', error);
      alert('⚠️ Cannot load plan for editing\n\nError: ' + (error as any)?.message);
    }
  };

  // Handler: Submit plan to Lead Auditor (status change Draft -> Pending)
  const handleSubmitToLead = async (auditId: string) => {
    try {
      await submitToLeadAuditor(auditId);

      // Refresh plans list to reflect new status
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error('Failed to refresh plans after submit', refreshErr);
      }

      toast.success('Submit successfully.');
    } catch (err: any) {
      console.error('❌ Failed to submit to Lead Auditor', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to submit to Lead Auditor: ' + errorMessage);
    }
  };

  // Get current user's userId for PlanDetailsModal only (list filtering uses inline logic above)
  const currentUserId = useMemo(() => {
    if (!user) return null;

    const fallbackId =
      (user as any)?.userId ??
      (user as any)?.id ??
      (user as any)?.$id ??
      null;

    if (!allUsers.length) {
      return fallbackId ? String(fallbackId).trim() : null;
    }

    const found = allUsers.find((u: any) => {
      const uEmail = String(u?.email || '').toLowerCase().trim();
      const userEmail = String(user.email || '').toLowerCase().trim();
      return uEmail && userEmail && uEmail === userEmail;
    });

    const resolvedId = found?.userId ?? found?.$id ?? fallbackId;
    return resolvedId != null ? String(resolvedId).trim() : null;
  }, [user, allUsers]);

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


  // Handler: Submit plan
  const handleSubmitPlan = async () => {
    // Client-side validation
    if (!formState.title.trim()) {
      toast.warning('Please enter a title for the plan.');
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.periodFrom || !formState.periodTo) {
      toast.warning('Please select the start and end dates.');
      formState.setCurrentStep(1);
      return;
    }

    if (!validatePlanPeriod(formState.periodFrom, formState.periodTo, true)) {
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.selectedTemplateIds.length) {
      toast.warning('Please select at least one Checklist Template (Step 3).');
      formState.setCurrentStep(3);
      return;
    }
    if (formState.level === 'department') {
      if (formState.selectedDeptIds.length === 0) {
        toast.warning('Please select at least one department for the Department scope (Step 2).');
        formState.setCurrentStep(2);
        return;
      }
      const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
      if (ownersForDepts.length === 0) {
        if (!window.confirm('⚠️ The selected departments do not have an Auditee Owner yet.\n\nDo you want to continue creating the audit plan?')) {
          formState.setCurrentStep(4);
          return;
        }
      }
    }

    // Schedule constraints: unique dates and strictly increasing order
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    if (scheduleErrorMessages.length > 0) {
      toast.error('Invalid schedule:\n\n' + scheduleErrorMessages.join('\n'));
      formState.setCurrentStep(5);
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

    try {
      let auditId: string;

      console.log('🔍 Submit Plan - isEditMode:', formState.isEditMode, 'editingAuditId:', formState.editingAuditId);
      console.log('🔍 FormState object:', { 
        isEditMode: formState.isEditMode, 
        editingAuditId: formState.editingAuditId,
        showForm: formState.showForm 
      });

      // Check if we're in edit mode but editingAuditId is missing
      if (formState.isEditMode && !formState.editingAuditId) {
        console.error('⚠️ WARNING: isEditMode is true but editingAuditId is empty!');
        console.error('⚠️ This should not happen. Check loadPlanForEdit function.');
        toast.error('Cannot update: Missing audit ID. Please try editing again.');
        return;
      }

      if (formState.isEditMode && formState.editingAuditId) {
        // Use complete-update API for edit mode
        console.log('✏️ EDIT MODE DETECTED - Will use complete-update API');
        auditId = formState.editingAuditId;
        console.log('✏️ Using auditId for update:', auditId);

        // Prepare complete update payload using service
        const completeUpdatePayload = prepareCompleteUpdatePayload({
          auditId,
          basicPayload,
          formState,
          departments,
          ownerOptions,
          currentUserId,
          user,
        });

        console.log('🔄 Calling complete-update API for audit:', auditId);
        console.log('📦 Payload:', JSON.stringify(completeUpdatePayload, null, 2));
        try {
          const result = await completeUpdateAuditPlan(auditId, completeUpdatePayload);
          console.log('✅ Complete-update API called successfully', result);
        } catch (apiError) {
          console.error('❌ Complete-update API failed:', apiError);
          throw apiError; // Re-throw to be caught by outer try-catch
        }
      } else {
        // Create new audit (keep existing logic)
        console.log('➕ CREATE MODE - Will use createAudit API');
        
        // Business Rule Validation: Validate trước khi tạo audit
        const startDate = formState.periodFrom;
        const endDate = formState.periodTo;
        
        if (startDate && endDate) {
          // Lấy danh sách department IDs sẽ được thêm
          let deptIdsToValidate: number[] = [];
          if (formState.level === 'academy') {
            deptIdsToValidate = departments.map((d) => Number(d.deptId));
          } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
            deptIdsToValidate = formState.selectedDeptIds.map(id => Number(id));
          }
          
          const validation = await validateBeforeCreateAudit(startDate, endDate, deptIdsToValidate);
          
          if (!validation.isValid) {
            // Hiển thị tất cả lỗi
            validation.errors.forEach(error => {
              toast.error(error);
            });
            // Hiển thị cảnh báo nếu có
            validation.warnings.forEach(warning => {
              toast.warning(warning);
            });
            throw new Error('Validation failed. Please check the errors above.');
          }
          
          // Hiển thị cảnh báo nếu có (nhưng vẫn cho phép tiếp tục)
          if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
              toast.warning(warning);
            });
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
          console.error('❌ Failed to sync checklist templates', templateMapErr);
          toast.error('Failed to save checklist template mappings. Please retry from Step 3.');
        }

        // Attach departments
        try {
          let deptIdsToAttach: string[] = [];
          
          if (formState.level === 'academy') {
            // When level is "Entire Aviation Academy", attach all departments
            deptIdsToAttach = departments.map((d) => String(d.deptId));
          } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
            // When level is "Department", attach only selected departments
            deptIdsToAttach = formState.selectedDeptIds;
          }
          
          if (deptIdsToAttach.length > 0) {
            // Business Rule Validation: Validate từng department trước khi thêm
            const startDate = formState.periodFrom;
            const endDate = formState.periodTo;
            
            const deptResults = await Promise.allSettled(
              deptIdsToAttach.map(async (deptId) => {
                // Validate department không trùng
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
                
                // Nếu validation pass, mới thêm department
                return await addAuditScopeDepartment(String(newAuditId), Number(deptId));
              })
            );
            
            const failedDepts = deptResults.filter((r) => r.status === 'rejected');
            if (failedDepts.length > 0) {
              console.error('❌ Some departments failed to attach:', failedDepts);
              toast.warning(`${failedDepts.length} department(s) failed to attach. Please check the errors above.`);
            }
          }
          } catch (scopeErr) {
            console.error('❌ Attach departments to audit failed', scopeErr);
        }

        // Attach criteria
        if (Array.isArray(formState.selectedCriteriaIds) && formState.selectedCriteriaIds.length > 0) {
          try {
            await Promise.allSettled(
              formState.selectedCriteriaIds.map((cid) => addCriterionToAudit(String(newAuditId), String(cid)))
            );
          } catch (critErr) {
            console.error('❌ Attach criteria to audit failed', critErr);
          }
        }

        // Add team members
        try {
          const calls: Promise<any>[] = [];
          const auditorSet = new Set<string>(formState.selectedAuditorIds);

          auditorSet.forEach((uid) => {
            calls.push(
              addTeamMember({
                auditId: String(newAuditId),
                userId: uid,
                roleInTeam: 'Auditor',
                isLead: false,
              })
            );
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
          console.error('❌ Attach team failed', teamErr);
        }

        // Post schedules
        try {
          const schedulePairs = [
            { name: MILESTONE_NAMES.KICKOFF, date: formState.kickoffMeeting },
            { name: MILESTONE_NAMES.FIELDWORK, date: formState.fieldworkStart },
            { name: MILESTONE_NAMES.EVIDENCE, date: formState.evidenceDue },
            { name: MILESTONE_NAMES.CAPA, date: formState.capaDue },
            { name: MILESTONE_NAMES.DRAFT, date: formState.draftReportDue },
          ].filter(pair => pair.date);

          if (schedulePairs.length > 0) {
            const schedulePromises = schedulePairs.map(pair =>
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
          console.error('❌ Failed to post schedules', scheduleErr);
        }
      }

      // Refresh plans list and related data
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error('❌ Failed to refresh plans list', refreshErr);
      }

      // Refresh audit teams (needed for visiblePlans calculation)
      try {
        const teams = await getAuditTeam();
        setAuditTeams(Array.isArray(teams) ? teams : []);
      } catch (teamErr) {
        console.error('❌ Failed to refresh audit teams', teamErr);
      }

      // Refresh users (needed for visiblePlans calculation)
      try {
        const users = await getAdminUsers();
        setAllUsers(Array.isArray(users) ? users : []);
        const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
        const auditors = (users || []).filter((u: any) => norm(u.roleName) === 'auditor');
        const owners = (users || []).filter((u: any) => norm(u.roleName) === 'auditeeowner');
        setAuditorOptions(auditors);
        setOwnerOptions(owners);
      } catch (userErr) {
        console.error('❌ Failed to refresh users', userErr);
      }

      // Save edit mode state before resetting form
      const wasEditMode = formState.isEditMode;
      
      // Reset form (closes form after successful creation)
      formState.resetForm();

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
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Audit Planning</h1>
            <p className="text-gray-600 text-sm mt-1">Create and manage audit plans</p>
          </div>
          <button
            onClick={() => {
              // Check permission before opening form
              if (isCheckingPermission) {
                toast.info('Checking permission...');
                return;
              }

              if (hasPlanPermission === false) {
                // Show permission modal
                setShowPermissionModal(true);
                return;
              }

              // If form is currently open and in edit mode, reset it first
              if (formState.showForm && formState.isEditMode) {
                formState.resetFormForCreate();
              } else if (!formState.showForm) {
                // If form is closed, reset and open it
                formState.resetFormForCreate();
                formState.setShowForm(true);
              } else {
                // If form is open and not in edit mode, just close it
                formState.setShowForm(false);
              }
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create New Plan
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Permission Granted Banner */}
        {hasPlanPermission === true && !isCheckingPermission && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800 mb-1">
                  Plan Creation Permission Granted
                </h3>
                <p className="text-sm text-green-700">
                  You have been granted permission to create audit plans. Click the "Create New Plan" button above to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {formState.showForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary-600">
                {formState.isEditMode ? 'Edit Audit Plan' : 'New Audit Plan'}
              </h2>
              {formState.isEditMode && (
                <span className="px-3 py-1 bg-sky-100 text-sky-800 text-sm font-medium rounded-md">
                  Editing Mode
                </span>
              )}
            </div>

            {/* Progress Stepper */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${formState.currentStep === step
                          ? 'bg-primary-600 text-white'
                          : formState.currentStep > step
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                        {formState.currentStep > step ? '✓' : step}
                      </div>
                      <span className={`text-xs mt-1 ${formState.currentStep === step ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}>
                        {step === 1 && 'Plan'}
                        {step === 2 && 'Scope'}
                        {step === 3 && 'Checklist'}
                        {step === 4 && 'Team'}
                        {step === 5 && 'Schedule'}
                      </span>
                    </div>
                    {step < 5 && (
                      <div className={`h-1 flex-1 mx-2 ${formState.currentStep > step ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Components */}
            <div className="space-y-4">
              {formState.currentStep === 1 && (
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
                />
              )}

              {formState.currentStep === 2 && (
                <Step2Scope
                  level={formState.level}
                  selectedDeptIds={formState.selectedDeptIds}
                  departments={availableDepartments}
                  criteria={criteria}
                  selectedCriteriaIds={formState.selectedCriteriaIds}
                  onLevelChange={formState.setLevel}
                  onSelectedDeptIdsChange={formState.setSelectedDeptIds}
                  onCriteriaToggle={(id: string) => {
                    const val = String(id);
                    formState.setSelectedCriteriaIds((prev) =>
                      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
                    );
                  }}
                />
              )}

              {formState.currentStep === 3 && (
                <Step3Checklist
                  checklistTemplates={checklistTemplates}
                  selectedTemplateIds={formState.selectedTemplateIds}
                  onSelectionChange={formState.setSelectedTemplateIds}
                  level={formState.level}
                  selectedDeptIds={formState.selectedDeptIds}
                  departments={departments}
                />
              )}

              {formState.currentStep === 4 && (
                <Step4Team
                  level={formState.level}
                  selectedDeptIds={formState.selectedDeptIds}
                  selectedAuditorIds={formState.selectedAuditorIds}
                  auditorOptions={auditorOptions}
                  ownerOptions={ownerOptions}
                  departments={departments}
                  onAuditorsChange={formState.setSelectedAuditorIds}
                />
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

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-3 pt-6 border-t">
                <button
                  onClick={() => {
                    if (formState.currentStep > 1) {
                      formState.setCurrentStep(formState.currentStep - 1);
                    } else {
                      // Step 1 - Cancel button
                      if (hasFormData || formState.isEditMode) {
                        if (window.confirm('Are you sure you want to cancel?')) {
                          formState.resetForm();
                        }
                    } else {
                      formState.setShowForm(false);
                      formState.setCurrentStep(1);
                      }
                    }
                  }}
                  className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  {formState.currentStep === 1 ? 'Cancel' : '← Back'}
                </button>

                <div className="flex gap-3">
                  {formState.currentStep < 5 && (
                    <button
                      onClick={() => {
                        if (canContinue) {
                          formState.setCurrentStep(formState.currentStep + 1);
                        } else {
                          // Show validation message based on current step
                          let message = '';
                          switch (formState.currentStep) {
                            case 1:
                              message = 'Please fill in the information: Title, Type, Period From, and Period To.';
                              break;
                            case 2:
                              message = formState.level === 'department'
                                ? 'Please select at least 1 department and 1 inspection criterion'
                                : 'Please select at least 1 inspection criterion';
                              break;
                            case 3:
                              if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
                                // Get selected templates with their deptId
                                const selectedTemplates = checklistTemplates.filter((tpl: any) =>
                                  formState.selectedTemplateIds.includes(String(tpl.templateId || tpl.id || tpl.$id))
                                );
                                const selectedDeptIdsSet = new Set(formState.selectedDeptIds.map(id => String(id).trim()));
                                const deptIdsWithTemplates = new Set<string>();
                                selectedTemplates.forEach((tpl: any) => {
                                  const tplDeptId = tpl.deptId;
                                  if (tplDeptId != null && tplDeptId !== undefined) {
                                    deptIdsWithTemplates.add(String(tplDeptId).trim());
                                  }
                                });
                                const missingDepts = Array.from(selectedDeptIdsSet).filter(deptId => !deptIdsWithTemplates.has(deptId));
                                if (missingDepts.length > 0) {
                                  const deptNames = missingDepts.map(deptId => {
                                    const dept = departments.find(d => String(d.deptId) === deptId);
                                    return dept?.name || deptId;
                                  }).join(', ');
                                  message = `Please select at least one template for each selected department. Missing templates for: ${deptNames}`;
                                } else {
                                  message = 'Please select a Checklist Template.';
                                }
                              } else {
                                message = 'Please select a Checklist Template.';
                              }
                              break;
                            case 4:
                              message = 'Please select Lead Auditor.';
                              break;
                            default:
                              message = 'Please fill in all information before continuing.';
                          }
                          toast.warning(message);
                        }
                      }}
                      disabled={!canContinue}
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                        canContinue
                          ? 'bg-primary-600 hover:bg-primary-700 text-white cursor-pointer'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Continue →
                    </button>
                  )}
                  {formState.currentStep === 5 && (
                    <>
                      <button
                        onClick={handleSubmitPlan}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                      >
                        {formState.isEditMode ? ' Update Plan' : ' Submit Plan'}
                      </button>
                      {formState.isEditMode && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel?')) {
                              formState.resetForm();
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
        )}

        {/* Plans Table with Filters */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Existing Audit Plans</h2>
          </div>

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
            onDeletePlan={openDeleteModal}
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
        {showDetailsModal && selectedPlanDetails && (
          <PlanDetailsModal
            showModal={showDetailsModal}
            selectedPlanDetails={selectedPlanDetails}
            templatesForPlan={templatesForSelectedPlan}
            onClose={() => setShowDetailsModal(false)}
            onEdit={handleEditPlan}
            onSubmitToLead={handleSubmitToLead}
            currentUserId={currentUserId}
            auditTeamsForPlan={(() => {
              // Get audit teams for the current plan being viewed
              if (!selectedPlanDetails?.auditId && !selectedPlanDetails?.id) return [];
              const currentAuditId = String(selectedPlanDetails.auditId || selectedPlanDetails.id).trim();
              return auditTeams.filter((m: any) => {
                const teamAuditId = String(m?.auditId || '').trim();
                return teamAuditId === currentAuditId || teamAuditId.toLowerCase() === currentAuditId.toLowerCase();
              });
            })()}
            getCriterionName={(id: string) => getCriterionName(id, criteria)}
            getDepartmentName={(id: string | number) => getDepartmentName(id, departments)}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            getTemplateName={(tid) => {
              const t = checklistTemplates.find((tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(tid));
              return t?.title || t?.name || `Template ${String(tid ?? '')}`;
            }}
          />
        )}

        {/* Permission Denied Modal */}
        {showPermissionModal && createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setShowPermissionModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Permission Denied
              </h3>
              <p className="text-gray-600 text-center mb-6">
                You have not been selected by the lead auditor to create a plan.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all duration-150"
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && createPortal(
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
                    onClick={handleDeletePlan}
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

export default SQAStaffAuditPlanning;
