import apiClient from './client';
import { unwrap } from '../utils';

export interface AuditChecklistItem {
  auditItemId: string;
  auditId: string;
  questionTextSnapshot: string;
  section: string;
  order: number;
  status: string;
  comment: string | null;
}

export const getChecklistItemsByAudit = async (auditId: string): Promise<AuditChecklistItem[]> => {
  const res = await apiClient.get(`/AuditChecklistItems/audit/${auditId}`);
  const data = res.data !== undefined ? res.data : res;
  return unwrap<AuditChecklistItem>(data);
};
