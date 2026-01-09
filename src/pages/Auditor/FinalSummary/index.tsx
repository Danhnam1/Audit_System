import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary } from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { submitFinalReport, getReportRequestFromFinalSubmit } from "../../../api/reportRequest";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { getChecklistTemplates } from "../../../api/checklists";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import { FindingsTable, OverdueActionsTable, ChartsSection, DocumentsSection } from "../../Shared/FinalReport";

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
     reportRequest.status === 'PendingSecondApproval' || 
     reportRequest.status === 'Approved')
  );
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

