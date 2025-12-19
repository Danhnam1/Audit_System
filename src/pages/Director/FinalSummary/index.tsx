import { useEffect, useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAllReportRequests, approveFinalReport, rejectFinalReport } from "../../../api/reportRequest";
import { getAuditFullDetail, getAuditFindingsActionsSummary } from "../../../api/audits";
import { getAuditResultByAuditId, calculateAuditResult } from "../../../api/auditResult";
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

export default function DirectorFinalSummaryPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [auditDetail, setAuditDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Evaluate audit effectiveness (Stream 5 - System lane)
  const [effectivenessLoading, setEffectivenessLoading] = useState(false);
  const [effectivenessSummary, setEffectivenessSummary] = useState<any | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [calculatingEffectiveness, setCalculatingEffectiveness] = useState(false);

  const loadEffectiveness = async (auditId: string) => {
    if (!auditId) return;
    setEffectivenessLoading(true);
    try {
      const [summaryRes, resultRes] = await Promise.all([
        getAuditFindingsActionsSummary(auditId),
        getAuditResultByAuditId(auditId).catch(() => null),
      ]);
      const summaryData = (summaryRes as any)?.data ?? summaryRes ?? null;
      setEffectivenessSummary(summaryData);
      setAuditResult(resultRes);
    } catch (error) {
      console.error("Failed to load effectiveness data:", error);
      setEffectivenessSummary(null);
    } finally {
      setEffectivenessLoading(false);
    }
  };

  // Load pending report requests (status: PendingSecondApproval - waiting for Director)
  useEffect(() => {
    const loadReportRequests = async () => {
      setLoading(true);
      try {
        const all = await getAllReportRequests();
        // Filter for PendingSecondApproval (waiting for Director)
        const pending = all.filter(r => r.status === "PendingSecondApproval");
        setReportRequests(pending);
      } catch (error) {
        console.error("Failed to load report requests:", error);
        setReportRequests([]);
      } finally {
        setLoading(false);
      }
    };
    loadReportRequests();
    
    // Auto-refresh every 30 seconds to catch new submissions from Lead Auditor
    const interval = setInterval(loadReportRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load audit detail + effectiveness when report is selected
  useEffect(() => {
    if (!selectedReportId) {
      setAuditDetail(null);
      return;
    }

    const selectedReport = reportRequests.find(r => r.reportRequestId === selectedReportId);
    if (!selectedReport) return;

    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(selectedReport.auditId);
        setAuditDetail(res);
        await loadEffectiveness(selectedReport.auditId);
      } catch (error) {
        console.error("Failed to load audit detail:", error);
        setAuditDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadDetail();
  }, [selectedReportId, reportRequests]);

  const handleSubmit = async () => {
    if (!selectedReportId || !decision) {
      alert("Please select a report and make a decision.");
      return;
    }

    const current = reportRequests.find(r => r.reportRequestId === selectedReportId);
    if (!current) {
      alert("This report is no longer available in the pending list. Please refresh and try again.");
      return;
    }
    if (current.status !== "PendingSecondApproval") {
      alert("This report is no longer pending Director approval. You cannot approve/reject it again.");
      return;
    }

    setSubmitting(true);
    try {
      const currentReport = reportRequests.find(r => r.reportRequestId === selectedReportId);
      const auditId = currentReport?.auditId;

      if (decision === "approve") {
        await approveFinalReport(selectedReportId, comments);
        // After Director approval, evaluate audit effectiveness using AuditResult APIs
        if (auditId) {
          try {
            setCalculatingEffectiveness(true);
            const result = await calculateAuditResult(auditId);
            setAuditResult(result);
            await loadEffectiveness(auditId);
          } catch (err) {
            console.error("Failed to evaluate audit effectiveness:", err);
          } finally {
            setCalculatingEffectiveness(false);
          }
        }
        alert("Report approved successfully! Final summary has been saved and audit effectiveness has been evaluated.");
      } else {
        await rejectFinalReport(selectedReportId, comments);
        alert("Report rejected. Auditor will be notified to revise the report.");
      }

      // Reload report requests after a short delay to allow backend to update
      setTimeout(async () => {
        try {
          const all = await getAllReportRequests();
          const pending = all.filter(r => r.status === "PendingSecondApproval");
          setReportRequests(pending);
        } catch (error) {
          console.error("Failed to reload report requests:", error);
        }
      }, 500);

      // Keep current selection so Director can see effectiveness evaluation
      setDecision(null);
      setComments("");
    } catch (error: any) {
      console.error("Failed to submit decision:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to submit decision. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedReport = reportRequests.find(r => r.reportRequestId === selectedReportId);
  const audit = auditDetail?.audit ?? {};

  const unwrapArray = <T,>(value: any): T[] => {
    if (Array.isArray(value)) return value as T[];
    return unwrap<T>(value);
  };

  const findingsArr = auditDetail ? unwrapArray<any>(auditDetail.findings) : [];
  const actionsArr = auditDetail ? unwrapArray<any>(auditDetail.actions) : [];

  const handleRecalculateEffectiveness = async () => {
    if (!audit?.auditId) return;
    try {
      setCalculatingEffectiveness(true);
      const result = await calculateAuditResult(audit.auditId);
      setAuditResult(result);
      await loadEffectiveness(audit.auditId);
    } catch (error) {
      console.error("Failed to recalculate audit effectiveness:", error);
    } finally {
      setCalculatingEffectiveness(false);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Final Summary Review & Approval"
          subtitle="Review final audit summary reports and make formal approval decisions. Approved reports will be permanently stored and attached to accreditation evidence."
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Report Requests List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                <h2 className="text-sm font-semibold text-white uppercase">Pending Reports</h2>
                <p className="mt-1 text-xs text-white/80">
                  {reportRequests.length} report{reportRequests.length !== 1 ? "s" : ""} waiting for approval
                </p>
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
                    {reportRequests.map((rr) => (
                      <li key={rr.reportRequestId}>
                        <button
                          onClick={() => setSelectedReportId(rr.reportRequestId)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedReportId === rr.reportRequestId
                              ? "bg-gradient-to-r from-primary-100 to-primary-50 border-primary-400 text-primary-900 shadow-sm"
                              : "bg-white border-primary-200 hover:bg-primary-50 hover:border-primary-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {rr.title || `Report for Audit ${rr.auditId.slice(0, 8)}...`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Audit ID: {rr.auditId.slice(0, 8)}...
                          </p>
                          {rr.requestedAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(rr.requestedAt).toLocaleDateString()}
                            </p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right: Report Detail & Decision */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedReportId ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
                Select a report from the list to review and make an approval decision.
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
                      Report prepared by Auditor and reviewed by Lead Auditor. Make final approval decision.
                    </p>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Audit ID</p>
                        <p className="mt-1 font-medium">{audit.auditId || "—"}</p>
                      </div>
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
                    <h2 className="text-sm font-semibold text-white uppercase">Approval Decision</h2>
                    <p className="mt-1 text-xs text-white/80">
                      Make final approval decision. Approved reports will be permanently stored and attached to accreditation evidence.
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
                          <span className="text-sm text-gray-700">Approve final summary report</span>
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
                          <span className="text-sm text-gray-700">Reject & request rework</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">
                        Director Comments
                      </label>
                      <textarea
                        rows={5}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="Approval rationale or rework instructions, including any link to accreditation or regulatory requirements..."
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
                        "Approve & Save Final Summary"
                      ) : (
                        "Reject & Send Back for Rework"
                      )}
                    </button>
                  </div>
                </div>

                {/* Evaluate Audit Effectiveness */}
                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Evaluate audit effectiveness</h2>
                    <p className="mt-1 text-xs text-white/80">
                      System evaluates effectiveness based on completed corrective actions versus total audit findings,
                      using the pass threshold configured in the backend.
                    </p>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    {effectivenessLoading ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-primary-700">
                        <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading effectiveness data...</span>
                      </div>
                    ) : !effectivenessSummary ? (
                      <p className="text-sm text-gray-500">
                        No effectiveness data available yet. Run evaluation after reviewing and approving the final summary report.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-md bg-primary-50 border border-primary-200 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-medium text-primary-700 uppercase">Total findings</p>
                            <p className="mt-1 text-lg font-bold text-primary-900">
                              {effectivenessSummary.totalFindings ?? effectivenessSummary.totalFindings ?? 0}
                            </p>
                          </div>
                          <div className="rounded-md bg-primary-50 border border-primary-200 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-medium text-primary-700 uppercase">Findings with completed actions</p>
                            <p className="mt-1 text-lg font-bold text-primary-900">
                              {effectivenessSummary.completedActions ?? 0}
                            </p>
                          </div>
                          <div className="rounded-md bg-primary-50 border border-primary-200 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-medium text-primary-700 uppercase">Overdue actions</p>
                            <p className="mt-1 text-lg font-bold text-primary-900">
                              {effectivenessSummary.overdueActions ?? 0}
                            </p>
                          </div>
                          <div className="rounded-md bg-primary-50 border border-primary-200 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-medium text-primary-700 uppercase">Effectiveness %</p>
                            <p className="mt-1 text-lg font-bold text-primary-900">
                              {auditResult?.percentage != null ? `${auditResult.percentage}%` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-600">
                            {auditResult ? (
                              <>
                                <span className="font-semibold">Overall result:&nbsp;</span>
                                <span
                                  className={`font-semibold ${
                                    auditResult.result === "Pass"
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {auditResult.result}
                                </span>
                                {auditResult.percentage != null && (
                                  <span>{` (${auditResult.percentage}% of findings with completed actions)`}</span>
                                )}
                              </>
                            ) : (
                              "Effectiveness has not been evaluated yet for this audit."
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleRecalculateEffectiveness}
                            disabled={calculatingEffectiveness || !audit?.auditId}
                            className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-primary-600 rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          >
                            {calculatingEffectiveness ? (
                              <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                Evaluating...
                              </>
                            ) : (
                              "Evaluate / recalculate effectiveness"
                            )}
                          </button>
                        </div>
                      </>
                    )}
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
