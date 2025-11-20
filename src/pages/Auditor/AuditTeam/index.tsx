import { useEffect, useMemo, useState } from 'react'
import { MainLayout } from '../../../layouts'
import { getAuditTeam } from '../../../api/auditTeam'
import { getAdminUsers } from '../../../api/adminUsers'
import { getDepartments } from '../../../api/departments'
import { getPlansWithDepartments } from '../../../services/auditPlanning.service'
import { TeamModal } from './components'
import { useAuth } from '../../../contexts'

// Lightweight helpers
const overlap = (aStart?: string, aEnd?: string, bStart?: string, bEnd?: string) => {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  const a1 = new Date(aStart).getTime()
  const a2 = new Date(aEnd).getTime()
  const b1 = new Date(bStart).getTime()
  const b2 = new Date(bEnd).getTime()
  return a2 >= b1 && a1 <= b2
}

export default function AuditorTeamPage() {
  const { user } = useAuth()
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [role, setRole] = useState<string>('all')
  const [search, setSearch] = useState<string>('')

  const [teams, setTeams] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [tRes, aRes, uRes, dRes] = await Promise.all([
          getAuditTeam(),
          getPlansWithDepartments(), // This already includes scopeDepartments
          getAdminUsers(),
          getDepartments(),
        ])
        setTeams(Array.isArray(tRes) ? tRes : [])
        setAudits(Array.isArray(aRes) ? aRes : [])
        setUsers(Array.isArray(uRes) ? uRes : [])
        setDepartments(Array.isArray(dRes) ? dRes : [])
      } catch (e: any) {
        console.error('[AuditorTeam] Load failed', e)
        setError(e?.message || 'Failed to load team information')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const userById = useMemo(() => {
    const m = new Map<string, any>()
    users.forEach((u: any) => { if (u?.userId) m.set(String(u.userId), u) })
    return m
  }, [users])

  const auditById = useMemo(() => {
    const m = new Map<string, any>()
    audits.forEach((a: any) => { const id = String(a.auditId || a.id || '') ; if (id) m.set(id, a) })
    return m
  }, [audits])

  const deptById = useMemo(() => {
    const m = new Map<string, string>()
    departments.forEach((d: any) => {
      if (d?.deptId) m.set(String(d.deptId), d?.name || d?.code || `Dept ${d.deptId}`)
    })
    return m
  }, [departments])

  // Get current user's userId from users list by matching email
  const currentUserId = useMemo(() => {
    if (!user?.email) return null
    const found = users.find((u: any) => String(u?.email || '').toLowerCase() === String(user.email).toLowerCase())
    return found?.userId ? String(found.userId) : null
  }, [users, user])

  // Get audits where current user is assigned as team member
  const myAudits = useMemo(() => {
    if (!currentUserId) return []
    const auditIds = new Set<string>()
    teams.forEach((m: any) => {
      if (String(m?.userId) === currentUserId) {
        auditIds.add(String(m?.auditId || ''))
      }
    })
    // Map to full audit objects with team count and departments
    return Array.from(auditIds).map((auditId) => {
      const audit = auditById.get(auditId)
      const teamCount = teams.filter((m: any) => String(m?.auditId) === auditId).length
      
      // Get department names from scopeDepartments
      const scopeDepts = audit?.scopeDepartments || []
      const deptNames = scopeDepts
        .map((sd: any) => deptById.get(String(sd?.deptId || '')) || sd?.deptName)
        .filter(Boolean)
      
      return {
        auditId,
        title: audit?.title || `Audit ${auditId}`,
        type: audit?.type || 'N/A',
        status: audit?.status || 'Draft',
        startDate: audit?.startDate,
        endDate: audit?.endDate,
        teamCount,
        departments: deptNames,
      }
    })
  }, [teams, currentUserId, auditById, deptById])

  // Selected audit to view team in modal
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleViewTeam = (auditId: string) => {
    setSelectedAuditId(auditId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedAuditId(null)
  }

  const filtered = useMemo(() => {
    // First filter by selected audit or all user's audits
    let list = teams.filter((m: any) => {
      if (selectedAuditId) {
        return String(m?.auditId) === selectedAuditId
      }
      // Show all audits where user is member
      const myAuditIds = myAudits.map((a) => a.auditId)
      return myAuditIds.includes(String(m?.auditId || ''))
    })
    
    // Filter out AuditeeOwner role
    list = list.filter((m: any) => String(m?.roleInTeam || '').toLowerCase() !== 'auditeeowner')
    
    // Basic role/search filtering on team members
    if (role !== 'all') list = list.filter((m) => String(m?.roleInTeam).toLowerCase() === role.toLowerCase() || (role === 'lead' && m?.isLead))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => {
        const u = userById.get(String(m?.userId))
        const name = (u?.fullName || '').toLowerCase()
        const email = (u?.email || '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    }

    // Date-range overlap with audit plan period
    if (from && to) {
      list = list.filter((m) => {
        const auditId = String(m?.auditId || '')
        const a = auditById.get(auditId)
        if (!a) return false
        const aStart = a.startDate || a.periodFrom || a.fromDate
        const aEnd = a.endDate || a.periodTo || a.toDate
        return overlap(aStart, aEnd, from, to)
      })
    }

    // Enrich for UI
    return list.map((m) => {
      const auditId = String(m?.auditId || '')
      const a = auditById.get(auditId)
      const u = userById.get(String(m?.userId))
      return {
        ...m,
        auditId,
        auditTitle: a?.title || `Audit ${auditId}`,
        period: a?.startDate && a?.endDate ? `${new Date(a.startDate).toLocaleDateString()} - ${new Date(a.endDate).toLocaleDateString()}` : '—',
        fullName: u?.fullName || m?.fullName || m?.userId,
        email: u?.email,
      }
    })
  }, [teams, selectedAuditId, myAudits, role, search, from, to, userById, auditById])

  const stats = useMemo(() => {
    const leadNames: string[] = []
    const departments = new Set<string>()
    const audits = new Set<string>()
    
    filtered.forEach((m: any) => {
      if (m?.isLead) {
        leadNames.push(m?.fullName || m?.email || 'Unknown')
      }
      
      // Collect departments from audit
      const auditId = String(m?.auditId || '')
      audits.add(auditId)
      const audit = auditById.get(auditId)
      const scopeDepts = audit?.scopeDepartments || []
      scopeDepts.forEach((sd: any) => {
        const deptName = deptById.get(String(sd?.deptId || '')) || sd?.deptName
        if (deptName) departments.add(deptName)
      })
    })
    
    return { 
      total: filtered.length, 
      leadNames,
      departmentList: Array.from(departments),
    }
  }, [filtered, auditById, deptById])

  return (
    <MainLayout>
      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-primary-700">My Audit Plans</h1>
              <p className="text-gray-600 text-sm">The inspection plans you are assigned to</p>
            </div>
          </div>

          {/* Loading/Error */}
          {loading && <p className="text-sm text-gray-500">Loading...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Audit Plans List */}
          {!loading && !error && (
            myAudits.length === 0 ? (
              <p className="text-sm text-gray-600">Bạn chưa được phân công vào kế hoạch kiểm định nào.</p>
            ) : (
              <div className="space-y-3">
                {myAudits.map((audit) => (
                  <div
                    key={audit.auditId}
                    className={`border rounded-lg p-4 flex items-center justify-between hover:shadow transition ${
                      selectedAuditId === audit.auditId ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{audit.title}</h3>
                      <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-600">
                        <span>Type: {audit.type}</span>
                        <span>Status: {audit.status}</span>
                        <span>Team: {audit.teamCount} members</span>
                        {audit.startDate && audit.endDate && (
                          <span>
                            {new Date(audit.startDate).toLocaleDateString()} - {new Date(audit.endDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {audit.departments && audit.departments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {audit.departments.map((dept: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleViewTeam(audit.auditId)}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm font-medium"
                    >
                      View Team
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Team Modal */}
      <TeamModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        auditTitle={
          myAudits.find((a) => a.auditId === selectedAuditId)?.title || 'Audit Plan'
        }
        auditInfo={(() => {
          const audit = myAudits.find((a) => a.auditId === selectedAuditId)
          if (!audit) return ''
          const parts = []
          if (audit.type) parts.push(`Type: ${audit.type}`)
          if (audit.status) parts.push(`Status: ${audit.status}`)
          if (audit.startDate && audit.endDate) {
            parts.push(
              `${new Date(audit.startDate).toLocaleDateString()} - ${new Date(audit.endDate).toLocaleDateString()}`
            )
          }
          return parts.join(' • ')
        })()}
        from={from}
        to={to}
        role={role}
        search={search}
        onFromChange={setFrom}
        onToChange={setTo}
        onRoleChange={setRole}
        onSearchChange={setSearch}
        teamMembers={filtered}
        stats={stats}
        loading={loading}
        error={error || undefined}
      />
    </MainLayout>
  )
}