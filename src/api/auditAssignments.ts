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
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedDuration?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  actualAuditDate?: string;
  rejectionReason?: string;
}

export interface CreateAuditAssignmentDto {
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  status: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedDuration?: number;
}

export interface BulkCreateAuditAssignmentDto {
  auditId: string;
  deptId: number;
  auditorIds: string[]; // Array of auditor IDs
  notes?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedDuration?: number;
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

// Get assignments by department ID using POST method
export const getAuditAssignmentsByDepartmentPost = async (deptId: number): Promise<any> => {
  const res: any = await apiClient.post('/AuditAssignment/by-department', { deptId });
  // Return the full response so component can parse it
  return res;
};

// Create new audit assignment
export const createAuditAssignment = async (dto: CreateAuditAssignmentDto): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res: any = await apiClient.post('/AuditAssignment', pascalDto);
  return res;
};

// Update audit assignment
export const updateAuditAssignment = async (
  assignmentId: string,
  dto: Partial<CreateAuditAssignmentDto>
): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res: any = await apiClient.put(`/AuditAssignment/${assignmentId}`, pascalDto);
  return res;
};

// Delete audit assignment
export const deleteAuditAssignment = async (assignmentId: string): Promise<void> => {
  await apiClient.delete(`/AuditAssignment/${assignmentId}`);
};

// Get my assignments (for current auditor)
export const getMyAssignments = async (): Promise<any> => {
  try {
    const res: any = await apiClient.get('/AuditAssignment/my-assignments');
    let data = res;
    if (res?.data && res?.status) {
      data = res.data;
    }
    return data;
  } catch (error) {
    console.error('Error in getMyAssignments:', error);
    throw error;
  }
};

// Bulk create audit assignments (assign multiple auditors at once)
export const bulkCreateAuditAssignments = async (dto: BulkCreateAuditAssignmentDto): Promise<AuditAssignment[]> => {
  const res: any = await apiClient.post('/AuditAssignment/bulk', dto);
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

// Update actual audit date (accept schedule)
export const updateActualAuditDate = async (
  assignmentId: string,
  actualAuditDate: string // Format: YYYY-MM-DD
): Promise<AuditAssignment> => {
  // Parse the date string and create a date at local midnight to avoid timezone issues
  const [year, month, day] = actualAuditDate.split('-').map(Number);
  
  // Format as ISO string but ensure it represents the correct date
  // Use local date components to create UTC date at midnight
  const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  
  const payload = toPascalCase({ actualAuditDate: isoString });
  const res: any = await apiClient.put(`/AuditAssignment/${assignmentId}/actual-audit-date`, payload);
  return res;
};

// Reject assignment schedule with reason
export const rejectAssignment = async (
  assignmentId: string,
  reasonReject: string
): Promise<AuditAssignment> => {
  const payload = toPascalCase({ reasonReject });
  const res: any = await apiClient.put(`/AuditAssignment/${assignmentId}/reject-schedule`, payload);
  return res;
};