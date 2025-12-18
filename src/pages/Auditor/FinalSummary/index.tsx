import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAuditFullDetail, getAuditPlans } from "../../../api/audits";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";

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

  // Load full-detail when user selects an audit (GET /Audits/{id}/full-detail)
  useEffect(() => {
    if (!selectedAuditId) {
      setDetail(null);
      return;
    }

    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await getAuditFullDetail(selectedAuditId);
        setDetail(res as FullDetailResponse);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadDetail();
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
  const findingsArr = detail ? unwrapArray<any>(detail.findings) : [];
  const actionsArr = detail ? unwrapArray<any>(detail.actions) : [];
  const documentsArr = detail ? unwrapArray<any>(detail.documents) : [];

  const period = useMemo(() => {
    const from = audit.startDate ? new Date(audit.startDate).toLocaleDateString() : "";
    const to = audit.endDate ? new Date(audit.endDate).toLocaleDateString() : "";
    if (!from && !to) return "";
    if (from && to) return `${from} – ${to}`;
    return from || to;
  }, [audit.startDate, audit.endDate]);

  const findingsCount = findingsArr.length;
  const actionsCount = actionsArr.length;
  const documentsCount = documentsArr.length;

  const headerSubtitle = useMemo(() => {
    if (!selectedAuditId) {
      return "Select an audit below to view its full detail and prepare your final summary offline.";
    }
    if (loadingDetail) {
      return "Loading audit information from full-detail API...";
    }
    return "This screen only uses GET APIs. Data is read-only and reflects the current state of the audit record.";
  }, [selectedAuditId, loadingDetail]);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Prepare Final Audit Summary Report"
          subtitle={headerSubtitle}
          rightContent={
            <div className="flex flex-col items-start gap-1 md:items-end">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-700">Audit</label>
              <select
                value={selectedAuditId}
                onChange={e => setSelectedAuditId(e.target.value)}
                className="min-w-[260px] px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900"
              >
                <option value="">{loadingAudits ? "Loading audits..." : "Select audit..."}</option>
                {audits.map(a => (
                  <option key={a.auditId} value={a.auditId}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {/* Content */}
        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
              Choose an audit from the dropdown above to load its full-detail information.
            </div>
          ) : loadingDetail ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-gray-600">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading audit full-detail...</span>
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
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">General information</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 text-sm text-gray-700">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Audit ID</p>
                      <p className="mt-1">{audit.auditId || "—"}</p>
                    </div>
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
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">Objectives & scope</h2>
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

                {/* Findings and actions overview */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">Findings & actions overview</h2>
                  </div>
                  <div className="p-4 space-y-4 text-sm text-gray-700">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg bg-sky-50 border border-sky-100 py-2">
                        <p className="text-[11px] font-semibold text-sky-700 uppercase tracking-wide">Findings</p>
                        <p className="mt-1 text-xl font-semibold text-sky-900">{findingsCount}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 py-2">
                        <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Actions</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-900">{actionsCount}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 border border-indigo-100 py-2">
                        <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Documents</p>
                        <p className="mt-1 text-xl font-semibold text-indigo-900">{documentsCount}</p>
                      </div>
                    </div>

                    {findingsArr.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sample findings</p>
                        <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {findingsArr.slice(0, 5).map((f: any) => {
                            const attachments = unwrapArray<any>(f.attachments);
                            return (
                              <li key={f.findingId} className="border border-slate-200 rounded-md p-2 bg-slate-50/80">
                                <p className="text-xs font-semibold text-slate-900">
                                  {f.title || "Untitled finding"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-500 flex flex-wrap gap-1 items-center">
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                    {`Severity: ${f.severity || "N/A"}`}
                                  </span>
                                  <span className="text-[11px] text-slate-500 ml-1">
                                    Department: {f.deptId ?? "N/A"}
                                  </span>
                                </p>
                                {f.description && (
                                  <p className="mt-1 text-xs text-gray-700 line-clamp-2">{f.description}</p>
                                )}

                                {attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[11px] font-semibold text-slate-600">
                                      Attachments ({attachments.length})
                                    </p>
                                    <ul className="space-y-0.5">
                                      {attachments.slice(0, 3).map((att: any) => (
                                        <li key={att.attachmentId} className="flex items-center justify-between text-[11px] text-slate-600">
                                          <span className="truncate max-w-[180px]">
                                            {att.fileName || "Attachment"}
                                          </span>
                                          <span className="ml-2 text-[10px] text-slate-400">
                                            {att.contentType || ""} · {att.status || "Active"}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {actionsArr.length > 0 && (
                      <div className="pt-3 border-t border-dashed border-gray-200 space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase">Action attachments</p>
                        <ul className="space-y-1 max-h-40 overflow-y-auto pr-1 text-xs text-gray-700">
                          {actionsArr.slice(0, 5).map((a: any) => {
                            const attachments = unwrapArray<any>(a.attachments);
                            if (attachments.length === 0) return null;
                            return (
                              <li key={a.actionId} className="border border-slate-200 rounded-md p-2 bg-white">
                                <p className="font-semibold text-slate-800 line-clamp-1">
                                  {a.title || "Action"}
                                </p>
                                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                                  {attachments.slice(0, 2).map((att: any) => (
                                    <li key={att.attachmentId} className="flex items-center justify-between">
                                      <span className="truncate max-w-[180px]">
                                        {att.fileName || "Attachment"}
                                      </span>
                                      <span className="ml-2 text-[10px] text-slate-400">
                                        {att.contentType || ""} · {att.status || "Active"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">Documents</h2>
                  </div>
                  <div className="p-4 text-sm text-gray-700">
                    {documentsArr.length === 0 ? (
                      <p className="text-gray-500 text-xs">No documents recorded for this audit.</p>
                    ) : (
                      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {documentsArr.map((d: any) => (
                          <li key={d.docId} className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{d.title || d.documentType || "Document"}</p>
                              <p className="text-[11px] text-gray-500">
                                Type: {d.documentType || "N/A"} · Final: {String(d.isFinalVersion ?? false)}
                              </p>
                            </div>
                            <span className="text-[11px] text-gray-400">{d.contentType || ""}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: workflow + snapshot from arrays */}
              <aside className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">Workflow status</h2>
                  </div>
                  <div className="p-4 text-sm text-gray-600 space-y-2">
                    <p>
                      Stream 5: <span className="font-medium">Audit Summary and Report Results Submission</span>.
                    </p>
                    <ol className="space-y-1 text-xs list-decimal list-inside">
                      <li>Auditor prepares the final audit summary report (using this screen as reference).</li>
                      <li>Lead Auditor reviews accuracy of the report.</li>
                      <li>Director reviews, evaluates effectiveness and approves the final report.</li>
                    </ol>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 uppercase">Audit data snapshot</h2>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 text-xs text-gray-700">
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-600">Schedules</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900">{schedulesArr.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-600">Scope departments</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900">{scopeDepartmentsArr.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-600">Criteria mapped</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900">{criteriaArr.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-600">Checklist templates</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900">{checklistArr.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2 col-span-2">
                      <p className="text-[11px] font-medium text-slate-600">Team members</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900">{teamsArr.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 text-xs text-sky-900">
                  <p className="font-semibold">Content guidance</p>
                  <p className="mt-1">
                    Use the information on this screen as the data basis for your final audit summary. The GET endpoint
                    does not modify any data; it only presents the current state of the audit for reporting purposes.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}

