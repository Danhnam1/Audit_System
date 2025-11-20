import React from 'react';

interface TeamStatsProps {
  total: number;
  leadNames: string[];
  departmentList?: string[];
}

export const TeamStats: React.FC<TeamStatsProps> = ({
  total,
  leadNames,
  departmentList = [],
}) => {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-4">
        <span className="px-4 py-2 bg-primary-100 rounded-lg font-medium text-primary-700 text-sm">
          Total Members: <b className="text-lg">{total}</b>
        </span>
      </div>
      
      {leadNames.length > 0 && (
        <div className="px-4 py-3 bg-primary-50 rounded-lg border border-primary-200">
          <div className="text-sm font-medium text-primary-700 mb-2">
            Lead Auditors ({leadNames.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {leadNames.map((name, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-primary-700 border border-primary-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {departmentList.length > 0 && (
        <div className="px-4 py-3 bg-primary-50 rounded-lg border border-primary-200">
          <div className="text-sm font-medium text-primary-700 mb-2">
            Departments được kiểm định ({departmentList.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentList.map((dept, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-primary-700 border border-primary-300"
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
