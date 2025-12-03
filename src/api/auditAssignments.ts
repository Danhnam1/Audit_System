import { apiClient } from '../hooks/axios';

export interface AuditAssignment {
  assignmentId: string;
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  status: string;
  assignedAt?: string;
  auditTitle?: string;
  departmentName?: string;
  auditorName?: string;
}

export interface CreateAuditAssignmentDto {
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  status: string;
}

// Helper to convert to PascalCase for .NET API
const toPascalCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPascalCase);
  if (typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    acc[pascalKey] = toPascalCase(obj[key]);
    return acc;
  }, {} as any);
};

// Get all audit assignments
export const getAuditAssignments = async (): Promise<AuditAssignment[]> => {
  const res: any = await apiClient.get('/AuditAssignment');
  
  // Handle $values structure
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Get assignments by audit ID
export const getAuditAssignmentsByAudit = async (auditId: string): Promise<AuditAssignment[]> => {
  const res: any = await apiClient.get(`/AuditAssignment/audit/${auditId}`);
  // apiClient from hooks/axios returns response.data, so res is already the data
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Get assignments by auditor ID
export const getAuditAssignmentsByAuditor = async (auditorId: string): Promise<AuditAssignment[]> => {
  const res: any = await apiClient.get(`/AuditAssignment/auditor/${auditorId}`);
  // apiClient from hooks/axios returns response.data, so res is already the data
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Get assignments by department ID
export const getAuditAssignmentsByDepartment = async (deptId: number): Promise<AuditAssignment[]> => {
  const res: any = await apiClient.get(`/AuditAssignment/department/${deptId}`);
  // apiClient from hooks/axios returns response.data, so res is already the data
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Create new audit assignment
export const createAuditAssignment = async (dto: CreateAuditAssignmentDto): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res: any = await apiClient.post('/AuditAssignment', pascalDto);
  // apiClient from hooks/axios returns response.data, so res is already the data
  return res;
};

// Update audit assignment
export const updateAuditAssignment = async (
  assignmentId: string,
  dto: Partial<CreateAuditAssignmentDto>
): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res: any = await apiClient.put(`/AuditAssignment/${assignmentId}`, pascalDto);
  // apiClient from hooks/axios returns response.data, so res is already the data
  return res;
};

// Delete audit assignment
export const deleteAuditAssignment = async (assignmentId: string): Promise<void> => {
  await apiClient.delete(`/AuditAssignment/${assignmentId}`);
};

// Get my assignments (for current auditor)
export const getMyAssignments = async (): Promise<any> => {
  try {
    // apiClient uses axios interceptor that returns response.data
    // But we need to handle the case where response might still be full axios response
    const res: any = await apiClient.get('/AuditAssignment/my-assignments');
    
    // If interceptor worked, res should be response.data already
    // But if we got full response, extract data
    let data = res;
    if (res?.data && res?.status) {
      // This is full axios response, get the data
      data = res.data;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getMyAssignments:', error);
    throw error;
  }
};