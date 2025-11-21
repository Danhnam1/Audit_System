import { apiClient } from '../hooks/axios';

export interface UploadAttachmentDto {
  entityType: string; // "finding", "action", etc.
  entityId: string; // GUID of the entity
  uploadedBy: string; // User ID from token
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
  filePath: string;
  uploadedAt: string;
  uploadedBy: string;
  status?: string;
  retentionUntil?: string;
  isArchived: boolean;
}

// Upload attachment with multipart/form-data
export const uploadAttachment = async (dto: UploadAttachmentDto): Promise<Attachment> => {
  console.log('========== EVIDENCE UPLOAD DEBUG ==========');
  console.log('1. Upload DTO received:', {
    entityType: dto.entityType,
    entityId: dto.entityId,
    uploadedBy: dto.uploadedBy,
    status: dto.status,
    fileName: dto.file?.name,
    fileSize: dto.file?.size,
    fileType: dto.file?.type,
  });

  const formData = new FormData();
  formData.append('EntityType', dto.entityType);
  formData.append('EntityId', dto.entityId);
  // Status is required by backend - always send it
  formData.append('Status', dto.status !== undefined && dto.status !== null ? dto.status : '');
  if (dto.retentionUntil) formData.append('RetentionUntil', dto.retentionUntil);
  if (dto.isArchived !== undefined) formData.append('IsArchived', String(dto.isArchived));
  formData.append('file', dto.file);
  
  // Note: uploadedBy is handled by backend from token, not included in formData

  console.log('2. FormData entries:');
  for (const [key, value] of formData.entries()) {
    console.log(`   ${key}:`, value instanceof File ? `File(${value.name})` : value);
  }
  
  console.log('3. Sending POST to /admin/AdminAttachment...');

  try {
    const res = await apiClient.post('/admin/AdminAttachment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('4. Upload successful! Response:', res.data);
    return res.data;
  } catch (error: any) {
    console.error('========== UPLOAD ERROR ==========');
    console.error('Error response:', error?.response);
    console.error('Error data:', error?.response?.data);
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
    console.error('Full error:', error);
    throw error;
  }
};

// Get attachments for an entity
export const getAttachments = async (entityType: string, entityId: string): Promise<Attachment[]> => {
  const res = await apiClient.get(`/admin/AdminAttachment/${entityType}/${entityId}`);
  return res.data;
};
