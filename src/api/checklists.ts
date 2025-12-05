import apiClient from './client';
import { unwrap } from '../utils/normalize';

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
  console.log('[getChecklistTemplateById] Raw API response:', res);
  // Handle response - could be direct data or wrapped
  // apiClient interceptor returns response.data, but check if it's further wrapped
  const data = res?.data || res;
  console.log('[getChecklistTemplateById] Processed data:', data);
  console.log('[getChecklistTemplateById] Data keys:', data ? Object.keys(data) : 'null');
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
  console.log('getAuditChecklistItems raw response:', res.data); // Debug log
  const unwrapped = unwrapArray(res.data);
  console.log('getAuditChecklistItems unwrapped:', unwrapped); // Debug log
  return unwrapped;
};

// Get checklist items by department ID
export const getChecklistItemsByDepartment = async (deptId: number) => {
  const res: any = await apiClient.get(`/AuditChecklistItems/by-department/${deptId}`);
  console.log('getChecklistItemsByDepartment raw response:', res);
  // Handle response - could be direct data or wrapped
  let data = res;
  if (res?.data && res?.status) {
    // Full axios response
    data = res.data;
  }
  const unwrapped = unwrapArray(data);
  console.log('getChecklistItemsByDepartment unwrapped:', unwrapped);
  return unwrapped;
};

// Mark checklist item as compliant
export const markChecklistItemCompliant = async (auditItemId: string) => {
  const res = await apiClient.put(`/AuditChecklistItems/${auditItemId}/compliant`);
  return res.data;
};

// Mark checklist item as non-compliant
export const markChecklistItemNonCompliant = async (auditItemId: string) => {
  const res = await apiClient.put(`/AuditChecklistItems/${auditItemId}/non-compliant`);
  return res.data;
};

// Create audit checklist items from template
export const createAuditChecklistItemsFromTemplate = async (auditId: string, deptId: number) => {
  console.log('=== createAuditChecklistItemsFromTemplate called ===');
  console.log('auditId parameter:', auditId);
  console.log('deptId parameter:', deptId);
  console.log('deptId type:', typeof deptId);
  
  // Try POST with query params in URL first (as per user's original request)
  const params = new URLSearchParams({
    auditId: auditId,
    deptId: deptId.toString(),
  });
  
  const urlWithParams = `/AuditChecklistItems/from-template?${params.toString()}`;
  console.log('Trying POST with query params in URL:', urlWithParams);
  
  try {
    const res = await apiClient.post(urlWithParams, {});
    console.log('API Response (POST with query params):', res);
    return res.data || res;
  } catch (error: any) {
    console.log('POST with query params failed, trying POST with body...', error);
    
    // Fallback: POST with body (PascalCase for .NET)
    const url = `/AuditChecklistItems/from-template`;
    const payload = {
      AuditId: auditId,
      DeptId: deptId,
    };
    
    console.log('Trying POST with body:', url, payload);
    const res = await apiClient.post(url, payload);
    console.log('API Response (POST with body):', res);
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

export default {
  getChecklistTemplates,
  getChecklistItemsByTemplate,
  getAuditChecklistItems,
  getChecklistItemsByDepartment,
  markChecklistItemCompliant,
  markChecklistItemNonCompliant,
  createAuditChecklistItemsFromTemplate,
  createAuditChecklistItem,
};
