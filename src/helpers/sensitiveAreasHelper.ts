import { getSensitiveDepartments } from '../api/audits';
import { getDepartmentSensitiveAreas } from '../api/departmentSensitiveAreas';

/**
 * Load sensitive areas for an audit plan
 * This function handles multiple fallback strategies to load sensitive areas
 * 
 * @param auditId - The audit plan ID
 * @param rawDetails - Raw plan details from API (before normalization)
 * @param detailsWithSchedules - Plan details with schedules merged
 * @returns Object containing sensitiveFlag, sensitiveAreas, and sensitiveAreasByDept
 */
export const loadSensitiveAreas = async (
  auditId: string,
  rawDetails: any,
  detailsWithSchedules: any
): Promise<{
  sensitiveFlag: boolean;
  sensitiveAreas: string[];
  sensitiveAreasByDept: Record<number, string[]>;
}> => {
  let sensitiveFlag = false;
  let sensitiveAreas: string[] = [];
  let sensitiveAreasByDept: Record<number, string[]> = {}; // Map deptId -> areas[]
  
  // First, try to get from rawDetails (before normalization)
  const rawDetailsAny = rawDetails as any;
  
  // Always try to fetch from API first (since sensitive areas are stored in AuditScopeDepartment table)
  // Only use rawDetails if API fails or returns empty
  let foundInRawDetails = false;
  if (
    rawDetailsAny.sensitiveAreas &&
    Array.isArray(rawDetailsAny.sensitiveAreas) &&
    rawDetailsAny.sensitiveAreas.length > 0
  ) {
    sensitiveAreas = rawDetailsAny.sensitiveAreas;
    sensitiveFlag = true;
    foundInRawDetails = true;
  } else if (
    rawDetailsAny.sensitiveFlag !== undefined &&
    rawDetailsAny.sensitiveFlag === true
  ) {
    sensitiveFlag = Boolean(rawDetailsAny.sensitiveFlag);
    if (rawDetailsAny.sensitiveAreas) {
      sensitiveAreas = Array.isArray(rawDetailsAny.sensitiveAreas) 
        ? rawDetailsAny.sensitiveAreas 
        : typeof rawDetailsAny.sensitiveAreas === "string"
        ? [rawDetailsAny.sensitiveAreas]
        : [];
      foundInRawDetails = sensitiveAreas.length > 0;
    }
  }
  
  // If not found in rawDetails, always fetch from API
  if (!foundInRawDetails) {
    // If not in rawDetails, try to get from API (areas were saved via setSensitiveFlag)
    try {
      const sensitiveDepts = await getSensitiveDepartments(auditId);
      
      if (sensitiveDepts && sensitiveDepts.length > 0) {
        sensitiveFlag = sensitiveDepts.some(
          (sd: any) => sd.sensitiveFlag === true
        );
        
        const allAreas = new Set<string>();
        
        sensitiveDepts.forEach((sd: any) => {
          const deptId = Number(sd.deptId);
          let areasArray: string[] = [];
          
          // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
          if (Array.isArray(sd.Areas)) {
            areasArray = sd.Areas;
          } else if (sd.Areas && typeof sd.Areas === "string") {
            try {
              const parsed = JSON.parse(sd.Areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
            } catch {
              areasArray = [sd.Areas];
            }
          } else if (
            sd.Areas &&
            typeof sd.Areas === "object" &&
            sd.Areas.$values
          ) {
            areasArray = Array.isArray(sd.Areas.$values)
              ? sd.Areas.$values
              : [];
          } else if (Array.isArray(sd.areas)) {
            areasArray = sd.areas;
          } else if (sd.areas && typeof sd.areas === "string") {
            try {
              const parsed = JSON.parse(sd.areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
            } catch {
              areasArray = [sd.areas];
            }
          } else if (
            sd.areas &&
            typeof sd.areas === "object" &&
            sd.areas.$values
          ) {
            areasArray = Array.isArray(sd.areas.$values)
              ? sd.areas.$values
              : [];
          }
          
          // Store areas by deptId
          if (deptId && areasArray.length > 0) {
            sensitiveAreasByDept[deptId] = areasArray
              .filter(
                (area: string) =>
                  area && typeof area === "string" && area.trim()
              )
              .map((a: string) => a.trim());
          }
          
          areasArray.forEach((area: string) => {
            if (area && typeof area === "string" && area.trim()) {
              allAreas.add(area.trim());
            }
          });
        });
        
        sensitiveAreas = Array.from(allAreas);
      }
    } catch (sensitiveErr: any) {
      console.error("Failed to load sensitive flag data:", sensitiveErr);
    }
  }

  // Fallback: if still no sensitive areas and scopeDepartments contain departmentSensitiveAreaIds,
  // map those GUIDs to names using DepartmentSensitiveArea master
  if (
    sensitiveAreas.length === 0 &&
    Object.keys(sensitiveAreasByDept).length === 0 &&
    detailsWithSchedules?.scopeDepartments?.values?.length > 0
  ) {
    try {
      const masterAreas = await getDepartmentSensitiveAreas();
      const masterById = new Map<string, { deptId: number; deptName?: string; sensitiveArea?: string }>();
      masterAreas.forEach((m) => {
        const key = m.id ? String(m.id) : "";
        if (key) {
          masterById.set(key, {
            deptId: Number(m.deptId),
            deptName: m.deptName || m.departmentName,
            sensitiveArea: m.sensitiveArea,
          });
        }
      });

      const mergedSensitiveAreas = new Set<string>();
      const mergedSensitiveAreasByDept: Record<number, string[]> = {};

      detailsWithSchedules.scopeDepartments.values.forEach((sd: any) => {
        const deptId = Number(sd.deptId);
        if (!deptId || !Array.isArray(sd.departmentSensitiveAreaIds)) return;

        sd.departmentSensitiveAreaIds.forEach((areaId: any) => {
          const key = areaId != null ? String(areaId) : "";
          const found = key ? masterById.get(key) : undefined;
          if (found?.sensitiveArea) {
            const name = found.sensitiveArea;
            if (!mergedSensitiveAreasByDept[deptId]) {
              mergedSensitiveAreasByDept[deptId] = [];
            }
            mergedSensitiveAreasByDept[deptId].push(name);
            mergedSensitiveAreas.add(name);
          }
        });
      });

      if (Object.keys(mergedSensitiveAreasByDept).length > 0) {
        sensitiveFlag = true;
        sensitiveAreas = Array.from(mergedSensitiveAreas);
        sensitiveAreasByDept = mergedSensitiveAreasByDept;
      }
    } catch (fallbackErr) {
      console.error("Fallback load sensitive areas by departmentSensitiveAreaIds failed:", fallbackErr);
    }
  }

  return {
    sensitiveFlag,
    sensitiveAreas,
    sensitiveAreasByDept,
  };
};

