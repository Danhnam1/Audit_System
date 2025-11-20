import { apiClient } from '../hooks/axios'
import { unwrap } from '../utils/normalize'

export interface AuditCriteriaMapPayload {
  auditId: string
  criteriaId: string
  status?: string // Optional status field
}

export const addCriterionToAudit = async (auditId: string, criteriaId: string) => {
  // Based on Swagger, this might be a POST endpoint with auditId and criteriaId
  const payload: AuditCriteriaMapPayload = { 
    auditId, 
    criteriaId,
    status: 'Active' // Default status if backend requires
  };
  return apiClient.post('/AuditCriteriaMap', payload);
}

export const getCriteriaForAudit = async (auditId: string) => {
  const res: any = await apiClient.get(`/AuditCriteriaMap/audit/${auditId}`)
  const values = unwrap(res)
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
