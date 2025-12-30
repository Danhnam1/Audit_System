import { MainLayout } from "../../../layouts";
import { PageHeader } from "../../../components";
import { useAuth } from "../../../contexts";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { AuditPlan, AuditPlanDetails } from "../../../types/auditPlan";
import { 
  getAuditApprovals, 
  getAuditPlanById,
  getSensitiveDepartments,
  createAudit,
  addAuditScopeDepartment,
  submitToLeadAuditor,
  completeUpdateAuditPlan,
  deleteAuditPlan,
} from "../../../api/audits";
import { getChecklistTemplates, createAuditChecklistItemsFromTemplate } from "../../../api/checklists";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { addCriterionToAudit } from "../../../api/auditCriteriaMap";
import { getAdminUsers } from "../../../api/adminUsers";
import { addTeamMember, getAuditTeam } from "../../../api/auditTeam";
import { getDepartments } from "../../../api/departments";
import { addAuditSchedule, getAuditSchedules } from "../../../api/auditSchedule";
import { MILESTONE_NAMES, SCHEDULE_STATUS } from "../../../constants/audit";
import { getDepartmentSensitiveAreas } from "../../../api/departmentSensitiveAreas";
import { getPlansWithDepartments } from "../../../services/auditPlanning.service";
import {
  getAuditChecklistTemplateMapsByAudit,
  syncAuditChecklistTemplateMaps,
} from "../../../api/auditChecklistTemplateMaps";
import { normalizePlanDetails, unwrap } from "../../../utils/normalize";
import { useUserId } from "../../../store/useAuthStore";
import { 
  validateBeforeCreateAudit, 
  validateBeforeAddDepartment,
  validateDepartmentWithConditions,
  validateScheduleMilestones,
} from "../../../helpers/businessRulesValidation";

// Import custom hooks
import { useAuditPlanForm } from "../../../hooks/useAuditPlanForm";
import { useAuditPlanFilters } from "../../../hooks/useAuditPlanFilters";
import { loadPlanDetailsForEdit } from "../../LeadAuditor/auditplanning/components/editPlanService";

// Import helper functions
import {
  getCriterionName,
  getDepartmentName,
} from "../../../helpers/auditPlanHelpers";
import { getStatusColor, getBadgeVariant } from "../../../constants";
import { toast } from "react-toastify";

// Import components
import { FilterBar } from "./components/FilterBar";
import { PlanTable } from "./components/PlanTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";
import { Step1BasicInfo } from "../../LeadAuditor/auditplanning/components/PlanForm/Step1BasicInfo";
import { Step2Scope } from "../../LeadAuditor/auditplanning/components/PlanForm/Step2Scope";
import { Step3Checklist } from "../../LeadAuditor/auditplanning/components/PlanForm/Step3Checklist";
import { Step4Team } from "../../LeadAuditor/auditplanning/components/PlanForm/Step4Team";
import { Step5Schedule } from "../../LeadAuditor/auditplanning/components/PlanForm/Step5Schedule";
import { SensitiveAreaForm } from "../../LeadAuditor/auditplanning/components/PlanForm/SensitiveAreaForm";

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const userIdFromToken = useUserId();

  // Use custom hooks for form state management
  const formState = useAuditPlanForm();

  // Data fetching states
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // Form submission state
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  
  // Store selected criteria by department (Map<deptId, Set<criteriaId>>)
  const [selectedCriteriaByDept, setSelectedCriteriaByDept] = useState<Map<string, Set<string>>>(new Map());
  
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
        status?: string;
        overlapDays?: number;
      }>;
    };
    usedCriteriaIds: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
    hasScopeOverlap?: boolean;
  } | null>(null);
  
  // Filtered criteria (exclude criteria used in conflicting audits)
  const [filteredCriteria, setFilteredCriteria] = useState<any[]>([]);
  
  // Original selected auditors from plan (when editing) - kept for future edit functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [originalSelectedAuditorIds, setOriginalSelectedAuditorIds] = useState<string[]>([]);


  // Only show plans where current user is in AuditTeam (and status is in allowed list)
  const visiblePlans = useMemo(() => {
    // Determine current user's id for this memo
    // Priority: userIdFromToken (from JWT) > user.userId (from user object)
    const currentId = (() => {
      // First try userIdFromToken (most reliable, from JWT token)
      if (userIdFromToken) {
        return String(userIdFromToken).trim();
      }

      // Fallback to user object
      if (!user) return null;

      const fallbackId =
        (user as any)?.userId ??
        (user as any)?.id ??
        (user as any)?.$id ??
        null;

        return fallbackId ? String(fallbackId).trim() : null;
    })();

    // 1) Status filter:
    //    - Auditor có thể xem plans có status "Draft" (của chính họ), "Approved" và "InProgress"
    const statusFiltered = existingPlans.filter((plan) => {
      const normStatus = String(plan.status || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      return normStatus === "draft" || normStatus === "approved" || normStatus === "inprogress";
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
        // Try multiple possible field names for userId in audit team
        const memberUserId = m?.userId ?? m?.id ?? m?.$id ?? m?.user?.userId ?? m?.user?.id;
        if (memberUserId == null) return;
        
        // Normalize both sides for comparison (handle GUID, string, etc.)
        const memberNorm = String(memberUserId).toLowerCase().trim();
        if (!memberNorm) return;
        
        // Compare normalized IDs
        if (memberNorm !== normalizedCurrentUserId) return;

        // Collect all possible auditId field names
        const candidates = [
          m.auditId, 
          m.auditPlanId, 
          m.planId,
          m?.audit?.auditId,
          m?.audit?.id,
          m?.auditPlan?.auditId,
          m?.auditPlan?.id
        ]
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
        
      }

      return false;
    };

    return statusFiltered.filter(planMatchesUser) as AuditPlan[];
  }, [existingPlans, auditTeams, user, userIdFromToken]);

  // Use filter hook limited to visible statuses & membership
  const filterState = useAuditPlanFilters(visiblePlans);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] =
    useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<
    any[]
  >([]);

  const layoutUser = user
    ? { name: user.fullName, avatar: undefined }
    : undefined;

  // Load audit teams - needs to be refreshed when plans change
  const fetchAuditTeams = async () => {
    try {
      const teams = await getAuditTeam();
      // Filter out AuditeeOwner from audit teams
      const filteredTeams = Array.isArray(teams) 
        ? teams.filter((m: any) => {
            const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
            return role !== 'auditeeowner';
          })
        : [];
      setAuditTeams(filteredTeams);
    } catch (err) {
      console.error("Failed to load audit teams", err);
    }
  };

  // Load audit plans and audit teams
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
        // Refresh audit teams after loading plans to ensure we have latest team assignments
        await fetchAuditTeams();
      } catch (error) {
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Also load audit teams on initial mount (before plans are loaded)
  useEffect(() => {
    fetchAuditTeams();
  }, []);

  // Get current user ID from auditorOptions
  const currentUserId = useMemo(() => {
    if (!user?.email || !auditorOptions.length) return null;
    const found = auditorOptions.find((u: any) => {
      const uEmail = String(u?.email || '').toLowerCase().trim();
      const userEmail = String(user.email).toLowerCase().trim();
      return uEmail === userEmail;
    });
    return found?.userId ? String(found.userId) : null;
  }, [user?.email, auditorOptions]);

  // Load users for PlanDetailsModal and form
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getAdminUsers();
        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .replace(/\s+/g, "");
        const auditors = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditor" || norm(u.roleName) === "leadauditor"
        );
        const owners = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditeeowner"
        );
        setAuditorOptions(auditors);
        setOwnerOptions(owners);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchUsers();
  }, []);

  // Auto-set Lead Auditor = current user when entering Step 4 or when currentUserId is available
  useEffect(() => {
    if (currentUserId && formState.currentStep === 4 && !formState.selectedLeadId) {
      formState.setSelectedLeadId(currentUserId);
    }
  }, [currentUserId, formState.currentStep, formState.selectedLeadId]);

  // Load checklist templates and criteria
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
      } catch (err) {
        console.error("Failed to load checklist templates", err);
      }
    };
    load();
  }, []);

  // Load departments
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
    loadDepts();
  }, [departments.length]);

  // Helpers: date and schedule validations
  const toDate = (s?: string | null) => (s ? new Date(s) : null);

  const scheduleErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const points: Array<{ key: keyof typeof formState; value: string; label: string } | null> = [
      formState.kickoffMeeting ? { key: "kickoffMeeting" as any, value: formState.kickoffMeeting, label: "Kickoff Meeting" } : null,
      formState.fieldworkStart ? { key: "fieldworkStart" as any, value: formState.fieldworkStart, label: "Fieldwork Start" } : null,
      formState.evidenceDue ? { key: "evidenceDue" as any, value: formState.evidenceDue, label: "Evidence Due" } : null,
      formState.capaDue ? { key: "capaDue" as any, value: formState.capaDue, label: "CAPA Due" } : null,
      formState.draftReportDue ? { key: "draftReportDue" as any, value: formState.draftReportDue, label: "Draft Report Due" } : null,
    ].filter(Boolean) as any[];

    const periodFromDate = toDate(formState.periodFrom);
    const periodToDate = toDate(formState.periodTo);

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
          if (!errs[k]) {
            errs[k] = "Dates must be unique (no duplicates).";
          }
        });
      }
    });

    for (let i = 1; i < points.length; i++) {
      const prev = toDate(points[i - 1]!.value);
      const curr = toDate(points[i]!.value);
      if (prev && curr && curr.getTime() <= prev.getTime()) {
        const k = points[i]!.key as string;
        errs[k] = `${points[i]!.label} must be after ${points[i - 1]!.label}.`;
      }
    }

    const scheduleValidation = validateScheduleMilestones(
      formState.fieldworkStart,
      formState.evidenceDue,
      formState.capaDue,
      formState.draftReportDue
    );
    
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
      formState.title.trim() !== "" &&
      formState.auditType.trim() !== "" &&
      formState.goal.trim() !== "" &&
      formState.periodFrom !== "" &&
      formState.periodTo !== ""
    );
    
    if (!basicFieldsValid) return false;
    
    const fromDate = new Date(formState.periodFrom);
    const toDate = new Date(formState.periodTo);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return false;
    }
    
    if (fromDate.getTime() > toDate.getTime()) {
      return false;
    }
    
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    const MIN_PERIOD_DAYS = 16;
    
    return daysDiff >= MIN_PERIOD_DAYS;
  }, [formState.title, formState.auditType, formState.goal, formState.periodFrom, formState.periodTo]);

  const validateStep2 = useMemo(() => {
    if (formState.level === "department") {
      return formState.selectedDeptIds.length > 0 && formState.selectedCriteriaIds.length > 0;
    }
    return formState.selectedCriteriaIds.length > 0;
  }, [formState.level, formState.selectedDeptIds, formState.selectedCriteriaIds]);

  const validateStep3 = useMemo(() => {
    return Array.isArray(formState.selectedTemplateIds) && formState.selectedTemplateIds.length > 0;
  }, [formState.selectedTemplateIds]);

  const validateStep4 = useMemo(() => {
    // Lead Auditor = current user (auto-set), only need at least 1 other auditor
    // Filter out lead auditor from selectedAuditorIds count
    const otherAuditors = formState.selectedAuditorIds.filter(
      (id) => String(id) !== String(formState.selectedLeadId || '')
    );
    return formState.selectedLeadId !== "" && otherAuditors.length >= 1;
  }, [formState.selectedLeadId, formState.selectedAuditorIds]);

  const validateStep5 = useMemo(() => {
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

  // Validation function for plan period
  const validatePlanPeriod = (from: string, to: string, showToast: boolean = false): boolean => {
    if (!from || !to) {
      if (showToast) toast.warning("Please select both start and end dates.");
      return false;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      if (showToast) toast.warning("Invalid date format.");
      return false;
    }
    if (fromDate.getTime() > toDate.getTime()) {
      if (showToast) toast.warning("Invalid period: Start date must be earlier than or equal to the end date.");
      return false;
    }
    
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
    setIsSubmittingPlan(true);
    
    try {
      // Client-side validation
      if (!formState.title.trim()) {
        toast.warning("Please enter a title for the plan.");
        formState.setCurrentStep(1);
        setIsSubmittingPlan(false);
        return;
      }
      if (!formState.periodFrom || !formState.periodTo) {
        toast.warning("Please select the start and end dates.");
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
        toast.warning("Please select at least one Checklist Template (Step 3).");
        formState.setCurrentStep(3);
        setIsSubmittingPlan(false);
        return;
      }
      if (formState.level === "department") {
        if (formState.selectedDeptIds.length === 0) {
          toast.warning("Please select at least one department for the Department scope (Step 2).");
          formState.setCurrentStep(2);
          setIsSubmittingPlan(false);
          return;
        }
        const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? "")));
        if (ownersForDepts.length === 0) {
          if (!window.confirm("⚠️ The selected departments do not have an Auditee Owner yet.\n\nDo you want to continue creating the audit plan?")) {
            formState.setCurrentStep(4);
            setIsSubmittingPlan(false);
            return;
          }
        }
      }

      // Schedule constraints: unique dates and strictly increasing order
      const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
      if (scheduleErrorMessages.length > 0) {
        toast.error("Invalid schedule:\n\n" + scheduleErrorMessages.join("\n"));
        formState.setCurrentStep(5);
        setIsSubmittingPlan(false);
        return;
      }

      const primaryTemplateId = formState.selectedTemplateIds[0];

      const basicPayload: any = {
        title: formState.title || "Untitled Plan",
        type: formState.auditType || "Internal",
        scope: formState.level === "academy" ? "Academy" : "Department",
        templateId: primaryTemplateId || undefined,
        startDate: formState.periodFrom ? new Date(formState.periodFrom).toISOString() : undefined,
        endDate: formState.periodTo ? new Date(formState.periodTo).toISOString() : undefined,
        status: "Draft",
        isPublished: false,
        objective: formState.goal || "",
      };

      let auditId: string;

      if (formState.isEditMode && !formState.editingAuditId) {
        console.error("WARNING: isEditMode is true but editingAuditId is empty!");
        toast.error("Cannot update: Missing audit ID. Please try editing again.");
        setIsSubmittingPlan(false);
        return;
      }

      if (formState.isEditMode && formState.editingAuditId) {
        auditId = formState.editingAuditId;
        const completeUpdatePayload = basicPayload;
        try {
          await completeUpdateAuditPlan(auditId, completeUpdatePayload);
        } catch (apiError) {
          console.error("Complete-update API failed:", apiError);
          throw apiError;
        }
      } else {
        // Create new audit - Business Rule Validation
        const startDate = formState.periodFrom;
        const endDate = formState.periodTo;
        
        if (startDate && endDate) {
          let deptIdsToValidate: number[] = [];
          if (formState.level === "academy") {
            deptIdsToValidate = departments.map((d) => Number(d.deptId));
          } else if (formState.level === "department" && formState.selectedDeptIds.length > 0) {
            deptIdsToValidate = formState.selectedDeptIds.map((id) => Number(id));
          }
          
          const validation = await validateBeforeCreateAudit(
            startDate,
            endDate,
            deptIdsToValidate,
            formState.selectedCriteriaIds
          );

          if (validation.warnings.length > 0) {
            const deptValidation = await validateDepartmentWithConditions(
              null,
              deptIdsToValidate,
              startDate,
              endDate,
              formState.selectedCriteriaIds
            );

            if (deptValidation.conflicts && deptValidation.conflicts.audits.length > 0) {
              const conflictingAuditsWithSameTemplates: any[] = [];
              
              for (const audit of deptValidation.conflicts.audits) {
                try {
                  const auditId = String(audit.auditId);
                  const templateMaps = await getAuditChecklistTemplateMapsByAudit(auditId);
                  const mapsArray = unwrap(templateMaps);
                  
                  const auditTemplateIds = new Set(
                    mapsArray.map((m: any) => String(m.templateId || m.id || ""))
                  );
                  
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
              
              if (conflictingAuditsWithSameTemplates.length > 0) {
                setConflictData({
                  conflicts: {
                    departmentIds: deptValidation.conflicts.departmentIds,
                    audits: conflictingAuditsWithSameTemplates,
                  },
                  usedCriteriaIds: [],
                  severity: "critical",
                  hasScopeOverlap: true,
                });
                setShowConflictModal(true);
                setIsSubmittingPlan(false);
                return;
              }
              
              const usedCriteriaIds = new Set<string>();
              deptValidation.conflicts.audits.forEach((audit) => {
                if (audit.scope && Array.isArray(audit.scope)) {
                  audit.scope.forEach((criteriaId) => {
                    usedCriteriaIds.add(String(criteriaId));
                  });
                }
              });

              const filtered = criteria.filter((c: any) => {
                const id = String(c.criteriaId || c.id || c.$id);
                return !usedCriteriaIds.has(id);
              });

              setFilteredCriteria(filtered);
              setConflictData({
                conflicts: deptValidation.conflicts,
                usedCriteriaIds: Array.from(usedCriteriaIds),
                severity: "medium",
                hasScopeOverlap: false,
              });
              setShowConflictModal(true);
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

          if (validation.errors.length > 0) {
            validation.errors.forEach((error) => {
              toast.error(error);
            });
            setIsSubmittingPlan(false);
            throw new Error("Validation failed. Please check the errors above.");
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
          toast.error("Failed to save checklist template mappings. Please retry from Step 3.");
        }

        // Attach departments with validation
        try {
          let deptIdsToAttach: string[] = [];
          
          if (formState.level === "academy") {
            deptIdsToAttach = departments.map((d) => String(d.deptId));
          } else if (formState.level === "department" && formState.selectedDeptIds.length > 0) {
            deptIdsToAttach = formState.selectedDeptIds;
          }
          
          if (deptIdsToAttach.length > 0) {
            const startDate = formState.periodFrom;
            const endDate = formState.periodTo;
            
            const deptResults = await Promise.allSettled(
              deptIdsToAttach.map(async (deptId) => {
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
            
            const failedDepts = deptResults.filter((r) => r.status === "rejected");
            if (failedDepts.length > 0) {
              console.error("Some departments failed to attach:", failedDepts);
              toast.warning(`${failedDepts.length} department(s) failed to attach. Please check the errors above.`);
            }
            
            const successfulDepts = deptResults
              .filter((r) => r.status === "fulfilled")
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
                
                await Promise.allSettled(checklistPromises);
              } catch (checklistErr: any) {
                console.error("Failed to create checklist items from template:", checklistErr);
              }
            }
            
            // Set sensitive flags for departments if enabled
            if (formState.sensitiveFlag && formState.sensitiveAreas.length > 0) {
              try {
                const { setSensitiveFlag: setSensitiveFlagAPI } = await import("../../../api/audits");
                const successfulDepts = deptResults
                  .filter((r) => r.status === "fulfilled")
                  .map((r) => (r as PromiseFulfilledResult<any>).value)
                  .filter(Boolean);
                
                const deptNamesWithAreas = new Set<string>();
                const areasByDeptName = new Map<string, string[]>();

                formState.sensitiveAreas.forEach((formattedArea: string) => {
                  const parts = formattedArea.split(" - ");
                  if (parts.length >= 2) {
                    const deptName = parts.slice(1).join(" - ");
                    deptNamesWithAreas.add(deptName);

                    if (!areasByDeptName.has(deptName)) {
                      areasByDeptName.set(deptName, []);
                    }
                    areasByDeptName.get(deptName)!.push(formattedArea);
                  }
                });

                const deptIdsWithAreas = new Set<number>();
                const allDepts = formState.level === "academy"
                  ? departments
                  : departments.filter((d) => formState.selectedDeptIds.includes(String(d.deptId)));

                allDepts.forEach((dept) => {
                  const deptName = dept.name || "";
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
                    const deptName = dept?.name || "";
                    const deptAreas = areasByDeptName.get(deptName) || [];
                    
                    return setSensitiveFlagAPI(String(scopeDeptId), {
                      sensitiveFlag: true,
                      areas: deptAreas,
                      notes: formState.sensitiveNotes || "",
                    });
                  })
                  .filter(Boolean);
                
                if (sensitivePromises.length > 0) {
                  await Promise.allSettled(sensitivePromises);
                }
              } catch (sensitiveErr: any) {
                console.error("Failed to set sensitive flags:", sensitiveErr);
                toast.warning("Plan created but sensitive flags could not be saved. Please update manually.");
              }
            }
          }
        } catch (scopeErr) {
          console.error("Attach departments to audit failed", scopeErr);
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
            toast.warning("No criteria selected to attach to audit.");
          }
        } catch (critErr: any) {
          console.error("Attach criteria to audit failed", critErr);
          toast.error("Failed to attach criteria to audit. Please try again.");
        }

        // Add team members
        try {
          const calls: Promise<any>[] = [];
          const auditorSet = new Set<string>(formState.selectedAuditorIds);
          
          // Add Lead Auditor
          const leadAuditorId = formState.selectedLeadId || "";
          if (leadAuditorId) auditorSet.add(leadAuditorId);

          auditorSet.forEach((uid) => {
            const isLead = uid === leadAuditorId;
            calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: "Auditor", isLead }));
          });

          if (formState.level === "academy") {
            const uniqueOwnerIds = Array.from(new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)));
            uniqueOwnerIds.forEach((uid) => {
              calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: "AuditeeOwner", isLead: false }));
            });
          } else {
            const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? "")));
            ownersForDepts.forEach((owner: any) => {
              if (owner.userId) {
                calls.push(addTeamMember({ auditId: String(newAuditId), userId: String(owner.userId), roleInTeam: "AuditeeOwner", isLead: false }));
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

      // Refresh plans list
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error("Failed to refresh plans list", refreshErr);
      }

      const wasEditMode = formState.isEditMode;
      
      if (wasEditMode && showDetailsModal && selectedPlanDetails) {
        const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
        if (currentAuditId) {
          try {
            await handleViewDetails(String(currentAuditId));
          } catch (refreshErr) {
            console.error("Failed to refresh plan details after update:", refreshErr);
          }
        }
      }

      formState.resetForm();
      setOriginalSelectedAuditorIds([]);

      const successMsg = wasEditMode
        ? "Audit plan updated successfully."
        : "Create Audit plan successfully.";
      toast.success(successMsg);
    } catch (err: any) {
      const serverMsg = err?.response?.data || err?.response || err?.message || err;
      console.error("Create audit failed", err, serverMsg);
      let errorMessage = "Failed to create audit plan.";
      try {
        if (typeof serverMsg === "object") {
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

  // Handler: Submit plan to Lead Auditor
  const handleSubmitToLeadAuditor = async (auditId: string) => {
    try {
      // Call API to submit plan (changes status from Draft to PendingReview)
      await submitToLeadAuditor(auditId);
      toast.success("Plan submitted to Lead Auditor successfully. Status changed to Pending Review.");
      
      // Refresh plans list to reflect status change
      const merged = await getPlansWithDepartments();
      setExistingPlans(merged);
      
      // Also refresh audit teams in case of changes
      try {
        const teams = await getAuditTeam();
        setAuditTeams(Array.isArray(teams) ? teams : []);
      } catch (teamErr) {
        console.error("Failed to refresh audit teams", teamErr);
      }
      
      // Close modal
      setShowDetailsModal(false);
    } catch (err: any) {
      console.error("Failed to submit to Lead Auditor", err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error(`Failed to submit plan: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  };

  // Handler: Edit plan (load into form)
  const handleEditPlan = async (auditId: string) => {
    try {
      // Close details modal first
      setShowDetailsModal(false);
      
      // Load plan details using service
      const detailsWithId = await loadPlanDetailsForEdit(auditId, existingPlans);
      
      // Load sensitive areas from API
      try {
        const sensitiveDepts = await getSensitiveDepartments(auditId);
        
        if (sensitiveDepts && sensitiveDepts.length > 0) {
          const sensitiveFlag = sensitiveDepts.some((sd: any) => sd.sensitiveFlag === true);
          const allAreas = new Set<string>();
          const sensitiveDeptIds: string[] = [];
          
          sensitiveDepts.forEach((sd: any) => {
            const deptId = Number(sd.deptId);
            
            if (sd.sensitiveFlag === true) {
              sensitiveDeptIds.push(String(deptId));
            }
            
            let areasArray: string[] = [];
            if (Array.isArray(sd.Areas)) {
              areasArray = sd.Areas.map((a: any) => a.sensitiveArea || String(a));
            } else if (sd.areas) {
              areasArray = Array.isArray(sd.areas) ? sd.areas : [sd.areas];
            }
            
            areasArray.forEach((area: string) => {
              const dept = departments.find((d) => Number(d.deptId) === deptId);
              const deptName = dept?.name || String(deptId);
              allAreas.add(`${area} - ${deptName}`);
            });
          });
          
          formState.setSensitiveFlag(sensitiveFlag);
          formState.setSensitiveAreas(Array.from(allAreas));
          formState.setSensitiveNotes(sensitiveDepts[0]?.notes || '');
        } else {
          formState.setSensitiveFlag(false);
          formState.setSensitiveAreas([]);
          formState.setSensitiveNotes('');
        }
      } catch (sensitiveErr) {
        console.error("Failed to load sensitive areas", sensitiveErr);
        formState.setSensitiveFlag(false);
        formState.setSensitiveAreas([]);
        formState.setSensitiveNotes('');
      }
      
      // Populate form with plan data
      formState.setTitle(detailsWithId.title || '');
      formState.setAuditType(detailsWithId.type || 'Internal');
      formState.setGoal(detailsWithId.objective || '');
      formState.setPeriodFrom(detailsWithId.startDate || '');
      formState.setPeriodTo(detailsWithId.endDate || '');
      formState.setLevel(detailsWithId.scope === 'Academy' ? 'academy' : 'department');
      
      // Load departments
      const scopeDepts = unwrap(detailsWithId.scopeDepartments);
      const deptIds = scopeDepts.map((sd: any) => String(sd.deptId || sd.id || sd));
      formState.setSelectedDeptIds(deptIds);
      
      // Load criteria
      const criteriaList = unwrap(detailsWithId.criteria);
      const criteriaIds = criteriaList.map((c: any) => String(c.criteriaId || c.id || c));
      formState.setSelectedCriteriaIds(criteriaIds);
      
      // Build selectedCriteriaByDept map
      const criteriaByDeptMap = new Map<string, Set<string>>();
      scopeDepts.forEach((sd: any) => {
        const deptId = String(sd.deptId || sd.id || sd);
        const deptCriteria = criteriaList.filter((c: any) => {
          // Match criteria to department if they have deptId or are shared
          return !c.deptId || String(c.deptId) === deptId;
        });
        const criteriaSet = new Set(deptCriteria.map((c: any) => String(c.criteriaId || c.id || c)));
        if (criteriaSet.size > 0) {
          criteriaByDeptMap.set(deptId, criteriaSet);
        }
      });
      // Also add shared criteria
      const sharedCriteria = criteriaList.filter((c: any) => !c.deptId);
      if (sharedCriteria.length > 0) {
        const sharedSet = new Set(sharedCriteria.map((c: any) => String(c.criteriaId || c.id || c)));
        criteriaByDeptMap.set('shared', sharedSet);
      }
      setSelectedCriteriaByDept(criteriaByDeptMap);
      
      // Load templates
      try {
        const maps = await getAuditChecklistTemplateMapsByAudit(auditId);
        const templateIds = (maps || [])
          .map((map: any) => map.templateId ?? map.checklistTemplateId ?? map.template?.templateId ?? map.template?.id)
          .filter((id: any) => id != null)
          .map((id: any) => String(id));
        formState.setSelectedTemplateIds(templateIds);
      } catch (templateErr) {
        console.error("Failed to load templates", templateErr);
        formState.setSelectedTemplateIds([]);
      }
      
      // Load team
      const teams = unwrap(detailsWithId.auditTeams);
      const leadAuditor = teams.find((t: any) => t.isLead === true);
      const auditors = teams.filter((t: any) => !t.isLead).map((t: any) => String(t.userId || t.id));
      
      if (leadAuditor) {
        formState.setSelectedLeadId(String(leadAuditor.userId || leadAuditor.id));
      }
      formState.setSelectedAuditorIds(auditors);
      
      // Load schedules
      const scheduleMap = detailsWithId.scheduleMap || {};
      formState.setKickoffMeeting(scheduleMap['kickoffmeeting'] || scheduleMap['kickoff meeting'] || '');
      formState.setFieldworkStart(scheduleMap['fieldworkstart'] || scheduleMap['fieldwork start'] || '');
      formState.setEvidenceDue(scheduleMap['evidencedue'] || scheduleMap['evidence due'] || '');
      formState.setCapaDue(scheduleMap['capadue'] || scheduleMap['capa due'] || '');
      formState.setDraftReportDue(scheduleMap['draftreportdue'] || scheduleMap['draft report due'] || '');
      
      // Set edit mode
      formState.setIsEditMode(true);
      formState.setEditingAuditId(auditId);
      formState.setCurrentStep(1);
      formState.setShowForm(true);
      
      toast.success("Plan loaded for editing.");
    } catch (err: any) {
      console.error("Failed to load plan for editing", err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error(`Failed to load plan: ${errorMessage}`);
    }
  };

  // Handler: Delete plan (show confirmation modal)
  const handleDeletePlan = (auditId: string) => {
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
      toast.success("Plan deleted successfully.");
      
      // Refresh plans list
      const merged = await getPlansWithDepartments();
      setExistingPlans(merged);
      
      // Close modals
      closeDeleteModal();
      setShowDetailsModal(false);
    } catch (err: any) {
      console.error("Failed to delete plan", err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error(`Failed to delete plan: ${errorMessage}`);
    }
  };

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
    try {
      // Load departments if not already loaded
      let deptList = departments;
      if (deptList.length === 0) {
        try {
          const res: any = await getDepartments();
          deptList = (res || []).map((d: any) => ({
            deptId: d.deptId ?? d.$id ?? d.id,
            name: d.name || d.code || "—",
          }));
          setDepartments(deptList);
        } catch (err) {
          console.error("Failed to load departments", err);
        }
      }

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

        // Fallback: if still no sensitive areas and scopeDepartments contain departmentSensitiveAreaIds,
        // map those GUIDs to names using DepartmentSensitiveArea master
        if (
          sensitiveAreas.length === 0 &&
          Object.keys(sensitiveAreasByDept).length === 0 &&
          detailsWithSchedules?.scopeDepartments?.values?.length > 0
        ) {
          try {
            const masterAreas = await getDepartmentSensitiveAreas();
            const masterById = new Map<string, { deptId: number; deptName?: string; sensitiveArea?: string }>();
            masterAreas.forEach((m) => {
              const key = m.id ? String(m.id) : "";
              if (key) {
                masterById.set(key, {
                  deptId: Number(m.deptId),
                  deptName: m.deptName || m.departmentName,
                  sensitiveArea: m.sensitiveArea,
                });
              }
            });

            const mergedSensitiveAreas = new Set<string>();
            const mergedSensitiveAreasByDept: Record<number, string[]> = {};

            detailsWithSchedules.scopeDepartments.values.forEach((sd: any) => {
              const deptId = Number(sd.deptId);
              if (!deptId || !Array.isArray(sd.departmentSensitiveAreaIds)) return;

              sd.departmentSensitiveAreaIds.forEach((areaId: any) => {
                const key = areaId != null ? String(areaId) : "";
                const found = key ? masterById.get(key) : undefined;
                if (found?.sensitiveArea) {
                  const name = found.sensitiveArea;
                  if (!mergedSensitiveAreasByDept[deptId]) {
                    mergedSensitiveAreasByDept[deptId] = [];
                  }
                  mergedSensitiveAreasByDept[deptId].push(name);
                  mergedSensitiveAreas.add(name);
                }
              });
            });

            if (Object.keys(mergedSensitiveAreasByDept).length > 0) {
              sensitiveFlag = true;
              sensitiveAreas = Array.from(mergedSensitiveAreas);
              sensitiveAreasByDept = mergedSensitiveAreasByDept;
            }
          } catch (fallbackErr) {
            console.error("Fallback load sensitive areas by departmentSensitiveAreaIds failed:", fallbackErr);
          }
        }

        // Load criteria if needed
        let criteriaList: any[] = [];
        try {
          const { getAuditCriteria } = await import("../../../api/auditCriteria");
          criteriaList = await getAuditCriteria();
          if (!Array.isArray(criteriaList)) {
            criteriaList = [];
          }
        } catch (err) {
          console.error("Failed to load criteria", err);
        }

        const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
          departments: deptList,
          criteriaList: criteriaList,
          users: [],
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
        
        // Load templates for the plan
        try {
          const maps = await getAuditChecklistTemplateMapsByAudit(auditId);
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
          setTemplatesForSelectedPlan(normalizedRecords);
        } catch (err) {
          console.error("Failed to load templates for plan", err);
          setTemplatesForSelectedPlan([]);
        }
        
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
        
        // Load templates for the plan
        try {
          const maps = await getAuditChecklistTemplateMapsByAudit(auditId);
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
          setTemplatesForSelectedPlan(normalizedRecords);
        } catch (err) {
          console.error("Failed to load templates for plan", err);
          setTemplatesForSelectedPlan([]);
        }
        
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

  // Get current user's userId for PlanDetailsModal
  const currentUserIdForModal = useMemo(() => {
    if (!user) return null;
    const fallbackId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.$id ?? null;
      return fallbackId ? String(fallbackId).trim() : null;
  }, [user]);

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

  return (
    <MainLayout user={layoutUser}>
      <PageHeader
        title="Audit Planning"
        subtitle="Create and manage audit plans"
        rightContent={
          <button
            onClick={() => {
              if (isSubmittingPlan) {
                toast.info("Submitting plan...");
                return;
              }

              if (formState.showForm && formState.isEditMode) {
                formState.resetFormForCreate();
                setOriginalSelectedAuditorIds([]);
              } else if (!formState.showForm) {
                formState.resetFormForCreate();
                setOriginalSelectedAuditorIds([]);
                formState.setShowForm(true);
              } else {
                formState.setShowForm(false);
              }
            }}
            disabled={isSubmittingPlan}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-md ${
              isSubmittingPlan
                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                : "bg-gradient-to-r from-primary-600 to-primary-700 hover:shadow-lg text-white"
            }`}
          >
            {isSubmittingPlan ? "Creating..." : "+ Create New Plan"}
          </button>
        }
      />

      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="p-6">
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
              filteredPlans={filterState.filteredPlans}
              existingPlans={visiblePlans}
              loadingPlans={loadingPlans}
              onViewDetails={handleViewDetails}
              onEditPlan={handleEditPlan}
              onDeletePlan={handleDeletePlan}
              getStatusColor={getStatusColor}
              getBadgeVariant={getBadgeVariant}
              startIndex={0}
              currentUserId={currentUserIdForModal}
              currentUserEmail={user?.email || null}
            />
          </div>
        </div>
      </div>

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
                      {/* Show validation error for period if exists */}
                      {formState.periodFrom && formState.periodTo && !validateStep1 && (
                        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ Validation Error
                          </p>
                          {(() => {
                            const fromDate = new Date(formState.periodFrom);
                            const toDate = new Date(formState.periodTo);
                            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                              return (
                                <p className="text-sm text-red-700 mt-1">
                                  Invalid date format. Please check your dates.
                                </p>
                              );
                            }
                            if (fromDate.getTime() > toDate.getTime()) {
                              return (
                                <p className="text-sm text-red-700 mt-1">
                                  Start date must be earlier than or equal to end date.
                                </p>
                              );
                            }
                            const MS_PER_DAY = 24 * 60 * 60 * 1000;
                            const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
                            const MIN_PERIOD_DAYS = 16;
                            if (daysDiff < MIN_PERIOD_DAYS) {
                              return (
                                <p className="text-sm text-red-700 mt-1">
                                  Audit period must be at least {MIN_PERIOD_DAYS} days. Current period is {daysDiff} day(s). Please extend the end date.
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
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
                        onSelectedCriteriaByDeptChange={(map) => {
                          setSelectedCriteriaByDept(map);
                          // Update selectedCriteriaIds from the Map
                          const union = new Set<string>();
                          map.forEach((set) => set.forEach((id) => union.add(String(id))));
                          formState.setSelectedCriteriaIds(Array.from(union));
                        }}
                        selectedCriteriaByDeptMap={selectedCriteriaByDept}
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
                      {/* Show validation error for Step 2 if exists
                      {!validateStep2 && (
                        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ Validation Error
                          </p>
                          {formState.level === "department" ? (
                            <p className="text-sm text-red-700 mt-1">
                              {formState.selectedDeptIds.length === 0 && "Please select at least one department. "}
                              {formState.selectedCriteriaIds.length === 0 && "Please select at least one standard/criteria."}
                            </p>
                          ) : (
                            <p className="text-sm text-red-700 mt-1">
                              Please select at least one standard/criteria.
                            </p>
                          )}
                        </div>
                      )} */}
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
                    <div className="space-y-4">
                      <Step4Team
                        level={formState.level}
                        selectedDeptIds={formState.selectedDeptIds}
                        selectedAuditorIds={formState.selectedAuditorIds}
                        selectedLeadId={formState.selectedLeadId}
                        auditorOptions={auditorOptions}
                        ownerOptions={ownerOptions}
                        departments={departments}
                        onAuditorsChange={formState.setSelectedAuditorIds}
                        onLeadChange={undefined} // Disable Lead Auditor selection - auto-set to current user
                        periodFrom={formState.periodFrom}
                        periodTo={formState.periodTo}
                        editingAuditId={formState.editingAuditId}
                        isAuditorRole={true} // Flag to indicate this is Auditor role (not Lead Auditor)
                        currentUserId={currentUserId} // Pass current user ID to filter out from auditors list
                      />
                      {/* Show validation error for Step 4 if exists
                      {!validateStep4 && (
                        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ Validation Error
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            Please select at least 1 auditor (excluding the Lead Auditor).
                          </p>
                        </div>
                      )} */}
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

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (formState.currentStep > 1) {
                        formState.setCurrentStep(formState.currentStep - 1);
                      }
                    }}
                    disabled={formState.currentStep === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      formState.currentStep === 1
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-3">
                    {formState.currentStep < 5 ? (
                      <button
                        onClick={() => {
                          if (canContinue) {
                            formState.setCurrentStep(formState.currentStep + 1);
                          }
                        }}
                        disabled={!canContinue}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          canContinue
                            ? "bg-primary-600 text-white hover:bg-primary-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitPlan}
                        disabled={!canContinue || isSubmittingPlan}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          canContinue && !isSubmittingPlan
                            ? "bg-primary-600 text-white hover:bg-primary-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {isSubmittingPlan ? "Submitting..." : formState.isEditMode ? "Update Plan" : "Create Plan"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Conflict Warning Modal */}
        {showConflictModal && conflictData &&
          createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictData(null);
                  setFilteredCriteria([]);
                }}
              />
              
              <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-600 to-red-700">
                  <h3 className="text-xl font-bold text-white">
                    ⚠️ Conflict Warning
                  </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {conflictData.severity === 'critical' ? (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                      <p className="text-sm font-medium text-red-800">
                        ❌ Critical Conflict: Cannot create audit plan with overlapping time, department, and checklist template.
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
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Conflicting audit plans:
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
                                Period:{" "}
                                {new Date(audit.startDate).toLocaleDateString()}{" "}
                                - {new Date(audit.endDate).toLocaleDateString()}
                              </p>
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Criteria already used in conflicting audits (hidden from selection):
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
                        setShowConflictModal(false);
                        setConflictData(null);
                        setFilteredCriteria([]);
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

        {/* Plan Details Modal */}
        {showDetailsModal && selectedPlanDetails && (
          <PlanDetailsModal
            showModal={showDetailsModal}
            selectedPlanDetails={selectedPlanDetails}
            templatesForPlan={templatesForSelectedPlan}
            onClose={() => setShowDetailsModal(false)}
            onSubmitToLead={handleSubmitToLeadAuditor}
            currentUserId={currentUserIdForModal}
            auditTeamsForPlan={auditTeams.filter((m: any) => {
              const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
              if (!currentAuditId) return false;
                const teamAuditId = String(m?.auditId || "").trim();
                return (
                teamAuditId === String(currentAuditId).trim() ||
                teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
                );
            })}
            getCriterionName={(id: string) => getCriterionName(id, [])}
            getDepartmentName={(id: string | number) =>
              getDepartmentName(id, departments)
            }
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            getTemplateName={(tid) => {
              if (!tid) return 'Unknown Template';
              // Find template in checklistTemplates array
              const template = checklistTemplates.find(
                (t: any) => 
                  String(t.templateId || t.id || t.$id || '') === String(tid)
              );
              // Return title, name, or fallback to ID
              return template?.title || template?.name || `Template ${String(tid)}`;
            }}
            getTemplateInfo={(tid) => {
              if (!tid) return null;
              // Find template in checklistTemplates array
              const template = checklistTemplates.find(
                (t: any) => 
                  String(t.templateId || t.id || t.$id || '') === String(tid)
              );
              if (!template) return null;
              return {
                name: template.title || template.name || `Template ${String(tid)}`,
                version: template.version,
                description: template.description,
              };
            }}
          />
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
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
