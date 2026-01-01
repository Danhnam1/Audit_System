import { getAuditPlanById } from '../../../../api/audits';
import { unwrap } from '../../../../utils/normalize';
import type { AuditPlan } from '../../../../types/auditPlan';
import { getDepartmentSensitiveAreaByDeptId } from '../../../../api/departmentSensitiveAreas';
import type { DepartmentSensitiveAreaDto } from '../../../../api/departmentSensitiveAreas';

/**
 * Load plan details for editing
 */
export const loadPlanDetailsForEdit = async (
  auditId: string,
  existingPlans: AuditPlan[]
): Promise<any> => {
  let details: any;

  try {
    const rawDetails = await getAuditPlanById(auditId);
    
    // Extract data from nested 'audit' object if it exists (API response structure)
    const auditData = rawDetails?.audit || rawDetails;

    details = {
      ...rawDetails,
      // Extract basic fields from auditData (rawDetails.audit if exists, otherwise rawDetails)
      auditId: auditData?.auditId || auditData?.id || rawDetails?.auditId || rawDetails?.id,
      id: auditData?.id || auditData?.auditId || rawDetails?.id || rawDetails?.auditId,
      title: auditData?.title || rawDetails?.title || '',
      type: auditData?.type || rawDetails?.type || 'Internal',
      scope: auditData?.scope || rawDetails?.scope || 'Department',
      templateId: auditData?.templateId || rawDetails?.templateId || null,
      startDate: auditData?.startDate || auditData?.periodFrom || rawDetails?.startDate || rawDetails?.periodFrom || '',
      endDate: auditData?.endDate || auditData?.periodTo || rawDetails?.endDate || rawDetails?.periodTo || '',
      status: auditData?.status || rawDetails?.status || 'Draft',
      isPublished: auditData?.isPublished ?? rawDetails?.isPublished ?? false,
      objective: auditData?.objective || auditData?.objectives || rawDetails?.objective || rawDetails?.objectives || '',
      createdAt: auditData?.createdAt || rawDetails?.createdAt || '',
      createdBy: auditData?.createdBy || rawDetails?.createdBy || '',
      scopeDepartments: {
        ...rawDetails.scopeDepartments,
        values: unwrap(rawDetails.scopeDepartments)
      },
      criteria: {
        ...rawDetails.criteria,
        values: unwrap(rawDetails.criteria)
      },
      auditTeams: {
        ...rawDetails.auditTeams,
        values: unwrap(rawDetails.auditTeams)
      },
      schedules: {
        ...rawDetails.schedules,
        values: unwrap(rawDetails.schedules)
      }
    };
  } catch (apiError) {
    // If detailed endpoint fails, fall back to using table data so the user can still edit basic fields
    const planFromTable = existingPlans.find(p => p.auditId === auditId || p.id === auditId);
    const planFromTableAny = planFromTable as any;

    if (!planFromTable) {
      alert('⚠️ Cannot Edit\n\nBackend API /AuditPlan/{id} is returning 500 error and the plan was not found in the list.');
      throw new Error('Backend API /AuditPlan/{id} failed and plan not found in table.');
    }

    // Build a basic editable shape from table row
    details = {
      auditId: planFromTableAny.auditId || planFromTableAny.id,
      title: planFromTableAny.title || '',
      type: planFromTableAny.type || 'Internal',
      scope: planFromTableAny.scope || 'Department',
      objective: planFromTableAny.objective || '',
      startDate: planFromTableAny.startDate || planFromTableAny.periodFrom,
      endDate: planFromTableAny.endDate || planFromTableAny.periodTo,
      status: planFromTableAny.status || 'Draft',
      isPublished: planFromTableAny.isPublished || false,
      scopeDepartments: { values: [] },
      criteria: { values: [] },
      auditTeams: { values: [] },
      schedules: { values: [] }
    };
  }

  // Normalize dates
  if (details.startDate) {
    try {
      const startDateObj = new Date(details.startDate);
      if (!isNaN(startDateObj.getTime())) {
        details.startDate = startDateObj.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('[loadPlanDetailsForEdit] Failed to parse startDate:', details.startDate);
    }
  }

  if (details.endDate) {
    try {
      const endDateObj = new Date(details.endDate);
      if (!isNaN(endDateObj.getTime())) {
        details.endDate = endDateObj.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('[loadPlanDetailsForEdit] Failed to parse endDate:', details.endDate);
    }
  }

  // Load sensitive areas for each department
  const scopeDepts = unwrap(details.scopeDepartments);
  const sensitiveAreasByDept: Record<number, string[]> = {};

  for (const dept of scopeDepts) {
    try {
      const deptId = Number(dept.deptId || dept.id || dept);
      if (isNaN(deptId)) continue;

      const areas = await getDepartmentSensitiveAreaByDeptId(deptId);
      const areasArray = unwrap(areas) as DepartmentSensitiveAreaDto[];
      sensitiveAreasByDept[deptId] = areasArray.map(a => a.sensitiveArea || String(a));
    } catch (err) {
      console.warn(`[loadPlanDetailsForEdit] Failed to load sensitive areas for dept ${dept.deptId}:`, err);
      sensitiveAreasByDept[Number(dept.deptId || dept.id || dept)] = [];
    }
  }

  details.sensitiveAreasByDept = sensitiveAreasByDept;

  // Normalize schedules
  const schedules = unwrap(details.schedules);
  const scheduleMap: Record<string, string> = {};

  schedules.forEach((s: any) => {
    const milestoneName = String(s.milestoneName || s.name || '').toLowerCase();
    const dueDate = s.dueDate || s.date;

    if (dueDate) {
      try {
        const dateObj = new Date(dueDate);
        if (!isNaN(dateObj.getTime())) {
          scheduleMap[milestoneName] = dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('[loadPlanDetailsForEdit] Failed to parse schedule date:', dueDate);
      }
    }
  });

  details.scheduleMap = scheduleMap;

  return details;
};

/**
 * Prepare payload for complete update
 * This is a simplified version that returns basic payload only
 * The full complete update logic is handled in handleSubmitPlan
 */
export const prepareCompleteUpdatePayload = (formState: any, auditId: string): any => {
  const primaryTemplateId = formState.selectedTemplateIds[0];

  return {
    auditId: auditId,
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
};

