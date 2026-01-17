import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { DataTable } from "../../../components/DataTable";
import { Pagination } from "../../../components/Pagination";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary } from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { submitFinalReport, getReportRequestFromFinalSubmit } from "../../../api/reportRequest";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { getChecklistTemplates } from "../../../api/checklists";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { PlanDetailsModal } from "../AuditPlanning/components/PlanDetailsModal";
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor, getSeverityChartColor } from "../../../constants";
import { FindingsTable, OverdueActionsTable, ChartsSection, DocumentsSection } from "../../Shared/FinalReport";

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

export default function AuditorFinalSummaryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { auditId: auditIdFromUrl } = useParams<{ auditId?: string }>();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<Array<{ auditId: string; title: string; type: string; startDate: string; endDate: string; scope: string }>>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>(auditIdFromUrl || "");
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [detail, setDetail] = useState<FullDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // State for Summary API data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // State for Findings-Actions-Summary API data (for charts)
  const [findingsActionsSummary, setFindingsActionsSummary] = useState<any>(null);
  const [loadingFindingsActionsSummary, setLoadingFindingsActionsSummary] = useState(false);
  const [fasTab, setFasTab] = useState<"overview" | "severity" | "actions">("overview");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [mainTab, setMainTab] = useState<"findings" | "overdueActions" | "charts" | "documents">("findings");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Array<{ deptId: string | number; name: string }>>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [auditCriteria, setAuditCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  
  // State to track expanded images (Set of attachmentId/docId)
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  
  const [reportRequest, setReportRequest] = useState<any>(null);
  const [loadingReportRequest, setLoadingReportRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);

  // Load list of audits for dropdown (GET /Audits)
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const [plansRes, teamsRes, usersRes, deptsRes, criteriaRes, templatesRes] = await Promise.all([
          getAuditPlans(),
          getAuditTeam().catch(() => []),
          getAdminUsers().catch(() => []),
          getDepartments().catch(() => []),
          getAuditCriteria().catch(() => []),
          getChecklistTemplates().catch(() => []),
        ]);

        const plans = unwrap(plansRes);
        const deptList = Array.isArray(deptsRes)
          ? deptsRes.map((d: any) => ({
              deptId: d.deptId ?? d.id ?? d.$id,
              name: d.name || d.code || String(d.deptId ?? d.id ?? d.$id ?? "N/A"),
            }))
          : [];
        setDepartments(deptList);
        const teams = Array.isArray(teamsRes) ? teamsRes : [];
        const adminUsersArr = Array.isArray(usersRes) ? usersRes : [];
        setAdminUsers(adminUsersArr);
        const criteriaArr = Array.isArray(criteriaRes) ? criteriaRes : [];
        setAuditCriteria(criteriaArr);
        const templatesArr = Array.isArray(templatesRes) ? templatesRes : [];
        setChecklistTemplates(templatesArr);

        // Resolve current userId from email (fallback: user.userId if present)
        let currentUserId: string | null = null;
        if (user?.email) {
          const found = adminUsersArr.find((u: any) => {
            const uEmail = String(u?.email || "").toLowerCase().trim();
            const userEmail = String(user.email || "").toLowerCase().trim();
            return uEmail === userEmail;
          });
          if (found?.userId) {
            currentUserId = String(found.userId);
          } else if (found?.$id) {
            currentUserId = String(found.$id);
          }
        }
        if (!currentUserId && (user as any)?.userId) {
          currentUserId = String((user as any).userId);
        }
        const normalizedCurrentUserId = currentUserId ? currentUserId.toLowerCase().trim() : null;

        // Collect audits where user is in team
        const userAuditIds = new Set<string>();
        if (normalizedCurrentUserId) {
          teams.forEach((m: any) => {
            const memberUserId = m?.userId ?? m?.id ?? m?.$id;
            const normalizedMemberId = memberUserId != null ? String(memberUserId).toLowerCase().trim() : null;
            if (normalizedMemberId === normalizedCurrentUserId) {
              const auditId = m?.auditId ?? m?.auditPlanId ?? m?.planId ?? m?.id ?? m?.$id;
              if (auditId) {
                const val = String(auditId).trim();
                if (val) {
                  userAuditIds.add(val);
                  userAuditIds.add(val.toLowerCase());
                }
              }
            }
          });
        }

        // Collect audits where user is creator
        const creatorAuditIds = new Set<string>();
        if (normalizedCurrentUserId) {
          (Array.isArray(plans) ? plans : []).forEach((a: any) => {
            const createdBy = a?.createdBy || a?.createdByUser?.userId || a?.createdByUser?.id || a?.createdByUser?.$id;
            const createdByNorm = createdBy ? String(createdBy).toLowerCase().trim() : null;
            if (createdByNorm === normalizedCurrentUserId) {
              const auditId = a?.auditId || a?.id || a?.$id;
              if (auditId) {
                const val = String(auditId).trim();
                if (val) {
                  creatorAuditIds.add(val);
                  creatorAuditIds.add(val.toLowerCase());
                }
              }
            }
          });
        }

        // Helper to format date
        const formatDate = (dateStr: string | null | undefined): string => {
          if (!dateStr) return "—";
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "—";
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
          } catch {
            return "—";
          }
        };

        // Helper to format scope
        const formatScope = (scope: string | null | undefined): string => {
          if (!scope) return "—";
          const scopeLower = String(scope).toLowerCase().trim();
          if (scopeLower.includes('entire') || scopeLower.includes('academy')) {
            return "Entire Aviation Academy";
          }
          return "Department";
        };

        const filtered = (Array.isArray(plans) ? plans : [])
          .filter((a: any) => {
            const auditId = a?.auditId || a?.id || a?.$id;
            if (!auditId) return false;
            const auditIdStr = String(auditId).trim();
            const auditIdLower = auditIdStr.toLowerCase();
            return userAuditIds.has(auditIdStr) || userAuditIds.has(auditIdLower) || creatorAuditIds.has(auditIdStr) || creatorAuditIds.has(auditIdLower);
          })
          .map((a: any) => ({
            auditId: a.auditId || a.id || "",
            title: a.title || a.auditTitle || "Untitled audit",
            type: a.type || a.auditType || "—",
            startDate: formatDate(a.startDate || a.periodFrom),
            endDate: formatDate(a.endDate || a.periodTo),
            scope: formatScope(a.scope),
          }))
          .filter((x: any) => x.auditId);

        setAudits(filtered);
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

  // Sync selectedAuditId with URL param
  useEffect(() => {
    if (auditIdFromUrl && auditIdFromUrl !== selectedAuditId) {
      setSelectedAuditId(auditIdFromUrl);
    } else if (!auditIdFromUrl && selectedAuditId) {
      // If URL param is removed but we still have selectedAuditId, clear it
      setSelectedAuditId("");
    }
  }, [auditIdFromUrl]);

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
      // Load full-detail (for actions and general info)
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(selectedAuditId);
        setDetail(res as FullDetailResponse);
      } catch (error) {
        console.error('Failed to load full detail:', error);
      } finally {
        setLoadingDetail(false);
      }

      // Load Summary (for findings details)
      setLoadingSummary(true);
      try {
        const summaryRes = await getAuditSummary(selectedAuditId);
        setSummaryData(summaryRes);
      } catch (error) {
        console.error('Failed to load summary:', error);
      } finally {
        setLoadingSummary(false);
      }

      // Load Findings-Actions-Summary (for charts)
      setLoadingFindingsActionsSummary(true);
      try {
        const fasRes = await getAuditFindingsActionsSummary(selectedAuditId);
        setFindingsActionsSummary(fasRes);
      } catch (error) {
        console.error('Failed to load findings-actions-summary:', error);
      } finally {
        setLoadingFindingsActionsSummary(false);
      }
    };

    loadAllData();
  }, [selectedAuditId]);

  // Load report request to know if already submitted
  useEffect(() => {
    if (!selectedAuditId) {
      setReportRequest(null);
      return;
    }
    const loadRR = async () => {
      setLoadingReportRequest(true);
      try {
        // Use getReportRequestFromFinalSubmit to only get status from submitFinalReport API
        const rr = await getReportRequestFromFinalSubmit(selectedAuditId);
        setReportRequest(rr || null);
      } catch (err) {
        console.error('Failed to load report request:', err);
        setReportRequest(null);
      } finally {
        setLoadingReportRequest(false);
      }
    };
    loadRR();
  }, [selectedAuditId]);


  // Safely unwrap potential $values wrappers from backend
  const unwrapArray = <T,>(value: any): T[] => {
    if (Array.isArray(value)) return value as T[];
    return unwrap<T>(value);
  };

  const schedulesArr = detail ? unwrapArray<any>(detail.schedules) : [];
  const scopeDepartmentsArr = detail ? unwrapArray<any>(detail.scopeDepartments) : [];
  const criteriaArr = detail ? unwrapArray<any>(detail.auditCriteriaMap) : [];
  const checklistArr = detail ? unwrapArray<any>(detail.auditChecklistTemplateMap) : [];
  const teamsArr = detail ? unwrapArray<any>(detail.teams) : [];

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
  
  // Get findings from Summary API (more detailed) - avoid duplication
  const summaryFindings = summaryData?.findingsInAudit ? unwrapArray<any>(summaryData.findingsInAudit) : [];
  const findingsFromSummary = summaryFindings.length > 0 && summaryFindings[0]?.findings 
    ? unwrapArray<any>(summaryFindings[0].findings) 
    : [];
  
  // Fallback to full-detail findings if Summary doesn't have them
  const findingsArr = findingsFromSummary.length > 0 
    ? findingsFromSummary 
    : (detail ? unwrapArray<any>(detail.findings) : []);
  
  // Get actions from full-detail (Summary doesn't have actions)
  const actionsArr = detail ? unwrapArray<any>(detail.actions) : [];
  const documentsArr = detail ? unwrapArray<any>(detail.documents) : [];

  const isActionCompleted = (a: any) => {
    const st = String(a?.status || '').toLowerCase();
    return (st.includes('completed') || st.includes('approved')) && (!!a?.closedAt || !!a?.reviewFeedback || a?.progressPercent === 100);
  };

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

  // Department filter options & filtered lists
  const getDeptName = useCallback(
    (deptId: string | number | null | undefined) => {
      if (deptId == null) return "N/A";
      const match = departments.find(
        (d) => String(d.deptId) === String(deptId) || String(d.deptId).toLowerCase() === String(deptId).toLowerCase()
      );
      return match?.name || String(deptId);
    },
    [departments]
  );


  const getCriteriaName = useCallback(
    (criteriaId: string | null | undefined) => {
      if (criteriaId == null) return "N/A";
      const match = auditCriteria.find(
        (c: any) =>
          String(c.criteriaId || c.$id || c.id) === String(criteriaId) ||
          String(c.criteriaId || c.$id || c.id).toLowerCase() === String(criteriaId).toLowerCase()
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
          String(t.templateId || t.$id || t.id).toLowerCase() === String(templateId).toLowerCase()
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
          String(t.templateId || t.$id || t.id).toLowerCase() === String(templateId).toLowerCase()
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
      const dept = f?.deptId != null ? String(f.deptId) : 'N/A';
      const label = getDeptName(dept);
      opts.set(dept, label);
    });
    return Array.from(opts.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [findingsArr, getDeptName]);

  const findingsByIdMap = useMemo(() => {
    const map = new Map<string, any>();
    findingsArr.forEach((f: any) => {
      const id = String(f.findingId || '').trim();
      if (id) map.set(id, f);
    });
    return map;
  }, [findingsArr]);

  const filteredFindingsArr = useMemo(() => {
    if (!deptFilter) return findingsArr;
    return findingsArr.filter((f: any) => {
      const dept = f?.deptId != null ? String(f.deptId) : 'N/A';
      return dept === deptFilter;
    });
  }, [deptFilter, findingsArr]);

  const filteredActionsArr = useMemo(() => {
    if (!deptFilter) return actionsArr;
    return actionsArr.filter((a: any) => {
      const assignedDept = a?.assignedDeptId != null ? String(a.assignedDeptId) : null;
      if (assignedDept && assignedDept === deptFilter) return true;
      const f = findingsByIdMap.get(String(a.findingId || '').trim());
      const findingDept = f?.deptId != null ? String(f.deptId) : null;
      if (findingDept && findingDept === deptFilter) return true;
      return false;
    });
  }, [deptFilter, actionsArr, findingsByIdMap]);

  const overdueActionsFiltered = filteredActionsArr.filter((a: any) => {
    if (isActionCompleted(a)) return false;
    if (!a?.dueDate) return false;
    const dl = new Date(a.dueDate);
    if (isNaN(dl.getTime())) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    dl.setHours(0,0,0,0);
    return dl < today;
  });

  const actionsByFindingMap = useMemo(() => {
    const map = new Map<string, any[]>();
    actionsArr.forEach((a: any) => {
      const fid = String(a.findingId || '').trim();
      if (!fid) return;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(a);
    });
    return map;
  }, [actionsArr]);


  // Prepare chart data from findings-actions-summary
  const findingsSeverityChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { name: 'Major', value: findingsActionsSummary.findingMajor || 0, color: getSeverityChartColor('Major') },
      { name: 'Medium', value: findingsActionsSummary.findingMedium || 0, color: getSeverityChartColor('Medium') },
      { name: 'Minor', value: findingsActionsSummary.findingMinor || 0, color: getSeverityChartColor('Minor') },
    ];
  }, [findingsActionsSummary]);
  
  const actionsStatusChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { name: 'Completed', value: findingsActionsSummary.completedActions || 0, color: '#10b981' },
      { name: 'Overdue', value: findingsActionsSummary.overdueActions || 0, color: '#ef4444' },
    ];
  }, [findingsActionsSummary]);
  
  const actionsSeverityBreakdownData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { 
        severity: 'Major', 
        completed: findingsActionsSummary.completedActionsMajor || 0,
        overdue: findingsActionsSummary.overdueActionsMajor || 0,
      },
      { 
        severity: 'Medium', 
        completed: findingsActionsSummary.completedActionsMedium || 0,
        overdue: findingsActionsSummary.overdueActionsMedium || 0,
      },
      { 
        severity: 'Minor', 
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
      { label: "Total Findings", value: total, color: "text-slate-900", bg: "from-slate-100 to-white", border: "border-slate-200" },
      { label: "Completed / Remediated", value: completed, color: "text-emerald-800", bg: "from-emerald-50 to-white", border: "border-emerald-200" },
      { label: "Overdue / Pending", value: overdue, color: "text-red-800", bg: "from-red-50 to-white", border: "border-red-200" },
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
      return "Select an audit below to view its full detail and prepare your final summary offline.";
    }
    if (loadingDetail) {
      return "Loading audit information from full-detail API...";
    }
    
  }, [selectedAuditId, loadingDetail]);

  // Helper: Check if file is an image
  const isImage = (contentType?: string, fileName?: string): boolean => {
    if (contentType) {
      return contentType.startsWith("image/");
    }
    if (fileName) {
      const ext = fileName.toLowerCase().split(".").pop();
      return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext || "");
    }
    return false;
  };

  // Helper: Toggle image expand/collapse
  const toggleImageExpand = (id: string) => {
    setExpandedImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Helper: Handle file download/view
  const handleFileAction = (
    file: { 
      attachmentId?: string;
      docId?: string;
      blobPath?: string; 
      filePath?: string;
      contentType?: string;
      fileName?: string;
    }
  ) => {
    const fileId = file.attachmentId || file.docId;
    const filePath = file.blobPath || file.filePath;
    const fileName = file.fileName || "file";
    const isImg = isImage(file.contentType, fileName);

    // If it's an image, toggle expand instead of opening blobPath
    if (isImg && fileId) {
      toggleImageExpand(fileId);
      return;
    }

    // For non-images, open blobPath directly
    if (filePath) {
      // blobPath should already be a full URL (from Firebase), so open it directly
      window.open(filePath, "_blank");
    } else {
      alert("File path not available. Please contact support.");
    }
  };

  // Handle submit final report
  const handleSubmitReport = async () => {
    if (!selectedAuditId) {
      alert("Please select an audit first.");
      return;
    }

    if (!window.confirm("Are you sure you want to submit this final audit summary report to Lead Auditor for review?")) {
      return;
    }

    setSubmitting(true);
    try {
      await submitFinalReport(selectedAuditId);
      
      // Reload report request to update status
      if (selectedAuditId) {
        try {
          // Use getReportRequestFromFinalSubmit to only get status from submitFinalReport API
          const rr = await getReportRequestFromFinalSubmit(selectedAuditId);
          setReportRequest(rr || null);
        } catch (err) {
          console.error('Failed to reload report request:', err);
        }
      }
      
      alert("Report submitted successfully! Lead Auditor will be notified.");
    } catch (error: any) {
      console.error("Failed to submit report:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to submit report. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if report has been submitted
  // Only consider as submitted if reportRequest exists AND has a valid submitted status
  // Allow resubmit if status is "Returned" or "Rejected"
  const alreadySubmitted = Boolean(
    reportRequest?.status && 
    (reportRequest.status === 'PendingFirstApproval' || 
     reportRequest.status === 'PendingSecondApproval' )
    //  reportRequest.status === 'Approved')
  );
  const canSubmit = selectedAuditId && 
    !loadingReportRequest && 
    !submitting &&
    !alreadySubmitted;

  // Pagination logic
  const totalPages = Math.ceil(audits.length / itemsPerPage);
  const paginatedAudits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return audits.slice(startIndex, endIndex);
  }, [audits, currentPage]);

  // Reset to page 1 when audits change
  useEffect(() => {
    setCurrentPage(1);
  }, [audits.length]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Prepare Final Audit Summary Report"
          subtitle={headerSubtitle}
          rightContent={
            selectedAuditId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/auditor/final-summary')}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back to List
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuditDetailModal(true)}
                  className="px-3 py-1.5 border border-primary-600 text-primary-700 text-xs font-semibold rounded-md hover:bg-primary-50 transition-colors"
                >
                  View audit details
                </button>
                {loadingReportRequest ? (
                  <div className="text-xs text-gray-500">Checking status...</div>
                ) : (
                  <button
                    onClick={handleSubmitReport}
                    disabled={!canSubmit || submitting || alreadySubmitted}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : alreadySubmitted ? (
                      "Submitted"
                    ) : (
                      "Submit to Lead Auditor"
                    )}
                  </button>
                )}
              </div>
            )
          }
        />

        {/* Content */}
        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-primary-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Select an Audit</h3>
                <p className="text-sm text-gray-500 mt-1">Choose an audit from the table below to view its final summary report.</p>
              </div>
              <DataTable
                columns={[
                  {
                    key: "title",
                    header: "TITLE",
                    render: (row) => (
                      <div
                        onClick={() => navigate(`/auditor/final-summary/${row.auditId}`)}
                        className="cursor-pointer hover:text-primary-600 font-medium"
                      >
                        {row.title}
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "TYPE",
                    accessor: "type",
                    cellClassName: "text-gray-600",
                  },
                  {
                    key: "startDate",
                    header: "START DATE",
                    accessor: "startDate",
                    cellClassName: "text-gray-600",
                  },
                  {
                    key: "endDate",
                    header: "END DATE",
                    accessor: "endDate",
                    cellClassName: "text-gray-600",
                  },
                  {
                    key: "scope",
                    header: "SCOPE",
                    accessor: "scope",
                    cellClassName: "text-gray-600",
                  },
                  {
                    key: "action",
                    header: "ACTION",
                    align: "center",
                    render: (row) => (
                      <button
                        onClick={() => navigate(`/auditor/final-summary/${row.auditId}`)}
                        className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 transition-colors"
                      >
                        View
                      </button>
                    ),
                  },
                ]}
                data={paginatedAudits}
                loading={loadingAudits}
                loadingMessage="Loading audits..."
                emptyState="No audits available."
                rowKey={(row) => row.auditId}
                getRowClassName={() => {
                  return "border-b border-gray-100 transition-colors hover:bg-primary-50 cursor-pointer";
                }}
                bodyClassName=""
              />
              {totalPages > 1 && audits.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                Click on an audit row to view its final summary report.
              </div>
            </div>
          ) : (loadingDetail || loadingSummary || loadingFindingsActionsSummary) ? (
            <div className="bg-white border border-primary-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
              <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading audit data...</span>
            </div>
          ) : !detail ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              Unable to load audit detail for the selected audit. Please try again or contact system support.
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
                      { id: "documents", label: "History Upload" }
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

