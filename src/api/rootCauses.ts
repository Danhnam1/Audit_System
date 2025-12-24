import apiClient from './client';
import { unwrap } from '../utils';

export interface RootCause {
  rootCauseId: number;
  name: string;
  description?: string;
}

export interface CreateRootCauseDto {
  name: string;
  description: string;
  status: string;
  category: string;
}

// Get all root causes
export const getRootCauses = async (): Promise<RootCause[]> => {
  const res = await apiClient.get('/RootCauses');
  return unwrap<RootCause>(res.data);
};

// Helper to convert to PascalCase for .NET API
const toPascalCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPascalCase);
  if (typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    acc[pascalKey] = toPascalCase(obj[key]);
    return acc;
  }, {} as any);
};

// Get root cause by ID
export const getRootCauseById = async (id: number): Promise<RootCause> => {
  const res = await apiClient.get(`/RootCauses/${id}`);
  return res.data;
};

// Get root cause by finding ID
export const getRootCauseByFindingId = async (findingId: string): Promise<RootCause | null> => {
  try {
    const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
    
    // API trả về array trong $values
    let rootCauses: RootCause[] = [];
    
    // Kiểm tra cấu trúc response
    if (res.data && res.data.$values) {
      rootCauses = res.data.$values;
    } else if (Array.isArray(res.data)) {
      rootCauses = res.data;
    } else {
      rootCauses = unwrap<RootCause>(res);
    }
    
    // Lấy root cause mới nhất (phần tử cuối cùng trong mảng)
    if (rootCauses && rootCauses.length > 0) {
      const latest = rootCauses[rootCauses.length - 1];
      return latest;
    }
    
    return null;
  } catch (err) {
    console.error('Error getting root cause by finding ID:', err);
    return null;
  }
};

// Create new root cause
export const createRootCause = async (dto: CreateRootCauseDto): Promise<RootCause> => {
  const pascalDto = toPascalCase(dto);
  const res = await apiClient.post('/RootCauses', pascalDto);
  return res.data;
};

// Update root cause
export const updateRootCause = async (id: number, dto: Partial<CreateRootCauseDto>): Promise<RootCause> => {
  const pascalDto = toPascalCase(dto);
  const res = await apiClient.put(`/RootCauses/${id}`, pascalDto);
  return res.data;
};

// Approve root cause
export const approveRootCause = async (id: number): Promise<void> => {
  await apiClient.post(`/RootCauses/${id}/approve`);
};

// Reject root cause
export const rejectRootCause = async (id: number, reasonReject: string): Promise<void> => {
  await apiClient.post(`/RootCauses/${id}/reject`, { reasonReject });
};

// Send root cause for review (change from Draft to Pending)
export const sendRootCauseForReview = async (id: number): Promise<void> => {
  await apiClient.post(`/RootCauses/${id}/pending-review`);
};

// Delete root cause
export const deleteRootCause = async (id: number): Promise<void> => {
  await apiClient.delete(`/RootCauses/${id}`);
};

// Audit Log interfaces
export interface RootCauseLog {
  logId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string;
  newValue: string;
  role: string;
  performedBy: string;
  performedAt: string;
}

// Get audit logs for root cause
export const getRootCauseLogs = async (entityId: string): Promise<RootCauseLog[]> => {
  try {
    const res = await apiClient.get(`/RootCauses/${entityId}/audit-logs/update`);
    return res.data.$values || [];
  } catch (err) {
    console.error('Error fetching root cause logs:', err);
    return [];
  }
};
