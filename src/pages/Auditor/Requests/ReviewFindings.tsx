import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { getFindingsByCreator, approveFindingAction, returnFindingAction, type Finding } from '../../../api/findings';
import { getActionsByFinding, type Action } from '../../../api/actions';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { useUserId } from '../../../store/useAuthStore';
import { fetchAuditSummaries, type AuditSummary } from '../../../utils/auditSummary';
import { getAuditPlanById } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';
import { AuditDetailsModal } from '../LeadFinalReview/components/AuditDetailsModal';
import type {
  Audit as LeadAudit,
  AuditMetadata,
  Finding as LeadFinding,
} from '../LeadFinalReview/types';

interface ActionWithDetails extends Action {
  attachments: Attachment[];
  assignedUserName?: string;
}

interface FindingWithActions extends Finding {
  actions: ActionWithDetails[];
  findingAttachments: Attachment[];
}

type GroupedAudit = {
  auditId: string;
  summary: AuditSummary | null;
  findings: FindingWithActions[];
};

const buildAuditMetadata = (detail: any): AuditMetadata => {
  const auditNode = detail?.audit || detail || {};

  const departments = unwrap(detail?.scopeDepartments).map((dept: any, idx: number) => ({
    deptId: dept?.deptId ?? `dept_${idx}`,
    name: dept?.deptName || dept?.name || `Department ${idx + 1}`,
    status: dept?.status,
  }));

  const criteria = unwrap(detail?.criteria).map((crit: any, idx: number) => ({
    criteriaId: crit?.criteriaId || crit?.id || `criteria_${idx}`,
    name: crit?.criteriaName || crit?.name || `Criterion ${idx + 1}`,
    status: crit?.status,
  }));

  const schedules = unwrap(detail?.schedules).map((schedule: any, idx: number) => ({
    scheduleId: schedule?.scheduleId || schedule?.id || `schedule_${idx}`,
    milestoneName: schedule?.milestoneName || schedule?.name || `Milestone ${idx + 1}`,
    dueDate: schedule?.dueDate,
    status: schedule?.status,
    notes: schedule?.notes,
  }));

  const team = unwrap(detail?.auditTeams).map((member: any, idx: number) => ({
    userId: member?.userId,
    name: member?.fullName || member?.name || `Member ${idx + 1}`,
    roleInTeam: member?.roleInTeam,
    isLead: member?.isLead,
    email: member?.email,
  }));

  return {
    auditId: auditNode?.auditId || auditNode?.id || detail?.auditId || '',
    title: auditNode?.title || auditNode?.auditTitle || detail?.title || '',
    type: auditNode?.type || detail?.type || '',
    scope: auditNode?.scope || detail?.scope || '',
    objective: auditNode?.objective || detail?.objective || '',
    startDate: auditNode?.startDate || auditNode?.periodFrom || detail?.startDate || detail?.periodFrom,
    endDate: auditNode?.endDate || auditNode?.periodTo || detail?.endDate || detail?.periodTo,
    status: auditNode?.status || detail?.status || '',
    createdByName:
      detail?.createdBy?.fullName ||
      detail?.createdByUser?.fullName ||
      auditNode?.createdBy?.fullName ||
      auditNode?.createdByUser?.fullName ||
      '',
    createdByEmail:
      detail?.createdBy?.email ||
      detail?.createdByUser?.email ||
      auditNode?.createdBy?.email ||
      auditNode?.createdByUser?.email ||
      '',
    createdAt: auditNode?.createdAt || detail?.createdAt || '',
    departments,
    criteria,
    team,
    schedules,
  };
};

const ReviewFindings = () => {
  const userId = useUserId();
  const [findings, setFindings] = useState<FindingWithActions[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, _setFilter] = useState<'all' | 'pending' | 'approved' | 'returned'>('all');
  const [selectedAction, setSelectedAction] = useState<ActionWithDetails | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'return'>('approve');
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);
  const [auditSummaries, setAuditSummaries] = useState<Record<string, AuditSummary>>({});
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [modalAudit, setModalAudit] = useState<LeadAudit | null>(null);
  const [modalFindings, setModalFindings] = useState<LeadFinding[]>([]);
  const [modalAuditDetail, setModalAuditDetail] = useState<AuditMetadata | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);
  const [query, setQuery] = useState('');

  const fetchFindings = async () => {
    console.log('[ReviewFindings] Current userId:', userId);
    
    if (!userId) {
      toast.error('User information not found');
      console.error('[ReviewFindings] userId is missing');
      return;
    }

    setLoading(true);
    try {
      // Get findings created by this auditor
      const findingsData = await getFindingsByCreator(userId);

      // Fetch actions and attachments for each finding
      const findingsWithActions = await Promise.all(
        findingsData.map(async (finding) => {
          try {
            const actions = await getActionsByFinding(finding.findingId);
            console.log(`[ReviewFindings] Finding ${finding.findingId} actions:`, actions);

            // Get finding attachments
            const findingAttachments = await getAttachments('finding', finding.findingId);

            // Fetch user names and attachments for each action
            const actionsWithDetails = await Promise.all(
              actions.map(async (action) => {
                let assignedUserName = action.assignedTo;
                const attachments = await getAttachments('Action', action.actionId).catch(() => []);

                // Fetch user name if GUID
                if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  try {
                    const userInfo = await getUserById(action.assignedTo);
                    assignedUserName = userInfo.fullName || userInfo.email || action.assignedTo;
                  } catch (err) {
                    console.warn('Failed to fetch user', err);
                  }
                }

                return { ...action, attachments, assignedUserName };
              })
            );

            return {
              ...finding,
              actions: actionsWithDetails,
              findingAttachments,
            };
          } catch (err) {
            console.error(`Error fetching finding ${finding.findingId}`, err);
            return {
              ...finding,
              actions: [],
              findingAttachments: [],
            };
          }
        })
      );

      setFindings(findingsWithActions);
      const uniqueAuditIds = Array.from(
        new Set(findingsWithActions.map(f => f.auditId).filter((id): id is string => !!id))
      );
      if (uniqueAuditIds.length > 0) {
        fetchAuditSummaries(uniqueAuditIds)
          .then(result => {
            if (Object.keys(result).length > 0) {
              setAuditSummaries(prev => ({ ...prev, ...result }));
            }
          })
          .catch(err => {
            console.warn('[ReviewFindings] Failed to load audit summaries', err);
          });
      }
    } catch (err: any) {
      console.error('Failed to fetch findings', err);
      toast.error('Unable to load findings list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [userId]);

  const handleApproveClick = (action: ActionWithDetails) => {
    setSelectedAction(action);
    setFeedbackType('approve');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const handleReturnClick = (action: ActionWithDetails) => {
    setSelectedAction(action);
    setFeedbackType('return');
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setSelectedAction(null);
    setFeedback('');
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAction) return;

    if (feedbackType === 'return' && !feedback.trim()) {
      toast.error('Please enter feedback when returning an action');
      return;
    }

    setProcessing(true);
    try {
      if (feedbackType === 'approve') {
        await approveFindingAction(selectedAction.actionId, feedback);
        toast.success('Action approved successfully!');
      } else {
        await returnFindingAction(selectedAction.actionId, feedback);
        toast.success('Action sent back for updates!');
      }

      closeFeedbackModal();
      // Refresh findings data - useEffect will automatically update modal findings
      await fetchFindings();
    } catch (err: any) {
      console.error('Failed to process action', err);
      toast.error(err?.response?.data?.message || 'Unable to process action');
    } finally {
      setProcessing(false);
    }
  };

  // Filter findings based on action status
  const filteredFindings = findings.filter(finding => {
    if (filter === 'all') return true;
    return finding.actions.some(action => {
      if (filter === 'pending') return action.status === 'Verified'; // Verified by AuditeeOwner, pending Auditor review
      if (filter === 'approved') return action.status === 'Approved'; // Approved by Auditor, pending Lead Auditor review
      if (filter === 'returned') return action.status === 'Returned';
      return false;
    });
  });

  const groupedAudits = useMemo<GroupedAudit[]>(() => {
    const groups = new Map<string, GroupedAudit>();

    filteredFindings.forEach(finding => {
      const key = finding.auditId || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          auditId: key,
          summary: (finding.auditId && auditSummaries[finding.auditId]) || null,
          findings: [],
        });
      }
      groups.get(key)!.findings.push(finding);
    });

    return Array.from(groups.values());
  }, [filteredFindings, auditSummaries]);

  const openAuditModal = async (group: GroupedAudit) => {
    if (!group.auditId) return;
    setModalAudit({
      auditId: group.auditId,
      title: group.summary?.title || group.auditId,
      status: group.summary?.status || '-',
    });
    setModalFindings(group.findings as LeadFinding[]);
    setAuditModalOpen(true);
    setLoadingAuditDetail(true);
    try {
      const res = await getAuditPlanById(group.auditId);
      const detail = res?.data?.data ?? res?.data ?? res;
      setModalAuditDetail(buildAuditMetadata(detail));
    } catch (err) {
      console.warn('Failed to load audit detail', group.auditId, err);
      setModalAuditDetail(null);
    } finally {
      setLoadingAuditDetail(false);
    }
  };

  const closeAuditModal = () => {
    setAuditModalOpen(false);
    setModalAudit(null);
    setModalAuditDetail(null);
    setModalFindings([]);
  };

  // Update modal findings from current findings state
  const updateModalFindings = useCallback(() => {
    if (!modalAudit) return;
    const auditFindings = findings.filter(f => f.auditId === modalAudit.auditId);
    setModalFindings(auditFindings as LeadFinding[]);
  }, [findings, modalAudit]);

  // Auto-update modal findings when findings state changes (e.g., after approve/reject)
  useEffect(() => {
    if (auditModalOpen && modalAudit && findings.length > 0) {
      updateModalFindings();
    }
  }, [findings, auditModalOpen, modalAudit, updateModalFindings]);

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Review Findings</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Review and approve actions from auditees</p>
          </div>
        </div>

        {/* Filters */}
        {/* <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Pending ({_stats.pending})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Approved ({_stats.approved})
          </button>
          <button
            onClick={() => setFilter('returned')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              filter === 'returned' ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Returned ({_stats.returned})
          </button>
        </div> */}

<div className="mb-4 flex items-center gap-4">
          <input
            className="border rounded px-3 py-2 flex-1"
            placeholder="Search audits by name or ID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
      
        </div>
        {/* Audits list */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Audits</h2>
            <span className="text-xs text-gray-500">{groupedAudits.length} records</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading data...</div>
          ) : groupedAudits.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No data available</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {groupedAudits.map(group => (
                <div key={group.auditId} className="p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                          {group.summary?.title || group.auditId}
                        </h3>
                        {group.summary?.status && (
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                            {group.summary.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Type: {group.summary?.type || '-'} • Scope: {group.summary?.scope || '-'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Findings: <span className="font-medium text-gray-900">{group.findings.length}</span>
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => openAuditModal(group)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded"
                      >
                        View 
                      </button>
                    </div>
                  </div>

                  {/* <div className="space-y-3">
                    {group.findings.map(finding => (
                      <div key={finding.findingId} className="border border-gray-100 rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{finding.title}</span>
                              {_getStatusBadge(finding.status)}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{finding.description}</p>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <p>Severity: <span className="font-medium">{finding.severity}</span></p>
                              <p>Deadline: <span className="font-medium">{_formatDate(finding.deadline || '')}</span></p>
                            </div>
                          </div>
                          <button
                            onClick={() => _handleViewDetail(finding.findingId)}
                            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                          >
                            View detail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div> */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <AuditDetailsModal
        open={auditModalOpen && !!modalAudit}
        audit={modalAudit || { auditId: '', title: '' }}
        auditDetail={modalAuditDetail || null}
        findings={modalFindings}
        loading={false}
        loadingAuditDetail={loadingAuditDetail}
        processingAction={processing}
        onClose={closeAuditModal}
        onActionDecision={(action, type) => {
          if (type === 'approve') {
            handleApproveClick(action as ActionWithDetails);
          } else {
            handleReturnClick(action as ActionWithDetails);
          }
        }}
        showActionControls={true}
        auditorMode={true}
      />

      {/* Feedback Modal */}
      {showFeedbackModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              {feedbackType === 'approve' ? '✓ Approve Action' : '↩ Return Action'}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Action: {selectedAction.title}</p>
              <p className="text-xs text-gray-600">{selectedAction.description}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {feedbackType === 'return' ? 'Feedback (required)' : 'Feedback (optional)'}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder={feedbackType === 'return' 
                  ? 'Enter a reason for returning the action...' 
                  : 'Enter feedback if needed...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleSubmitFeedback}
                disabled={processing || (feedbackType === 'return' && !feedback.trim())}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  feedbackType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processing ? 'Processing...' : feedbackType === 'approve' ? 'Confirm approval' : 'Confirm return'}
              </button>
              <button
                onClick={closeFeedbackModal}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ReviewFindings;
