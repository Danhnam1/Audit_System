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

export default { addTeamMember, getAuditTeam, deleteTeamMember }
