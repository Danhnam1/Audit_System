import apiClient from './client';

// Approve action at higher level (LeadAuditor)
export const approveActionHigherLevel = async (actionId: string, feedback?: string): Promise<void> => {
  await apiClient.put(`/ActionReview/${actionId}/approve/higher-level`, { feedback: feedback || '' }, {
    headers: { 'Content-Type': 'application/json' }
  });
};

// Reject action at higher level (LeadAuditor)
export const rejectActionHigherLevel = async (actionId: string, feedback: string): Promise<void> => {
  await apiClient.put(`/ActionReview/${actionId}/reject/higher-level`, { feedback }, {
    headers: { 'Content-Type': 'application/json' }
  });
};
