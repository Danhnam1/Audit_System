import { useEffect, useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { approveFinalReport, rejectFinalReport, getReportRequestByAuditId } from "../../../api/reportRequest";
import { getAuditFullDetail, getAuditSummary, getAuditFindingsActionsSummary, getAuditPlans } from "../../../api/audits";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";

type ReportRequest = {
  reportRequestId: string;
  auditId: string;
  requestedBy: string;
  title?: string;
  status: string;
  filePath?: string;
  requestedAt?: string;
  completedAt?: string;
  note?: string;
};

export default function LeadAuditorFinalSummaryReviewPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [_selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [auditDetail, setAuditDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Additional data states (same as Auditor FinalSummary)
  const [_summaryData, setSummaryData] = useState<any>(null);
  const [_loadingSummary, setLoadingSummary] = useState(false);
  const [_findingsActionsSummary, setFindingsActionsSummary] = useState<any>(null);
  const [_loadingFindingsActionsSummary, setLoadingFindingsActionsSummary] = useState(false);

  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load audits where user is team member (same as Auditor)
  const loadReportRequests = async () => {
    setLoading(true);
    try {
      const [plansRes, teamsRes, usersRes] = await Promise.all([
        getAuditPlans(),
        getAuditTeam().catch(() => []),
        getAdminUsers().catch(() => []),
      ]);

      const plans = unwrap(plansRes);
      const teams = Array.isArray(teamsRes) ? teamsRes : [];
      const adminUsersArr = Array.isArray(usersRes) ? usersRes : [];

      // Resolve current userId from email
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

      // Filter audits where user is team member
      const userAudits = (Array.isArray(plans) ? plans : [])
        .filter((a: any) => {
          const auditId = a?.auditId || a?.id || a?.$id;
          if (!auditId) return false;
          const auditIdStr = String(auditId).trim();
          const auditIdLower = auditIdStr.toLowerCase();
          return userAuditIds.has(auditIdStr) || userAuditIds.has(auditIdLower);
        });

      console.log('[LeadAuditor] User audits:', userAudits.length);

      // Load report requests for these audits
      const reportsWithStatus = await Promise.all(
        userAudits.map(async (audit: any) => {
          const auditId = String(audit.auditId || audit.id || audit.$id || '').trim();
          try {
            const reportRequest = await getReportRequestByAuditId(auditId);
            if (reportRequest) {
              return {
                reportRequestId: reportRequest.reportRequestId,
                auditId: auditId,
                requestedBy: reportRequest.requestedBy,
                title: audit.title || audit.auditTitle || "Untitled audit",
                status: reportRequest.status,
                filePath: reportRequest.filePath,
                requestedAt: reportRequest.requestedAt,
                completedAt: reportRequest.completedAt,
                note: reportRequest.note,
              } as ReportRequest;
            }
          } catch (err) {
            // No report request for this audit yet
            return null;
          }
          return null;
        })
      );

      const validReports = reportsWithStatus.filter((r): r is ReportRequest => r !== null);
      console.log('[LeadAuditor] Reports with request:', validReports.map(r => ({ id: r.reportRequestId, auditId: r.auditId, status: r.status, title: r.title })));

      // Filter only PendingFirstApproval (waiting for Lead Auditor review)
      const pendingReports = validReports.filter(r => {
        const status = String(r.status || '').trim();
        return status === 'PendingFirstApproval';
      });

      console.log('[LeadAuditor] Pending reports (PendingFirstApproval):', pendingReports.length);
      setReportRequests(pendingReports);
    } catch (error) {
      console.error("Failed to load report requests:", error);
      setReportRequests([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadReportRequests();
    
    // Auto-refresh every 30 seconds to catch new submissions
    const interval = setInterval(loadReportRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load audit detail when report is selected (same as Auditor - load 3 APIs)
  useEffect(() => {
    if (!selectedReportId) {
      setAuditDetail(null);
      setSummaryData(null);
      setFindingsActionsSummary(null);
      setSelectedAuditId("");
      return;
    }

    const selectedReport = reportRequests.find(r => r.reportRequestId === selectedReportId);
    if (!selectedReport) return;

    const auditId = selectedReport.auditId;
    setSelectedAuditId(auditId);

    const loadAllData = async () => {
      console.log('[LeadAuditor] Loading data for audit:', auditId);
      
      // Load full-detail (for actions and general info)
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(auditId);
        console.log('[LeadAuditor] Full detail loaded:', res);
        setAuditDetail(res);
      } catch (error) {
        console.error("Failed to load audit detail:", error);
        setAuditDetail(null);
      } finally {
        setLoadingDetail(false);
      }

      // Load Summary (for findings details)
      setLoadingSummary(true);
      try {
        const summaryRes = await getAuditSummary(auditId);
        console.log('[LeadAuditor] Summary loaded:', summaryRes);
        setSummaryData(summaryRes);
      } catch (error) {
        console.error('Failed to load summary:', error);
      } finally {
        setLoadingSummary(false);
      }

      // Load Findings-Actions-Summary (for charts)
      setLoadingFindingsActionsSummary(true);
      try {
        const fasRes = await getAuditFindingsActionsSummary(auditId);
        console.log('[LeadAuditor] Findings-Actions-Summary loaded:', fasRes);
        setFindingsActionsSummary(fasRes);
      } catch (error) {
        console.error('Failed to load findings-actions-summary:', error);
      } finally {
        setLoadingFindingsActionsSummary(false);
      }
    };

    loadAllData();
  }, [selectedReportId, reportRequests]);

  const handleSubmit = async () => {
    if (!selectedReportId || !decision) {
      alert("Please select a report and make a decision.");
      return;
    }

    const current = reportRequests.find(r => r.reportRequestId === selectedReportId);
    if (!current) {
      alert("This report is no longer available in the list. Please refresh and try again.");
      return;
    }
    // Check if already processed
    const status = current.status?.toLowerCase() || '';
    if (status.includes('approved') || status.includes('rejected') || status.includes('completed')) {
      alert("This report has already been processed. You cannot approve/reject it again.");
      return;
    }

    setSubmitting(true);
    try {
      if (decision === "approve") {
        await approveFinalReport(selectedReportId, comments);
        alert("Report approved successfully! Forwarded to Director for final approval.");
      } else {
        await rejectFinalReport(selectedReportId, comments);
        alert("Report rejected. Auditor will be notified to revise the report.");
      }

      // Reload report requests after a short delay to allow backend to update
      setTimeout(() => {
        loadReportRequests();
      }, 500);

      // Reset form
      setSelectedReportId("");
      setDecision(null);
      setComments("");
      setAuditDetail(null);
    } catch (error: any) {
      console.error("Failed to submit decision:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to submit decision. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Selected report is resolved inside effects & handlers where needed
  // (no separate memoized variable required at top-level)
  const audit = auditDetail?.audit ?? {};

  const unwrapArray = <T,>(value: any): T[] => {
    if (Array.isArray(value)) return value as T[];
    return unwrap<T>(value);
  };

  const findingsArr = auditDetail ? unwrapArray<any>(auditDetail.findings) : [];
  const actionsArr = auditDetail ? unwrapArray<any>(auditDetail.actions) : [];

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Final Summary Review"
          subtitle="Review and approve/reject final audit summary reports submitted by Auditors."
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Report Requests List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white uppercase">Pending Reports</h2>
                    <p className="mt-1 text-xs text-white/80">
                      {reportRequests.length} report{reportRequests.length !== 1 ? "s" : ""} awaiting review
                    </p>
                  </div>
                  <button
                    onClick={loadReportRequests}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-white/20 rounded-md hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-primary-600">
                    <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading reports...
                  </div>
                ) : reportRequests.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No pending reports at this time.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[600px] overflow-y-auto">
                    {reportRequests.map((rr) => {
                      // Status badge color
                      const statusLower = (rr.status || '').toLowerCase();
                      const statusColor = statusLower.includes('pending') 
                        ? 'bg-yellow-100 text-yellow-800'
                        : statusLower.includes('approved')
                        ? 'bg-green-100 text-green-800'
                        : statusLower.includes('reject')
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800';
                      
                      return (
                        <li key={rr.reportRequestId}>
                          <button
                            onClick={() => setSelectedReportId(rr.reportRequestId)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedReportId === rr.reportRequestId
                                ? "bg-gradient-to-r from-primary-100 to-primary-50 border-primary-400 text-primary-900 shadow-sm"
                                : "bg-white border-primary-200 hover:bg-primary-50 hover:border-primary-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                                {rr.title || "Untitled audit report"}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                {rr.status}
                              </span>
                            </div>
                            {rr.requestedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(rr.requestedAt).toLocaleDateString()}
                              </p>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right: Report Detail & Decision */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedReportId ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
                Select a report from the list to review and make a decision.
              </div>
            ) : loadingDetail ? (
              <div className="bg-white border border-primary-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
                <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading audit details...</span>
              </div>
            ) : !auditDetail ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                Unable to load audit details. Please try again.
              </div>
            ) : (
              <>
                {/* Audit Summary */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Final Audit Summary Report</h2>
                    <p className="mt-1 text-xs text-white/80">
                      Report prepared by Auditor. Review for accuracy before forwarding to Director.
                    </p>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Audit ID</p>
                        <p className="mt-1 font-medium">{audit.auditId || "—"}</p>
                      </div> */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Title</p>
                        <p className="mt-1">{audit.title || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Type</p>
                        <p className="mt-1">{audit.type || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                        <p className="mt-1">{audit.status || "—"}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase">Objectives</p>
                        <p className="mt-1 text-gray-700 whitespace-pre-line">{audit.objective || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase">Scope</p>
                        <p className="mt-1 text-gray-700 whitespace-pre-line">{audit.scope || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase">Summary of Findings</p>
                        <p className="mt-1 text-gray-700">
                          {findingsArr.length} finding{findingsArr.length !== 1 ? "s" : ""} recorded
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase">Actions</p>
                        <p className="mt-1 text-gray-700">
                          {actionsArr.length} action{actionsArr.length !== 1 ? "s" : ""} recorded
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Panel */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Review Decision</h2>
                    <p className="mt-1 text-xs text-white/80">
                      Verify accuracy and completeness before forwarding to Director or requesting revision.
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Decision</p>
                      <div className="flex flex-col gap-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value="approve"
                            checked={decision === "approve"}
                            onChange={() => setDecision("approve")}
                            className="text-primary-600 border-gray-300 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">Approve & forward to Director</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value="reject"
                            checked={decision === "reject"}
                            onChange={() => setDecision("reject")}
                            className="text-primary-600 border-gray-300 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">Reject & request revision</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">
                        Lead Auditor Comments
                      </label>
                      <textarea
                        rows={5}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="Comments on accuracy, completeness, alignment with standards, or revision requirements..."
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!decision || submitting}
                      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : decision === "approve" ? (
                        "Approve & Forward to Director"
                      ) : (
                        "Reject & Request Revision"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
