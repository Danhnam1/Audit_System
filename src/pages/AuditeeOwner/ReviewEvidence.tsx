import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MainLayout } from '../../layouts';
import { getFindingsByDepartment, type Finding } from '../../api/findings';
import { getActionsByFinding, approveActionWithFeedback, rejectAction, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { useDeptId } from '../../store/useAuthStore';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';
import { fetchAuditSummaries, type AuditSummary } from '../../utils/auditSummary';
import { getAuditPlanById } from '../../api/audits';
import { getDepartments } from '../../api/departments';
import { AuditDetailsModal } from '../Auditor/LeadFinalReview/components/AuditDetailsModal';
import type { AuditMetadata, Finding as FindingType, ActionWithDetails } from '../Auditor/LeadFinalReview/types';

type GroupedAudit = {
  auditId: string;
  summary: AuditSummary | null;
  findings: FindingWithDetails[];
};

interface ActionWithUserName extends Action {
  assignedUserName?: string;
}

interface FindingWithDetails extends Finding {
  actions: ActionWithUserName[];
  findingAttachments: Attachment[];
  actionAttachments: Record<string, Attachment[]>; // actionId -> attachments
}

const isGuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const normalizeArray = (payload: any) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload.$values && Array.isArray(payload.$values)) return payload.$values;
  if (payload.values && Array.isArray(payload.values)) return payload.values;
  return [];
};

const ReviewEvidence = () => {
  const deptId = useDeptId();
  const [findings, setFindings] = useState<FindingWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditSummaries, setAuditSummaries] = useState<Record<string, AuditSummary>>({});
  const [query, setQuery] = useState('');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [modalAudit, setModalAudit] = useState<{ auditId: string; title: string } | null>(null);
  const [modalFindings, setModalFindings] = useState<FindingType[]>([]);
  const [modalAuditDetail, setModalAuditDetail] = useState<AuditMetadata | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);
  const [departmentsLookup, setDepartmentsLookup] = useState<Record<string, string>>({});
  const userNameCacheRef = useRef<Record<string, string>>({});
  
  // State for approve/reject actions
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionWithDetails | null>(null);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'reject'>('approve');
  const [feedbackValue, setFeedbackValue] = useState('');

  // Fetch findings with all related data
  const fetchFindings = async () => {
    if (!deptId) {
      toast.error('Department information not found');
      return;
    }

    setLoading(true);
    try {
      // 1. Get all findings for department
      const findingsData = await getFindingsByDepartment(deptId);

      // 2. For each finding, fetch actions and attachments
      const findingsWithDetails = await Promise.all(
        findingsData.map(async (finding) => {
          try {
            // Get actions for this finding
            const actions = await getActionsByFinding(finding.findingId);
            
            // Fetch user names for actions
            const actionsWithUserNames = await Promise.all(
              actions.map(async (action) => {
                let assignedUserName = action.assignedTo;
                if (action.assignedTo && action.assignedTo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  try {
                    const user = await getUserById(action.assignedTo);
                    assignedUserName = user.fullName || user.email || action.assignedTo;
                  } catch (err) {
                    console.warn(`Failed to fetch user info for ${action.assignedTo}`, err);
                  }
                }
                return { ...action, assignedUserName };
              })
            );

            // Get finding attachments
            const findingAttachments = await getAttachments('finding', finding.findingId);

            // Get attachments for each action
            const actionAttachments: Record<string, Attachment[]> = {};
            for (const action of actionsWithUserNames) {
              try {
                const attachments = await getAttachments('Action', action.actionId);
                actionAttachments[action.actionId] = attachments;
              } catch (err) {
                console.warn(`Failed to fetch attachments for action ${action.actionId}`, err);
                actionAttachments[action.actionId] = [];
              }
            }

            return {
              ...finding,
              actions: actionsWithUserNames,
              findingAttachments,
              actionAttachments,
            };
          } catch (err) {
            console.error(`Error fetching details for finding ${finding.findingId}`, err);
            return {
              ...finding,
              actions: [],
              findingAttachments: [],
              actionAttachments: {},
            };
          }
        })
      );

      setFindings(findingsWithDetails);
      const auditIds = Array.from(
        new Set(findingsWithDetails.map(f => f.auditId).filter((id): id is string => !!id))
      );
      if (auditIds.length > 0) {
        fetchAuditSummaries(auditIds)
          .then(result => {
            if (Object.keys(result).length > 0) {
              setAuditSummaries(prev => ({ ...prev, ...result }));
            }
          })
          .catch(err => {
            console.warn('[ReviewEvidence] Failed to load audit summaries', err);
          });
      }
    } catch (err: any) {
      console.error('Failed to fetch findings', err);
      toast.error('Unable to load findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [deptId]);

  // Refresh when component becomes visible (e.g., when navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && deptId) {
        fetchFindings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [deptId]);

  // Preload department names
  useEffect(() => {
    let mounted = true;
    const loadDepartments = async () => {
      try {
        const list = await getDepartments();
        if (!mounted) return;
        const map: Record<string, string> = {};
        (list || []).forEach(dept => {
          if (dept?.deptId !== undefined && dept?.deptId !== null) {
            map[String(dept.deptId)] = dept.name || `Department ${dept.deptId}`;
          }
        });
        setDepartmentsLookup(map);
      } catch (err) {
        console.warn('Unable to load departments', err);
      }
    };
    loadDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  const resolveUserName = useCallback(
    async (userId?: string) => {
      if (!userId) return '';
      const key = String(userId).toLowerCase();
      if (userNameCacheRef.current[key]) return userNameCacheRef.current[key];
      if (!isGuid(userId)) return '';
      try {
        const user = await getUserById(userId);
        const name = user?.fullName || user?.email || '';
        if (name) {
          userNameCacheRef.current[key] = name;
        }
        return name;
      } catch (err) {
        console.warn('Unable to load user info', userId, err);
        return '';
      }
    },
    []
  );

  const buildAuditMetadata = useCallback(
    async (raw: any): Promise<AuditMetadata> => {
      const auditNode = raw?.audit || raw || {};
      const deptItems = normalizeArray(raw?.scopeDepartments).map((dept: any, idx: number) => {
        const hasId = dept?.deptId !== undefined && dept?.deptId !== null;
        const key = hasId ? String(dept.deptId) : '';
        const fallbackName = key ? `Department ${key}` : `Department ${idx + 1}`;
        return {
          deptId: dept?.deptId,
          name: dept?.deptName || (key && departmentsLookup[key]) || fallbackName,
          status: dept?.status,
        };
      });

      const criteriaItems = normalizeArray(raw?.criteria).map((crit: any, idx: number) => ({
        criteriaId: crit?.criteriaId || crit?.id || crit?.auditCriteriaMapId || `criteria_${idx}`,
        name: crit?.criteriaName || crit?.name || crit?.criterionName || `Criteria ${idx + 1}`,
        status: crit?.status,
      }));

      const scheduleItems = normalizeArray(raw?.schedules).map((sch: any, idx: number) => ({
        scheduleId: sch?.scheduleId || sch?.id || `schedule_${idx}`,
        milestoneName: sch?.milestoneName || sch?.name || sch?.milestone || `Milestone ${idx + 1}`,
        dueDate: sch?.dueDate,
        status: sch?.status,
        notes: sch?.notes,
      }));

      const teamRaw = normalizeArray(raw?.auditTeams);
      const team = await Promise.all(
        teamRaw.map(async (member: any, idx: number) => {
          let name = member?.fullName || member?.name;
          if (!name) {
            const fetched = await resolveUserName(member?.userId);
            if (fetched) name = fetched;
          }
          return {
            userId: member?.userId,
            name: name || `Team member ${idx + 1}`,
            roleInTeam: member?.roleInTeam,
            isLead: member?.isLead,
            email: member?.email,
          };
        })
      );

      return {
        auditId: auditNode?.auditId || auditNode?.id || raw?.auditId || '',
        title: auditNode?.title || raw?.title || '',
        type: auditNode?.type || raw?.type || '',
        scope: auditNode?.scope || raw?.scope || '',
        objective: auditNode?.objective || raw?.objective || '',
        startDate: auditNode?.startDate || auditNode?.periodFrom,
        endDate: auditNode?.endDate || auditNode?.periodTo,
        status: auditNode?.status || raw?.status || '',
        createdAt: auditNode?.createdAt || raw?.createdAt || '',
        createdByName:
          raw?.createdBy?.fullName ||
          raw?.createdByUser?.fullName ||
          auditNode?.createdBy?.fullName ||
          auditNode?.createdByUser?.fullName ||
          '',
        createdByEmail:
          raw?.createdBy?.email ||
          raw?.createdByUser?.email ||
          auditNode?.createdBy?.email ||
          auditNode?.createdByUser?.email ||
          '',
        departments: deptItems,
        criteria: criteriaItems,
        team,
        schedules: scheduleItems,
      };
    },
    [departmentsLookup, resolveUserName]
  );

  const openAuditModal = async (group: GroupedAudit) => {
    setModalAudit({
      auditId: group.auditId,
      title: group.summary?.title || group.auditId,
    });
    setModalFindings(
      group.findings.map(f => ({
        findingId: f.findingId,
        auditId: f.auditId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        status: f.status,
        deadline: f.deadline,
        createdAt: f.createdAt,
        actions: f.actions.map(a => ({
          actionId: a.actionId,
          title: a.title,
          description: a.description,
          assignedTo: a.assignedTo,
          assignedUserName: a.assignedUserName,
          status: a.status,
          progressPercent: a.progressPercent,
          dueDate: a.dueDate,
          createdAt: a.createdAt,
          reviewFeedback: a.reviewFeedback,
          attachments: f.actionAttachments[a.actionId] || [],
        })) as ActionWithDetails[],
        findingAttachments: f.findingAttachments,
      })) as FindingType[]
    );
    setLoadingAuditDetail(true);
    try {
      const detailRes = await getAuditPlanById(group.auditId);
      const detail = detailRes?.data?.data ?? detailRes?.data ?? detailRes;
      if (detail) {
        const normalized = await buildAuditMetadata(detail);
        setModalAuditDetail(normalized);
      } else {
        setModalAuditDetail(null);
      }
    } catch (err) {
      console.warn('Failed to load audit details', err);
      setModalAuditDetail(null);
    } finally {
      setLoadingAuditDetail(false);
    }
    setAuditModalOpen(true);
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
    setModalFindings(
      auditFindings.map(f => ({
        findingId: f.findingId,
        auditId: f.auditId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        status: f.status,
        deadline: f.deadline,
        createdAt: f.createdAt,
        actions: f.actions.map(a => ({
          actionId: a.actionId,
          title: a.title,
          description: a.description,
          assignedTo: a.assignedTo,
          assignedUserName: a.assignedUserName,
          status: a.status,
          progressPercent: a.progressPercent,
          dueDate: a.dueDate,
          createdAt: a.createdAt,
          reviewFeedback: a.reviewFeedback,
          attachments: f.actionAttachments[a.actionId] || [],
        })) as ActionWithDetails[],
        findingAttachments: f.findingAttachments,
      })) as FindingType[]
    );
  }, [findings, modalAudit]);

  // Auto-update modal findings when findings state changes (e.g., after approve/reject)
  useEffect(() => {
    if (auditModalOpen && modalAudit && findings.length > 0) {
      updateModalFindings();
    }
  }, [findings, auditModalOpen, modalAudit, updateModalFindings]);

  const handleActionDecision = async (action: ActionWithDetails, type: 'approve' | 'reject') => {
    setSelectedAction(action);
    setFeedbackType(type);
    setFeedbackValue('');
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setSelectedAction(null);
    setFeedbackValue('');
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAction) return;
    if (feedbackType === 'reject' && !feedbackValue.trim()) {
      toast.error('Please enter feedback when rejecting an action');
      return;
    }
    setProcessingActionId(selectedAction.actionId);
    try {
      if (feedbackType === 'approve') {
        await approveActionWithFeedback(selectedAction.actionId, feedbackValue || '');
        toast.success('Action approved successfully!');
      } else {
        await rejectAction(selectedAction.actionId, feedbackValue.trim());
        toast.success('Action rejected!');
      }
      closeFeedbackModal();
      // Refresh findings data
      await fetchFindings();
      // Update modal findings with fresh data (findings state will be updated by fetchFindings)
      // Use useEffect to watch for findings changes and update modal
    } catch (err: any) {
      console.error('Failed to process action', err);
      toast.error(getUserFriendlyErrorMessage(err, 'Unable to process action. Please try again.'));
    } finally {
      setProcessingActionId(null);
    }
  };


  const groupedAudits = useMemo<GroupedAudit[]>(() => {
    const groups = new Map<string, GroupedAudit>();

    findings.forEach(finding => {
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
  }, [findings, auditSummaries]);

  const filteredAudits = useMemo(() => {
    if (!query.trim()) return groupedAudits;
    const q = query.toLowerCase();
    return groupedAudits.filter(
      group =>
        group.summary?.title?.toLowerCase().includes(q) ||
        group.auditId.toLowerCase().includes(q) ||
        group.summary?.type?.toLowerCase().includes(q) ||
        group.summary?.scope?.toLowerCase().includes(q)
    );
  }, [groupedAudits, query]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Review evidence </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Review and approve evidence submitted by staff</p>
          </div>
        </div>

        {/* Search */}
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
            <span className="text-xs text-gray-500">{filteredAudits.length} records</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading data...</div>
          ) : filteredAudits.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No data available</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAudits.map(group => (
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
        processingAction={processingActionId !== null}
        showActionControls={true}
        auditeeOwnerMode={true}
        onClose={closeAuditModal}
        onActionDecision={handleActionDecision}
      />
      
      {/* Feedback Modal (approve/reject) */}
      {showFeedbackModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              {feedbackType === 'approve' ? '✓ Approve Action' : '✕ Reject Action'}
            </h3>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Action: {selectedAction.title}</p>
              <p className="text-xs text-gray-600">{selectedAction.description}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {feedbackType === 'reject' ? 'Feedback (Required)' : 'Feedback (Optional)'}
              </label>
              <textarea
                value={feedbackValue}
                onChange={(e) => setFeedbackValue(e.target.value)}
                rows={4}
                placeholder={feedbackType === 'reject' ? 'Enter a reason for rejection...' : 'Enter feedback if needed...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleSubmitFeedback}
                disabled={processingActionId !== null || (feedbackType === 'reject' && !feedbackValue.trim())}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  feedbackType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processingActionId !== null ? 'Processing...' : feedbackType === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
              </button>
              <button
                onClick={closeFeedbackModal}
                disabled={processingActionId !== null}
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

export default ReviewEvidence;

