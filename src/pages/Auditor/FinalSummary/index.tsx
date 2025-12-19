import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary } from "../../../api/audits";
import { submitFinalReport, getReportRequestByAuditId } from "../../../api/reportRequest";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { useNavigate } from "react-router-dom";
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

export default function AuditorFinalSummaryPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;
  const navigate = useNavigate();

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
  
  // State to track expanded images (Set of attachmentId/docId)
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  
  // State for report request
  const [reportRequest, setReportRequest] = useState<{ status?: string; reportRequestId?: string; note?: string } | null>(null);
  const [loadingReportRequest, setLoadingReportRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load list of audits for dropdown (GET /Audits)
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const res = await getAuditPlans();
        const list = unwrap(res);
        if (Array.isArray(list)) {
          const mapped = list
            .map((a: any) => ({
              auditId: a.auditId || a.id || "",
              title: a.title || a.auditTitle || "Untitled audit",
            }))
            .filter(x => x.auditId);
          setAudits(mapped);
        }
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

  const period = useMemo(() => {
    const from = audit.startDate ? new Date(audit.startDate).toLocaleDateString() : "";
    const to = audit.endDate ? new Date(audit.endDate).toLocaleDateString() : "";
    if (!from && !to) return "";
    if (from && to) return `${from} – ${to}`;
    return from || to;
  }, [audit.startDate, audit.endDate]);

  // Use counts from Summary API if available, otherwise count arrays
  const findingsCount = summaryData?.totalFindings ?? findingsArr.length;
  const actionsCount = actionsArr.length;
  
  // Prepare chart data from findings-actions-summary
  const findingsSeverityChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { name: 'Major', value: findingsActionsSummary.findingMajor || 0, color: '#ef4444' },
      { name: 'Medium', value: findingsActionsSummary.findingMedium || 0, color: '#f59e0b' },
      { name: 'Minor', value: findingsActionsSummary.findingMinor || 0, color: '#10b981' },
    ].filter(item => item.value > 0);
  }, [findingsActionsSummary]);
  
  const actionsStatusChartData = useMemo(() => {
    if (!findingsActionsSummary) return [];
    return [
      { name: 'Completed', value: findingsActionsSummary.completedActions || 0, color: '#10b981' },
      { name: 'Overdue', value: findingsActionsSummary.overdueActions || 0, color: '#ef4444' },
    ].filter(item => item.value > 0);
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
    ].filter(item => item.completed > 0 || item.overdue > 0);
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
      // Reload report request to get latest status
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
      alert("Report submitted successfully! Waiting for Lead Auditor approval.");
    } catch (error: any) {
      console.error("Failed to submit report:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to submit report. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if report can be submitted
  const canSubmit = selectedAuditId && !reportRequest && !loadingReportRequest;
  const isSubmitted = reportRequest?.status && 
    ["PendingFirstApproval", "PendingSecondApproval", "Approved", "RejectedFirstLevel", "RejectedSecondLevel"].includes(reportRequest.status);
  const isRejected =
    reportRequest?.status === "RejectedFirstLevel" || reportRequest?.status === "RejectedSecondLevel";

  const rejectionSourceLabel =
    reportRequest?.status === "RejectedSecondLevel"
      ? "Director"
      : "Lead Auditor";

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
                  {loadingReportRequest ? (
                    <div className="text-xs text-gray-500">Checking status...</div>
                  ) : isSubmitted ? (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-600">
                        Status: <span className={`font-semibold ${
                          reportRequest?.status === "Approved" ? "text-green-600" :
                          reportRequest?.status === "RejectedFirstLevel" || reportRequest?.status === "RejectedSecondLevel" ? "text-red-600" :
                          "text-primary-600"
                        }`}>
                          {reportRequest?.status === "PendingFirstApproval" ? "Pending Lead Auditor Review" :
                           reportRequest?.status === "PendingSecondApproval" ? "Pending Director Approval" :
                           reportRequest?.status === "Approved" ? "Approved" :
                           reportRequest?.status === "RejectedFirstLevel" ? "Rejected - Revision Required" :
                           reportRequest?.status === "RejectedSecondLevel" ? "Rejected - Revision Required" :
                           reportRequest?.status}
                        </span>
                      </div>
                      {(reportRequest?.status === "RejectedFirstLevel" || reportRequest?.status === "RejectedSecondLevel") && (
                        <button
                          onClick={handleSubmitReport}
                          disabled={submitting}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {submitting ? "Submitting..." : "Resubmit"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleSubmitReport}
                      disabled={!canSubmit || submitting}
                      className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
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

        {/* Content */}
        <section className="pb-2">
          {selectedAuditId && isRejected && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Report rejected by {rejectionSourceLabel}
                    </p>
                    <p className="text-[11px] text-white/80">
                      Please review the comments below and update findings, actions or documents before resubmitting.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/auditor/findings/audit/${encodeURIComponent(selectedAuditId)}`)
                    }
                    className="px-3 py-1.5 rounded-md bg-white/95 text-red-700 font-medium shadow-sm hover:bg-white transition-colors"
                  >
                    Go to Findings / Actions
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/auditor/history-upload")}
                    className="px-3 py-1.5 rounded-md border border-white/70 text-white font-medium hover:bg-white/10 transition-colors"
                  >
                    Go to Documents
                  </button>
                </div>
              </div>
              {reportRequest?.note && (
                <div className="px-4 py-3 text-xs text-red-900 bg-red-50/70 border-t border-red-100">
                  <p className="font-semibold mb-1">
                    Rejection comments from {rejectionSourceLabel}
                  </p>
                  <p className="whitespace-pre-line">
                    {reportRequest.note}
                  </p>
                </div>
              )}
            </div>
          )}

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
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left: main information */}
              <div className="space-y-6 lg:col-span-2">
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

                {/* Charts Section - Findings & Actions Summary */}
                {findingsActionsSummary && (
                  <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                    <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                      <h2 className="text-sm font-semibold text-white uppercase">Findings & Actions Summary Charts</h2>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Findings Severity Pie Chart */}
                      {findingsSeverityChartData.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Findings by Severity</h3>
                          <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={findingsSeverityChartData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={(props: any) => {
                                    const { name, value, percent } = props;
                                    return `${name}: ${value} (${((percent as number) * 100).toFixed(0)}%)`;
                                  }}
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
                      
                      {/* Actions Status Pie Chart */}
                      {actionsStatusChartData.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Actions Status</h3>
                          <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={actionsStatusChartData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={(props: any) => {
                                    const { name, value, percent } = props;
                                    return `${name}: ${value} (${((percent as number) * 100).toFixed(0)}%)`;
                                  }}
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
                      )}
                      
                      {/* Actions by Severity Breakdown Bar Chart */}
                      {actionsSeverityBreakdownData.length > 0 && (
                        <div className="md:col-span-2">
                          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Actions Breakdown by Severity</h3>
                          <div style={{ width: '100%', height: 250 }}>
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
                      )}
                    </div>
                  </div>
                )}

                {/* Findings Section - Separate and Clear */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-to-r from-red-500 to-red-600 rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Findings</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg bg-gradient-to-br from-red-100 to-red-50 border border-red-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-red-800 uppercase tracking-wide">Total Findings</p>
                        <p className="mt-1 text-2xl font-bold text-red-900">{findingsCount}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-red-100 to-red-50 border border-red-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-red-800 uppercase tracking-wide">Open</p>
                        <p className="mt-1 text-2xl font-bold text-red-900">{summaryData?.openFindings ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-red-100 to-red-50 border border-red-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-red-800 uppercase tracking-wide">Closed</p>
                        <p className="mt-1 text-2xl font-bold text-red-900">{summaryData?.closedFindings ?? 0}</p>
                      </div>
                    </div>

                    {findingsArr.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-primary-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <span className="inline-block w-1 h-4 rounded-full bg-primary-500" />
                          Sample findings (top {Math.min(findingsArr.length, 5)})
                        </p>
                        <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                          {findingsArr.slice(0, 5).map((f: any) => {
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
                                    Department: {f.deptId ?? "N/A"}
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
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                  </div>
                </div>

                {/* Actions Section - Separate and Clear */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Actions</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">Total Actions</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-900">{actionsCount}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">Completed</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-900">{findingsActionsSummary?.completedActions ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-300 py-3 shadow-sm">
                        <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">Overdue</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-900">{findingsActionsSummary?.overdueActions ?? 0}</p>
                      </div>
                    </div>

                    {actionsArr.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <span className="inline-block w-1 h-4 rounded-full bg-emerald-500" />
                          Actions List ({actionsArr.length})
                        </p>
                        <ul className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {actionsArr.map((a: any) => {
                            const attachments = unwrapArray<any>(a.attachments);
                            return (
                              <li
                                key={a.actionId}
                                className="border border-emerald-200 rounded-lg p-2.5 bg-gradient-to-br from-emerald-50 to-white shadow-sm hover:shadow-md hover:border-emerald-300 transition-shadow transition-colors"
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

              {/* Right column: workflow + snapshot from arrays */}
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

