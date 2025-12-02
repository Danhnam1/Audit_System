import { useEffect, useMemo, useState } from 'react'
import { MainLayout } from '../../../layouts'
import { getAuditTeam } from '../../../api/auditTeam'
import { getAdminUsers } from '../../../api/adminUsers'
import { getDepartments } from '../../../api/departments'
import { getPlansWithDepartments } from '../../../services/auditPlanning.service'
import { TeamModal } from './components'
import { useAuth } from '../../../contexts'
import { Pagination } from '../../../components'

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
  const [from] = useState<string>('')
  const [to] = useState<string>('')
  const [role] = useState<string>('all')
  const [search] = useState<string>('')

  const [teams, setTeams] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 7

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

  const totalPages = Math.ceil(myAudits.length / itemsPerPage)

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [myAudits.length, totalPages, currentPage])

  const paginatedAudits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return myAudits.slice(startIndex, endIndex)
  }, [myAudits, currentPage])

  return (
    <MainLayout>
      <div className="px-6 py-6 space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">My Audit Plans</h1>
            <p className="text-gray-600 mt-1 text-sm">The inspection plans you are assigned to</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Plans List</h2>
          </div>
          
          <div className="p-6">
            {/* Loading/Error */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-600">Loading audit plans...</p>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Audit Plans List */}
            {!loading && !error && (
              myAudits.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">You have not been assigned to any audit plan yet.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {paginatedAudits.map((audit) => (
                    <div
                      key={audit.auditId}
                      className={`border-2 rounded-xl p-5 transition-all duration-200 ${
                        selectedAuditId === audit.auditId 
                          ? 'border-primary-500 bg-primary-50 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">{audit.title}</h3>
                          
                          {/* Info badges */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {audit.type}
                            </span>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              {audit.teamCount} members
                            </span>
                            {audit.startDate && audit.endDate && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(audit.startDate).toLocaleDateString()} - {new Date(audit.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Departments */}
                          {audit.departments && audit.departments.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">Departments:</p>
                              <div className="flex flex-wrap gap-2">
                                {audit.departments.map((dept: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium border border-primary-200"
                                  >
                                    {dept}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleViewTeam(audit.auditId)}
                          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors shadow-sm hover:shadow-md flex items-center gap-2 whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Team
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                  
                  {/* Pagination */}
                  {myAudits.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200 flex justify-center py-4">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </>
              )
            )}
          </div>
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
          if (audit.startDate && audit.endDate) {
            parts.push(
              `${new Date(audit.startDate).toLocaleDateString()} - ${new Date(audit.endDate).toLocaleDateString()}`
            )
          }
          return parts.join(' • ')
        })()}
        teamMembers={filtered}
        stats={stats}
        loading={loading}
        error={error || undefined}
      />
    </MainLayout>
  )
}