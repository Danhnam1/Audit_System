import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { getChecklistTemplates } from '../../../api/checklists';
import { createAudit, addAuditScopeDepartment } from '../../../api/audits';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { addCriterionToAudit } from '../../../api/auditCriteriaMap';
import { getAdminUsers } from '../../../api/adminUsers';
import { addTeamMember } from '../../../api/auditTeam';
import { getDepartments } from '../../../api/departments';
import { addAuditSchedule } from '../../../api/auditSchedule';
import { MILESTONE_NAMES, SCHEDULE_STATUS } from '../../../constants/audit';
import { getAuditPlans, getAuditPlanById, updateAuditPlan, deleteAuditPlan, getAuditScopeDepartments } from '../../../api/audits';
import MultiSelect from '../../../components/MultiSelect';

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  interface AuditPlan {
    id: string;
    title: string;
    goal: string;
    periodFrom: string;
    periodTo: string;
    organizationLevel: string;
    domain: string;
    deliveryMode: string[];
    standards: string[];
    checklist: string;
    version: string;
    auditLead: string;
    auditors: string[];
    departmentOwners: string[];
    kickoffMeeting: string;
    fieldworkStart: string;
    evidenceDue: string;
    draftReportDue: string;
    capaDue: string;
    status: string;
    createdDate: string;
    createdBy: string;
    
  }

  const [selectedPlan, setSelectedPlan] = useState<AuditPlan | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [level, setLevel] = useState<string>('academy');
  // legacy faculty field removed in new Level design
  // Departments for Department level scope
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]); // Changed to array for multi-select

  useEffect(() => {
    // Lazy-load departments when the user selects Department level
    const loadDepts = async () => {
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
    if (level === 'department' && departments.length === 0) {
      loadDepts();
    }
  }, [level]);

  // Ensure departments are available even if level is not 'department'
  // Useful for enriching names in View Details modal
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
  // Standards (Audit Criteria) fetched from API
  const [criteria, setCriteria] = useState<any[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>([]);
  // Team selections
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]); // all selectable auditors
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);     // all auditee owners (from AdminUsers)
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  // keep owner selection consistent with scope
  useEffect(() => {
    // When switching to Academy, clear any selected owner (owners will be auto-assigned)
    if (level === 'academy' && selectedOwnerId) {
      setSelectedOwnerId('');
    }
  }, [level]);
  useEffect(() => {
    // If department changes and current owner no longer belongs to that dept, clear it
    if (!selectedOwnerId) return;
    const owner = ownerOptions.find((o: any) => String(o.userId) === String(selectedOwnerId));
    if (!owner) {
      setSelectedOwnerId('');
      return;
    }
    // Check if owner's department is in selected departments list
    if (level === 'department' && selectedDeptIds.length > 0) {
      const ownerDeptInSelection = selectedDeptIds.includes(String(owner.deptId ?? ''));
      if (!ownerDeptInSelection) {
        setSelectedOwnerId('');
      }
    }
  }, [selectedDeptIds, ownerOptions, level]);

  // legacy course scope chips removed with simplified scope design

  // Checklist templates fetched from API
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Minimal plan form state to send new audit to API
  const [title, setTitle] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');
  // Audit Type (Internal/External/FollowUp...)
  const [auditType, setAuditType] = useState<string>('Internal');
  // Schedule milestones (Step 5)
  const [kickoffMeeting, setKickoffMeeting] = useState<string>('');
  const [fieldworkStart, setFieldworkStart] = useState<string>('');
  const [evidenceDue, setEvidenceDue] = useState<string>('');
  const [draftReportDue, setDraftReportDue] = useState<string>('');
  const [capaDue, setCapaDue] = useState<string>('');

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getChecklistTemplates();
        setChecklistTemplates(Array.isArray(data) ? data : []);
        // Load standards (audit criteria)
        try {
          const crit = await getAuditCriteria();
          setCriteria(Array.isArray(crit) ? crit : []);
        } catch (e) {
          console.error('Failed to load audit criteria', e);
        }
        // Load users for team selects
        try {
          const users = await getAdminUsers();
          const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '')
          const auditors = (users || []).filter((u: any) => norm(u.roleName) === 'auditor')
          const owners = (users || []).filter((u: any) => norm(u.roleName) === 'auditeeowner')
          setAuditorOptions(auditors)
          setOwnerOptions(owners)
        } catch (e) {
          console.error('Failed to load users for team', e);
        }
      } catch (err) {
        console.error('Failed to load checklist templates', err);
      }
    };
    load();
  }, []);

  // menuItems are now provided centrally by MainLayout (role-based). Remove per-page menu definitions.

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // State for existing plans loaded from backend
  const [existingPlans, setExistingPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // State for view details modal
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filter state
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Load departments for filter dropdown on component mount
  useEffect(() => {
    const loadDepartmentsForFilter = async () => {
      if (departments.length === 0) {
        await ensureDepartmentsLoaded();
      }
    };
    loadDepartmentsForFilter();
  }, []);

  // Load audit plans from backend
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        // Load both plans and scope departments
        const [plansResponse, scopeDepsResponse] = await Promise.all([
          getAuditPlans(),
          getAuditScopeDepartments()
        ]);
        
        console.log('📋 GET /Audits raw response:', plansResponse);
        console.log('📋 GET /AuditScopeDepartment raw response:', scopeDepsResponse);
        
        // Handle different response formats from backend
        let plans = plansResponse;
        if (plansResponse?.$values) {
          plans = plansResponse.$values; // .NET serialization format
        } else if (plansResponse?.values) {
          plans = plansResponse.values;
        }
        
        let planArray = Array.isArray(plans) ? plans : [];
        
        // Parse scope departments
        let scopeDeps = scopeDepsResponse;
        if (scopeDepsResponse?.$values) {
          scopeDeps = scopeDepsResponse.$values;
        } else if (scopeDepsResponse?.values) {
          scopeDeps = scopeDepsResponse.values;
        }
        const scopeDepArray = Array.isArray(scopeDeps) ? scopeDeps : [];
        
        // Merge scopeDepartments into plans
        planArray = planArray.map((plan: any) => {
          const planScopeDeps = scopeDepArray.filter((sd: any) => 
            String(sd.auditId) === String(plan.auditId || plan.id)
          );
          return {
            ...plan,
            scopeDepartments: planScopeDeps
          };
        });
        
        console.log(`✅ Loaded ${planArray.length} audit plans with departments:`, planArray);
        if (planArray.length > 0) {
          console.log('📌 First plan with merged scopeDepartments:', planArray[0]);
        }
        setExistingPlans(planArray);
      } catch (error) {
        console.error('❌ Failed to load audit plans', error);
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Filter audit plans based on filter criteria
  const filteredPlans = useMemo(() => {
    return existingPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        // Check if any of the plan's departments match the selected filter
        const deptArray = plan.scopeDepartments || [];
        
        // If plan has no departments assigned, don't show it when filtering
        if (!deptArray || deptArray.length === 0) {
          return false; // Hide plans without departments when filtering by department
        }
        
        const hasDept = deptArray.some((dept: any) => {
          // Check multiple possible field names for department ID
          const deptId = String(dept.deptId || dept.departmentId || dept.id || dept.DeptId || dept.DepartmentId || '');
          const filterId = String(filterDepartment);
          return deptId === filterId;
        });
        
        if (!hasDept) return false;
      }

      // Date range filter - check if plan period overlaps with filter range
      if (filterDateFrom) {
        const planEnd = plan.endDate ? new Date(plan.endDate) : null;
        const filterFrom = new Date(filterDateFrom);
        if (planEnd && planEnd < filterFrom) return false; // Plan ends before filter start
      }

      if (filterDateTo) {
        const planStart = plan.startDate ? new Date(plan.startDate) : null;
        const filterTo = new Date(filterDateTo);
        if (planStart && planStart > filterTo) return false; // Plan starts after filter end
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || 'Draft';
        if (planStatus !== filterStatus) return false;
      }

      return true;
    });
  }, [existingPlans, filterDepartment, filterDateFrom, filterDateTo, filterStatus]);

  // Helper: Get criterion name by ID
  const getCriterionName = (criterionId: string | number) => {
    // API uses 'criteriaId' (with 'a'), not 'criterionId'
    const criterion = criteria.find((c: any) => 
      String(c.criteriaId || c.criterionId) === String(criterionId)
    );
    return criterion?.name ;
  };

  // Helper: Get user name by ID
  const getUserName = (userId: string | number) => {
    const allUsers = [...auditorOptions, ...ownerOptions];
    const user = allUsers.find((u: any) => String(u.userId) === String(userId));
    return user?.fullName || user?.email || `User ID: ${userId}`;
  };

  // Helper: Get department name by ID
  const getDepartmentName = (deptId: string | number) => {
    const dept = departments.find((d: any) => String(d.deptId) === String(deptId));
    return dept?.name || (dept as any)?.deptName || `Department ID: ${deptId}`;
  };

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
    try {
      console.log('👁️ Fetching details for audit:', auditId);
      // Make sure we have departments available to resolve names
      const deptList = await ensureDepartmentsLoaded();
      const deptNameMap = new Map<string, string>(
        (deptList || []).map((d: any) => [String(d.deptId), d.name || d.code || '—'])
      );

      // Try to fetch full details from API
      try {
        const rawDetails = await getAuditPlanById(auditId);
        console.log('✅ Got full details from API:', rawDetails);
        console.log('🔍 Raw criteria data:', rawDetails.criteria);
        console.log('🔍 Raw criteria $values:', rawDetails.criteria?.$values);
        console.log('🔍 Raw criteria values:', rawDetails.criteria?.values);
        
        // Normalize $values to values and enrich with names
        const normalizedDetails = {
          ...rawDetails,
          scopeDepartments: {
            ...rawDetails.scopeDepartments,
            values: Array.from(
              new Map(
                (rawDetails.scopeDepartments?.$values || rawDetails.scopeDepartments?.values || [])
                  .map((dept: any) => ({
                    ...dept,
                    deptName: dept.deptName || deptNameMap.get(String(dept.deptId)) || getDepartmentName(dept.deptId)
                  }))
                  .map((dept: any) => [dept.deptId, dept])
              ).values()
            )
          },
          criteria: {
            ...rawDetails.criteria,
            values: Array.from(
              new Map(
                (rawDetails.criteria?.$values || rawDetails.criteria?.values || [])
                  .map((crit: any) => ({
                    ...crit,
                    // API uses 'criteriaId' (with 'a'), not 'criterionId'
                    name: crit.name || crit.criterionName || getCriterionName(crit.criteriaId || crit.criterionId || crit.auditCriteriaMapId)
                  }))
                  // Use a unique key: prefer $id, then auditCriteriaMapId, then criteriaId, fallback to a compound key
                  .map((crit: any, idx: number) => [
                    crit.$id || crit.auditCriteriaMapId || crit.criteriaId || crit.criterionId || `criteria_${idx}`, 
                    crit
                  ])
              ).values()
            )
          },
          auditTeams: {
            ...rawDetails.auditTeams,
            values: Array.from(
              new Map(
                (rawDetails.auditTeams?.$values || rawDetails.auditTeams?.values || [])
                  .map((member: any) => ({
                    ...member,
                    fullName: member.fullName || getUserName(member.userId)
                  }))
                  .map((member: any) => [member.userId, member])
              ).values()
            )
          },
          schedules: {
            ...rawDetails.schedules,
            values: rawDetails.schedules?.$values || rawDetails.schedules?.values || []
          }
        };
        
        console.log('📋 Normalized and enriched details:', normalizedDetails);
        console.log('✅ Criteria count after normalization:', normalizedDetails.criteria?.values?.length);
        console.log('📋 Criteria values:', normalizedDetails.criteria?.values);
        setSelectedPlanDetails(normalizedDetails);
        setShowDetailsModal(true);
        return;
      } catch (apiError) {
        console.warn('⚠️ Full details API failed, using basic data from table:', apiError);
        
        // Fallback: Use data from existing plans table
        const planFromTable = existingPlans.find(p => p.auditId === auditId || p.id === auditId);
        
        if (!planFromTable) {
          throw new Error('Plan not found in table. Backend API /AuditPlan/{id} is also returning 500 error.');
        }
        
        // Show basic info only (without nested data)
        const basicDetails = {
          ...planFromTable,
          scopeDepartments: { values: [] },
          criteria: { values: [] },
          auditTeams: { values: [] },
          schedules: { values: [] },
          createdByUser: planFromTable.createdByUser || {
            fullName: planFromTable.createdBy || 'Unknown',
            email: 'N/A',
            roleName: 'N/A'
          }
        };
        
        console.log('📋 Using basic details from table (nested data not available):', basicDetails);
        alert('⚠️ Backend API Issue\n\nGET /api/AuditPlan/{id} is returning 500 error.\n\nShowing basic information only.\nNested data (departments, criteria, team, schedules) is not available.\n\nPlease contact backend team to fix this endpoint.');
        
        setSelectedPlanDetails(basicDetails);
        setShowDetailsModal(true);
        return;
      }
    } catch (error) {
      console.error('❌ Failed to fetch plan details', error);
      alert('⚠️ Cannot load full plan details\n\n' +
            'The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n' +
            'This endpoint should return:\n' +
            '• Basic audit info (title, type, scope, dates, status)\n' +
            '• scopeDepartments (departments in scope)\n' +
            '• criteria (audit standards/criteria)\n' +
            '• auditTeams (lead, auditors, owners)\n' +
            '• schedules (milestones with dates)\n' +
            '• createdByUser (creator info)\n\n' +
            'Please check backend logs for the error.\n\n' +
            'Error: ' + (error as any)?.message);
    }
  };

  // Handler: Delete plan directly by auditId (no multi-field confirmation)
  const handleDeletePlan = async (auditId: string) => {
    // Simple confirm for safety
    if (!window.confirm('Delete this audit plan permanently?')) return;
    try {
      console.log('🗑️ Deleting audit plan:', auditId);
      await deleteAuditPlan(auditId);
      console.log('✅ Plan deleted successfully');
      
      // Immediately remove from local state first (optimistic update)
      setExistingPlans(prevPlans => 
        prevPlans.filter(p => (p.auditId || p.id) !== auditId)
      );
      
      // Then refresh from server to ensure sync
      console.log('🔄 Refreshing plans list from server...');
      const [plansResponse, scopeDepsResponse] = await Promise.all([
        getAuditPlans(),
        getAuditScopeDepartments()
      ]);
      
      let plans = plansResponse;
      if (plansResponse?.$values) plans = plansResponse.$values;
      else if (plansResponse?.values) plans = plansResponse.values;
      let planArray = Array.isArray(plans) ? plans : [];
      
      // Merge scope departments
      let scopeDeps = scopeDepsResponse;
      if (scopeDepsResponse?.$values) scopeDeps = scopeDepsResponse.$values;
      else if (scopeDepsResponse?.values) scopeDeps = scopeDepsResponse.values;
      const scopeDepArray = Array.isArray(scopeDeps) ? scopeDeps : [];
      
      planArray = planArray.map((plan: any) => ({
        ...plan,
        scopeDepartments: scopeDepArray.filter((sd: any) => 
          String(sd.auditId) === String(plan.auditId || plan.id)
        )
      }));
      
      console.log(`✅ Refreshed: ${planArray.length} plans remaining`);
      setExistingPlans(planArray);
    } catch (error: any) {
      console.error('❌ Failed to delete plan', error);
      alert('Delete failed: ' + (error?.response?.data?.message || error?.message || 'Unknown error'));
      // Refresh list on error to ensure UI is in sync
      try {
        const [plansResponse, scopeDepsResponse] = await Promise.all([
          getAuditPlans(),
          getAuditScopeDepartments()
        ]);
        let plans = plansResponse;
        if (plansResponse?.$values) plans = plansResponse.$values; 
        else if (plansResponse?.values) plans = plansResponse.values;
        let planArray = Array.isArray(plans) ? plans : [];
        
        let scopeDeps = scopeDepsResponse;
        if (scopeDepsResponse?.$values) scopeDeps = scopeDepsResponse.$values;
        else if (scopeDepsResponse?.values) scopeDeps = scopeDepsResponse.values;
        const scopeDepArray = Array.isArray(scopeDeps) ? scopeDeps : [];
        
        planArray = planArray.map((plan: any) => ({
          ...plan,
          scopeDepartments: scopeDepArray.filter((sd: any) => 
            String(sd.auditId) === String(plan.auditId || plan.id)
          )
        }));
        
        setExistingPlans(planArray);
      } catch (refreshErr) {
        console.error('❌ Failed to refresh after error', refreshErr);
      }
    }
  };

  // Handler: Edit plan (open form with pre-filled data)
  const handleEditPlan = async (auditId: string) => {
    try {
      console.log('✏️ Loading plan for editing:', auditId);
      
      let details: any;
      
      // Try to fetch full details from API
      try {
        const rawDetails = await getAuditPlanById(auditId);
        console.log('📄 Got full plan details from API:', rawDetails);
        
        // Normalize $values to values
        details = {
          ...rawDetails,
          scopeDepartments: {
            ...rawDetails.scopeDepartments,
            values: rawDetails.scopeDepartments?.$values || rawDetails.scopeDepartments?.values || []
          },
          criteria: {
            ...rawDetails.criteria,
            values: rawDetails.criteria?.$values || rawDetails.criteria?.values || []
          },
          auditTeams: {
            ...rawDetails.auditTeams,
            values: rawDetails.auditTeams?.$values || rawDetails.auditTeams?.values || []
          },
          schedules: {
            ...rawDetails.schedules,
            values: rawDetails.schedules?.$values || rawDetails.schedules?.values || []
          }
        };
      } catch (apiError) {
        console.error('❌ Full details API failed:', apiError);
        alert('⚠️ Cannot Edit\n\nBackend API /AuditPlan/{id} is returning 500 error.\n\nEdit function requires full plan details including:\n• Departments\n• Criteria selections\n• Team assignments\n• Schedule dates\n\nPlease contact backend team to fix GET /api/AuditPlan/{id} endpoint first.');
        throw new Error('Backend API /AuditPlan/{id} is returning 500 error. Cannot load plan for editing.');
      }
      
      // Set edit mode
      setIsEditMode(true);
      setEditingAuditId(auditId);
      
      // Step 1: Basic info
      setTitle(details.title || '');
      setAuditType(details.type || 'Internal');
      setGoal(details.objective || '');
      setPeriodFrom(details.startDate ? details.startDate.split('T')[0] : '');
      setPeriodTo(details.endDate ? details.endDate.split('T')[0] : '');
      
      // Step 2: Scope - determine level from scope field or scopeDepartments
      if (details.scope === 'Academy' || (!details.scopeDepartments?.values?.length && !details.scope)) {
        setLevel('academy');
        setSelectedDeptIds([]);
      } else {
        setLevel('department');
        // Extract all department IDs from scopeDepartments
        if (details.scopeDepartments?.values?.length > 0) {
          const deptIds = details.scopeDepartments.values.map((dept: any) => {
            if (typeof dept === 'object' && dept.deptId) return String(dept.deptId);
            if (typeof dept === 'number') return String(dept);
            return String(dept);
          }).filter(Boolean);
          setSelectedDeptIds(deptIds);
        }
      }
      
      // Step 3: Template and criteria
      if (details.templateId) {
        setSelectedTemplateId(details.templateId);
      }
      
      // Extract criteria IDs from criteria.values array
      if (details.criteria?.values?.length > 0) {
        const criteriaIds = details.criteria.values.map((c: any) => {
          if (typeof c === 'object' && c.criterionId) return String(c.criterionId);
          if (typeof c === 'object' && c.id) return String(c.id);
          return String(c);
        });
        setSelectedCriteriaIds(criteriaIds);
      }
      
      // Step 4: Team members
      if (details.auditTeams?.values?.length > 0) {
        const auditors: string[] = [];
        let leadId = '';
        let ownerId = '';
        
        details.auditTeams.values.forEach((member: any) => {
          const userId = member.userId || member.id;
          const role = member.roleInTeam || member.role;
          const isLead = member.isLead || false;
          
          if (role === 'Auditor') {
            auditors.push(String(userId));
            if (isLead) leadId = String(userId);
          } else if (role === 'AuditeeOwner') {
            ownerId = String(userId);
          }
        });
        
        setSelectedAuditorIds(auditors);
        setSelectedLeadId(leadId);
        setSelectedOwnerId(ownerId);
      }
      
      // Step 5: Schedules
      if (details.schedules?.values?.length > 0) {
        details.schedules.values.forEach((schedule: any) => {
          const name = schedule.milestoneName || schedule.name;
          const date = schedule.dueDate ? schedule.dueDate.split('T')[0] : '';
          
          if (name?.includes('Kickoff')) setKickoffMeeting(date);
          else if (name?.includes('Fieldwork')) setFieldworkStart(date);
          else if (name?.includes('Evidence')) setEvidenceDue(date);
          else if (name?.includes('Draft')) setDraftReportDue(date);
          else if (name?.includes('CAPA')) setCapaDue(date);
        });
      }
      
      // Open form at step 1
      setShowForm(true);
      setCurrentStep(1);
      
      console.log('✅ Plan loaded for editing successfully');
    } catch (error) {
      console.error('❌ Failed to load plan for editing', error);
      alert('⚠️ Cannot load plan for editing\n\n' +
            'The backend API endpoint GET /api/AuditPlan/{id} is returning 500 Internal Server Error.\n\n' +
            'This endpoint is required to load all plan data for editing:\n' +
            '• Basic info (title, type, scope, dates)\n' +
            '• Template and criteria selections\n' +
            '• Team assignments (lead, auditors, owners)\n' +
            '• Schedule milestones\n\n' +
            'Please fix the backend API first.\n\n' +
            'Error: ' + (error as any)?.message);
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
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create New Plan
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {showForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary-600">
                {isEditMode ? '✏️ Edit Audit Plan' : 'New Audit Plan'}
              </h2>
              {isEditMode && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                  Editing Mode
                </span>
              )}
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        currentStep === step 
                          ? 'bg-primary-600 text-white' 
                          : currentStep > step 
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}>
                        {currentStep > step ? '✓' : step}
                      </div>
                      <span className={`text-xs mt-1 ${currentStep === step ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}>
                        {step === 1 && 'Plan'}
                        {step === 2 && 'Scope'}
                        {step === 3 && 'Checklist'}
                        {step === 4 && 'Team'}
                        {step === 5 && 'Schedule'}
                      </span>
                    </div>
                    {step < 5 && (
                      <div className={`h-1 flex-1 mx-2 ${currentStep > step ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {currentStep === 1 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 1/5: Plan</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} type="text" placeholder="Enter audit plan title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <input
                        type="text"
                        value={auditType}
                        onChange={(e) => setAuditType(e.target.value)}
                        placeholder="Ví dụ: Internal, External, ..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                      <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="Describe the goal and context of this audit..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period - From</label>
                        <input value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period - To</label>
                        <input value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={2} placeholder="Additional notes..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 2/5: Scope</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="academy">Entire Aviation Academy</option>
                        <option value="department">Department</option>
                      </select>
                    </div>

                    {level === 'department' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Departments * (Select one or more)</label>
                        <MultiSelect
                          options={departments.map((d) => ({ 
                            label: d.name, 
                            value: String(d.deptId) 
                          }))}
                          value={selectedDeptIds}
                          onChange={setSelectedDeptIds}
                          placeholder="Select departments..."
                        />
                      </div>
                    )}

                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Delivery: </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                          <span className="text-sm text-gray-700">Classroom</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">Elearning</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">Simulator</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">OJT</span>
                        </label>
                      </div>
                    </div> */}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Standards:</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {criteria.length === 0 && (
                          <p className="text-sm text-gray-500">No standards available.</p>
                        )}
                        {criteria.map((c: any) => {
                          const id = c.criteriaId || c.id || c.$id
                          const label = c.name || c.referenceCode || id
                          const checked = selectedCriteriaIds.includes(String(id))
                          return (
                            <label key={String(id)} className="flex items-center gap-2 bg-gray-50 rounded border border-gray-200 px-3 py-2">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                checked={checked}
                                onChange={(e) => {
                                  const val = String(id)
                                  setSelectedCriteriaIds((prev) => e.target.checked ? [...prev, val] : prev.filter((x) => x !== val))
                                }}
                              />
                              <span className="text-sm text-gray-700">
                                {label}
                                {c.referenceCode && (
                                  <span className="ml-2 text-xs text-gray-500">({c.referenceCode})</span>
                                )}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Course filter: type code and press Enter to add</label>
                      <input
                        type="text"
                        placeholder="e.g. CC-REC-1025, CC-DGR-1125"
                        value={courseQuery}
                        onChange={(e) => setCourseQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addScope(courseQuery);
                            setCourseQuery('');
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Avoid duplicates; entries are auto uppercased.</p>
                    </div> */}

                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Selected Scope chips ({selectedScopes.length})</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedScopes.map((code) => (
                          <span key={code} className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium border border-primary-200 flex items-center gap-2">
                            {code}
                            <button type="button" onClick={() => removeScope(code)} className="hover:text-primary-900" aria-label={`Remove ${code}`}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div> */}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Out-of-scope (optional):</label>
                      <textarea rows={3} placeholder="Reasons for out-of-scope items..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 3/5: Checklist</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Checklist Set</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={selectedTemplateId || ''}
                        onChange={async (e) => {
                          const id = e.target.value || null;
                          setSelectedTemplateId(id);
                        }}
                      >
                        <option value="">Published Checklist</option>
                        {checklistTemplates.map((t: any) => (
                          <option key={t.templateId || t.templateID || t.id || t.code} value={t.templateId || t.templateID || t.id || t.code}>
                            {t.name || t.title || t.code || `Template ${t.templateId || t.id}`}
                          </option>
                        ))}
                      </select>
                      
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={3} placeholder="Additional notes about checklist..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 4/5: Team & Responsibilities</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lead (choose one from Auditors)</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={selectedLeadId}
                        onChange={(e) => {
                          const newLeadId = e.target.value;
                          setSelectedLeadId(newLeadId);
                          // Remove new lead from auditors list if they were selected
                          if (newLeadId && selectedAuditorIds.includes(newLeadId)) {
                            setSelectedAuditorIds(selectedAuditorIds.filter(id => id !== newLeadId));
                          }
                        }}
                      >
                        <option value="">Select Lead Auditor</option>
                        {auditorOptions.map((u: any) => (
                          <option key={u.userId} value={u.userId}>{u.fullName} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auditors</label>
                      <MultiSelect
                        options={auditorOptions
                          .filter((u: any) => String(u.userId) !== selectedLeadId)
                          .map((u: any) => ({ value: String(u.userId), label: `${u.fullName} (${u.email})` }))}
                        value={selectedAuditorIds}
                        onChange={setSelectedAuditorIds}
                        placeholder="Select auditor(s)"
                      />
                      <p className="mt-1 text-xs text-gray-500">Bạn có thể chọn 1 hoặc nhiều auditor.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Auditee Owners (Department Heads)</label>
                      {level === 'academy' ? (
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm">
                          All Auditee Owners will be auto-assigned for Academy scope ({ownerOptions?.length || 0} owners).
                        </div>
                      ) : (
                        <>
                          {selectedDeptIds.length === 0 ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <p className="text-sm text-gray-500">Vui lòng chọn phòng ban ở Step 2 để xem Department Heads.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(() => {
                                // Filter ownerOptions (AdminUsers with role AuditeeOwner) by selected departments
                                const filtered = ownerOptions.filter((owner: any) => 
                                  selectedDeptIds.includes(String(owner.deptId ?? ''))
                                );
                                
                                if (filtered.length === 0) {
                                  return (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                                      <p className="text-sm text-yellow-700">⚠️ No auditee owners found for selected departments.</p>
                                    </div>
                                  );
                                }
                                
                                return filtered.map((owner: any) => {
                                  const deptInfo = departments.find((d: any) => String(d.deptId) === String(owner.deptId));
                                  
                                  return (
                                    <div 
                                      key={owner.userId || owner.$id} 
                                      className="flex items-center justify-between bg-white border border-primary-200 rounded-lg px-4 py-3 hover:bg-primary-50 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-semibold">
                                          {(owner.fullName || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-gray-900">
                                            {owner.fullName || 'Unknown User'}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {owner.email || 'N/A'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="inline-block px-3 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
                                          {deptInfo?.name || `Dept ${owner.deptId}`}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={2} placeholder="Additional team notes..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 5/5: Schedule & Deadlines</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kickoff Meeting</label>
                      <input 
                        type="date" 
                        value={kickoffMeeting}
                        onChange={(e) => setKickoffMeeting(e.target.value)}
                        placeholder="dd/mm/yyyy" 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fieldwork Start</label>
                      <input 
                        type="date" 
                        value={fieldworkStart}
                        onChange={(e) => setFieldworkStart(e.target.value)}
                        placeholder="dd/mm/yyyy" 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Due</label>
                      <input 
                        type="date" 
                        value={evidenceDue}
                        onChange={(e) => setEvidenceDue(e.target.value)}
                        placeholder="dd/mm/yyyy" 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Draft Report Due</label>
                      <input 
                        type="date" 
                        value={draftReportDue}
                        onChange={(e) => setDraftReportDue(e.target.value)}
                        placeholder="dd/mm/yyyy" 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CAPA Due</label>
                      <input 
                        type="date" 
                        value={capaDue}
                        onChange={(e) => setCapaDue(e.target.value)}
                        placeholder="dd/mm/yyyy" 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                      />
                    </div>
                    <div className="border-t pt-4 mt-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-gray-700">Checklist Published ≥2 days before fieldwork: [Yes/No]</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-6 border-t">
                <button 
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    } else {
                      setShowForm(false);
                      setCurrentStep(1);
                    }
                  }}
                  className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  {currentStep === 1 ? 'Cancel' : '← Back'}
                </button>
                
                <div className="flex gap-3">
                  {currentStep < 5 && (
                    <button 
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                    >
                      Continue →
                    </button>
                  )}
                  {currentStep === 5 && (
                    <>
                      <button className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150">
                        Save Draft
                      </button>
                      <button onClick={async () => {
                        // Client-side validation
                        if (!title.trim()) {
                          alert('Vui lòng nhập tiêu đề (Title) cho kế hoạch.');
                          setCurrentStep(1);
                          return;
                        }
                        if (!periodFrom || !periodTo) {
                          alert('Vui lòng chọn ngày bắt đầu và kết thúc.');
                          setCurrentStep(1);
                          return;
                        }
                        if (!selectedTemplateId) {
                          alert('Vui lòng chọn Checklist Template (Step 3).');
                          setCurrentStep(3);
                          return;
                        }
                        if (level === 'department') {
                          if (selectedDeptIds.length === 0) {
                            alert('Vui lòng chọn ít nhất 1 phòng ban cho phạm vi Department (Step 2).');
                            setCurrentStep(2);
                            return;
                          }
                          // Check if selected departments have auditee owners
                          const ownersForDepts = ownerOptions.filter((o: any) => selectedDeptIds.includes(String(o.deptId ?? '')));
                          if (ownersForDepts.length === 0) {
                            if (!window.confirm('⚠️ Các phòng ban đã chọn chưa có Auditee Owner.\n\nBạn có muốn tiếp tục tạo audit plan không?')) {
                              setCurrentStep(4);
                              return;
                            }
                          }
                        }

                        // Build payload following Swagger specification
                        const payload: any = {
                          title: title || 'Untitled Plan',
                          type: auditType || 'Internal',
                          scope: level === 'academy' ? 'Academy' : 'Department', // Required by backend
                          templateId: selectedTemplateId || undefined,
                          startDate: periodFrom ? new Date(periodFrom).toISOString() : undefined,
                          endDate: periodTo ? new Date(periodTo).toISOString() : undefined,
                          status: 'Draft', // Set initial status
                          isPublished: false,
                          objective: goal || '',
                        };

                        try {
                          let auditId: string;
                          
                          if (isEditMode && editingAuditId) {
                            // UPDATE MODE
                            console.log('✏️ Updating audit:', editingAuditId, 'with payload:', payload);
                            await updateAuditPlan(editingAuditId, payload);
                            console.log('✅ Audit updated successfully');
                            auditId = editingAuditId;
                            
                            // TODO: Update related records (scope, criteria, team, schedules)
                            // For now, we'll just update the main audit record
                            
                          } else {
                            // CREATE MODE
                            console.debug('📝 Creating new audit with payload:', payload);
                            const resp = await createAudit(payload);
                            console.log('✅ Create audit response:', resp);
                            auditId = resp?.auditId || resp?.id || resp;
                            
                            if (!auditId) {
                              throw new Error('No auditId returned from createAudit API');
                            }
                            
                            console.log('📝 Audit created with ID:', auditId);
                          }
                          
                          const newAuditId = auditId; // For backward compatibility with existing code
                          
                          // If scoped by department, attach all selected departments to audit
                          if (level === 'department' && selectedDeptIds.length > 0) {
                            try {
                              console.log('🏢 Attaching departments:', selectedDeptIds);
                              const deptResults = await Promise.allSettled(
                                selectedDeptIds.map((deptId) => addAuditScopeDepartment(String(newAuditId), Number(deptId)))
                              );
                              const failedDepts = deptResults.filter((r) => r.status === 'rejected');
                              if (failedDepts.length > 0) {
                                console.warn('⚠️ Some departments failed to attach:', failedDepts);
                                alert(`Warning: ${failedDepts.length} out of ${selectedDeptIds.length} departments failed to attach.`);
                              } else {
                                console.log('✅ All departments attached successfully');
                              }
                            } catch (scopeErr) {
                              console.error('❌ Attach departments to audit failed', scopeErr);
                              alert('Warning: Failed to attach departments. Error: ' + (scopeErr as any)?.message);
                            }
                          }
                          // Map selected standards to this audit
                          if (Array.isArray(selectedCriteriaIds) && selectedCriteriaIds.length > 0) {
                            try {
                              console.log('📌 Attaching criteria:', selectedCriteriaIds);
                              const criteriaResults = await Promise.allSettled(
                                selectedCriteriaIds.map((cid) => addCriterionToAudit(String(newAuditId), String(cid)))
                              );
                              const failed = criteriaResults.filter((r) => r.status === 'rejected');
                              if (failed.length > 0) {
                                console.warn('⚠️ Some criteria failed to attach:', failed);
                              } else {
                                console.log('✅ All criteria attached successfully');
                              }
                            } catch (critErr) {
                              console.error('❌ Attach criteria to audit failed', critErr);
                              alert('Warning: Failed to attach some criteria. Check console for details.');
                            }
                          }
                          // Add team members
                          try {
                            console.log('👥 Adding team members...');
                            const calls: Promise<any>[] = []
                            // ensure lead is in auditors list
                            const auditorSet = new Set<string>(selectedAuditorIds)
                            if (selectedLeadId) auditorSet.add(selectedLeadId)
                            // post auditors (roleInTeam: 'Auditor')
                            auditorSet.forEach((uid) => {
                              const isLead = uid === selectedLeadId
                              console.log(`  - Adding auditor: ${uid} (Lead: ${isLead})`);
                              calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'Auditor', isLead }))
                            })
                            // Auditee Owner(s)
                            if (level === 'academy') {
                              // auto-assign all owners
                              const uniqueOwnerIds = Array.from(new Set(ownerOptions.map((o: any) => String(o.userId)).filter(Boolean)))
                              console.log(`  - Adding ${uniqueOwnerIds.length} owners (academy scope)`);
                              uniqueOwnerIds.forEach((uid) => {
                                calls.push(addTeamMember({ auditId: String(newAuditId), userId: uid, roleInTeam: 'AuditeeOwner', isLead: false }))
                              })
                            } else {
                              // department scope: auto-assign auditee owners for selected departments
                              const ownersForDepts = ownerOptions.filter((o: any) => selectedDeptIds.includes(String(o.deptId ?? '')));
                              console.log(`  - Adding ${ownersForDepts.length} auditee owners (department scope)`);
                              ownersForDepts.forEach((owner: any) => {
                                if (owner.userId) {
                                  calls.push(addTeamMember({ auditId: String(newAuditId), userId: String(owner.userId), roleInTeam: 'AuditeeOwner', isLead: false }))
                                }
                              });
                            }
                            if (calls.length) {
                              const teamResults = await Promise.allSettled(calls);
                              const failedTeam = teamResults.filter((r) => r.status === 'rejected');
                              if (failedTeam.length > 0) {
                                console.warn('⚠️ Some team members failed to add:', failedTeam);
                              } else {
                                console.log('✅ All team members added successfully');
                              }
                            }
                          } catch (teamErr) {
                            console.error('❌ Attach team failed', teamErr);
                            alert('Warning: Failed to add some team members. Check console for details.');
                          }
                          
                          // Post schedules/milestones if dates are provided
                          try {
                            const schedulePairs = [
                              { name: MILESTONE_NAMES.KICKOFF, date: kickoffMeeting },
                              { name: MILESTONE_NAMES.FIELDWORK, date: fieldworkStart },
                              { name: MILESTONE_NAMES.EVIDENCE, date: evidenceDue },
                              { name: MILESTONE_NAMES.DRAFT, date: draftReportDue },
                              { name: MILESTONE_NAMES.CAPA, date: capaDue },
                            ].filter(pair => pair.date); // Only include milestones with dates
                            
                            if (schedulePairs.length > 0) {
                              console.log(`📅 Posting ${schedulePairs.length} schedule milestones...`);
                              const schedulePromises = schedulePairs.map(pair => {
                                console.log(`  - ${pair.name}: ${pair.date}`);
                                return addAuditSchedule({
                                  auditId: String(newAuditId),
                                  milestoneName: pair.name,
                                  dueDate: new Date(pair.date).toISOString(),
                                  status: SCHEDULE_STATUS.PLANNED,
                                  notes: '',
                                });
                              });
                              const scheduleResults = await Promise.allSettled(schedulePromises);
                              const failedSchedules = scheduleResults.filter((r) => r.status === 'rejected');
                              if (failedSchedules.length > 0) {
                                console.warn('⚠️ Some schedules failed to post:', failedSchedules);
                              } else {
                                console.log('✅ All schedules posted successfully');
                              }
                            }
                          } catch (scheduleErr) {
                            console.error('❌ Failed to post schedules', scheduleErr);
                            alert('Warning: Failed to post some schedules. Check console for details.');
                          }
                          
                          // Refresh the plans list BEFORE showing alert
                          try {
                            console.log('🔄 Refreshing plans list...');
                            const response = await getAuditPlans();
                            console.log('📋 Refresh response:', response);
                            
                            // Handle different response formats
                            let plans = response;
                            if (response?.$values) {
                              plans = response.$values;
                            } else if (response?.values) {
                              plans = response.values;
                            }
                            
                            const planArray = Array.isArray(plans) ? plans : [];
                            console.log(`✅ Refreshed ${planArray.length} plans`);
                            setExistingPlans(planArray);
                          } catch (refreshErr) {
                            console.error('❌ Failed to refresh plans list', refreshErr);
                          }
                          
                          // Reset ALL form fields
                          setTitle('');
                          setAuditType('');
                          setGoal('');
                          setPeriodFrom('');
                          setPeriodTo('');
                          setLevel('academy');
                          setSelectedDeptIds([]);
                          setSelectedTemplateId(null);
                          setSelectedCriteriaIds([]);
                          setSelectedLeadId('');
                          setSelectedAuditorIds([]);
                          setSelectedOwnerId('');
                          setKickoffMeeting('');
                          setFieldworkStart('');
                          setEvidenceDue('');
                          setDraftReportDue('');
                          setCapaDue('');
                          
                          // Reset edit mode
                          setIsEditMode(false);
                          setEditingAuditId(null);
                          
                          // Close form and reset to step 1
                          setShowForm(false);
                          setCurrentStep(1);
                          
                          // Show success message AFTER everything is done
                          const successMsg = isEditMode 
                            ? '✅ Audit plan updated successfully!\n\nID: ' + String(newAuditId) + '\n\nThe changes have been saved.'
                            : '✅ Audit plan created successfully!\n\nID: ' + String(newAuditId) + '\n\nThe plan has been added to the list below.';
                          alert(successMsg);
                        } catch (err: any) {
                          // Try to show server-provided error details if available
                          const serverMsg = err?.response?.data || err?.response || err?.message || err;
                          console.error('Create audit failed', err, serverMsg);
                          try {
                            const pretty = typeof serverMsg === 'object' ? JSON.stringify(serverMsg, null, 2) : String(serverMsg);
                            alert('Failed to create audit plan. Server response:\n' + pretty);
                          } catch (e) {
                            alert('Failed to create audit plan: ' + (err?.message || err));
                          }
                        }
                      }} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">
                        {isEditMode ? '💾 Update Plan' : '➤ Submit Plan'}
                      </button>
                      {isEditMode && (
                        <button 
                          onClick={() => {
                            if (window.confirm('Discard changes and exit edit mode?')) {
                              // Reset form
                              setTitle('');
                              setAuditType('');
                              setGoal('');
                              setPeriodFrom('');
                              setPeriodTo('');
                              setLevel('academy');
                              setSelectedDeptIds([]);
                              setSelectedTemplateId(null);
                              setSelectedCriteriaIds([]);
                              setSelectedLeadId('');
                              setSelectedAuditorIds([]);
                              setSelectedOwnerId('');
                              setKickoffMeeting('');
                              setFieldworkStart('');
                              setEvidenceDue('');
                              setDraftReportDue('');
                              setCapaDue('');
                              setIsEditMode(false);
                              setEditingAuditId(null);
                              setShowForm(false);
                              setCurrentStep(1);
                            }
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                        >
                          ✖ Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Existing Audit Plans</h2>
          </div>
          
          {/* Filter Controls */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Department Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept: any) => (
                    <option key={dept.deptId} value={dept.deptId}>
                      {dept.name || dept.deptName || dept.departmentName || `Dept ${dept.deptId}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period From Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Period From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Period To Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Period To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Clear Filters & Results Count */}
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => {
                  setFilterDepartment('');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setFilterStatus('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear all filters
              </button>
              <span className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredPlans.length}</span> of <span className="font-semibold text-gray-900">{existingPlans.length}</span> plans
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title & Goal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Schedule</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {loadingPlans ? 'Loading plans...' : 
                       existingPlans.length > 0 ? 'No plans match the current filters.' : 
                       'No audit plans found. Click "Create New Plan" to get started.'}
                    </td>
                  </tr>
                )}
                {filteredPlans.map((plan, index) => {
                  const formatDate = (dateStr: string) => {
                    if (!dateStr) return 'N/A';
                    try {
                      return new Date(dateStr).toLocaleDateString();
                    } catch {
                      return dateStr;
                    }
                  };
                  
                  // Check if plan is inactive
                  const isInactive = plan.status?.toLowerCase() === 'inactive';
                  
                  return (
                  <tr key={plan.auditId || index} className={`transition-colors ${isInactive ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap" title={`ID: ${plan.id || plan.auditId}`}>
                      {/* Display sequential row number instead of GUID for readability */}
                      <span className="text-sm font-semibold text-primary-700">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4" style={{ maxWidth: '250px' }}>
                      <p className="text-sm font-semibold text-gray-900">{plan.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.objective || 'No objective specified'}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${getBadgeVariant('primary-light')}`}>
                          {plan.type || 'General'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-xs text-gray-600">From:</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(plan.startDate)}</p>
                      <p className="text-xs text-gray-600 mt-1">To:</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(plan.endDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{plan.scope || 'N/A'}</p>
                      <p className="text-xs text-gray-500">
                        {plan.isPublished ? 'Published' : 'Draft'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">
                        <p>View details for schedule</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status || 'Draft')}`}>
                        {plan.status || 'Draft'}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">Created:</p>
                      <p className="text-xs text-gray-700">{formatDate(plan.createdAt)}</p>
                      <p className="text-xs text-gray-500">By: {plan.createdBy || 'Unknown'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleViewDetails(plan.auditId)} 
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => handleEditPlan(plan.auditId)} 
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left"
                        >
                          Edit
                        </button>
                        {/* Hide Delete button when status is Inactive */}
                        {!isInactive && (
                          <button 
                            onClick={() => handleDeletePlan(plan.auditId || plan.id)} 
                            className="text-red-600 hover:text-red-700 text-sm font-medium text-left"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showTeamModal && selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-primary px-6 py-4 border-b border-primary-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Audit Plan Details</h3>
                    <p className="text-sm text-primary-100 mt-1">{selectedPlan.id} - {selectedPlan.title}</p>
                  </div>
                  <button onClick={() => setShowTeamModal(false)} className="text-white hover:text-primary-100 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Title</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPlan.status)}`}>{selectedPlan.status}</span>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-600 mb-1">Goal</p>
                      <p className="text-sm text-gray-900">{selectedPlan.goal}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Period From</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.periodFrom}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Period To</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.periodTo}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Scope & Domain
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Organization Level</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.organizationLevel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Domain/Area</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.domain}</p>
                    </div>
                    {/* <div>
                      <p className="text-xs text-gray-600 mb-2">Delivery Mode</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedPlan.deliveryMode.map((mode: string, i: number) => (
                          <span key={i} className={`px-3 py-1 text-xs rounded-full font-medium ${getBadgeVariant('primary-medium')}`}>{mode}</span>
                        ))}
                      </div>
                    </div> */}
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Standards</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedPlan.standards.map((std: string, i: number) => (
                          <span key={i} className={`px-3 py-1 text-xs rounded-full font-medium ${getBadgeVariant('primary-dark')}`}>{std}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Checklist Set</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.checklist}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Version</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.version}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Audit Team
                  </h4>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Audit Lead</p>
                    <div className="bg-white border border-primary-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.auditLead}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Auditors ({selectedPlan.auditors.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPlan.auditors.map((auditor: string, i: number) => (
                        <div key={i} className="bg-white border border-primary-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-gray-900">{auditor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Department Owners ({selectedPlan.departmentOwners.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPlan.departmentOwners.map((owner: string, i: number) => (
                        <div key={i} className="bg-white border border-primary-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-gray-900">{owner}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedule & Milestones
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Kickoff Meeting</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.kickoffMeeting}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Fieldwork Start</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.fieldworkStart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Evidence Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.evidenceDue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Draft Report Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.draftReportDue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">CAPA Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.capaDue}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Metadata
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created Date</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.createdDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created By</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.createdBy}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowTeamModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Close</button>
                <button className="flex-1 btn-primary">Edit Plan</button>
              </div>
            </div>
          </div>
        )}

        {/* Full Details Modal (from GET /AuditPlan/{id}) */}
        {showDetailsModal && selectedPlanDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-primary px-6 py-5 border-b border-sky-500">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      📄 Full Audit Plan Details
                    </h3>
                    <p className="text-sm text-sky-100 mt-1">
                      <span className="font-semibold">ID:</span> {selectedPlanDetails.auditId}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetailsModal(false)} 
                    className="text-white hover:bg-sky-800 rounded-full p-2 transition-colors"
                    title="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Basic Information Section */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
                    📋 Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">Title:</span>
                      <span className="text-sm text-gray-900 font-medium">{selectedPlanDetails.title}</span>
                    </div>
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">Type:</span>
                      <span className="text-sm text-gray-900">{selectedPlanDetails.type}</span>
                    </div>
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">Start Date:</span>
                      <span className="text-sm text-gray-900">
                        {selectedPlanDetails.startDate ? new Date(selectedPlanDetails.startDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">End Date:</span>
                      <span className="text-sm text-gray-900">
                        {selectedPlanDetails.endDate ? new Date(selectedPlanDetails.endDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">Scope:</span>
                      <span className="text-sm text-gray-900">{selectedPlanDetails.scope || 'N/A'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-sm font-medium text-gray-600 w-32">Status:</span>
                      <span className={`text-sm px-2 py-0.5 rounded font-medium ${getStatusColor(selectedPlanDetails.status)}`}>
                        {selectedPlanDetails.status}
                      </span>
                    </div>
                    <div className="flex col-span-1 md:col-span-2">
                      <span className="text-sm font-medium text-gray-600 w-32">Objective:</span>
                      <span className="text-sm text-gray-900 flex-1">{selectedPlanDetails.objective || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Created By Section */}
                {selectedPlanDetails.createdByUser && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
                      👤 Created By
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Name:</span>
                        <span className="text-sm text-gray-900">{selectedPlanDetails.createdByUser.fullName}</span>
                      </div>
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Email:</span>
                        <span className="text-sm text-gray-900">{selectedPlanDetails.createdByUser.email}</span>
                      </div>
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Role:</span>
                        <span className="text-sm text-gray-900">{selectedPlanDetails.createdByUser.roleName}</span>
                      </div>
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Created At:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(selectedPlanDetails.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scope Departments Section */}
                {selectedPlanDetails.scopeDepartments?.values?.length > 0 && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
                      🏢 Scope Departments
                    </h3>
                    <div className="space-y-2">
                      {selectedPlanDetails.scopeDepartments.values.map((dept: any, idx: number) => {
                        const deptName = dept.deptName || getDepartmentName(dept.deptId);
                        // Find department head (AuditeeOwner) for this department
                        const deptHead = ownerOptions.find((owner: any) => 
                          String(owner.deptId) === String(dept.deptId)
                        );
                        
                        return (
                          <div key={idx} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-start">
                              <span className="text-primary-500 mr-2 mt-0.5">•</span>
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {deptName}
                                </span>
                                {deptHead && (
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    Trưởng phòng: <span className="font-medium">{deptHead.fullName}</span>
                                    {deptHead.email && <span className="text-gray-500"> ({deptHead.email})</span>}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Audit Criteria Section */}
                {selectedPlanDetails.criteria?.values?.length > 0 && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
                      📌 Audit Criteria
                    </h3>
                    <ul className="space-y-2">
                      {selectedPlanDetails.criteria.values.map((criterion: any, idx: number) => {
                        // Use criterion.name if available, otherwise lookup by criteriaId
                        // API uses 'criteriaId' (with 'a'), not 'criterionId'
                        const displayName = criterion.name || 
                                          criterion.criterionName || 
                                          getCriterionName(criterion.criteriaId || criterion.criterionId || criterion.auditCriteriaMapId);
                        return (
                          <li key={idx} className="flex items-start">
                            <span className="text-primary-500 mr-2">•</span>
                            <span className="text-sm text-gray-700">
                              {displayName}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Audit Team Section */}
                {selectedPlanDetails.auditTeams?.values?.length > 0 && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-primary-600 mb-3 flex items-center">
                      👥 Audit Team
                    </h3>
                    <ul className="space-y-2">
                      {selectedPlanDetails.auditTeams.values.map((member: any, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-primary-500 mr-2">•</span>
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">
                              {member.fullName}
                            </span>
                            {member.roleInTeam && (
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getBadgeVariant('primary-light')}`}>
                                {member.roleInTeam}
                              </span>
                            )}
                            {member.isLead && (
                              <span className={`ml-1 text-xs px-2 py-0.5 rounded font-semibold ${getBadgeVariant('primary-medium')}`}>
                                Lead
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Schedule & Milestones Section */}
                {selectedPlanDetails.schedules?.values?.length > 0 && (
                  <div className="pb-4">
                    <h3 className="text-lg font-semibold text-primary-600 mb-4 flex items-center">
                      📅 Schedule & Milestones
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedPlanDetails.schedules.values.map((schedule: any, idx: number) => (
                        <div key={idx} className="bg-sky-50 rounded-lg p-4 border border-sky-200 hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-sky-600 mb-1">Milestone</p>
                              <p className="text-sm font-semibold text-gray-900">{schedule.milestoneName || 'N/A'}</p>
                            </div>
                            {schedule.dueDate && (
                              <div>
                                <p className="text-xs font-medium text-sky-600 mb-1">Due Date</p>
                                <p className="text-sm text-gray-700">
                                  {new Date(schedule.dueDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            )}
                            {schedule.evidenceDate && (
                              <div>
                                <p className="text-xs font-medium text-sky-600 mb-1">Evidence Date</p>
                                <p className="text-sm text-gray-700">
                                  {new Date(schedule.evidenceDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            )}
                            {schedule.status && (
                              <div>
                                <p className="text-xs font-medium text-sky-600 mb-1">Status</p>
                                <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(schedule.status)}`}>
                                  {schedule.status}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-300 flex justify-center gap-3">
                <button 
                  onClick={() => setShowDetailsModal(false)} 
                  className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEditPlan(selectedPlanDetails.auditId);
                  }}
                  className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  Edit Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
