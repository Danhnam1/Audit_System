import { getAuditPlanById } from '../../../../api/audits';
import { unwrap } from '../../../../utils/normalize';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../../constants/audit';
import type { AuditPlan } from '../../../../types/auditPlan';

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
export const prepareCompleteUpdatePayload = (params: {
  auditId: string;
  basicPayload: any;
  formState: any;
  departments: Array<{ deptId: number | string; name: string }>;
  ownerOptions: any[];
  currentUserId: string | null;
  user: any;
}) => {
  const {
    auditId,
    basicPayload,
    formState,
    departments,
    ownerOptions,
    currentUserId,
    user
  } = params;

  // Prepare departments list
  let deptIdsToAttach: string[] = [];
  if (formState.level === 'academy') {
    deptIdsToAttach = departments.map((d) => String(d.deptId));
  } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
    deptIdsToAttach = formState.selectedDeptIds;
  }

  // Prepare team members
  const teamMembers: any[] = [];
  const auditorSet = new Set<string>(formState.selectedAuditorIds);
  auditorSet.forEach((uid) => {
    teamMembers.push({
      userId: uid,
      roleInTeam: 'Auditor',
      isLead: false,
      status: 'Active',
    });
  });

  if (formState.level === 'academy') {
    const uniqueOwnerIds = Array.from(new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)));
    uniqueOwnerIds.forEach((uid) => {
      teamMembers.push({
        userId: uid,
        roleInTeam: 'AuditeeOwner',
        isLead: false,
        status: 'Active',
      });
    });
  } else {
    const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
    ownersForDepts.forEach((owner: any) => {
      if (owner.userId) {
        teamMembers.push({
          userId: String(owner.userId),
          roleInTeam: 'AuditeeOwner',
          isLead: false,
          status: 'Active',
        });
      }
    });
  }

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

  // Prepare scope departments
  const scopeDepartments = deptIdsToAttach.map((deptId: string) => ({
    deptId: Number(deptId),
    status: 'Active',
  }));

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

