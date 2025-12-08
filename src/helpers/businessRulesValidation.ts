import { 
  getAuditsByPeriod, 
  validateDepartment, 
  getPeriodStatus,
  type ValidateDepartmentRequest,
  type ValidateDepartmentResponse,
  type PeriodStatusResponse
} from '../api/audits';
import { 
  validateAssignment,
  type ValidateAssignmentRequest,
  type ValidateAssignmentResponse
} from '../api/auditPlanAssignment';

/**
 * Business Rule 1: Validate giới hạn 5 audits trong thời kỳ A-B
 */
export const validateAuditLimit = async (
  startDate: string,
  endDate: string
): Promise<{ isValid: boolean; message: string; currentCount?: number }> => {
  try {
    const audits = await getAuditsByPeriod(startDate, endDate);
    const currentCount = Array.isArray(audits) ? audits.length : 0;
    const maxAllowed = 5;

    if (currentCount >= maxAllowed) {
      return {
        isValid: false,
        message: `Maximum ${maxAllowed} audits allowed in this period (${startDate} to ${endDate}). Current count: ${currentCount}.`,
        currentCount,
      };
    }

    return {
      isValid: true,
      message: `Valid. Current count: ${currentCount}/${maxAllowed}`,
      currentCount,
    };
  } catch (error: any) {
    console.error('[validateAuditLimit] Error:', error);
    return {
      isValid: false,
      message: error?.response?.data?.message || error?.message || 'Failed to validate audit limit',
    };
  }
};

/**
 * Business Rule 2: Validate department không trùng với audits khác trong cùng thời kỳ
 */
export const validateDepartmentUniqueness = async (
  auditId: string | null,
  departmentIds: number[],
  startDate: string,
  endDate: string
): Promise<{ isValid: boolean; message: string; conflicts?: ValidateDepartmentResponse }> => {
  try {
    if (!departmentIds || departmentIds.length === 0) {
      return {
        isValid: true,
        message: 'No departments to validate',
      };
    }

    const request: ValidateDepartmentRequest = {
      auditId: auditId || null,
      departmentIds,
      startDate,
      endDate,
    };

    const result = await validateDepartment(request);

    if (!result.isValid) {
      const conflictingDeptNames = result.conflictingDepartments?.join(', ') || 'unknown';
      const conflictingAuditTitles = result.conflictingAudits?.map(a => a.title).join(', ') || 'unknown';
      
      return {
        isValid: false,
        message: `Department(s) ${conflictingDeptNames} are already used in other audit(s): ${conflictingAuditTitles}. Departments cannot be duplicated across audits in the same period.`,
        conflicts: result,
      };
    }

    return {
      isValid: true,
      message: 'All departments are valid (no conflicts)',
      conflicts: result,
    };
  } catch (error: any) {
    console.error('[validateDepartmentUniqueness] Error:', error);
    return {
      isValid: false,
      message: error?.response?.data?.message || error?.message || 'Failed to validate department uniqueness',
    };
  }
};

/**
 * Business Rule 3: Validate assignment (giới hạn 5 và thời kỳ hết hạn)
 */
export const validateAssignmentBeforeCreate = async (
  auditorId: string,
  startDate: string,
  endDate: string
): Promise<{ isValid: boolean; message: string; validation?: ValidateAssignmentResponse }> => {
  try {
    const request: ValidateAssignmentRequest = {
      auditorId,
      startDate,
      endDate,
    };

    const result = await validateAssignment(request);

    if (!result.canCreate) {
      return {
        isValid: false,
        message: result.reason || 'Cannot create assignment',
        validation: result,
      };
    }

    return {
      isValid: true,
      message: result.reason || 'Assignment can be created',
      validation: result,
    };
  } catch (error: any) {
    console.error('[validateAssignmentBeforeCreate] Error:', error);
    return {
      isValid: false,
      message: error?.response?.data?.message || error?.message || 'Failed to validate assignment',
    };
  }
};

/**
 * Business Rule 4: Kiểm tra trạng thái thời kỳ (hết hạn chưa, còn slot không)
 */
export const checkPeriodStatus = async (
  startDate: string,
  endDate: string
): Promise<{ 
  canAssign: boolean; 
  message: string; 
  status?: PeriodStatusResponse 
}> => {
  try {
    const status = await getPeriodStatus(startDate, endDate);

    if (status.isExpired) {
      return {
        canAssign: true, // Khi hết hạn, Lead Auditor có quyền phân người tạo plan tiếp
        message: `Period has expired. Lead Auditor can assign new plans for the next period.`,
        status,
      };
    }

    if (!status.canAssignNewPlans) {
      return {
        canAssign: false,
        message: `Cannot assign new plans. Period is active and all slots are full (${status.currentAuditCount}/${status.maxAuditsAllowed}).`,
        status,
      };
    }

    return {
      canAssign: true,
      message: `Period is active. ${status.remainingSlots} slot(s) remaining.`,
      status,
    };
  } catch (error: any) {
    console.error('[checkPeriodStatus] Error:', error);
    return {
      canAssign: false,
      message: error?.response?.data?.message || error?.message || 'Failed to check period status',
    };
  }
};

/**
 * Helper: Validate tất cả business rules trước khi tạo audit
 */
export const validateBeforeCreateAudit = async (
  startDate: string,
  endDate: string,
  departmentIds: number[] = []
): Promise<{ 
  isValid: boolean; 
  errors: string[]; 
  warnings: string[] 
}> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate 1: Giới hạn 5 audits
  const limitValidation = await validateAuditLimit(startDate, endDate);
  if (!limitValidation.isValid) {
    errors.push(limitValidation.message);
  } else if (limitValidation.currentCount !== undefined) {
    warnings.push(limitValidation.message);
  }

  // Validate 2: Department không trùng (nếu có departments)
  if (departmentIds.length > 0) {
    const deptValidation = await validateDepartmentUniqueness(null, departmentIds, startDate, endDate);
    if (!deptValidation.isValid) {
      errors.push(deptValidation.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Helper: Validate trước khi thêm department vào audit
 */
export const validateBeforeAddDepartment = async (
  auditId: string,
  departmentId: number,
  startDate: string,
  endDate: string
): Promise<{ isValid: boolean; message: string }> => {
  return await validateDepartmentUniqueness(auditId, [departmentId], startDate, endDate);
};

