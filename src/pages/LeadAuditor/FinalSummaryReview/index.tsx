import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary } from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { approveFinalReport, rejectFinalReport, getReportRequestByAuditId } from "../../../api/reportRequest";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<Array<{ auditId: string; title: string }>>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [loadingAudits, setLoadingAudits] = useState(false);

  const [detail, setDetail] = useState<FullDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  const [findingsActionsSummary, setFindingsActionsSummary] = useState<any>(null);
  const [loadingFindingsActionsSummary, setLoadingFindingsActionsSummary] = useState(false);
  const [fasTab, setFasTab] = useState<"overview" | "severity" | "actions">("overview");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [departments, setDepartments] = useState<Array<{ deptId: string | number; name: string }>>([]);
  
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  
  const [reportRequest, setReportRequest] = useState<{ status?: string; reportRequestId?: string; note?: string } | null>(null);
  const [loadingReportRequest, setLoadingReportRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [comments, setComments] = useState("");

  // Load list of audits for dropdown - show ALL audits
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const [plansRes, deptsRes] = await Promise.all([
          getAuditPlans(),
          getDepartments().catch(() => []),
        ]);

        const plans = unwrap(plansRes);
        
        const deptList = Array.isArray(deptsRes)
          ? deptsRes.map((d: any) => ({
              deptId: d.deptId ?? d.id ?? d.$id,
              name: d.name || d.code || String(d.deptId ?? d.id ?? d.$id ?? "N/A"),
            }))
          : [];
        setDepartments(deptList);

        // Load ALL audits (Lead Auditor can review any audit with submitted report)
        const allAudits = (Array.isArray(plans) ? plans : [])
          .map((a: any) => ({
            auditId: a.auditId || a.id || "",
            title: a.title || a.auditTitle || "Untitled audit",
          }))
          .filter((x: any) => x.auditId);

        setAudits(allAudits);
      } catch (error) {
        console.error('[LeadAuditor] Failed to load audits:', error);
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
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(selectedAuditId);
        setDetail(res as FullDetailResponse);
      } catch (error) {
        console.error('Failed to load full detail:', error);
      } finally {
        setLoadingDetail(false);
      }

      setLoadingSummary(true);
      try {
        const summaryRes = await getAuditSummary(selectedAuditId);
        setSummaryData(summaryRes);
      } catch (error) {
        console.error('Failed to load summary:', error);
      } finally {
        setLoadingSummary(false);
      }

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
        console.error('Failed to load report request:', error);
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
  const scopeDepartmentsArr = detail ? unwrapArray<any>(detail.scopeDepartments) : [];
  const criteriaArr = detail ? unwrapArray<any>(detail.auditCriteriaMap) : [];
  const checklistArr = detail ? unwrapArray<any>(detail.auditChecklistTemplateMap) : [];
  const teamsArr = detail ? unwrapArray<any>(detail.teams) : [];
  
  const summaryFindings = summaryData?.findingsInAudit ? unwrapArray<any>(summaryData.findingsInAudit) : [];
  const findingsFromSummary = summaryFindings.length > 0 && summaryFindings[0]?.findings 
    ? unwrapArray<any>(summaryFindings[0].findings) 
    : [];
  
  const findingsArr = findingsFromSummary.length > 0 
    ? findingsFromSummary 
    : (detail ? unwrapArray<any>(detail.findings) : []);
  
  const actionsArr = detail ? unwrapArray<any>(detail.actions) : [];
  const documentsArr = detail ? unwrapArray<any>(detail.documents) : [];

  const isActionCompleted = (a: any) => {
    const st = String(a?.status || '').toLowerCase();
    return (st.includes('completed') || st.includes('approved')) && (!!a?.closedAt || !!a?.reviewFeedback || a?.progressPercent === 100);
  };

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

  const findingsCount = filteredFindingsArr.length;
  const actionsCount = filteredActionsArr.length;

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

  const period = useMemo(() => {
    const from = audit.startDate ? new Date(audit.startDate).toLocaleDateString() : "";
    const to = audit.endDate ? new Date(audit.endDate).toLocaleDateString() : "";
    if (!from && !to) return "";
    if (from && to) return `${from} – ${to}`;
    return from || to;
  }, [audit.startDate, audit.endDate]);

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
      return "Select an audit below to review the final summary report submitted by Auditor.";
    }
    if (loadingDetail) {
      return "Loading audit information...";
    }
    return "Review and approve/reject the final audit summary report.";
  }, [selectedAuditId, loadingDetail]);

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

  const handleApprove = async () => {
    if (!reportRequest?.reportRequestId) {
      alert("No report request found.");
      return;
    }

    if (!window.confirm("Are you sure you want to approve this report and forward it to Director?")) {
      return;
    }

    setSubmitting(true);
    try {
      await approveFinalReport(reportRequest.reportRequestId, comments);
      alert("Report approved successfully! Forwarded to Director.");
      
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
      
      setComments("");
    } catch (error: any) {
      console.error("Failed to approve report:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to approve report. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reportRequest?.reportRequestId) {
      alert("No report request found.");
      return;
    }

    if (!comments.trim()) {
      alert("Please provide rejection comments.");
      return;
    }

    if (!window.confirm("Are you sure you want to reject this report? It will be sent back to the Auditor for revision.")) {
      return;
    }

    setSubmitting(true);
    try {
      await rejectFinalReport(reportRequest.reportRequestId, comments);
      alert("Report rejected. Auditor will be notified to revise the report.");
      
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
      
      setComments("");
    } catch (error: any) {
      console.error("Failed to reject report:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to reject report. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const isPendingApproval = reportRequest?.status === 'PendingFirstApproval';

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Final Summary Review"
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
                  {loadingReportRequest ? (
                    <div className="text-xs text-gray-500">Checking status...</div>
                  ) : isPendingApproval && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApprove}
                        disabled={submitting}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={submitting}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
        />

        {selectedAuditId && isPendingApproval && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Auditor Comments
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Add your comments here... (required for rejection)"
            />
          </div>
        )}

        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
              Choose an audit from the dropdown above to review its final summary report.
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
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
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

                {findingsActionsSummary && (
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg flex items-center justify-between gap-4 flex-wrap">
                      <h2 className="text-sm font-semibold text-white uppercase">Findings & Actions Summary</h2>
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

                {filteredFindingsArr.length > 0 && (
                  <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                    <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg flex items-center justify-between gap-4 flex-wrap">
                      <h2 className="text-sm font-semibold text-white uppercase">Findings Details</h2>
                      {deptOptions.length > 1 && (
                        <select
                          value={deptFilter}
                          onChange={e => setDeptFilter(e.target.value)}
                          className="px-3 py-1 text-xs bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">All Departments ({findingsArr.length})</option>
                          {deptOptions.map(([deptId, name]) => {
                            const count = findingsArr.filter((f: any) => String(f?.deptId || 'N/A') === deptId).length;
                            return (
                              <option key={deptId} value={deptId}>
                                {name} ({count})
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      {filteredFindingsArr.map((finding: any, idx: number) => {
                        const findingActions = actionsByFindingMap.get(String(finding.findingId || '').trim()) || [];
                        const findingAtts = finding.attachments ? unwrapArray<any>(finding.attachments) : [];
                        return (
                          <div
                            key={finding.findingId || idx}
                            className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Finding</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{finding.finding || "—"}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {finding.severity && (
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      finding.severity === "Major"
                                        ? "bg-red-100 text-red-800"
                                        : finding.severity === "Medium"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {finding.severity}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Department</p>
                                <p className="mt-0.5">{getDeptName(finding.deptId)}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Type</p>
                                <p className="mt-0.5">{finding.type || "—"}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Risk Level</p>
                                <p className="mt-0.5">{finding.riskLevel || "—"}</p>
                              </div>
                            </div>
                            {finding.recommendation && (
                              <div className="mt-3 text-xs">
                                <p className="font-medium text-gray-500 uppercase">Recommendation</p>
                                <p className="mt-1 text-gray-700 whitespace-pre-line">{finding.recommendation}</p>
                              </div>
                            )}
                            {findingAtts.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Attachments</p>
                                <div className="space-y-2">
                                  {findingAtts.map((att: any) => {
                                    const isImg = isImage(att.contentType, att.fileName);
                                    const attId = att.attachmentId || att.$id || `${idx}-${att.fileName}`;
                                    const expanded = expandedImages.has(attId);
                                    return (
                                      <div key={attId} className="flex flex-col gap-2">
                                        <button
                                          onClick={() => handleFileAction({ ...att, attachmentId: attId })}
                                          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-left"
                                        >
                                          <span>{isImg ? "🖼️" : "📎"}</span>
                                          <span className="font-medium text-gray-900">{att.fileName || "Attachment"}</span>
                                          {isImg && <span className="ml-auto text-primary-600">{expanded ? "▲ Collapse" : "▼ Expand"}</span>}
                                        </button>
                                        {isImg && expanded && (att.blobPath || att.filePath) && (
                                          <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                                            <img
                                              src={att.blobPath || att.filePath}
                                              alt={att.fileName || "Preview"}
                                              className="w-full h-auto max-h-96 object-contain rounded"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {findingActions.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Related Actions ({findingActions.length})</p>
                                <div className="space-y-2">
                                  {findingActions.map((action: any) => (
                                    <div
                                      key={action.actionId}
                                      className="rounded border border-gray-200 bg-white p-2 text-xs"
                                    >
                                      <p className="font-medium text-gray-900">{action.description || "—"}</p>
                                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-600">
                                        <span>Status: {action.status || "—"}</span>
                                        <span>Due: {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : "—"}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredActionsArr.length > 0 && (
                  <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                    <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                      <h2 className="text-sm font-semibold text-white uppercase">Actions Details</h2>
                    </div>
                    <div className="p-4 space-y-3">
                      {filteredActionsArr.map((action: any, idx: number) => {
                        const actionAtts = action.attachments ? unwrapArray<any>(action.attachments) : [];
                        const completed = isActionCompleted(action);
                        return (
                          <div
                            key={action.actionId || idx}
                            className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 uppercase">Action</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{action.description || "—"}</p>
                              </div>
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  completed
                                    ? "bg-green-100 text-green-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {action.status || "Pending"}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Department</p>
                                <p className="mt-0.5">{getDeptName(action.assignedDeptId)}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Due Date</p>
                                <p className="mt-0.5">
                                  {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 uppercase">Progress</p>
                                <p className="mt-0.5">{action.progressPercent ?? 0}%</p>
                              </div>
                            </div>
                            {actionAtts.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Attachments</p>
                                <div className="space-y-2">
                                  {actionAtts.map((att: any) => {
                                    const isImg = isImage(att.contentType, att.fileName);
                                    const attId = att.attachmentId || att.$id || `action-${idx}-${att.fileName}`;
                                    const expanded = expandedImages.has(attId);
                                    return (
                                      <div key={attId} className="flex flex-col gap-2">
                                        <button
                                          onClick={() => handleFileAction({ ...att, attachmentId: attId })}
                                          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-left"
                                        >
                                          <span>{isImg ? "🖼️" : "📎"}</span>
                                          <span className="font-medium text-gray-900">{att.fileName || "Attachment"}</span>
                                          {isImg && <span className="ml-auto text-primary-600">{expanded ? "▲ Collapse" : "▼ Expand"}</span>}
                                        </button>
                                        {isImg && expanded && (att.blobPath || att.filePath) && (
                                          <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                                            <img
                                              src={att.blobPath || att.filePath}
                                              alt={att.fileName || "Preview"}
                                              className="w-full h-auto max-h-96 object-contain rounded"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {documentsArr.length > 0 && (
                  <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                    <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                      <h2 className="text-sm font-semibold text-white uppercase">Documents</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      {documentsArr.map((doc: any, idx: number) => {
                        const isImg = isImage(doc.contentType, doc.fileName);
                        const docId = doc.docId || doc.$id || `doc-${idx}`;
                        const expanded = expandedImages.has(docId);
                        return (
                          <div key={docId} className="flex flex-col gap-2">
                            <button
                              onClick={() => handleFileAction({ ...doc, docId })}
                              className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-left"
                            >
                              <span>{isImg ? "🖼️" : "📄"}</span>
                              <span className="font-medium text-gray-900">{doc.fileName || "Document"}</span>
                              {isImg && <span className="ml-auto text-primary-600">{expanded ? "▲ Collapse" : "▼ Expand"}</span>}
                            </button>
                            {isImg && expanded && (doc.blobPath || doc.filePath) && (
                              <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                                <img
                                  src={doc.blobPath || doc.filePath}
                                  alt={doc.fileName || "Preview"}
                                  className="w-full h-auto max-h-96 object-contain rounded"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Audit data snapshot</h2>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 text-xs text-gray-700">
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-white border border-primary-200 px-3 py-2.5 shadow-sm">
                      <p className="text-[11px] font-medium text-primary-700">Schedules</p>
                      <p className="mt-0.5 text-lg font-bold text-primary-900">{schedulesArr.length}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-white border border-primary-200 px-3 py-2.5 shadow-sm">
                      <p className="text-[11px] font-medium text-primary-700">Scope departments</p>
                      <p className="mt-0.5 text-lg font-bold text-primary-900">{scopeDepartmentsArr.length}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-white border border-primary-200 px-3 py-2.5 shadow-sm">
                      <p className="text-[11px] font-medium text-primary-700">Criteria mapped</p>
                      <p className="mt-0.5 text-lg font-bold text-primary-900">{criteriaArr.length}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-white border border-primary-200 px-3 py-2.5 shadow-sm">
                      <p className="text-[11px] font-medium text-primary-700">Checklist templates</p>
                      <p className="mt-0.5 text-lg font-bold text-primary-900">{checklistArr.length}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-primary-100 to-primary-50 border border-primary-300 px-3 py-2.5 shadow-sm col-span-2">
                      <p className="text-[11px] font-medium text-primary-800">Team members</p>
                      <p className="mt-0.5 text-lg font-bold text-primary-900">{teamsArr.length}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-red-100 to-red-50 border border-red-300 px-3 py-2.5 shadow-sm col-span-2">
                      <p className="text-[11px] font-medium text-red-800">Total Findings</p>
                      <p className="mt-0.5 text-lg font-bold text-red-900">{findingsCount}</p>
                    </div>
                    <div className="rounded-md bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-300 px-3 py-2.5 shadow-sm col-span-2">
                      <p className="text-[11px] font-medium text-emerald-800">Total Actions</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-900">{actionsCount}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
