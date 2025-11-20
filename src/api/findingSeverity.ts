import apiClient from './client';
import { unwrap } from '../utils';

export interface FindingSeverity {
  $id?: string;
  id?: number;
  severityId?: number;
  name?: string;
  severity?: string; // API might return 'severity' instead of 'name'
  description?: string;
}

// Get all finding severities
export const getFindingSeverities = async (): Promise<FindingSeverity[]> => {
  const res = await apiClient.get('/FindingSeverity');
  const data = unwrap<FindingSeverity>(res.data);
  
  // Transform data to normalize field names
  return data.map(item => ({
    ...item,
    id: item.severityId || item.id || parseInt(item.$id || '0'),
    name: item.severity || item.name || 'Unknown',
  }));
};
