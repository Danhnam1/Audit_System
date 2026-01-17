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

// Get audit scope departments by audit ID
export const getAuditScopeDepartmentsByAuditId = async (auditId: string): Promise<any> => {
  return apiClient.get(`/AuditScopeDepartment/departments/${auditId}`) as any;
};

// Sensitive flag APIs
export interface SensitiveFlagDto {
  sensitiveFlag: boolean;
  areas?: string[];
  notes?: string;
}

export interface SensitiveScopeDepartment {
  scopeDeptId: number;
  auditId: string;
  deptId: number;
  sensitiveFlag: boolean;
  areas?: string[];
  notes?: string;
}

// Set sensitive flag for a scope department
export const setSensitiveFlag = async (
  scopeDeptId: string | number, // Accept both string (GUID) and number for flexibility
  dto: SensitiveFlagDto
): Promise<SensitiveScopeDepartment> => {
  // Convert to string (GUID format expected by backend)
  const scopeDeptIdStr = String(scopeDeptId);
  const res: any = await apiClient.post(`/AuditScopeDepartment/${scopeDeptIdStr}/sensitive`, dto);
  return res?.data || res;
};

// Get sensitive departments for an audit
export const getSensitiveDepartments = async (auditId: string): Promise<SensitiveScopeDepartment[]> => {
  const res: any = await apiClient.get(`/AuditScopeDepartment/${auditId}/sensitive`);
  
  // Handle $values structure
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Update audit scope department by ID
export const updateAuditScopeDepartment = async (
  id: string | number,
  payload: {
    deptId?: number;
    status?: string;
    sensitiveFlag?: boolean;
    areas?: string;
    departmentSensitiveAreaIds?: string[];
  }
): Promise<any> => {
  return apiClient.put(`/AuditScopeDepartment/${id}`, payload) as any;
};

// Delete audit scope department by ID
export const deleteAuditScopeDepartment = async (id: string | number): Promise<any> => {
  return apiClient.delete(`/AuditScopeDepartment/${id}`) as any;
};

// Get all audit plans (list view)
export const getAuditPlans = async (): Promise<any> => {
  return apiClient.get('/Audits') as any;
};

// Get all audit reports (for Lead Auditor)
export const getAuditReports = async (): Promise<any> => {
  return apiClient.get('/AuditReports') as any;
};

// Get full audit plan details by ID
export const getAuditPlanById = async (auditId: string): Promise<any> => {
  try {
    // Try the full details endpoint first
    return await apiClient.get(`/AuditPlan/${auditId}`) as any;
  } catch (error) {
    // Fallback: Get from list and filter
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

// Update audit plan (basic - only audit fields)
export const updateAuditPlan = async (auditId: string, payload: any): Promise<any> => {
  return apiClient.put(`/Audits/${auditId}`, payload) as any;
};

// Update audit plan with full relationships (uses /AuditPlan/{auditId} endpoint)
export const updateAuditPlanFull = async (auditId: string, payload: any): Promise<any> => {
  return apiClient.put(`/AuditPlan/${auditId}`, payload) as any;
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
export const declinedPlanContent = async (auditId: string, payload: { comment?: string } = {}): Promise<any> => {
  // Ensure comment is always a string (sending empty string if undefined)

  const body = { auditId, comment: payload.comment ?? '' };
  return apiClient.post(`/Audits/${auditId}/declined-plan-content`, body) as any;
};

// Approve plan (Director approves plan)
export const approvePlan = async (auditId: string, payload: { comment?: string } = {}): Promise<any> => {
  // Always send a body with auditId + (optional) comment so backend can log approval notes
  const body = { auditId, comment: payload.comment ?? '' };
  return apiClient.post(`/Audits/${auditId}/approve-plan`, body) as any;
};

// Approve and forward to director (Lead Auditor forwards to Director)
export const approveForwardDirector = async (
  auditId: string,
  payload: { comment?: string } = {}
): Promise<any> => {
  // For Lead Auditor approve, we auto-send an empty comment unless caller provides one
  const body = { auditId, comment: payload.comment ?? '' };
  return apiClient.post(`/Audits/${auditId}/approve-forward-director`, body) as any;
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

// Get severity summary for a specific department in an audit
// Swagger: GET /api/Audits/{auditId}/departments/{departmentId}/severity-summary
export const getDepartmentSeveritySummary = async (auditId: string, departmentId: number | string): Promise<any> => {
  if (!auditId) {
    throw new Error('auditId is required to load department severity summary');
  }
  if (!departmentId && departmentId !== 0) {
    throw new Error('departmentId is required to load department severity summary');
  }
  return apiClient.get(`/Audits/${encodeURIComponent(auditId)}/departments/${encodeURIComponent(departmentId)}/severity-summary`) as any;
};

// Summary of findings for an audit
export const getAuditSummary = async (auditId: string): Promise<any> => {
  return apiClient.get(`/Audits/Summary/${auditId}`) as any;
};

// Findings & actions summary used for effectiveness evaluation
// Swagger: GET /api/Audits/findings-actions-summary/{auditId}
export const getAuditFindingsActionsSummary = async (auditId: string): Promise<any> => {
  if (!auditId) {
    throw new Error('auditId is required to load findings & actions summary');
  }
  return apiClient.get(`/Audits/findings-actions-summary/${encodeURIComponent(auditId)}`) as any;
};

// Full audit detail (plan, scope, findings, actions, documents...) for Stream 5
export const getAuditFullDetail = async (auditId: string): Promise<any> => {
  if (!auditId) {
    throw new Error('auditId is required to load full audit detail');
  }

  // Swagger: GET /api/Audits/{id}/full-detail
  const res: any = await apiClient.get(`/Audits/${encodeURIComponent(auditId)}/full-detail`);
  // hooks/axios usually returns response.data already, keep both for safety
  return res?.data ?? res;
};

// Audit approvals history (used to show latest reject/approve comments to Auditor)
export const getAuditApprovals = async (): Promise<any> => {
  // Backend returns a collection with $values; use unwrap() on the caller side
  return apiClient.get('/AuditApproval') as any;
};

// Export dashboard/report PDF for an audit
export const exportAuditPdf = async (auditId: string): Promise<Blob> => {
  // Ensure we receive a Blob
  return apiClient.get(`/Audits/ExportPdf/${auditId}`, { responseType: 'blob' } as any) as any;
};

// Submit audit REPORT to Lead Auditor (creates ReportRequest with status "Pending")
// This API generates PDF and creates a ReportRequest record
export const submitAudit = async (auditId: string): Promise<any> => {
  return apiClient.post(`/Audits/Submit/${auditId}`) as any;
};

// Approve audit report (Lead Auditor action)
export const approveAuditReport = async (auditId: string): Promise<any> => {
  return apiClient.post(`/AuditReports/${auditId}/approve`, {}) as any;
};

// Reject audit report (Lead Auditor action)
export const rejectAuditReport = async (
  auditId: string,
  payload: { note?: string; reason?: string; comment?: string } = {}
): Promise<any> => {
  // Priority: note > reason > comment
  const note = payload.note ?? payload.reason ?? payload.comment ?? '';
  try {
    // Primary (per Swagger): PUT with { note }
    return await apiClient.put(`/AuditReports/${auditId}/reject`, { note }) as any;
  } catch (err) {
    // Fallback (legacy): POST with { auditId, comment }
    try {
      return await apiClient.post(`/AuditReports/${auditId}/reject`, { auditId, comment: note }) as any;
    } catch (err2) {
      throw err2;
    }
  }
};

export const getAuditReportNote = async (auditId: string): Promise<string> => {
  if (!auditId) {
    return '';
  }
  
  const url = `/AuditReports/Note/${encodeURIComponent(auditId)}`;
  
  
  try {
  const res = await apiClient.get(url) as any;
    
    
    
  const data = res?.data ?? res;
    if (data == null) {
      
      return '';
    }
    
    if (typeof data === 'string') {
      
      return data;
    }
    
  if (typeof data === 'object') {
      // Backend returns { Reason: note } (capital R), so check both cases
      const note = String(
        data.Reason ?? // Backend returns Reason (capital R)
        data.reason ?? // Fallback lowercase
        data.Note ??   // Alternative capital N
        data.note ??   // Fallback lowercase
        data.comment ?? 
        data.Comment ??
        data.message ?? 
        data.Message ??
        ''
      );
      
      
      
      return note;
    }
    
    return String(data);
  } catch (error: any) {
    
    throw error;
  }
};

// Archive audit
export const archiveAudit = async (auditId: string): Promise<any> => {
  return apiClient.put(`/Audits/archive/${auditId}`) as any;
};

// Business Rules APIs

// Get audits by period
export const getAuditsByPeriod = async (startDate: string, endDate: string): Promise<any> => {
  return apiClient.get(`/Audits/by-period?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`) as any;
};

// Validate department uniqueness
export interface ValidateDepartmentRequest {
  auditId?: string | null;
  departmentIds: number[];
  startDate: string;
  endDate: string;
}

export interface ValidateDepartmentResponse {
  isValid: boolean;
  conflictingDepartments: number[];
  conflictingAudits?: Array<{
    auditId: string;
    title: string;
    departments: number[];
  }>;
}

export const validateDepartment = async (request: ValidateDepartmentRequest): Promise<ValidateDepartmentResponse> => {
  return apiClient.post('/Audits/validate-department', request) as any;
};

// Get period status
export interface PeriodStatusResponse {
  isExpired: boolean;
  isActive: boolean;
  canAssignNewPlans: boolean;
  currentAuditCount: number;
  maxAuditsAllowed: number;
  remainingSlots: number;
}

export const getPeriodStatus = async (startDate: string, endDate: string): Promise<PeriodStatusResponse> => {
  return apiClient.get(`/Audits/period-status?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`) as any;
};

// Backwards compatibility (will be deprecated)
export const approveAudit = approveAuditReport;
export const rejectAudit = rejectAuditReport;

export default {
  createAudit,
  addAuditScopeDepartment,
  getAuditScopeDepartments,
  getAuditPlans,
  getAuditReports,
  getAuditPlanById,
  updateAuditPlan,
  updateAuditPlanFull,
  updateAuditScopeDepartment,
  deleteAuditPlan,
  getAuditChartLine,
  getAuditChartPie,
  getAuditChartBar,
  getDepartmentSeveritySummary,
  getAuditSummary,
  getAuditFullDetail,
  exportAuditPdf,
  submitAudit,
  approveAuditReport,
  rejectAuditReport,
  getAuditReportNote,
  archiveAudit,
  // legacy names
  approveAudit,
  rejectAudit,
};
