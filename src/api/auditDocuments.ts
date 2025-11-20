import apiClient from './client';

export async function uploadAuditDocument(auditId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const url = `/AuditDocuments/upload/${encodeURIComponent(auditId)}`;
  const res = await apiClient.post(url, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function getAuditDocuments(auditId: string) {
  if (!auditId) return [];
  const url = `/AuditDocuments/${encodeURIComponent(auditId)}`;
  try {
    const res = await apiClient.get(url);
    const data = res.data;
    // Normalize: if array or $values provided, return that; if single object, wrap
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.$values)) return data.$values;
    return data ? [data] : [];
  } catch (err) {
    console.error('getAuditDocuments failed', err);
    return [];
  }
}

export default {
  uploadAuditDocument,
  getAuditDocuments,
};
