import { getAuditPlanById } from '../../../../api/audits';
import { unwrap } from '../../../../utils/normalize';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../../constants/audit';
import type { AuditPlan } from '../../../../types/auditPlan';
import { getDepartmentSensitiveAreas } from '../../../../api/departmentSensitiveAreas';
import type { DepartmentSensitiveAreaDto } from '../../../../api/departmentSensitiveAreas';

/**
 * Load plan details for editing
 */
export const loadPlanDetailsForEdit = async (
  auditId: string,
  existingPlans: AuditPlan[]
): Promise<any> => {
  let details: any;

  try {
    const rawDetails = await getAuditPlanById(auditId);

    details = {
      ...rawDetails,
      scopeDepartments: {
        ...rawDetails.scopeDepartments,
        values: unwrap(rawDetails.scopeDepartments)
      },
      criteria: {
        ...rawDetails.criteria,
        values: unwrap(rawDetails.criteria)
      },
      auditTeams: {
        ...rawDetails.auditTeams,
        values: unwrap(rawDetails.auditTeams)
      },
      schedules: {
        ...rawDetails.schedules,
        values: unwrap(rawDetails.schedules)
      }
    };
  } catch (apiError) {
    // If detailed endpoint fails, fall back to using table data so the user can still edit basic fields
    const planFromTable = existingPlans.find(p => p.auditId === auditId || p.id === auditId);
    const planFromTableAny = planFromTable as any;

    if (!planFromTable) {
      console.error('❌ Plan not found in table and detailed API failed:', apiError);
      alert('⚠️ Cannot Edit\n\nBackend API /AuditPlan/{id} is returning 500 error and the plan was not found in the list.');
      throw new Error('Backend API /AuditPlan/{id} failed and plan not found in table.');
    }

    // Build a basic editable shape from table row
    details = {
      ...planFromTableAny,
      scopeDepartments: { values: unwrap(planFromTableAny.scopeDepartments) },
      criteria: { values: unwrap(planFromTableAny.criteria) },
      auditTeams: { values: unwrap(planFromTableAny.auditTeams) },
      schedules: { values: unwrap(planFromTableAny.schedules) },
    };
  }

  // Ensure auditId is in details for loadPlanForEdit
  const detailsWithId = {
    ...details,
    auditId: details.auditId || details.id || auditId,
    id: details.id || details.auditId || auditId,
  };

  console.log('📝 Loading plan for edit - auditId:', auditId);
  console.log('📝 Details with ID:', detailsWithId);

  return detailsWithId;
};

/**
 * Prepare complete update payload for edit mode
 */
export const prepareCompleteUpdatePayload = async (params: {
  auditId: string;
  basicPayload: any;
  formState: any;
  departments: Array<{ deptId: number | string; name: string }>;
  ownerOptions: any[];
  currentUserId: string | null;
  user: any;
  sensitiveAreasMaster?: DepartmentSensitiveAreaDto[]; // Pass pre-fetched master list
}) => {
  const {
    auditId,
    basicPayload,
    formState,
    departments,
    ownerOptions: _ownerOptions, // Not used: AuditeeOwner is a system role, not part of auditTeam
    currentUserId,
    user,
    sensitiveAreasMaster: providedMaster
  } = params;
  
  // Fetch or use provided sensitive areas master list
  // Always fetch if we have sensitive areas data (either in sensitiveAreas or sensitiveAreasByDept)
  let sensitiveAreasMaster: DepartmentSensitiveAreaDto[] = providedMaster || [];
  const hasSensitiveData = formState.sensitiveFlag || 
                           (formState.sensitiveAreas && formState.sensitiveAreas.length > 0) ||
                           (formState.sensitiveAreasByDept && Object.keys(formState.sensitiveAreasByDept).length > 0);
  
  if (!providedMaster && hasSensitiveData) {
    try {
      sensitiveAreasMaster = await getDepartmentSensitiveAreas();
    } catch (err) {
      console.error('[prepareCompleteUpdatePayload] Failed to fetch sensitive areas master:', err);
    }
  }

  // Prepare departments list
  let deptIdsToAttach: string[] = [];
  if (formState.level === 'academy') {
    deptIdsToAttach = departments.map((d) => String(d.deptId));
  } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
    deptIdsToAttach = formState.selectedDeptIds;
  }

  // Prepare team members - track all added userIds to prevent duplicates
  const teamMembers: any[] = [];
  const addedUserIds = new Set<string>();
  
  // Add auditors first
  const auditorSet = new Set<string>(formState.selectedAuditorIds);
  auditorSet.forEach((uid) => {
    const normalizedUid = String(uid).toLowerCase().trim();
    if (!addedUserIds.has(normalizedUid)) {
      addedUserIds.add(normalizedUid);
      teamMembers.push({
        userId: uid,
        roleInTeam: 'Auditor',
        isLead: false,
        status: 'Active',
      });
    }
  });

  // Note: AuditeeOwner is a system role, not part of auditTeam
  // Do not add AuditeeOwner to teamMembers

  // Prepare schedules
  const schedulePairs = [
    { name: MILESTONE_NAMES.KICKOFF, date: formState.kickoffMeeting },
    { name: MILESTONE_NAMES.FIELDWORK, date: formState.fieldworkStart },
    { name: MILESTONE_NAMES.EVIDENCE, date: formState.evidenceDue },
    { name: MILESTONE_NAMES.CAPA, date: formState.capaDue },
    { name: MILESTONE_NAMES.DRAFT, date: formState.draftReportDue },
  ].filter(pair => pair.date);

  const schedules = schedulePairs.map(pair => ({
    milestoneName: pair.name,
    dueDate: new Date(pair.date).toISOString(),
    notes: '',
    status: SCHEDULE_STATUS.PLANNED,
  }));

  // Prepare criteria maps
  const criteriaMaps = (formState.selectedCriteriaIds || []).map((criteriaId: string) => ({
    auditId: auditId,
    criteriaId: criteriaId,
    status: 'Active',
  }));

  // Prepare scope departments with sensitive fields (SensitiveFlag, Areas, DepartmentSensitiveAreaIds)
  // Map sensitive area names from formState to their IDs using master list
  const scopeDepartments = deptIdsToAttach.map((deptId: string) => {
    const deptIdNum = Number(deptId);
    const sensitiveAreaIds: string[] = [];
    const areasForThisDept: string[] = [];
    
    // Check if this department is marked as sensitive
    // sensitiveDeptIds can be array of strings or numbers
    const isSensitiveDept = formState.sensitiveDeptIds && 
      Array.isArray(formState.sensitiveDeptIds) && 
      formState.sensitiveDeptIds.some((id: any) => {
        const idNum = typeof id === 'string' ? Number(id) : id;
        return idNum === deptIdNum || String(id) === String(deptIdNum) || String(id) === deptId;
      });
    
    // Check if this department has sensitive areas data (from sensitiveAreasByDept)
    const hasSensitiveAreasData = formState.sensitiveAreasByDept && 
      formState.sensitiveAreasByDept[deptIdNum] && 
      Array.isArray(formState.sensitiveAreasByDept[deptIdNum]) &&
      formState.sensitiveAreasByDept[deptIdNum].length > 0;
    
    // Department is sensitive if: (1) marked in sensitiveDeptIds AND sensitiveFlag is true, OR (2) has sensitiveAreasByDept data
    const hasSensitiveFlag = (formState.sensitiveFlag && isSensitiveDept) || hasSensitiveAreasData;
    
    // Priority 1: Use sensitiveAreasByDept if available (more accurate, already mapped by department)
    if (hasSensitiveAreasData) {
      const deptAreas = formState.sensitiveAreasByDept[deptIdNum];
      if (Array.isArray(deptAreas) && deptAreas.length > 0) {
        deptAreas.forEach((areaName: string) => {
          if (!areaName || typeof areaName !== 'string') return;
          
          const trimmedArea = areaName.trim();
          if (trimmedArea && !areasForThisDept.includes(trimmedArea)) {
            areasForThisDept.push(trimmedArea);
          }
          
          // Find matching area in master list to get ID
          const matchingArea = sensitiveAreasMaster.find((master) => {
            const masterDeptId = Number(master.deptId);
            if (masterDeptId !== deptIdNum) return false;
            const masterAreaName = master.sensitiveArea || '';
            return masterAreaName === trimmedArea || 
                   masterAreaName.trim() === trimmedArea ||
                   trimmedArea.includes(masterAreaName) ||
                   masterAreaName.includes(trimmedArea);
          });
          
          if (matchingArea && matchingArea.id) {
            const areaIdStr = String(matchingArea.id);
            if (!sensitiveAreaIds.includes(areaIdStr)) {
              sensitiveAreaIds.push(areaIdStr);
            }
          }
        });
      }
    }
    // Priority 2: Fallback to formState.sensitiveAreas (array of strings like "areaName - deptName" or just "areaName")
    else if (hasSensitiveFlag && formState.sensitiveAreas && Array.isArray(formState.sensitiveAreas)) {
      formState.sensitiveAreas.forEach((areaStr: string) => {
        if (!areaStr || typeof areaStr !== 'string') return;
        
        // Find matching area in master list for this department
        const matchingArea = sensitiveAreasMaster.find((master) => {
          const masterDeptId = Number(master.deptId);
          if (masterDeptId !== deptIdNum) return false;
          
          // Check if the areaStr contains this master area's name
          const masterAreaName = master.sensitiveArea || '';
          const masterDeptName = master.deptName || master.departmentName || '';
          
          // Format: "areaName - deptName" or just "areaName"
          const expectedFormat1 = `${masterAreaName} - ${masterDeptName}`;
          const expectedFormat2 = masterAreaName;
          
          const matches = areaStr === expectedFormat1 || 
                         areaStr === expectedFormat2 || 
                         areaStr.includes(masterAreaName) ||
                         masterAreaName.includes(areaStr);
          
          if (matches && masterAreaName && !areasForThisDept.includes(masterAreaName)) {
            areasForThisDept.push(masterAreaName);
          }
          
          return matches;
        });
        
        if (matchingArea && matchingArea.id) {
          const areaIdStr = String(matchingArea.id);
          // Backend expects Guid (string). Avoid duplicates.
          if (!sensitiveAreaIds.includes(areaIdStr)) {
            sensitiveAreaIds.push(areaIdStr);
          }
        }
      });
    }
    
    // Serialize areas array to JSON string (backend expects string, max 1000 chars)
    // Backend requires Areas field even if empty, so always provide a value
    let areasString: string = '';
    if (areasForThisDept.length > 0) {
      const areasJson = JSON.stringify(areasForThisDept);
      // Ensure it doesn't exceed 1000 chars
      if (areasJson.length <= 1000) {
        areasString = areasJson;
      } else {
        // Fallback to comma-separated if too long
        areasString = areasForThisDept.join(', ').substring(0, 1000);
      }
    }
    
    // Backend requires DepartmentSensitiveAreaIds field even if empty, so always provide an array
    // Use empty array if no sensitive areas, otherwise use the IDs
    const departmentSensitiveAreaIdsArray = sensitiveAreaIds.length > 0 ? sensitiveAreaIds : [];
    
    return {
      deptId: Number(deptId),
      status: 'Active',
      sensitiveFlag: hasSensitiveFlag || false,
      areas: areasString, // Always send string (empty if no areas)
      departmentSensitiveAreaIds: departmentSensitiveAreaIdsArray, // Always send array (empty if no IDs)
    };
  });

  // Prepare audit checklist template maps
  const assignedByUserId = currentUserId || (user as any)?.userId || (user as any)?.id || (user as any)?.$id || '';
  const auditChecklistTemplateMaps = formState.selectedTemplateIds.map((templateId: string) => ({
    auditId: auditId,
    templateId: templateId,
    assignedBy: assignedByUserId,
    status: 'Active',
  }));

  // Construct complete update payload
  const completeUpdatePayload = {
    audit: basicPayload,
    criteriaMaps: criteriaMaps,
    scopeDepartments: scopeDepartments,
    auditTeams: teamMembers,
    schedules: schedules,
    auditChecklistTemplateMaps: auditChecklistTemplateMaps,
  };

  return completeUpdatePayload;
};

