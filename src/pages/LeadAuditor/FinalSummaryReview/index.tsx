import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import {
  getAuditFullDetail,
  getAuditPlans,
  getAuditSummary,
  getAuditFindingsActionsSummary,
} from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { getChecklistTemplates } from "../../../api/checklists";
import {
  approveFinalReport,
  getReportRequestByAuditId,
  getAllReportRequests,
} from "../../../api/reportRequest";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { PlanDetailsModal } from "../../Auditor/AuditPlanning/components/PlanDetailsModal";
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor } from "../../../constants";
import {
  FindingsTable,
  OverdueActionsTable,
  ChartsSection,
  DocumentsSection,
} from "../../Shared/FinalReport";

const StageBar = ({ current }: { current: number }) => {
  const steps = [
    "Auditor submits final summary",
    "Lead Auditor submits to Director",
    "Director receives & calculates",
  ];

  return (
    <div className="mb-4">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 h-1.5 bg-primary-300 z-0 rounded-full" />
        {steps.map((label, idx) => {
          const step = idx + 1;
          const isCompleted = step < current;
          const isCurrent = step === current;
          const circleClass = isCompleted
            ? "bg-primary-500 text-white border-2 border-primary-500 shadow-md"
            : isCurrent
            ? "bg-white text-primary-700 border-2 border-primary-500 ring-2 ring-primary-200 shadow-lg"
            : "bg-gray-100 text-gray-700 border-2 border-gray-400";

          return (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full border flex items-center justify-center text-base font-extrabold z-10 transition-all ${circleClass}`}
              >
                {isCompleted ? (
                  <span className="text-lg">✓</span>
                ) : (
                  <span className="text-lg">{step}</span>
                )}
              </div>
              <p className="mt-2 text-[12px] text-center text-gray-700 leading-tight px-1 font-medium">
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

type FullDetailResponse = {
  audit?: {
    auditId?: string;
    title?: string;
    type?: string;
    scope?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    objective?: string;
  };
  schedules?: any[];
  scopeDepartments?: any[];
  auditCriteriaMap?: any[];
  auditChecklistTemplateMap?: any[];
  teams?: any[];
  findings?: any[];
  noFindings?: any[];
  actions?: any[];
  documents?: any[];
};

export default function LeadAuditorFinalSummaryReviewPage() {
  const { user } = useAuth();
  const layoutUser = user
    ? { name: user.fullName, avatar: undefined }
    : undefined;

  const [audits, setAudits] = useState<
    Array<{ auditId: string; title: string }>
  >([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [loadingAudits, setLoadingAudits] = useState(false);

  const [detail, setDetail] = useState<FullDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [findingsActionsSummary, setFindingsActionsSummary] =
    useState<any>(null);
  const [loadingFindingsActionsSummary, setLoadingFindingsActionsSummary] =
    useState(false);
  const [fasTab, setFasTab] = useState<"overview" | "severity" | "actions">(
    "overview"
  );
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [mainTab, setMainTab] = useState<"findings" | "overdueActions" | "charts" | "documents">("findings");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<
    Array<{ deptId: string | number; name: string }>
  >([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [auditCriteria, setAuditCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);

  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  const [reportRequest, setReportRequest] = useState<{
    status?: string;
    reportRequestId?: string;
    note?: string;
  } | null>(null);
  const [loadingReportRequest, setLoadingReportRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [comments, setComments] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load list of audits for dropdown - only show audits with submitted report requests
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const [
          plansRes,
          ,
          usersRes,
          deptsRes,
          criteriaRes,
          templatesRes,
          reportRequestsRes,
        ] = await Promise.all([
          getAuditPlans(),
          getAuditTeam().catch(() => []),
          getAdminUsers().catch(() => []),
          getDepartments().catch(() => []),
          getAuditCriteria().catch(() => []),
          getChecklistTemplates().catch(() => []),
          getAllReportRequests().catch(() => []),
        ]);

        const plans = unwrap(plansRes);

        const deptList = Array.isArray(deptsRes)
          ? deptsRes.map((d: any) => ({
              deptId: d.deptId ?? d.id ?? d.$id,
              name:
                d.name || d.code || String(d.deptId ?? d.id ?? d.$id ?? "N/A"),
            }))
          : [];
        setDepartments(deptList);
        const adminUsersArr = Array.isArray(usersRes) ? usersRes : [];
        setAdminUsers(adminUsersArr);
        const criteriaArr = Array.isArray(criteriaRes) ? criteriaRes : [];
        setAuditCriteria(criteriaArr);
        const templatesArr = Array.isArray(templatesRes) ? templatesRes : [];
        setChecklistTemplates(templatesArr);

        // Filter report requests: Lead Auditor should see audits with:
        // - PendingFirstApproval (submitted by Auditor, waiting for Lead Auditor to send to Director)
        // - PendingSecondApproval (already sent to Director, but Lead Auditor can still view)
        const relevantReportRequests = Array.isArray(reportRequestsRes)
          ? reportRequestsRes.filter((rr: any) => {
              const status = String(rr.status || "").trim();
              return (
                status === "PendingFirstApproval" ||
                status === "PendingSecondApproval"
              );
            })
          : [];

        // Create a map of auditId -> status for easy lookup
        const auditStatusMap = new Map<string, string>();
        relevantReportRequests.forEach((rr: any) => {
          const auditId = rr.auditId;
          if (auditId) {
            const auditIdStr = String(auditId).trim();
            const status = String(rr.status || "").trim();
            auditStatusMap.set(auditIdStr, status);
          }
        });

        // Filter audits to only include those with relevant report requests
        const filteredAudits = (Array.isArray(plans) ? plans : [])
          .filter((a: any) => {
            const auditId = String(a.auditId || a.id || "").trim();
            return auditId && auditStatusMap.has(auditId);
          })
          .map((a: any) => {
            const auditId = String(a.auditId || a.id || "").trim();
            const status = auditStatusMap.get(auditId) || "";
            let title = a.title || a.auditTitle || "Untitled audit";
            // Remove "true" or "false" from title if present
            title = title.replace(/\s*(true|false)\s*$/i, "").trim();
            return {
              auditId: auditId,
              title: title,
              status: status,
            };
          })
          .filter((x: any) => x.auditId);

        setAudits(filteredAudits);
      } catch (error) {
        console.error("[LeadAuditor] Failed to load audits:", error);
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, [refreshTrigger]);

  // Load all 3 APIs when user selects an audit
  useEffect(() => {
    if (!selectedAuditId) {
      setDetail(null);
      setSummaryData(null);
      setFindingsActionsSummary(null);
      setReportRequest(null);
      return;
    }

    const loadAllData = async () => {
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(selectedAuditId);
        setDetail(res as FullDetailResponse);
      } catch (error) {
        console.error("Failed to load full detail:", error);
      } finally {
        setLoadingDetail(false);
      }

      setLoadingSummary(true);
      try {
        const summaryRes = await getAuditSummary(selectedAuditId);
        setSummaryData(summaryRes);
      } catch (error) {
        console.error("Failed to load summary:", error);
      } finally {
        setLoadingSummary(false);
      }

      setLoadingFindingsActionsSummary(true);
      try {
        const fasRes = await getAuditFindingsActionsSummary(selectedAuditId);
        setFindingsActionsSummary(fasRes);
      } catch (error) {
        console.error("Failed to load findings-actions-summary:", error);
      } finally {
        setLoadingFindingsActionsSummary(false);
      }
    };

    const loadReportRequest = async () => {
      setLoadingReportRequest(true);
      try {
        const rr = await getReportRequestByAuditId(selectedAuditId);
        if (rr) {
          setReportRequest({
            status: rr.status,
            reportRequestId: rr.reportRequestId,
            note: rr.note,
          });
        } else {
          setReportRequest(null);
        }
      } catch (error) {
        console.error("Failed to load report request:", error);
        setReportRequest(null);
      } finally {
        setLoadingReportRequest(false);
      }
    };

    loadAllData();
    loadReportRequest();
  }, [selectedAuditId]);

  const audit = detail?.audit ?? {};

  const unwrapArray = <T,>(value: any): T[] => {
    if (Array.isArray(value)) return value as T[];
    return unwrap<T>(value);
  };

  const schedulesArr = detail ? unwrapArray<any>(detail.schedules) : [];
  const scopeDepartmentsArr = detail
    ? unwrapArray<any>(detail.scopeDepartments)
    : [];
  const criteriaArr = detail ? unwrapArray<any>(detail.auditCriteriaMap) : [];
  const checklistArr = detail
    ? unwrapArray<any>(detail.auditChecklistTemplateMap)
    : [];
  const teamsArr = detail ? unwrapArray<any>(detail.teams) : [];

  const summaryFindings = summaryData?.findingsInAudit
    ? unwrapArray<any>(summaryData.findingsInAudit)
    : [];
  const findingsFromSummary =
    summaryFindings.length > 0 && summaryFindings[0]?.findings
      ? unwrapArray<any>(summaryFindings[0].findings)
      : [];

  const findingsArr =
    findingsFromSummary.length > 0
      ? findingsFromSummary
      : detail
      ? unwrapArray<any>(detail.findings)
      : [];

  const actionsArr = detail ? unwrapArray<any>(detail.actions) : [];
  const documentsArr = detail ? unwrapArray<any>(detail.documents) : [];

  const ownerOptionsForModal = useMemo(() => {
    const filtered = adminUsers.filter((u: any) => {
      const role = String(u?.roleName || u?.role || "").toLowerCase();
      return role.includes("auditee") || role.includes("owner");
    });
    return filtered.length ? filtered : adminUsers;
  }, [adminUsers]);

  const auditorOptionsForModal = useMemo(() => {
    const filtered = adminUsers.filter((u: any) => {
      const role = String(u?.roleName || u?.role || "").toLowerCase();
      return role.includes("auditor");
    });
    return filtered.length ? filtered : adminUsers;
  }, [adminUsers]);

  const currentUserIdForModal = useMemo(() => {
    if (!user) return null;
    const email = String(user.email || "").toLowerCase().trim();
    if (email) {
      const match = adminUsers.find(
        (u: any) => String(u?.email || "").toLowerCase().trim() === email
      );
      if (match?.userId) return String(match.userId);
      if (match?.$id) return String(match.$id);
    }
    if ((user as any)?.userId) {
      return String((user as any).userId);
    }
    return null;
  }, [adminUsers, user]);

  const planDetailsForModal = useMemo(() => {
    if (!detail?.audit) return null;
    const auditInfo = detail.audit;
    return {
      ...auditInfo,
      auditId: auditInfo.auditId || selectedAuditId,
      id: auditInfo.auditId || selectedAuditId,
      schedules: { values: schedulesArr },
      scopeDepartments: { values: scopeDepartmentsArr },
      auditTeams: { values: teamsArr },
      sensitiveAreasByDept: (detail as any)?.sensitiveAreasByDept || {},
      auditCriteriaMap: { values: criteriaArr },
      auditChecklistTemplateMap: { values: checklistArr },
    };
  }, [detail, selectedAuditId, schedulesArr, scopeDepartmentsArr, teamsArr, criteriaArr, checklistArr]);

  const isActionCompleted = (a: any) => {
    const st = String(a?.status || "").toLowerCase();
    return (
      (st.includes("completed") || st.includes("approved")) &&
      (!!a?.closedAt || !!a?.reviewFeedback || a?.progressPercent === 100)
    );
  };

  const getDeptName = useCallback(
    (deptId: string | number | null | undefined) => {
      if (deptId == null) return "N/A";
      const match = departments.find(
        (d) =>
          String(d.deptId) === String(deptId) ||
          String(d.deptId).toLowerCase() === String(deptId).toLowerCase()
      );
      return match?.name || String(deptId);
    },
    [departments]
  );

  const getUserName = useCallback(
    (userId: string | number | null | undefined) => {
      if (userId == null) return "N/A";
      const match = adminUsers.find(
        (u: any) =>
          String(u.userId || u.$id || u.id) === String(userId) ||
          String(u.userId || u.$id || u.id).toLowerCase() ===
            String(userId).toLowerCase()
      );
      return match?.fullName || match?.email || String(userId);
    },
    [adminUsers]
  );

  const getCriteriaName = useCallback(
    (criteriaId: string | null | undefined) => {
      if (criteriaId == null) return "N/A";
      const match = auditCriteria.find(
        (c: any) =>
          String(c.criteriaId || c.$id || c.id) === String(criteriaId) ||
          String(c.criteriaId || c.$id || c.id).toLowerCase() ===
            String(criteriaId).toLowerCase()
      );
      return match?.name || String(criteriaId);
    },
    [auditCriteria]
  );

  const getTemplateName = useCallback(
    (templateId: string | number | null | undefined) => {
      if (templateId == null) return "N/A";
      const match = checklistTemplates.find(
        (t: any) =>
          String(t.templateId || t.$id || t.id) === String(templateId) ||
          String(t.templateId || t.$id || t.id).toLowerCase() ===
            String(templateId).toLowerCase()
      );
      return match?.name || String(templateId);
    },
    [checklistTemplates]
  );

  const getTemplateInfoById = useCallback(
    (templateId: string | number | null | undefined) => {
      if (templateId == null) return null;
      const match = checklistTemplates.find(
        (t: any) =>
          String(t.templateId || t.$id || t.id) === String(templateId) ||
          String(t.templateId || t.$id || t.id).toLowerCase() ===
            String(templateId).toLowerCase()
      );
      if (!match) return null;
      return {
        name: match.title || match.name || `Template ${String(templateId)}`,
        version: match.version,
        description: match.description,
      };
    },
    [checklistTemplates]
  );

  const deptOptions = useMemo(() => {
    const opts = new Map<string, string>();
    findingsArr.forEach((f: any) => {
      const dept = f?.deptId != null ? String(f.deptId) : "N/A";
      const label = getDeptName(dept);
      opts.set(dept, label);
    });
    return Array.from(opts.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [findingsArr, getDeptName]);

  const findingsByIdMap = useMemo(() => {
    const map = new Map<string, any>();
    findingsArr.forEach((f: any) => {
      const id = String(f.findingId || "").trim();
      if (id) map.set(id, f);
    });
    return map;
  }, [findingsArr]);

  const filteredFindingsArr = useMemo(() => {
    if (!deptFilter) return findingsArr;
    return findingsArr.filter((f: any) => {
      const dept = f?.deptId != null ? String(f.deptId) : "N/A";
      return dept === deptFilter;
    });
  }, [deptFilter, findingsArr]);

  const filteredActionsArr = useMemo(() => {
    if (!deptFilter) return actionsArr;
    return actionsArr.filter((a: any) => {
      const assignedDept =
        a?.assignedDeptId != null ? String(a.assignedDeptId) : null;
      if (assignedDept && assignedDept === deptFilter) return true;
      const f = findingsByIdMap.get(String(a.findingId || "").trim());
      const findingDept = f?.deptId != null ? String(f.deptId) : null;
      if (findingDept && findingDept === deptFilter) return true;
      return false;
    });
  }, [deptFilter, actionsArr, findingsByIdMap]);

  // Use counts from filtered lists
  const findingsCount = filteredFindingsArr.length;
  const openFindingsFiltered = filteredFindingsArr.filter((f: any) => {
    const st = String(f?.status || "").toLowerCase();
    return !st.includes("closed") && !st.includes("complete");
  }).length;
  const closedFindingsFiltered = filteredFindingsArr.filter((f: any) => {
    const st = String(f?.status || "").toLowerCase();
    return st.includes("closed") || st.includes("complete");
  }).length;

  const actionsCount = filteredActionsArr.length;
  const completedActionsFiltered =
    filteredActionsArr.filter(isActionCompleted).length;
  const overdueActionsFiltered = filteredActionsArr.filter((a: any) => {
    if (isActionCompleted(a)) return false;
    if (!a?.dueDate) return false;
    const dl = new Date(a.dueDate);
    if (isNaN(dl.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dl.setHours(0, 0, 0, 0);
    return dl < today;
  });

  const actionsByFindingMap = useMemo(() => {
    const map = new Map<string, any[]>();
    actionsArr.forEach((a: any) => {
      const fid = String(a.findingId || "").trim();
      if (!fid) return;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(a);
    });
    return map;
  }, [actionsArr]);

  const isFindingResolved = (relatedActions: any[]) => {
    if (!relatedActions || !relatedActions.length) return false;
    return relatedActions.some(isActionCompleted);
  };

  const isFindingOverdue = (f: any, relatedActions: any[]) => {
    const resolved = isFindingResolved(relatedActions);
    if (resolved) return false;
    if (!f?.deadline) return false;
    const dl = new Date(f.deadline);
    if (isNaN(dl.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dl.setHours(0, 0, 0, 0);
    return dl < today;
  };

  const findingsDepartmentAgg = useMemo(() => {
    const agg: Record<
      string,
      { deptId: string; total: number; resolved: number; overdue: number }
    > = {};
    const source = filteredFindingsArr;
    source.forEach((f: any) => {
      const dept = f?.deptId != null ? String(f.deptId) : "N/A";
      if (!agg[dept])
        agg[dept] = { deptId: dept, total: 0, resolved: 0, overdue: 0 };
      const related = actionsByFindingMap.get(String(f.findingId || "")) || [];
      const resolved = isFindingResolved(related);
      const overdue = isFindingOverdue(f, related);
      agg[dept].total += 1;
      if (resolved) agg[dept].resolved += 1;
      if (overdue) agg[dept].overdue += 1;
    });
    return Object.values(agg);
  }, [filteredFindingsArr, actionsByFindingMap]);

  const period = useMemo(() => {
    const from = audit.startDate
      ? new Date(audit.startDate).toLocaleDateString()
      : "";
    const to = audit.endDate
      ? new Date(audit.endDate).toLocaleDateString()
      : "";
    if (!from && !to) return "";
    if (from && to) return `${from} – ${to}`;
    return from || to;
  }, [audit.startDate, audit.endDate]);

  const findingsSeverityChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      {
        name: "Major",
        value: findingsActionsSummary.findingMajor || 0,
        color: "#ef4444",
      },
      {
        name: "Medium",
        value: findingsActionsSummary.findingMedium || 0,
        color: "#f59e0b",
      },
      {
        name: "Minor",
        value: findingsActionsSummary.findingMinor || 0,
        color: "#10b981",
      },
    ];
  }, [findingsActionsSummary]);

  const actionsStatusChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      {
        name: "Completed",
        value: findingsActionsSummary.completedActions || 0,
        color: "#10b981",
      },
      {
        name: "Overdue",
        value: findingsActionsSummary.overdueActions || 0,
        color: "#ef4444",
      },
    ];
  }, [findingsActionsSummary]);

  const actionsSeverityBreakdownData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      {
        severity: "Major",
        completed: findingsActionsSummary.completedActionsMajor || 0,
        overdue: findingsActionsSummary.overdueActionsMajor || 0,
      },
      {
        severity: "Medium",
        completed: findingsActionsSummary.completedActionsMedium || 0,
        overdue: findingsActionsSummary.overdueActionsMedium || 0,
      },
      {
        severity: "Minor",
        completed: findingsActionsSummary.completedActionsMinor || 0,
        overdue: findingsActionsSummary.overdueActionsMinor || 0,
      },
    ];
  }, [findingsActionsSummary]);

  const findingsOverviewCards = useMemo(() => {
    if (!findingsActionsSummary) return [];
    const total = findingsActionsSummary.totalFindings || 0;
    const completed = findingsActionsSummary.completedActions || 0;
    const overdue = findingsActionsSummary.overdueActions || 0;
    return [
      {
        label: "Total Findings",
        value: total,
        color: "text-slate-900",
        bg: "from-slate-100 to-white",
        border: "border-slate-200",
      },
      {
        label: "Completed / Remediated",
        value: completed,
        color: "text-emerald-800",
        bg: "from-emerald-50 to-white",
        border: "border-emerald-200",
      },
      {
        label: "Overdue / Pending",
        value: overdue,
        color: "text-red-800",
        bg: "from-red-50 to-white",
        border: "border-red-200",
      },
    ];
  }, [findingsActionsSummary]);

  const severityCards = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      {
        title: "Major findings",
        count: findingsActionsSummary.findingMajor || 0,
        completed: findingsActionsSummary.completedActionsMajor || 0,
        overdue: findingsActionsSummary.overdueActionsMajor || 0,
        color: "red",
      },
      {
        title: "Medium findings",
        count: findingsActionsSummary.findingMedium || 0,
        completed: findingsActionsSummary.completedActionsMedium || 0,
        overdue: findingsActionsSummary.overdueActionsMedium || 0,
        color: "amber",
      },
      {
        title: "Minor findings",
        count: findingsActionsSummary.findingMinor || 0,
        completed: findingsActionsSummary.completedActionsMinor || 0,
        overdue: findingsActionsSummary.overdueActionsMinor || 0,
        color: "emerald",
      },
    ];
  }, [findingsActionsSummary]);

  const headerSubtitle = useMemo(() => {
    if (!selectedAuditId) {
      return audits.length === 0
        ? "No audit reports submitted for review yet. Auditors need to submit their final summary reports first."
        : "Select an audit below to review the final summary report submitted by Auditor.";
    }
    if (loadingDetail) {
      return "Loading audit information...";
    }
    return "Review and approve/reject the final audit summary report.";
  }, [selectedAuditId, loadingDetail, audits.length]);

  const isImage = (contentType?: string, fileName?: string): boolean => {
    if (contentType) {
      return contentType.startsWith("image/");
    }
    if (fileName) {
      const ext = fileName.toLowerCase().split(".").pop();
      return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(
        ext || ""
      );
    }
    return false;
  };

  const toggleImageExpand = (id: string) => {
    setExpandedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFileAction = (file: {
    attachmentId?: string;
    docId?: string;
    blobPath?: string;
    filePath?: string;
    contentType?: string;
    fileName?: string;
  }) => {
    const fileId = file.attachmentId || file.docId;
    const filePath = file.blobPath || file.filePath;
    const fileName = file.fileName || "file";
    const isImg = isImage(file.contentType, fileName);

    if (isImg && fileId) {
      toggleImageExpand(fileId);
      return;
    }

    if (filePath) {
      window.open(filePath, "_blank");
    } else {
      alert("File path not available. Please contact support.");
    }
  };

  const handleSendToDirector = () => {
    if (!reportRequest?.reportRequestId) {
      alert("No report request found.");
      return;
    }
    setShowCommentsModal(true);
  };

  const handleSubmitComments = async () => {
    if (!reportRequest?.reportRequestId) {
      alert("No report request found.");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to send this report to Director for final approval?"
      )
    ) {
      return;
    }

    setSubmitting(true);
    setShowCommentsModal(false);
    try {
      await approveFinalReport(reportRequest.reportRequestId, comments || "");

      // Reload report request to get updated status
      setTimeout(async () => {
        try {
          const rr = await getReportRequestByAuditId(selectedAuditId);
          if (rr) {
            setReportRequest({
              status: rr.status,
              reportRequestId: rr.reportRequestId,
              note: rr.note,
            });
          }
        } catch (error) {
          console.error("Failed to reload report request:", error);
        }
      }, 500);

      // Show success message
      alert(
        "Report sent to Director successfully! The audit has been forwarded and will no longer appear in your pending list."
      );

      // Clear comments
      setComments("");

      // Delay refresh to allow user to see the success state
      // Don't clear selectedAuditId immediately - let user see the result
      setTimeout(() => {
        setRefreshTrigger((prev) => prev + 1);
        // Optionally clear selection after a delay, or let user manually clear it
        // setSelectedAuditId("");
      }, 2000);
    } catch (error: any) {
      console.error("Failed to send report to Director:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send report to Director. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const isPendingApproval = reportRequest?.status === "PendingFirstApproval";

  // Calculate current step based on report request status
  const getCurrentStep = useMemo(() => {
    if (!selectedAuditId || !reportRequest?.status) {
      return 1; // No report request yet
    }
    const status = String(reportRequest.status || "").trim();
    if (status === "PendingFirstApproval") {
      return 2; // Waiting for Lead Auditor to send to Director
    }
    if (status === "PendingSecondApproval") {
      return 3; // Already sent to Director
    }
    // If status is something else, show step 2 (Lead Auditor's step)
    return 2;
  }, [selectedAuditId, reportRequest?.status]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Final Summary Review"
          subtitle={headerSubtitle}
          rightContent={
            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="flex flex-col items-start gap-1 md:items-end">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Audit
                </label>
                <select
                  value={selectedAuditId}
                  onChange={(e) => setSelectedAuditId(e.target.value)}
                  className="min-w-[260px] px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900"
                  disabled={submitting}
                >
                  <option value="">
                    {loadingAudits ? "Loading audits..." : "Select audit..."}
                  </option>
                  {audits.map((a) => (
                    <option key={a.auditId} value={a.auditId}>
                      {a.title}
                    </option>
                  ))}
                  {/* Keep selected audit in dropdown even if it's no longer in filtered list (e.g., after submission) */}
                  {selectedAuditId &&
                    !audits.find((a) => a.auditId === selectedAuditId) &&
                    detail?.audit?.title && (
                      <option value={selectedAuditId} disabled>
                        {detail.audit.title
                          .replace(/\s*(true|false)\s*$/i, "")
                          .trim()}
                      </option>
                    )}
                </select>
              </div>
              {selectedAuditId && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAuditDetailModal(true)}
                    className="px-3 py-1.5 border border-primary-600 text-primary-700 text-xs font-semibold rounded-md hover:bg-primary-50 transition-colors"
                  >
                    View audit details
                  </button>
                  {loadingReportRequest ? (
                    <div className="text-xs text-gray-500">
                      Checking status...
                    </div>
                  ) : (
                    isPendingApproval && (
                      <button
                        onClick={handleSendToDirector}
                        disabled={submitting}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send to Director"
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          }
        />

        <StageBar current={getCurrentStep} />

        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
              Choose an audit from the dropdown above to review its final
              summary report.
            </div>
          ) : loadingDetail ||
            loadingSummary ||
            loadingFindingsActionsSummary ? (
            <div className="bg-white border border-primary-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
              <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading audit data...</span>
            </div>
          ) : !detail ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              Unable to load audit detail for the selected audit. Please try
              again or contact system support.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Tabs */}
              <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                <div className="border-b border-primary-200">
                  <div className="flex items-center gap-1 px-4 py-2">
                    {[
                      { id: "findings", label: "Findings" },
                      { id: "overdueActions", label: "Overdue Actions" },
                      { id: "charts", label: "Charts" },
                      { id: "documents", label: "Documents" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setMainTab(tab.id as any)}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                          mainTab === tab.id
                            ? "bg-primary-600 text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  {/* Findings Tab */}
                  {mainTab === "findings" && (
                    <div className="space-y-4">
                      {/* Filter */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700">Filter by Department:</label>
                        <select
                          value={deptFilter}
                          onChange={(e) => setDeptFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">All</option>
                          {deptOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        {deptFilter && (
                          <button
                            onClick={() => setDeptFilter("")}
                            className="text-xs text-primary-600 hover:text-primary-700 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Findings Table */}
                      <FindingsTable
                        findings={filteredFindingsArr}
                        actionsByFindingMap={actionsByFindingMap}
                        expandedFindingId={expandedFindingId}
                        onToggleExpand={setExpandedFindingId}
                        getDeptName={getDeptName}
                        unwrapArray={unwrapArray}
                        isImage={isImage}
                        expandedImages={expandedImages}
                        handleFileAction={handleFileAction}
                        isActionCompleted={isActionCompleted}
                      />
                    </div>
                  )}

                  {/* Overdue Actions Tab */}
                  {mainTab === "overdueActions" && (
                    <OverdueActionsTable
                      overdueActions={overdueActionsFiltered}
                      findingsByIdMap={findingsByIdMap}
                      getDeptName={getDeptName}
                    />
                  )}

                  {/* Charts Tab */}
                  {mainTab === "charts" && findingsActionsSummary && (
                    <ChartsSection
                      findingsActionsSummary={findingsActionsSummary}
                      fasTab={fasTab}
                      onTabChange={setFasTab}
                      findingsOverviewCards={findingsOverviewCards}
                      severityCards={severityCards}
                      findingsSeverityChartData={findingsSeverityChartData}
                      actionsStatusChartData={actionsStatusChartData}
                      actionsSeverityBreakdownData={actionsSeverityBreakdownData}
                    />
                  )}

                  {/* Documents Tab */}
                  {mainTab === "documents" && (
                    <DocumentsSection
                      documents={documentsArr}
                      isImage={isImage}
                      expandedImages={expandedImages}
                      handleFileAction={handleFileAction}
                      toggleImageExpand={toggleImageExpand}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Comments Modal */}
        {showCommentsModal && (
          <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowCommentsModal(false)}
            />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Add Comments
                  </h3>
                  <p className="text-xs text-gray-500">
                    Optional comments before sending to Director
                  </p>
                </div>
                <button
                  onClick={() => setShowCommentsModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  rows={6}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="block w-full border-gray-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Add any comments before sending to Director (optional)..."
                />
              </div>
              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCommentsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitComments}
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send to Director"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAuditDetailModal && planDetailsForModal && (
          <PlanDetailsModal
            showModal={showAuditDetailModal}
            selectedPlanDetails={planDetailsForModal}
            templatesForPlan={checklistArr}
            onClose={() => setShowAuditDetailModal(false)}
            getCriterionName={getCriteriaName}
            getDepartmentName={getDeptName}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            getAuditTypeBadgeColor={getAuditTypeBadgeColor}
            ownerOptions={ownerOptionsForModal}
            auditorOptions={auditorOptionsForModal}
            getTemplateName={getTemplateName}
            getTemplateInfo={getTemplateInfoById}
            currentUserId={currentUserIdForModal}
            auditTeamsForPlan={teamsArr}
          />
        )}

      </div>
    </MainLayout>
  );
}
