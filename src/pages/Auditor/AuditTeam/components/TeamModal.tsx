import React from 'react'
import { TeamFilterBar } from './TeamFilterBar'
import { TeamMemberCard } from './TeamMemberCard'
import { TeamStats } from './TeamStats'

interface TeamModalProps {
  isOpen: boolean
  onClose: () => void
  auditTitle: string
  auditInfo: string
  // Filters
  from: string
  to: string
  role: string
  search: string
  onFromChange: (val: string) => void
  onToChange: (val: string) => void
  onRoleChange: (val: string) => void
  onSearchChange: (val: string) => void
  // Data
  teamMembers: any[]
  stats: {
    total: number
    leadNames: string[]
    departmentList?: string[]
  }
  loading?: boolean
  error?: string
}

export const TeamModal: React.FC<TeamModalProps> = ({
  isOpen,
  onClose,
  auditTitle,
  auditInfo,
  from,
  to,
  role,
  search,
  onFromChange,
  onToChange,
  onRoleChange,
  onSearchChange,
  teamMembers,
  stats,
  loading,
  error,
}) => {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[30] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[35] overflow-y-auto flex items-center justify-center p-4 pt-20">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-primary-50">
            <div>
              <h2 className="text-xl font-semibold text-primary-700">{auditTitle}</h2>
              <p className="text-sm text-gray-600 mt-1">{auditInfo}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Filters */}
            <TeamFilterBar
              from={from}
              to={to}
              role={role}
              search={search}
              onFromChange={onFromChange}
              onToChange={onToChange}
              onRoleChange={onRoleChange}
              onSearchChange={onSearchChange}
            />

            {/* Stats */}
            <TeamStats
              total={stats.total}
              leadNames={stats.leadNames}
              departmentList={stats.departmentList}
            />

            {/* Content */}
            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && (
              teamMembers.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">
                  Không có thành viên nào phù hợp với bộ lọc.
                </p>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((m: any, idx: number) => (
                    <TeamMemberCard
                      key={idx}
                      fullName={m.fullName}
                      email={m.email}
                      roleInTeam={m.roleInTeam}
                      isLead={m.isLead}
                      auditTitle={m.auditTitle}
                      period={m.period}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
