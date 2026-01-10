import { apiClient } from '../hooks/axios';

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

export interface CreateActionDto {
  findingId: string;
  title?: string | null;
  description: string;
  assignedBy?: string | null;
  assignedTo?: string | null;
  assignedDeptId: number;
  progressPercent: number;
  dueDate: string;
  reviewFeedback?: string | null;
  rootCauseId?: string | null; // Link to root cause (GUID string, not number)
  closedAt?: string | null;
}

export interface Action {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  assignedBy?: string;
  assignedTo: string;
  assignedDeptId: number;
  status: string;
  progressPercent: number;
  dueDate?: string;
  createdAt?: string;
  closedAt?: string | null;
  reviewFeedback?: string | null;
  rootCauseId?: number; // Link to root cause
}

// Create a new action
export const createAction = async (dto: CreateActionDto): Promise<Action> => {
  // Remove null/undefined optional fields to avoid backend validation errors
  const cleanDto: any = {
    findingId: dto.findingId,
    description: dto.description,
    assignedDeptId: dto.assignedDeptId,
    progressPercent: dto.progressPercent ?? 0,
    dueDate: dto.dueDate,
  };
  
  // Only include optional fields if they have valid values
  if (dto.title) cleanDto.title = dto.title;
  if (dto.assignedBy) cleanDto.assignedBy = dto.assignedBy;
  // Only include assignedTo if it's a non-empty string (valid GUID)
  if (dto.assignedTo && dto.assignedTo.trim() !== '') cleanDto.assignedTo = dto.assignedTo;
  if (dto.rootCauseId) cleanDto.rootCauseId = dto.rootCauseId;
  // ReviewFeedback is required by backend - always include it (empty string if not provided)
  cleanDto.reviewFeedback = dto.reviewFeedback || '';
  if (dto.closedAt) cleanDto.closedAt = dto.closedAt;
  
  const pascalDto = toPascalCase(cleanDto);
  console.log('POST /Action cleaned payload:', pascalDto);
  const res = await apiClient.post('/Action', pascalDto) as any;
  return res;
};

// Get actions by finding ID
export const getActionsByFinding1 = async (findingId: string): Promise<Action[]> => {
  const res = await apiClient.get(`/Action/finding/${findingId}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};
// Get actions by finding ID
export const getActionsByFinding = async (findingId: string): Promise<Action[]> => {
    const res = await apiClient.get(`/Action/by-finding/${findingId}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};

// Get my assigned actions
export const getMyAssignedActions = async (): Promise<Action[]> => {
  const res = await apiClient.get('/Action/my-assigned') as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};

// Get actions by assigned department ID
export const getActionsByAssignedDept = async (deptId: number): Promise<Action[]> => {
  const res = await apiClient.get(`/Action/by-assigned-dept/${deptId}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};

// Get action by ID
export const getActionById = async (actionId: string): Promise<Action> => {
  const res = await apiClient.get(`/Action/${actionId}`);
  // API returns the object directly, not wrapped in data
  return (res.data || res) as Action;
};

// Update action status to in-progress
export const updateActionStatusInProgress = async (actionId: string): Promise<void> => {
  await apiClient.post(`/Action/${actionId}/status/in-progress`);
};

// Update action progress percent
export const updateActionProgressPercent = async (actionId: string, progressPercent: number): Promise<void> => {
  const payload = { progressPercent };
  const pascalPayload = toPascalCase(payload);
  await apiClient.put(`/Action/${actionId}/progress-percent`, pascalPayload);
};

// Update action status to reviewed
export const updateActionStatusReviewed = async (actionId: string): Promise<void> => {
  await apiClient.post(`/Action/${actionId}/status/reviewed`);
};


// Approve action (Auditee Owner) with feedback (new API)
// Approve action (AuditeeOwner verifies action)
// NOTE: Backend should only approve attachments with status "Open", not all attachments
export const approveActionWithFeedback = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.post(`/ActionReview/${actionId}/verified`, { Feedback: feedback });
};

// Reject action (Auditee Owner) with feedback
export const rejectAction = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.post(`/Action/${actionId}/status/rejected`, { feedback: feedback });
};

// Reject action (resubmit) - for returned actions
export const rejectActionForResubmit = async (actionId: string): Promise<void> => {
  await apiClient.put(`/Action/${actionId}/reject`);
};

// Get actions by department for dashboard (AuditDashboard API)
export const getActionsByDepartmentDashboard = async (deptId: number): Promise<Action[]> => {
  const res = await apiClient.get(`/AuditDashboard/department/${deptId}/actions`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};

// Get actions by root cause ID
export const getActionsByRootCause = async (rootCauseId: number): Promise<Action[]> => {
  try {
    const res = await apiClient.get(`/Action/by-root-cause/${rootCauseId}`) as any;
    const { unwrap } = await import('../utils/normalize');
    return unwrap<Action>(res);
  } catch (err) {
    console.error('Error fetching actions by root cause:', err);
    return [];
  }
};

// Update action (generic put)
export const updateAction = async (
  actionId: string,
  payload: Partial<{
    title: string;
    description: string;
    status: string;
    progressPercent: number;
    dueDate: string;
    assignedTo: string;
    assignedDeptId: number;
  }>
): Promise<void> => {
  const pascalPayload = toPascalCase(payload);
  await apiClient.put(`/Action/${actionId}`, pascalPayload);
};
