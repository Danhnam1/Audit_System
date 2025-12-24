import { apiClient } from '../hooks/axios';

/**
 * Department Sensitive Areas Master Data API
 * Quản lý master data về sensitive areas cho từng department
 * Được sử dụng bởi Admin để định nghĩa, và được suggest khi Auditor tạo plan
 */

export interface DepartmentSensitiveAreaDto {
  id?: number | string;
  deptId: number | string;
  deptName?: string;
  sensitiveArea: string; // Changed from sensitiveAreas (array) to sensitiveArea (string)
  level?: string; // New field: level (e.g., "High", "Medium", "Low")
  defaultNotes?: string;
  createdAt?: string;
  createdBy?: string;
  departmentName?: string;
  levelName?: string;
  createdByName?: string;
}

// Helper interface for grouping areas by department (for UI display)
export interface DepartmentSensitiveAreasGrouped {
  deptId: number | string;
  deptName: string;
  areas: Array<{
    id?: number | string;
    sensitiveArea: string;
    level?: string;
    defaultNotes?: string;
  }>;
}

/**
 * Get all department sensitive areas (master data)
 * GET /api/DepartmentSensitiveArea
 * Returns array of individual area records (each record = 1 area for 1 department)
 */
export const getDepartmentSensitiveAreas = async (): Promise<DepartmentSensitiveAreaDto[]> => {
  try {
    const res: any = await apiClient.get('/DepartmentSensitiveArea');
    
    // Handle $values structure
    let dataArray: any[] = [];
    if (res?.$values && Array.isArray(res.$values)) {
      dataArray = res.$values;
    } else if (Array.isArray(res)) {
      dataArray = res;
    } else if (res?.data) {
      const data = res.data;
      if (data?.$values && Array.isArray(data.$values)) {
        dataArray = data.$values;
      } else if (Array.isArray(data)) {
        dataArray = data;
      }
    }
    
    // Normalize response to match interface
    return dataArray.map((item: any) => {
      
      // Backend DTO has 'SensitiveArea' (singular), Entity has 'SensitiveAreas' (plural)
      // AutoMapper maps SensitiveAreas -> SensitiveArea in ViewDepartmentSensitiveArea
      // Try all possible field names
      const sensitiveAreaValue = 
        item.sensitiveArea || 
        item.SensitiveArea || 
        item.sensitiveAreas || 
        item.SensitiveAreas || 
        item.area || 
        item.Area ||
        item.name || 
        item.Name ||
        '';
      
  
      
      const normalized = {
        id: item.id || item.Id,
        deptId: item.deptId || item.DeptId,
        deptName: item.departmentName || item.DepartmentName || item.deptName,
        sensitiveArea: sensitiveAreaValue,
        level: item.level || item.Level || item.levelName || item.LevelName,
        defaultNotes: item.defaultNotes || item.DefaultNotes || item.notes || '',
        createdAt: item.createdAt || item.CreatedAt,
        createdBy: item.createdBy || item.CreatedBy,
        departmentName: item.departmentName || item.DepartmentName,
        levelName: item.levelName || item.LevelName,
        createdByName: item.createdByName || item.CreatedByName,
      };
      return normalized;
    });
  } catch (error: any) {
    console.error('[getDepartmentSensitiveAreas] API Error:', error);
    throw error; // Re-throw to be handled by caller
  }
};

/**
 * Get sensitive areas for a specific department
 * GET /api/DepartmentSensitiveArea/department/{deptId}
 * Returns array of area records for the department
 */
export const getDepartmentSensitiveAreaByDeptId = async (deptId: number | string): Promise<DepartmentSensitiveAreaDto[]> => {
  try {
    const res: any = await apiClient.get(`/DepartmentSensitiveArea/department/${deptId}`);
    
    let dataArray: any[] = [];
    // Handle $values structure if needed
    if (res?.$values && Array.isArray(res.$values)) {
      dataArray = res.$values;
    } else if (Array.isArray(res)) {
      dataArray = res;
    } else if (res?.data) {
      if (Array.isArray(res.data)) {
        dataArray = res.data;
      } else if (res.data.$values && Array.isArray(res.data.$values)) {
        dataArray = res.data.$values;
      } else {
        // Single object response
        dataArray = [res.data];
      }
    } else if (res && typeof res === 'object') {
      // Single object response
      dataArray = [res];
    }
    
    if (dataArray.length === 0) return [];
    
    // Normalize response to match interface
    return dataArray.map((item: any) => {
      
      // Backend DTO has 'SensitiveArea' (singular), Entity has 'SensitiveAreas' (plural)
      // AutoMapper maps SensitiveAreas -> SensitiveArea in ViewDepartmentSensitiveArea
      // Try all possible field names
      const sensitiveAreaValue = 
        item.sensitiveArea || 
        item.SensitiveArea || 
        item.sensitiveAreas || 
        item.SensitiveAreas || 
        item.area || 
        item.Area ||
        item.name || 
        item.Name ||
        '';
      
      
      const normalized = {
        id: item.id || item.Id,
        deptId: item.deptId || item.DeptId,
        deptName: item.departmentName || item.DepartmentName || item.deptName,
        sensitiveArea: sensitiveAreaValue,
        level: item.level || item.Level || item.levelName || item.LevelName,
        defaultNotes: item.defaultNotes || item.DefaultNotes || item.notes || '',
        createdAt: item.createdAt || item.CreatedAt,
        createdBy: item.createdBy || item.CreatedBy,
        departmentName: item.departmentName || item.DepartmentName,
        levelName: item.levelName || item.LevelName,
        createdByName: item.createdByName || item.CreatedByName,
      };
      return normalized;
    });
  } catch (error: any) {
    // Return empty array if not found (404) or other errors
    if (error?.response?.status === 404) {
      return []; // No configuration for this department yet
    }
    return [];
  }
};

/**
 * Create new department sensitive area configuration
 * POST /api/DepartmentSensitiveArea
 * Creates a single area record (one area per call)
 */
export const createDepartmentSensitiveArea = async (dto: DepartmentSensitiveAreaDto): Promise<DepartmentSensitiveAreaDto> => {
  
  const res: any = await apiClient.post('/DepartmentSensitiveArea', {
    deptId: Number(dto.deptId),
    sensitiveArea: dto.sensitiveArea,
    level: dto.level || '',
    defaultNotes: dto.defaultNotes || '',
  });
  return res?.data || res;
};

/**
 * Update existing department sensitive area configuration
 * PUT /api/DepartmentSensitiveArea/{id}
 */
export const updateDepartmentSensitiveArea = async (
  id: number | string,
  dto: DepartmentSensitiveAreaDto
): Promise<DepartmentSensitiveAreaDto> => {

  const res: any = await apiClient.put(`/DepartmentSensitiveArea/${id}`, {
    deptId: Number(dto.deptId),
    sensitiveArea: dto.sensitiveArea,
    level: dto.level || '',
    defaultNotes: dto.defaultNotes || '',
  });
  return res?.data || res;
};

/**
 * Delete department sensitive area configuration
 * DELETE /api/DepartmentSensitiveArea/{id}
 */
export const deleteDepartmentSensitiveArea = async (id: number | string): Promise<void> => {
  await apiClient.delete(`/DepartmentSensitiveArea/${id}`);
};

