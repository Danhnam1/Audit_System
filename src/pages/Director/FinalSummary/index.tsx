import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { DataTable } from "../../../components/DataTable";
import { getAuditFullDetail, getAuditPlans, getAuditSummary, getAuditFindingsActionsSummary, archiveAudit } from "../../../api/audits";
import { getDepartments } from "../../../api/departments";
import { getAuditTeam } from "../../../api/auditTeam";
import { getAdminUsers } from "../../../api/adminUsers";
import { getAuditCriteria } from "../../../api/auditCriteria";
import { getChecklistTemplates } from "../../../api/checklists";
import { getAllReportRequests } from "../../../api/reportRequest";
import { getAuditResultByAuditId, calculateAuditResult, updateAuditResultManager } from "../../../api/auditResult";
import { unwrap } from "../../../utils/normalize";
import { PageHeader } from "../../../components";
import {
  FindingsTable,
  OverdueActionsTable,
  ChartsSection,
  DocumentsSection,
} from "../../Shared/FinalReport";
import { PlanDetailsModal } from "../../Auditor/AuditPlanning/components/PlanDetailsModal";
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor, getSeverityChartColor } from "../../../constants";

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

export default function DirectorFinalSummaryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { auditId: auditIdFromUrl } = useParams<{ auditId?: string }>();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<Array<{ auditId: string; title: string; type: string; startDate: string; endDate: string; scope: string }>>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>(auditIdFromUrl || "");
  const [loadingAudits, setLoadingAudits] = useState(false);

  const [detail, setDetail] = useState<FullDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
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
  
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);

  // Audit Effectiveness
  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingEffectiveness, setLoadingEffectiveness] = useState(false);
  const [calculatingEffectiveness, setCalculatingEffectiveness] = useState(false);
const lastCalculatedAuditRef = useRef<string>("");
  const [editResult, setEditResult] = useState<string>('');
  const [editPercentage, setEditPercentage] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');
  const [savingResult, setSavingResult] = useState(false);
  const [archivingAudit, setArchivingAudit] = useState(false);
  
  // Modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "confirm">("success");

  // Props for PlanDetailsModal
  const ownerOptionsForModal = useMemo(() => {
    return adminUsers.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditee'));
  }, [adminUsers]);
  const auditorOptionsForModal = useMemo(() => {
    return adminUsers.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditor'));
  }, [adminUsers]);
  const currentUserIdForModal = useMemo(() => {
    if (user?.email) {
      const found = adminUsers.find((u: any) => String(u?.email || '').toLowerCase().trim() === String(user.email || '').toLowerCase().trim());
      if (found?.userId) return String(found.userId);
      if (found?.$id) return String(found.$id);
    }
    if ((user as any)?.userId) return String((user as any).userId);
    return null;
  }, [user, adminUsers]);
  const getTemplateInfoById = useCallback((templateId: string | number | null | undefined) => {
    if (!templateId) return null;
    const template = checklistTemplates.find((t: any) => String(t.templateId || t.id || t.$id || '') === String(templateId));
    if (!template) return null;
    return {
      name: template.title || template.name || `Template ${String(templateId)}`,
      version: template.version,
      description: template.description,
    };
  }, [checklistTemplates]);

  // Load list of audits for dropdown - only those sent from Lead Auditor to Director
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      try {
        const [plansRes, , usersRes, deptsRes, criteriaRes, templatesRes, reportRequestsRes] = await Promise.all([
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
              name: d.name || d.code || String(d.deptId ?? d.id ?? d.$id ?? "N/A"),
            }))
          : [];
        setDepartments(deptList);
        const adminUsersArr = Array.isArray(usersRes) ? usersRes : [];
        setAdminUsers(adminUsersArr);
        const criteriaArr = Array.isArray(criteriaRes) ? criteriaRes : [];
        setAuditCriteria(criteriaArr);
        const templatesArr = Array.isArray(templatesRes) ? templatesRes : [];
        setChecklistTemplates(templatesArr);

        // Filter report requests: Director should see all submitted audits
        // No status filtering needed - once Auditor submits, Director can view it
        const relevantReportRequests = Array.isArray(reportRequestsRes)
          ? reportRequestsRes.filter((rr: any) => {
              const status = String(rr?.status || "").trim().toLowerCase();
              // Show Pending (newly submitted), Approved, or any other status
              // Exclude only if explicitly empty or invalid
              return status && status !== '' && status !== 'null' && status !== 'undefined';
            })
          : [];

        const relevantAuditIds = new Set<string>();
        relevantReportRequests.forEach((rr: any) => {
          const auditId = rr?.auditId;
          if (auditId) {
            const val = String(auditId).trim();
            if (val) {
              relevantAuditIds.add(val);
              relevantAuditIds.add(val.toLowerCase());
            }
          }
        });

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

        // Only show audits that have a report request sent to Director
        const filteredAudits = (Array.isArray(plans) ? plans : [])
          .map((a: any) => {
            let title = a.title || a.auditTitle || "Untitled audit";
            // Remove "true" or "false" from title if present
            title = title.replace(/\s*(true|false)\s*$/i, '').trim();
            return {
              auditId: a.auditId || a.id || "",
              title: title,
              type: a.type || a.auditType || "—",
              startDate: formatDate(a.startDate || a.periodFrom),
              endDate: formatDate(a.endDate || a.periodTo),
              scope: formatScope(a.scope),
            };
          })
          .filter((x: any) => {
            if (!x.auditId) return false;
            const idLower = x.auditId.toLowerCase();
            return relevantAuditIds.has(x.auditId) || relevantAuditIds.has(idLower);
          });

        setAudits(filteredAudits);
      } catch (error) {
        console.error('[Director] Failed to load audits:', error);
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
      setSelectedAuditId("");
    }
  }, [auditIdFromUrl]);

  // Load all 3 APIs when user selects an audit
  useEffect(() => {
    if (!selectedAuditId) {
      setDetail(null);
      setSummaryData(null);
      setFindingsActionsSummary(null);
      setAuditResult(null);
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

    const loadEffectiveness = async () => {
      setLoadingEffectiveness(true);
      try {
        const result = await getAuditResultByAuditId(selectedAuditId);
        setAuditResult(result);
      } catch (error) {
        console.error('Failed to load audit result:', error);
        setAuditResult(null);
      } finally {
        setLoadingEffectiveness(false);
      }
    };

    loadAllData();
    loadEffectiveness();
  }, [selectedAuditId]);

  const unwrapArray = <T,>(value: any): T[] => {
    if (Array.isArray(value)) return value as T[];
    return unwrap<T>(value);
  };

  const schedulesArr = detail ? unwrapArray<any>(detail.schedules) : [];
  const scopeDepartmentsArr = detail ? unwrapArray<any>(detail.scopeDepartments) : [];
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

  const planDetailsForModal = useMemo(() => {
    if (!detail?.audit) return null;
    return {
      auditId: detail.audit.auditId || selectedAuditId,
      id: detail.audit.auditId || selectedAuditId,
      title: detail.audit.title || 'N/A',
      type: detail.audit.type,
      scope: detail.audit.scope,
      startDate: detail.audit.startDate,
      endDate: detail.audit.endDate,
      status: detail.audit.status,
      objective: detail.audit.objective,
      schedules: { values: schedulesArr },
      scopeDepartments: { values: scopeDepartmentsArr },
      auditTeams: { values: teamsArr },
    };
  }, [detail, selectedAuditId, schedulesArr, scopeDepartmentsArr, teamsArr]);

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _findingsCount = filteredFindingsArr.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _openFindingsFiltered = filteredFindingsArr.filter((f: any) => {
  //   const st = String(f?.status || '').toLowerCase();
  //   return !st.includes('closed') && !st.includes('complete');
  // }).length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _closedFindingsFiltered = filteredFindingsArr.filter((f: any) => {
  //   const st = String(f?.status || '').toLowerCase();
  //   return st.includes('closed') || st.includes('complete');
  // }).length;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _actionsCount = filteredActionsArr.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _completedActionsFiltered = filteredActionsArr.filter(isActionCompleted).length;
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
      return "Select an audit below to review the final summary report and evaluate audit effectiveness.";
    }
    if (loadingDetail) {
      return "Loading audit information...";
    }
    return "Review the final audit summary report and evaluate effectiveness.";
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


  const handleCalculateEffectiveness = async () => {
    if (!selectedAuditId) {
      return;
    }

    setCalculatingEffectiveness(true);
    try {
      const result = await calculateAuditResult(selectedAuditId);
      setAuditResult(result);
      // Silent calculation - no alert
    } catch (error: any) {
      console.error("Failed to calculate effectiveness:", error);
      // Silent error - no alert
    } finally {
      setCalculatingEffectiveness(false);
    }
  };

// Auto-calculate effectiveness once when audit is selected
useEffect(() => {
  if (!selectedAuditId) return;
  if (calculatingEffectiveness || loadingEffectiveness) return;
  if (lastCalculatedAuditRef.current === selectedAuditId) return;
  lastCalculatedAuditRef.current = selectedAuditId;
  handleCalculateEffectiveness();
}, [selectedAuditId, calculatingEffectiveness, loadingEffectiveness]);

  // Derived values to display (API returns percentage/result)
  const effectivenessValue = auditResult?.effectivenessScore != null
    ? Number(auditResult.effectivenessScore)
    : (auditResult?.percentage != null ? Number(auditResult.percentage) : null);
  // const _complianceValue = auditResult?.complianceRate != null
  //   ? Number(auditResult.complianceRate)
  //   : effectivenessValue; // Unused
  const resultLabel = auditResult?.result || auditResult?.status || '';

  // Sync editable fields when auditResult changes
  useEffect(() => {
    setEditResult(resultLabel || '');
    setEditPercentage(effectivenessValue != null ? String(effectivenessValue) : '');
    setEditComment(auditResult?.comment || '');
  }, [auditResult, resultLabel, effectivenessValue]);

  const handleSaveResult = async () => {
    if (!selectedAuditId) {
      setModalMessage("No audit selected.");
      setModalType("error");
      setShowSaveModal(true);
      return;
    }
    setSavingResult(true);
    try {
      const payload: any = {
        result: editResult || undefined,
        percentage: editPercentage !== '' ? Number(editPercentage) : undefined,
        comment: editComment ?? null,
      };
      const updated = await updateAuditResultManager(selectedAuditId, payload);
      setAuditResult(updated);
      setModalMessage("Saved effectiveness result successfully.");
      setModalType("success");
      setShowSaveModal(true);
    } catch (error: any) {
      console.error("Failed to save audit result:", error);
      const msg = error?.response?.data?.message || error?.message || "Failed to save.";
      setModalMessage(msg);
      setModalType("error");
      setShowSaveModal(true);
    } finally {
      setSavingResult(false);
    }
  };

  const handleCloseAudit = () => {
    if (!selectedAuditId) {
      setModalMessage("No audit selected.");
      setModalType("error");
      setShowCloseModal(true);
      return;
    }
    
    setModalMessage("Are you sure you want to close this audit? This action cannot be undone.");
    setModalType("confirm");
    setShowCloseModal(true);
  };

  const confirmCloseAudit = async () => {
    setShowCloseModal(false);
    setArchivingAudit(true);
    try {
      await archiveAudit(selectedAuditId);
      setModalMessage("Audit closed successfully.");
      setModalType("success");
      setShowCloseModal(true);
      // Clear selection - the useEffect will reload the audit list automatically
      setSelectedAuditId("");
      // Reload page to refresh audit list after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Failed to close audit:", error);
      const msg = error?.response?.data?.message || error?.message || "Failed to close audit.";
      setModalMessage(msg);
      setModalType("error");
      setShowCloseModal(true);
    } finally {
      setArchivingAudit(false);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Final Summary - Director Review"
          subtitle={headerSubtitle}
          rightContent={
            selectedAuditId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/director/final-summary')}
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
              </div>
            )
          }
        />

        <section className="pb-2">
          {!selectedAuditId ? (
            <div className="bg-white border border-primary-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Select an Audit</h3>
                <p className="text-sm text-gray-500 mt-1">Choose an audit from the table below to review its final summary report.</p>
              </div>
              <DataTable
                columns={[
                  {
                    key: "title",
                    header: "TITLE",
                    render: (row) => (
                      <div
                        onClick={() => navigate(`/director/final-summary/${row.auditId}`)}
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
                        onClick={() => navigate(`/director/final-summary/${row.auditId}`)}
                        className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 transition-colors"
                      >
                        View
                      </button>
                    ),
                  },
                ]}
                data={audits}
                loading={loadingAudits}
                loadingMessage="Loading audits..."
                emptyState="No audits available."
                rowKey={(row) => row.auditId}
                getRowClassName={() => "border-b border-gray-100 transition-colors hover:bg-primary-50 cursor-pointer"}
                bodyClassName=""
              />
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                Click on an audit row to review its final summary report.
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
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                

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

              <aside className="space-y-4">
                {/* <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
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
                </div> */}

                <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
                  <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
                    <h2 className="text-sm font-semibold text-white uppercase">Evaluate Audit Effectiveness</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {loadingEffectiveness ? (
                      <div className="flex items-center justify-center py-4 text-xs text-gray-500">
                        <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading...
                      </div>
                    ) : auditResult ? (
                      <div className="space-y-3 text-xs text-gray-700">
                        <div className="rounded-md bg-gradient-to-br from-primary-50 to-white border border-primary-200 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium text-primary-700 uppercase">Effectiveness Score</p>
                            {resultLabel && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 border border-primary-200">
                                {resultLabel}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-2xl font-bold text-primary-900">
                            {effectivenessValue != null 
                              ? `${effectivenessValue.toFixed(1)}%` 
                              : "—"}
                          </p>
                        </div>
                       
                        
                        {/* Display saved Result and Comment */}
                        {(resultLabel || auditResult?.comment) && (
                          <div className="space-y-2 pt-2 border-t border-gray-200">
                            {resultLabel && (
                              <div className="flex items-start gap-2">
                                <p className="text-[11px] font-semibold text-gray-700 uppercase min-w-[80px]">Result:</p>
                                <p className="text-xs text-gray-900 font-medium">{resultLabel}</p>
                              </div>
                            )}
                            {auditResult?.comment && (
                              <div className="flex items-start gap-2">
                                <p className="text-[11px] font-semibold text-gray-700 uppercase min-w-[80px]">Comment:</p>
                                <p className="text-xs text-gray-900 flex-1 whitespace-pre-wrap">{auditResult.comment}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-gray-500">
                        No effectiveness data available yet.
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[11px] font-semibold text-gray-700 uppercase">Result</label>
                          <select
                            value={editResult}
                            onChange={(e) => setEditResult(e.target.value)}
                            className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                          >
                           
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                            
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[11px] font-semibold text-gray-700 uppercase">Percentage (%)</label>
                          <input
                            type="number"
                            value={editPercentage}
                            onChange={(e) => setEditPercentage(e.target.value)}
                            className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                            placeholder="e.g., 80"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-gray-700 uppercase">Comment</label>
                        <input
                          type="text"
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          className="mt-1 px-3 py-4 border border-gray-300 rounded-md text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 w-full"
                          placeholder="Type your comment here..."
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleSaveResult}
                          disabled={savingResult || !selectedAuditId}
                          className="w-full px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingResult ? "Saving..." : "Save Result"}
                        </button>
                        <button
                          onClick={handleCloseAudit}
                          disabled={archivingAudit || !selectedAuditId}
                          className="w-full px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {archivingAudit ? "Closing..." : "Closed Audit"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>

        {/* Save Result Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowSaveModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
              <div className={`px-6 py-4 border-b rounded-t-xl ${modalType === "success" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${modalType === "success" ? "text-emerald-900" : "text-red-900"}`}>
                    {modalType === "success" ? "Success" : "Error"}
                  </h3>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/50 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">{modalMessage}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      modalType === "success"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Audit Modal */}
        {showCloseModal && (
          <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => modalType !== "confirm" && setShowCloseModal(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
              <div className={`px-6 py-4 border-b rounded-t-xl ${modalType === "success" ? "bg-emerald-50 border-emerald-200" : modalType === "error" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${
                    modalType === "success" ? "text-emerald-900" : 
                    modalType === "error" ? "text-red-900" : 
                    "text-yellow-900"
                  }`}>
                    {modalType === "success" ? "Success" : modalType === "error" ? "Error" : "Confirm"}
                  </h3>
                  {modalType !== "confirm" && (
                    <button
                      onClick={() => setShowCloseModal(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/50 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">{modalMessage}</p>
                <div className="flex justify-end gap-2">
                  {modalType === "confirm" ? (
                    <>
                      <button
                        onClick={() => setShowCloseModal(false)}
                        className="px-4 py-2 rounded-md text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmCloseAudit}
                        disabled={archivingAudit}
                        className="px-4 py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {archivingAudit ? "Closing..." : "Yes, Close Audit"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowCloseModal(false)}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        modalType === "success"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                    >
                      OK
                    </button>
                  )}
                </div>
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
