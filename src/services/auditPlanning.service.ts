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
  const [plansResponse, scopeDepsResponse] = await Promise.all([
    getAuditPlans(),
    getAuditScopeDepartments(),
  ]);

  const plans = unwrap<any>(plansResponse);
  const scopeDeps = unwrap<any>(scopeDepsResponse);

  const merged: AuditPlan[] = plans.map((plan: any) => {
    const planScopeDeps = scopeDeps.filter((sd: any) => String(sd.auditId) === String(plan.auditId || plan.id));
    return {
      ...plan,
      scopeDepartments: planScopeDeps,
    } as AuditPlan;
  });

  return merged;
};
