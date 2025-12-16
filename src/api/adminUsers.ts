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

// Bulk register users from Excel file
export const bulkRegisterUsers = async (file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  // Use apiClient with multipart/form-data header
  // Note: apiClient interceptor returns response.data, so we get the data directly
  const response = await apiClient.post('/Auth/bulk-register', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  } as any)
  
  return response
}

// Update user profile (FullName and avatarFile only)
export const updateUserProfile = async (
  userId: string,
  fullName: string,
  avatarFile?: File
): Promise<any> => {
  const formData = new FormData()
  formData.append('FullName', fullName)
  
  if (avatarFile) {
    formData.append('avatarFile', avatarFile)
  }
  
  // Note: Backend requires all fields, but we only send what user can update
  // Backend should preserve other fields (roleName, deptId, isActive, status)
  const response = await apiClient.put(`/admin/AdminUsers/${userId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  } as any)
  
  return response
}

export default { getAdminUsers, getAdminUsersByDepartment, getUserById, bulkRegisterUsers, updateUserProfile }
