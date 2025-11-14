import { apiClient } from '../hooks/axios';

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
  source: string;
  externalAuditorName: string; // Required by API
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
  console.log('API createFinding sending:', payload);
  // Try without dto wrapper first
  return apiClient.post('/Findings', payload) as any;
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
