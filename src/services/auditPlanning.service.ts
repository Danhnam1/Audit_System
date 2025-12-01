import { getAuditPlans, getAuditScopeDepartments } from '../api/audits';
import type { AuditPlan } from '../types/auditPlan';

// Normalize possible .NET $values wrappers to plain arrays
const unwrap = <T = any>(payload: any): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.$values)) return payload.$values as T[];
  if (Array.isArray(payload?.values)) return payload.values as T[];
  return [];
};

/**
 * Fetch plans and merge scope departments in one place
 */
export const getPlansWithDepartments = async (): Promise<AuditPlan[]> => {
  const plansResponse = await getAuditPlans();

  let scopeDepsResponse: any = [];
  try {
    scopeDepsResponse = await getAuditScopeDepartments();
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      console.warn('[auditPlanning] AuditScopeDepartment endpoint returned 404, continuing with empty scope data.');
      scopeDepsResponse = [];
    } else {
      console.error('[auditPlanning] Failed to load AuditScopeDepartment. Falling back to empty scope list.', err);
      scopeDepsResponse = [];
    }
  }

  const plans = unwrap<any>(plansResponse);
  const scopeDeps = unwrap<any>(scopeDepsResponse);

  const merged: AuditPlan[] = plans.map((plan: any) => {
    const planId = String(plan.auditId || plan.id);
    const planScopeDepsRaw = scopeDeps.filter((sd: any) => String(sd.auditId) === planId);
    const planScopeDeps = planScopeDepsRaw.map((sd: any) => {
      const deptId = sd.deptId ;
      const deptName = sd.name || undefined;
      return { deptId, deptName };
    }).filter((sd: any) => sd.deptId != null);

    const normalizedDeptIds: string[] = (planScopeDeps || []).map((sd: any) => String(sd.deptId));

    return {
      ...plan,
      scopeDepartments: planScopeDeps,
      // attach normalized ids to assist client filters
      normalizedDeptIds,
    } as any as AuditPlan;
  });

  return merged;
};
