import apiClient from './client';
import { unwrap } from '../utils/normalize';

// Helper function to convert camelCase to PascalCase
const toPascalCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPascalCase);
  if (typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    const value = obj[key];
    acc[pascalKey] = toPascalCase(value);
    return acc;
  }, {} as any);
};

const unwrapArray = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  // Common server-side serializers (e.g., .NET) may return an object with $values
  if (Array.isArray(data.$values)) return data.$values;
  if (Array.isArray(data.values)) return data.values;
  if (Array.isArray(data.data)) return data.data;
  // Fallback: if object contains a single array property, try to return it
  const arrayProp = Object.keys(data).find((k) => Array.isArray((data as any)[k]));
  if (arrayProp) return (data as any)[arrayProp];
  return [];
};

// ChecklistTemplate interfaces
export interface ChecklistTemplateDto {
  $id?: string;
  templateId?: string;
  name: string;
  version?: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  deptId?: number | null;
  status?: string;
  isActive?: boolean;
}

export interface CreateChecklistTemplateDto {
  name: string;
  version?: string;
  description?: string;
  deptId?: number | null;
  status?: string;
  isActive?: boolean;
}

export interface UpdateChecklistTemplateDto {
  name?: string;
  version?: string;
  description?: string;
  deptId?: number | null;
  status?: string;
  isActive?: boolean;
}

// ChecklistItem interfaces
export interface ChecklistItemDto {
  $id?: string;
  itemId?: string;
  templateId: string;
  section?: string;
  order?: number;
  questionText: string;
  answerType?: string;
  status?: string;
  severityDefault?: string;
}

export interface CreateChecklistItemDto {
  templateId: string;
  section?: string;
  order?: number;
  questionText: string;
  answerType?: string;
  status?: string;
  severityDefault?: string;
}

export interface UpdateChecklistItemDto {
  section?: string;
  order?: number;
  questionText?: string;
  answerType?: string;
  status?: string;
  severityDefault?: string;
}

// ChecklistTemplate CRUD
export const getChecklistTemplates = async (): Promise<ChecklistTemplateDto[]> => {
  const res: any = await apiClient.get('/ChecklistTemplates');
  const values: ChecklistTemplateDto[] = unwrap(res?.$values || res?.values || res?.data || res);
  return values;
};

export const getChecklistTemplateById = async (id: string): Promise<ChecklistTemplateDto> => {
  const res: any = await apiClient.get(`/ChecklistTemplates/${id}`);
  // Handle response - could be direct data or wrapped
  // apiClient interceptor returns response.data, but check if it's further wrapped
  const data = res?.data || res;
  return data;
};

export const createChecklistTemplate = async (data: CreateChecklistTemplateDto): Promise<ChecklistTemplateDto> => {
  const res: any = await apiClient.post('/ChecklistTemplates', data);
  return res.data || res;
};

export const updateChecklistTemplate = async (id: string, data: UpdateChecklistTemplateDto): Promise<ChecklistTemplateDto> => {
  const res: any = await apiClient.put(`/ChecklistTemplates/${id}`, data);
  return res.data || res;
};

export const deleteChecklistTemplate = async (id: string): Promise<void> => {
  await apiClient.delete(`/ChecklistTemplates/${id}`);
};

// ChecklistItem CRUD
export const getChecklistItems = async (): Promise<ChecklistItemDto[]> => {
  const res: any = await apiClient.get('/ChecklistItems');
  const values: ChecklistItemDto[] = unwrap(res?.$values || res?.values || res?.data || res);
  return values;
};

export const getChecklistItemsByTemplate = async (templateId: string): Promise<ChecklistItemDto[]> => {
  const res: any = await apiClient.get(`/ChecklistItems/template/${templateId}`);
  const values: ChecklistItemDto[] = unwrapArray(res?.data || res);
  return values;
};

export const getChecklistItemById = async (id: string): Promise<ChecklistItemDto> => {
  const res: any = await apiClient.get(`/ChecklistItems/${id}`);
  return res.data || res;
};

export const createChecklistItem = async (data: CreateChecklistItemDto): Promise<ChecklistItemDto> => {
  const res: any = await apiClient.post('/ChecklistItems', data);
  return res.data || res;
};

export const updateChecklistItem = async (id: string, data: UpdateChecklistItemDto): Promise<ChecklistItemDto> => {
  const res: any = await apiClient.put(`/ChecklistItems/${id}`, data);
  return res.data || res;
};

export const deleteChecklistItem = async (id: string): Promise<void> => {
  await apiClient.delete(`/ChecklistItems/${id}`);
};

export const getAuditChecklistItems = async (auditId: string) => {
  const res = await apiClient.get(`/AuditChecklistItems/audit/${auditId}`);
  const unwrapped = unwrapArray(res.data);
  return unwrapped;
};

// Get checklist items by department ID
export const getChecklistItemsByDepartment = async (deptId: number) => {
  const res: any = await apiClient.get(`/AuditChecklistItems/by-department/${deptId}`);
  // Handle response - could be direct data or wrapped
  let data = res;
  if (res?.data && res?.status) {
    // Full axios response
    data = res.data;
  }
  const unwrapped = unwrapArray(data);
  return unwrapped;
};

// Mark checklist item as compliant
export const markChecklistItemCompliant = async (auditItemId: string) => {
  const res = await apiClient.put(`/AuditChecklistItems/${auditItemId}/compliant`);
  return res.data;
}
export const markChecklistItemCompliant1 = async (
  auditItemId: string,
  data: {
    title?: string;
    reason?: string;
    dateOfCompliance?: string;
    timeOfCompliance?: string;
    department?: string;
    witnessId?: string; // Witness user ID (GUID string)
    createdBy?: string | number; // Current user ID (GUID string from JWT or int)
  }
) => {
  // Validate required fields
  if (!data.title?.trim()) {
    throw new Error('Title is required');
  }
  if (!data.reason?.trim()) {
    throw new Error('Reason is required');
  }
  if (!data.department?.trim()) {
    throw new Error('Department is required');
  }

  // Convert timeOfCompliance to HH:MM:SS format (TimeOnly in .NET)
  const formatTimeOnly = (timeStr: string): string => {
    if (!timeStr) return '00:00:00';
    // If format is HH:MM, add :00 for seconds
    if (timeStr.match(/^\d{2}:\d{2}$/)) {
      return `${timeStr}:00`;
    }
    // If format is HH:MM:SS, return as is
    if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return timeStr;
    }
    return '00:00:00';
  };

  // Create payload in camelCase (backend expects camelCase directly)
  const payload = {
    auditChecklistItemId: auditItemId, // GUID string
    title: data.title!.trim(),
    reason: data.reason!.trim(),
    dateOfCompliance: data.dateOfCompliance || new Date().toISOString().split('T')[0],
    timeOfCompliance: formatTimeOnly(data.timeOfCompliance || ''), // Convert to HH:MM:SS
    department: data.department!.trim(),
    witnessId: data.witnessId || '', // Witness userId (GUID string)
    createdBy: data.createdBy || '', // Keep as GUID string or int from caller
  };
  
  
  // Send to POST /api/ChecklistItemNoFinding with camelCase payload
  const res = await apiClient.post(`/ChecklistItemNoFinding`, payload);
  
  if (res.data) {
  }
  
  return res.data;
};

// Mark checklist item as non-compliant
export const markChecklistItemNonCompliant = async (auditItemId: string) => {
  const res = await apiClient.put(`/AuditChecklistItems/${auditItemId}/non-compliant`, {
    entityId: auditItemId,
  });
  return res.data;
};

// Create audit checklist items from template
export const createAuditChecklistItemsFromTemplate = async (auditId: string, deptId: number) => {
  
  // Try POST with query params in URL first (as per user's original request)
  const params = new URLSearchParams({
    auditId: auditId,
    deptId: deptId.toString(),
  });
  
  const urlWithParams = `/AuditChecklistItems/from-template?${params.toString()}`;
  
  try {
    const res = await apiClient.post(urlWithParams, {});
    return res.data || res;
  } catch (error: any) {
    
    // Fallback: POST with body (PascalCase for .NET)
    const url = `/AuditChecklistItems/from-template`;
    const payload = {
      AuditId: auditId,
      DeptId: deptId,
    };
    
    const res = await apiClient.post(url, payload);
    return res.data || res;
  }
};

// Create audit checklist item
export interface CreateAuditChecklistItemDto {
  auditId: string;
  questionTextSnapshot: string;
  section?: string;
  order?: number;
  status?: string;
  comment?: string;
}

export const createAuditChecklistItem = async (data: CreateAuditChecklistItemDto): Promise<any> => {
  const res: any = await apiClient.post('/AuditChecklistItems', data);
  return res.data || res;
};

// Update audit checklist item
export interface UpdateAuditChecklistItemDto {
  questionTextSnapshot?: string;
  section?: string;
  order?: number;
  status?: string;
  comment?: string;
}

export const updateAuditChecklistItem = async (auditItemId: string, data: UpdateAuditChecklistItemDto): Promise<any> => {
  const res: any = await apiClient.put(`/AuditChecklistItems/${auditItemId}`, data);
  return res.data || res;
};

// Delete audit checklist item
export const deleteAuditChecklistItem = async (auditItemId: string): Promise<void> => {
  await apiClient.delete(`/AuditChecklistItems/${auditItemId}`);
};

// Get compliant details for a compliant item by its ID
export const getChecklistItemCompliantDetails = async (compliantItemId: string | number): Promise<any> => {
  const res = await apiClient.get(`/ChecklistItemNoFinding/${compliantItemId}`);
  return res.data;
};

// Get compliant record ID for an audit item (by auditItemId/auditChecklistItemId GUID)
// Returns the numeric 'id' field of the compliant record
export const getCompliantIdByAuditItemId = async (auditItemId: string): Promise<number | null> => {
  try {
    
    // GET /ChecklistItemNoFinding returns ALL compliant records
    // We need to filter by auditChecklistItemId on the client side
    
    const res = await apiClient.get(`/ChecklistItemNoFinding`);
    
    
    // Response is wrapped with $values array
    const allRecords = unwrapArray(res.data);
    
    // Find the record that matches our auditChecklistItemId
    const compliantRecord = allRecords.find((record: any) => 
      record.auditChecklistItemId === auditItemId
    );
    
    const compliantId = compliantRecord?.id;
    
    if (!compliantId) {
      return null;
    }
    
    return compliantId;
  } catch (err: any) {
    console.error(' [API] ERROR in getCompliantIdByAuditItemId:', err?.message);

    return null;
  }
};

// Get overdue checklist items for an audit
export const getOverdueChecklistItems = async (auditId: string): Promise<any[]> => {
  const allItems = await getAuditChecklistItems(auditId);
  // Filter items with status "Overdue"
  return allItems.filter((item: any) => {
    const status = String(item.status || '').toLowerCase();
    return status === 'overdue';
  });
};

// Update overdue checklist items to active for an audit
export const updateOverdueToActiveByAuditId = async (auditId: string): Promise<{ message: string; updatedCount: number }> => {
  const res: any = await apiClient.put(`/AuditChecklistItems/audit/${auditId}/update-overdue-to-active`);
  return res?.data ?? res;
};

export default {
  getChecklistTemplates,
  getChecklistItemsByTemplate,
  getAuditChecklistItems,
  getChecklistItemsByDepartment,
  markChecklistItemCompliant,
  markChecklistItemCompliant1,
  markChecklistItemNonCompliant,
  createAuditChecklistItemsFromTemplate,
  createAuditChecklistItem,
  updateAuditChecklistItem,
  deleteAuditChecklistItem,
  getChecklistItemCompliantDetails,
  getCompliantIdByAuditItemId,
  updateOverdueToActiveByAuditId,
};
