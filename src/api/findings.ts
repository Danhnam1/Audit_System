import { apiClient } from '../hooks/axios';

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
  return apiClient.get('/Findings') as any;
};

// Get finding by ID
export const getFindingById = async (findingId: string): Promise<Finding> => {
  return apiClient.get(`/Findings/${findingId}`) as any;
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
