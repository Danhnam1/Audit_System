import { apiClient } from '../hooks/axios';

export interface AdminAuditLogEntry {
  $id?: string;
  logId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  role: string;
  performedBy: string;
  performedAt: string;
}

export const getAdminAuditLog = async (): Promise<AdminAuditLogEntry[]> => {
  const res: any = await apiClient.get('/admin/AdminAuditLog');
  const data = res?.data ?? res;
  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  }
  if (data?.$values && Array.isArray(data.$values)) {
    return data.$values;
  }
  if (data?.values && Array.isArray(data.values)) {
    return data.values;
  }
  
  return [];
};
