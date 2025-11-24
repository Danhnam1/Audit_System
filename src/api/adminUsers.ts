import { apiClient } from '../hooks/axios'
import { unwrap } from '../utils/normalize'

export interface AdminUserDto {
  $id?: string
  userId?: string
  email?: string
  fullName?: string
  roleName?: string
  deptId?: number | string | null
  isActive?: boolean
  createdAt?: string | null
  lastLogin?: string | null
}

export const getAdminUsers = async (): Promise<AdminUserDto[]> => {
  const res: any = await apiClient.get('/admin/AdminUsers')
  const values: AdminUserDto[] = unwrap(res?.$values || res?.values || res?.data || res)
  return values
}

// Get users by department ID
export const getAdminUsersByDepartment = async (deptId: number): Promise<AdminUserDto[]> => {
  const res: any = await apiClient.get(`/admin/AdminUsers/by-department/${deptId}`)
  const values: AdminUserDto[] = unwrap(res?.$values || res?.values || res?.data || res)
  return values
}

// Get user by ID
export const getUserById = async (userId: string): Promise<AdminUserDto> => {
  const res: any = await apiClient.get(`/admin/AdminUsers/${userId}`)
  const data = res?.data || res
  // If data is wrapped in $values, unwrap it, otherwise return directly
  if (Array.isArray(data?.$values)) {
    return data.$values[0]
  }
  return data
}

export default { getAdminUsers, getAdminUsersByDepartment, getUserById }
