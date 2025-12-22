import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { MainLayout } from '../../../layouts';
import { useUserId } from '../../../store/useAuthStore';
import { apiClient } from '../../../hooks/axios';
import {
  getFindingsByAudit,
  approveFindingActionHigherLevel,
  rejectFindingActionHigherLevel,
} from '../../../api/findings';
import { getActionsByFinding } from '../../../api/actions';
import { getAttachments, updateAttachmentStatus } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { getAuditPlanById } from '../../../api/audits';
import { getDepartments } from '../../../api/departments';
import AuditDetailsModal from '../LeadFinalReview/components/AuditDetailsModal';
import type { Audit, Finding, ActionWithDetails, AuditMetadata } from '../LeadFinalReview/types';
import { DataTable, type TableColumn } from '../../../components/DataTable';
import { getStatusColor } from '../../../constants';

const isGuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const normalizeArray = (payload: any) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload.$values && Array.isArray(payload.$values)) return payload.$values;
  if (payload.values && Array.isArray(payload.values)) return payload.values;
  return [];
};

export default function LeadFinalReview() {
  const userId = useUserId();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [query, setQuery] = useState('');
  const [loadingAudits, setLoadingAudits] = useState(false);

  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditMetadata | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);
  const [departmentsLookup, setDepartmentsLookup] = useState<Record<string, string>>({});
  const userNameCacheRef = useRef<Record<string, string>>({});

  // New modal feedback states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'approve' | 'reject'>('approve');
  const [selectedAction, setSelectedAction] = useState<ActionWithDetails | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // preload department names to show human-friendly labels
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

  // load audits where current user is lead
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const fetch = async () => {
      setLoadingAudits(true);
      try {
        const maybeRes: any = await apiClient.get('/AuditTeam/my-lead-auditor-audits');
        const data = (maybeRes && maybeRes.data) ? maybeRes.data : maybeRes;
        const body = data.data ?? data;
        const auditIdsArr = normalizeArray(
          body.auditIds ? (body.auditIds.$values || body.auditIds) : body.$values || body
        );
        console.log('[LeadFinalReview] raw lead audits payload:', auditIdsArr);
        const mapped: Audit[] = auditIdsArr
          .map((a: any) => {
            if (typeof a === 'string') return { auditId: a, title: a };
            const auditNode = a?.audit || {};
            const titleCandidate =
              a.title ||
              a.auditTitle ||
              auditNode.title ||
              auditNode.auditTitle ||
              auditNode.name ||
              a.auditId ||
              a.id;
            const statusCandidate = a.status || auditNode.status || auditNode.auditStatus || '';
            const normalized: Audit = {
              auditId: a.auditId || a.id || auditNode.auditId || auditNode.id || '',
              title: titleCandidate ? String(titleCandidate) : 'Untitled audit',
              status: statusCandidate || '-',
            };
            console.log('[LeadFinalReview] normalized audit item:', { raw: a, normalized });
            return normalized;
          })
          .filter((a: Audit) => !!a.auditId);
        const needHydrate = mapped.filter(a => !a.title || a.title === a.auditId || a.title === 'Untitled audit');
        let finalAudits = mapped;
        if (needHydrate.length > 0) {
          console.log('[LeadFinalReview] Hydrating audits for titles/status', needHydrate.map(a => a.auditId));
          const hydrated = await Promise.all(
            mapped.map(async auditItem => {
              if (!auditItem.auditId) return auditItem;
              if (auditItem.title && auditItem.title !== auditItem.auditId && auditItem.title !== 'Untitled audit') {
                return auditItem;
              }
              try {
                const detailRes = await getAuditPlanById(auditItem.auditId);
                const detail = detailRes?.data?.data ?? detailRes?.data ?? detailRes;
                const auditNode = detail?.audit || detail || {};
                return {
                  ...auditItem,
                  title:
                    auditNode.title ||
                    auditNode.auditTitle ||
                    detail?.title ||
                    detail?.auditTitle ||
                    auditItem.title,
                  status: auditNode.status || detail?.status || auditItem.status || '-',
                };
              } catch (hydrateErr) {
                console.warn('[LeadFinalReview] Failed to hydrate audit detail', auditItem.auditId, hydrateErr);
                return auditItem;
              }
            })
          );
          finalAudits = hydrated;
        }
        if (!cancelled) setAudits(finalAudits);
      } catch (err) {
        console.error('Error loading lead audits', err);
        toast.error('Unable to load audits');
      } finally {
        if (!cancelled) setLoadingAudits(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [userId]);

  // load findings for audit (on open)
  const loadFindingsForAudit = async (audit: Audit) => {
    setSelectedAudit(audit);
    setFindings([]);
    setSelectedAuditDetail(null);
    setLoadingFindings(true);
    setLoadingAuditDetail(true);
    try {
      const [rawFindings, auditDetailRaw] = await Promise.all([
        getFindingsByAudit(audit.auditId),
        getAuditPlanById(audit.auditId).catch(err => {
          console.warn('Unable to load audit details', err);
          return null;
        }),
      ]);
      const mapped: Finding[] = (rawFindings || []).map((f: any) => ({
        findingId: f.findingId || f.id || f.$id || '',
        auditId: f.auditId || audit.auditId,
        title: f.title || f.name || '',
        description: f.description,
        severity: f.severity,
        status: f.status,
        deadline: f.deadline,
        createdAt: f.createdAt,
        actions: [],
        findingAttachments: [],
      }));

      // enrich each finding with attachments and actions
      const enriched = await Promise.all(mapped.map(async fn => {
        try {
          const [findingAtts, actionsRaw] = await Promise.all([
            getAttachments('finding', fn.findingId).catch(() => []),
            getActionsByFinding(fn.findingId).catch(() => []),
          ]);

          const actionsDetailed: ActionWithDetails[] = await Promise.all((actionsRaw || []).map(async (act: any) => {
            const actionId = act.actionId || act.id || act.$id || '';
            const attachments = await getAttachments('Action', actionId).catch(() => []);
            let assignedUserName = act.assignedTo;
            if (isGuid(act.assignedTo)) {
              try {
                const userInfo = await getUserById(act.assignedTo);
                assignedUserName = userInfo?.fullName || userInfo?.email || act.assignedTo;
              } catch (e) {
                // ignore
              }
            }
            return {
              actionId,
              title: act.title || act.name || '',
              description: act.description,
              assignedTo: act.assignedTo,
              assignedUserName,
              status: act.status,
       progressPercent: act.progressPercent ?? act.progress ?? 0,
              dueDate: act.dueDate,
              createdAt: act.createdAt,
              reviewFeedback: act.reviewFeedback,
              attachments,
            } as ActionWithDetails;
          }));

          return { ...fn, findingAttachments: findingAtts, actions: actionsDetailed } as Finding;
        } catch (e) {
          console.error('Enrich finding failed', e);
          return fn;
        }
      }));

      setFindings(enriched);
      const auditPayload = auditDetailRaw?.data?.data ?? auditDetailRaw?.data ?? auditDetailRaw;
      if (auditPayload) {
        const normalized = await buildAuditMetadata(auditPayload);
        setSelectedAuditDetail(normalized);
      } else {
        setSelectedAuditDetail({
          auditId: audit.auditId,
          title: audit.title,
          status: audit.status,
          type: '',
          scope: '',
          objective: '',
          startDate: undefined,
          endDate: undefined,
          createdAt: undefined,
          createdByName: '',
          createdByEmail: '',
          departments: [],
          criteria: [],
          team: [],
          schedules: [],
        });
      }
    } catch (err) {
      console.error('Error loading findings', err);
      toast.error('Unable to load findings');
      setSelectedAuditDetail({
        auditId: audit.auditId,
        title: audit.title,
        status: audit.status,
        type: '',
        scope: '',
        objective: '',
        startDate: undefined,
        endDate: undefined,
        createdAt: undefined,
        createdByName: '',
        createdByEmail: '',
        departments: [],
        criteria: [],
        team: [],
        schedules: [],
      });
    } finally {
      setLoadingFindings(false);
      setLoadingAuditDetail(false);
    }
  };

  // Open modal feedback for an action
  const openFeedbackModal = (action: ActionWithDetails, type: 'approve' | 'reject') => {
    setSelectedAction(action);
    setFeedbackType(type);
    setFeedbackText('');
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setSelectedAction(null);
    setFeedbackText('');
  };

  // Submit feedback (approve or reject)
  const handleSubmitFeedback = async () => {
    if (!selectedAction) return;
    if (feedbackType === 'reject' && !feedbackText.trim()) {
      toast.error('Please enter feedback when rejecting an action');
      return;
    }
    setProcessingAction(true);
    try {
      if (feedbackType === 'approve') {
        // IMPORTANT: Approve only attachments with status "Open" before approving the action
        try {
          const attachments = await getAttachments('Action', selectedAction.actionId);
          const openAttachments = attachments.filter(att => att.status?.toLowerCase() === 'open');
          const rejectedAttachments = attachments.filter(att => att.status?.toLowerCase() === 'rejected');
          
          console.log(`📋 [LeadFinalReview] Approving action: ${selectedAction.actionId}`);
          console.log(`📎 Attachments to approve (Open status): ${openAttachments.length}`);
          console.log(`❌ Attachments NOT to approve (Rejected status): ${rejectedAttachments.length}`);
          
          if (openAttachments.length > 0) {
            console.log(`✅ [LeadFinalReview] Approving ${openAttachments.length} attachment(s) with "Open" status...`);
            const approvePromises = openAttachments.map(async (attachment) => {
              try {
                await updateAttachmentStatus(attachment.attachmentId, 'Approved');
                console.log(`  ✓ Approved attachment: ${attachment.fileName}`);
              } catch (err: any) {
                console.error(`  ✗ Failed to approve attachment ${attachment.fileName}:`, err);
              }
            });
            await Promise.all(approvePromises);
            console.log(`✅ [LeadFinalReview] Approved ${openAttachments.length} attachment(s)`);
          }
        } catch (attErr) {
          console.warn('Could not load/approve attachments:', attErr);
        }
        
        await approveFindingActionHigherLevel(selectedAction.actionId, feedbackText || '');
        toast.success('Action approved (Lead)!');
      } else {
        await rejectFindingActionHigherLevel(selectedAction.actionId, feedbackText.trim());
        
        // Reset progress to 0 when action is rejected
        try {
          const { updateActionProgressPercent } = await import('../../../api/actions');
          await updateActionProgressPercent(selectedAction.actionId, 0);
          console.log('✅ [LeadFinalReview] Progress reset to 0 after rejection');
        } catch (progressError: any) {
          console.error('⚠️ [LeadFinalReview] Failed to reset progress:', progressError);
          // Don't fail the whole operation if progress reset fails
        }
        
        toast.success('Action rejected!');
      }
      closeFeedbackModal();
      // reload findings for current audit to reflect status change
      if (selectedAudit) await loadFindingsForAudit(selectedAudit);
    } catch (err: any) {
      console.error('Failed to process action', err);
      toast.error(err?.response?.data?.message || 'Unable to process action');
    } finally {
      setProcessingAction(false);
    }
  };

  const filteredAudits = useMemo(() => {
    if (!query) return audits;
    const q = query.trim().toLowerCase();
    return audits.filter(a => (a.title || a.auditId || '').toLowerCase().includes(q));
  }, [audits, query]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header consistent with Reports / Audit Planning */}
        <div className="bg-white border-b border-primary-100 shadow-sm mb-2">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary-600">Lead Audit Final Review</h1>
            <p className="text-gray-600 text-sm mt-1">
              Review and finalize audit findings and CAPA actions
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <input
              className="border rounded px-3 py-2 flex-1"
              placeholder="Search audits by name or ID..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Table wrapped in card layout similar to Audit Planning */}
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
              <h2 className="text-lg font-semibold text-white">Existing Lead Audits</h2>
            </div>
            <div className="p-4">
              <DataTable<Audit>
                columns={[
                  {
                    key: 'no',
                    header: 'No.',
                    cellClassName: 'whitespace-nowrap',
                    render: (_, index) => (
                      <span className="text-sm font-semibold text-primary-700">{index + 1}</span>
                    ),
                  } as TableColumn<Audit>,
                  {
                    key: 'title',
                    header: 'Title',
                    render: (row) => (
                      <div className="max-w-[260px]">
                        <p className="text-sm font-semibold text-gray-900">{row.title || 'Untitled'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{row.auditId}</p>
                      </div>
                    ),
                  } as TableColumn<Audit>,
                  {
                    key: 'status',
                    header: 'Status',
                    cellClassName: 'whitespace-nowrap',
                    render: (row) => (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          row.status || 'Draft'
                        )}`}
                      >
                        {row.status || 'Draft'}
                      </span>
                    ),
                  } as TableColumn<Audit>,
                  {
                    key: 'actions',
                    header: 'Actions',
                    align: 'center',
                    cellClassName: 'whitespace-nowrap text-center',
                    render: (row) => (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => loadFindingsForAudit(row)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                      </div>
                    ),
                  } as TableColumn<Audit>,
                ]}
                data={filteredAudits}
                loading={loadingAudits}
                loadingMessage="Loading audits..."
                emptyState="No audits found."
                rowKey={(row) => row.auditId}
                getRowClassName={() => 'transition-colors hover:bg-gray-50'}
              />
            </div>
          </div>

        </div>

        <AuditDetailsModal
          open={!!selectedAudit}
          audit={selectedAudit}
          auditDetail={selectedAuditDetail}
          findings={findings}
          loading={loadingFindings}
          loadingAuditDetail={loadingAuditDetail}
          processingAction={processingAction}
          onClose={() => {
            setSelectedAudit(null);
            setFindings([]);
            setSelectedAuditDetail(null);
          }}
          onActionDecision={(action, type) => openFeedbackModal(action, type)}
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
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                  placeholder={feedbackType === 'reject' ? 'Enter a reason for rejection...' : 'Enter feedback if needed...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={processingAction || (feedbackType === 'reject' && !feedbackText.trim())}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    feedbackType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {processingAction ? 'Processing...' : feedbackType === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                </button>
                <button
                  onClick={() => { setShowFeedbackModal(false); setSelectedAction(null); setFeedbackText(''); }}
                  disabled={processingAction}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}