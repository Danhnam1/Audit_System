import { useEffect, useMemo, useState } from 'react'
import { MainLayout } from '../../../layouts'
import useAuthStore from '../../../store/useAuthStore'
import { getAuditTeam } from '../../../api/auditTeam'
import { getAdminUsers } from '../../../api/adminUsers'

export default function LeadTeamPage() {
  const { user } = useAuthStore()
  const layoutUser = user ? { name: user.fullName ?? 'User', avatar: undefined } : undefined
  const [teams, setTeams] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [t, u] = await Promise.all([getAuditTeam(), getAdminUsers()])
        setTeams(Array.isArray(t) ? t : [])
        setUsers(Array.isArray(u) ? u : [])
      } catch (e: any) {
        console.error('[LeadTeam] Load failed', e)
        setError(e?.message || 'Failed to load team information')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build quick lookup by userId
  const userById = useMemo(() => {
    const map = new Map<string, any>()
    users.forEach((u: any) => { if (u?.userId) map.set(String(u.userId), u) })
    return map
  }, [users])

  // Identify current user's id by email (fallback when userId not in Profile)
  const currentUserId = useMemo(() => {
    if (!user?.email) return undefined
    const found = users.find((u: any) => (u?.email || '').toLowerCase() === String(user.email).toLowerCase())
    return found?.userId
  }, [users, user])

  // Filter teams where current user is lead
  const myLeadTeams = useMemo(() => {
    if (!currentUserId) return []
    return teams.filter((m: any) => m?.isLead && String(m?.userId) === String(currentUserId))
  }, [teams, currentUserId])

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white rounded-xl shadow border border-primary-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-primary-700">My Audit Teams (Lead)</h1>
        </div>
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          myLeadTeams.length === 0 ? (
            <p className="text-sm text-gray-600">You are not assigned as lead for any audit yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Audit ID</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Lead</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myLeadTeams.map((leadMember: any, idx: number) => {
                    const auditId = leadMember?.auditId || '—'
                    // Collect all members of this audit
                    const members = teams.filter((m: any) => String(m?.auditId) === String(auditId))
                    const leadUser = userById.get(String(leadMember?.userId))
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-primary-700 font-medium">{auditId}</td>
                        <td className="px-4 py-2 text-sm">{leadUser ? `${leadUser.fullName} (${leadUser.email})` : leadMember?.userId}</td>
                        <td className="px-4 py-2 text-sm">
                          <div className="flex flex-wrap gap-2">
                            {members.filter((m: any) => !m?.isLead).map((m: any, i: number) => {
                              const u = userById.get(String(m?.userId))
                              const label = u ? `${u.fullName} (${u.email})` : m?.userId
                              const role = m?.roleInTeam || 'Auditor'
                              return (
                                <span key={i} className="px-2 py-1 bg-primary-50 border border-primary-200 rounded text-xs text-primary-800">{label} – {role}</span>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </MainLayout>
  )
}
