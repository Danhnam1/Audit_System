import apiClient from './client'
import { unwrap } from '../utils/normalize'

export interface AuditCriterionDto {
  $id?: string
  criteriaId?: string
  name: string
  description?: string
  referenceCode?: string
  publishedBy?: string | null
  status?: string
  createdAt?: string
}

export interface CreateCriterionDto {
  name: string
  description?: string
  referenceCode?: string
  publishedBy?: string | null
}

export interface UpdateCriterionDto {
  name?: string
  description?: string
  referenceCode?: string
  publishedBy?: string | null
  status?: string
}

export const getAuditCriteria = async (): Promise<AuditCriterionDto[]> => {
  const res: any = await apiClient.get('/AuditCriterion')
  // Interceptor already returns response.data, so res is the actual data
  // API returns { $id: "1", $values: [...] }
  // unwrap handles $values, values, or direct array
  const values: AuditCriterionDto[] = unwrap(res?.$values || res?.values || res?.data || res)
  return values
}

export const getAuditCriterionById = async (id: string): Promise<AuditCriterionDto> => {
  const res: any = await apiClient.get(`/AuditCriterion/${id}`)
  return res.data || res
}

export const createAuditCriterion = async (data: CreateCriterionDto): Promise<AuditCriterionDto> => {
  const res: any = await apiClient.post('/AuditCriterion', data)
  return res.data || res
}

export const updateAuditCriterion = async (id: string, data: UpdateCriterionDto): Promise<AuditCriterionDto> => {
  const res: any = await apiClient.put(`/AuditCriterion/${id}`, data)
  return res.data || res
}

export const deleteAuditCriterion = async (id: string): Promise<void> => {
  await apiClient.delete(`/AuditCriterion/${id}`)
}

export default {
  getAuditCriteria,
  getAuditCriterionById,
  createAuditCriterion,
  updateAuditCriterion,
  deleteAuditCriterion,
}
