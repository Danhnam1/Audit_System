import React from 'react'
import { TeamMemberCard } from './TeamMemberCard'
import { TeamStats } from './TeamStats'

interface TeamModalProps {
  isOpen: boolean
  onClose: () => void
  auditTitle: string
  auditInfo: string
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
          <div className="bg-gradient-primary px-6 py-5 flex items-center justify-between shadow-lg">
            <div>
              <h2 className="text-xl font-bold text-white">{auditTitle}</h2>
              <p className="text-sm text-primary-100 mt-1">{auditInfo}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Stats */}
            <TeamStats
              total={stats.total}
              departmentList={stats.departmentList}
            />

            {/* Content */}
            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && (
              teamMembers.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">
                  No team members match the selected filters.
                </p>
              ) : (
                <div className="space-y-3">
                  {teamMembers
                    .sort((a: any, b: any) => {
                      // Lead auditors first
                      if (a.isLead && !b.isLead) return -1
                      if (!a.isLead && b.isLead) return 1
                      // Then sort by name
                      return (a.fullName || '').localeCompare(b.fullName || '')
                    })
                    .map((m: any, idx: number) => (
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
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
