import React from 'react';

interface TeamMemberCardProps {
  fullName: string;
  email?: string;
  roleInTeam?: string;
  isLead?: boolean;
  auditTitle: string;
  period: string;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  fullName,
  email,
  roleInTeam,
  isLead,
  auditTitle,
  period,
}) => {
  return (
    <div className="flex items-start justify-between bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2">
        <span className="text-primary-500 mt-1">•</span>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {fullName}{' '}
            {email && <span className="text-gray-500 font-normal">({email})</span>}
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            {roleInTeam && (
              <span className="px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded text-xs">
                {roleInTeam}
              </span>
            )}
            {isLead && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">
                Lead
              </span>
            )}
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
              Audit: {auditTitle}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
              {period}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
