import { useState } from 'react';

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

  // Step 1: Basic Information
  const [title, setTitle] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');
  const [auditType, setAuditType] = useState<string>('Internal');

  // Step 2: Scope
  const [level, setLevel] = useState<string>('academy');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>([]);

  // Step 3: Checklist
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Step 4: Team
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

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
  };

  // Reset form fields for creating a new plan (keeps form open)
  const resetFormForCreate = () => {
    setTitle('');
    setAuditType('Internal');
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
    setCurrentStep(1);
  };

  // Load plan data for editing
  const loadPlanForEdit = (details: any) => {
    // Activate edit mode & initialize edit context
    setIsEditMode(true);
    setEditingAuditId(String(details.auditId || details.id || ''));
    setShowForm(true);
    setCurrentStep(1);

    // Step 1: Basic info
    setTitle(details.title || '');
    setAuditType(details.type || 'Internal');
    setGoal(details.objective || '');
    setPeriodFrom(details.startDate ? details.startDate.split('T')[0] : '');
    setPeriodTo(details.endDate ? details.endDate.split('T')[0] : '');
    
    // Step 2: Scope
    if (details.scope === 'Academy' || (!details.scopeDepartments?.values?.length && !details.scope)) {
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
      }
    }
    
    // Step 3: Template and criteria
    if (details.templateId) {
      setSelectedTemplateId(details.templateId);
    }
    
    if (details.criteria?.values?.length > 0) {
      const criteriaIds = details.criteria.values.map((c: any) => {
        if (typeof c === 'object' && c.criterionId) return String(c.criterionId);
        if (typeof c === 'object' && c.id) return String(c.id);
        return String(c);
      });
      setSelectedCriteriaIds(criteriaIds);
    }
    
    // Step 4: Team
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
    
    // Step 2
    level,
    setLevel,
    selectedDeptIds,
    setSelectedDeptIds,
    selectedCriteriaIds,
    setSelectedCriteriaIds,
    
    // Step 3
    selectedTemplateId,
    setSelectedTemplateId,
    
    // Step 4
    selectedLeadId,
    setSelectedLeadId,
    selectedAuditorIds,
    setSelectedAuditorIds,
    selectedOwnerId,
    setSelectedOwnerId,
    
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
