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
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white ${
          isLead ? 'bg-primary-600' : 'bg-primary-400'
        }`}>
          {fullName.charAt(0).toUpperCase()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h4 className="text-base font-semibold text-gray-900">{fullName}</h4>
              {email && (
                <p className="text-sm text-gray-500 mt-0.5">{email}</p>
              )}
            </div>
            {isLead && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary-600 text-white shadow-sm">
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Lead Auditor
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {roleInTeam && !isLead && (
              <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                {roleInTeam}
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {auditTitle}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {period}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
