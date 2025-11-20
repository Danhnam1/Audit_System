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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Role</label>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All</option>
          <option value="lead">Lead</option>
          <option value="Auditor">Auditor</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs text-gray-600 mb-1">Search name / email</label>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          placeholder="Type to filter..."
        />
      </div>
    </div>
  );
};
