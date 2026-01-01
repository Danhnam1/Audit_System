import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary } from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { submitFinalReport, getReportRequestByAuditId } from "../../../api/reportRequest";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { getChecklistTemplates } from "../../../api/checklists";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const StageBar = ({ current }: { current: number }) => {
  const steps = [
    'Auditor submits final summary',
    'Lead Auditor submits to Director',
    'Director receives & calculates',
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
            ? 'bg-primary-500 text-white border-2 border-primary-500 shadow-md'
            : isCurrent
              ? 'bg-white text-primary-700 border-2 border-primary-500 ring-2 ring-primary-200 shadow-lg'
              : 'bg-gray-100 text-gray-700 border-2 border-gray-400';

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
              <p className="mt-2 text-[12px] text-center text-gray-700 leading-tight px-1 font-medium">{label}</p>
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

export default function AuditorFinalSummaryPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<Array<{ auditId: string; title: string }>>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [loadingAudits, setLoadingAudits] = useState(false);

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
          }))
          .filter((x: any) => x.auditId);

        setAudits(filtered);
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

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
        const rr = await getReportRequestByAuditId(selectedAuditId);
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

  const audit = detail?.audit ?? {};

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

  const getUserName = useCallback(
    (userId: string | number | null | undefined) => {
      if (userId == null) return "N/A";
      const match = adminUsers.find(
        (u: any) =>
          String(u.userId || u.$id || u.id) === String(userId) ||
          String(u.userId || u.$id || u.id).toLowerCase() === String(userId).toLowerCase()
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
          String(c.criteriaId || c.$id || c.id).toLowerCase() === String(criteriaId).toLowerCase()
      );
      return match?.name || String(criteriaId);
    },
    [auditCriteria]
  );

  const getTemplateName = useCallback(
    (templateId: string | null | undefined) => {
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

  // Use counts from filtered lists
  const findingsCount = filteredFindingsArr.length;
  const openFindingsFiltered = filteredFindingsArr.filter((f: any) => {
    const st = String(f?.status || '').toLowerCase();
    return !st.includes('closed') && !st.includes('complete');
  }).length;
  const closedFindingsFiltered = filteredFindingsArr.filter((f: any) => {
    const st = String(f?.status || '').toLowerCase();
    return st.includes('closed') || st.includes('complete');
  }).length;

  const actionsCount = filteredActionsArr.length;
  const completedActionsFiltered = filteredActionsArr.filter(isActionCompleted).length;
  const overdueActionsFiltered = filteredActionsArr.filter((a: any) => {
    if (isActionCompleted(a)) return false;
    if (!a?.dueDate) return false;
    const dl = new Date(a.dueDate);
    if (isNaN(dl.getTime())) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    dl.setHours(0,0,0,0);
    return dl < today;
  }).length;

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
    today.setHours(0,0,0,0);
    dl.setHours(0,0,0,0);
    return dl < today;
  };

  const findingsDepartmentAgg = useMemo(() => {
    const agg: Record<string, { deptId: string; total: number; resolved: number; overdue: number }> = {};
    const source = filteredFindingsArr;
    source.forEach((f: any) => {
      const dept = f?.deptId != null ? String(f.deptId) : 'N/A';
      if (!agg[dept]) agg[dept] = { deptId: dept, total: 0, resolved: 0, overdue: 0 };
      const related = actionsByFindingMap.get(String(f.findingId || '')) || [];
      const resolved = isFindingResolved(related);
      const overdue = isFindingOverdue(f, related);
      agg[dept].total += 1;
      if (resolved) agg[dept].resolved += 1;
      if (overdue) agg[dept].overdue += 1;
    });
    return Object.values(agg);
  }, [filteredFindingsArr, actionsByFindingMap]);

  const period = useMemo(() => {
    const from = audit.startDate ? new Date(audit.startDate).toLocaleDateString() : "";
    const to = audit.endDate ? new Date(audit.endDate).toLocaleDateString() : "";
    if (!from && !to) return "";
    if (from && to) return `${from} – ${to}`;
    return from || to;
  }, [audit.startDate, audit.endDate]);

  // Prepare chart data from findings-actions-summary
  const findingsSeverityChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { name: 'Major', value: findingsActionsSummary.findingMajor || 0, color: '#ef4444' },
      { name: 'Medium', value: findingsActionsSummary.findingMedium || 0, color: '#f59e0b' },
      { name: 'Minor', value: findingsActionsSummary.findingMinor || 0, color: '#10b981' },
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
      const result = await submitFinalReport(selectedAuditId);
      console.log('[Auditor] Submit result:', result);
      
      // Reload report request to update status
      if (selectedAuditId) {
        try {
          const rr = await getReportRequestByAuditId(selectedAuditId);
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

  const alreadySubmitted = Boolean(reportRequest?.status);
  const canSubmit = selectedAuditId && 
    !loadingReportRequest && 
    !submitting &&
    !alreadySubmitted;

  // Calculate current step based on report request status
  const getCurrentStep = useMemo(() => {
    if (!selectedAuditId || !reportRequest?.status) {
      return 1; // No report request yet, still at step 1
    }
    const status = String(reportRequest.status || '').trim();
    if (status === 'PendingFirstApproval') {
      return 2; // Submitted, waiting for Lead Auditor
    }
    if (status === 'PendingSecondApproval') {
      return 3; // Lead Auditor approved, waiting for Director
    }
    // If status is something else (Approved, Rejected, etc.), show the last step
    return 3;
  }, [selectedAuditId, reportRequest?.status]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Prepare Final Audit Summary Report"
          subtitle={headerSubtitle}
          rightContent={
            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="flex flex-col items-start gap-1 md:items-end">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-700">Audit</label>
                <select
                  value={selectedAuditId}
                  onChange={e => setSelectedAuditId(e.target.value)}
                  className="min-w-[260px] px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900"
                  disabled={submitting}
                >
                  <option value="">{loadingAudits ? "Loading audits..." : "Select audit..."}</option>
                  {audits.map(a => (
                    <option key={a.auditId} value={a.auditId}>
                      {a.title}
                    </option>
                  ))}
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
              )}
            </div>
          }
        />

        <StageBar current={getCurrentStep} />

        {/* Content */}
        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
              Choose an audit from the dropdown above to load its full-detail information.
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
              <div className="space-y-6">
                {/* General information */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">General information</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 text-sm text-gray-700">
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Title</p>
                      <p className="mt-1">{audit.title || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Audit type</p>
                      <p className="mt-1">{audit.type || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                      <p className="mt-1">{audit.status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Period</p>
                      <p className="mt-1">{period || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Objectives & scope */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Objectives & scope</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Objectives</p>
                      <p className="mt-1 whitespace-pre-line">{audit.objective || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Scope</p>
                      <p className="mt-1 whitespace-pre-line">{audit.scope || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Findings & Actions Summary (API) with tabs */}
                {findingsActionsSummary && (
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg flex items-center justify-between gap-4 flex-wrap">
                      <h2 className="text-sm font-semibold text-white uppercase">Findings & Actions Summary (API)</h2>
                      <div className="flex items-center gap-2 text-xs bg-white/10 rounded-full p-1">
                        {["overview", "severity", "actions"].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setFasTab(tab as any)}
                            className={`px-3 py-1 rounded-full font-semibold transition-all ${
                              fasTab === tab
                                ? "bg-white text-primary-700 shadow-sm"
                                : "text-white/80 hover:bg-white/20"
                            }`}
                          >
                            {tab === "overview" ? "Overview" : tab === "severity" ? "Severity" : "Actions"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 space-y-6">
                      {fasTab === "overview" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {findingsOverviewCards.map((card) => (
                            <div
                              key={card.label}
                              className={`rounded-xl border ${card.border} bg-gradient-to-br ${card.bg} p-4 shadow-sm`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-gray-600">{card.label}</p>
                              <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {fasTab === "severity" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase">Findings by Severity</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {severityCards.map((c) => (
                                <div
                                  key={c.title}
                                  className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 shadow-sm"
                                >
                                  <p className="text-[11px] font-semibold text-gray-700 uppercase">{c.title}</p>
                                  <p className="mt-1 text-xl font-bold text-gray-900">{c.count}</p>
                                  <div className="mt-2 text-[11px] text-gray-700 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-emerald-700">Completed</span>
                                      <span>{c.completed}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-red-700">Overdue</span>
                                      <span>{c.overdue}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Charts</h3>
                            <div className="grid grid-cols-1 gap-4">
                              {findingsSeverityChartData.length > 0 && (
                                <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                                  <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Severity Pie</h4>
                                  <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={findingsSeverityChartData}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={false}
                                          outerRadius={80}
                                          fill="#8884d8"
                                          dataKey="value"
                                        >
                                          {findingsSeverityChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {fasTab === "actions" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                              <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Actions Status</h4>
                              <div style={{ width: '100%', height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={actionsStatusChartData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      outerRadius={80}
                                      fill="#8884d8"
                                      dataKey="value"
                                    >
                                      {actionsStatusChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                              <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Actions Breakdown by Severity</h4>
                              <div style={{ width: '100%', height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={actionsSeverityBreakdownData}>
                                    <XAxis dataKey="severity" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                                    <Bar dataKey="overdue" fill="#ef4444" name="Overdue" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Findings Section - Separate and Clear */}
                {fasTab !== "actions" && (
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-white uppercase">Findings</h2>
                    <div className="flex items-center gap-2 text-xs text-white">
                      <span>Filter by Department:</span>
                      <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="text-sm text-gray-800 rounded-md border border-white/30 bg-white/20 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/50"
                      >
                        <option value="">All</option>
                        {deptOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {deptFilter && (
                        <button
                          onClick={() => setDeptFilter("")}
                          className="underline text-white/90 hover:text-white text-xs transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Total Findings</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{findingsCount}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Open</p>
                        <p className="mt-1 text-2xl font-bold text-amber-700">{openFindingsFiltered}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Closed</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">{closedFindingsFiltered}</p>
                      </div>
                    </div>

                    {findingsDepartmentAgg.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase mb-2">Findings by Department</p>
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-sm border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-gray-700 font-semibold">Department</th>
                                <th className="px-3 py-2 text-right text-gray-700 font-semibold">Total</th>
                                <th className="px-3 py-2 text-right text-gray-700 font-semibold">Resolved</th>
                                <th className="px-3 py-2 text-right text-gray-700 font-semibold">Overdue</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {findingsDepartmentAgg.map((row) => (
                                <tr key={row.deptId}>
                                <td className="px-3 py-2 text-gray-800">{getDeptName(row.deptId)}</td>
                                  <td className="px-3 py-2 text-right text-gray-900 font-semibold">{row.total}</td>
                                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{row.resolved}</td>
                                  <td className="px-3 py-2 text-right text-red-700 font-semibold">{row.overdue}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {filteredFindingsArr.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-primary-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <span className="inline-block w-1 h-4 rounded-full bg-primary-500" />
                          Sample findings (top {Math.min(filteredFindingsArr.length, 5)})
                        </p>
                        <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                          {filteredFindingsArr.slice(0, 5).map((f: any) => {
                            const attachments = unwrapArray<any>(f.attachments);
                            return (
                              <li
                                key={f.findingId}
                                className="border border-primary-200 rounded-lg p-2.5 bg-gradient-to-br from-primary-50 to-white shadow-sm hover:shadow-md hover:border-primary-300 transition-shadow transition-colors"
                              >
                                <p className="text-xs font-semibold text-primary-900 flex items-center justify-between gap-2">
                                  {f.title || "Untitled finding"}
                                  <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                                    FINDING
                                  </span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-600 flex flex-wrap gap-1 items-center">
                                  <span className="inline-flex items-center rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 mr-1">
                                    {f.severity || "N/A"}
                                  </span>
                                  <span className="text-[11px] text-primary-600">
                                    Department: {getDeptName(f.deptId)}
                                  </span>
                                </p>
                                {f.description && (
                                  <p className="mt-1 text-[11px] text-gray-700 line-clamp-3">
                                    {f.description}
                                  </p>
                                )}

                                {attachments.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    <p className="text-[11px] font-semibold text-primary-700">
                                      Attachments ({attachments.length})
                                    </p>
                                    <ul className="space-y-1">
                                      {attachments.slice(0, 3).map((att: any) => {
                                        const attId = att.attachmentId || "";
                                        const isImg = isImage(att.contentType, att.fileName);
                                        const isExpanded = expandedImages.has(attId);
                                        const filePath = att.blobPath || att.filePath;
                                        return (
                                      <li key={attId} className="border border-primary-200 rounded-md p-1.5 bg-white">
                                            <button
                                              onClick={() => handleFileAction(att)}
                                              className="w-full flex items-center justify-between gap-2 text-left text-[11px] text-gray-700 hover:text-primary-600 transition-colors"
                                              title={isImg ? "Click to expand/collapse image" : "Click to open file"}
                                            >
                                              <div className="flex-1 min-w-0">
                                                <span className="truncate block font-medium">
                                                  {att.fileName || "Attachment"}
                                                </span>
                                                <span className="text-[10px] text-primary-500 mt-0.5 block">
                                                  {att.contentType || ""} · {att.status || "Active"}
                                                </span>
                                              </div>
                                              {isImg && (
                                                <svg
                                                  className={`w-3 h-3 text-primary-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                              )}
                                              {!isImg && filePath && (
                                                <svg
                                                  className="w-3 h-3 text-primary-400 flex-shrink-0"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                              )}
                                            </button>
                                            {isImg && isExpanded && filePath && (
                                              <div className="mt-2 border-t border-primary-200 pt-2">
                                                <div className="relative w-full">
                                                  <img
                                                    src={filePath}
                                                    alt={att.fileName || "Image"}
                                                    className="w-full h-auto rounded border border-primary-200 max-h-64 object-contain bg-primary-50"
                                                    onError={(e) => {
                                                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
                                                    }}
                                                  />
                                                  <button
                                                    onClick={() => toggleImageExpand(attId)}
                                                    className="absolute top-1 right-1 bg-white/90 hover:bg-white border border-primary-300 rounded p-1.5 shadow-sm transition-colors"
                                                    title="Collapse image"
                                                  >
                                                    <svg
                                                      className="w-4 h-4 text-primary-700"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}

                                {/* Actions under this finding */}
                                {(actionsByFindingMap.get(String(f.findingId || '')) || []).length > 0 && (
                                  <div className="mt-2 border-t border-gray-200 pt-2">
                                    <p className="text-[11px] font-semibold text-gray-700 mb-1">
                                      Actions for this finding ({(actionsByFindingMap.get(String(f.findingId || '')) || []).length})
                                    </p>
                                    <div className="space-y-1.5">
                                      {(actionsByFindingMap.get(String(f.findingId || '')) || []).slice(0,4).map((a: any) => (
                                        <div key={a.actionId} className="text-[11px] border border-gray-200 rounded-md p-2 bg-white">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-gray-800 truncate">{a.title || "Action"}</span>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] ${
                                              isActionCompleted(a)
                                                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                                : (String(a.status || "").toLowerCase().includes("overdue") ? "border-red-200 text-red-700 bg-red-50" : "border-amber-200 text-amber-700 bg-amber-50")
                                            }`}>
                                              {a.status || "N/A"}
                                            </span>
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-3 text-gray-600">
                                            <span>Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</span>
                                            {a.assignedDeptId != null && <span>Dept: {getDeptName(a.assignedDeptId)}</span>}
                                            {typeof a.progressPercent === 'number' && <span>Progress: {a.progressPercent}%</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                  </div>
                </div>
                )}

                {/* Actions Section - Separate and Clear */}
                {fasTab !== "severity" && (
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Actions</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Total Actions</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{actionsCount}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Completed</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">{completedActionsFiltered}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Overdue</p>
                        <p className="mt-1 text-2xl font-bold text-red-700">{overdueActionsFiltered}</p>
                      </div>
                    </div>

                    {filteredActionsArr.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <span className="inline-block w-1 h-4 rounded-full bg-emerald-500" />
                          Actions List ({filteredActionsArr.length})
                        </p>
                        <ul className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {filteredActionsArr.map((a: any) => {
                            const attachments = unwrapArray<any>(a.attachments);
                            return (
                              <li
                                key={a.actionId}
                                className="border border-gray-200 rounded-lg p-2.5 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-shadow transition-colors"
                              >
                                <p className="text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2">
                                  {a.title || "Untitled action"}
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    ACTION
                                  </span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-600 flex flex-wrap gap-1 items-center">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    a.status === 'Completed' || a.status === 'Approved' 
                                      ? 'bg-green-100 text-green-700 border border-green-200' 
                                      : a.status === 'Overdue' || a.status === 'Rejected'
                                      ? 'bg-red-100 text-red-700 border border-red-200'
                                      : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                  }`}>
                                    {a.status || "N/A"}
                                  </span>
                                  {a.progressPercent !== undefined && (
                                    <span className="text-[11px] text-emerald-600">
                                      Progress: {a.progressPercent}%
                                    </span>
                                  )}
                                  {a.dueDate && (
                                    <span className="text-[11px] text-gray-500">
                                      Due: {new Date(a.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </p>
                                {a.description && (
                                  <p className="mt-1 text-[11px] text-gray-700 line-clamp-2">
                                    {a.description}
                                  </p>
                                )}

                                {attachments.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    <p className="text-[11px] font-semibold text-emerald-700">
                                      Attachments ({attachments.length})
                                    </p>
                                    <ul className="space-y-1">
                                      {attachments.slice(0, 3).map((att: any) => {
                                    const attId = att.attachmentId || "";
                                    const isImg = isImage(att.contentType, att.fileName);
                                    const isExpanded = expandedImages.has(attId);
                                    const filePath = att.blobPath || att.filePath;
                                    return (
                                          <li key={attId} className="border border-emerald-200 rounded-md p-1.5 bg-white">
                                        <button
                                          onClick={() => handleFileAction(att)}
                                              className="w-full flex items-center justify-between gap-2 text-left text-[11px] text-gray-700 hover:text-emerald-600 transition-colors"
                                          title={isImg ? "Click to expand/collapse image" : "Click to open file"}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <span className="truncate block font-medium">
                                              {att.fileName || "Attachment"}
                                            </span>
                                                <span className="text-[10px] text-emerald-500 mt-0.5 block">
                                              {att.contentType || ""} · {att.status || "Active"}
                                            </span>
                                          </div>
                                          {isImg && (
                                            <svg
                                                  className={`w-3 h-3 text-emerald-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          )}
                                          {!isImg && filePath && (
                                            <svg
                                                  className="w-3 h-3 text-emerald-400 flex-shrink-0"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                          )}
                                        </button>
                                        {isImg && isExpanded && filePath && (
                                              <div className="mt-2 border-t border-emerald-200 pt-2">
                                            <div className="relative w-full">
                                              <img
                                                src={filePath}
                                                alt={att.fileName || "Image"}
                                                    className="w-full h-auto rounded border border-emerald-200 max-h-64 object-contain bg-emerald-50"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
                                                }}
                                              />
                                              <button
                                                onClick={() => toggleImageExpand(attId)}
                                                    className="absolute top-1 right-1 bg-white/90 hover:bg-white border border-emerald-300 rounded p-1.5 shadow-sm transition-colors"
                                                title="Collapse image"
                                              >
                                                <svg
                                                      className="w-4 h-4 text-emerald-700"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Documents */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Documents</h2>
                  </div>
                  <div className="p-4 text-sm text-gray-700">
                    {documentsArr.length === 0 ? (
                      <p className="text-gray-500 text-xs">No documents recorded for this audit.</p>
                    ) : (
                      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {documentsArr.map((d: any) => {
                          const docId = d.docId || "";
                          const isImg = isImage(d.contentType, d.title || d.fileName);
                          const isExpanded = expandedImages.has(docId);
                          const filePath = d.blobPath;
                          return (
                            <li key={docId} className="border border-primary-200 rounded-md p-2 bg-white">
                              <button
                                onClick={() => handleFileAction(d)}
                                className="w-full flex items-center justify-between gap-2 text-left"
                                title={isImg ? "Click to expand/collapse image" : "Click to open file"}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 hover:text-primary-600 transition-colors">
                                    {d.title || d.documentType || "Document"}
                                  </p>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Type: {d.documentType || "N/A"} · Final: {String(d.isFinalVersion ?? false)}
                                  </p>
                                  {d.contentType && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">{d.contentType}</p>
                                  )}
                                </div>
                                {isImg && (
                                  <svg
                                    className={`w-3 h-3 text-primary-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                                {!isImg && filePath && (
                                  <svg
                                    className="w-3 h-3 text-primary-400 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                )}
                              </button>
                              {isImg && isExpanded && filePath && (
                                <div className="mt-2 border-t border-primary-200 pt-2">
                                  <div className="relative w-full">
                                    <img
                                      src={filePath}
                                      alt={d.title || "Document image"}
                                      className="w-full h-auto rounded border border-primary-200 max-h-64 object-contain bg-primary-50"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
                                      }}
                                    />
                                    <button
                                      onClick={() => toggleImageExpand(docId)}
                                      className="absolute top-1 right-1 bg-white/90 hover:bg-white border border-primary-300 rounded p-1.5 shadow-sm transition-colors"
                                      title="Collapse image"
                                    >
                                      <svg
                                        className="w-4 h-4 text-primary-700"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Audit detail modal */}
        {showAuditDetailModal && detail && (
          <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowAuditDetailModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Audit Details</h3>
                  <p className="text-xs text-gray-500">Full snapshot from full-detail API</p>
                </div>
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-5 space-y-4 text-sm text-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase">Audit</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">{detail.audit?.title || "—"}</p>
                    <p className="text-xs text-gray-600">Type: {detail.audit?.type || "—"}</p>
                    <p className="text-xs text-gray-600">Status: {detail.audit?.status || "—"}</p>
                    <p className="text-xs text-gray-600">Objective: {detail.audit?.objective || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase">Period</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {detail.audit?.startDate ? new Date(detail.audit.startDate).toLocaleDateString() : "—"} —{" "}
                      {detail.audit?.endDate ? new Date(detail.audit.endDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Departments (scope)</p>
                    <ul className="text-xs space-y-1">
                      {scopeDepartmentsArr.length ? (
                        scopeDepartmentsArr.map((d: any, idx: number) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                            <span className="font-semibold text-gray-800">{getDeptName(d.deptId)}</span>
                            <span className="text-gray-500">Status: {d.status || "—"}</span>
                            {d.sensitiveFlag ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                Sensitive
                              </span>
                            ) : null}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">No departments</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Teams</p>
                    <ul className="text-xs space-y-1">
                      {teamsArr.length ? (
                        teamsArr.map((t: any, idx: number) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="font-semibold text-gray-800">{getUserName(t.userId)}</span>
                            {t.roleInTeam && <span className="text-gray-500">Role: {t.roleInTeam}</span>}
                            {t.isLead && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary-100 text-primary-700 border border-primary-200">
                                Lead
                              </span>
                            )}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">No team members</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Schedules / Milestones</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-700 font-semibold">Milestone</th>
                          <th className="px-3 py-2 text-left text-gray-700 font-semibold">Due Date</th>
                          <th className="px-3 py-2 text-left text-gray-700 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {schedulesArr.length ? (
                          schedulesArr.map((s: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-gray-800">{s.milestoneName || "—"}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-700">{s.status || "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-2 text-gray-500" colSpan={3}>
                              No schedules
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Audit Criteria Map</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Criteria Name</th>
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {criteriaArr.length ? (
                            criteriaArr.map((c: any, idx: number) => (
                              <tr key={idx}>
                                
                                <td className="px-3 py-2 text-gray-700">{getCriteriaName(c.criteriaId)}</td>
                                <td className="px-3 py-2 text-gray-700">{c.status || "—"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-3 py-2 text-gray-500" colSpan={3}>
                                No criteria mapped
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Checklist Templates</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Template Name</th>
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Assigned At</th>
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Assigned By</th>
                            <th className="px-3 py-2 text-left text-gray-700 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {checklistArr.length ? (
                            checklistArr.map((t: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-gray-800">{getTemplateName(t.templateId)}</td>
                                <td className="px-3 py-2 text-gray-700">
                                  {t.assignedAt ? new Date(t.assignedAt).toLocaleString() : "—"}
                                </td>
                                <td className="px-3 py-2 text-gray-700">{getUserName(t.assignedBy)}</td>
                                <td className="px-3 py-2 text-gray-700">{t.status || "—"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-3 py-2 text-gray-500" colSpan={4}>
                                No checklist templates assigned
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Findings (full-detail)</p>
                    <p className="text-sm text-gray-800 font-semibold mb-2">Total: {findingsArr.length}</p>
                    <ul className="text-xs space-y-1 max-h-48 overflow-y-auto pr-1">
                      {findingsArr.length ? (
                        findingsArr.slice(0, 10).map((f: any, idx: number) => (
                          <li key={idx} className="border border-gray-200 rounded-md p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{f.title || "Finding"}</span>
                              <span className="px-2 py-0.5 text-[10px] rounded-full border bg-gray-50 text-gray-700">
                                {f.severity || "—"}
                              </span>
                            </div>
                            <div className="text-gray-600 mt-1">
                              Dept: {getDeptName(f.deptId)} • Status: {f.status || "—"} • Deadline:{" "}
                              {f.deadline ? new Date(f.deadline).toLocaleDateString() : "—"}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">No findings</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Actions (full-detail)</p>
                    <p className="text-sm text-gray-800 font-semibold mb-2">Total: {actionsArr.length}</p>
                    <ul className="text-xs space-y-1 max-h-48 overflow-y-auto pr-1">
                      {actionsArr.length ? (
                        actionsArr.slice(0, 10).map((a: any, idx: number) => (
                          <li key={idx} className="border border-gray-200 rounded-md p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{a.title || "Action"}</span>
                              <span className="px-2 py-0.5 text-[10px] rounded-full border bg-gray-50 text-gray-700">
                                {a.status || "—"}
                              </span>
                            </div>
                            <div className="text-gray-600 mt-1">
                              Dept: {getDeptName(a.assignedDeptId)} • Due:{" "}
                              {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"} • Progress:{" "}
                              {typeof a.progressPercent === "number" ? `${a.progressPercent}%` : "—"}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">No actions</li>
                      )}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

