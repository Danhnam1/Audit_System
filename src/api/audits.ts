import { apiClient } from '../hooks/axios';

export const createAudit = async (payload: any): Promise<any> => {
  // hooks/axios client returns response.data already
  return apiClient.post('/Audits', payload) as any;
};

export const addAuditScopeDepartment = async (auditId: string, deptId: number | string): Promise<any> => {
  return apiClient.post('/AuditScopeDepartment', {
    auditId,
    deptId,
  }) as any;
};

// Get all audit scope departments
export const getAuditScopeDepartments = async (): Promise<any> => {
  return apiClient.get('/AuditScopeDepartment') as any;
};

// Get all audit plans (list view)
export const getAuditPlans = async (): Promise<any> => {
  return apiClient.get('/Audits') as any;
};

// Get full audit plan details by ID
export const getAuditPlanById = async (auditId: string): Promise<any> => {
  try {
    // Try the full details endpoint first
    return await apiClient.get(`/AuditPlan/${auditId}`) as any;
  } catch (error) {
    // Fallback: Get from list and filter
    console.warn('AuditPlan endpoint failed, falling back to list filtering');
    const allPlans = await apiClient.get('/Audits') as any;
    // reuse unwrap helper to normalize $values/values wrappers
    const { unwrap } = await import('../utils/normalize');
    const plansArr = unwrap(allPlans);

    const plan = Array.isArray(plansArr) 
      ? plansArr.find((p: any) => p.auditId === auditId || p.id === auditId)
      : null;
    
    if (!plan) {
      throw new Error(`Plan with ID ${auditId} not found`);
    }
    
    return plan;
  }
};

// Update audit plan
export const updateAuditPlan = async (auditId: string, payload: any): Promise<any> => {
  return apiClient.put(`/Audits/${auditId}`, payload) as any;
};

// Delete audit plan
export const deleteAuditPlan = async (auditId: string): Promise<any> => {
  return apiClient.delete(`/Audits/${auditId}`) as any;
};

// Submit audit plan to Lead Auditor (change status from Draft -> Pending/ PendingReview)
export const submitToLeadAuditor = async (auditId: string): Promise<any> => {
  return apiClient.post(`/Audits/${auditId}/submit-to-lead-auditor`) as any;
};

// Reject plan content (Lead Auditor or Director can post a comment)
export const rejectPlanContent = async (auditId: string, payload: { comment?: string } = {}): Promise<any> => {
  // Ensure comment is always a string (sending empty string if undefined)
  // Include auditId in the body as some backends expect it there
  const body = { auditId, comment: payload.comment ?? '' };
  return apiClient.post(`/Audits/${auditId}/reject-plan-content`, body) as any;
};

// Approve plan (Director approves plan)
export const approvePlan = async (auditId: string, payload: { comment?: string } = {}): Promise<any> => {
  return apiClient.post(`/Audits/${auditId}/approve-plan`, payload) as any;
};

// Approve and forward to director (Lead Auditor forwards to Director)
export const approveForwardDirector = async (auditId: string, payload: { comment?: string } = {}): Promise<any> => {
  return apiClient.post(`/Audits/${auditId}/approve-forward-director`, payload) as any;
};

export default {
  createAudit,
  addAuditScopeDepartment,
  getAuditScopeDepartments,
  getAuditPlans,
  getAuditPlanById,
  updateAuditPlan,
  deleteAuditPlan,
};
