import type { AuditPlanDetails, AuditCriteriaItem, AuditTeamMember, ScopeDepartment } from '../types/auditPlan';

export const unwrap = <T = any>(payload: any): T[] => {
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
  // Extract data from nested 'audit' object if it exists (API response structure)
  const auditData = raw?.audit || raw;
  
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

  const schedulesRaw = unwrap<any>(raw?.schedules);
  // Ensure schedules have all required fields properly mapped
  const schedules = schedulesRaw.map((schedule: any) => ({
    ...schedule,
    milestoneName: schedule.milestoneName || schedule.name || schedule.milestone || '',
    dueDate: schedule.dueDate || schedule.due || schedule.date || '',
    evidenceDate: schedule.evidenceDate || schedule.evidence || '',
    status: schedule.status || '',
    notes: schedule.notes || schedule.note || '',
  }));

  // Extract basic information from auditData (which could be raw.audit or raw itself)
  const details: AuditPlanDetails = {
    ...raw, // Spread all raw data first to preserve everything
    // Override nested collections with normalized versions
    scopeDepartments: { values: scopeDepartments },
    criteria: { values: criteriaValues },
    auditTeams: { values: auditTeams },
    schedules: { values: schedules },
    // Extract basic fields from auditData (raw.audit if exists, otherwise raw)
    auditId: auditData?.auditId || auditData?.id || raw?.auditId || raw?.id,
    id: auditData?.id || auditData?.auditId || raw?.id || raw?.auditId,
    title: auditData?.title || raw?.title || '',
    type: auditData?.type || raw?.type || '',
    scope: auditData?.scope || raw?.scope || '',
    templateId: auditData?.templateId || raw?.templateId || null,
    startDate: auditData?.startDate || auditData?.periodFrom || raw?.startDate || raw?.periodFrom || '',
    endDate: auditData?.endDate || auditData?.periodTo || raw?.endDate || raw?.periodTo || '',
    status: auditData?.status || raw?.status || '',
    isPublished: auditData?.isPublished ?? raw?.isPublished ?? false,
    objective: auditData?.objective || auditData?.objectives || raw?.objective || raw?.objectives || '',
    createdAt: auditData?.createdAt || raw?.createdAt || '',
    createdBy: typeof auditData?.createdBy === 'string' 
      ? auditData.createdBy 
      : typeof raw?.createdBy === 'string' 
        ? raw.createdBy 
        : auditData?.createdBy?.fullName || raw?.createdBy?.fullName || '',
    // User information - check both locations, handle if createdBy is an object
    createdByUser: auditData?.createdByUser || raw?.createdByUser || 
      (typeof auditData?.createdBy === 'object' && auditData?.createdBy 
        ? { 
            fullName: auditData.createdBy.fullName || auditData.createdBy.name || '',
            email: auditData.createdBy.email || '',
            roleName: auditData.createdBy.roleName || auditData.createdBy.role || ''
          }
        : typeof raw?.createdBy === 'object' && raw?.createdBy
          ? {
              fullName: raw.createdBy.fullName || raw.createdBy.name || '',
              email: raw.createdBy.email || '',
              roleName: raw.createdBy.roleName || raw.createdBy.role || ''
            }
          : undefined),
  };

  return details;
};
