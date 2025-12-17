import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { AuditPlan, AuditPlanDetails } from "../../../types/auditPlan";
import { getChecklistTemplates } from "../../../api/checklists";
import { 
  createAudit, 
  setSensitiveFlag,
  getSensitiveDepartments,
  addAuditScopeDepartment, 
  getAuditApprovals, 
  completeUpdateAuditPlan,
  getAuditPlanById,
  deleteAuditPlan,
  submitToLeadAuditor,
  getAuditScopeDepartments,
  getAuditPlans,
} from "../../../api/audits";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { addCriterionToAudit, bulkCreateAuditCriteriaMappings } from "../../../api/auditCriteriaMap";
import { getAdminUsers } from "../../../api/adminUsers";
import {
  addTeamMember,
  getAuditTeam,
  getAvailableAuditors,
} from "../../../api/auditTeam";
import { getDepartments } from "../../../api/departments";
import {
  addAuditSchedule,
  getAuditSchedules,
} from "../../../api/auditSchedule";
import { MILESTONE_NAMES, SCHEDULE_STATUS } from "../../../constants/audit";
import { getPlansWithDepartments } from "../../../services/auditPlanning.service";
import {
  getAuditChecklistTemplateMapsByAudit,
  syncAuditChecklistTemplateMaps,
} from "../../../api/auditChecklistTemplateMaps";
import { normalizePlanDetails, unwrap } from "../../../utils/normalize";
import { useUserId } from "../../../store/useAuthStore";
import {
  hasAuditPlanCreationPermission,
  getAuditPlanAssignmentsByAuditor,
} from "../../../api/auditPlanAssignment";
import { 
  validateBeforeCreateAudit, 
  validateBeforeAddDepartment,
  validateAssignmentBeforeCreate,
  validateDepartmentWithConditions,
} from "../../../helpers/businessRulesValidation";

// Import custom hooks
import { useAuditPlanForm } from "../../../hooks/useAuditPlanForm";
import { useAuditPlanFilters } from "../../../hooks/useAuditPlanFilters";

// Import helper functions
import {
  getCriterionName,
  getDepartmentName,
} from "../../../helpers/auditPlanHelpers";
import { getStatusColor, getBadgeVariant } from "../../../constants";

// Import edit plan service
import {
  loadPlanDetailsForEdit,
  prepareCompleteUpdatePayload,
} from "./components/editPlanService";

// Import components
import { FilterBar } from "./components/FilterBar";
import { PlanTable } from "./components/PlanTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";
import { toast } from "react-toastify";
import { Step1BasicInfo } from "./components/PlanForm/Step1BasicInfo";
import { Step2Scope } from "./components/PlanForm/Step2Scope";
import { Step3Checklist } from "./components/PlanForm/Step3Checklist";
import { Step4Team } from "./components/PlanForm/Step4Team";
import { Step5Schedule } from "./components/PlanForm/Step5Schedule";
import { SensitiveAreaForm } from "./components/PlanForm/SensitiveAreaForm";
import { PermissionPreviewPanel } from "./components/PlanForm/PermissionPreviewPanel";
import { DRLTemplateViewer } from "./components/PlanForm/DRLTemplateViewer";
import { DRLTemplateHistory } from "./components/DRLTemplateHistory";

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const userIdFromToken = useUserId();

  // Use custom hooks for form state management
  const formState = useAuditPlanForm();

  // Check permission to create plans
  const [hasPlanPermission, setHasPlanPermission] = useState<boolean | null>(
    null
  );
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  
  // DRL template from assignment
  const [drlTemplateFiles, setDrlTemplateFiles] = useState<
    Array<{
    fileName: string;
    fileUrl?: string;
    fileId?: string;
    }>
  >([]);

  // Data fetching states
  const [departments, setDepartments] = useState<
    Array<{ deptId: number | string; name: string }>
  >([]);
  // Removed: usedDepartmentIds - no longer filtering departments
  // const [usedDepartmentIds, setUsedDepartmentIds] = useState<Set<number>>(new Set());
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  // Store selected criteria by department (Map<deptId, Set<criteriaId>>)
  const [selectedCriteriaByDept, setSelectedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());
  // UI: tabs for plans when more than pageSize
  const [activePlansTab, setActivePlansTab] = useState<number>(1);
  const pageSize = 7;

  // Tab state for main view
  const [activeMainTab, setActiveMainTab] = useState<"plans" | "drl-templates">(
    "plans"
  );

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
      }>;
    };
    usedCriteriaIds: string[];
  } | null>(null);

  // Filtered criteria (exclude criteria used in conflicting audits)
  const [filteredCriteria, setFilteredCriteria] = useState<any[]>([]);

  // Original selected auditors from plan (when editing) - always show these in dropdown
  const [originalSelectedAuditorIds, setOriginalSelectedAuditorIds] = useState<
    string[]
  >([]);

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
        const uEmail = String(u?.email || "")
          .toLowerCase()
          .trim();
        const userEmail = String(user.email || "")
          .toLowerCase()
          .trim();
        return uEmail && userEmail && uEmail === userEmail;
      });

      const resolvedId = found?.userId ?? found?.$id ?? fallbackId;
      return resolvedId != null ? String(resolvedId).trim() : null;
    })();

    // 1) Status filter:
    //    - Chỉ ẩn các plan có trạng thái Inactive
    //    - Các trạng thái khác (kể cả Closed, Rejected, v.v.) đều hiển thị cho Auditor
    const statusFiltered = existingPlans.filter((plan) => {
      const normStatus = String(plan.status || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      return normStatus !== "inactive";
    });

    // 2) Nếu không xác định được user hiện tại, trả về rỗng
    if (!currentId) {
      return [] as AuditPlan[];
    }

    const normalizedCurrentUserId = String(currentId).toLowerCase().trim();

    // 3) Xây set các auditId mà user hiện tại nằm trong AuditTeam (bất kỳ vai trò nào)
    const allowedAuditIds = new Set<string>();
    if (auditTeams.length > 0) {
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
    }
    
    // Note: Không return empty ngay cả khi allowedAuditIds.size === 0
    // Vì planMatchesUser có fallback check createdBy

    const planMatchesUser = (plan: any) => {
      const candidates = [plan.auditId, plan.id, (plan as any).$id]
        .filter((v: any) => v != null)
        .map((v: any) => String(v).trim())
        .filter(Boolean);

      if (!candidates.length) return false;

      // Check if plan is in allowedAuditIds (user is in AuditTeam)
      const isInTeam = candidates.some(
        (id) => allowedAuditIds.has(id) || allowedAuditIds.has(id.toLowerCase())
      );
      if (isInTeam) return true;

      // Fallback: Check if current user is the plan creator
      // This ensures plan creator always sees their plan, even if auditTeams hasn't refreshed yet
      // Check multiple possible field names and nested structures
      const planCreatedBy =
        plan.createdBy ||
                           plan.createdByUserId || 
                           plan.auditorId || 
                           plan.userId ||
                           (plan as any).audit?.createdBy ||
                           (plan as any).audit?.createdByUserId ||
                           (plan as any).audit?.auditorId ||
                           (plan as any).audit?.userId ||
                           null;
      
      if (currentId && planCreatedBy) {
        const planCreatedByStr = String(planCreatedBy).trim();
        const normalizedCreatedBy = planCreatedByStr.toLowerCase();
        
        // Direct userId match
        if (normalizedCreatedBy === normalizedCurrentUserId) {
          return true;
        }
        
        // Email match (if createdBy is email)
        if (user?.email) {
          const userEmail = String(user.email).toLowerCase().trim();
          if (normalizedCreatedBy === userEmail) {
            return true;
          }
        }
        
        // Check if createdBy matches any userId in allUsers that matches current user's email
        if (allUsers.length > 0) {
          const createdByUser = allUsers.find((u: any) => {
            const uId = String(u?.userId ?? "")
              .toLowerCase()
              .trim();
            const uEmail = String(u?.email || "")
              .toLowerCase()
              .trim();
            return (
              uId === normalizedCreatedBy || uEmail === normalizedCreatedBy
            );
          });
          
          if (createdByUser) {
            const createdByUserEmail = String(createdByUser?.email || "")
              .toLowerCase()
              .trim();
            const currentUserEmail = String(user?.email || "")
              .toLowerCase()
              .trim();
            if (
              createdByUserEmail &&
              currentUserEmail &&
              createdByUserEmail === currentUserEmail
            ) {
              return true;
            }
          }
        }
      }

      return false;
    };

    return statusFiltered.filter(planMatchesUser) as AuditPlan[];
  }, [existingPlans, auditTeams, user, allUsers]);

  // Use filter hook limited to visible statuses & membership
  const filterState = useAuditPlanFilters(visiblePlans);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] =
    useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<
    any[]
  >([]);

  const layoutUser = user
    ? { name: user.fullName, avatar: undefined }
    : undefined;

  const hydrateTemplateSelection = async (
    auditId: string,
    fallbackTemplateId?: string | number | null
  ) => {
    const normalizedFallback =
      fallbackTemplateId != null ? [String(fallbackTemplateId)] : [];
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
          templateId:
            map.templateId ??
            map.checklistTemplateId ??
            map.template?.templateId ??
            map.template?.id,
        }))
        .filter((x: any) => x.templateId != null);

      const idList = normalizedRecords.map((x: any) => String(x.templateId));
      const uniqueIds = Array.from(new Set(idList));

      if (uniqueIds.length > 0) {
        formState.setSelectedTemplateIds(uniqueIds);

        const templateCards = normalizedRecords.map((x: any) => {
          const tplFromList = checklistTemplates.find(
            (tpl: any) =>
              String(tpl.templateId || tpl.id || tpl.$id) ===
              String(x.templateId)
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
      console.warn(
        "Failed to load checklist template maps for audit",
        auditId,
        err
      );
    }

    formState.setSelectedTemplateIds(normalizedFallback);
    setTemplatesForSelectedPlan(
      normalizedFallback.length
        ? checklistTemplates.filter((tpl: any) =>
            normalizedFallback.includes(
              String(tpl.templateId || tpl.id || tpl.$id)
            )
            )
        : []
    );
  };

  // Helpers: date and schedule validations
  const toDate = (s?: string | null) => (s ? new Date(s) : null);

  const scheduleErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const points: Array<{
      key: keyof typeof formState;
      value: string;
      label: string;
    } | null> = [
      formState.kickoffMeeting
        ? {
            key: "kickoffMeeting" as any,
            value: formState.kickoffMeeting,
            label: "Kickoff Meeting",
          }
        : null,
      formState.fieldworkStart
        ? {
            key: "fieldworkStart" as any,
            value: formState.fieldworkStart,
            label: "Fieldwork Start",
          }
        : null,
      formState.evidenceDue
        ? {
            key: "evidenceDue" as any,
            value: formState.evidenceDue,
            label: "Evidence Due",
          }
        : null,
      formState.capaDue
        ? { key: "capaDue" as any, value: formState.capaDue, label: "CAPA Due" }
        : null,
      formState.draftReportDue
        ? {
            key: "draftReportDue" as any,
            value: formState.draftReportDue,
            label: "Draft Report Due",
          }
        : null,
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
            errs[
              p.key
            ] = `Date must be on or after Period From (${formState.periodFrom}).`;
          } else if (scheduleDate > periodToDate) {
            errs[
              p.key
            ] = `Date must be on or before Period To (${formState.periodTo}).`;
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
            errs[k] = "Dates must be unique (no duplicates).";
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
    const validator = (
      periodFrom?: string,
      periodTo?: string,
      showToast = true
    ): boolean => {
      if (!periodFrom || !periodTo) return true;

      const periodStart = new Date(periodFrom).getTime();
      const periodEnd = new Date(periodTo).getTime();

      if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) return true;

      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime();
      const startDay = new Date(
        new Date(periodFrom).getFullYear(),
        new Date(periodFrom).getMonth(),
        new Date(periodFrom).getDate()
      ).getTime();

      if (startDay < todayStart) {
        if (showToast) {
          toast.warning("Start date cannot be in the past.");
        }
        return false;
      }

      const MAX_START_OFFSET_DAYS = 180;
      const daysFromToday = Math.floor((startDay - todayStart) / MS_PER_DAY);
      if (daysFromToday > MAX_START_OFFSET_DAYS) {
        if (showToast) {
          toast.warning("Start date cannot be more than 180 days from today.");
        }
        return false;
      }

      if (periodStart > periodEnd) {
        if (showToast) {
          toast.warning(
            "Invalid period: Start date must be earlier than or equal to the end date."
          );
        }
        return false;
      }

      return true;
    };

    return validator;
  }, []);

  const validateStep1 = useMemo(() => {
    if (
      formState.title.trim() === "" ||
      formState.auditType.trim() === "" ||
      formState.goal.trim() === "" ||
      formState.periodFrom === "" ||
      formState.periodTo === ""
    ) {
      return false;
    }
    return validatePlanPeriod(formState.periodFrom, formState.periodTo, false);
  }, [
    formState.title,
    formState.auditType,
    formState.goal,
    formState.periodFrom,
    formState.periodTo,
    validatePlanPeriod,
  ]);

  const validateStep2 = useMemo(() => {
    // Department level: every selected department must have at least one criterion chosen
    if (formState.level === "department") {
      if (formState.selectedDeptIds.length === 0) return false;

      return formState.selectedDeptIds.every((deptId) => {
        const set = selectedCriteriaByDept.get(String(deptId));
        return !!set && set.size > 0;
      });
    }

    // Academy level: at least one criterion overall (prefer map if available)
    const academySet = selectedCriteriaByDept.get("academy");
    const totalSelected =
      (academySet?.size ?? 0) || formState.selectedCriteriaIds.length;

    return totalSelected > 0;
  }, [
    formState.level,
    formState.selectedDeptIds,
    formState.selectedCriteriaIds,
    selectedCriteriaByDept,
  ]);

  const validateStep3 = useMemo(() => {
    // Basic check: must have at least one template selected
    if (
      !Array.isArray(formState.selectedTemplateIds) ||
      formState.selectedTemplateIds.length === 0
    ) {
      return false;
    }

    // If level is 'department' and departments are selected, validate that each department has at least one template
    if (
      formState.level === "department" &&
      formState.selectedDeptIds.length > 0
    ) {
      // Get selected templates with their deptId
      const selectedTemplates = checklistTemplates.filter((tpl: any) =>
        formState.selectedTemplateIds.includes(
          String(tpl.templateId || tpl.id || tpl.$id)
        )
      );

      // Check if each selected department has at least one template selected
      const selectedDeptIdsSet = new Set(
        formState.selectedDeptIds.map((id) => String(id).trim())
      );
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
  }, [
    formState.selectedTemplateIds,
    formState.level,
    formState.selectedDeptIds,
    checklistTemplates,
  ]);

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
  }, [
    formState.currentStep,
    validateStep1,
    validateStep2,
    validateStep3,
    validateStep4,
    validateStep5,
  ]);

  // Load departments when level changes to 'department' or 'academy'
  // Academy level also needs departments for sensitive areas
  useEffect(() => {
    const loadDepts = async () => {
      if (departments.length > 0) return;
      try {
        const res: any = await getDepartments();
        const list = (res || []).map((d: any) => ({
          deptId: d.deptId ?? d.$id ?? d.id,
          name: d.name || d.code || "—",
        }));
        setDepartments(list);
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };
    // Load departments for both department and academy levels
    if ((formState.level === "department" || formState.level === "academy") && departments.length === 0) {
      loadDepts();
    }
  }, [formState.level, departments.length]);

  // Ensure departments are loaded for filters and modals
  const ensureDepartmentsLoaded = async (): Promise<
    Array<{ deptId: number | string; name: string }>
  > => {
    if (departments && departments.length > 0) return departments;
    try {
      const res: any = await getDepartments();
      const list = (res || []).map((d: any) => ({
        deptId: d.deptId,
        name: d.name || d.code || "—",
      }));
      setDepartments(list);
      return list;
    } catch (err) {
      console.error("ensureDepartmentsLoaded: failed to load departments", err);
      return departments;
    }
  };

  // Keep owner selection consistent with scope
  useEffect(() => {
    if (formState.level === "academy" && formState.selectedOwnerId) {
      formState.setSelectedOwnerId("");
    }
  }, [formState.level]);

  // Filter selected templates when departments change (for department level)
  useEffect(() => {
    if (
      formState.level === "department" &&
      formState.selectedDeptIds.length > 0 &&
      formState.selectedTemplateIds.length > 0
    ) {
      const selectedDeptIdsSet = new Set(
        formState.selectedDeptIds.map((id) => String(id).trim())
      );
      
      // Filter selectedTemplateIds to only keep templates that belong to selected departments
      const validTemplateIds = formState.selectedTemplateIds.filter(
        (templateId: string) => {
        const template = checklistTemplates.find(
            (tpl: any) =>
              String(tpl.templateId || tpl.id || tpl.$id) === String(templateId)
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
        }
      );
      
      // Only update if there's a change (to avoid infinite loops)
      if (validTemplateIds.length !== formState.selectedTemplateIds.length) {
        console.log("🔍 Filtering selected templates by departments:", {
          before: formState.selectedTemplateIds.length,
          after: validTemplateIds.length,
          selectedDeptIds: formState.selectedDeptIds,
          removed: formState.selectedTemplateIds.filter(
            (id) => !validTemplateIds.includes(id)
          ),
        });
        formState.setSelectedTemplateIds(validTemplateIds);
      }
    } else if (
      formState.level === "department" &&
      formState.selectedDeptIds.length === 0
    ) {
      // If no departments selected, clear all template selections
      if (formState.selectedTemplateIds.length > 0) {
        console.log(
          "🔍 Clearing template selections - no departments selected"
        );
        formState.setSelectedTemplateIds([]);
      }
    }
  }, [formState.level, formState.selectedDeptIds, checklistTemplates]);

  useEffect(() => {
    if (!formState.selectedOwnerId) return;
    const owner = ownerOptions.find(
      (o: any) => String(o.userId) === String(formState.selectedOwnerId)
    );
    if (!owner) {
      formState.setSelectedOwnerId("");
      return;
    }
    if (
      formState.level === "department" &&
      formState.selectedDeptIds.length > 0
    ) {
      const ownerDeptInSelection = formState.selectedDeptIds.includes(
        String(owner.deptId ?? "")
      );
      if (!ownerDeptInSelection) {
        formState.setSelectedOwnerId("");
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
          console.error("Failed to load audit criteria", e);
        }

        try {
          const users = await getAdminUsers();
          setAllUsers(Array.isArray(users) ? users : []);
          const norm = (s: string) =>
            String(s || "")
              .toLowerCase()
              .replace(/\s+/g, "");
          const auditors = (users || []).filter(
            (u: any) => norm(u.roleName) === "auditor"
          );
          const owners = (users || []).filter(
            (u: any) => norm(u.roleName) === "auditeeowner"
          );
          setAuditorOptions(auditors);
          setOwnerOptions(owners);
        } catch (e) {
          console.error("Failed to load users for team", e);
        }

        try {
          const teams = await getAuditTeam();
          setAuditTeams(Array.isArray(teams) ? teams : []);
        } catch (e) {
          console.error("Failed to load audit teams", e);
        }
      } catch (err) {
        console.error("Failed to load checklist templates", err);
      }
    };
    load();
  }, []);

  // Reload available auditors based on selected period (exclude those who participated in previous periods)
  // When editing: Show selected auditors + available auditors (not conflicting with period)
  useEffect(() => {
    const loadAvailableAuditors = async () => {
      const norm = (s: string) =>
        String(s || "")
          .toLowerCase()
          .replace(/\s+/g, "");

      // If allUsers is empty, wait a bit and try again (might be loading)
      if (!allUsers || allUsers.length === 0) {
        console.log("[loadAvailableAuditors] allUsers is empty, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 300));
        // Re-check allUsers after waiting
        if (!allUsers || allUsers.length === 0) {
          console.log("[loadAvailableAuditors] allUsers still empty after wait");
          return; // Don't proceed if still empty
        }
      }

      // Get all auditors from user list
      const allAuditors = (allUsers || []).filter(
        (u: any) => norm(u.roleName || u.role) === "auditor"
      );
      
      console.log("[loadAvailableAuditors] allAuditors count:", allAuditors.length);

      // In edit mode: Show original selected auditors (from plan) + available auditors (not conflicting)
      if (formState.isEditMode && formState.periodFrom && formState.periodTo) {
        console.log(
          "[loadAvailableAuditors] Edit mode - loading original selected + available auditors"
        );

        try {
          // Get available auditors (not conflicting with period)
          const available = await getAvailableAuditors({
            periodFrom: formState.periodFrom,
            periodTo: formState.periodTo,
            excludePreviousPeriod: true,
          });

          const availableAuditors = (available || []).filter(
            (u: any) => norm(u.roleName || u.role) === "auditor"
          );

          // Get ORIGINAL selected auditor IDs (from plan, not current selection)
          // This ensures auditors that were originally selected always show in dropdown
          const originalSelectedIds = new Set(
            originalSelectedAuditorIds.map((id) => String(id).toLowerCase().trim())
          );

          console.log("[loadAvailableAuditors] Edit mode - originalSelectedIds:", Array.from(originalSelectedIds));
          console.log("[loadAvailableAuditors] Edit mode - allAuditors count:", allAuditors.length);
          console.log("[loadAvailableAuditors] Edit mode - allAuditors userIds:", allAuditors.map((u: any) => String(u.userId || u.id || u.$id || "").toLowerCase().trim()));

          // Get original selected auditors from allUsers (always include these)
          // Use case-insensitive matching
          const originalSelectedAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return originalSelectedIds.has(userId);
          });

          console.log("[loadAvailableAuditors] Edit mode - found original selected auditors:", originalSelectedAuditors.length);

          // Merge: original selected auditors + available auditors (avoid duplicates)
          const originalIds = new Set(
            originalSelectedAuditors.map((u: any) =>
              String(u.userId || u.id || u.$id || "").toLowerCase().trim()
            )
          );
          const additionalAvailable = availableAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return !originalIds.has(userId);
          });

          const mergedAuditors = [
            ...originalSelectedAuditors,
            ...additionalAvailable,
          ];

          console.log(
            "[loadAvailableAuditors] Edit mode - original selected:",
            originalSelectedAuditors.length,
            "available:",
            availableAuditors.length,
            "merged:",
            mergedAuditors.length
          );
          setAuditorOptions(mergedAuditors);
          return;
        } catch (err) {
          console.error(
            "[AuditPlanning] Failed to load available auditors in edit mode",
            err
          );
          // Fallback: show original selected + all auditors
          const originalSelectedIds = new Set(
            originalSelectedAuditorIds.map((id) => String(id).toLowerCase().trim())
          );
          const originalSelectedAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return originalSelectedIds.has(userId);
          });
          const remainingAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return !originalSelectedIds.has(userId);
          });
          const fallbackAuditors = [...originalSelectedAuditors, ...remainingAuditors];
          console.log("[loadAvailableAuditors] Edit mode - fallback auditors:", fallbackAuditors.length);
          setAuditorOptions(fallbackAuditors);
          return;
        }
      }

      // Edit mode but no period dates: Show original selected + all auditors
      if (formState.isEditMode && (!formState.periodFrom || !formState.periodTo)) {
        console.log(
          "[loadAvailableAuditors] Edit mode but no period dates - showing original selected + all auditors"
        );
        if (originalSelectedAuditorIds.length > 0) {
          const originalSelectedIds = new Set(
            originalSelectedAuditorIds.map((id) => String(id).toLowerCase().trim())
          );
          const originalSelectedAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return originalSelectedIds.has(userId);
          });
          const remainingAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "").toLowerCase().trim();
            return !originalSelectedIds.has(userId);
          });
          const noPeriodAuditors = [...originalSelectedAuditors, ...remainingAuditors];
          console.log("[loadAvailableAuditors] Edit mode no period - setting auditors:", noPeriodAuditors.length);
          setAuditorOptions(noPeriodAuditors);
        } else {
          setAuditorOptions(allAuditors);
        }
        return;
      }

      // Create mode: Filter by period
      if (!formState.periodFrom || !formState.periodTo) {
        console.log(
          "[loadAvailableAuditors] No period dates, using all auditors"
        );
        setAuditorOptions(allAuditors);
        return;
      }

      try {
        const available = await getAvailableAuditors({
          periodFrom: formState.periodFrom,
          periodTo: formState.periodTo,
          excludePreviousPeriod: true,
        });

        const auditors = (available || []).filter(
          (u: any) => norm(u.roleName || u.role) === "auditor"
        );
        console.log(
          "[loadAvailableAuditors] Create mode - filtered auditors:",
          auditors.length
        );
        setAuditorOptions(auditors);
      } catch (err) {
        console.error("[AuditPlanning] Failed to load available auditors", err);
        setAuditorOptions(allAuditors);
      }
    };

    loadAvailableAuditors();
  }, [
    formState.periodFrom,
    formState.periodTo,
    formState.isEditMode,
    originalSelectedAuditorIds,
    allUsers,
  ]);

  // Load departments for filter
  useEffect(() => {
    const loadDepartmentsForFilter = async () => {
      if (departments.length === 0) {
        await ensureDepartmentsLoaded();
      }
    };
    loadDepartmentsForFilter();
  }, []);

  // Removed: Load used departments logic - no longer filtering departments
  // Load used departments in period (Business Rule: Filter departments already used)
  // useEffect(() => {
  //   // Disabled: No longer filtering departments
  //   // Original logic commented out - no longer filtering departments
  /* Original logic commented out:
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
          
          console.log(`[AuditPlanning] ✅ Audit "${audit.title || audit.auditId}" PASSED FILTER - overlaps with period:`, {
            auditPeriod: `${auditPeriodFromDate.toISOString()} to ${auditPeriodToDate.toISOString()}`,
            searchPeriod: `${periodFromDate.toISOString()} to ${periodToDate.toISOString()}`
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
        
        console.log('[AuditPlanning] 📋 Found', auditsInPeriod.length, 'audits in period');

        // Get all audit scope departments in ONE API call
        const usedDeptIds = new Set<number>();
        
        try {
          console.log('[AuditPlanning] 📡 Calling getAuditScopeDepartments() once to get all audit-department mappings...');
          const allScopeDepts = await getAuditScopeDepartments();
          console.log('[AuditPlanning] 📡 All scope departments response (raw):', allScopeDepts);
          
          const scopeDeptList = unwrap(allScopeDepts);
          console.log('[AuditPlanning] 📡 All scope departments (unwrapped):', scopeDeptList);
          
          const scopeDeptArray = Array.isArray(scopeDeptList) ? scopeDeptList : [];
          console.log('[AuditPlanning] 📦 Total audit-department mappings in system:', scopeDeptArray.length);
          
          if (scopeDeptArray.length === 0) {
            console.log('[AuditPlanning] ⚠️ No audit-department mappings found in system. All departments are available.');
            setUsedDepartmentIds(new Set());
            return;
          }
          
          // Filter scope departments that belong to audits in period
          const auditIdsInPeriod = new Set(
            auditsInPeriod.map((audit: any) => String(audit.auditId || audit.id || audit.$id))
          );
          
          console.log('[AuditPlanning] 🔍 Audit IDs in period:', Array.from(auditIdsInPeriod));
          
          scopeDeptArray.forEach((scopeDept: any) => {
            console.log('[AuditPlanning] 🔍 Processing scope department:', scopeDept);
            
            const scopeAuditId = String(scopeDept.auditId || scopeDept.audit?.auditId || '');
            
            // Check if this scope department belongs to an audit in the period
            if (!scopeAuditId) {
              console.warn('[AuditPlanning] ⚠️ Scope department missing auditId:', scopeDept);
              return;
            }
            
            if (!auditIdsInPeriod.has(scopeAuditId)) {
              console.log(`[AuditPlanning] ⏭️ Skipping scope dept - audit ${scopeAuditId} not in period`);
              return; // Skip - not in period
            }
            
            // Skip if this is the audit being edited
            if (formState.isEditMode && formState.editingAuditId === scopeAuditId) {
              console.log('[AuditPlanning] ⏭️ Skipping department from current audit being edited:', scopeAuditId);
              return;
            }
            
            // Extract deptId
            const deptId = scopeDept.deptId ?? scopeDept.dept?.deptId ?? scopeDept.departmentId;
            if (deptId) {
              const deptIdNum = Number(deptId);
              if (!isNaN(deptIdNum) && deptIdNum > 0) {
                usedDeptIds.add(deptIdNum);
                const deptName = scopeDept.dept?.name || scopeDept.deptName || 'unknown';
                console.log(`[AuditPlanning] ✅ Found used department: ${deptName} (ID: ${deptIdNum}) from audit ${scopeAuditId}`);
              } else {
                console.warn(`[AuditPlanning] ⚠️ Invalid deptId format:`, deptId, 'from scopeDept:', scopeDept);
              }
            } else {
              console.warn(`[AuditPlanning] ⚠️ Scope department missing deptId:`, scopeDept);
            }
          });
          
          setUsedDepartmentIds(usedDeptIds);
          console.log('[AuditPlanning] ✅✅✅ Final used departments SET:', Array.from(usedDeptIds), 'Total:', usedDeptIds.size);
        } catch (err: any) {
          console.error('[AuditPlanning] ❌ Failed to load audit scope departments:', err);
          console.error('[AuditPlanning] ❌ Error details:', err?.response?.data || err?.message);
          // On error, assume no departments are used (safer to show all than block user)
          setUsedDepartmentIds(new Set());
        }
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
    */
  // }, [formState.periodFrom, formState.periodTo, formState.isEditMode, formState.editingAuditId, userIdFromToken, allUsers, user?.email]);

  // Show all departments (no filtering - removed filter logic)
  const availableDepartments = useMemo(() => {
    // Return all departments without filtering
      return departments;
  }, [departments]);

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
            const uEmail = String(u?.email || "")
              .toLowerCase()
              .trim();
            const userEmail = String(user.email || "")
              .toLowerCase()
              .trim();
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
          console.warn(
            "[AuditPlanning] Cannot find userId for permission check"
          );
          setHasPlanPermission(false);
          setIsCheckingPermission(false);
          return;
        }
        
        console.log(
          "[AuditPlanning] Checking permission for userId:",
          currentUserId
        );
        
        // Check permission using the actual userId (GUID)
        const hasPermission = await hasAuditPlanCreationPermission(
          currentUserId
        );
        console.log("[AuditPlanning] Permission result:", hasPermission);
        setHasPlanPermission(hasPermission);
        
        // If has permission, load DRL template files from assignment
        if (hasPermission && currentUserId) {
          try {
            const assignments = await getAuditPlanAssignmentsByAuditor(
              currentUserId
            );
            // Get the most recent active assignment
            const activeAssignment =
              assignments.find(
                (a) => (a.status || "").toLowerCase() === "active"
            ) || assignments[0];
            
            if (activeAssignment) {
              // Extract files from assignment - prioritize filePaths from API
              let drlFiles: Array<{
                fileName: string;
                fileUrl?: string;
                fileId?: string;
              }> = [];

              // Parse filePaths (JSON string array from API)
              if (activeAssignment.filePaths) {
                try {
                  const filePathsArray = JSON.parse(activeAssignment.filePaths);
                  if (Array.isArray(filePathsArray)) {
                    drlFiles = filePathsArray.map((filePath: string) => {
                      // Extract fileName from URL
                      let fileName = "DRL Template";
                      try {
                        const url = new URL(filePath);
                        const pathParts = url.pathname.split("/");
                        const lastPart = pathParts[pathParts.length - 1];
                        // Decode URL-encoded filename
                        fileName = decodeURIComponent(lastPart.split("?")[0]);
                        // Remove any prefixes like assignment IDs
                        const fileNameParts = fileName.split("_");
                        if (fileNameParts.length > 1) {
                          // Skip first parts (assignment IDs) and take the actual filename
                          fileName = fileNameParts.slice(-1)[0];
                        }
                      } catch (e) {
                        console.warn(
                          "[AuditPlanning] Failed to parse fileName from URL:",
                          filePath
                        );
                      }

                      return {
                        fileName: fileName || "DRL Template",
                        fileUrl: filePath,
                        fileId: undefined,
                      };
                    });
                  }
                } catch (e) {
                  console.warn(
                    "[AuditPlanning] Failed to parse filePaths:",
                    activeAssignment.filePaths,
                    e
                  );
                }
              }

              // Fallback to files or attachments if filePaths is not available
              if (drlFiles.length === 0) {
                const files =
                  activeAssignment.files || activeAssignment.attachments || [];
                drlFiles = files
                .filter((f: any) => f.fileName || f.fileUrl || f.fileId)
                .map((f: any) => ({
                    fileName: f.fileName || "DRL Template",
                  fileUrl: f.fileUrl,
                  fileId: f.fileId || f.attachmentId,
                }));
              }

              setDrlTemplateFiles(drlFiles);
              console.log(
                "[AuditPlanning] Loaded DRL template files:",
                drlFiles
              );
            }
          } catch (error) {
            console.error(
              "[AuditPlanning] Failed to load DRL template files:",
              error
            );
          }
        }
      } catch (error) {
        console.error(
          "[AuditPlanning] Failed to check plan creation permission",
          error
        );
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
        console.error("❌ Failed to load audit plans", error);
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
          (!schedulesData.values &&
            !schedulesData.$values &&
            !Array.isArray(schedulesData))
        ) {
          try {
            const schedulesResponse = await getAuditSchedules(auditId);
            const { unwrap } = await import("../../../utils/normalize");
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
        const planStatus = String(
          detailsWithSchedules.status ||
            detailsWithSchedules.audit?.status ||
            ""
        ).toLowerCase();
        const isRejected = planStatus.includes("rejected");
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          latestRejectionComment =
            detailsWithSchedules.comment ||
                                   detailsWithSchedules.note || 
                                   detailsWithSchedules.audit?.comment ||
                                   detailsWithSchedules.audit?.note ||
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
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
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
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
                  // Try multiple possible field names for comment
                  latestRejectionComment =
                    rejected[0].comment ||
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn(
                      "⚠️ Rejection comment not found for audit:",
                      currentAuditId,
                      {
                      rejectedItem: rejected[0],
                        allFields: Object.keys(rejected[0]),
                      }
                    );
                  }
                }
              } else {
                console.warn(
                  "⚠️ No related approvals found for audit:",
                  currentAuditId,
                  {
                  totalApprovals: approvals.length,
                    sampleApproval: approvals[0],
                  }
                );
              }
            } catch (approvalErr) {
              console.error(
                "Failed to load audit approvals for plan",
                approvalErr
              );
            }
          }
        }

        // Check rawDetails for sensitive areas BEFORE normalization
        // (sensitive areas were saved during plan creation via setSensitiveFlag API)
        let sensitiveFlag = false;
        let sensitiveAreas: string[] = [];
        let sensitiveAreasByDept: Record<number, string[]> = {}; // Map deptId -> areas[]
        
        // First, try to get from rawDetails (before normalization)
        const rawDetailsAny = rawDetails as any;
        
        // Always try to fetch from API first (since sensitive areas are stored in AuditScopeDepartment table)
        // Only use rawDetails if API fails or returns empty
        let foundInRawDetails = false;
        if (
          rawDetailsAny.sensitiveAreas &&
          Array.isArray(rawDetailsAny.sensitiveAreas) &&
          rawDetailsAny.sensitiveAreas.length > 0
        ) {
          sensitiveAreas = rawDetailsAny.sensitiveAreas;
          sensitiveFlag = true;
          foundInRawDetails = true;
        } else if (
          rawDetailsAny.sensitiveFlag !== undefined &&
          rawDetailsAny.sensitiveFlag === true
        ) {
          sensitiveFlag = Boolean(rawDetailsAny.sensitiveFlag);
          if (rawDetailsAny.sensitiveAreas) {
            sensitiveAreas = Array.isArray(rawDetailsAny.sensitiveAreas) 
              ? rawDetailsAny.sensitiveAreas 
              : typeof rawDetailsAny.sensitiveAreas === "string"
              ? [rawDetailsAny.sensitiveAreas]
              : [];
            foundInRawDetails = sensitiveAreas.length > 0;
          }
        }
        
        // If not found in rawDetails, always fetch from API
        if (!foundInRawDetails) {
          // If not in rawDetails, try to get from API (areas were saved via setSensitiveFlag)
          try {
            const sensitiveDepts = await getSensitiveDepartments(auditId);
            
            if (sensitiveDepts && sensitiveDepts.length > 0) {
              sensitiveFlag = sensitiveDepts.some(
                (sd: any) => sd.sensitiveFlag === true
              );
              
              const allAreas = new Set<string>();
              
              sensitiveDepts.forEach((sd: any) => {
                const deptId = Number(sd.deptId);
                let areasArray: string[] = [];
                
                // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
                if (Array.isArray(sd.Areas)) {
                  areasArray = sd.Areas;
                } else if (sd.Areas && typeof sd.Areas === "string") {
                  try {
                    const parsed = JSON.parse(sd.Areas);
                    areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
                  } catch {
                    areasArray = [sd.Areas];
                  }
                } else if (
                  sd.Areas &&
                  typeof sd.Areas === "object" &&
                  sd.Areas.$values
                ) {
                  areasArray = Array.isArray(sd.Areas.$values)
                    ? sd.Areas.$values
                    : [];
                } else if (Array.isArray(sd.areas)) {
                  areasArray = sd.areas;
                } else if (sd.areas && typeof sd.areas === "string") {
                  try {
                    const parsed = JSON.parse(sd.areas);
                    areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
                  } catch {
                    areasArray = [sd.areas];
                  }
                } else if (
                  sd.areas &&
                  typeof sd.areas === "object" &&
                  sd.areas.$values
                ) {
                  areasArray = Array.isArray(sd.areas.$values)
                    ? sd.areas.$values
                    : [];
                }
                
                // Store areas by deptId
                if (deptId && areasArray.length > 0) {
                  sensitiveAreasByDept[deptId] = areasArray
                    .filter(
                      (area: string) =>
                        area && typeof area === "string" && area.trim()
                    )
                    .map((a: string) => a.trim());
                }
                
                areasArray.forEach((area: string) => {
                  if (area && typeof area === "string" && area.trim()) {
                    allAreas.add(area.trim());
                  }
                });
              });
              
              sensitiveAreas = Array.from(allAreas);
            }
          } catch (sensitiveErr: any) {
            console.error("Failed to load sensitive flag data:", sensitiveErr);
          }
        }

        const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
          departments: deptList,
          criteriaList: criteria,
          users: [...auditorOptions, ...ownerOptions],
        });

        // sensitiveAreasByDept was already built in the API response processing above (if API was called)
        // If not found, it will be an empty object (initialized at the start of the function)

        const detailsWithRejection = {
          ...normalizedDetails,
          latestRejectionComment,
          sensitiveFlag,
          sensitiveAreas,
          sensitiveAreasByDept,
        };

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
          throw new Error(
            "Plan not found in table. Backend API /AuditPlan/{id} is also returning 500 error."
          );
        }

        // Try to fetch schedules even if main API failed
        let schedulesData: { values: any[] } = { values: [] };
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const { unwrap } = await import("../../../utils/normalize");
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          // Failed to fetch schedules separately, using empty array
        }

        // Only fetch approvals if plan is rejected (API is only for getting rejections)
        let latestRejectionComment: string | null = null;
        const planStatus = String(planFromTable.status || "").toLowerCase();
        const isRejected = planStatus.includes("rejected");
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          const planFromTableAny = planFromTable as any;
          latestRejectionComment =
            planFromTableAny.comment ||
                                   planFromTableAny.rejectionComment || 
                                   planFromTableAny.rejectionReason || 
                                   planFromTableAny.note || 
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(
                planFromTable.auditId || planFromTable.id || auditId
              )
                .trim()
                .toLowerCase();
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
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
                  // Try multiple possible field names for comment
                  latestRejectionComment =
                    rejected[0].comment ||
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn(
                      "⚠️ Rejection comment not found for audit:",
                      currentAuditId,
                      {
                      rejectedItem: rejected[0],
                        allFields: Object.keys(rejected[0]),
                      }
                    );
                  }
                }
              } else {
                console.warn(
                  "⚠️ No related approvals found for audit:",
                  currentAuditId,
                  {
                  totalApprovals: approvals.length,
                    sampleApproval: approvals[0],
                  }
                );
              }
            } catch (approvalErr) {
              console.error(
                "Failed to load audit approvals for basic details",
                approvalErr
              );
            }
          }
        }

        // Get sensitive areas from plan data (from what was selected during plan creation)
        let sensitiveFlag = false;
        let sensitiveAreas: string[] = [];
        let sensitiveAreasByDept: Record<number, string[]> = {}; // Map deptId -> areas[]
        
        // Check if sensitive areas are stored in planFromTable
        const planFromTableAny = planFromTable as any;
        if (
          planFromTableAny.sensitiveAreas &&
          Array.isArray(planFromTableAny.sensitiveAreas) &&
          planFromTableAny.sensitiveAreas.length > 0
        ) {
          sensitiveAreas = planFromTableAny.sensitiveAreas;
          sensitiveFlag = true;
        } else if (planFromTableAny.sensitiveFlag !== undefined) {
          sensitiveFlag = Boolean(planFromTableAny.sensitiveFlag);
          if (planFromTableAny.sensitiveAreas) {
            sensitiveAreas = Array.isArray(planFromTableAny.sensitiveAreas) 
              ? planFromTableAny.sensitiveAreas 
              : typeof planFromTableAny.sensitiveAreas === "string"
              ? [planFromTableAny.sensitiveAreas]
              : [];
          }
        } else {
          // Fallback: Try to fetch from API if not in plan data
          try {
            const sensitiveDepts = await getSensitiveDepartments(auditId);
            if (sensitiveDepts && sensitiveDepts.length > 0) {
              sensitiveFlag = sensitiveDepts.some(
                (sd: any) => sd.sensitiveFlag === true
              );
              
              const allAreas = new Set<string>();
              sensitiveDepts.forEach((sd: any) => {
                const deptId = Number(sd.deptId);
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
                } else if (
                  sd.Areas &&
                  typeof sd.Areas === "object" &&
                  sd.Areas.$values
                ) {
                  areasArray = Array.isArray(sd.Areas.$values)
                    ? sd.Areas.$values
                    : [];
                } else if (Array.isArray(sd.areas)) {
                  areasArray = sd.areas;
                } else if (sd.areas && typeof sd.areas === "string") {
                  try {
                    const parsed = JSON.parse(sd.areas);
                    areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
                  } catch {
                    areasArray = [sd.areas];
                  }
                } else if (
                  sd.areas &&
                  typeof sd.areas === "object" &&
                  sd.areas.$values
                ) {
                  areasArray = Array.isArray(sd.areas.$values)
                    ? sd.areas.$values
                    : [];
                }
                
                // Store areas by deptId
                if (deptId && areasArray.length > 0) {
                  sensitiveAreasByDept[deptId] = areasArray
                    .filter(
                      (area: string) =>
                        area && typeof area === "string" && area.trim()
                    )
                    .map((a: string) => a.trim());
                }
                
                areasArray.forEach((area: string) => {
                  if (area && typeof area === "string" && area.trim()) {
                    allAreas.add(area.trim());
                  }
                });
              });
              
              sensitiveAreas = Array.from(allAreas);
            }
          } catch (sensitiveErr) {
            console.warn(
              "Failed to load sensitive flag data in fallback:",
              sensitiveErr
            );
          }
        }

        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: schedulesData,
          createdByUser: {
            fullName: planFromTable.createdBy || "Unknown",
            email: "N/A",
            roleName: "N/A",
          },
          latestRejectionComment,
          sensitiveFlag,
          sensitiveAreas,
          sensitiveAreasByDept,
        };

        alert(
          "⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team) is not available.\nSchedules have been fetched separately.\n\nPlease contact backend team to fix this endpoint."
        );

        setSelectedPlanDetails(basicDetails);
        await hydrateTemplateSelection(auditId, basicDetails.templateId);
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch plan details", error);
      alert(
        "⚠️ Cannot load full plan details\n\n" +
          "The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n" +
          "Error: " +
          (error as any)?.message
      );
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
          const uEmail = String(u?.email || "")
            .toLowerCase()
            .trim();
          const userEmail = String(user.email || "")
            .toLowerCase()
            .trim();
          return uEmail && userEmail && uEmail === userEmail;
        });
        currentUserId = found?.userId ?? found?.$id ?? fallbackId;
        currentUserId =
          currentUserId != null ? String(currentUserId).trim() : null;
      }

      if (!currentUserId) return false;

      // Get plan's createdBy (could be userId or email)
      const planCreatedBy = plan.createdBy;
      if (!planCreatedBy) return false;

      const normalizedCurrentUserId = String(currentUserId)
        .toLowerCase()
        .trim();
      const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();

      // Compare by userId
      if (normalizedCreatedBy === normalizedCurrentUserId) {
        return true;
      }

      // Compare by email (if createdBy is email)
      const userEmail = String(user.email || "")
        .toLowerCase()
        .trim();
      if (normalizedCreatedBy === userEmail) {
        return true;
      }

      // Also check if createdBy matches any userId in allUsers that matches current user's email
      const createdByUser = allUsers.find((u: any) => {
        const uId = String(u?.userId ?? "")
          .toLowerCase()
          .trim();
        const uEmail = String(u?.email || "")
          .toLowerCase()
          .trim();
        return uId === normalizedCreatedBy || uEmail === normalizedCreatedBy;
      });

      if (createdByUser) {
        const createdByUserEmail = String(createdByUser?.email || "")
          .toLowerCase()
          .trim();
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
    const planToDelete = existingPlans.find(
      (p) => (p.auditId || p.id) === auditId
    );
    
    if (!planToDelete) {
      toast.error("Plan not found.");
      return;
    }

    // Normalize status for comparison (remove spaces, convert to lowercase)
    const normalizedStatus = String(planToDelete.status || "draft")
      .toLowerCase()
      .replace(/\s+/g, "");
    
    // Only allow delete if status is Draft
    if (normalizedStatus !== "draft") {
      toast.warning("Only Draft status can be deleted.");
      return;
    }

    // Check if current user is the creator of the plan
    if (!isCurrentUserCreator(planToDelete)) {
      toast.warning("Only the creator of the plan can delete it.");
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
    const planToDelete = existingPlans.find(
      (p) => (p.auditId || p.id) === planToDeleteId
    );
    
    if (!planToDelete) {
      toast.error("Plan not found.");
      closeDeleteModal();
      return;
    }

    // Double-check status (defense in depth)
    const normalizedStatus = String(planToDelete.status || "draft")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (normalizedStatus !== "draft") {
      toast.warning("Only Draft status can be deleted.");
      closeDeleteModal();
      return;
    }

    // Double-check creator (defense in depth)
    if (!isCurrentUserCreator(planToDelete)) {
      toast.warning("Only the creator of the plan can delete it.");
      closeDeleteModal();
      return;
    }
    
    try {
      await deleteAuditPlan(planToDeleteId);

      setExistingPlans((prevPlans) =>
        prevPlans.filter((p) => (p.auditId || p.id) !== planToDeleteId)
      );

      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (err) {
        console.error("Failed to refresh plans after delete", err);
      }
      
      closeDeleteModal();
      toast.success("Audit plan deleted successfully.");
    } catch (error: any) {
      console.error("Failed to delete plan", error);
      const errorMessage =
        error?.response?.data?.message || error?.message || "Unknown error";
      toast.error("Delete failed: " + errorMessage);
    }
  };

  // Handler: Edit plan
  const handleEditPlan = async (auditId: string) => {
    try {
      // Find the plan to check its status
      const planToEdit = existingPlans.find(
        (p) => (p.auditId || p.id) === auditId
      );
      
      if (!planToEdit) {
        toast.error("Plan not found.");
        return;
      }

      // Normalize status for comparison (remove spaces, convert to lowercase)
      const normalizedStatus = String(planToEdit.status || "draft")
        .toLowerCase()
        .replace(/\s+/g, "");
      
      // Only allow edit if status is Draft
      if (normalizedStatus !== "draft") {
        toast.warning("Only Draft status can be edited.");
        return;
      }

      console.log("[handleEditPlan] Starting edit plan for auditId:", auditId);
      console.log(
        "[handleEditPlan] Current auditorOptions length:",
        auditorOptions.length
      );
      console.log(
        "[handleEditPlan] Current ownerOptions length:",
        ownerOptions.length
      );
      console.log("[handleEditPlan] Current allUsers length:", allUsers.length);

      // Always ensure auditorOptions and ownerOptions are loaded before editing
      // This is critical for edit mode to show auditors correctly
      // Always fetch from API to ensure we have latest data
      let usersArray: any[] = [];
      try {
        const users = await getAdminUsers();
        usersArray = Array.isArray(users) ? users : [];
        setAllUsers(usersArray);

        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .replace(/\s+/g, "");
        const auditors = usersArray.filter(
          (u: any) => norm(u.roleName || u.role) === "auditor"
        );
        const owners = usersArray.filter(
          (u: any) => norm(u.roleName || u.role) === "auditeeowner"
        );

        setAuditorOptions(auditors);
        setOwnerOptions(owners);

        console.log(
          "[handleEditPlan] Loaded from API - auditors:",
          auditors.length,
          "owners:",
          owners.length
        );
        console.log(
          "[handleEditPlan] Auditor IDs:",
          auditors.map((a: any) => a.userId || a.id)
        );
      } catch (loadErr) {
        console.error("[handleEditPlan] Failed to load options:", loadErr);
        // Continue anyway, might already be loaded
        usersArray = allUsers; // Use existing allUsers as fallback
      }

      // Load plan details using service
      const detailsWithId = await loadPlanDetailsForEdit(
        auditId,
        existingPlans
      );

      console.log(
        "[handleEditPlan] Plan details loaded, calling loadPlanForEdit"
      );
      console.log(
        "[handleEditPlan] Details auditTeams:",
        detailsWithId.auditTeams
      );
      
      // Use formState.loadPlanForEdit with the best-effort details
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
          const teamIds = (teamsByAudit || [])
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

      console.log(
        "[handleEditPlan] After loadPlanForEdit - selectedAuditorIds:",
        formState.selectedAuditorIds
      );
      console.log(
        "[handleEditPlan] After loadPlanForEdit - originalSelectedAuditorIds:",
        originalAuditorIds
      );
      console.log(
        "[handleEditPlan] After loadPlanForEdit - auditorOptions:",
        auditorOptions.length
      );

      // Manually trigger auditor options update after setting originalSelectedAuditorIds
      // This ensures auditors are loaded even if useEffect hasn't run yet
      const norm = (s: string) =>
        String(s || "")
          .toLowerCase()
          .replace(/\s+/g, "");

      // Ensure we have users data - use usersArray if available, otherwise wait for allUsers to be set
      let currentAllUsers = usersArray.length > 0 ? usersArray : allUsers;

      // If still empty, wait a bit and try again (state might not be updated yet)
      if (currentAllUsers.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        currentAllUsers = allUsers.length > 0 ? allUsers : usersArray;
      }

      const allAuditors = (currentAllUsers || []).filter(
        (u: any) => norm(u.roleName || u.role) === "auditor"
      );

      console.log("[handleEditPlan] allAuditors count:", allAuditors.length);
      console.log("[handleEditPlan] originalAuditorIds:", originalAuditorIds);
      console.log(
        "[handleEditPlan] allAuditors userIds:",
        allAuditors.map((u: any) => String(u.userId || u.id || u.$id || ""))
      );

      if (formState.periodFrom && formState.periodTo) {
        try {
          const available = await getAvailableAuditors({
            periodFrom: formState.periodFrom,
            periodTo: formState.periodTo,
            excludePreviousPeriod: true,
          });
          const availableAuditors = (available || []).filter(
            (u: any) => norm(u.roleName || u.role) === "auditor"
          );

          // Get original selected auditors - match by userId (case-insensitive)
          const originalSelectedIds = new Set(
            originalAuditorIds.map((id) => String(id).toLowerCase().trim())
          );
          const originalSelectedAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "")
              .toLowerCase()
              .trim();
            return originalSelectedIds.has(userId);
          });

          console.log(
            "[handleEditPlan] Found original selected auditors:",
            originalSelectedAuditors.length,
            originalSelectedAuditors.map((u: any) => ({
              userId: u.userId || u.id || u.$id,
              name: u.fullName || u.name,
            }))
          );

          // Merge: original selected + available (avoid duplicates)
          const originalIds = new Set(
            originalSelectedAuditors.map((u: any) =>
              String(u.userId || u.id || u.$id || "")
                .toLowerCase()
                .trim()
            )
          );
          const additionalAvailable = availableAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "")
              .toLowerCase()
              .trim();
            return !originalIds.has(userId);
          });

          const mergedAuditors = [
            ...originalSelectedAuditors,
            ...additionalAvailable,
          ];
          console.log(
            "[handleEditPlan] Manually merged auditors - original:",
            originalSelectedAuditors.length,
            "available:",
            availableAuditors.length,
            "merged:",
            mergedAuditors.length
          );
          setAuditorOptions(mergedAuditors);
        } catch (err) {
          console.error(
            "[handleEditPlan] Failed to manually load auditors",
            err
          );
          // Fallback: show original selected + all auditors
          const originalSelectedIds = new Set(
            originalAuditorIds.map((id) => String(id).toLowerCase().trim())
          );
          const originalSelectedAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "")
              .toLowerCase()
              .trim();
            return originalSelectedIds.has(userId);
          });
          const remainingAuditors = allAuditors.filter((u: any) => {
            const userId = String(u.userId || u.id || u.$id || "")
              .toLowerCase()
              .trim();
            return !originalSelectedIds.has(userId);
          });
          const fallbackAuditors = [
            ...originalSelectedAuditors,
            ...remainingAuditors,
          ];
          console.log(
            "[handleEditPlan] Fallback - setting auditors:",
            fallbackAuditors.length
          );
          setAuditorOptions(fallbackAuditors);
        }
      } else {
        // No period dates, show original selected + all auditors
        const originalSelectedIds = new Set(
          originalAuditorIds.map((id) => String(id).toLowerCase().trim())
        );
        const originalSelectedAuditors = allAuditors.filter((u: any) => {
          const userId = String(u.userId || u.id || u.$id || "")
            .toLowerCase()
            .trim();
          return originalSelectedIds.has(userId);
        });
        const remainingAuditors = allAuditors.filter((u: any) => {
          const userId = String(u.userId || u.id || u.$id || "")
            .toLowerCase()
            .trim();
          return !originalSelectedIds.has(userId);
        });
        const noPeriodAuditors = [
          ...originalSelectedAuditors,
          ...remainingAuditors,
        ];
        console.log(
          "[handleEditPlan] No period - setting auditors:",
          noPeriodAuditors.length
        );
        setAuditorOptions(noPeriodAuditors);
      }

      await hydrateTemplateSelection(auditId, detailsWithId?.templateId);
    } catch (error) {
      console.error("Failed to load plan for editing", error);
      alert(
        "⚠️ Cannot load plan for editing\n\nError: " + (error as any)?.message
      );
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
        console.error("Failed to refresh plans after submit", refreshErr);
      }

      toast.success("Submit successfully.");
    } catch (err: any) {
      console.error("Failed to submit to Lead Auditor", err);
      const errorMessage =
        err?.response?.data?.message || err?.message || String(err);
      toast.error("Failed to submit to Lead Auditor: " + errorMessage);
    }
  };

  // Get current user's userId for PlanDetailsModal only (list filtering uses inline logic above)
  const currentUserId = useMemo(() => {
    if (!user) return null;

    const fallbackId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.$id ?? null;

    if (!allUsers.length) {
      return fallbackId ? String(fallbackId).trim() : null;
    }

    const found = allUsers.find((u: any) => {
      const uEmail = String(u?.email || "")
        .toLowerCase()
        .trim();
      const userEmail = String(user.email || "")
        .toLowerCase()
        .trim();
      return uEmail && userEmail && uEmail === userEmail;
    });

    const resolvedId = found?.userId ?? found?.$id ?? fallbackId;
    return resolvedId != null ? String(resolvedId).trim() : null;
  }, [user, allUsers]);

  // Helper: Check if form has any data entered
  const hasFormData = useMemo(() => {
    return (
      formState.title.trim() !== "" ||
      formState.goal.trim() !== "" ||
      formState.periodFrom !== "" ||
      formState.periodTo !== "" ||
      formState.auditType !== "Internal" ||
      formState.level !== "academy" ||
      formState.selectedDeptIds.length > 0 ||
      formState.selectedCriteriaIds.length > 0 ||
      formState.selectedTemplateIds.length > 0 ||
      formState.selectedLeadId !== "" ||
      formState.selectedAuditorIds.length > 0 ||
      formState.kickoffMeeting !== "" ||
      formState.fieldworkStart !== "" ||
      formState.evidenceDue !== "" ||
      formState.draftReportDue !== "" ||
      formState.capaDue !== ""
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
      toast.warning("Please enter a title for the plan.");
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.periodFrom || !formState.periodTo) {
      toast.warning("Please select the start and end dates.");
      formState.setCurrentStep(1);
      return;
    }

    if (!validatePlanPeriod(formState.periodFrom, formState.periodTo, true)) {
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.selectedTemplateIds.length) {
      toast.warning("Please select at least one Checklist Template (Step 3).");
      formState.setCurrentStep(3);
      return;
    }
    if (formState.level === "department") {
      if (formState.selectedDeptIds.length === 0) {
        toast.warning(
          "Please select at least one department for the Department scope (Step 2)."
        );
        formState.setCurrentStep(2);
        return;
      }
      const ownersForDepts = ownerOptions.filter((o: any) =>
        formState.selectedDeptIds.includes(String(o.deptId ?? ""))
      );
      if (ownersForDepts.length === 0) {
        if (
          !window.confirm(
            "⚠️ The selected departments do not have an Auditee Owner yet.\n\nDo you want to continue creating the audit plan?"
          )
        ) {
          formState.setCurrentStep(4);
          return;
        }
      }
    }

    // Schedule constraints: unique dates and strictly increasing order
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    if (scheduleErrorMessages.length > 0) {
      toast.error("Invalid schedule:\n\n" + scheduleErrorMessages.join("\n"));
      formState.setCurrentStep(5);
      return;
    }

    const primaryTemplateId = formState.selectedTemplateIds[0];

    const basicPayload: any = {
      title: formState.title || "Untitled Plan",
      type: formState.auditType || "Internal",
      scope: formState.level === "academy" ? "Academy" : "Department",
      templateId: primaryTemplateId || undefined,
      startDate: formState.periodFrom
        ? new Date(formState.periodFrom).toISOString()
        : undefined,
      endDate: formState.periodTo
        ? new Date(formState.periodTo).toISOString()
        : undefined,
      status: "Draft",
      isPublished: false,
      objective: formState.goal || "",
    };

    try {
      let auditId: string;

      // Check if we're in edit mode but editingAuditId is missing
      if (formState.isEditMode && !formState.editingAuditId) {
        console.error(
          "WARNING: isEditMode is true but editingAuditId is empty!"
        );
        toast.error(
          "Cannot update: Missing audit ID. Please try editing again."
        );
        return;
      }

      if (formState.isEditMode && formState.editingAuditId) {
        // Use complete-update API for edit mode
        auditId = formState.editingAuditId;

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

        try {
          await completeUpdateAuditPlan(auditId, completeUpdatePayload);
        } catch (apiError) {
          console.error("Complete-update API failed:", apiError);
          throw apiError; // Re-throw to be caught by outer try-catch
        }
      } else {
        // Create new audit (keep existing logic)
        
        // Business Rule Validation: Validate trước khi tạo audit
        const startDate = formState.periodFrom;
        const endDate = formState.periodTo;
        
        if (startDate && endDate) {
          // Kiểm tra auditor đã có plan/assignment trong kỳ này chưa
          if (!currentUserId) {
            toast.error(
              "Cannot verify auditor assignment. Please re-login and try again."
            );
            return;
          }
          const assignmentValidation = await validateAssignmentBeforeCreate(
            String(currentUserId),
            startDate,
            endDate
          );
          if (!assignmentValidation.isValid) {
            toast.error(
              assignmentValidation.message ||
                "Auditor already has a plan in this period."
            );
            throw new Error(
              assignmentValidation.message ||
                "Auditor already has a plan in this period."
            );
          }
          
          // Lấy danh sách department IDs sẽ được thêm
          let deptIdsToValidate: number[] = [];
          if (formState.level === "academy") {
            deptIdsToValidate = departments.map((d) => Number(d.deptId));
          } else if (
            formState.level === "department" &&
            formState.selectedDeptIds.length > 0
          ) {
            deptIdsToValidate = formState.selectedDeptIds.map((id) =>
              Number(id)
            );
          }
          
          // Validate với điều kiện (check trùng time + trùng phòng ban → check scope)
          const validation = await validateBeforeCreateAudit(
            startDate,
            endDate,
            deptIdsToValidate,
            formState.selectedCriteriaIds // Scope (criteria/standards) để check trùng scope
          );

          // Nếu có conflicts, lưu conflict data và hiển thị modal
          if (validation.warnings.length > 0) {
            // Get conflicts from validation (need to call validateDepartmentWithConditions directly to get conflicts)
            const deptValidation = await validateDepartmentWithConditions(
              null,
              deptIdsToValidate,
              startDate,
              endDate,
              formState.selectedCriteriaIds
            );

            if (
              deptValidation.conflicts &&
              deptValidation.conflicts.audits.length > 0
            ) {
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
              });
              setShowConflictModal(true);

              // Don't throw error, just show modal warning
              // User can continue but should select different criteria
            } else {
              // No conflicts, reset filtered criteria
              setFilteredCriteria([]);
              setConflictData(null);
            }
          } else {
            // No warnings, reset filtered criteria
            setFilteredCriteria([]);
            setConflictData(null);
          }

          // Chỉ reject nếu có errors (không phải warnings)
          if (validation.errors.length > 0) {
            validation.errors.forEach((error) => {
              toast.error(error);
            });
            throw new Error(
              "Validation failed. Please check the errors above."
            );
          }
        }
        
        const resp = await createAudit(basicPayload);
        auditId = resp?.auditId || resp?.id || resp;

        if (!auditId) {
          throw new Error("No auditId returned from createAudit API");
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
          console.error("Failed to sync checklist templates", templateMapErr);
          toast.error(
            "Failed to save checklist template mappings. Please retry from Step 3."
          );
        }

        // Attach departments
        try {
          let deptIdsToAttach: string[] = [];
          
          if (formState.level === "academy") {
            // When level is "Entire Aviation Academy", attach all departments
            deptIdsToAttach = departments.map((d) => String(d.deptId));
          } else if (
            formState.level === "department" &&
            formState.selectedDeptIds.length > 0
          ) {
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
                    toast.error(
                      `Department validation failed: ${deptValidation.message}`
                    );
                    throw new Error(deptValidation.message);
                  }
                }
                
                // Nếu validation pass, mới thêm department
                return await addAuditScopeDepartment(
                  String(newAuditId),
                  Number(deptId)
                );
              })
            );
            
            const failedDepts = deptResults.filter(
              (r) => r.status === "rejected"
            );
            if (failedDepts.length > 0) {
              console.error("Some departments failed to attach:", failedDepts);
              toast.warning(
                `${failedDepts.length} department(s) failed to attach. Please check the errors above.`
              );
            }
            
            // Set sensitive flags for departments if enabled
            if (
              formState.sensitiveFlag &&
              formState.sensitiveAreas.length > 0
            ) {
              try {
                // Use the response from addAuditScopeDepartment instead of calling API again
                // Response contains ViewAuditScopeDepartment with AuditScopeId
                const successfulDepts = deptResults
                  .filter((r) => r.status === "fulfilled")
                  .map((r) => (r as PromiseFulfilledResult<any>).value)
                  .filter(Boolean);
                
                // Parse sensitive areas to extract which departments have sensitive areas
                // Format: "area name - department name"
                // Example: "Server Room - Phòng A" -> deptName = "Phòng A"
                const deptNamesWithAreas = new Set<string>();
                const areasByDeptName = new Map<string, string[]>();

                formState.sensitiveAreas.forEach((formattedArea: string) => {
                  // Parse format: "area - deptName"
                  const parts = formattedArea.split(" - ");
                  if (parts.length >= 2) {
                    const deptName = parts.slice(1).join(" - "); // Handle cases where area name contains " - "
                    deptNamesWithAreas.add(deptName);

                    // Group areas by department name
                    if (!areasByDeptName.has(deptName)) {
                      areasByDeptName.set(deptName, []);
                    }
                    areasByDeptName.get(deptName)!.push(formattedArea);
                  }
                });

                // Map department names to department IDs
                const deptIdsWithAreas = new Set<number>();
                const allDepts =
                  formState.level === "academy"
                    ? departments
                    : departments.filter((d) =>
                        formState.selectedDeptIds.includes(String(d.deptId))
                      );

                allDepts.forEach((dept) => {
                  const deptName = dept.name || "";
                  if (deptNamesWithAreas.has(deptName)) {
                    deptIdsWithAreas.add(Number(dept.deptId));
                  }
                });

                // Only set sensitive flag for departments that have sensitive areas selected
                const sensitivePromises = successfulDepts
                  .filter((sd: any) => {
                    const sdDeptId = Number(sd.deptId || sd.$deptId);
                    return deptIdsWithAreas.has(sdDeptId);
                  })
                  .map((sd: any) => {
                    // ViewAuditScopeDepartment has AuditScopeId field
                    const scopeDeptId =
                      sd.auditScopeId ||
                      sd.AuditScopeId ||
                      sd.scopeDeptId ||
                      sd.$scopeDeptId ||
                      sd.id ||
                      sd.auditScopeDepartmentId;
                    if (!scopeDeptId) {
                      return null;
                    }

                    // Get department name to find its areas
                    const sdDeptId = Number(sd.deptId || sd.$deptId);
                    const dept = allDepts.find(
                      (d) => Number(d.deptId) === sdDeptId
                    );
                    const deptName = dept?.name || "";

                    // Get areas for this specific department
                    const deptAreas = areasByDeptName.get(deptName) || [];
                    
                    // Convert to string (GUID format expected by backend)
                    const scopeDeptIdStr = String(scopeDeptId);
                    
                    return setSensitiveFlag(scopeDeptIdStr, {
                      sensitiveFlag: true,
                      areas: deptAreas, // Only areas for this department
                      notes: formState.sensitiveNotes || "",
                    });
                  })
                  .filter(Boolean);
                
                if (sensitivePromises.length > 0) {
                  const results = await Promise.allSettled(sensitivePromises);
                  const successful = results.filter(
                    (r) => r.status === "fulfilled"
                  ).length;
                  const failed = results.filter(
                    (r) => r.status === "rejected"
                  ).length;
                  
                  if (failed > 0) {
                    toast.warning(
                      `${failed} sensitive flag(s) could not be saved.`
                    );
                  } else if (successful > 0) {
                    toast.success(
                      `Sensitive flags saved successfully for ${successful} department(s).`
                    );
                  }
                } else {
                  toast.warning(
                    "Could not find scope departments to set sensitive flags. Please try editing the plan to set them manually."
                  );
                }
              } catch (sensitiveErr: any) {
                console.error("Failed to set sensitive flags:", sensitiveErr);
                toast.warning(
                  "Plan created but sensitive flags could not be saved. Please update manually."
                );
              }
            }
            }
          } catch (scopeErr) {
          console.error("Attach departments to audit failed", scopeErr);
        }

        // Attach criteria with deptId using bulk API (status removed per backend change)
        try {
          const mappings: Array<{ deptId: number; criteriaId: string }> = [];
          
          if (formState.level === "department" && formState.selectedDeptIds.length > 0) {
            // Department level: use selectedCriteriaByDept if available, otherwise assign all criteria to all departments
            if (selectedCriteriaByDept.size > 0) {
              // Build mappings from selectedCriteriaByDept (per-department selection)
              selectedCriteriaByDept.forEach((criteriaSet, deptIdStr) => {
                const deptId = Number(deptIdStr);
                if (!isNaN(deptId) && deptId > 0 && deptIdStr !== 'shared' && deptIdStr !== 'academy') {
                  criteriaSet.forEach((criteriaId) => {
                    mappings.push({
                      deptId: deptId,
                      criteriaId: criteriaId,
                    });
                  });
                }
              });
            }
            
            // If no mappings from selectedCriteriaByDept, assign all criteria to all selected departments
            if (mappings.length === 0 && formState.selectedCriteriaIds.length > 0) {
              formState.selectedDeptIds.forEach((deptIdStr) => {
                const deptId = Number(deptIdStr);
                if (!isNaN(deptId) && deptId > 0) {
                  formState.selectedCriteriaIds.forEach((criteriaId) => {
                    mappings.push({
                      deptId: deptId,
                      criteriaId: criteriaId,
                    });
                  });
                }
              });
            }
          } else if (formState.level === "academy") {
            // Academy level: get criteria from selectedCriteriaByDept.get('academy') or fallback to selectedCriteriaIds
            let academyCriteria: string[] = [];
            
            // Try to get from selectedCriteriaByDept first
            const academySet = selectedCriteriaByDept.get('academy');
            if (academySet && academySet.size > 0) {
              academyCriteria = Array.from(academySet);
            } else if (formState.selectedCriteriaIds.length > 0) {
              // Fallback to selectedCriteriaIds
              academyCriteria = formState.selectedCriteriaIds;
            }
            
            if (academyCriteria.length > 0) {
              // Get all departments for academy level
              const allDepts = await ensureDepartmentsLoaded();
              
              if (allDepts.length > 0) {
                allDepts.forEach((dept) => {
                  const deptId = Number(dept.deptId);
                  if (!isNaN(deptId) && deptId > 0) {
                    academyCriteria.forEach((criteriaId) => {
                      mappings.push({
                        deptId: deptId,
                        criteriaId: criteriaId,
                      });
                    });
                  }
                });
              } else {
                console.warn('[handleSubmitPlan] Academy level: No departments found, cannot create criteria mappings');
                toast.warning('No departments found. Please ensure departments are configured.');
              }
            } else {
              console.warn('[handleSubmitPlan] Academy level: No criteria selected');
            }
          }
          
          if (mappings.length > 0) {
            console.log('[handleSubmitPlan] Using bulk API with mappings:', mappings.length, 'mappings');
            console.log('[handleSubmitPlan] Sample mappings:', mappings.slice(0, 3));
            await bulkCreateAuditCriteriaMappings({
              auditId: String(newAuditId),
              mappings: mappings
            });
            console.log('[handleSubmitPlan] Successfully created criteria mappings');
          } else {
            console.warn('[handleSubmitPlan] No mappings to create - skipping criteria attachment');
          }
        } catch (critErr: any) {
            console.error("Attach criteria to audit failed", critErr);
          console.error("Error details:", {
            message: critErr?.message,
            response: critErr?.response?.data,
            status: critErr?.response?.status
          });
          toast.error("Failed to attach criteria to audit. Please try again.");
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
                roleInTeam: "Auditor",
                isLead: false,
              })
            );
          });

          if (formState.level === "academy") {
            const uniqueOwnerIds = Array.from(
              new Set(
                ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)
              )
            );
            uniqueOwnerIds.forEach((uid) => {
              calls.push(
                addTeamMember({
                  auditId: String(newAuditId),
                  userId: uid,
                  roleInTeam: "AuditeeOwner",
                  isLead: false,
                })
              );
            });
          } else {
            const ownersForDepts = ownerOptions.filter((o: any) =>
              formState.selectedDeptIds.includes(String(o.deptId ?? ""))
            );
            ownersForDepts.forEach((owner: any) => {
              if (owner.userId) {
                calls.push(
                  addTeamMember({
                    auditId: String(newAuditId),
                    userId: String(owner.userId),
                    roleInTeam: "AuditeeOwner",
                    isLead: false,
                  })
                );
              }
            });
          }

          if (calls.length) {
            await Promise.allSettled(calls);
          }
        } catch (teamErr) {
          console.error("Attach team failed", teamErr);
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
                notes: "",
              })
            );
            await Promise.allSettled(schedulePromises);
          }
        } catch (scheduleErr) {
          console.error("Failed to post schedules", scheduleErr);
        }
      }

      // Refresh plans list and related data
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error("Failed to refresh plans list", refreshErr);
      }

      // Refresh audit teams (needed for visiblePlans calculation)
      try {
        const teams = await getAuditTeam();
        setAuditTeams(Array.isArray(teams) ? teams : []);
      } catch (teamErr) {
        console.error("Failed to refresh audit teams", teamErr);
      }

      // Refresh users (needed for visiblePlans calculation)
      try {
        const users = await getAdminUsers();
        setAllUsers(Array.isArray(users) ? users : []);
        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .replace(/\s+/g, "");
        const auditors = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditor"
        );
        const owners = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditeeowner"
        );
        setAuditorOptions(auditors);
        setOwnerOptions(owners);
      } catch (userErr) {
        console.error("Failed to refresh users", userErr);
      }

      // Save edit mode state before resetting form
      const wasEditMode = formState.isEditMode;
      
      // Reset form (closes form after successful creation)
      formState.resetForm();
      setOriginalSelectedAuditorIds([]); // Reset original selected auditors when closing modal

      const successMsg = wasEditMode
        ? "Audit plan updated successfully."
        : "Create Audit plan successfully.";
      toast.success(successMsg);
    } catch (err: any) {
      const serverMsg =
        err?.response?.data || err?.response || err?.message || err;
      console.error("Create audit failed", err, serverMsg);
      let errorMessage = "Failed to create audit plan.";
      try {
        if (typeof serverMsg === "object") {
          errorMessage =
            serverMsg?.message || JSON.stringify(serverMsg, null, 2);
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
      <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-6 animate-slideInLeft">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Audit Planning</h1>
            <p className="text-[#5b6166] text-sm mt-1">
              Create and manage audit plans
            </p>
          </div>
          <button
            onClick={() => {
              // Check permission before opening form
              if (isCheckingPermission) {
                toast.info("Checking permission...");
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
                setOriginalSelectedAuditorIds([]); // Reset original selected auditors when creating new plan
              } else if (!formState.showForm) {
                // If form is closed, reset and open it
                formState.resetFormForCreate();
                setOriginalSelectedAuditorIds([]); // Reset original selected auditors when creating new plan
                formState.setShowForm(true);
              } else {
                // If form is open and not in edit mode, just close it
                formState.setShowForm(false);
              }
            }}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:shadow-lg text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-md"
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
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800 mb-1">
                  Plan Creation Permission Granted
                </h3>
                <p className="text-sm text-green-700">
                  You have been granted permission to create audit plans. Click
                  the "Create New Plan" button above to get started.
                </p>
              </div>
            </div>
          </div>
        )}

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
                      setOriginalSelectedAuditorIds([]); // Reset original selected auditors when closing modal
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
                          setOriginalSelectedAuditorIds([]); // Reset original selected auditors when closing modal
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
                    <DRLTemplateViewer drlFiles={drlTemplateFiles} />
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
                  />
                  </>
                )}

                {formState.currentStep === 2 && (
                  <div className="space-y-4">
                  <Step2Scope
                    level={formState.level}
                    selectedDeptIds={formState.selectedDeptIds}
                    departments={availableDepartments}
                        criteria={
                          filteredCriteria.length > 0 && conflictData
                            ? filteredCriteria
                            : criteria
                        }
                    selectedCriteriaIds={formState.selectedCriteriaIds}
                    onLevelChange={formState.setLevel}
                        onSelectedDeptIdsChange={(value) => {
                          formState.setSelectedDeptIds(value);
                          // Reset conflict data when departments change
                          setFilteredCriteria([]);
                          setConflictData(null);
                          setShowConflictModal(false);
                        }}
                   selectedCriteriaByDeptMap={selectedCriteriaByDept}
                   onSelectedCriteriaByDeptChange={(map) => {
                      setSelectedCriteriaByDept(map);
                      // Keep selectedCriteriaIds in sync with union of map
                      const union = new Set<string>();
                      map.forEach((set) => set.forEach((id) => union.add(String(id))));
                      const unionArr = Array.from(union);
                      formState.setSelectedCriteriaIds(unionArr);
                   }}
                    periodFrom={formState.periodFrom}
                    periodTo={formState.periodTo}
                    editingAuditId={formState.editingAuditId}
                  />
                    <SensitiveAreaForm
                      sensitiveFlag={formState.sensitiveFlag}
                      sensitiveAreas={formState.sensitiveAreas}
                      sensitiveNotes={formState.sensitiveNotes}
                      onFlagChange={formState.setSensitiveFlag}
                      onAreasChange={formState.setSensitiveAreas}
                      onNotesChange={formState.setSensitiveNotes}
                      selectedDeptIds={formState.selectedDeptIds}
                      departments={departments}
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
                        // Step 1 - Cancel button
                        if (hasFormData || formState.isEditMode) {
                            if (
                              window.confirm(
                                "Are you sure you want to cancel? All unsaved changes will be lost."
                              )
                            ) {
                            formState.resetForm();
                              setOriginalSelectedAuditorIds([]); // Reset original selected auditors when closing modal
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
                              formState.setCurrentStep(
                                formState.currentStep + 1
                              );
                          } else {
                            // Show validation message based on current step
                              let message = "";
                            switch (formState.currentStep) {
                              case 1:
                                  message =
                                    "Please fill in the information: Title, Type, Period From, and Period To.";
                                break;
                              case 2:
                                  message =
                                    formState.level === "department"
                                      ? "Please select at least 1 department and 1 inspection criterion"
                                      : "Please select at least 1 inspection criterion";
                                break;
                              case 3:
                                  if (
                                    formState.level === "department" &&
                                    formState.selectedDeptIds.length > 0
                                  ) {
                                  // Get selected templates with their deptId
                                    const selectedTemplates =
                                      checklistTemplates.filter((tpl: any) =>
                                        formState.selectedTemplateIds.includes(
                                          String(
                                            tpl.templateId || tpl.id || tpl.$id
                                          )
                                        )
                                  );
                                    const selectedDeptIdsSet = new Set(
                                      formState.selectedDeptIds.map((id) =>
                                        String(id).trim()
                                      )
                                    );
                                    const deptIdsWithTemplates =
                                      new Set<string>();
                                  selectedTemplates.forEach((tpl: any) => {
                                    const tplDeptId = tpl.deptId;
                                      if (
                                        tplDeptId != null &&
                                        tplDeptId !== undefined
                                      ) {
                                        deptIdsWithTemplates.add(
                                          String(tplDeptId).trim()
                                        );
                                    }
                                  });
                                    const missingDepts = Array.from(
                                      selectedDeptIdsSet
                                    ).filter(
                                      (deptId) =>
                                        !deptIdsWithTemplates.has(deptId)
                                    );
                                  if (missingDepts.length > 0) {
                                      const deptNames = missingDepts
                                        .map((deptId) => {
                                          const dept = departments.find(
                                            (d) => String(d.deptId) === deptId
                                          );
                                      return dept?.name || deptId;
                                        })
                                        .join(", ");
                                    message = `Please select at least one template for each selected department. Missing templates for: ${deptNames}`;
                                  } else {
                                      message =
                                        "Please select a Checklist Template.";
                                  }
                                } else {
                                    message =
                                      "Please select a Checklist Template.";
                                }
                                break;
                              case 4:
                                  message =
                                    "Please select at least 2 auditors.";
                                break;
                              default:
                                  message =
                                    "Please fill in all information before continuing.";
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
                          className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                        >
                            {formState.isEditMode
                              ? " Update Plan"
                              : " Submit Plan"}
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
                                  setOriginalSelectedAuditorIds([]); // Reset original selected auditors when closing modal
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

        {/* Main Tabs Navigation */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveMainTab("plans")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === "plans"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  My Plans
                </div>
              </button>
              <button
                onClick={() => setActiveMainTab("drl-templates")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === "drl-templates"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  DRL Templates
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content: My Plans */}
        {activeMainTab === "plans" && (
          <>
        {/* Filter Section */}
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

        {/* Plans Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200">
          <div className="bg-white p-4">
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
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-center gap-3">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setActivePlansTab(pageNum)}
                    className={`px-4 py-2 rounded font-medium transition ${
                      activePlansTab === pageNum
                                ? "bg-primary-600 text-white"
                                : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                        )
                      )}
              </div>
            );
          })()}
          </div>
        </div>
          </>
        )}

        {/* Tab Content: DRL Templates */}
        {activeMainTab === "drl-templates" && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Received DRL Templates
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  View all DRL templates sent by Lead Auditor when assigning you
                  to create audit plans.
                </p>
              </div>
              <DRLTemplateHistory userId={currentUserId} />
            </div>
          </div>
        )}

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
            getDepartmentName={(id: string | number) =>
              getDepartmentName(id, departments)
            }
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
        )}

        {/* Permission Denied Modal */}
        {showPermissionModal &&
          createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/40"
                onClick={() => setShowPermissionModal(false)}
              ></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                  <svg
                    className="w-8 h-8 text-red-600"
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
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Permission Denied
              </h3>
              <p className="text-gray-600 text-center mb-6">
                  You have not been selected by the lead auditor to create a
                  plan.
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
                        Cảnh báo: Trùng phòng ban
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Có {conflictData.conflicts?.audits.length || 0} audit
                        plan kiểm định phòng ban đó
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                      <p className="text-sm font-medium text-yellow-800">
                        💡 Hãy chọn tiêu chuẩn kiểm định khác với cuộc kiểm định
                        đó
                      </p>
                    </div>

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
                                      Tiêu chuẩn đã sử dụng:
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
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Đã hiểu
                  </button>
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
