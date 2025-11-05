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

export default {
  getChecklistTemplates,
  getChecklistItemsByTemplate,
};
