import type { Attachment } from '../../../api/attachments';

export interface Audit {
  auditId: string;
  title: string;
  status?: string;
}

export interface ActionWithDetails {
  actionId: string;
  title?: string;
  description?: string;
  assignedTo?: string;
  assignedUserName?: string;
  status?: string;
  progressPercent?: number;
  dueDate?: string;
  createdAt?: string;
  reviewFeedback?: string | null;
  attachments?: Attachment[];
}

export interface Finding {
  findingId: string;
  auditId: string;
  title: string;
  description?: string;
  severity?: string;
  status?: string;
  deadline?: string;
  createdAt?: string;
  actions?: ActionWithDetails[];
  findingAttachments?: Attachment[];
}

export interface AuditDepartmentInfo {
  deptId?: number | string;
  name: string;
  status?: string;
}

export interface AuditCriteriaInfo {
  criteriaId?: string;
  name: string;
  status?: string;
}

export interface AuditTeamInfo {
  userId?: string;
  name: string;
  roleInTeam?: string;
  isLead?: boolean;
  email?: string;
}

export interface AuditScheduleInfo {
  scheduleId?: string;
  milestoneName?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
}

export interface AuditMetadata {
  auditId: string;
  title: string;
  type?: string;
  scope?: string;
  objective?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: string;
  departments: AuditDepartmentInfo[];
  criteria: AuditCriteriaInfo[];
  team: AuditTeamInfo[];
  schedules: AuditScheduleInfo[];
}

