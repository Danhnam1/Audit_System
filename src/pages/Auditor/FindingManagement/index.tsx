import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { StatCard } from '../../../components';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FindingList,
  InterviewObservationModal,
  ImmediateActionModal,
} from './Components';
import type {
  InterviewLog,
  ImmediateAction,
  FindingRecord,
} from './Components/types';
import { useAuditFindings } from '../../../hooks/useAuditFindings';
import { getFindings } from '../../../api/findings';

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedAudit, setSelectedAudit] = useState('all');
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Use the audit findings hook to get audit plans
  const {
    loading: loadingAudits,
    error: auditsError,
    auditPlans,
    fetchAuditPlans,
  } = useAuditFindings();

  // Load audit plans and findings on mount
  useEffect(() => {
    fetchAuditPlans();
    loadFindings();
  }, [fetchAuditPlans]);

  // Load findings from API
  const loadFindings = async () => {
    try {
      const data = await getFindings();
      
      // Transform API findings to match FindingRecord format
      const transformedFindings: FindingRecord[] = (Array.isArray(data) ? data : []).map((f: any) => ({
        id: f.findingId || f.id,
        auditId: f.auditId,
        title: f.title,
        severity: f.severity || 'Medium',
        category: f.category || 'General',
        description: f.description,
        status: f.status || 'Open',
        reportedDate: f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        dueDate: f.deadline ? new Date(f.deadline).toISOString().slice(0, 10) : '',
      }));
      
      setFindings(transformedFindings);
    } catch (error) {
      console.error('Error loading findings:', error);
    }
  };

  // -------- Interview & Immediate Action --------

  // New features - Interview/Observation Logger, Immediate Action, Daily Wrap-up
  // Types moved to ./types

  const [interviewLogs, setInterviewLogs] = useState<InterviewLog[]>([]);
  const [immediateActions, setImmediateActions] = useState<ImmediateAction[]>([]);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showImmediateActionModal, setShowImmediateActionModal] = useState(false);
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

  // No form state needed - handled in detail page

  const openChecklist = (auditPlan: any) => {
    // Navigate to detail page for execution
    navigate(`/auditor/findings/${auditPlan.auditId}`);
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

  // Using imported functions from constants
  const getSeverityColor = (severity: string) => {
    const severityMap: Record<string, string> = {
      'High': 'bg-primary-900 text-white border border-primary-900',
      'Medium': 'bg-primary-600 text-white border border-primary-600',
      'Low': 'bg-primary-300 text-primary-900 border border-primary-300',
    };
    return severityMap[severity] || 'bg-gray-100 text-gray-700 border border-gray-300';
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
    <MainLayout user={layoutUser}>
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

        {/* Loading State */}
        {loadingAudits && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit plans...</p>
          </div>
        )}
        
        {/* Error State */}
        {auditsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">Error loading audits: {auditsError}</p>
            <button
              onClick={() => fetchAuditPlans()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Audit Plans & Findings List */}
        {!loadingAudits && !auditsError && (
          <div className="space-y-6">
            {/* Available Audit Plans for Execution */}
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
                <h2 className="text-lg font-semibold text-white">Available Audit Plans</h2>
                <p className="text-sm text-white opacity-90 mt-1">Select an audit plan to start checklist execution</p>
              </div>
              
              <div className="p-6">
                {auditPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">No audit plans available</p>
                    <p className="text-sm text-gray-400 mt-1">Audit plans will appear here when created</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {auditPlans.map((plan) => (
                      <div
                        key={plan.auditId}
                        className="border border-gray-200 rounded-lg p-4 hover:border-primary-400 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => openChecklist(plan)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {plan.title || plan.name || 'Untitled Audit'}
                          </h3>
                          <span className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-700">
                            {plan.status || 'Active'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          {plan.auditId}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{plan.departmentName || plan.department || 'N/A'}</span>
                          <button
                            className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs font-medium"
                          >
                            Start Audit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Existing Findings List */}
            <FindingList
              checklistTemplates={[]}
              openChecklist={openChecklist}
              audits={auditPlans.map(p => ({ id: p.auditId, title: p.title || p.name || 'Untitled' }))}
              selectedAudit={selectedAudit}
              setSelectedAudit={setSelectedAudit}
              filteredFindings={filteredFindings}
              getSeverityColor={getSeverityColor}
              onOpenInterview={openInterviewModal}
              onOpenImmediateAction={openImmediateActionModal}
            />
          </div>
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
