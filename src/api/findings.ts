import { apiClient } from '../hooks/axios';
import { unwrap } from '../utils';

// Helper function to convert camelCase to PascalCase
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

// Types for Findings API
export interface CreateFindingPayload {
  auditId: string;
  auditItemId: string;
  title: string;
  description: string;
  severity: string;
  rootCauseId: number;
  deptId: number;
  status: string;
  deadline: string;
  reviewerId: string | null; // GUID or null
  source?: string; // Optional
  externalAuditorName?: string; // Optional
}

export interface Finding {
  findingId: string;
  auditId: string;
  auditItemId: string;
  title: string;
  description: string;
  severity: string;
  rootCauseId?: number;
  deptId?: number;
  createdBy: string;
  createdAt: string;
  status: string;
  deadline?: string;
  reviewerId?: string;
  source?: string;
  externalAuditorName?: string;
}

// Get all findings
export const getFindings = async (): Promise<Finding[]> => {
  console.log('📡 Calling GET /Findings...');
  const res = await apiClient.get('/Findings');
  console.log('📡 Raw response:', res);
  
  // Axios interceptor may return data directly
  const data = res.data !== undefined ? res.data : res;
  console.log('📡 Response data:', data);
  
  const unwrapped = unwrap<Finding>(data);
  console.log('📡 Unwrapped findings:', unwrapped);
  return unwrapped;
};

// Get findings by department
export const getFindingsByDepartment = async (deptId: number): Promise<Finding[]> => {
  console.log(`📡 Calling GET /Findings/by-department/${deptId}...`);
  const res = await apiClient.get(`/Findings/by-department/${deptId}`);
  console.log('📡 Full response object:', res);
  
  // Axios interceptor returns data directly, not res.data
  const data = res.data !== undefined ? res.data : res;
  console.log('📡 Data to unwrap:', data);
  
  const unwrapped = unwrap<Finding>(data);
  console.log('📡 Unwrapped findings:', unwrapped.length, 'items');
  return unwrapped;
};

// Get finding by ID
export const getFindingById = async (findingId: string): Promise<Finding> => {
  const res = await apiClient.get(`/Findings/${findingId}`);
  return res.data;
};

// Create a new finding
export const createFinding = async (payload: CreateFindingPayload): Promise<Finding> => {
  console.log('6. createFinding API - Received (camelCase):', JSON.stringify(payload, null, 2));
  
  // Convert to PascalCase for .NET API
  const pascalPayload = toPascalCase(payload);
  console.log('7. createFinding API - After PascalCase transform:', JSON.stringify(pascalPayload, null, 2));
  console.log('8. Sending POST to /Findings...');
  
  try {
    const result = await apiClient.post('/Findings', pascalPayload) as any;
    console.log('9. API Response received:', result);
    return result;
  } catch (error: any) {
    console.error('========== API ERROR ==========');
    console.error('Error response:', error?.response);
    console.error('Error data:', error?.response?.data);
    console.error('Error status:', error?.response?.status);
    console.error('Full error:', error);
    throw error;
  }
};

// Update finding
export const updateFinding = async (findingId: string, payload: Partial<CreateFindingPayload>): Promise<Finding> => {
  return apiClient.put(`/Findings/${findingId}`, payload) as any;
};

// Delete finding
export const deleteFinding = async (findingId: string): Promise<void> => {
  return apiClient.delete(`/Findings/${findingId}`) as any;
};

export default {
  getFindings,
  getFindingById,
  createFinding,
  updateFinding,
  deleteFinding,
};
