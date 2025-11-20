// Audit-related constants

export const TEAM_ROLES = {
  AUDITOR: 'Auditor',
  LEAD: 'Lead Auditor',
  OWNER: 'AuditeeOwner',
} as const;

export const SCOPE_LEVELS = {
  ACADEMY: 'academy',
  DEPARTMENT: 'department',
} as const;

export const SCHEDULE_STATUS = {
  PLANNED: 'Planned',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
} as const;

export const MILESTONE_NAMES = {
  KICKOFF: 'Kickoff Meeting',
  FIELDWORK: 'Fieldwork Start',
  EVIDENCE: 'Evidence Due',
  DRAFT: 'Draft Report Due',
  CAPA: 'CAPA Due',
} as const;
