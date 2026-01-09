import { toast } from "react-toastify";
import { createAudit, completeUpdateAuditPlan, setSensitiveFlag } from "../api/audits";
// import { createAuditChecklistItemsFromTemplate } from "../api/checklists";
import { addCriterionToAudit } from "../api/auditCriteriaMap";
import { addTeamMember } from "../api/auditTeam";
import { addAuditSchedule } from "../api/auditSchedule";
import { syncAuditChecklistTemplateMaps } from "../api/auditChecklistTemplateMaps";
import { MILESTONE_NAMES, SCHEDULE_STATUS } from "../constants/audit";
import {
  validateBeforeCreateAudit,
  validateBeforeAddDepartment,
  validateDepartmentWithConditions,
} from "../helpers/businessRulesValidation";
import { unwrap } from "../utils/normalize";
import { getAuditChecklistTemplateMapsByAudit } from "../api/auditChecklistTemplateMaps";

interface FormState {
  title: string;
  periodFrom: string | null;
  periodTo: string | null;
  auditType: string;
  level: string;
  goal: string;
  selectedTemplateIds: string[];
  selectedDeptIds: string[];
  selectedCriteriaIds: string[];
  selectedAuditorIds: string[];
  selectedLeadId: string;
  sensitiveFlag: boolean;
  sensitiveAreas: string[];
  sensitiveNotes: string;
  kickoffMeeting: string | null;
  fieldworkStart: string | null;
  evidenceDue: string | null;
  capaDue: string | null;
  draftReportDue: string | null;
  isEditMode: boolean;
  editingAuditId: string | null;
  setCurrentStep: (step: number) => void;
  resetForm: () => void;
}

interface SubmissionContext {
  formState: FormState;
  departments: Array<{ deptId: number | string; name: string }>;
  ownerOptions: any[];
  criteria: any[];
  selectedCriteriaByDept: Map<string, Set<string>>;
  scheduleErrors: Record<string, string>;
  validatePlanPeriod: (from: string, to: string, showToast?: boolean) => boolean;
  setConflictData: (data: any) => void;
  setShowConflictModal: (show: boolean) => void;
  setFilteredCriteria: (criteria: any[]) => void;
  checklistTemplates?: any[];
}

interface SubmissionResult {
  success: boolean;
  auditId?: string;
  error?: string;
  conflictData?: any;
  shouldShowConflictModal?: boolean;
}

/**
 * Validates the plan form before submission
 */
export const validatePlanSubmission = (
  formState: FormState,
  scheduleErrors: Record<string, string>,
  validatePlanPeriod: (from: string, to: string, showToast?: boolean) => boolean,
  ownerOptions: any[],
  checklistTemplates: any[] = []
): { isValid: boolean; step?: number } => {
  // Title validation
  if (!formState.title.trim()) {
    toast.warning("Please enter a title for the plan.");
    return { isValid: false, step: 1 };
  }

  // Date validation
  if (!formState.periodFrom || !formState.periodTo) {
    toast.warning("Please select the start and end dates.");
    return { isValid: false, step: 1 };
  }

  if (!validatePlanPeriod(formState.periodFrom, formState.periodTo, true)) {
    return { isValid: false, step: 1 };
  }

  // Template validation
  if (!formState.selectedTemplateIds.length) {
    toast.warning("Please select at least one Checklist Template (Step 3).");
    return { isValid: false, step: 3 };
  }

  // Department-level template validation: each department must have at least one template
  if (formState.level === "department" && formState.selectedDeptIds.length > 0) {
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

    // Check if all selected departments have at least one template
    const missingDepts = Array.from(selectedDeptIdsSet).filter(deptId => !deptIdsWithTemplates.has(deptId));
    
    if (missingDepts.length > 0) {
      toast.warning(`Please select at least one Checklist Template for each selected department (Step 3).`);
      return { isValid: false, step: 3 };
    }
  }

  // Department validation
  if (formState.level === "department") {
    if (formState.selectedDeptIds.length === 0) {
      toast.warning("Please select at least one department for the Department scope (Step 2).");
      return { isValid: false, step: 2 };
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
        return { isValid: false, step: 4 };
      }
    }
  }

  // Schedule validation
  const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
  if (scheduleErrorMessages.length > 0) {
    toast.error("Invalid schedule:\n\n" + scheduleErrorMessages.join("\n"));
    return { isValid: false, step: 5 };
  }

  return { isValid: true };
};

/**
 * Checks for conflicts with existing audits
 */
export const checkAuditConflicts = async (
  formState: FormState,
  departments: Array<{ deptId: number | string; name: string }>,
  criteria: any[],
  setConflictData: (data: any) => void,
  setFilteredCriteria: (criteria: any[]) => void
): Promise<{ hasConflict: boolean; conflictData?: any }> => {
  const startDate = formState.periodFrom;
  const endDate = formState.periodTo;

  if (!startDate || !endDate) {
    return { hasConflict: false };
  }

  let deptIdsToValidate: number[] = [];
  if (formState.level === "academy" || formState.level.toLowerCase() === "academy") {
    deptIdsToValidate = departments.map((d) => Number(d.deptId));
  } else if ((formState.level === "department" || formState.level.toLowerCase() === "department") && formState.selectedDeptIds.length > 0) {
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
      // Check for template conflicts
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
        const conflictData = {
          conflicts: {
            departmentIds: deptValidation.conflicts.departmentIds,
            audits: conflictingAuditsWithSameTemplates,
          },
          usedCriteriaIds: [],
          severity: "critical",
          hasScopeOverlap: true,
        };
        setConflictData(conflictData);
        return { hasConflict: true, conflictData };
      }

      // Filter criteria
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
      const conflictData = {
        conflicts: deptValidation.conflicts,
        usedCriteriaIds: Array.from(usedCriteriaIds),
        severity: "medium",
        hasScopeOverlap: false,
      };
      setConflictData(conflictData);
      return { hasConflict: true, conflictData };
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
    throw new Error("Validation failed. Please check the errors above.");
  }

  return { hasConflict: false };
};

/**
 * Creates or updates the audit plan
 */
export const createOrUpdateAuditPlan = async (
  formState: FormState
): Promise<string> => {
  const basicPayload: any = {
    title: formState.title || "Untitled Plan",
    type: formState.auditType || "Internal",
    scope: formState.level === "academy" ? "Academy" : "Department",
    templateId: formState.selectedTemplateIds[0] || undefined,
    startDate: formState.periodFrom ? new Date(formState.periodFrom).toISOString() : undefined,
    endDate: formState.periodTo ? new Date(formState.periodTo).toISOString() : undefined,
    status: "Draft",
    isPublished: false,
    objective: formState.goal || "",
  };

  if (formState.isEditMode && !formState.editingAuditId) {
    console.error("WARNING: isEditMode is true but editingAuditId is empty!");
    toast.error("Cannot update: Missing audit ID. Please try editing again.");
    throw new Error("Missing audit ID for edit mode");
  }

  if (formState.isEditMode && formState.editingAuditId) {
    await completeUpdateAuditPlan(formState.editingAuditId, basicPayload);
    return formState.editingAuditId;
  } else {
    const resp = await createAudit(basicPayload);
    const auditId = resp?.auditId || resp?.id || resp;

    if (!auditId) {
      throw new Error("No auditId returned from createAudit API");
    }

    return String(auditId);
  }
};

/**
 * Attaches departments to audit with validation
 */
export const attachDepartmentsToAudit = async (
  auditId: string,
  formState: FormState,
  departments: Array<{ deptId: number | string; name: string }>
): Promise<any[]> => {
  let deptIdsToAttach: string[] = [];

  if (formState.level === "academy" || formState.level.toLowerCase() === "academy") {
    deptIdsToAttach = departments.map((d) => String(d.deptId));
  } else if ((formState.level === "department" || formState.level.toLowerCase() === "department") && formState.selectedDeptIds.length > 0) {
    deptIdsToAttach = formState.selectedDeptIds;
  }

  if (deptIdsToAttach.length === 0) {
    return [];
  }

  const startDate = formState.periodFrom;
  const endDate = formState.periodTo;

  const { addAuditScopeDepartment } = await import("../api/audits");

  const deptResults = await Promise.allSettled(
    deptIdsToAttach.map(async (deptId) => {
      if (startDate && endDate) {
        const deptValidation = await validateBeforeAddDepartment(
          auditId,
          Number(deptId),
          startDate,
          endDate
        );

        if (!deptValidation.isValid) {
          toast.error(`Department validation failed: ${deptValidation.message}`);
          throw new Error(deptValidation.message);
        }
      }

      return await addAuditScopeDepartment(auditId, Number(deptId));
    })
  );

  const failedDepts = deptResults.filter((r) => r.status === "rejected");
  if (failedDepts.length > 0) {
    console.error("Some departments failed to attach:", failedDepts);
    toast.warning(
      `${failedDepts.length} department(s) failed to attach. Please check the errors above.`
    );
  }

  const successfulDepts = deptResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter(Boolean);

  return successfulDepts;
};

/**
 * Creates checklist items from templates for departments
 */
// export const createChecklistItemsForDepartments = async (
//   auditId: string,
//   successfulDepts: any[]
// ): Promise<void> => {
//   if (successfulDepts.length === 0) {
//     return;
//   }

//   try {
//     const checklistPromises = successfulDepts.map(async (sd: any) => {
//       const sdDeptId = Number(sd.deptId || sd.$deptId);
//       if (!sdDeptId || isNaN(sdDeptId)) return null;

//       try {
//         // await createAuditChecklistItemsFromTemplate(auditId, sdDeptId);
//         return { deptId: sdDeptId, success: true };
//       } catch (err) {
//         console.error(`Failed to create checklist items for department ${sdDeptId}:`, err);
//         return { deptId: sdDeptId, success: false };
//       }
//     });

//     await Promise.allSettled(checklistPromises);
//   } catch (checklistErr: any) {
//     console.error("Failed to create checklist items from template:", checklistErr);
//   }
// };

/**
 * Sets sensitive flags for departments
 */
export const setSensitiveFlagsForDepartments = async (
  _auditId: string,
  formState: FormState,
  successfulDepts: any[],
  departments: Array<{ deptId: number | string; name: string }>
): Promise<void> => {
  if (!formState.sensitiveFlag || formState.sensitiveAreas.length === 0) {
    return;
  }

  try {
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
    const allDepts =
      formState.level === "academy"
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
        const scopeDeptId =
          sd.auditScopeId ||
          sd.AuditScopeId ||
          sd.scopeDeptId ||
          sd.$scopeDeptId ||
          sd.id ||
          sd.auditScopeDepartmentId;
        if (!scopeDeptId) return null;

        const sdDeptId = Number(sd.deptId || sd.$deptId);
        const dept = allDepts.find((d) => Number(d.deptId) === sdDeptId);
        const deptName = dept?.name || "";
        const deptAreas = areasByDeptName.get(deptName) || [];

        return setSensitiveFlag(String(scopeDeptId), {
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
};

/**
 * Attaches criteria to audit
 */
export const attachCriteriaToAudit = async (
  auditId: string,
  formState: FormState,
  selectedCriteriaByDept: Map<string, Set<string>>
): Promise<void> => {
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
        addCriterionToAudit(auditId, String(criteriaId))
      )
    );
  } else {
    toast.warning("No criteria selected to attach to audit.");
  }
};

/**
 * Adds team members to audit
 */
export const addTeamMembersToAudit = async (
  auditId: string,
  formState: FormState,
  ownerOptions: any[]
): Promise<void> => {
  const calls: Promise<any>[] = [];
  const auditorSet = new Set<string>(formState.selectedAuditorIds);

  // Add Lead Auditor
  const leadAuditorId = formState.selectedLeadId || "";
  if (leadAuditorId) auditorSet.add(leadAuditorId);

  auditorSet.forEach((uid) => {
    const isLead = uid === leadAuditorId;
    calls.push(
      addTeamMember({ auditId, userId: uid, roleInTeam: "Auditor", isLead })
    );
  });

  if (formState.level === "academy" || formState.level.toLowerCase() === "academy") {
    const uniqueOwnerIds = Array.from(
      new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean))
    );
    uniqueOwnerIds.forEach((uid) => {
      calls.push(
        addTeamMember({ auditId, userId: uid, roleInTeam: "AuditeeOwner", isLead: false })
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
            auditId,
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
};

/**
 * Posts schedules to audit
 */
export const postSchedulesToAudit = async (
  auditId: string,
  formState: FormState
): Promise<void> => {
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
        auditId,
        milestoneName: pair.name,
        dueDate: new Date(pair.date!).toISOString(),
        status: SCHEDULE_STATUS.PLANNED,
        notes: "",
      })
    );
    await Promise.allSettled(schedulePromises);
  }
};

/**
 * Main submission service - orchestrates the entire plan submission process
 */
export const submitAuditPlan = async (
  context: SubmissionContext
): Promise<SubmissionResult> => {
  const {
    formState,
    departments,
    ownerOptions,
    criteria,
    selectedCriteriaByDept,
    scheduleErrors,
    validatePlanPeriod,
    setConflictData,
    setShowConflictModal,
    setFilteredCriteria,
    checklistTemplates,
  } = context;

  // Step 1: Validate form
  const validation = validatePlanSubmission(
    formState,
    scheduleErrors,
    validatePlanPeriod,
    ownerOptions,
    checklistTemplates || []
  );

  if (!validation.isValid) {
    formState.setCurrentStep(validation.step || 1);
    return { success: false, error: "Validation failed" };
  }

  // Step 2: Check for conflicts (only for create mode)
  if (!formState.isEditMode) {
    try {
      const conflictCheck = await checkAuditConflicts(
        formState,
        departments,
        criteria,
        setConflictData,
        setFilteredCriteria
      );

      if (conflictCheck.hasConflict) {
        setShowConflictModal(true);
        return {
          success: false,
          conflictData: conflictCheck.conflictData,
          shouldShowConflictModal: true,
        };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Step 3: Create or update audit plan
  let auditId: string;
  try {
    auditId = await createOrUpdateAuditPlan(formState);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  // Step 4: Post-creation tasks (only for create mode)
  if (!formState.isEditMode) {
    try {
      // Sync templates
      await syncAuditChecklistTemplateMaps({
        auditId,
        templateIds: formState.selectedTemplateIds,
      });
    } catch (templateMapErr) {
      console.error("Failed to sync checklist templates", templateMapErr);
      toast.error("Failed to save checklist template mappings. Please retry from Step 3.");
    }

    try {
      // Attach departments
      const successfulDepts = await attachDepartmentsToAudit(auditId, formState, departments);

      // if (successfulDepts.length > 0 && formState.selectedTemplateIds.length > 0) {
      //   // Create checklist items
      //   await createChecklistItemsForDepartments(auditId, successfulDepts);
      // }

      // Set sensitive flags
      await setSensitiveFlagsForDepartments(auditId, formState, successfulDepts, departments);
    } catch (scopeErr) {
      console.error("Attach departments to audit failed", scopeErr);
    }

    try {
      // Attach criteria
      await attachCriteriaToAudit(auditId, formState, selectedCriteriaByDept);
    } catch (critErr: any) {
      console.error("Attach criteria to audit failed", critErr);
      toast.error("Failed to attach criteria to audit. Please try again.");
    }

    try {
      // Add team members
      await addTeamMembersToAudit(auditId, formState, ownerOptions);
    } catch (teamErr) {
      console.error("Attach team failed", teamErr);
    }

    try {
      // Post schedules
      await postSchedulesToAudit(auditId, formState);
    } catch (scheduleErr) {
      console.error("Failed to post schedules", scheduleErr);
    }
  }

  return { success: true, auditId };
};

