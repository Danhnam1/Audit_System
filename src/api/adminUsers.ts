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

export default { getAdminUsers }
