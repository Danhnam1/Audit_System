import { apiClient } from '../hooks/axios'
import { unwrap } from '../utils/normalize'

export interface DepartmentDto {
  $id?: string
  deptId?: number
  name?: string
  code?: string
  description?: string
}

export const getDepartments = async (): Promise<DepartmentDto[]> => {
  const res: any = await apiClient.get('/admin/AdminDepartments')
  const values: DepartmentDto[] = unwrap(res?.$values || res?.values || res?.data || res)
  return values
}

export const createDepartment = async (payload: Partial<DepartmentDto>) => {
  return apiClient.post('/admin/AdminDepartments', payload)
}

export const updateDepartment = async (id: string | number, payload: Partial<DepartmentDto>) => {
  return apiClient.put(`/admin/AdminDepartments/${id}`, payload)
}

export const deleteDepartment = async (id: string | number) => {
  return apiClient.delete(`/admin/AdminDepartments/${id}`)
}

export default {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
}
