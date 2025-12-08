import { apiClient } from '../hooks/axios';

export interface AuditPlanAssignment {
  assignmentId?: string;
  auditorId: number | string; // Can be number or UUID string
  assignBy: number | string; // Can be number or UUID string
  assignedDate: string;
  remarks?: string;
  status?: string; // e.g. 'Active', 'Inactive'
}

export interface CreateAuditPlanAssignmentDto {
  auditorId: number | string; // Can be number or UUID string
  assignBy: number | string; // Can be number or UUID string
  assignedDate: string;
  remarks?: string;
}

// Helper to convert to PascalCase for .NET API
const toPascalCase = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPascalCase);
  if (typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((acc, key) => {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    acc[pascalKey] = toPascalCase(obj[key]);
    return acc;
  }, {} as any);
};

// Get all audit plan assignments
// Filter out inactive assignments
export const getAuditPlanAssignments = async (): Promise<AuditPlanAssignment[]> => {
  const res: any = await apiClient.get('/AuditPlanAssignment');
  
  let allAssignments: AuditPlanAssignment[] = [];
  
  // Handle $values structure
  if (res?.$values && Array.isArray(res.$values)) {
    allAssignments = res.$values;
  } else if (Array.isArray(res)) {
    allAssignments = res;
  } else if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      allAssignments = data.$values;
    } else if (Array.isArray(data)) {
      allAssignments = data;
    }
  }
  
  // Filter out inactive assignments (case-insensitive)
  const activeAssignments = allAssignments.filter((assignment: AuditPlanAssignment) => {
    const status = String(assignment.status || '').toLowerCase().trim();
    return status !== 'inactive';
  });
  
  return activeAssignments;
};

// Get assignment by ID
export const getAuditPlanAssignmentById = async (id: string): Promise<AuditPlanAssignment> => {
  const res: any = await apiClient.get(`/AuditPlanAssignment/${id}`);
  return res?.data || res;
};

// Get assignments by auditor ID (can be number or UUID string)
// Backend doesn't have /auditor/{auditorId} endpoint, so we get all and filter
// Only returns active assignments (inactive are already filtered in getAuditPlanAssignments)
export const getAuditPlanAssignmentsByAuditor = async (auditorId: number | string): Promise<AuditPlanAssignment[]> => {
  try {
    // Get all active assignments (inactive already filtered)
    const allAssignments = await getAuditPlanAssignments();
    
    // Filter by auditorId (compare as strings)
    const auditorIdStr = String(auditorId || '').trim();
    const filtered = allAssignments.filter((assignment: AuditPlanAssignment) => {
      const assignmentAuditorId = String(assignment.auditorId || '').trim();
      return assignmentAuditorId === auditorIdStr;
    });
    
    console.log('[getAuditPlanAssignmentsByAuditor] Filtered assignments for auditorId:', auditorIdStr, 'Result:', filtered);
    return filtered;
  } catch (error) {
    console.error('[getAuditPlanAssignmentsByAuditor] Error:', error);
    return [];
  }
};

// Create new audit plan assignment
export const createAuditPlanAssignment = async (dto: CreateAuditPlanAssignmentDto): Promise<AuditPlanAssignment> => {
  // Backend expects direct object (NOT wrapped in dto) with camelCase:
  // {
  //   "auditorId": "guid-string",
  //   "assignBy": "guid-string",
  //   "assignedDate": "ISO-date-string",
  //   "remarks": "string" (required)
  // }
  
  // Ensure remarks is always provided and not empty (required field)
  const remarksValue = dto.remarks?.trim() || '';
  if (!remarksValue) {
    throw new Error('Remarks field is required and cannot be empty');
  }
  
  // Send directly in camelCase (NOT wrapped in dto, NOT PascalCase)
  const payload = {
    auditorId: String(dto.auditorId), // GUID string
    assignBy: String(dto.assignBy),   // GUID string
    assignedDate: String(dto.assignedDate), // ISO date string
    remarks: String(remarksValue) // Required field
  };
  
  console.log('[createAuditPlanAssignment] Original dto:', dto);
  console.log('[createAuditPlanAssignment] Final payload (camelCase, direct):', JSON.stringify(payload, null, 2));
  
  try {
    const res: any = await apiClient.post('/AuditPlanAssignment', payload);
    return res?.data || res;
  } catch (error: any) {
    console.error('[createAuditPlanAssignment] API Error:', error);
    console.error('[createAuditPlanAssignment] Error response:', error?.response?.data);
    console.error('[createAuditPlanAssignment] Payload that was sent:', JSON.stringify(payload, null, 2));
    throw error;
  }
};

// Update audit plan assignment
export const updateAuditPlanAssignment = async (
  id: string,
  dto: Partial<CreateAuditPlanAssignmentDto>
): Promise<AuditPlanAssignment> => {
  const pascalDto = toPascalCase(dto);
  const res: any = await apiClient.put(`/AuditPlanAssignment/${id}`, pascalDto);
  return res?.data || res;
};

// Delete audit plan assignment
// Backend requires deletion by assignmentId (GUID)
export const deleteAuditPlanAssignment = async (assignmentId: string): Promise<void> => {
  if (!assignmentId || assignmentId.trim() === '') {
    throw new Error('AssignmentId is required for deletion');
  }
  
  console.log('[deleteAuditPlanAssignment] Deleting assignment with assignmentId:', assignmentId);
  
  try {
    await apiClient.delete(`/AuditPlanAssignment/${assignmentId}`);
    console.log('[deleteAuditPlanAssignment] Successfully deleted assignment:', assignmentId);
  } catch (error: any) {
    console.error('[deleteAuditPlanAssignment] Failed to delete assignment:', error);
    console.error('[deleteAuditPlanAssignment] Error response:', error?.response?.data);
    throw error;
  }
};

// Check if auditor has permission to create plans (auditorId can be number or UUID string)
export const hasAuditPlanCreationPermission = async (auditorId: number | string): Promise<boolean> => {
  try {
    // Convert to string for comparison
    const auditorIdStr = String(auditorId || '').trim();
    if (!auditorIdStr) {
      console.warn('[hasAuditPlanCreationPermission] Empty auditorId');
      return false;
    }
    
    console.log('[hasAuditPlanCreationPermission] Checking permission for auditorId:', auditorIdStr);
    
    // Try to get assignments by auditor ID
    const assignments = await getAuditPlanAssignmentsByAuditor(auditorIdStr);
    console.log('[hasAuditPlanCreationPermission] Found assignments:', assignments);
    
    // Also check all assignments and compare by string (in case API endpoint doesn't work)
    if (assignments.length === 0) {
      const allAssignments = await getAuditPlanAssignments();
      console.log('[hasAuditPlanCreationPermission] All assignments:', allAssignments);
      
      // Check if any assignment matches this auditorId (compare as strings)
      const matching = allAssignments.filter((a: AuditPlanAssignment) => {
        const assignmentAuditorId = String(a.auditorId || '').trim();
        return assignmentAuditorId === auditorIdStr;
      });
      
      console.log('[hasAuditPlanCreationPermission] Matching assignments:', matching);
      return matching.length > 0;
    }
    
    return assignments.length > 0;
  } catch (error) {
    console.error('[hasAuditPlanCreationPermission] Error checking permission:', error);
    return false;
  }
};

