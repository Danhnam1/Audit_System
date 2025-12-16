import { apiClient } from '../hooks/axios'
import { unwrap } from '../utils/normalize'

export interface AuditCriteriaMapPayload {
  auditId: string
  criteriaId: string
  status?: string // Optional status field
}

export const addCriterionToAudit = async (auditId: string, criteriaId: string) => {
  // Based on Swagger, this might be a POST endpoint with auditId and criteriaId
  const payload: AuditCriteriaMapPayload = { 
    auditId, 
    criteriaId,
    status: 'Active' // Default status if backend requires
  };
  return apiClient.post('/AuditCriteriaMap', payload);
}

export const getCriteriaForAudit = async (auditId: string) => {
  const res: any = await apiClient.get(`/AuditCriteriaMap/audit/${auditId}`)
  const values = unwrap(res)
  return values
}

// Get criteria for audit by department (new API with deptId support)
// API response structure: { $id: "1", $values: [{ deptId: number, criteriaIds: { $id: "3", $values: [criteriaId1, criteriaId2, ...] } }] }
export const getCriteriaForAuditByDepartment = async (auditId: string, deptId?: number) => {
  let url = `/AuditCriteriaMap/audit/${auditId}/by-department`;
  if (deptId !== undefined && deptId !== null) {
    url += `?deptId=${deptId}`;
  }
  console.log(`[getCriteriaForAuditByDepartment] Calling API: ${url}`);
  const res: any = await apiClient.get(url);
  console.log(`[getCriteriaForAuditByDepartment] Raw response:`, res);
  
  // Unwrap first level to get $values array
  const topLevelValues = unwrap(res);
  console.log(`[getCriteriaForAuditByDepartment] Top level unwrapped:`, topLevelValues);
  
  if (!Array.isArray(topLevelValues) || topLevelValues.length === 0) {
    console.log(`[getCriteriaForAuditByDepartment] No data found`);
    return [];
  }
  
  // If deptId is provided, find the matching department
  if (deptId !== undefined && deptId !== null) {
    const deptMapping = topLevelValues.find((item: any) => Number(item.deptId) === Number(deptId));
    if (!deptMapping) {
      console.log(`[getCriteriaForAuditByDepartment] No mapping found for deptId: ${deptId}`);
      return [];
    }
    
    // Extract criteriaIds from the matching department
    const criteriaIds = unwrap(deptMapping.criteriaIds);
    console.log(`[getCriteriaForAuditByDepartment] Criteria IDs for dept ${deptId}:`, criteriaIds);
    
    // Return array of criteria objects with criteriaId field
    return criteriaIds.map((id: string) => ({ criteriaId: id }));
  }
  
  // If no deptId provided, return all mappings (for backward compatibility)
  // Flatten all criteriaIds from all departments
  const allCriteriaIds: string[] = [];
  topLevelValues.forEach((item: any) => {
    const criteriaIds = unwrap(item.criteriaIds);
    allCriteriaIds.push(...criteriaIds);
  });
  
  console.log(`[getCriteriaForAuditByDepartment] All criteria IDs:`, allCriteriaIds);
  return allCriteriaIds.map((id: string) => ({ criteriaId: id }));
}

export const removeCriterionFromAudit = async (auditId: string, criteriaId: string) => {
  return apiClient.delete(`/AuditCriteriaMap/${auditId}/${criteriaId}`)
}

// Bulk create/update audit criteria mappings with deptId
export interface BulkAuditCriteriaMapItem {
  deptId: number;
  criteriaId: string;
  status?: string;
}

export interface BulkAuditCriteriaMapRequest {
  auditId: string;
  mappings: BulkAuditCriteriaMapItem[];
}

export const bulkCreateAuditCriteriaMappings = async (request: BulkAuditCriteriaMapRequest) => {
  console.log('[bulkCreateAuditCriteriaMappings] Request:', request);
  const res = await apiClient.post('/AuditCriteriaMap/bulk', request);
  console.log('[bulkCreateAuditCriteriaMappings] Response:', res);
  return res;
}

export default {
  addCriterionToAudit,
  getCriteriaForAudit,
  getCriteriaForAuditByDepartment,
  removeCriterionFromAudit,
  bulkCreateAuditCriteriaMappings,
}
