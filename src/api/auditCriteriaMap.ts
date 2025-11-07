import { apiClient } from '../hooks/axios'

export interface AuditCriteriaMapPayload {
  auditId: string
  criteriaId: string
}

export const addCriterionToAudit = async (auditId: string, criteriaId: string) => {
  return apiClient.post('/AuditCriteriaMap', { auditId, criteriaId } as AuditCriteriaMapPayload)
}

export const getCriteriaForAudit = async (auditId: string) => {
  const res: any = await apiClient.get(`/AuditCriteriaMap/audit/${auditId}`)
  const values = res?.$values || res?.values || res || []
  return values
}

export const removeCriterionFromAudit = async (auditId: string, criteriaId: string) => {
  return apiClient.delete(`/AuditCriteriaMap/${auditId}/${criteriaId}`)
}

export default {
  addCriterionToAudit,
  getCriteriaForAudit,
  removeCriterionFromAudit,
}
