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
  filterStatus: _filterStatus,
  departments,
  onFilterDepartmentChange,
  onSortDateOrderChange,
  onFilterStatusChange: _onFilterStatusChange,
  onClearFilters,
  filteredCount,
  totalCount,
}) => {
  return (
    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Department Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
          <select
            value={filterDepartment}
            onChange={(e) => onFilterDepartmentChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Default</option>
            <option value="desc">Newest to Oldest</option>
            <option value="asc">Oldest to Newest</option>
          </select>
        </div>

        {/* Status Filter */}
        
      </div>

      {/* Clear Filters & Results Count */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onClearFilters}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Clear all filters
        </button>
        <span className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filteredCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalCount}</span> plans
        </span>
      </div>
    </div>
  );
};

