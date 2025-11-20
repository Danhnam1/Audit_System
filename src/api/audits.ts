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

// Charts: findings by month (line), severity distribution (pie), by department (bar)
export const getAuditChartLine = async (auditId: string): Promise<any> => {
  return apiClient.get(`/Audits/${auditId}/chart/line`) as any;
};

export const getAuditChartPie = async (auditId: string): Promise<any> => {
  return apiClient.get(`/Audits/${auditId}/chart/pie`) as any;
};

export const getAuditChartBar = async (auditId: string): Promise<any> => {
  return apiClient.get(`/Audits/${auditId}/chart/bar`) as any;
};

// Summary of findings for an audit
export const getAuditSummary = async (auditId: string): Promise<any> => {
  return apiClient.get(`/Audits/Summary/${auditId}`) as any;
};

// Export dashboard/report PDF for an audit
export const exportAuditPdf = async (auditId: string): Promise<Blob> => {
  // Ensure we receive a Blob
  return apiClient.get(`/Audits/ExportPdf/${auditId}`, { responseType: 'blob' } as any) as any;
};

// Submit audit to Lead Auditor
export const submitAudit = async (auditId: string): Promise<any> => {
  return apiClient.post(`/Audits/Submit/${auditId}`) as any;
};

// Approve audit report (Lead Auditor action)
// New canonical endpoint per Swagger: /api/AuditReports/{auditId}/approve
export const approveAuditReport = async (auditId: string): Promise<any> => {
  return apiClient.post(`/AuditReports/${auditId}/approve`) as any;
};

// Reject audit report (Lead Auditor action)
// New canonical endpoint per Swagger: /api/AuditReports/{auditId}/reject
export const rejectAuditReport = async (
  auditId: string,
  payload: { reason?: string; comment?: string } = {}
): Promise<any> => {
  const reason = payload.reason ?? payload.comment ?? '';
  try {
    // Primary (per Swagger): PUT with { reason }
    return await apiClient.put(`/AuditReports/${auditId}/reject`, { reason }) as any;
  } catch (err) {
    // Fallback (legacy): POST with { auditId, comment }
    try {
      return await apiClient.post(`/AuditReports/${auditId}/reject`, { auditId, comment: reason }) as any;
    } catch (err2) {
      throw err2;
    }
  }
};

export const getAuditReportNote = async (auditId: string): Promise<string> => {
  if (!auditId) return '';
  const url = `/AuditReports/Note/${encodeURIComponent(auditId)}`;
  const res = await apiClient.get(url) as any;
  const data = res?.data ?? res;
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    return String(data.note ?? data.reason ?? data.comment ?? data.message ?? '');
  }
  return String(data);
};

// Backwards compatibility (will be deprecated)
export const approveAudit = approveAuditReport;
export const rejectAudit = rejectAuditReport;

export default {
  createAudit,
  addAuditScopeDepartment,
  getAuditScopeDepartments,
  getAuditPlans,
  getAuditPlanById,
  updateAuditPlan,
  deleteAuditPlan,
  getAuditChartLine,
  getAuditChartPie,
  getAuditChartBar,
  getAuditSummary,
  exportAuditPdf,
  submitAudit,
  approveAuditReport,
  rejectAuditReport,
  getAuditReportNote,
  // legacy names
  approveAudit,
  rejectAudit,
};
