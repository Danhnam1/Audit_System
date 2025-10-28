export interface RequestItem {
  id: string;
  type: 'Audit Request' | 'Document Review' | 'Finding Follow-up' | 'Ad-hoc Audit' | 'Consultation' | string;
  title: string;
  requestedBy: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  status: 'Pending Review' | 'In Progress' | 'Approved' | 'Resolved' | string;
  requestDate: string;
  dueDate: string;
  description: string;
  standards: string[];
  scope: string;
}
