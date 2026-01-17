import { 
  getPeriodStatus,
  getAuditsByPeriod,
  getAuditScopeDepartmentsByAuditId,
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
 * @deprecated - Đã bỏ giới hạn số lần tạo plan, không còn sử dụng
 */
/**
 * Business Rule 2: Validate department với điều kiện (KHÔNG cấm trùng tuyệt đối)
 * Logic: Check trùng time + trùng phòng ban → Nếu trùng → check scope
 * - Trùng phòng ban + trùng scope → REJECT (nếu không có justification)
 * - Trùng phòng ban + khác scope → WARNING (cho phép với điều kiện)
 */
export interface DepartmentValidationResult {
  isValid: boolean;
  message: string;
  warnings: string[];
  requiresApproval: boolean; // Cần Director/Management approval
  conflicts?: {
    departmentIds: number[];
    audits: Array<{
      auditId: string;
      title: string;
      startDate: string;
      endDate: string;
      scope?: string[]; // Criteria/standards
    }>;
  };
}

export const validateDepartmentWithConditions = async (
  auditId: string | null,
  departmentIds: number[],
  startDate: string,
  endDate: string,
  selectedCriteriaIds: string[] = [] // Scope (criteria/standards)
): Promise<DepartmentValidationResult> => {
  try {
    if (!departmentIds || departmentIds.length === 0) {
      return {
        isValid: true,
        message: 'No departments to validate',
        warnings: [],
        requiresApproval: false,
      };
    }

    // Get all audits in the period
    const auditsInPeriod = await getAuditsByPeriod(startDate, endDate);
    const auditsArray = Array.isArray(auditsInPeriod) ? auditsInPeriod : [];
    
    // Filter out current audit if editing
const otherAudits = auditId 
      ? auditsArray.filter((a: any) => String(a.auditId || a.id) !== String(auditId))
      : auditsArray;

    if (otherAudits.length === 0) {
      return {
        isValid: true,
        message: 'No conflicts found',
        warnings: [],
        requiresApproval: false,
      };
    }

    // Check for overlapping time + same department
    const conflicts: DepartmentValidationResult['conflicts'] = {
      departmentIds: [],
      audits: [],
    };

    const warnings: string[] = [];
    let hasConflict = false;
    let hasScopeOverlap = false;
    let requiresApproval = false;

    // Check each department
    for (const deptId of departmentIds) {
      // Find audits that have this department and overlap in time
      const conflictingAudits = otherAudits.filter((audit: any) => {
        // Check time overlap
        const auditStart = new Date(audit.startDate || audit.periodFrom || audit.startDate);
        const auditEnd = new Date(audit.endDate || audit.periodTo || audit.endDate);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);
        
        const timeOverlaps = auditStart <= newEnd && auditEnd >= newStart;
        
        if (!timeOverlaps) return false;

        // Check if audit has this department
        // Note: We need to get scope departments for each audit
        // For now, we'll use the validateDepartment API result if available
        return true; // Assume conflict if time overlaps (will refine with scope check)
      });

      if (conflictingAudits.length > 0) {
        hasConflict = true;
        conflicts.departmentIds.push(deptId);
        
        // Get scope info for each conflicting audit
        for (const audit of conflictingAudits) {
          try {
            const scopeDepts = await getAuditScopeDepartmentsByAuditId(String(audit.auditId || audit.id));
            const scopeDeptArray = Array.isArray(scopeDepts) ? scopeDepts : [];
            const hasDept = scopeDeptArray.some((sd: any) => Number(sd.deptId) === Number(deptId));
            
            if (hasDept) {
              // Get criteria/standards for this audit (scope)
              const auditCriteria = audit.criteria || audit.selectedCriteriaIds || [];
              const auditCriteriaIds = Array.isArray(auditCriteria) 
                ? auditCriteria.map((c: any) => String(c.criteriaId || c.id || c))
                : [];
              
              // Check scope overlap
              const scopeOverlaps = selectedCriteriaIds.some(cid => 
                auditCriteriaIds.includes(String(cid))
              );
              
              if (scopeOverlaps) {
                hasScopeOverlap = true;
                conflicts.audits.push({
                  auditId: String(audit.auditId || audit.id),
                  title: audit.title || 'Unknown',
                  startDate: audit.startDate || audit.periodFrom || '',
                  endDate: audit.endDate || audit.periodTo || '',
                  scope: auditCriteriaIds,
                });
              } else {
                // Trùng time + trùng phòng ban nhưng KHÁC scope
                conflicts.audits.push({
                  auditId: String(audit.auditId || audit.id),
                  title: audit.title || 'Unknown',
                  startDate: audit.startDate || audit.periodFrom || '',
                  endDate: audit.endDate || audit.periodTo || '',
                  scope: auditCriteriaIds,
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to get scope for audit ${audit.auditId}:`, err);
            // Still add to conflicts but without scope info
            conflicts.audits.push({
              auditId: String(audit.auditId || audit.id),
              title: audit.title || 'Unknown',
              startDate: audit.startDate || audit.periodFrom || '',
              endDate: audit.endDate || audit.periodTo || '',
            });
          }
        }
      }
    }

    // Evaluate conflicts based on business rules
    if (hasConflict) {
      // Rule 1: Trùng phòng ban + trùng scope → WARNING (không reject, chỉ cảnh báo)
      if (hasScopeOverlap) {
        warnings.push(`There are ${conflicts.audits.length} audit plans for that department.`);
        warnings.push('Please select a different audit criteria from those audits.');
        requiresApproval = false; // Không reject, chỉ warning
      }
      
      // Rule 2: Trùng time + trùng phòng ban nhưng KHÁC scope → WARNING (cho phép)
      if (!hasScopeOverlap && conflicts.audits.length > 0) {
        warnings.push('Same department but different scope in the same time.');
        warnings.push(' Allow creating audit. If needed, please provide justification or Director approval.');
        // Không cần approval nếu khác scope
        requiresApproval = false;
      }
    }

    return {
      isValid: true,
      message: hasConflict 
        ? 'There are conflicts but meet the conditions for approval.'
        : 'There are no conflicts.',
      warnings,
      requiresApproval,
      conflicts: hasConflict ? conflicts : undefined,
    };
  } catch (error: any) {
    console.error('[validateDepartmentWithConditions] Error:', error);
    return {
      isValid: false,
      message: error?.response?.data?.message || error?.message || 'Failed to validate department with conditions',
      warnings: [],
      requiresApproval: false,
    };
  }
};

/**
 * @deprecated - Sử dụng validateDepartmentWithConditions thay thế
 * Giữ lại để backward compatibility
 */
export const validateDepartmentUniqueness = async (
  auditId: string | null,
  departmentIds: number[],
  startDate: string,
  endDate: string
): Promise<{ isValid: boolean; message: string; conflicts?: ValidateDepartmentResponse }> => {
  // Delegate to new validation but return old format
  // Note: Không có selectedCriteriaIds trong hàm cũ, truyền mảng rỗng
  const result = await validateDepartmentWithConditions(auditId, departmentIds, startDate, endDate, []);
  
  return {
    isValid: result.isValid,
    message: result.message,
    conflicts: result.conflicts ? {
      isValid: !result.isValid,
      conflictingDepartments: result.conflicts.departmentIds,
      conflictingAudits: result.conflicts.audits.map(a => ({
        auditId: a.auditId,
        title: a.title,
        departments: result.conflicts!.departmentIds,
      })),
    } : undefined,
  };
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
 * Sử dụng validation có điều kiện (KHÔNG cấm trùng tuyệt đối)
 * - Check trùng time + trùng phòng ban
 * - Nếu trùng → check scope có khác không
 * - Trùng scope → REJECT (trừ khi có justification)
 * - Khác scope → WARNING (cho phép)
 */
export const validateBeforeCreateAudit = async (
  startDate: string,
  endDate: string,
  departmentIds: number[] = [],
  selectedCriteriaIds: string[] = [] // Scope (criteria/standards)
): Promise<{ 
  isValid: boolean; 
  errors: string[]; 
  warnings: string[];
  requiresApproval: boolean; // Cần Director/Management approval
}> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresApproval = false;

  // Validate: Department với điều kiện (nếu có departments)
  if (departmentIds.length > 0) {
    const deptValidation = await validateDepartmentWithConditions(
      null,
      departmentIds,
      startDate,
      endDate,
      selectedCriteriaIds
    );
    
    if (!deptValidation.isValid) {
      errors.push(deptValidation.message);
    }
    
    // Add warnings from department validation
    warnings.push(...deptValidation.warnings);
    
    // Track if approval is required
    if (deptValidation.requiresApproval) {
      requiresApproval = true;
      if (deptValidation.isValid) {
        // Valid but requires approval → warning
        warnings.push('This audit needs Director/Management approval due to conflicts.');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresApproval,
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

/**
 * Business Rule 5: Validate schedule milestones với khoảng cách tối thiểu
 * - evidenceDue > fieldworkStart 5 ngày
 * - capaDue > evidenceDue 5 ngày
 * - draftReportDue > capaDue 5 ngày
 */
export interface ScheduleValidationResult {
  isValid: boolean;
  errors: Record<string, string>; // field -> error message
}

export const validateScheduleMilestones = (
  fieldworkStart?: string,
  evidenceDue?: string,
  capaDue?: string,
  draftReportDue?: string
): ScheduleValidationResult => {
  const errors: Record<string, string> = {};
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MIN_DAYS_GAP = 5;

  // Helper to parse date and calculate days difference
  const getDaysDifference = (laterDate: string, earlierDate: string): number | null => {
    try {
      const later = new Date(laterDate);
      const earlier = new Date(earlierDate);
      
      if (isNaN(later.getTime()) || isNaN(earlier.getTime())) {
        return null;
      }
      
      const diffMs = later.getTime() - earlier.getTime();
      return Math.floor(diffMs / MS_PER_DAY);
    } catch (error) {
      return null;
    }
  };

  // Validation 1: evidenceDue > fieldworkStart 5 ngày
  if (fieldworkStart && evidenceDue) {
    const daysDiff = getDaysDifference(evidenceDue, fieldworkStart);
    if (daysDiff !== null && daysDiff < MIN_DAYS_GAP) {
      errors.evidenceDue = `Evidence Due must be at least ${MIN_DAYS_GAP} days after Fieldwork Start.`;
    }
  }

  // Validation 2: capaDue > evidenceDue 5 ngày
  if (evidenceDue && capaDue) {
    const daysDiff = getDaysDifference(capaDue, evidenceDue);
    if (daysDiff !== null && daysDiff < MIN_DAYS_GAP) {
      errors.capaDue = `CAPA Due must be at least ${MIN_DAYS_GAP} days after Evidence Due.`;
    }
  }

  // Validation 3: draftReportDue > capaDue 5 ngày
  if (capaDue && draftReportDue) {
    const daysDiff = getDaysDifference(draftReportDue, capaDue);
    if (daysDiff !== null && daysDiff < MIN_DAYS_GAP) {
      errors.draftReportDue = `Report Due must be at least ${MIN_DAYS_GAP} days after CAPA Due.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};