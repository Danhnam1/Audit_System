import React from 'react';

interface FilterBarProps {
  filterDepartment: string;
  sortDateOrder: string;
  filterStatus: string;
  departments: Array<{ deptId: number | string; name: string }>;
  onFilterDepartmentChange: (value: string) => void;
  onSortDateOrderChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterDepartment,
  sortDateOrder,
  filterStatus,
  departments,
  onFilterDepartmentChange,
  onSortDateOrderChange,
  onFilterStatusChange,
  onClearFilters,
  filteredCount: _filteredCount,
  totalCount: _totalCount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 animate-slideInRight animate-delay-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Department Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
          <select
            value={filterDepartment}
            onChange={(e) => onFilterDepartmentChange(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sort by Date</label>
          <select
            value={sortDateOrder}
            onChange={(e) => onSortDateOrderChange(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
          >
            <option value="">Default</option>
            <option value="desc">Newest to Oldest</option>
            <option value="asc">Oldest to Newest</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="PendingReview">Pending Review</option>
            <option value="PendingDirectorApproval">Pending Director Approval</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
        <button
          onClick={onClearFilters}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
};
