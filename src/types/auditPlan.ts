export interface ScopeDepartment {
  auditId?: string | number;
  deptId: string | number;
  deptName?: string;
}

export interface AuditCriteriaItem {
  $id?: string;
  criteriaId?: string | number;
  criterionId?: string | number;
  auditCriteriaMapId?: string | number;
  name?: string;
  criterionName?: string;
}

export interface AuditTeamMember {
  userId: string | number;
  roleInTeam?: 'Auditor' | 'AuditeeOwner' | string;
  isLead?: boolean;
  fullName?: string;
}

export interface AuditScheduleItem {
  milestoneName?: string;
  name?: string;
  dueDate?: string;
  evidenceDate?: string;
  status?: string;
}

interface AuditPlanBase {
  auditId?: string;
  id?: string;
  title: string;
  type?: string;
  scope?: 'Academy' | 'Department' | string;
  templateId?: string | number | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  isPublished?: boolean;
  objective?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface AuditPlan extends AuditPlanBase {
  // merged in list view
  scopeDepartments?: ScopeDepartment[];
}

export interface AuditPlanDetails extends AuditPlanBase {
  createdByUser?: { fullName?: string; email?: string; roleName?: string };
  criteria?: { values?: AuditCriteriaItem[]; $values?: AuditCriteriaItem[] };
  auditTeams?: { values?: AuditTeamMember[]; $values?: AuditTeamMember[] };
  schedules?: { values?: AuditScheduleItem[]; $values?: AuditScheduleItem[] };
  // In details API, scopeDepartments may be nested with values
  scopeDepartments?:
    | ScopeDepartment[]
    | { values?: ScopeDepartment[]; $values?: ScopeDepartment[] };
}
