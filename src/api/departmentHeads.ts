import { apiClient } from '../hooks/axios';
import { getAdminUsers } from './adminUsers';

// Get all department heads
export const getDepartmentHeads = async (): Promise<any> => {
  return apiClient.get('/admin/AdminDepartmentHead') as any;
};

// Get department head by department ID
export const getDepartmentHeadByDeptId = async (deptId: number | string): Promise<any> => {
  return apiClient.get(`/admin/AdminDepartmentHead/${deptId}`) as any;
};

// Get users for a given department by filtering admin users
export const getDepartmentUsers = async (deptId: number | string): Promise<any[]> => {
  const users = await getAdminUsers();
  const filtered = (users || []).filter((u: any) => String(u.deptId) === String(deptId));
  // Normalize to the shape used in UI: { id, name, role, email }
  return filtered.map((u: any) => ({
    id: u.userId ?? u.userId,
    name: u.fullName ?? u.fullName ?? u.email,
    role: u.roleName ?? undefined,
    email: u.email ?? undefined,
  }));
};

export default {
  getDepartmentHeads,
  getDepartmentHeadByDeptId,
  getDepartmentUsers,
};
