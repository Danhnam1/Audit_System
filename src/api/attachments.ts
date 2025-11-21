import apiClient from './client';
import { unwrap } from '../utils';

export interface UploadAttachmentDto {
  entityType: string;
  entityId: string;
  uploadedBy: string;
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
  blobPath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  contentHash: string;
  retentionUntil: string | null;
  status: string;
  isArchived: boolean;
}

// Upload attachment with multipart/form-data
export const uploadAttachment = async (dto: UploadAttachmentDto): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('EntityType', dto.entityType);
  formData.append('EntityId', dto.entityId);
  formData.append('UploadedBy', dto.uploadedBy);
  if (dto.status) formData.append('Status', dto.status);
  if (dto.retentionUntil) formData.append('RetentionUntil', dto.retentionUntil);
  if (dto.isArchived !== undefined) formData.append('IsArchived', String(dto.isArchived));
  formData.append('file', dto.file);

  const res = await apiClient.post('/admin/AdminAttachment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// Get attachments for an entity
export const getAttachments = async (entityType: string, entityId: string): Promise<Attachment[]> => {
  const res = await apiClient.get(`/admin/AdminAttachment/entity/${entityType}/${entityId}`);
  const data = res.data !== undefined ? res.data : res;
  return unwrap<Attachment>(data);
};

// Approve attachment
export const approveAttachment = async (attachmentId: string): Promise<void> => {
  await apiClient.post(`/AttachmentReview/${attachmentId}/approve`, null, {
    headers: { 'Content-Type': 'application/json' }
  });
};

// Reject/Return attachment for correction
export const rejectAttachment = async (attachmentId: string, reason: string): Promise<void> => {
  await apiClient.post(`/AttachmentReview/${attachmentId}/returned`, { reason }, {
    headers: { 'Content-Type': 'application/json' }
  });
};
