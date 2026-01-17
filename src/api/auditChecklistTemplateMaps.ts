import { apiClient } from '../hooks/axios';
import { unwrap } from '../utils/normalize';

export interface AuditChecklistTemplateMapPayload {
  auditId: string;
  templateId: string;
  status?: string;
}

export interface AuditChecklistTemplateMapDto {
  auditId: string;
  templateId: string;
  assignedAt?: string;
  assignedBy?: string;
  status?: string;
  [key: string]: any;
}

export const addAuditChecklistTemplateMap = async (
  payload: AuditChecklistTemplateMapPayload
) => {
  // Backend expects a flat DTO with auditId + templateId (+ optional status)
  // Do NOT send assignedBy here because API expects a Guid and may reject non-Guid values.
  return apiClient.post('/AuditChecklistTemplateMaps', payload);
};

// Get all mappings (used for client-side filtering)
export const getAllAuditChecklistTemplateMaps = async (): Promise<AuditChecklistTemplateMapDto[]> => {
  const res: any = await apiClient.get('/AuditChecklistTemplateMaps');
  const data = res?.data ?? res;
  const values = unwrap<AuditChecklistTemplateMapDto>(data);
  return values;
};

// Get mappings for a specific auditId
export const getAuditChecklistTemplateMapsByAudit = async (
  auditId: string
): Promise<AuditChecklistTemplateMapDto[]> => {
  if (!auditId) return [];
  const all = await getAllAuditChecklistTemplateMaps();
  const targetId = String(auditId).trim().toLowerCase();
  return all.filter((m) => String(m.auditId || '').trim().toLowerCase() === targetId);
};

// Update one mapping using composite key
export const updateAuditChecklistTemplateMap = async (
  auditId: string,
  templateId: string,
  payload: {
    assignedBy?: string;
    status?: string;
  }
) => {
  if (!auditId || !templateId) return;
  return apiClient.put(
    `/AuditChecklistTemplateMaps/${encodeURIComponent(String(auditId))}/${encodeURIComponent(
      String(templateId)
    )}`,
    payload
  );
};

// Delete one mapping using composite key
export const deleteAuditChecklistTemplateMap = async (auditId: string, templateId: string) => {
  if (!auditId || !templateId) return;
  return apiClient.delete(
    `/AuditChecklistTemplateMaps/${encodeURIComponent(String(auditId))}/${encodeURIComponent(
      String(templateId)
    )}`
  );
};

interface SyncAuditChecklistTemplateMapsParams {
  auditId: string;
  templateIds: string[];
  status?: string;
}

export const syncAuditChecklistTemplateMaps = async ({
  auditId,
  templateIds,
  status = 'Active',
}: SyncAuditChecklistTemplateMapsParams) => {
  if (!auditId) return;

  const uniqueIds = Array.from(
    new Set((templateIds || []).map((id) => String(id).trim()).filter(Boolean))
  );

  // Load current mappings for this audit
  const existing = await getAuditChecklistTemplateMapsByAudit(auditId);
  const existingIds = Array.from(
    new Set(
      existing
        .map(
          (m) =>
            m.templateId ??
            (m as any).checklistTemplateId ??
            (m as any).template?.templateId ??
            (m as any).template?.id
        )
        .filter((id) => id != null)
        .map((id) => String(id).trim())
    )
  );

  const toDelete = existingIds.filter((id) => !uniqueIds.includes(id));
  const toAdd = uniqueIds.filter((id) => !existingIds.includes(id));

  await Promise.all(
    toDelete.map((templateId) => deleteAuditChecklistTemplateMap(auditId, templateId))
  );

  await Promise.all(
    toAdd.map((templateId) =>
      addAuditChecklistTemplateMap({
        auditId: String(auditId),
        templateId: String(templateId),
        status,
      })
    )
  );
};

export default {
  addAuditChecklistTemplateMap,
  getAllAuditChecklistTemplateMaps,
  getAuditChecklistTemplateMapsByAudit,
  deleteAuditChecklistTemplateMap,
  syncAuditChecklistTemplateMaps,
};

