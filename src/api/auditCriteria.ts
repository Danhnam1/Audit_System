import { apiClient } from '../hooks/axios'

export interface AuditCriterionDto {
  $id?: string
  criteriaId: string
  name: string
  description?: string
  referenceCode?: string
  publishedBy?: string
  status?: string
  createdAt?: string
}

export const getAuditCriteria = async (): Promise<AuditCriterionDto[]> => {
  const res: any = await apiClient.get('/AuditCriterion')
  const values: AuditCriterionDto[] = res?.$values || res?.values || res || []
  return values
}

export default {
  getAuditCriteria,
}
