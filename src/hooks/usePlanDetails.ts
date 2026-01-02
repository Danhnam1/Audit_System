import { useState } from 'react';
import { getAuditPlanById } from '../api/audits';
import { getAuditSchedules } from '../api/auditSchedule';
import { getDepartments } from '../api/departments';
import { getAuditChecklistTemplateMapsByAudit } from '../api/auditChecklistTemplateMaps';
import { normalizePlanDetails, unwrap } from '../utils/normalize';
import { loadSensitiveAreas, loadRejectionComment } from '../helpers';
import type { AuditPlanDetails } from '../types/auditPlan';

interface UsePlanDetailsProps {
  departments: Array<{ deptId: number | string; name: string }>;
  setDepartments: (depts: Array<{ deptId: number | string; name: string }>) => void;
  existingPlans: any[];
}

export const usePlanDetails = ({
  departments,
  setDepartments,
  existingPlans,
}: UsePlanDetailsProps) => {
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<any[]>([]);

  const loadPlanDetails = async (auditId: string) => {
    try {
      // Load departments if not already loaded
      let deptList = departments;
      if (deptList.length === 0) {
        try {
          const res: any = await getDepartments();
          deptList = (res || []).map((d: any) => ({
            deptId: d.deptId ?? d.$id ?? d.id,
            name: d.name || d.code || "—",
          }));
          setDepartments(deptList);
        } catch (err) {
          console.error("Failed to load departments", err);
        }
      }

      try {
        const rawDetails = await getAuditPlanById(auditId);

        // Fetch schedules separately if not included in main response
        let schedulesData = rawDetails?.schedules;
        if (
          !schedulesData ||
          (!schedulesData.values &&
            !schedulesData.$values &&
            !Array.isArray(schedulesData))
        ) {
          try {
            const schedulesResponse = await getAuditSchedules(auditId);
            const schedulesArray = unwrap(schedulesResponse);
            schedulesData = { values: schedulesArray };
          } catch (scheduleErr) {
            schedulesData = { values: [] };
          }
        }

        // Merge schedules into rawDetails
        const detailsWithSchedules = {
          ...rawDetails,
          schedules: schedulesData,
        };

        // Load rejection comment using helper
        const { latestRejectionComment, rejectedBy } = await loadRejectionComment(
          auditId,
          detailsWithSchedules
        );

        // Load sensitive areas using helper
        const { sensitiveFlag, sensitiveAreas, sensitiveAreasByDept } = await loadSensitiveAreas(
          auditId,
          rawDetails,
          detailsWithSchedules
        );

        // Load criteria if needed
        let criteriaList: any[] = [];
        try {
          const { getAuditCriteria } = await import("../api/auditCriteria");
          criteriaList = await getAuditCriteria();
          if (!Array.isArray(criteriaList)) {
            criteriaList = [];
          }
        } catch (err) {
          console.error("Failed to load criteria", err);
        }

        const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
          departments: deptList,
          criteriaList: criteriaList,
          users: [],
        });

        // sensitiveAreasByDept was already built in the API response processing above (if API was called)
        // If not found, it will be an empty object (initialized at the start of the function)

        const detailsWithRejection = {
          ...normalizedDetails,
          latestRejectionComment,
          rejectedBy: rejectedBy || detailsWithSchedules.rejectedBy || null, // Include who rejected the plan
          sensitiveFlag,
          sensitiveAreas,
          sensitiveAreasByDept,
        };

        setSelectedPlanDetails(detailsWithRejection);
        
        // Load templates for the plan
        try {
          const maps = await getAuditChecklistTemplateMapsByAudit(auditId);
          const normalizedRecords = (maps || [])
            .map((map: any) => ({
              raw: map,
              templateId:
                map.templateId ??
                map.checklistTemplateId ??
                map.template?.templateId ??
                map.template?.id,
            }))
            .filter((x: any) => x.templateId != null);
          setTemplatesForSelectedPlan(normalizedRecords);
        } catch (err) {
          console.error("Failed to load templates for plan", err);
          setTemplatesForSelectedPlan([]);
        }
        
        setShowDetailsModal(true);
        return;
      } catch (apiError) {
        const planFromTable = existingPlans.find(
          (p) => p.auditId === auditId || p.id === auditId
        );

        if (!planFromTable) {
          throw new Error(
            "Plan not found in table. Backend API /AuditPlan/{id} is also returning 500 error."
          );
        }

        // Try to fetch schedules even if main API failed
        let schedulesData: { values: any[] } = { values: [] };
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          // Failed to fetch schedules separately, using empty array
        }

        // Create a details-like object from planFromTable for helper functions
        const fallbackDetails = {
          ...planFromTable,
          audit: planFromTable,
          auditId: planFromTable.auditId || planFromTable.id || auditId,
          id: planFromTable.auditId || planFromTable.id || auditId,
        };

        // Load rejection comment using helper (fallback case)
        const { latestRejectionComment, rejectedBy } = await loadRejectionComment(
          auditId,
          fallbackDetails
        );

        // Load sensitive areas using helper (fallback case)
        // Use planFromTable as rawDetails and fallbackDetails as detailsWithSchedules
        const { sensitiveFlag, sensitiveAreas, sensitiveAreasByDept } = await loadSensitiveAreas(
          auditId,
          planFromTable,
          { ...fallbackDetails, scopeDepartments: { values: [] } }
        );

        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: schedulesData,
          createdByUser: {
            fullName: planFromTable.createdBy || "Unknown",
            email: "N/A",
            roleName: "N/A",
          },
          latestRejectionComment,
          rejectedBy, // Include who rejected the plan
          sensitiveFlag,
          sensitiveAreas,
          sensitiveAreasByDept,
        };

        alert(
          "⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team) is not available.\nSchedules have been fetched separately.\n\nPlease contact backend team to fix this endpoint."
        );

        setSelectedPlanDetails(basicDetails);
        
        // Load templates for the plan
        try {
          const maps = await getAuditChecklistTemplateMapsByAudit(auditId);
          const normalizedRecords = (maps || [])
            .map((map: any) => ({
              raw: map,
              templateId:
                map.templateId ??
                map.checklistTemplateId ??
                map.template?.templateId ??
                map.template?.id,
            }))
            .filter((x: any) => x.templateId != null);
          setTemplatesForSelectedPlan(normalizedRecords);
        } catch (err) {
          console.error("Failed to load templates for plan", err);
          setTemplatesForSelectedPlan([]);
        }
        
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch plan details", error);
      alert(
        "⚠️ Cannot load full plan details\n\n" +
          "The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n" +
          "Error: " +
          (error as any)?.message
      );
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedPlanDetails(null);
    setTemplatesForSelectedPlan([]);
  };

  return {
    selectedPlanDetails,
    showDetailsModal,
    templatesForSelectedPlan,
    loadPlanDetails,
    closeDetailsModal,
    setShowDetailsModal,
  };
};

