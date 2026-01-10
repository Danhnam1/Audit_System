import { apiClient } from '../hooks/axios';

export interface UploadAttachmentDto {
  entityType: string; // "finding", "action", etc.
  entityId: string; // GUID of the entity
  uploadedBy?: string; // User ID from token (optional, backend will get from token if not provided)
  status?: string;
  retentionUntil?: string;
  isArchived?: boolean;
  file: File;
}

export interface Attachment {
  attachmentId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  filePath?: string;
  blobPath?: string; // Alternative path field from API
  uploadedAt: string;
  uploadedBy: string;
  status?: string;
  retentionUntil?: string;
  isArchived: boolean;
}

// Upload attachment with multipart/form-data
export const uploadAttachment = async (dto: UploadAttachmentDto): Promise<Attachment> => {
 

  const formData = new FormData();
  formData.append('EntityType', dto.entityType);
  formData.append('EntityId', dto.entityId);
  // Status is required by backend - always send it
  formData.append('Status', dto.status !== undefined && dto.status !== null ? dto.status : '');
  if (dto.retentionUntil) formData.append('RetentionUntil', dto.retentionUntil);
  if (dto.isArchived !== undefined) formData.append('IsArchived', String(dto.isArchived));
  formData.append('file', dto.file);
  
  // Note: uploadedBy is handled by backend from token, not included in formData

  

  try {
    const res = await apiClient.post('/admin/AdminAttachment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  } catch (error: any) {
    console.error('Error status:', error?.response?.status);
    
    // Extract validation errors if available
    const errorData = error?.response?.data;
    if (errorData?.errors && typeof errorData.errors === 'object') {
      console.error('Validation errors:', errorData.errors);
      const validationErrors: string[] = [];
      Object.keys(errorData.errors).forEach(key => {
        const fieldErrors = errorData.errors[key];
        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err: string) => {
            validationErrors.push(`${key}: ${err}`);
          });
        } else if (typeof fieldErrors === 'string') {
          validationErrors.push(`${key}: ${fieldErrors}`);
        }
      });
      console.error('Validation errors list:', validationErrors);
    }
    
    console.error('Error headers:', error?.response?.headers);
    throw error;
  }
};

// Get attachments for an entity
export const getAttachments = async (entityType: string, entityId: string): Promise<Attachment[]> => {
  const res = await apiClient.get(`/admin/AdminAttachment/entity/${entityType}/${entityId}`);
  // Unwrap $values if present
  const { unwrap } = await import('../utils/normalize');
  const attachments = unwrap(res);
  return attachments.map((att: any) => ({
    attachmentId: att.attachmentId || att.$id,
    entityType: att.entityType,
    entityId: att.entityId,
    fileName: att.fileName,
    fileSize: att.sizeBytes || att.fileSize || 0,
    contentType: att.contentType,
    filePath: att.blobPath || att.filePath,
    uploadedAt: att.uploadedAt,
    uploadedBy: att.uploadedBy,
    status: att.status,
    retentionUntil: att.retentionUntil,
    isArchived: att.isArchived || false,
  }));
};

// Update attachment status
// NOTE: This API may need to be implemented on the backend
export const updateAttachmentStatus = async (attachmentId: string, status: string): Promise<void> => {
  await apiClient.put(`/admin/AdminAttachment/${attachmentId}/status`, { status });
};

// Generic update attachment (e.g., archive/delete or change status)
export const updateAttachment = async (attachmentId: string, payload: Partial<{ status: string; isArchived: boolean; retentionUntil: string }>) => {
  const dto: any = {};
  if (payload.status !== undefined) dto.Status = payload.status;
  if (payload.isArchived !== undefined) dto.IsArchived = payload.isArchived;
  if (payload.retentionUntil !== undefined) dto.RetentionUntil = payload.retentionUntil;
  await apiClient.put(`/admin/AdminAttachment/${attachmentId}`, dto);
};

// Hard delete attachment (if backend supports)
export const deleteAttachment = async (attachmentId: string): Promise<void> => {
  await apiClient.delete(`/admin/AdminAttachment/${attachmentId}`);
};