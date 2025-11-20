import { apiClient } from '../hooks/axios';

// Get all department heads
export const getDepartmentHeads = async (): Promise<any> => {
  return apiClient.get('/admin/AdminDepartmentHead') as any;
};

// Get department head by department ID
export const getDepartmentHeadByDeptId = async (deptId: number | string): Promise<any> => {
  return apiClient.get(`/admin/AdminDepartmentHead/${deptId}`) as any;
};

export default {
  getDepartmentHeads,
  getDepartmentHeadByDeptId,
};
