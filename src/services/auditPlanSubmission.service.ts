import { toast } from "react-toastify";
import { createAudit, updateAuditPlan, setSensitiveFlag, getAuditScopeDepartments, addAuditScopeDepartment, deleteAuditScopeDepartment } from "../api/audits";
// import { createAuditChecklistItemsFromTemplate } from "../api/checklists";
import { addCriterionToAudit, getCriteriaForAudit, removeCriterionFromAudit } from "../api/auditCriteriaMap";
import { addTeamMember, deleteTeamMember, getAuditTeam } from "../api/auditTeam";
import { addAuditSchedule, updateAuditSchedule, getAuditSchedules, deleteAuditSchedule } from "../api/auditSchedule";
import { syncAuditChecklistTemplateMaps, getAuditChecklistTemplateMapsByAudit, deleteAuditChecklistTemplateMap, addAuditChecklistTemplateMap } from "../api/auditChecklistTemplateMaps";
import { MILESTONE_NAMES, SCHEDULE_STATUS } from "../constants/audit";
import {
  validateBeforeCreateAudit,
  validateBeforeAddDepartment,
  validateDepartmentWithConditions,
} from "../helpers/businessRulesValidation";
import { unwrap } from "../utils/normalize";

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
  userIdFromToken?: string;
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
  formState: FormState,
  context?: {
    departments: Array<{ deptId: number | string; name: string }>;
    ownerOptions: any[];
    selectedCriteriaByDept: Map<string, Set<string>>;
    userIdFromToken?: string;
  }
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
    // Update basic audit info only
    await updateAuditPlan(formState.editingAuditId, basicPayload);
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

  // Step 4: Update related entities
  if (formState.isEditMode) {
    // Edit mode: Update each entity separately
    try {
      // 4.1: Update Checklist Templates - Delete all then add all
      const existingTemplates = await getAuditChecklistTemplateMapsByAudit(auditId);
      const existingTemplateIds = existingTemplates
        .map((m: any) => m.templateId || m.checklistTemplateId || m.template?.templateId || m.template?.id)
        .filter((id: any) => id != null)
        .map((id: any) => String(id).trim());

      // Delete all existing templates
      await Promise.allSettled(
        existingTemplateIds.map((templateId: string) =>
          deleteAuditChecklistTemplateMap(auditId, templateId)
        )
      );

      // Add all new templates
      const uniqueTemplateIds = Array.from(
        new Set(formState.selectedTemplateIds.map((id) => String(id).trim()).filter(Boolean))
      );
      await Promise.allSettled(
        uniqueTemplateIds.map((templateId: string) =>
          addAuditChecklistTemplateMap({
            auditId: String(auditId),
            templateId: String(templateId),
            status: 'Active',
          })
        )
      );
    } catch (templateMapErr) {
      console.error("Failed to update checklist templates", templateMapErr);
      toast.error("Failed to update checklist template mappings. Please retry from Step 3.");
    }

    try {
      // 4.2: Update Departments - Delete all then add all
      const allScopeDepts = await getAuditScopeDepartments();
      const existingScopeDepts = (Array.isArray(allScopeDepts) ? allScopeDepts : [])
        .filter((sd: any) => String(sd.auditId || sd.$auditId || sd.AuditId) === String(auditId))
        .filter((sd: any) => (sd.status || sd.Status) === "Active");

      // Delete all existing departments
      await Promise.allSettled(
        existingScopeDepts.map((scopeDept: any) => {
          const scopeId = scopeDept.auditScopeId || scopeDept.AuditScopeId || scopeDept.id || scopeDept.$id;
          if (scopeId) {
            return deleteAuditScopeDepartment(scopeId);
          }
          return Promise.resolve();
        })
      );

      // Determine target dept IDs
      let targetDeptIds: string[] = [];
      if (formState.level === "academy" || formState.level.toLowerCase() === "academy") {
        targetDeptIds = departments.map((d) => String(d.deptId));
      } else if (formState.selectedDeptIds.length > 0) {
        targetDeptIds = formState.selectedDeptIds;
      }

      // Add all new departments
      const successfulDepts = await Promise.allSettled(
        targetDeptIds.map((deptIdStr) => addAuditScopeDepartment(auditId, Number(deptIdStr)))
      ).then((results) =>
        results
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<any>).value)
          .filter(Boolean)
      );

      // Set sensitive flags for all departments
      if (successfulDepts.length > 0) {
        await setSensitiveFlagsForDepartments(auditId, formState, successfulDepts, departments);
      }
    } catch (scopeErr) {
      console.error("Update departments failed", scopeErr);
      toast.error("Failed to update departments. Please try again.");
    }

    try {
      // 4.2.1: Update Criteria - Delete all then add all
      const existingCriteria = await getCriteriaForAudit(auditId);
      const existingCriteriaIds = (Array.isArray(existingCriteria) ? existingCriteria : [])
        .map((c: any) => c.criteriaId || c.id || c)
        .filter((id: any) => id != null)
        .map((id: any) => String(id).trim());

      // Delete all existing criteria
      await Promise.allSettled(
        existingCriteriaIds.map((criteriaId: string) =>
          removeCriterionFromAudit(auditId, criteriaId)
        )
      );

      // Add all new criteria from selectedCriteriaIds
      const uniqueCriteriaIds = Array.from(
        new Set(formState.selectedCriteriaIds.map((id) => String(id).trim()).filter(Boolean))
      );
      await Promise.allSettled(
        uniqueCriteriaIds.map((criteriaId: string) =>
          addCriterionToAudit(auditId, criteriaId)
        )
      );
    } catch (criteriaErr) {
      console.error("Update criteria failed", criteriaErr);
      toast.error("Failed to update criteria. Please try again.");
    }

    try {
      // 4.3: Update Team & Responsibilities - Delete all then add all
      const allTeams = await getAuditTeam();
      const existingTeams = (Array.isArray(allTeams) ? allTeams : []).filter(
        (t: any) => String(t.auditId || t.$auditId) === String(auditId)
      );

      // Delete all existing teams
      await Promise.allSettled(
        existingTeams.map((t: any) => {
          const teamId = t.auditTeamId || t.AuditTeamId || t.id;
          return teamId ? deleteTeamMember(teamId) : Promise.resolve();
        })
      );

      // Build target team members
      const targetTeamMembers: Array<{ userId: string; roleInTeam: string; isLead: boolean }> = [];
      const auditorSet = new Set<string>(formState.selectedAuditorIds);
      const leadAuditorId = formState.selectedLeadId || "";
      if (leadAuditorId) auditorSet.add(leadAuditorId);

      auditorSet.forEach((uid) => {
        targetTeamMembers.push({
          userId: uid,
          roleInTeam: "Auditor",
          isLead: uid === leadAuditorId,
        });
      });

      // Add AuditeeOwners
      if (formState.level === "academy" || formState.level.toLowerCase() === "academy") {
        const uniqueOwnerIds = Array.from(
          new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean))
        );
        uniqueOwnerIds.forEach((uid) => {
          targetTeamMembers.push({
            userId: uid,
            roleInTeam: "AuditeeOwner",
            isLead: false,
          });
        });
      } else {
        const ownersForDepts = ownerOptions.filter((o: any) =>
          formState.selectedDeptIds.includes(String(o.deptId ?? ""))
        );
        ownersForDepts.forEach((owner: any) => {
          if (owner.userId) {
            targetTeamMembers.push({
              userId: String(owner.userId),
              roleInTeam: "AuditeeOwner",
              isLead: false,
            });
          }
        });
      }

      // Add all new team members
      await Promise.allSettled(
        targetTeamMembers.map((member) =>
          addTeamMember({
            auditId,
            userId: member.userId,
            roleInTeam: member.roleInTeam,
            isLead: member.isLead,
          })
        )
      );
    } catch (teamErr) {
      console.error("Update team failed", teamErr);
      toast.error("Failed to update team members. Please try again.");
    }

    try {
      // 4.4: Update Schedule
      const existingSchedules = await getAuditSchedules(auditId);
      const schedulePairs = [
        { name: MILESTONE_NAMES.KICKOFF, date: formState.kickoffMeeting },
        { name: MILESTONE_NAMES.FIELDWORK, date: formState.fieldworkStart },
        { name: MILESTONE_NAMES.EVIDENCE, date: formState.evidenceDue },
        { name: MILESTONE_NAMES.CAPA, date: formState.capaDue },
        { name: MILESTONE_NAMES.DRAFT, date: formState.draftReportDue },
      ].filter((pair) => pair.date);

      const existingSchedulesArray = Array.isArray(existingSchedules) ? existingSchedules : [];
      const existingSchedulesMap = new Map(
        existingSchedulesArray.map((s: any) => [
          s.milestoneName || s.MilestoneName,
          s,
        ])
      );

      // Update or add schedules
      const scheduleResults = await Promise.allSettled(
        schedulePairs.map(async (pair) => {
          const existing = existingSchedulesMap.get(pair.name);
          if (existing) {
            const scheduleId = existing.scheduleId || existing.ScheduleId || existing.id;
            if (scheduleId) {
              const result = await updateAuditSchedule(scheduleId, {
                milestoneName: pair.name,
                dueDate: new Date(pair.date!).toISOString(),
                notes: "",
                status: SCHEDULE_STATUS.PLANNED,
              });
              console.log(`[Update Schedule] Updated ${pair.name} (${scheduleId}):`, result);
              return result;
            }
          } else {
            const result = await addAuditSchedule({
              auditId,
              milestoneName: pair.name,
              dueDate: new Date(pair.date!).toISOString(),
              status: SCHEDULE_STATUS.PLANNED,
              notes: "",
            });
            console.log(`[Update Schedule] Added ${pair.name}:`, result);
            return result;
          }
        })
      );

      // Check for failures
      const scheduleFailures = scheduleResults.filter((r) => r.status === "rejected");
      if (scheduleFailures.length > 0) {
        console.error("[Update Schedule] Some schedules failed:", scheduleFailures);
        scheduleFailures.forEach((failure) => {
          console.error("[Update Schedule] Failure:", failure);
        });
      }

      // Delete schedules that are no longer in the form
      const targetMilestoneNames = new Set(schedulePairs.map((p) => p.name));
      const toDeleteSchedules = existingSchedulesArray.filter(
        (s: any) => !targetMilestoneNames.has(s.milestoneName || s.MilestoneName)
      );
      if (toDeleteSchedules.length > 0) {
        const deleteResults = await Promise.allSettled(
          toDeleteSchedules.map((s: any) => {
            const scheduleId = s.scheduleId || s.ScheduleId || s.id;
            return scheduleId ? deleteAuditSchedule(scheduleId) : Promise.resolve();
          })
        );
        const deleteFailures = deleteResults.filter((r) => r.status === "rejected");
        if (deleteFailures.length > 0) {
          console.error("[Update Schedule] Some schedule deletions failed:", deleteFailures);
        }
      }

      // Trigger refresh in modal by dispatching event and updating localStorage
      // Do this after all schedule operations complete
      // Add a small delay to ensure database has committed the changes
      setTimeout(() => {
        try {
          console.log(`[Update Schedule] Dispatching refresh event for auditId: ${auditId}`);
          const event = new CustomEvent('auditPlanUpdated', {
            detail: { auditId },
            bubbles: true,
            cancelable: true,
          });
          window.dispatchEvent(event);
          document.dispatchEvent(event);
          
          // Also update localStorage for cross-tab communication
          localStorage.setItem(
            'auditPlanUpdated',
            JSON.stringify({
              auditId,
              _timestamp: Date.now(),
            })
          );
          console.log(`[Update Schedule] Refresh event dispatched and localStorage updated`);
        } catch (eventErr) {
          console.error('[Update Schedule] Failed to dispatch refresh event', eventErr);
        }
      }, 500); // 500ms delay to ensure database commit
    } catch (scheduleErr) {
      console.error("Update schedules failed", scheduleErr);
      toast.error("Failed to update schedules. Please try again.");
    }
  } else {
    // Create mode: Post-creation tasks
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

