import React from 'react';

interface TeamFilterBarProps {
  from: string;
  to: string;
  role: string;
  search: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  onRoleChange: (val: string) => void;
  onSearchChange: (val: string) => void;
}

export const TeamFilterBar: React.FC<TeamFilterBarProps> = ({
  from,
  to,
  role,
  search,
  onFromChange,
  onToChange,
  onRoleChange,
  onSearchChange,
}) => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">From Date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">To Date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
          >
            <option value="all">All Roles</option>
            <option value="lead">Lead Auditor</option>
            <option value="Auditor">Auditor</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Search</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Search by name or email..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
