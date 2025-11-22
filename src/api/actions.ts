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
  title: string;
  description: string;
  assignedTo: string;
  assignedDeptId: number;
  progressPercent: number;
  dueDate: string;
  reviewFeedback?: string;
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
}

// Create a new action
export const createAction = async (dto: CreateActionDto): Promise<Action> => {
  const pascalDto = toPascalCase(dto);
  const res = await apiClient.post('/Action', pascalDto) as any;
  return res;
};

// Get actions by finding ID
export const getActionsByFinding = async (findingId: string): Promise<Action[]> => {
  const res = await apiClient.get(`/Action/finding/${findingId}`) as any;
  const { unwrap } = await import('../utils/normalize');
  return unwrap<Action>(res);
};

