import { apiClient } from './index';

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

export const getChecklistTemplates = async () => {
  const res = await apiClient.get('/ChecklistTemplates');
  return unwrapArray(res.data);
};

export const getChecklistItemsByTemplate = async (templateId: string) => {
  const res = await apiClient.get(`/ChecklistItems/template/${templateId}`);
  return unwrapArray(res.data);
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

export default {
  getChecklistTemplates,
  getChecklistItemsByTemplate,
  getAuditChecklistItems,
  getChecklistItemsByDepartment,
  markChecklistItemCompliant,
  markChecklistItemNonCompliant,
};
