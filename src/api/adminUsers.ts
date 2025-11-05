import { apiClient } from '../hooks/axios'

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
  const values: AdminUserDto[] = res?.$values || res?.values || res?.data || []
  return values
}

export default { getAdminUsers }
