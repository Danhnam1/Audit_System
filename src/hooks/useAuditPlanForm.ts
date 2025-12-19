import { useState } from 'react';
import { MILESTONE_NAMES } from '../constants/audit';

/**
 * Custom hook for managing audit plan form state
 */
export const useAuditPlanForm = () => {
  // Form display state
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);

  // Step 1: Basic Information + DRL upload
  const [title, setTitle] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');
  const [auditType, setAuditType] = useState<string>('Internal');
  const [drlFile, setDrlFile] = useState<File | null>(null);
  const [drlFileName, setDrlFileName] = useState<string>('');

  // Step 2: Scope
  const [level, setLevel] = useState<string>('academy');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>([]);
  const [sensitiveFlag, setSensitiveFlag] = useState<boolean>(false);
  const [sensitiveAreas, setSensitiveAreas] = useState<string[]>([]);
  const [sensitiveNotes, setSensitiveNotes] = useState<string>('');
  const [sensitiveDeptIds, setSensitiveDeptIds] = useState<string[]>([]);

  // Step 3: Checklist (multi-select)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // Step 4: Team
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [planCreatorId, setPlanCreatorId] = useState<string>('');
  const [sendDrlToCreator, setSendDrlToCreator] = useState<boolean>(false);

  // Step 5: Schedule
  const [kickoffMeeting, setKickoffMeeting] = useState<string>('');
  const [fieldworkStart, setFieldworkStart] = useState<string>('');
  const [evidenceDue, setEvidenceDue] = useState<string>('');
  const [draftReportDue, setDraftReportDue] = useState<string>('');
  const [capaDue, setCapaDue] = useState<string>('');

  // Reset all form fields
  const resetForm = () => {
    setTitle('');
    setAuditType('Internal');
    setGoal('');
    setPeriodFrom('');
    setPeriodTo('');
    setDrlFile(null);
    setDrlFileName('');
    setLevel('academy');
    setSelectedDeptIds([]);
    setSelectedTemplateIds([]);
    setSelectedCriteriaIds([]);
    setSensitiveFlag(false);
    setSensitiveAreas([]);
    setSensitiveNotes('');
    setSensitiveDeptIds([]);
    setSelectedLeadId('');
    setSelectedAuditorIds([]);
    setSelectedOwnerId('');
    setPlanCreatorId('');
    setSendDrlToCreator(false);
    setKickoffMeeting('');
    setFieldworkStart('');
    setEvidenceDue('');
    setDraftReportDue('');
    setCapaDue('');
    setIsEditMode(false);
    setEditingAuditId(null);
    setShowForm(false);
    setCurrentStep(1);
  };

  // Reset form fields for creating a new plan (keeps form open)
  const resetFormForCreate = () => {
    setTitle('');
    setAuditType('Internal');
    setGoal('');
    setPeriodFrom('');
    setPeriodTo('');
    setDrlFile(null);
    setDrlFileName('');
    setLevel('academy');
    setSelectedDeptIds([]);
    setSelectedTemplateIds([]);
    setSelectedCriteriaIds([]);
    setSensitiveFlag(false);
    setSensitiveAreas([]);
    setSensitiveNotes('');
    setSensitiveDeptIds([]);
    setSelectedLeadId('');
    setSelectedAuditorIds([]);
    setSelectedOwnerId('');
    setPlanCreatorId('');
    setSendDrlToCreator(false);
    setKickoffMeeting('');
    setFieldworkStart('');
    setEvidenceDue('');
    setDraftReportDue('');
    setCapaDue('');
    setIsEditMode(false);
    setEditingAuditId(null);
    setCurrentStep(1);
  };

  // Load plan data for editing
  const loadPlanForEdit = (details: any) => {
    // Activate edit mode & initialize edit context
    const auditIdValue = String(details.auditId || details.id || '');
    console.log('📝 loadPlanForEdit called with details:', details);
    console.log('📝 Extracted auditId:', auditIdValue);
    console.log('📝 details.auditId:', details.auditId, 'details.id:', details.id);
    
    setIsEditMode(true);
    setEditingAuditId(auditIdValue);
    setShowForm(true);
    setCurrentStep(1); // Always start from step 1 when editing
    
    console.log('📝 After setting - isEditMode: true, editingAuditId:', auditIdValue);

    // Step 1: Basic info - ensure all values are properly formatted
    const titleValue = details.title || details.audit?.title || '';
    const auditTypeValue = details.type || details.audit?.type || 'Internal';
    const goalValue = details.objective || details.audit?.objective || '';
    
    // Parse dates properly - handle ISO strings and ensure YYYY-MM-DD format
    const startDate = details.startDate || details.audit?.startDate;
    const endDate = details.endDate || details.audit?.endDate;
    
    let periodFromValue = '';
    let periodToValue = '';
    
    if (startDate) {
      try {
        // Handle ISO string format (e.g., "2025-01-15T10:00:00Z")
        if (typeof startDate === 'string' && startDate.includes('T')) {
          periodFromValue = startDate.split('T')[0];
        } else if (typeof startDate === 'string') {
          // Already in YYYY-MM-DD format
          periodFromValue = startDate;
        } else {
          // If it's a Date object or other format, try to convert
          const date = new Date(startDate);
          if (!isNaN(date.getTime())) {
            periodFromValue = date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn('Failed to parse startDate:', startDate, e);
      }
    }
    
    if (endDate) {
      try {
        // Handle ISO string format (e.g., "2025-01-15T10:00:00Z")
        if (typeof endDate === 'string' && endDate.includes('T')) {
          periodToValue = endDate.split('T')[0];
        } else if (typeof endDate === 'string') {
          // Already in YYYY-MM-DD format
          periodToValue = endDate;
        } else {
          // If it's a Date object or other format, try to convert
          const date = new Date(endDate);
          if (!isNaN(date.getTime())) {
            periodToValue = date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn('Failed to parse endDate:', endDate, e);
      }
    }
    
    setTitle(titleValue);
    setAuditType(auditTypeValue);
    setGoal(goalValue);
    setPeriodFrom(periodFromValue);
    setPeriodTo(periodToValue);
    setDrlFileName(details.drlFileName || '');
    setDrlFile(null);
    
    console.log('📝 Step 1 values loaded:', {
      title: titleValue,
      auditType: auditTypeValue,
      goal: goalValue,
      periodFrom: periodFromValue,
      periodTo: periodToValue,
      originalStartDate: startDate,
      originalEndDate: endDate,
    });
    
    // Debug: Check if dates are valid for validation
    if (periodFromValue && periodToValue) {
      const fromDate = new Date(periodFromValue);
      const toDate = new Date(periodToValue);
      const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
      console.log('📝 Date validation check:', {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        daysDiff,
        isValid: !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && daysDiff >= 0,
      });
    }
    
    // Step 2: Scope
    const scope = details.scope || details.audit?.scope;
    if (scope === 'Academy' || (!details.scopeDepartments?.values?.length && !scope)) {
      setLevel('academy');
      setSelectedDeptIds([]);
    } else {
      setLevel('department');
      if (details.scopeDepartments?.values?.length > 0) {
        const deptIds = details.scopeDepartments.values.map((dept: any) => {
          if (typeof dept === 'object' && dept.deptId) return String(dept.deptId);
          if (typeof dept === 'number') return String(dept);
          return String(dept);
        }).filter(Boolean);
        setSelectedDeptIds(deptIds);
      } else {
        setSelectedDeptIds([]);
      }
    }
    
    // Step 3: Template and criteria
    // Template IDs will be loaded by hydrateTemplateSelection in the component
    // But we can set a fallback if templateId exists
    const templateId = details.templateId || details.audit?.templateId;
    if (templateId) {
      setSelectedTemplateIds([String(templateId)]);
    } else {
      setSelectedTemplateIds([]);
    }
    
    if (details.criteria?.values?.length > 0) {
      const criteriaIds = details.criteria.values.map((c: any) => {
        if (typeof c === 'object' && c.criterionId) return String(c.criterionId);
        if (typeof c === 'object' && c.id) return String(c.id);
        if (typeof c === 'object' && c.criteriaId) return String(c.criteriaId);
        return String(c);
      }).filter(Boolean);
      setSelectedCriteriaIds(criteriaIds);
    } else {
      setSelectedCriteriaIds([]);
    }
    
    // Step 4: Team
    console.log('[loadPlanForEdit] Loading audit teams:', details.auditTeams);
    
    // Try multiple ways to get audit teams
    const auditTeamsData = details.auditTeams?.values || 
                           details.auditTeams || 
                           (Array.isArray(details.auditTeams) ? details.auditTeams : []);
    
    console.log('[loadPlanForEdit] Extracted audit teams data:', auditTeamsData);
    
    if (auditTeamsData && auditTeamsData.length > 0) {
      const auditors: string[] = [];
      let leadId = '';
      let ownerId = '';
      
      auditTeamsData.forEach((member: any) => {
        console.log('[loadPlanForEdit] Processing team member:', member);
        
        // Try multiple field names for userId
        const userId = member.userId || 
                      member.id || 
                      member.$id || 
                      member.user?.userId || 
                      member.user?.id ||
                      member.user?.$id;
        
        // Try multiple field names for role
        const role = member.roleInTeam || 
                    member.role || 
                    member.roleName ||
                    member.user?.role ||
                    '';
        
        const isLead = member.isLead || member.isLeadAuditor || false;
        
        console.log('[loadPlanForEdit] Extracted:', { userId, role, isLead });
        
        // Normalize role comparison (case-insensitive)
        const normalizedRole = String(role || '').toLowerCase().trim();
        
        if (normalizedRole === 'auditor' || normalizedRole === '') {
          // If role is empty or 'auditor', treat as auditor
          if (userId) {
            auditors.push(String(userId));
            console.log('[loadPlanForEdit] Added auditor:', userId);
            if (isLead) {
              leadId = String(userId);
              console.log('[loadPlanForEdit] Set as lead:', userId);
            }
          }
        } else if (normalizedRole === 'auditeeowner' || normalizedRole === 'auditee owner') {
          if (userId) {
            ownerId = String(userId);
            console.log('[loadPlanForEdit] Set as owner:', userId);
          }
        }
      });
      
      console.log('[loadPlanForEdit] Final auditors:', auditors);
      console.log('[loadPlanForEdit] Final leadId:', leadId);
      console.log('[loadPlanForEdit] Final ownerId:', ownerId);
      
      setSelectedAuditorIds(auditors);
      setSelectedLeadId(leadId);
      setSelectedOwnerId(ownerId);
    } else {
      console.log('[loadPlanForEdit] No audit teams found, clearing team data');
      setSelectedAuditorIds([]);
      setSelectedLeadId('');
      setSelectedOwnerId('');
    }
    
    // Step 5: Schedules - match exactly with MILESTONE_NAMES
    if (details.schedules?.values?.length > 0) {
      details.schedules.values.forEach((schedule: any) => {
        const name = schedule.milestoneName || schedule.name || '';
        const date = schedule.dueDate ? schedule.dueDate.split('T')[0] : '';
        
        // Match exactly with MILESTONE_NAMES constants
        if (name === MILESTONE_NAMES.KICKOFF || name === 'Kickoff Meeting') {
          setKickoffMeeting(date);
        } else if (name === MILESTONE_NAMES.FIELDWORK || name === 'Fieldwork Start') {
          setFieldworkStart(date);
        } else if (name === MILESTONE_NAMES.EVIDENCE || name === 'Evidence Due') {
          setEvidenceDue(date);
        } else if (name === MILESTONE_NAMES.DRAFT || name === 'Draft Report Due') {
          setDraftReportDue(date);
        } else if (name === MILESTONE_NAMES.CAPA || name === 'CAPA Due') {
          setCapaDue(date);
        }
      });
    } else {
      // Reset schedules if no schedules found
      setKickoffMeeting('');
      setFieldworkStart('');
      setEvidenceDue('');
      setDraftReportDue('');
      setCapaDue('');
    }
  };

  return {
    // Form display
    showForm,
    setShowForm,
    currentStep,
    setCurrentStep,
    
    // Edit mode
    isEditMode,
    setIsEditMode,
    editingAuditId,
    setEditingAuditId,
    
    // Step 1
    title,
    setTitle,
    goal,
    setGoal,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    auditType,
    setAuditType,
    drlFile,
    setDrlFile,
    drlFileName,
    setDrlFileName,
    
    // Step 2
    level,
    setLevel,
    selectedDeptIds,
    setSelectedDeptIds,
    selectedCriteriaIds,
    setSelectedCriteriaIds,
    sensitiveFlag,
    setSensitiveFlag,
    sensitiveAreas,
    setSensitiveAreas,
    sensitiveNotes,
    setSensitiveNotes,
    sensitiveDeptIds,
    setSensitiveDeptIds,
    
    // Step 3
    selectedTemplateIds,
    setSelectedTemplateIds,
    
    // Step 4
    selectedLeadId,
    setSelectedLeadId,
    selectedAuditorIds,
    setSelectedAuditorIds,
    selectedOwnerId,
    setSelectedOwnerId,
    planCreatorId,
    setPlanCreatorId,
    sendDrlToCreator,
    setSendDrlToCreator,
    
    // Step 5
    kickoffMeeting,
    setKickoffMeeting,
    fieldworkStart,
    setFieldworkStart,
    evidenceDue,
    setEvidenceDue,
    draftReportDue,
    setDraftReportDue,
    capaDue,
    setCapaDue,
    
    // Actions
    resetForm,
    resetFormForCreate,
    loadPlanForEdit,
  };
};
