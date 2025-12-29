import { MainLayout } from "../../../layouts";
import { PageHeader } from "../../../components";
import { useAuth } from "../../../contexts";
import { useState, useEffect, useMemo } from "react";
import type { AuditPlan, AuditPlanDetails } from "../../../types/auditPlan";
import { 
  getAuditApprovals, 
  getAuditPlanById,
  getSensitiveDepartments,
} from "../../../api/audits";
import { getAdminUsers } from "../../../api/adminUsers";
import { getAuditTeam } from "../../../api/auditTeam";
import { getDepartments } from "../../../api/departments";
import { getAuditSchedules } from "../../../api/auditSchedule";
import { getDepartmentSensitiveAreas } from "../../../api/departmentSensitiveAreas";
import { getPlansWithDepartments } from "../../../services/auditPlanning.service";
import {
  getAuditChecklistTemplateMapsByAudit,
} from "../../../api/auditChecklistTemplateMaps";
import { normalizePlanDetails, unwrap } from "../../../utils/normalize";
import { useUserId } from "../../../store/useAuthStore";

// Import custom hooks
import { useAuditPlanFilters } from "../../../hooks/useAuditPlanFilters";

// Import helper functions
import {
  getCriterionName,
  getDepartmentName,
} from "../../../helpers/auditPlanHelpers";
import { getStatusColor, getBadgeVariant } from "../../../constants";

// Import components
import { FilterBar } from "./components/FilterBar";
import { PlanTable } from "./components/PlanTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const userIdFromToken = useUserId();

  // Data fetching states
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);


  // Only show plans where current user is in AuditTeam (and status is in allowed list)
  const visiblePlans = useMemo(() => {
    // Determine current user's id for this memo
    // Priority: userIdFromToken (from JWT) > user.userId (from user object)
    const currentId = (() => {
      // First try userIdFromToken (most reliable, from JWT token)
      if (userIdFromToken) {
        return String(userIdFromToken).trim();
      }

      // Fallback to user object
      if (!user) return null;

      const fallbackId =
        (user as any)?.userId ??
        (user as any)?.id ??
        (user as any)?.$id ??
        null;

        return fallbackId ? String(fallbackId).trim() : null;
    })();

    // 1) Status filter:
    //    - Auditor chỉ được xem plans có status "Approved" và "InProgress"
    const statusFiltered = existingPlans.filter((plan) => {
      const normStatus = String(plan.status || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      return normStatus === "approved" || normStatus === "inprogress";
    });

    // 2) Nếu không xác định được user hiện tại, trả về rỗng
    if (!currentId) {
      return [] as AuditPlan[];
    }

    const normalizedCurrentUserId = String(currentId).toLowerCase().trim();

    // 3) Xây set các auditId mà user hiện tại nằm trong AuditTeam (bất kỳ vai trò nào)
    const allowedAuditIds = new Set<string>();
    if (auditTeams.length > 0) {
      auditTeams.forEach((m: any) => {
        // Try multiple possible field names for userId in audit team
        const memberUserId = m?.userId ?? m?.id ?? m?.$id ?? m?.user?.userId ?? m?.user?.id;
        if (memberUserId == null) return;
        
        // Normalize both sides for comparison (handle GUID, string, etc.)
        const memberNorm = String(memberUserId).toLowerCase().trim();
        if (!memberNorm) return;
        
        // Compare normalized IDs
        if (memberNorm !== normalizedCurrentUserId) return;

        // Collect all possible auditId field names
        const candidates = [
          m.auditId, 
          m.auditPlanId, 
          m.planId,
          m?.audit?.auditId,
          m?.audit?.id,
          m?.auditPlan?.auditId,
          m?.auditPlan?.id
        ]
          .filter((v: any) => v != null)
          .map((v: any) => String(v).trim())
          .filter(Boolean);

        candidates.forEach((id) => {
          allowedAuditIds.add(id);
          allowedAuditIds.add(id.toLowerCase());
        });
      });
    }
    
    // Note: Không return empty ngay cả khi allowedAuditIds.size === 0
    // Vì planMatchesUser có fallback check createdBy

    const planMatchesUser = (plan: any) => {
      const candidates = [plan.auditId, plan.id, (plan as any).$id]
        .filter((v: any) => v != null)
        .map((v: any) => String(v).trim())
        .filter(Boolean);

      if (!candidates.length) return false;

      // Check if plan is in allowedAuditIds (user is in AuditTeam)
      const isInTeam = candidates.some(
        (id) => allowedAuditIds.has(id) || allowedAuditIds.has(id.toLowerCase())
      );
      if (isInTeam) return true;

      // Fallback: Check if current user is the plan creator
      // This ensures plan creator always sees their plan, even if auditTeams hasn't refreshed yet
      // Check multiple possible field names and nested structures
      const planCreatedBy =
        plan.createdBy ||
                           plan.createdByUserId || 
                           plan.auditorId || 
                           plan.userId ||
                           (plan as any).audit?.createdBy ||
                           (plan as any).audit?.createdByUserId ||
                           (plan as any).audit?.auditorId ||
                           (plan as any).audit?.userId ||
                           null;
      
      if (currentId && planCreatedBy) {
        const planCreatedByStr = String(planCreatedBy).trim();
        const normalizedCreatedBy = planCreatedByStr.toLowerCase();
        
        // Direct userId match
        if (normalizedCreatedBy === normalizedCurrentUserId) {
          return true;
        }
        
        // Email match (if createdBy is email)
        if (user?.email) {
          const userEmail = String(user.email).toLowerCase().trim();
          if (normalizedCreatedBy === userEmail) {
            return true;
          }
        }
        
      }

      return false;
    };

    return statusFiltered.filter(planMatchesUser) as AuditPlan[];
  }, [existingPlans, auditTeams, user, userIdFromToken]);

  // Use filter hook limited to visible statuses & membership
  const filterState = useAuditPlanFilters(visiblePlans);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] =
    useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<
    any[]
  >([]);

  const layoutUser = user
    ? { name: user.fullName, avatar: undefined }
    : undefined;

  // Load audit teams - needs to be refreshed when plans change
  const fetchAuditTeams = async () => {
    try {
      const teams = await getAuditTeam();
      // Filter out AuditeeOwner from audit teams
      const filteredTeams = Array.isArray(teams) 
        ? teams.filter((m: any) => {
            const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
            return role !== 'auditeeowner';
          })
        : [];
      setAuditTeams(filteredTeams);
    } catch (err) {
      console.error("Failed to load audit teams", err);
    }
  };

  // Load audit plans and audit teams
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
        // Refresh audit teams after loading plans to ensure we have latest team assignments
        await fetchAuditTeams();
      } catch (error) {
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Also load audit teams on initial mount (before plans are loaded)
  useEffect(() => {
    fetchAuditTeams();
  }, []);

  // Load users for PlanDetailsModal
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getAdminUsers();
      const norm = (s: string) =>
        String(s || "")
          .toLowerCase()
          .replace(/\s+/g, "");
        const auditors = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditor"
        );
        const owners = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditeeowner"
        );
        setAuditorOptions(auditors);
        setOwnerOptions(owners);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchUsers();
  }, []);

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
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
            const { unwrap } = await import("../../../utils/normalize");
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

        // Load approvals history only if plan is rejected (API is only for getting rejections)
        let latestRejectionComment: string | null = null;
        const planStatus = String(
          detailsWithSchedules.status ||
            detailsWithSchedules.audit?.status ||
            ""
        ).toLowerCase();
        const isRejected = planStatus.includes("rejected");
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          latestRejectionComment =
            detailsWithSchedules.comment ||
                                   detailsWithSchedules.note || 
                                   detailsWithSchedules.audit?.comment ||
                                   detailsWithSchedules.audit?.note ||
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(
                detailsWithSchedules.auditId ||
                  detailsWithSchedules.id ||
                  auditId
              )
                .trim()
                .toLowerCase();
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
              const related = approvals.filter((a: any) => {
                const approvalAuditId = String(
                  a.auditId || a.audit?.auditId || a.audit?.id || ""
                )
                  .trim()
                  .toLowerCase();
                return (
                  approvalAuditId === currentAuditId && approvalAuditId !== ""
                );
              });
              
              if (related.length > 0) {
                const rejected = related
                  .filter((a: any) => {
                    const approvalStatus = String(a.status || "").toLowerCase();
                    return (
                      approvalStatus.includes("rejected") ||
                      approvalStatus === "rejected"
                    );
                  })
                  .sort((a: any, b: any) => {
                    const aTime = new Date(
                      a.approvedAt || a.createdAt || 0
                    ).getTime();
                    const bTime = new Date(
                      b.approvedAt || b.createdAt || 0
                    ).getTime();
                    return bTime - aTime;
                  });
                
                if (rejected.length > 0) {
                  // Try multiple possible field names for comment
                  latestRejectionComment =
                    rejected[0].comment ||
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn(
                      "⚠️ Rejection comment not found for audit:",
                      currentAuditId,
                      {
                      rejectedItem: rejected[0],
                        allFields: Object.keys(rejected[0]),
                      }
                    );
                  }
                }
              } else {
                console.warn(
                  "⚠️ No related approvals found for audit:",
                  currentAuditId,
                  {
                  totalApprovals: approvals.length,
                    sampleApproval: approvals[0],
                  }
                );
              }
            } catch (approvalErr) {
              console.error(
                "Failed to load audit approvals for plan",
                approvalErr
              );
            }
          }
        }

        // Check rawDetails for sensitive areas BEFORE normalization
        // (sensitive areas were saved during plan creation via setSensitiveFlag API)
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

        // Load criteria if needed
        let criteriaList: any[] = [];
        try {
          const { getAuditCriteria } = await import("../../../api/auditCriteria");
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
          const { unwrap } = await import("../../../utils/normalize");
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          // Failed to fetch schedules separately, using empty array
        }

        // Only fetch approvals if plan is rejected (API is only for getting rejections)
        let latestRejectionComment: string | null = null;
        const planStatus = String(planFromTable.status || "").toLowerCase();
        const isRejected = planStatus.includes("rejected");
        
        if (isRejected) {
          // First, check if comment is stored directly in the audit/auditPlan record
          const planFromTableAny = planFromTable as any;
          latestRejectionComment =
            planFromTableAny.comment ||
                                   planFromTableAny.rejectionComment || 
                                   planFromTableAny.rejectionReason || 
                                   planFromTableAny.note || 
                                   null;
          
          // If not found in audit record, try to get from AuditApproval table
          if (!latestRejectionComment) {
            try {
              const approvalsResponse = await getAuditApprovals();
              const approvals = unwrap(approvalsResponse) || [];
              const currentAuditId = String(
                planFromTable.auditId || planFromTable.id || auditId
              )
                .trim()
                .toLowerCase();
              
              // More robust filtering: case-insensitive comparison and handle different ID field names
              const related = approvals.filter((a: any) => {
                const approvalAuditId = String(
                  a.auditId || a.audit?.auditId || a.audit?.id || ""
                )
                  .trim()
                  .toLowerCase();
                return (
                  approvalAuditId === currentAuditId && approvalAuditId !== ""
                );
              });
              
              if (related.length > 0) {
                const rejected = related
                  .filter((a: any) => {
                    const approvalStatus = String(a.status || "").toLowerCase();
                    return (
                      approvalStatus.includes("rejected") ||
                      approvalStatus === "rejected"
                    );
                  })
                  .sort((a: any, b: any) => {
                    const aTime = new Date(
                      a.approvedAt || a.createdAt || 0
                    ).getTime();
                    const bTime = new Date(
                      b.approvedAt || b.createdAt || 0
                    ).getTime();
                    return bTime - aTime;
                  });
                
                if (rejected.length > 0) {
                  // Try multiple possible field names for comment
                  latestRejectionComment =
                    rejected[0].comment ||
                                          rejected[0].rejectionComment || 
                                          rejected[0].note || 
                                          rejected[0].reason || 
                                          null;
                  
                  // Debug logging
                  if (!latestRejectionComment) {
                    console.warn(
                      "⚠️ Rejection comment not found for audit:",
                      currentAuditId,
                      {
                      rejectedItem: rejected[0],
                        allFields: Object.keys(rejected[0]),
                      }
                    );
                  }
                }
              } else {
                console.warn(
                  "⚠️ No related approvals found for audit:",
                  currentAuditId,
                  {
                  totalApprovals: approvals.length,
                    sampleApproval: approvals[0],
                  }
                );
              }
            } catch (approvalErr) {
              console.error(
                "Failed to load audit approvals for basic details",
                approvalErr
              );
            }
          }
        }

        // Get sensitive areas from plan data (from what was selected during plan creation)
        let sensitiveFlag = false;
        let sensitiveAreas: string[] = [];
        let sensitiveAreasByDept: Record<number, string[]> = {}; // Map deptId -> areas[]
        
        // Check if sensitive areas are stored in planFromTable
        const planFromTableAny = planFromTable as any;
        if (
          planFromTableAny.sensitiveAreas &&
          Array.isArray(planFromTableAny.sensitiveAreas) &&
          planFromTableAny.sensitiveAreas.length > 0
        ) {
          sensitiveAreas = planFromTableAny.sensitiveAreas;
          sensitiveFlag = true;
        } else if (planFromTableAny.sensitiveFlag !== undefined) {
          sensitiveFlag = Boolean(planFromTableAny.sensitiveFlag);
          if (planFromTableAny.sensitiveAreas) {
            sensitiveAreas = Array.isArray(planFromTableAny.sensitiveAreas) 
              ? planFromTableAny.sensitiveAreas 
              : typeof planFromTableAny.sensitiveAreas === "string"
              ? [planFromTableAny.sensitiveAreas]
              : [];
          }
        } else {
          // Fallback: Try to fetch from API if not in plan data
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
          } catch (sensitiveErr) {
            console.warn(
              "Failed to load sensitive flag data in fallback:",
              sensitiveErr
            );
          }
        }

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

  // Get current user's userId for PlanDetailsModal
  const currentUserId = useMemo(() => {
    if (!user) return null;
    const fallbackId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.$id ?? null;
      return fallbackId ? String(fallbackId).trim() : null;
  }, [user]);

  return (
    <MainLayout user={layoutUser}>
      <PageHeader
        title="Audit Planning"
        subtitle="View assigned audit plans"
      />

      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="p-6">
            <FilterBar
              filterDepartment={filterState.filterDepartment}
              sortDateOrder={filterState.sortDateOrder}
              filterStatus={filterState.filterStatus}
              departments={departments}
              onFilterDepartmentChange={filterState.setFilterDepartment}
              onSortDateOrderChange={filterState.setSortDateOrder}
              onFilterStatusChange={filterState.setFilterStatus}
              onClearFilters={filterState.clearFilters}
              filteredCount={filterState.filteredPlans.length}
              totalCount={visiblePlans.length}
            />
            <PlanTable
              filteredPlans={filterState.filteredPlans}
              existingPlans={visiblePlans}
              loadingPlans={loadingPlans}
              onViewDetails={handleViewDetails}
              onEditPlan={() => {}}
              onDeletePlan={() => {}}
              getStatusColor={getStatusColor}
              getBadgeVariant={getBadgeVariant}
              startIndex={0}
            />
          </div>
        </div>
      </div>

        {/* Plan Details Modal */}
        {showDetailsModal && selectedPlanDetails && (
          <PlanDetailsModal
            showModal={showDetailsModal}
            selectedPlanDetails={selectedPlanDetails}
            templatesForPlan={templatesForSelectedPlan}
            onClose={() => setShowDetailsModal(false)}
            currentUserId={currentUserId}
            auditTeamsForPlan={auditTeams.filter((m: any) => {
              const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
              if (!currentAuditId) return false;
                const teamAuditId = String(m?.auditId || "").trim();
                return (
                teamAuditId === String(currentAuditId).trim() ||
                teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
                );
            })}
            getCriterionName={(id: string) => getCriterionName(id, [])}
            getDepartmentName={(id: string | number) =>
              getDepartmentName(id, departments)
            }
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            getTemplateName={(tid) => {
              return `Template ${String(tid ?? "")}`;
            }}
          />
        )}
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
