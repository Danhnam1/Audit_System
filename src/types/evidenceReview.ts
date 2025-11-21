import { Attachment } from '@/api/attachments';
import { AuditChecklistItem } from '@/api/auditChecklistItems';

export interface Audit {
  auditId: string;
  title: string;
  type: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  objective: string;
}

export interface Finding {
  findingId: string;
  auditId: string;
  auditItemId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  deadline: string;
  createdBy: string;
  createdAt: string;
  rootCauseId?: number;
  deptId?: number;
  reviewerId?: string;
  source?: string;
  externalAuditorName?: string;
}

export interface ChecklistWithFindings extends AuditChecklistItem {
  findings: FindingWithAttachments[];
}

export interface FindingWithAttachments extends Finding {
  attachments: Attachment[];
}

export interface SectionGroup {
  section: string;
  checklists: ChecklistWithFindings[];
}

export interface AuditWithSections extends Audit {
  sections: SectionGroup[];
}
