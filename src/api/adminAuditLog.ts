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

export interface AdminAuditLogQuery {
  entityType?: string;
  entityId?: string;
  auditId?: string;
}

export const getAdminAuditLog = async (query?: AdminAuditLogQuery): Promise<AdminAuditLogEntry[]> => {
  const res: any = await apiClient.get('/admin/AdminAuditLog', {
    params: {
      entityType: query?.entityType,
      entityId: query?.entityId,
      auditId: query?.auditId,
    },
  });
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

// GET /api/admin/AdminAuditLog/{logId}
export const getAdminAuditLogById = async (logId: string): Promise<AdminAuditLogEntry | null> => {
  if (!logId) return null;
  try {
    const res: any = await apiClient.get(`/admin/AdminAuditLog/${encodeURIComponent(logId)}`);
    const data = res?.data ?? res;
    return data ?? null;
  } catch (error) {
    console.error('Failed to get audit log detail:', error);
    return null;
  }
};
