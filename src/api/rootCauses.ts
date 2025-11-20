import apiClient from './client';
import { unwrap } from '../utils';

export interface RootCause {
  rootCauseId: number;
  name: string;
  description?: string;
}

export interface CreateRootCauseDto {
  name: string;
  description: string;
  status: string;
  category: string;
}

// Get all root causes
export const getRootCauses = async (): Promise<RootCause[]> => {
  const res = await apiClient.get('/RootCauses');
  return unwrap<RootCause>(res.data);
};

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

// Create new root cause
export const createRootCause = async (dto: CreateRootCauseDto): Promise<RootCause> => {
  const pascalDto = toPascalCase(dto);
  console.log('Creating root cause with PascalCase:', pascalDto);
  const res = await apiClient.post('/RootCauses', pascalDto);
  return res.data;
};
