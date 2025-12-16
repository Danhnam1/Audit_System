import { apiClient } from '../hooks/axios'
import { unwrap } from '../utils/normalize'

export interface AuditTeamPayload {
  auditId: string
  userId: string
  roleInTeam: 'LeadAuditor' | 'Auditor' | 'AuditeeOwner' | string
  isLead: boolean
}

export const addTeamMember = async (payload: AuditTeamPayload) => {
  return apiClient.post('/AuditTeam', payload)
}

export const getAuditTeam = async () => {
  const res: any = await apiClient.get('/AuditTeam')
  const values = unwrap(res)
  return values
}

// Delete audit team member by ID
export const deleteTeamMember = async (id: string | number) => {
  return apiClient.delete(`/AuditTeam/${id}`)
}

// Get my lead auditor audits
export const getMyLeadAuditorAudits = async (): Promise<any> => {
  return apiClient.get('/AuditTeam/my-lead-auditor-audits') as any;
}

// Get auditors by audit ID
export const getAuditorsByAuditId = async (auditId: string): Promise<any> => {
  const res: any = await apiClient.get(`/AuditTeam/auditors/${auditId}`);
  const values = unwrap(res);
  return values;
}

// Get available team members (exclude previous period participants)
export interface GetAvailableMembersParams {
  auditId: string;
  excludePreviousPeriod?: boolean;
  previousPeriodStartDate?: string;
  previousPeriodEndDate?: string;
  // New params from updated Swagger: /api/AuditTeam/available-members?startDate=&endDate=
  startDate?: string;
  endDate?: string;
}

export const getAvailableTeamMembers = async (params: GetAvailableMembersParams): Promise<any> => {
  const {
    auditId,
    excludePreviousPeriod = false,
    previousPeriodStartDate,
    previousPeriodEndDate,
    startDate,
    endDate,
  } = params;
  
  let url = `/AuditTeam/available-members?auditId=${encodeURIComponent(auditId)}&excludePreviousPeriod=${excludePreviousPeriod}`;
  
  // Legacy params (still kept for backward compatibility)
  if (excludePreviousPeriod && previousPeriodStartDate && previousPeriodEndDate) {
    url += `&previousPeriodStartDate=${encodeURIComponent(previousPeriodStartDate)}&previousPeriodEndDate=${encodeURIComponent(previousPeriodEndDate)}`;
  }

  // New params preferred by Swagger: startDate / endDate
  if (startDate && endDate) {
    url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const res: any = await apiClient.get(url);
  const values = unwrap(res);
  return values;
}

// New endpoint: unified available auditors (filtered by previous periods)
export interface GetAvailableAuditorsParams {
  auditId?: string; // optional for new plan
  periodFrom?: string;
  periodTo?: string;
  excludePreviousPeriod?: true;
  // New params from updated Swagger; if not provided, we fallback to periodFrom/periodTo
  startDate?: string;
  endDate?: string;
}

export const getAvailableAuditors = async (params: GetAvailableAuditorsParams = {}): Promise<any[]> => {
  const {
    auditId = '',
    periodFrom,
    periodTo,
    excludePreviousPeriod = true,
    startDate,
    endDate,
  } = params;
  const query = new URLSearchParams();
  if (auditId) query.append('auditId', auditId);
  query.append('excludePreviousPeriod', String(excludePreviousPeriod));

  // Legacy params (still kept for backward compatibility)
  if (periodFrom) query.append('previousPeriodStartDate', periodFrom);
  if (periodTo) query.append('previousPeriodEndDate', periodTo);

  // New params preferred by Swagger
  const effectiveStart = startDate || periodFrom;
  const effectiveEnd = endDate || periodTo;
  if (effectiveStart) query.append('startDate', effectiveStart);
  if (effectiveEnd) query.append('endDate', effectiveEnd);

  const url = `/AuditTeam/available-members${query.toString() ? `?${query.toString()}` : ''}`;
  const res: any = await apiClient.get(url);
  const values: any = unwrap(res);
  if (Array.isArray(values)) return values;
  if (values?.$values && Array.isArray(values.$values)) return values.$values;
  return [];
};

export default { addTeamMember, getAuditTeam, deleteTeamMember, getMyLeadAuditorAudits, getAuditorsByAuditId, getAvailableTeamMembers, getAvailableAuditors }
