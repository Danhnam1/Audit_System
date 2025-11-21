import apiClient from './client';
import { unwrap } from '../utils';

export interface Action {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  assignedBy: string;
  assignedTo: string;
  assignedDeptId: number;
  status: string;
  progressPercent: number;
  dueDate: string;
  createdAt: string;
  closedAt: string | null;
  reviewFeedback: string | null;
}

// Get all actions for review
export const getActions = async (): Promise<Action[]> => {
  const res = await apiClient.get('/Action');
  const data = res.data !== undefined ? res.data : res;
  return unwrap<Action>(data);
};

export const getActionsForReview = async (): Promise<Action[]> => {
  console.log('📡 Calling GET /Action...');
  const res = await apiClient.get('/Action');
  console.log('📦 Raw response:', res);
  const data = res.data !== undefined ? res.data : res;
  console.log('📦 Data before unwrap:', data);
  const unwrapped = unwrap<Action>(data);
  console.log('📦 Unwrapped actions:', unwrapped);
  return unwrapped;
};

// Approve action
export const approveAction = async (actionId: string, feedback?: string): Promise<void> => {
  await apiClient.post(`/ActionReview/${actionId}/approve`, { feedback: feedback || '' }, {
    headers: { 'Content-Type': 'application/json' }
  });
};

// Reject/Return action for correction
export const rejectAction = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.post(`/ActionReview/${actionId}/returned`, { feedback }, {
    headers: { 'Content-Type': 'application/json' }
  });
};
