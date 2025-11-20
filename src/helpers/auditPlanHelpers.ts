/**
 * Helper functions for Audit Planning
 */

// Helper: Get criterion name by ID
export const getCriterionName = (
  criterionId: string | number,
  criteria: any[]
): string => {
  // API uses 'criteriaId' (with 'a'), not 'criterionId'
  const criterion = criteria.find((c: any) => 
    String(c.criteriaId || c.criterionId) === String(criterionId)
  );
  return criterion?.name || '';
};

// Helper: Get user name by ID
export const getUserName = (
  userId: string | number,
  auditorOptions: any[],
  ownerOptions: any[]
): string => {
  const allUsers = [...auditorOptions, ...ownerOptions];
  const user = allUsers.find((u: any) => String(u.userId) === String(userId));
  return user?.fullName || user?.email || `User ID: ${userId}`;
};

// Helper: Get department name by ID
export const getDepartmentName = (
  deptId: string | number,
  departments: Array<{ deptId: number | string; name: string }>
): string => {
  const dept = departments.find((d: any) => String(d.deptId) === String(deptId));
  return dept?.name || (dept as any)?.deptName || `Department ID: ${deptId}`;
};

// Helper: Create criteria toggle handler
export const createCriteriaToggle = (
  setSelectedCriteriaIds: React.Dispatch<React.SetStateAction<string[]>>
) => {
  return (criteriaId: string) => {
    setSelectedCriteriaIds(prev => {
      const id = String(criteriaId);
      if (prev.includes(id)) {
        return prev.filter(cid => cid !== id);
      } else {
        return [...prev, id];
      }
    });
  };
};
