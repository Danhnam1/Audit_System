import { useState, useMemo } from 'react';

/**
 * Custom hook for managing audit plan filters
 */
// existingPlans now has a default empty array to avoid undefined errors when hook is initialized early
export const useAuditPlanFilters = (existingPlans: any[] = []) => {
  // Filter state
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Filter audit plans based on filter criteria
  const filteredPlans = useMemo(() => {
    const filtered = existingPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const deptArray = plan.scopeDepartments || [];
        
        if (!deptArray || deptArray.length === 0) {
          return false;
        }
        
        const hasDept = deptArray.some((dept: any) => {
          const deptId = String(dept.deptId || dept.departmentId || dept.id || dept.DeptId || dept.DepartmentId || '');
          const filterId = String(filterDepartment);
          return deptId === filterId;
        });
        
        if (!hasDept) return false;
      }

      // Date range filter
      if (filterDateFrom) {
        const planEnd = plan.endDate ? new Date(plan.endDate) : null;
        const filterFrom = new Date(filterDateFrom);
        if (planEnd && planEnd < filterFrom) return false;
      }

      if (filterDateTo) {
        const planStart = plan.startDate ? new Date(plan.startDate) : null;
        const filterTo = new Date(filterDateTo);
        if (planStart && planStart > filterTo) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || 'Draft';
        if (planStatus !== filterStatus) return false;
      }

      return true;
    });

    // Sort: Inactive plans go to bottom
    return filtered.sort((a: any, b: any) => {
      const statusA = a.status || 'Draft';
      const statusB = b.status || 'Draft';
      
      // If A is Inactive and B is not, A goes down
      if (statusA === 'Inactive' && statusB !== 'Inactive') return 1;
      // If B is Inactive and A is not, B goes down
      if (statusB === 'Inactive' && statusA !== 'Inactive') return -1;
      
      // Otherwise maintain original order (or sort by created date descending)
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }, [existingPlans, filterDepartment, filterDateFrom, filterDateTo, filterStatus]);

  // Clear all filters
  const clearFilters = () => {
    setFilterDepartment('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
  };

  return {
    filterDepartment,
    filterDateFrom,
    filterDateTo,
    filterStatus,
    filteredPlans,
    setFilterDepartment,
    setFilterDateFrom,
    setFilterDateTo,
    setFilterStatus,
    clearFilters,
  };
};
