import type { AuditPlanDetails, AuditCriteriaItem, AuditTeamMember, ScopeDepartment } from '../types/auditPlan';

const unwrap = <T = any>(payload: any): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.$values)) return payload.$values as T[];
  if (Array.isArray(payload?.values)) return payload.values as T[];
  return [];
};

interface NormalizeOptions {
  departments: Array<{ deptId: number | string; name: string }>;
  criteriaList: any[]; // original criteria list from API
  users: any[]; // auditorOptions + ownerOptions
}

export const normalizePlanDetails = (raw: any, { departments, criteriaList, users }: NormalizeOptions): AuditPlanDetails => {
  const deptNameMap = new Map<string, string>((departments || []).map((d) => [String(d.deptId), d.name || '—']));

  const scopeDepartments: ScopeDepartment[] = Array.from(
    new Map(
      unwrap<any>(raw?.scopeDepartments)
        .map((dept: any) => ({
          ...dept,
          deptName: dept.deptName || deptNameMap.get(String(dept.deptId)) || `Department ID: ${dept.deptId}`,
        }))
        .map((dept: any) => [dept.deptId, dept])
    ).values()
  );

  const criteriaValues: AuditCriteriaItem[] = Array.from(
    new Map(
      unwrap<any>(raw?.criteria)
        .map((crit: any) => ({
          ...crit,
          name:
            crit.name ||
            crit.criterionName ||
            criteriaList.find(
              (c: any) => String(c.criteriaId || c.criterionId) === String(crit.criteriaId || crit.criterionId || crit.auditCriteriaMapId)
            )?.name,
        }))
        .map((crit: any, idx: number) => [crit.$id || crit.auditCriteriaMapId || crit.criteriaId || crit.criterionId || `criteria_${idx}`, crit])
    ).values()
  );

  const userLookup = (id: any) => users.find((u: any) => String(u.userId) === String(id));
  const auditTeams: AuditTeamMember[] = Array.from(
    new Map(
      unwrap<any>(raw?.auditTeams)
        .map((member: any) => ({
          ...member,
          fullName: member.fullName || userLookup(member.userId)?.fullName || `User ID: ${member.userId}`,
        }))
        .map((member: any) => [member.userId, member])
    ).values()
  );

  const schedules = unwrap<any>(raw?.schedules);

  const details: AuditPlanDetails = {
    ...raw,
    scopeDepartments: { values: scopeDepartments },
    criteria: { values: criteriaValues },
    auditTeams: { values: auditTeams },
    schedules: { values: schedules },
  };

  return details;
};
