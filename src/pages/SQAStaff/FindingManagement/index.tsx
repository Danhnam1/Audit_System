import { MainLayout, DashboardIcon, AuditIcon, DocumentIcon, ReportsIcon, RequestIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { StatCard } from '../../../components';
import { useState } from 'react';
import {
  FindingList,
  StartExecution,
  CreateFindingModal,
  InterviewObservationModal,
  ImmediateActionModal,
} from './Components';
import type {
  ChecklistTemplate,
  ChecklistItem,
  FindingDraft,
  ResultType,
  InterviewLog,
  ImmediateAction,
  FindingRecord,
} from './Components/types';

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const [selectedAudit, setSelectedAudit] = useState('all');

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-staff' },
    { icon: <AuditIcon />, label: 'Audit Planning', path: '/sqa-staff/planning' },
    { icon: <DocumentIcon />, label: 'Finding Management', path: '/sqa-staff/findings' },
    { icon: <ReportsIcon />, label: 'Reports', path: '/sqa-staff/reports', badge: '3' },
    { icon: <RequestIcon />, label: 'Requests', path: '/sqa-staff/requests', badge: '5' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const audits = [
    { id: 'AUD-2025-001', title: 'Annual Safety Audit' },
    { id: 'AUD-2025-002', title: 'Maintenance Quality Check' },
    { id: 'AUD-2025-003', title: 'Training Compliance Review' },
  ];

  // Types moved to ./types

  const initialFindings: FindingRecord[] = [
    {
      id: 'FND-001',
      auditId: 'AUD-2025-001',
      title: 'Missing Safety Training Records',
      severity: 'High',
      category: 'Documentation',
      description: 'Safety training certificates for 5 pilots not found in system',
      status: 'Open',
      reportedDate: '2025-10-22',
      dueDate: '2025-11-15',
    },
    {
      id: 'FND-002',
      auditId: 'AUD-2025-001',
      title: 'Non-compliant Fire Extinguisher Placement',
      severity: 'Medium',
      category: 'Safety Equipment',
      description: 'Fire extinguishers in Hangar B not positioned per ISO standards',
      status: 'In Progress',
      reportedDate: '2025-10-21',
      dueDate: '2025-11-10',
    },
    {
      id: 'FND-003',
      auditId: 'AUD-2025-002',
      title: 'Outdated Maintenance Manual Version',
      severity: 'Low',
      category: 'Documentation',
      description: 'Maintenance team using manual version 2.1 instead of 3.0',
      status: 'Resolved',
      reportedDate: '2025-10-18',
      dueDate: '2025-11-05',
    },
    {
      id: 'FND-004',
      auditId: 'AUD-2025-002',
      title: 'Incomplete Tool Calibration Records',
      severity: 'High',
      category: 'Process',
      description: '12 tools missing calibration certificates from last quarter',
      status: 'Open',
      reportedDate: '2025-10-17',
      dueDate: '2025-11-12',
    },
  ];

  const [findings, setFindings] = useState<FindingRecord[]>(initialFindings);

  // -------- Checklist & Execution Flow --------
  // Types moved to ./types

  // Mock checklist templates
  const checklistTemplates: ChecklistTemplate[] = [
    {
      id: 'CL-001',
      code: 'GS-ANNUAL-2025',
      name: 'Ground Service Annual Audit',
      auditType: 'Annual Safety Audit',
      department: 'Ground Operations',
      totalItems: 5,
      createdDate: '2025-01-15',
      status: 'Active',
    },
    {
      id: 'CL-002',
      code: 'MNT-Q1-2025',
      name: 'Maintenance Quality Check Q1',
      auditType: 'Maintenance Quality Check',
      department: 'Maintenance',
      totalItems: 15,
      createdDate: '2025-02-01',
      status: 'Active',
    },
    {
      id: 'CL-003',
      code: 'TRN-COMP-2025',
      name: 'Training Compliance Review',
      auditType: 'Training Compliance Review',
      department: 'Training',
      totalItems: 5,
      createdDate: '2025-03-10',
      status: 'Active',
    },
  ];

  const [viewMode, setViewMode] = useState<'list' | 'execute'>('list');
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistTemplate | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [findingDrafts, setFindingDrafts] = useState<FindingDraft[]>([]);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [currentItemForFinding, setCurrentItemForFinding] = useState<ChecklistItem | null>(null);

  // New features - Interview/Observation Logger, Immediate Action, Daily Wrap-up
  // Types moved to ./types

  const [interviewLogs, setInterviewLogs] = useState<InterviewLog[]>([]);
  const [immediateActions, setImmediateActions] = useState<ImmediateAction[]>([]);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showImmediateActionModal, setShowImmediateActionModal] = useState(false);
  const [showDailyWrapUp, setShowDailyWrapUp] = useState(false);
  const [currentFindingForIA, setCurrentFindingForIA] = useState<FindingRecord | null>(null);
  const [currentFindingForInterview, setCurrentFindingForInterview] = useState<FindingRecord | null>(null);

  const [newInterview, setNewInterview] = useState<Omit<InterviewLog, 'id' | 'date'>>({
    type: 'Interview',
    findingRef: '',
    personRole: '',
    summary: '',
    attachments: [],
    linkToItem: '',
  });

  const [newIA, setNewIA] = useState<Omit<ImmediateAction, 'id' | 'status' | 'createdDate'>>({
    findingRef: '',
    action: '',
    owner: '',
    dueDateTime: '',
  });

  // Form state for creating finding
  const [newFinding, setNewFinding] = useState<FindingDraft>({
    checklistItemId: 0,
    findingType: 'Major',
    title: '',
    description: '',
    rootCause: '',
  });

  const initChecklistItems = (): ChecklistItem[] => ([
    {
      id: 1,
      item: 'Ground staff wear proper uniform and ID badge',
      standardRef: 'SOP-GS-01',
      category: 'Safety / Appearance',
      criticality: 'Medium',
      result: null,
      remarks: '',
    },
    {
      id: 2,
      item: 'Check-in counter clean and properly labeled',
      standardRef: 'SOP-GS-02',
      category: 'Facility',
      criticality: 'Low',
      result: null,
      remarks: '',
    },
    {
      id: 3,
      item: 'SOP documents displayed at work area',
      standardRef: 'SOP-GS-03',
      category: 'Documentation',
      criticality: 'Low',
      result: null,
      remarks: '',
    },
    {
      id: 4,
      item: 'Emergency equipment accessible and labeled',
      standardRef: 'SOP-GS-04',
      category: 'Safety Equipment',
      criticality: 'High',
      result: null,
      remarks: '',
    },
    {
      id: 5,
      item: 'Fire extinguisher inspection up to date',
      standardRef: 'SOP-GS-05',
      category: 'Safety Equipment',
      criticality: 'High',
      result: null,
      remarks: '',
    },
  ]);

  const openChecklist = (template: ChecklistTemplate) => {
    setSelectedChecklist(template);
    setChecklist(initChecklistItems());
    setFindingDrafts([]);
    setViewMode('execute');
  };

  const closeChecklist = () => {
    setViewMode('list');
    setSelectedChecklist(null);
    setChecklist([]);
    setFindingDrafts([]);
  };

  const setItemResult = (id: number, result: ResultType) => {
    setChecklist(prev => prev.map(it => it.id === id ? { ...it, result } : it));
  };

  const setItemRemarks = (id: number, remarks: string) => {
    setChecklist(prev => prev.map(it => it.id === id ? { ...it, remarks } : it));
  };

  const openFindingModal = (item: ChecklistItem) => {
    setCurrentItemForFinding(item);
    setNewFinding({
      checklistItemId: item.id,
      findingType: 'Major',
      title: `Non-compliance: ${item.item}`,
      description: '',
      rootCause: '',
    });
    setShowFindingModal(true);
  };

  const closeFindingModal = () => {
    setShowFindingModal(false);
    setCurrentItemForFinding(null);
  };

  const saveFinding = () => {
    if (!newFinding.description.trim()) {
      alert('Please enter finding description');
      return;
    }
    setFindingDrafts(prev => [...prev, { ...newFinding }]);
    // Auto-mark item as Non-compliant
    setItemResult(newFinding.checklistItemId, 'Non-compliant');
    closeFindingModal();
    alert('Finding created successfully!');
  };

  const submitExecution = () => {
    const unchecked = checklist.filter(it => !it.result);
    if (unchecked.length > 0) {
      alert(`Please complete all checklist items. ${unchecked.length} item(s) remaining.`);
      return;
    }
    
    // Here you will call API to submit
    // For now, add findings to main list
    const created = findingDrafts.map((draft, idx) => {
      const item = checklist.find(it => it.id === draft.checklistItemId);
      const nextNum = findings.length + idx + 1;
      const id = `FND-${String(nextNum).padStart(3, '0')}`;
      const today = new Date();
      const addDays = (d: number) => {
        const dt = new Date(today);
        dt.setDate(dt.getDate() + d);
        return dt.toISOString().slice(0,10);
      };
      return {
        id,
        auditId: selectedAudit === 'all' ? selectedChecklist?.id || 'AUD-UNKNOWN' : selectedAudit,
        title: draft.title,
        severity: item?.criticality || 'Medium' as 'Low' | 'Medium' | 'High',
        category: item?.category || 'General',
        description: draft.description,
        status: 'Open' as const,
        reportedDate: today.toISOString().slice(0,10),
        dueDate: addDays(14),
      };
    });
    
    if (created.length > 0) {
      setFindings(prev => [...prev, ...created]);
    }
    
    alert(`Execution submitted! ${created.length} finding(s) created.`);
    closeChecklist();
  };

  // New feature handlers
  const openInterviewModal = (finding: FindingRecord) => {
    setCurrentFindingForInterview(finding);
    setNewInterview({
      type: 'Interview',
      findingRef: finding.id,
      personRole: '',
      summary: '',
      attachments: [],
      linkToItem: '',
    });
    setShowInterviewModal(true);
  };

  const saveInterviewLog = () => {
    if (!newInterview.personRole.trim() || !newInterview.summary.trim()) {
      alert('Please fill Person/Role and Summary');
      return;
    }
    const log: InterviewLog = {
      id: `INT-${String(interviewLogs.length + 1).padStart(3, '0')}`,
      ...newInterview,
      date: new Date().toISOString().slice(0, 10),
    };
    setInterviewLogs(prev => [...prev, log]);
    setNewInterview({
      type: 'Interview',
      findingRef: '',
      personRole: '',
      summary: '',
      attachments: [],
      linkToItem: '',
    });
    setShowInterviewModal(false);
    setCurrentFindingForInterview(null);
    alert('Interview/Observation logged successfully as evidence for Finding!');
  };

  const openImmediateActionModal = (finding: FindingRecord) => {
    setCurrentFindingForIA(finding);
    setNewIA({
      findingRef: finding.id,
      action: '',
      owner: '',
      dueDateTime: '',
    });
    setShowImmediateActionModal(true);
  };

  const saveImmediateAction = () => {
    if (!newIA.action.trim() || !newIA.owner.trim() || !newIA.dueDateTime) {
      alert('Please fill all required fields');
      return;
    }

    // Check due date is within 72h
    const due = new Date(newIA.dueDateTime);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diff > 72 || diff < 0) {
      alert('Due date must be within 72 hours from now');
      return;
    }

    const ia: ImmediateAction = {
      id: `IA-${String(immediateActions.length + 1).padStart(3, '0')}`,
      ...newIA,
      status: 'Open',
      createdDate: new Date().toISOString().slice(0, 10),
    };
    setImmediateActions(prev => [...prev, ia]);
    setShowImmediateActionModal(false);
    setCurrentFindingForIA(null);
    alert('Immediate Action created successfully!');
  };

  const generateDailyWrapUp = () => {
    const today = new Date().toISOString().slice(0, 10);
    // Get ALL findings created today (from main findings list, not just drafts)
    const todayFindings = findings.filter(f => f.reportedDate === today);
    const majorCount = todayFindings.filter(f => f.severity === 'High').length;
    const todayIA = immediateActions.filter(ia => ia.createdDate === today);
    const todayInterviews = interviewLogs.filter(log => log.date === today);

    return {
      date: today,
      itemsChecked: checklist.filter(it => it.result).length,
      totalItems: checklist.length,
      findings: todayFindings.length,
      majorFindings: majorCount,
      immediateActions: todayIA.length,
      interviewsObservations: todayInterviews.length,
    };
  };


  // Using imported functions from constants
  // Severity uses Priority colors - now returns border class with primary colors
  const getSeverityColor = (severity: string) => {
    // Map severity to priority colors using primary system
    const severityMap: Record<string, string> = {
      'High': 'bg-primary-900 text-white border border-primary-900',
      'Medium': 'bg-primary-600 text-white border border-primary-600',
      'Low': 'bg-primary-300 text-primary-900 border border-primary-300',
    };
    return severityMap[severity] || 'bg-gray-100 text-gray-700 border border-gray-300';
  };

  // Criticality badge colors using primary theme
  const getCriticalityColor = (criticality: string) => {
    const criticalityMap: Record<string, string> = {
      'High': 'bg-primary-900 text-white',
      'Medium': 'bg-primary-600 text-white',
      'Low': 'bg-primary-200 text-primary-800',
    };
    return criticalityMap[criticality] || 'bg-gray-100 text-gray-700';
  };

  // Finding Type badge colors using primary theme
  const getFindingTypeColor = (type: string) => {
    const typeMap: Record<string, string> = {
      'Major': 'bg-primary-900 text-white',
      'Minor': 'bg-primary-600 text-white',
      'Observation': 'bg-primary-300 text-primary-900',
    };
    return typeMap[type] || 'bg-gray-100 text-gray-700';
  };

  const filteredFindings = selectedAudit === 'all' 
    ? findings 
    : findings.filter(f => f.auditId === selectedAudit);

  const stats = {
    total: findings.length,
    open: findings.filter(f => f.status === 'Open').length,
    inProgress: findings.filter(f => f.status === 'In Progress').length,
    resolved: findings.filter(f => f.status === 'Resolved').length,
  };

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Finding Management</h1>
          <p className="text-gray-600 text-sm mt-1">Execute checklists and manage audit findings</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Findings"
            value={stats.total}
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Open"
            value={stats.open}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-dark"
          />
        </div>

        {/* VIEW MODE: Execute Checklist */}
        {viewMode === 'execute' && selectedChecklist && (
          <StartExecution
            selectedChecklist={selectedChecklist}
            checklist={checklist}
            findingDrafts={findingDrafts}
            showDailyWrapUp={showDailyWrapUp}
            setShowDailyWrapUp={setShowDailyWrapUp}
            immediateActions={immediateActions}
            generateDailyWrapUp={generateDailyWrapUp}
            setItemResult={setItemResult}
            setItemRemarks={setItemRemarks}
            openFindingModal={openFindingModal}
            closeChecklist={closeChecklist}
            submitExecution={submitExecution}
            getCriticalityColor={getCriticalityColor}
            getFindingTypeColor={getFindingTypeColor}
          />
        )}

        {/* VIEW MODE: List Checklists */}
        {viewMode === 'list' && (
          <FindingList
            checklistTemplates={checklistTemplates}
            openChecklist={openChecklist}
            audits={audits}
            selectedAudit={selectedAudit}
            setSelectedAudit={setSelectedAudit}
            filteredFindings={filteredFindings}
            getSeverityColor={getSeverityColor}
            onOpenInterview={openInterviewModal}
            onOpenImmediateAction={openImmediateActionModal}
          />
        )}

        {/* CREATE FINDING MODAL */}
        {showFindingModal && (
          <CreateFindingModal
            visible={showFindingModal}
            currentItemForFinding={currentItemForFinding}
            newFinding={newFinding}
            setNewFinding={setNewFinding}
            onClose={closeFindingModal}
            onSave={saveFinding}
            getCriticalityColor={getCriticalityColor}
          />
        )}

        {/* Interview / Observation Logger Modal */}
        {showInterviewModal && (
          <InterviewObservationModal
            visible={showInterviewModal}
            currentFinding={currentFindingForInterview}
            newInterview={newInterview}
            setNewInterview={setNewInterview}
            onClose={() => setShowInterviewModal(false)}
            onSave={saveInterviewLog}
          />
        )}

        {/* Immediate Action Modal */}
        {showImmediateActionModal && (
          <ImmediateActionModal
            visible={showImmediateActionModal}
            currentFinding={currentFindingForIA}
            newIA={newIA}
            setNewIA={setNewIA}
            onClose={() => { setShowImmediateActionModal(false); setCurrentFindingForIA(null); }}
            onSave={saveImmediateAction}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffFindingManagement;
