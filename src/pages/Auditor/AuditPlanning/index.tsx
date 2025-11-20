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
import { addAuditSchedule } from '../../../api/auditSchedule';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../constants/audit';
import { getAuditPlans, getAuditPlanById, updateAuditPlan, deleteAuditPlan, submitToLeadAuditor } from '../../../api/audits';
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
          errs[k] = 'Dates must be unique (no duplicates).';
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
  ]);

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
        const normalizedDetails = normalizePlanDetails(rawDetails, {
          departments: deptList,
          criteriaList: criteria,
          users: [...auditorOptions, ...ownerOptions],
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

        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: { values: [] },
          createdByUser: {
            fullName: planFromTable.createdBy || 'Unknown',
            email: 'N/A',
            roleName: 'N/A'
          }
        };

        alert('⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team, schedules) is not available.\n\nPlease contact backend team to fix this endpoint.');

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

  // Handler: Delete plan
  const handleDeletePlan = async (auditId: string) => {
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

  // Handler: Submit plan
  const handleSubmitPlan = async () => {
    // Client-side validation
    if (!formState.title.trim()) {
      alert('Vui lòng nhập tiêu đề (Title) cho kế hoạch.');
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.periodFrom || !formState.periodTo) {
      alert('Vui lòng chọn ngày bắt đầu và kết thúc.');
      formState.setCurrentStep(1);
      return;
    }
    // period_from ≤ period_to
    if (new Date(formState.periodFrom).getTime() > new Date(formState.periodTo).getTime()) {
      alert('Khoảng thời gian không hợp lệ: Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.');
      formState.setCurrentStep(1);
      return;
    }
    if (!formState.selectedTemplateId) {
      alert('Vui lòng chọn Checklist Template (Step 3).');
      formState.setCurrentStep(3);
      return;
    }
    if (formState.level === 'department') {
      if (formState.selectedDeptIds.length === 0) {
        alert('Vui lòng chọn ít nhất 1 phòng ban cho phạm vi Department (Step 2).');
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
      alert('Lịch không hợp lệ:\n\n' + scheduleErrorMessages.join('\n'));
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
      if (formState.level === 'department' && formState.selectedDeptIds.length > 0) {
        try {
          const deptResults = await Promise.allSettled(
            formState.selectedDeptIds.map((deptId) => addAuditScopeDepartment(String(newAuditId), Number(deptId)))
          );
          const failedDepts = deptResults.filter((r) => r.status === 'rejected');
          if (failedDepts.length > 0) {
            console.warn('⚠️ Some departments failed to attach:', failedDepts);
          }
        } catch (scopeErr) {
          console.error('❌ Attach departments to audit failed', scopeErr);
        }
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
        const response = await getAuditPlans();
        const planArray = unwrap(response);
        setExistingPlans(planArray);
      } catch (refreshErr) {
        console.error('❌ Failed to refresh plans list', refreshErr);
      }

      // Reset form
      formState.resetForm();

      const successMsg = formState.isEditMode
        ? '✅ Audit plan updated successfully!\n\n' + (formState.title ? `Plan: ${formState.title}` : '')
        : '✅ Audit plan created successfully!\n\n' + (formState.title ? `Plan: ${formState.title}` : '');
      alert(successMsg);
    } catch (err: any) {
      const serverMsg = err?.response?.data || err?.response || err?.message || err;
      console.error('Create audit failed', err, serverMsg);
      try {
        const pretty = typeof serverMsg === 'object' ? JSON.stringify(serverMsg, null, 2) : String(serverMsg);
        alert('Failed to create audit plan. Server response:\n' + pretty);
      } catch (e) {
        alert('Failed to create audit plan: ' + (err?.message || err));
      }
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
            onClick={() => formState.setShowForm(!formState.showForm)}
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
                {formState.isEditMode ? '✏️ Edit Audit Plan' : 'New Audit Plan'}
              </h2>
              {formState.isEditMode && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
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
                />
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-3 pt-6 border-t">
                <button
                  onClick={() => {
                    if (formState.currentStep > 1) {
                      formState.setCurrentStep(formState.currentStep - 1);
                    } else {
                      formState.setShowForm(false);
                      formState.setCurrentStep(1);
                    }
                  }}
                  className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  {formState.currentStep === 1 ? 'Cancel' : '← Back'}
                </button>

                <div className="flex gap-3">
                  {formState.currentStep < 5 && (
                    <button
                      onClick={() => formState.setCurrentStep(formState.currentStep + 1)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
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
                            if (window.confirm('Discard changes and exit edit mode?')) {
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
            filterDateFrom={filterState.filterDateFrom}
            filterDateTo={filterState.filterDateTo}
            filterStatus={filterState.filterStatus}
            departments={departments}
            onFilterDepartmentChange={filterState.setFilterDepartment}
            onFilterDateFromChange={filterState.setFilterDateFrom}
            onFilterDateToChange={filterState.setFilterDateTo}
            onFilterStatusChange={filterState.setFilterStatus}
            onClearFilters={filterState.clearFilters}
            filteredCount={filterState.filteredPlans.length}
            totalCount={visiblePlans.length}
          />

          <PlanTable
            filteredPlans={activePlansTab === 1 ? filterState.filteredPlans.slice(0, pageSize) : filterState.filteredPlans.slice(pageSize)}
            existingPlans={visiblePlans}
            loadingPlans={loadingPlans}
            onViewDetails={handleViewDetails}
            onEditPlan={handleEditPlan}
            onDeletePlan={handleDeletePlan}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            startIndex={activePlansTab === 1 ? 0 : pageSize}
          />

          {/* Tabs / pagination placed at bottom, centered like the design */}
          {filterState.filteredPlans.length > pageSize && (
            <div className="px-6 py-4 border-t bg-white flex items-center justify-center gap-3">
              <button
                onClick={() => setActivePlansTab(1)}
                className={`px-4 py-2 rounded font-medium transition ${activePlansTab === 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                1
              </button>

              

              <button
                onClick={() => setActivePlansTab(2)}
                className={`px-4 py-2 rounded font-medium transition ${activePlansTab === 2 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                2
              </button>
            </div>
          )}
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
            getTemplateName={(tid) => {
              const t = checklistTemplates.find((tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(tid));
              return t?.title || t?.name || `Template ${String(tid ?? '')}`;
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
