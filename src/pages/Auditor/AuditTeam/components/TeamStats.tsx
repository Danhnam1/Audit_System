import React from 'react';

interface TeamStatsProps {
  total: number;
  departmentList?: string[];
}

export const TeamStats: React.FC<TeamStatsProps> = ({
  total,
  departmentList = [],
}) => {
  return (
    <div className="space-y-4 mb-4">
      {/* Total Members Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-primary-100 text-sm font-medium">Total Team Members</p>
              <p className="text-white text-3xl font-bold">{total}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Lead Auditors */}
      {/*  */}
      
      {/* Departments */}
      {departmentList.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              Departments <span className="text-primary-600">({departmentList.length})</span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentList.map((dept, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1.5 bg-primary-50 rounded-lg text-sm font-medium text-primary-700 border border-primary-200"
              >
                {dept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
