export type ResultType = 'Compliant' | 'Non-compliant' | 'Observation' | null;
export type Criticality = 'Low' | 'Medium' | 'High';

export type ChecklistTemplate = {
  id: string;
  code: string;
  name: string;
  auditType: string;
  department: string;
  totalItems: number;
  createdDate: string;
  status: 'Active' | 'Draft' | 'Archived';
};

export type ChecklistItem = {
  id: number;
  item: string;
  standardRef: string;
  category: string;
  criticality: Criticality;
  result: ResultType;
  remarks: string;
  evidence?: File | null;
};

export type FindingDraft = {
  checklistItemId: number;
  findingType: 'Major' | 'Minor' | 'Observation';
  title: string;
  description: string;
  rootCause: string;
  evidence?: File | null;
};

export type FindingRecord = {
  id: string;
  auditId: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
  category: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  reportedDate: string;
  dueDate: string;
};

export type InterviewLog = {
  id: string;
  type: 'Interview' | 'Observation';
  findingRef: string; // Link to Finding for evidence chain
  personRole: string;
  summary: string;
  attachments: string[];
  linkToItem: string; // Checklist item reference
  date: string;
};

export type ImmediateAction = {
  id: string;
  findingRef: string;
  action: string;
  owner: string;
  dueDateTime: string;
  status: 'Open' | 'Completed';
  createdDate: string;
};
