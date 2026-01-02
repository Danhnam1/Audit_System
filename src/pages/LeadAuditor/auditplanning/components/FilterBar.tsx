import React from 'react';

interface FilterBarProps {
  filterDepartment: string;
  sortDateOrder: string;
  filterStatus: string;
  searchQuery: string;
  departments: Array<{ deptId: number | string; name: string }>;
  onFilterDepartmentChange: (value: string) => void;
  onSortDateOrderChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterDepartment,
  sortDateOrder,
  filterStatus,
  searchQuery,
  departments,
  onFilterDepartmentChange,
  onSortDateOrderChange,
  onFilterStatusChange,
  onSearchQueryChange,
  onClearFilters,
  filteredCount: _filteredCount,
  totalCount: _totalCount,
}) => {
  return (
    <div className="bg-white p-4">
      {/* Search Bar */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search by title, objective, type, or scope..."
            className="w-full px-4 py-2.5 pl-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Department Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
          <select
            value={filterDepartment}
            onChange={(e) => onFilterDepartmentChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.deptId} value={dept.deptId}>
                {dept.name || dept.deptId}
              </option>
            ))}
          </select>
        </div>

        {/* Date Sort Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort by Date</label>
          <select
            value={sortDateOrder}
            onChange={(e) => onSortDateOrderChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Default</option>
            <option value="desc">Newest to Oldest</option>
            <option value="asc">Oldest to Newest</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="PendingReview">Pending Review</option>
            <option value="Draft">Draft</option>
            <option value="PendingDirectorApproval">Pending Director Approval</option>
            <option value="InProgress">In Progress</option>
            <option value="Approved">Approved</option>
            <option value="RejectedByDirector">Rejected by Director</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={onClearFilters}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
};

