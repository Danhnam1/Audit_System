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
}

export const getAvailableTeamMembers = async (params: GetAvailableMembersParams): Promise<any> => {
  const { auditId, excludePreviousPeriod = false, previousPeriodStartDate, previousPeriodEndDate } = params;
  
  let url = `/AuditTeam/available-members?auditId=${encodeURIComponent(auditId)}&excludePreviousPeriod=${excludePreviousPeriod}`;
  
  if (excludePreviousPeriod && previousPeriodStartDate && previousPeriodEndDate) {
    url += `&previousPeriodStartDate=${encodeURIComponent(previousPeriodStartDate)}&previousPeriodEndDate=${encodeURIComponent(previousPeriodEndDate)}`;
  }
  
  const res: any = await apiClient.get(url);
  const values = unwrap(res);
  return values;
}

export default { addTeamMember, getAuditTeam, deleteTeamMember, getMyLeadAuditorAudits, getAuditorsByAuditId, getAvailableTeamMembers }
