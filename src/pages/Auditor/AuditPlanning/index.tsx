import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import type { AuditPlan, AuditPlanDetails } from '../../../types/auditPlan';
import { getChecklistTemplates } from '../../../api/checklists';
import { createAudit, addAuditScopeDepartment } from '../../../api/audits';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { addCriterionToAudit } from '../../../api/auditCriteriaMap';
import { getAdminUsers } from '../../../api/adminUsers';
import { addTeamMember } from '../../../api/auditTeam';
import { getDepartments } from '../../../api/departments';
import { addAuditSchedule, getAuditSchedules } from '../../../api/auditSchedule';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../constants/audit';
import { getAuditPlanById, updateAuditPlan, deleteAuditPlan, submitToLeadAuditor } from '../../../api/audits';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { normalizePlanDetails, unwrap } from '../../../utils/normalize';

// Import custom hooks
import { useAuditPlanForm } from '../../../hooks/useAuditPlanForm';
import { useAuditPlanFilters } from '../../../hooks/useAuditPlanFilters';

// Import helper functions
import { getCriterionName, getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getStatusColor, getBadgeVariant } from '../../../constants';

// Import components
import { FilterBar } from './components/FilterBar';
import { PlanTable } from './components/PlanTable';
import { PlanDetailsModal } from './components/PlanDetailsModal';
import { Toast } from './components/Toast';
import { Step1BasicInfo } from './components/PlanForm/Step1BasicInfo';
import { Step2Scope } from './components/PlanForm/Step2Scope';
import { Step3Checklist } from './components/PlanForm/Step3Checklist';
import { Step4Team } from './components/PlanForm/Step4Team';
import { Step5Schedule } from './components/PlanForm/Step5Schedule';

const AUDITOR_VISIBLE_STATUSES = ['draft', 'pendingreview', 'pendingdirectorapproval', 'approved', 'rejected'];

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();

  // Use custom hooks for form state management
  const formState = useAuditPlanForm();

  // Data fetching states
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  // UI: tabs for plans when more than pageSize
  const [activePlansTab, setActivePlansTab] = useState<number>(1);
  const pageSize = 7;

  const visiblePlans = useMemo(() => {
    return existingPlans.filter((plan) => {
      const normStatus = String(plan.status || 'draft').toLowerCase().replace(/\s+/g, '');
      return AUDITOR_VISIBLE_STATUSES.includes(normStatus);
    });
  }, [existingPlans]);

  // Use filter hook limited to visible statuses
  const filterState = useAuditPlanFilters(visiblePlans);

  // Details modal state
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<AuditPlanDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' | 'warning'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Helpers: date and schedule validations
  const toDate = (s?: string | null) => (s ? new Date(s) : null);

  const scheduleErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const points: Array<{ key: keyof typeof formState; value: string; label: string } | null> = [
      formState.kickoffMeeting ? { key: 'kickoffMeeting' as any, value: formState.kickoffMeeting, label: 'Kickoff Meeting' } : null,
      formState.fieldworkStart ? { key: 'fieldworkStart' as any, value: formState.fieldworkStart, label: 'Fieldwork Start' } : null,
      formState.evidenceDue ? { key: 'evidenceDue' as any, value: formState.evidenceDue, label: 'Evidence Due' } : null,
      formState.draftReportDue ? { key: 'draftReportDue' as any, value: formState.draftReportDue, label: 'Draft Report Due' } : null,
      formState.capaDue ? { key: 'capaDue' as any, value: formState.capaDue, label: 'CAPA Due' } : null,
    ].filter(Boolean) as any[];

    // Get period dates for validation
    const periodFromDate = toDate(formState.periodFrom);
    const periodToDate = toDate(formState.periodTo);

    // Check if schedule dates are within period range
    if (periodFromDate && periodToDate) {
      points.forEach((p) => {
        if (!p) return;
        const scheduleDate = toDate(p.value);
        if (scheduleDate) {
          if (scheduleDate < periodFromDate) {
            errs[p.key] = `Date must be on or after Period From (${formState.periodFrom}).`;
          } else if (scheduleDate > periodToDate) {
            errs[p.key] = `Date must be on or before Period To (${formState.periodTo}).`;
          }
        }
      });
    }

    // Duplicate check among filled dates
    const seen = new Map<string, number[]>();
    points.forEach((p, idx) => {
      const k = (p as any).value as string;
      const list = seen.get(k) ?? [];
      list.push(idx);
      seen.set(k, list);
    });
    seen.forEach((idxs) => {
      if (idxs.length > 1) {
        idxs.forEach((i) => {
          const k = points[i]!.key as string;
          // Only add duplicate error if not already has period range error
          if (!errs[k]) {
          errs[k] = 'Dates must be unique (no duplicates).';
          }
        });
      }
    });

    // Strictly increasing order check (each later must be > previous)
    for (let i = 1; i < points.length; i++) {
      const prev = toDate(points[i - 1]!.value);
      const curr = toDate(points[i]!.value);
      if (prev && curr && curr.getTime() <= prev.getTime()) {
        const k = points[i]!.key as string;
        errs[k] = `${points[i]!.label} must be after ${points[i - 1]!.label}.`;
      }
    }

    return errs;
  }, [
    formState.kickoffMeeting,
    formState.fieldworkStart,
    formState.evidenceDue,
    formState.draftReportDue,
    formState.capaDue,
    formState.periodFrom,
    formState.periodTo,
  ]);

  // Validation functions for each step
  const validateStep1 = useMemo(() => {
    return (
      formState.title.trim() !== '' &&
      formState.auditType.trim() !== '' &&
      formState.goal.trim() !== '' &&
      formState.periodFrom !== '' &&
      formState.periodTo !== '' &&
      new Date(formState.periodFrom).getTime() <= new Date(formState.periodTo).getTime()
    );
  }, [formState.title, formState.auditType, formState.goal, formState.periodFrom, formState.periodTo]);

  const validateStep2 = useMemo(() => {
    if (formState.level === 'department') {
      return formState.selectedDeptIds.length > 0 && formState.selectedCriteriaIds.length > 0;
    }
    return formState.selectedCriteriaIds.length > 0;
  }, [formState.level, formState.selectedDeptIds, formState.selectedCriteriaIds]);

  const validateStep3 = useMemo(() => {
    return formState.selectedTemplateId !== null && formState.selectedTemplateId !== '';
  }, [formState.selectedTemplateId]);

  const validateStep4 = useMemo(() => {
    return (
      formState.selectedLeadId !== null &&
      formState.selectedLeadId !== '' &&
      formState.selectedAuditorIds.length >= 2
    );
  }, [formState.selectedLeadId, formState.selectedAuditorIds]);

  const validateStep5 = useMemo(() => {
    // Step 5 is optional, but if dates are filled, they must be valid
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    return scheduleErrorMessages.length === 0;
  }, [scheduleErrors]);

  const canContinue = useMemo(() => {
    switch (formState.currentStep) {
      case 1:
        return validateStep1;
      case 2:
        return validateStep2;
      case 3:
        return validateStep3;
      case 4:
        return validateStep4;
      case 5:
        return validateStep5;
      default:
        return false;
    }
  }, [formState.currentStep, validateStep1, validateStep2, validateStep3, validateStep4, validateStep5]);

  // Load departments when level changes to 'department'
  useEffect(() => {
    const loadDepts = async () => {
      if (departments.length > 0) return;
      try {
        const res: any = await getDepartments();
        const list = (res || []).map((d: any) => ({
          deptId: d.deptId ?? d.$id ?? d.id,
          name: d.name || d.code || '—',
        }));
        setDepartments(list);
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    if (formState.level === 'department' && departments.length === 0) {
      loadDepts();
    }
  }, [formState.level, departments.length]);

  // Ensure departments are loaded for filters and modals
  const ensureDepartmentsLoaded = async (): Promise<Array<{ deptId: number | string; name: string }>> => {
    if (departments && departments.length > 0) return departments;
    try {
      const res: any = await getDepartments();
      const list = (res || []).map((d: any) => ({
        deptId: d.deptId ?? d.$id ?? d.id,
        name: d.name || d.code || '—',
      }));
      setDepartments(list);
      return list;
    } catch (err) {
      console.error('ensureDepartmentsLoaded: failed to load departments', err);
      return departments;
    }
  };

  // Keep owner selection consistent with scope
  useEffect(() => {
    if (formState.level === 'academy' && formState.selectedOwnerId) {
      formState.setSelectedOwnerId('');
    }
  }, [formState.level]);

  useEffect(() => {
    if (!formState.selectedOwnerId) return;
    const owner = ownerOptions.find((o: any) => String(o.userId) === String(formState.selectedOwnerId));
    if (!owner) {
      formState.setSelectedOwnerId('');
      return;
    }
    if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
      const ownerDeptInSelection = formState.selectedDeptIds.includes(String(owner.deptId ?? ''));
      if (!ownerDeptInSelection) {
        formState.setSelectedOwnerId('');
      }
    }
  }, [formState.selectedDeptIds, ownerOptions, formState.level]);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getChecklistTemplates();
        setChecklistTemplates(Array.isArray(data) ? data : []);

        try {
          const crit = await getAuditCriteria();
          setCriteria(Array.isArray(crit) ? crit : []);
        } catch (e) {
          console.error('Failed to load audit criteria', e);
        }

        try {
          const users = await getAdminUsers();
          const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
          const auditors = (users || []).filter((u: any) => norm(u.roleName) === 'auditor');
          const owners = (users || []).filter((u: any) => norm(u.roleName) === 'auditeeowner');
          setAuditorOptions(auditors);
          setOwnerOptions(owners);
        } catch (e) {
          console.error('Failed to load users for team', e);
        }
      } catch (err) {
        console.error('Failed to load checklist templates', err);
      }
    };
    load();
  }, []);

  // Load departments for filter
  useEffect(() => {
    const loadDepartmentsForFilter = async () => {
      if (departments.length === 0) {
        await ensureDepartmentsLoaded();
      }
    };
    loadDepartmentsForFilter();
  }, []);

  // Load audit plans
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (error) {
        console.error('❌ Failed to load audit plans', error);
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
    try {
      const deptList = await ensureDepartmentsLoaded();

      try {
        const rawDetails = await getAuditPlanById(auditId);
        
        // Debug: Log raw API response structure
        console.log('📥 Raw API Response:', {
          hasAudit: !!rawDetails?.audit,
          auditTitle: rawDetails?.audit?.title,
          rawTitle: rawDetails?.title,
          auditId: rawDetails?.audit?.auditId || rawDetails?.auditId,
        });
        
        // Fetch schedules separately if not included in main response
        let schedulesData = rawDetails?.schedules;
        if (!schedulesData || (!schedulesData.values && !schedulesData.$values && !Array.isArray(schedulesData))) {
          try {
            const schedulesResponse = await getAuditSchedules(auditId);
            const { unwrap } = await import('../../../utils/normalize');
            const schedulesArray = unwrap(schedulesResponse);
            schedulesData = { values: schedulesArray };
          } catch (scheduleErr) {
            console.warn('⚠️ Failed to fetch schedules separately:', scheduleErr);
            schedulesData = { values: [] };
          }
        }

        // Merge schedules into rawDetails
        const detailsWithSchedules = {
          ...rawDetails,
          schedules: schedulesData,
        };

        const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
          departments: deptList,
          criteriaList: criteria,
          users: [...auditorOptions, ...ownerOptions],
        });
        
        // Debug: Log normalized details to check data
        console.log('📋 Normalized Plan Details:', {
          title: normalizedDetails.title,
          type: normalizedDetails.type,
          startDate: normalizedDetails.startDate,
          endDate: normalizedDetails.endDate,
          scope: normalizedDetails.scope,
          status: normalizedDetails.status,
          objective: normalizedDetails.objective,
          schedulesCount: normalizedDetails.schedules?.values?.length || 0,
        });
        
        setSelectedPlanDetails(normalizedDetails);
        setShowDetailsModal(true);
        return;
      } catch (apiError) {
        console.warn('⚠️ Full details API failed, using basic data from table:', apiError);

        const planFromTable = existingPlans.find(p => p.auditId === auditId || p.id === auditId);

        if (!planFromTable) {
          throw new Error('Plan not found in table. Backend API /AuditPlan/{id} is also returning 500 error.');
        }

        // Try to fetch schedules even if main API failed
        let schedulesData: { values: any[] } = { values: [] };
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const { unwrap } = await import('../../../utils/normalize');
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          console.warn('⚠️ Failed to fetch schedules separately:', scheduleErr);
        }

        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: schedulesData,
          createdByUser: {
            fullName: planFromTable.createdBy || 'Unknown',
            email: 'N/A',
            roleName: 'N/A'
          }
        };

        alert('⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team) is not available.\nSchedules have been fetched separately.\n\nPlease contact backend team to fix this endpoint.');

        setSelectedPlanDetails(basicDetails);
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error('❌ Failed to fetch plan details', error);
      alert('⚠️ Cannot load full plan details\n\n' +
        'The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n' +
        'Error: ' + (error as any)?.message);
    }
  };

  // Handler: Delete plan (only allowed for Draft status)
  const handleDeletePlan = async (auditId: string) => {
    // Find the plan to check its status
    const planToDelete = existingPlans.find(p => (p.auditId || p.id) === auditId);
    
    if (!planToDelete) {
      setToast({
        message: 'Plan not found.',
        type: 'error',
        isVisible: true,
      });
      return;
    }

    // Normalize status for comparison (remove spaces, convert to lowercase)
    const normalizedStatus = String(planToDelete.status || 'draft').toLowerCase().replace(/\s+/g, '');
    
    // Only allow delete if status is Draft
    if (normalizedStatus !== 'draft') {
      setToast({
        message: 'Chỉ có trạng thái Draft mới được delete.',
        type: 'warning',
        isVisible: true,
      });
      return;
    }

    if (!window.confirm('Delete this audit plan permanently?')) return;
    try {
      await deleteAuditPlan(auditId);

      setExistingPlans(prevPlans =>
        prevPlans.filter(p => (p.auditId || p.id) !== auditId)
      );

      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (err) {
        console.error('Failed to refresh plans after delete', err);
      }
    } catch (error: any) {
      console.error('❌ Failed to delete plan', error);
      alert('Delete failed: ' + (error?.response?.data?.message || error?.message || 'Unknown error'));
    }
  };

  // Handler: Edit plan
  const handleEditPlan = async (auditId: string) => {
    try {
      let details: any;

      try {
        const rawDetails = await getAuditPlanById(auditId);

        details = {
          ...rawDetails,
          scopeDepartments: {
            ...rawDetails.scopeDepartments,
            values: unwrap(rawDetails.scopeDepartments)
          },
          criteria: {
            ...rawDetails.criteria,
            values: unwrap(rawDetails.criteria)
          },
          auditTeams: {
            ...rawDetails.auditTeams,
            values: unwrap(rawDetails.auditTeams)
          },
          schedules: {
            ...rawDetails.schedules,
            values: unwrap(rawDetails.schedules)
          }
        };
      } catch (apiError) {
        // If detailed endpoint fails, fall back to using table data so the user can still edit basic fields
        console.warn('⚠️ Full details API failed, falling back to table data for edit:', apiError);

        const planFromTable = existingPlans.find(p => p.auditId === auditId || p.id === auditId);
        const planFromTableAny = planFromTable as any;

        if (!planFromTable) {
          console.error('❌ Plan not found in table and detailed API failed:', apiError);
          alert('⚠️ Cannot Edit\n\nBackend API /AuditPlan/{id} is returning 500 error and the plan was not found in the list.');
          throw new Error('Backend API /AuditPlan/{id} failed and plan not found in table.');
        }

        // Build a basic editable shape from table row
        details = {
          ...planFromTableAny,
          scopeDepartments: { values: unwrap(planFromTableAny.scopeDepartments) },
          criteria: { values: unwrap(planFromTableAny.criteria) },
          auditTeams: { values: unwrap(planFromTableAny.auditTeams) },
          schedules: { values: unwrap(planFromTableAny.schedules) },
        };
      }

      // Use formState.loadPlanForEdit with the best-effort details
      formState.loadPlanForEdit(details);

      console.log('✅ Plan loaded for editing successfully');
    } catch (error) {
      console.error('❌ Failed to load plan for editing', error);
      alert('⚠️ Cannot load plan for editing\n\nError: ' + (error as any)?.message);
    }
  };

  // Handler: Submit plan to Lead Auditor (status change Draft -> Pending)
  const handleSubmitToLead = async (auditId: string) => {
    try {
      await submitToLeadAuditor(auditId);

      // Refresh plans list to reflect new status
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error('Failed to refresh plans after submit', refreshErr);
      }

      alert('✅ Submitted to Lead Auditor successfully.');
    } catch (err: any) {
      console.error('❌ Failed to submit to Lead Auditor', err);
      alert('Failed to submit to Lead Auditor: ' + (err?.response?.data?.message || err?.message || String(err)));
    }
  };

  // Helper: Check if form has any data entered
  const hasFormData = useMemo(() => {
    return (
      formState.title.trim() !== '' ||
      formState.goal.trim() !== '' ||
      formState.periodFrom !== '' ||
      formState.periodTo !== '' ||
      formState.auditType !== 'Internal' ||
      formState.level !== 'academy' ||
      formState.selectedDeptIds.length > 0 ||
      formState.selectedCriteriaIds.length > 0 ||
      formState.selectedTemplateId !== null ||
      formState.selectedLeadId !== '' ||
      formState.selectedAuditorIds.length > 0 ||
      formState.kickoffMeeting !== '' ||
      formState.fieldworkStart !== '' ||
      formState.evidenceDue !== '' ||
      formState.draftReportDue !== '' ||
      formState.capaDue !== ''
    );
  }, [
    formState.title,
    formState.goal,
    formState.periodFrom,
    formState.periodTo,
    formState.auditType,
    formState.level,
    formState.selectedDeptIds,
    formState.selectedCriteriaIds,
    formState.selectedTemplateId,
    formState.selectedLeadId,
    formState.selectedAuditorIds,
    formState.kickoffMeeting,
    formState.fieldworkStart,
    formState.evidenceDue,
    formState.draftReportDue,
    formState.capaDue,
  ]);

  // Handler: Submit plan
  const handleSubmitPlan = async () => {
    // Client-side validation
    if (!formState.title.trim()) {
      setToast({
        message: 'Vui lòng nhập tiêu đề (Title) cho kế hoạch.',
        type: 'warning',
        isVisible: true,
      });
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.periodFrom || !formState.periodTo) {
      setToast({
        message: 'Vui lòng chọn ngày bắt đầu và kết thúc.',
        type: 'warning',
        isVisible: true,
      });
      formState.setCurrentStep(1);
      return;
    }
    // period_from ≤ period_to
    if (new Date(formState.periodFrom).getTime() > new Date(formState.periodTo).getTime()) {
      setToast({
        message: 'Khoảng thời gian không hợp lệ: Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
        type: 'warning',
        isVisible: true,
      });
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.selectedTemplateId) {
      setToast({
        message: 'Vui lòng chọn Checklist Template (Step 3).',
        type: 'warning',
        isVisible: true,
      });
      formState.setCurrentStep(3);
      return;
    }
    if (formState.level === 'department') {
      if (formState.selectedDeptIds.length === 0) {
        setToast({
          message: 'Vui lòng chọn ít nhất 1 phòng ban cho phạm vi Department (Step 2).',
          type: 'warning',
          isVisible: true,
        });
        formState.setCurrentStep(2);
        return;
      }
      const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
      if (ownersForDepts.length === 0) {
        if (!window.confirm('⚠️ Các phòng ban đã chọn chưa có Auditee Owner.\n\nBạn có muốn tiếp tục tạo audit plan không?')) {
          formState.setCurrentStep(4);
          return;
        }
      }
    }

    // Schedule constraints: unique dates and strictly increasing order
    const scheduleErrorMessages = Object.values(scheduleErrors).filter(Boolean);
    if (scheduleErrorMessages.length > 0) {
      setToast({
        message: 'Lịch không hợp lệ:\n\n' + scheduleErrorMessages.join('\n'),
        type: 'error',
        isVisible: true,
      });
      formState.setCurrentStep(5);
      return;
    }

    const payload: any = {
      title: formState.title || 'Untitled Plan',
      type: formState.auditType || 'Internal',
      scope: formState.level === 'academy' ? 'Academy' : 'Department',
      templateId: formState.selectedTemplateId || undefined,
      startDate: formState.periodFrom ? new Date(formState.periodFrom).toISOString() : undefined,
      endDate: formState.periodTo ? new Date(formState.periodTo).toISOString() : undefined,
      status: 'Draft',
      isPublished: false,
      objective: formState.goal || '',
    };

    try {
      let auditId: string;

      if (formState.isEditMode && formState.editingAuditId) {
        await updateAuditPlan(formState.editingAuditId, payload);
        auditId = formState.editingAuditId;
      } else {
        const resp = await createAudit(payload);
        auditId = resp?.auditId || resp?.id || resp;

        if (!auditId) {
          throw new Error('No auditId returned from createAudit API');
        }
      }

      const newAuditId = auditId;

      // Attach departments
      try {
        let deptIdsToAttach: string[] = [];
        
        if (formState.level === 'academy') {
          // When level is "Entire Aviation Academy", attach all departments
          deptIdsToAttach = departments.map((d) => String(d.deptId));
        } else if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
          // When level is "Department", attach only selected departments
          deptIdsToAttach = formState.selectedDeptIds;
        }
        
        if (deptIdsToAttach.length > 0) {
          const deptResults = await Promise.allSettled(
            deptIdsToAttach.map((deptId) => addAuditScopeDepartment(String(newAuditId), Number(deptId)))
          );
          const failedDepts = deptResults.filter((r) => r.status === 'rejected');
          if (failedDepts.length > 0) {
            console.warn('⚠️ Some departments failed to attach:', failedDepts);
          }
          }
        } catch (scopeErr) {
          console.error('❌ Attach departments to audit failed', scopeErr);
      }

      // Attach criteria
      if (Array.isArray(formState.selectedCriteriaIds) && formState.selectedCriteriaIds.length > 0) {
        try {
          await Promise.allSettled(
            formState.selectedCriteriaIds.map((cid) => addCriterionToAudit(String(newAuditId), String(cid)))
          );
        } catch (critErr) {
          console.error('❌ Attach criteria to audit failed', critErr);
        }
      }

      // Add team members
      try {
        const calls: Promise<any>[] = [];
        const auditorSet = new Set<string>(formState.selectedAuditorIds);
        if (formState.selectedLeadId) auditorSet.add(formState.selectedLeadId);

        auditorSet.forEach((uid) => {
          const isLead = uid === formState.selectedLeadId;
          calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'Auditor', isLead }));
        });

        if (formState.level === 'academy') {
          const uniqueOwnerIds = Array.from(new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)));
          uniqueOwnerIds.forEach((uid) => {
            calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'AuditeeOwner', isLead: false }));
          });
        } else {
          const ownersForDepts = ownerOptions.filter((o: any) => formState.selectedDeptIds.includes(String(o.deptId ?? '')));
          ownersForDepts.forEach((owner: any) => {
            if (owner.userId) {
              calls.push(addTeamMember({ auditId: String(newAuditId), userId: String(owner.userId), roleInTeam: 'AuditeeOwner', isLead: false }));
            }
          });
        }

        if (calls.length) {
          await Promise.allSettled(calls);
        }
      } catch (teamErr) {
        console.error('❌ Attach team failed', teamErr);
      }

      // Post schedules
      try {
        const schedulePairs = [
          { name: MILESTONE_NAMES.KICKOFF, date: formState.kickoffMeeting },
          { name: MILESTONE_NAMES.FIELDWORK, date: formState.fieldworkStart },
          { name: MILESTONE_NAMES.EVIDENCE, date: formState.evidenceDue },
          { name: MILESTONE_NAMES.DRAFT, date: formState.draftReportDue },
          { name: MILESTONE_NAMES.CAPA, date: formState.capaDue },
        ].filter(pair => pair.date);

        if (schedulePairs.length > 0) {
          const schedulePromises = schedulePairs.map(pair =>
            addAuditSchedule({
              auditId: String(newAuditId),
              milestoneName: pair.name,
              dueDate: new Date(pair.date).toISOString(),
              status: SCHEDULE_STATUS.PLANNED,
              notes: '',
            })
          );
          await Promise.allSettled(schedulePromises);
        }
      } catch (scheduleErr) {
        console.error('❌ Failed to post schedules', scheduleErr);
      }

      // Refresh plans list
      try {
        const merged = await getPlansWithDepartments();
        setExistingPlans(merged);
      } catch (refreshErr) {
        console.error('❌ Failed to refresh plans list', refreshErr);
      }

      // Reset form (closes form after successful creation)
      formState.resetForm();

      const successMsg = formState.isEditMode
        ? `Audit plan updated successfully!${formState.title ? ` Plan: ${formState.title}` : ''}`
        : `Audit plan created successfully!${formState.title ? ` Plan: ${formState.title}` : ''}`;
      setToast({
        message: successMsg,
        type: 'success',
        isVisible: true,
      });
    } catch (err: any) {
      const serverMsg = err?.response?.data || err?.response || err?.message || err;
      console.error('Create audit failed', err, serverMsg);
      let errorMessage = 'Failed to create audit plan.';
      try {
        if (typeof serverMsg === 'object') {
          errorMessage = serverMsg?.message || JSON.stringify(serverMsg, null, 2);
        } else {
          errorMessage = String(serverMsg) || err?.message || String(err);
        }
      } catch (e) {
        errorMessage = err?.message || String(err);
      }
      setToast({
        message: errorMessage,
        type: 'error',
        isVisible: true,
      });
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Audit Planning</h1>
            <p className="text-gray-600 text-sm mt-1">Create and manage audit plans</p>
          </div>
          <button
            onClick={() => {
              // If form is currently open and in edit mode, reset it first
              if (formState.showForm && formState.isEditMode) {
                formState.resetFormForCreate();
              } else if (!formState.showForm) {
                // If form is closed, reset and open it
                formState.resetFormForCreate();
                formState.setShowForm(true);
              } else {
                // If form is open and not in edit mode, just close it
                formState.setShowForm(false);
              }
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create New Plan
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {formState.showForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary-600">
                {formState.isEditMode ? 'Edit Audit Plan' : 'New Audit Plan'}
              </h2>
              {formState.isEditMode && (
                <span className="px-3 py-1 bg-sky-100 text-sky-800 text-sm font-medium rounded-md">
                  Editing Mode
                </span>
              )}
            </div>

            {/* Progress Stepper */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${formState.currentStep === step
                          ? 'bg-primary-600 text-white'
                          : formState.currentStep > step
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                        {formState.currentStep > step ? '✓' : step}
                      </div>
                      <span className={`text-xs mt-1 ${formState.currentStep === step ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}>
                        {step === 1 && 'Plan'}
                        {step === 2 && 'Scope'}
                        {step === 3 && 'Checklist'}
                        {step === 4 && 'Team'}
                        {step === 5 && 'Schedule'}
                      </span>
                    </div>
                    {step < 5 && (
                      <div className={`h-1 flex-1 mx-2 ${formState.currentStep > step ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Components */}
            <div className="space-y-4">
              {formState.currentStep === 1 && (
                <Step1BasicInfo
                  title={formState.title}
                  auditType={formState.auditType}
                  goal={formState.goal}
                  periodFrom={formState.periodFrom}
                  periodTo={formState.periodTo}
                  onTitleChange={formState.setTitle}
                  onAuditTypeChange={formState.setAuditType}
                  onGoalChange={formState.setGoal}
                  onPeriodFromChange={formState.setPeriodFrom}
                  onPeriodToChange={formState.setPeriodTo}
                />
              )}

              {formState.currentStep === 2 && (
                <Step2Scope
                  level={formState.level}
                  selectedDeptIds={formState.selectedDeptIds}
                  departments={departments}
                  criteria={criteria}
                  selectedCriteriaIds={formState.selectedCriteriaIds}
                  onLevelChange={formState.setLevel}
                  onSelectedDeptIdsChange={formState.setSelectedDeptIds}
                  onCriteriaToggle={(id: string) => {
                    const val = String(id);
                    formState.setSelectedCriteriaIds((prev) =>
                      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
                    );
                  }}
                />
              )}

              {formState.currentStep === 3 && (
                <Step3Checklist
                  checklistTemplates={checklistTemplates}
                  selectedTemplateId={formState.selectedTemplateId}
                  onTemplateSelect={(id: string) => formState.setSelectedTemplateId(id)}
                />
              )}

              {formState.currentStep === 4 && (
                <Step4Team
                  level={formState.level}
                  selectedDeptIds={formState.selectedDeptIds}
                  selectedLeadId={formState.selectedLeadId}
                  selectedAuditorIds={formState.selectedAuditorIds}
                  auditorOptions={auditorOptions}
                  ownerOptions={ownerOptions}
                  departments={departments}
                  onLeadChange={(leadId: string) => {
                    formState.setSelectedLeadId(leadId);
                    if (leadId && formState.selectedAuditorIds.includes(leadId)) {
                      formState.setSelectedAuditorIds(formState.selectedAuditorIds.filter(id => id !== leadId));
                    }
                  }}
                  onAuditorsChange={formState.setSelectedAuditorIds}
                />
              )}

              {formState.currentStep === 5 && (
                <Step5Schedule
                  kickoffMeeting={formState.kickoffMeeting}
                  fieldworkStart={formState.fieldworkStart}
                  evidenceDue={formState.evidenceDue}
                  draftReportDue={formState.draftReportDue}
                  capaDue={formState.capaDue}
                  onKickoffChange={formState.setKickoffMeeting}
                  onFieldworkChange={formState.setFieldworkStart}
                  onEvidenceChange={formState.setEvidenceDue}
                  onDraftReportChange={formState.setDraftReportDue}
                  onCapaChange={formState.setCapaDue}
                  errors={scheduleErrors}
                  periodFrom={formState.periodFrom}
                  periodTo={formState.periodTo}
                />
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-3 pt-6 border-t">
                <button
                  onClick={() => {
                    if (formState.currentStep > 1) {
                      formState.setCurrentStep(formState.currentStep - 1);
                    } else {
                      // Step 1 - Cancel button
                      if (hasFormData || formState.isEditMode) {
                        if (window.confirm('Are you sure you want to cancel?')) {
                          formState.resetForm();
                        }
                    } else {
                      formState.setShowForm(false);
                      formState.setCurrentStep(1);
                      }
                    }
                  }}
                  className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  {formState.currentStep === 1 ? 'Cancel' : '← Back'}
                </button>

                <div className="flex gap-3">
                  {formState.currentStep < 5 && (
                    <button
                      onClick={() => {
                        if (canContinue) {
                          formState.setCurrentStep(formState.currentStep + 1);
                        } else {
                          // Show validation message based on current step
                          let message = '';
                          switch (formState.currentStep) {
                            case 1:
                              message = 'Vui lòng điền đầy đủ thông tin: Title, Type, Period From, và Period To.';
                              break;
                            case 2:
                              message = formState.level === 'department'
                                ? 'Vui lòng chọn ít nhất 1 phòng ban và 1 tiêu chí kiểm toán.'
                                : 'Vui lòng chọn ít nhất 1 tiêu chí kiểm toán.';
                              break;
                            case 3:
                              message = 'Vui lòng chọn một Checklist Template.';
                              break;
                            case 4:
                              message = 'Vui lòng chọn Lead Auditor.';
                              break;
                            default:
                              message = 'Vui lòng điền đầy đủ thông tin trước khi tiếp tục.';
                          }
                          setToast({
                            message,
                            type: 'warning',
                            isVisible: true,
                          });
                        }
                      }}
                      disabled={!canContinue}
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md ${
                        canContinue
                          ? 'bg-primary-600 hover:bg-primary-700 text-white cursor-pointer'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Continue →
                    </button>
                  )}
                  {formState.currentStep === 5 && (
                    <>
                      <button
                        onClick={handleSubmitPlan}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                      >
                        {formState.isEditMode ? ' Update Plan' : ' Submit Plan'}
                      </button>
                      {formState.isEditMode && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel?')) {
                              formState.resetForm();
                            }
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans Table with Filters */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Existing Audit Plans</h2>
          </div>

          <FilterBar
            filterDepartment={filterState.filterDepartment}
            sortDateOrder={filterState.sortDateOrder}
            filterStatus={filterState.filterStatus}
            departments={departments}
            onFilterDepartmentChange={filterState.setFilterDepartment}
            onSortDateOrderChange={filterState.setSortDateOrder}
            onFilterStatusChange={filterState.setFilterStatus}
            onClearFilters={filterState.clearFilters}
            filteredCount={filterState.filteredPlans.length}
            totalCount={visiblePlans.length}
          />

          <PlanTable
            filteredPlans={filterState.filteredPlans.slice(
              (activePlansTab - 1) * pageSize,
              activePlansTab * pageSize
            )}
            existingPlans={visiblePlans}
            loadingPlans={loadingPlans}
            onViewDetails={handleViewDetails}
            onEditPlan={handleEditPlan}
            onDeletePlan={handleDeletePlan}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            startIndex={(activePlansTab - 1) * pageSize}
          />

          {/* Tabs / pagination placed at bottom, centered like the design */}
          {(() => {
            const totalPlans = filterState.filteredPlans.length;
            const totalPages = Math.ceil(totalPlans / pageSize);
            
            if (totalPages <= 1) return null;
            
            return (
              <div className="px-6 py-4 border-t bg-white flex items-center justify-center gap-3">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setActivePlansTab(pageNum)}
                    className={`px-4 py-2 rounded font-medium transition ${
                      activePlansTab === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedPlanDetails && (
          <PlanDetailsModal
            showModal={showDetailsModal}
            selectedPlanDetails={selectedPlanDetails}
            onClose={() => setShowDetailsModal(false)}
            onEdit={handleEditPlan}
            onSubmitToLead={handleSubmitToLead}
            getCriterionName={(id: string) => getCriterionName(id, criteria)}
            getDepartmentName={(id: string | number) => getDepartmentName(id, departments)}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            getTemplateName={(tid) => {
              const t = checklistTemplates.find((tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(tid));
              return t?.title || t?.name || `Template ${String(tid ?? '')}`;
            }}
          />
        )}

        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      </div>
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
