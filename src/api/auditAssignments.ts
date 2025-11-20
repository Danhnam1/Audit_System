import apiClient from './client';

export interface AuditAssignment {
  assignmentId: string;
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  status: string;
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
  const res = await apiClient.get('/AuditAssignment');
  return res.data;
};

// Get assignments by audit ID
export const getAuditAssignmentsByAudit = async (auditId: string): Promise<AuditAssignment[]> => {
  const res = await apiClient.get(`/AuditAssignment/audit/${auditId}`);
  return res.data;
};

// Get assignments by auditor ID
export const getAuditAssignmentsByAuditor = async (auditorId: string): Promise<AuditAssignment[]> => {
  const res = await apiClient.get(`/AuditAssignment/auditor/${auditorId}`);
  return res.data;
};

// Get assignments by department ID
export const getAuditAssignmentsByDepartment = async (deptId: number): Promise<AuditAssignment[]> => {
  const res = await apiClient.get(`/AuditAssignment/department/${deptId}`);
  return res.data;
};

// Create new audit assignment
export const createAuditAssignment = async (dto: CreateAuditAssignmentDto): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res = await apiClient.post('/AuditAssignment', pascalDto);
  return res.data;
};

// Update audit assignment
export const updateAuditAssignment = async (
  assignmentId: string,
  dto: Partial<CreateAuditAssignmentDto>
): Promise<AuditAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res = await apiClient.put(`/AuditAssignment/${assignmentId}`, pascalDto);
  return res.data;
};

// Delete audit assignment
export const deleteAuditAssignment = async (assignmentId: string): Promise<void> => {
  await apiClient.delete(`/AuditAssignment/${assignmentId}`);
};
