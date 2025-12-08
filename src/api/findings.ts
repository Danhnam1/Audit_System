import { apiClient } from '../hooks/axios';
import { unwrap } from '../utils';

// Helper function to convert camelCase to PascalCase
const toPascalCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPascalCase);
  if (typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    const value = obj[key];
    // Preserve null values for optional fields, but convert empty strings and 0
    acc[pascalKey] = toPascalCase(value);
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
  rootCauseId: number | null; // Can be null
  deptId: number;
  status: string;
  deadline: string;
  reviewerId: string | null; // GUID or null
  source?: string; // Optional
  externalAuditorName?: string | null; // Optional, can be null
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
  witnessId?: string;
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

// Get findings by department ID
export const getFindingsByDepartment = async (deptId: number): Promise<Finding[]> => {
  const res = await apiClient.get(`/Findings/by-department/${deptId}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Finding>(res);
};

// Get findings by creator ID (for Auditor to see their own findings)
export const getFindingsByCreator = async (createdBy: string): Promise<Finding[]> => {
  const res = await apiClient.get(`/Findings/by-created-by/${createdBy}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Finding>(res);
};

// Get my findings (for Auditor to see their own findings)
export const getMyFindings = async (): Promise<Finding[]> => {
  const res = await apiClient.get(`/Findings/my-findings`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Finding>(res);
};

// Get finding by ID
export const getFindingById = async (findingId: string): Promise<Finding> => {
  return apiClient.get(`/Findings/${findingId}`) as any;
};

// Mark finding as received
export const markFindingAsReceived = async (findingId: string): Promise<any> => {
  return apiClient.put(`/Findings/${findingId}/received`) as any;
};

// Create a new finding
export const createFinding = async (payload: CreateFindingPayload): Promise<Finding> => {
  console.log('4. createFinding API - Received (camelCase):', JSON.stringify(payload, null, 2));
  
  // Convert to PascalCase for .NET API
  const pascalPayload = toPascalCase(payload);
  console.log('5. createFinding API - After PascalCase transform:', JSON.stringify(pascalPayload, null, 2));
  
  // Handle null values - backend accepts null for rootCauseId and reviewerId
  const finalPayload: any = { ...pascalPayload };
  // Ensure string fields are not null (convert to empty string)
  if (finalPayload.ExternalAuditorName === null || finalPayload.ExternalAuditorName === undefined) {
    finalPayload.ExternalAuditorName = '';
  }
  if (finalPayload.Source === null || finalPayload.Source === undefined) {
    finalPayload.Source = '';
  }
  // Keep null for RootCauseId and ReviewerId as backend accepts them
  
  console.log('6. Final payload to send:', JSON.stringify(finalPayload, null, 2));
  console.log('7. Sending POST to /Findings...');
  
  try {
    const result = await apiClient.post('/Findings', finalPayload) as any;
    console.log('8. API Response received:', result);
    return result;
  } catch (error: any) {
    console.error('========== API ERROR ==========');
    console.error('Error response:', error?.response);
    console.error('Error data:', error?.response?.data);
    console.error('Error status:', error?.response?.status);
    console.error('Error message:', error?.message);
    console.error('Full error:', error);
    
    // Try to extract more detailed error message
    const errorData = error?.response?.data;
    let errorMessage = errorData?.title || errorData?.message || error?.message || 'Unknown error';
    
    // Extract validation errors if available
    if (errorData?.errors && typeof errorData.errors === 'object') {
      const validationErrors: string[] = [];
      Object.keys(errorData.errors).forEach(key => {
        const fieldErrors = errorData.errors[key];
        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err: string) => {
            validationErrors.push(`${key}: ${err}`);
          });
        } else if (typeof fieldErrors === 'string') {
          validationErrors.push(`${key}: ${fieldErrors}`);
        }
      });
      
      if (validationErrors.length > 0) {
        errorMessage = `Validation Errors:\n${validationErrors.join('\n')}`;
        console.error('Validation errors:', validationErrors);
      }
    }
    
    console.error('Extracted error message:', errorMessage);
    console.error('Full error data:', errorData);
    throw new Error(errorMessage);
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

// Approve action (Auditor reviews action and approves)
export const approveFindingAction = async (actionId: string, feedback?: string): Promise<void> => {
  await apiClient.post(`/ActionReview/${actionId}/approve`, {
    Feedback: feedback || ''
  });
};

export const approveFindingActionHigherLevel = async (actionId: string, feedback?: string): Promise<void> => {
  await apiClient.put(`/ActionReview/${actionId}/approve/higher-level`, {
    feedback: feedback || '',
  });
};
export const getFindingsByAudit = async (auditId: string): Promise<any[]> => {
  // apiClient interceptor returns res.data, but unwrap supports either shape
  const res: any = await apiClient.get(`/Findings/by-audit/${auditId}`);
  return unwrap(res);
};

// Return action (Auditor returns action for revision)
export const returnFindingAction = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.post(`/ActionReview/${actionId}/returned`, {
    Feedback: feedback
  });
};

export const rejectFindingActionHigherLevel = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.put(`/ActionReview/${actionId}/reject/higher-level`, {
    feedback: feedback,
  });
};

export default {
  getFindings,
  getFindingById,
  getFindingsByDepartment,
  getFindingsByCreator,
  createFinding,
  updateFinding,
  deleteFinding,
  markFindingAsReceived,
  approveFindingAction,
  approveFindingActionHigherLevel,
  returnFindingAction,
  rejectFindingActionHigherLevel,
};
