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

// Try a few common server routes to download a document by id
export async function downloadAuditDocumentById(documentId: string, auditId?: string): Promise<Blob> {
  if (!documentId) throw new Error('documentId is required');

  const tryPaths: string[] = [];
  // Most likely patterns
  tryPaths.push(`/AuditDocuments/download/${encodeURIComponent(documentId)}`);
  tryPaths.push(`/AuditDocuments/${encodeURIComponent(documentId)}/download`);
  if (auditId) {
    tryPaths.push(`/AuditDocuments/${encodeURIComponent(auditId)}/download/${encodeURIComponent(documentId)}`);
    tryPaths.push(`/AuditDocuments/${encodeURIComponent(auditId)}/${encodeURIComponent(documentId)}`);
  }
  // Additional fallbacks sometimes seen
  tryPaths.push(`/AuditDocuments/file/${encodeURIComponent(documentId)}`);
  tryPaths.push(`/AuditDocuments/${encodeURIComponent(documentId)}/file`);

  let lastErr: any;
  for (const path of tryPaths) {
    try {
      const res = await apiClient.get(path, { responseType: 'blob' } as any);
      if (res && res.data) return res.data as Blob;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error('Failed to download document');
}

export default {
  uploadAuditDocument,
  getAuditDocuments,
  downloadAuditDocumentById,
};
