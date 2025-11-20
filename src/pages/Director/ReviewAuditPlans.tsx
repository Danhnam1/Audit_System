import { useState, useEffect } from 'react';
import { approvePlan, getAuditPlanById, rejectPlanContent } from '../../api/audits';
import { normalizePlanDetails, unwrap } from '../../utils/normalize';
import { getDepartments } from '../../api/departments';
import { getAuditCriteria } from '../../api/auditCriteria';
import { getAdminUsers } from '../../api/adminUsers';
import { getPlansWithDepartments } from '../../services/auditPlanning.service';
import { getStatusColor, getBadgeVariant } from '../../constants';
import { PlanDetailsModal } from '../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getDepartmentName } from '../../helpers/auditPlanHelpers';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import { createNotification } from '../../api/notifications';
import { extractDueDate, getRecipientsForApproval } from '../../helpers/notificationRecipients';
import { getAuditPlanById as fetchFullPlan } from '../../api/audits';

interface AuditPlan {
  id: string; // use string to preserve GUIDs
  planId: string;
  title: string;
  department: string;
  scope: string;
  startDate: string;
  endDate: string;
  submittedBy: string;
  submittedDate: string;
  status: string; // backend can return PendingDirectorApproval | PendingReview | Approved | Rejected
  objectives: string[];
  auditTeam: string[];
}

const ReviewAuditPlans = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected'>('All');

  // Mock data (kept as fallback)
  const initialPlans: AuditPlan[] = [
    {
      id: '1',
      planId: 'AP-2024-001',
      title: 'ISO 9001:2015 Quality Management System Audit',
      department: 'IT Department',
      scope: 'Document Control, Training Records, Internal Audit Process',
      startDate: '2024-11-20',
      endDate: '2024-11-25',
      submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-11-01',
      status: 'Pending Review',
      objectives: [
        'Verify compliance with ISO 9001:2015 standards',
        'Assess effectiveness of quality management processes',
        'Identify areas for improvement',
      ],
      auditTeam: ['Trần Thị B', 'Lê Văn C', 'Phạm Thị D'],
    },
    {
      id: '2',
      planId: 'AP-2024-002',
      title: 'Information Security Management Audit',
      department: 'HR Department',
      scope: 'Access Control, Data Protection, Security Policies',
      startDate: '2024-11-15',
      endDate: '2024-11-18',
      submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-10-28',
      status: 'Pending Review',
      objectives: [
        'Evaluate information security controls',
        'Review access management procedures',
        'Assess compliance with security policies',
      ],
      auditTeam: ['Hoàng Văn E', 'Nguyễn Thị F'],
    },
    {
      id: '3',
      planId: 'AP-2024-003',
      title: 'Process Improvement Audit',
      department: 'Finance Department',
      scope: 'Financial Controls, Reporting Procedures',
      startDate: '2024-10-20',
      endDate: '2024-10-25',
      submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-10-15',
      status: 'Approved',
      objectives: [
        'Review financial control processes',
        'Assess reporting accuracy',
        'Identify cost optimization opportunities',
      ],
      auditTeam: ['Trần Văn G', 'Lê Thị H'],
    },
  ];

  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>(initialPlans);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  // loading currently unused; reserved for future spinner

  const filteredPlans = filter === 'All'
    ? auditPlans
    : auditPlans.filter((plan) => {
      const s = String(plan.status || '').toLowerCase();
      if (filter === 'Pending Review') {
        return s === 'pendingdirectorapproval' || s === 'pending director approval' || s === 'pendingreview' || s === 'pending review';
      }
      if (filter === 'Approved') return s === 'approved' || s === 'approve';
      if (filter === 'Rejected') return s === 'rejected';
      return false;
    });

  const [processingIdStr, setProcessingIdStr] = useState<string | null>(null);

  // Fetch plans from backend (prefer plans that were forwarded to Director)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [plansRes, deptRes, critRes, usersRes] = await Promise.all([
          getPlansWithDepartments(),
          getDepartments(),
          getAuditCriteria(),
          getAdminUsers(),
        ]);

        // Build departments map for id->name lookup
        const deptList = Array.isArray(deptRes)
          ? deptRes.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
          : [];
        const deptMap = deptList.reduce((acc: any, d: any) => {
          const name = d.name || d.deptName || d.code || String(d.deptId ?? d.$id ?? d.id ?? '');
          const keys = [d.deptId, d.$id, d.id, Number(d.deptId)].filter((k) => k !== undefined && k !== null);
          keys.forEach((k: any) => (acc[String(k)] = name));
          return acc;
        }, {} as Record<string, string>);

        const usersArr = Array.isArray(usersRes) ? usersRes : [];
        const userMap = usersArr.reduce((acc: any, u: any) => {
          const keys = [u.userId, u.id, u.$id, u.email, u.fullName]
            .filter(Boolean)
            .map((k: any) => String(k).toLowerCase());
          keys.forEach((k: string) => (acc[k] = u));
          return acc;
        }, {} as any);

        const plansList = Array.isArray(plansRes) ? plansRes : [];
        const mapped: AuditPlan[] = plansList.map((p: any) => {
          const scopeArr = unwrap(p.scopeDepartments || p.scope || p.scopeDepartment);
          const deptNames = (scopeArr || [])
            .map((d: any) => d.deptName || deptMap[String(d.deptId ?? d.id ?? d.$id ?? d.departmentId)] || d.name)
            .filter(Boolean);

          let department = deptNames.length ? deptNames.join(', ') : '—';
          if (department === '—' && p.department) {
            department = deptMap[String(p.department)] || String(p.department);
          }

          // Resolve submitter similarly to Lead Auditor page
          let createdByUser = p.createdByUser;
          if (createdByUser && typeof createdByUser === 'string') {
            const lu = userMap[String(createdByUser).toLowerCase()];
            createdByUser = lu || { fullName: createdByUser };
          }
          if (!createdByUser) {
            const candidate = p.createdBy || p.submittedBy || p.submittedByUser || p.ownerId || p.createdByUserId;
            if (candidate) {
              const lu = userMap[String(candidate).toLowerCase()];
              createdByUser = lu || { fullName: String(candidate) };
            }
          }
          let submittedBy = (createdByUser && createdByUser.fullName) || p.submittedBy || p.createdBy || 'Unknown';

          return {
            id: String(p.auditId ?? p.id ?? p.$id ?? ''),
            planId: String(p.auditId ?? p.id ?? p.$id ?? ''),
            title: p.title || p.name || 'Untitled',
            department,
            scope: p.scope || '—',
            startDate: p.startDate || p.periodFrom || '',
            endDate: p.endDate || p.periodTo || '',
            submittedBy,
            submittedDate: p.createdAt || p.submittedAt || '',
            status: String(p.status || p.auditStatus || 'Pending Review') as any,
            objectives: p.objective ? [String(p.objective)] : Array.isArray(p.objectives) ? p.objectives : [],
            auditTeam: Array.isArray(p.auditTeams)
              ? p.auditTeams.map((t: any) => t.fullName || t.name || String(t))
              : p.auditTeams && Array.isArray(p.auditTeams?.values)
                ? p.auditTeams.values.map((t: any) => t.fullName || t.name)
                : [],
          };
        });

        // Keep plans visible after actions: include PendingDirectorApproval + Approved + Rejected
        const directorRelevant = mapped.filter((m) => {
          const s = String(m.status || '').toLowerCase();
          return (
            s === 'pendingdirectorapproval' ||
            s === 'pending director approval' ||
            s === 'approved' ||
            s === 'approve' ||
            s === 'rejected'
          );
        });

        if (mounted) setAuditPlans(directorRelevant);
        if (mounted) {
          setDepartments(deptList);
          setCriteriaList(Array.isArray(critRes) ? critRes : []);
          const owners = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditee'));
          setOwnerOptions(owners);
        }
      } catch (err) {
        console.warn('Failed to fetch plans for Director page, using mock data', err);
      } finally {
        // no-op
      }
    };

    void load();
    return () => { mounted = false };
  }, []);

  const handleApprovePlan = async (planId: string) => {
    if (!window.confirm('Approve this audit plan?')) return;
    try {
      setProcessingIdStr(planId);
      // Call backend API to approve. Send optional comment if needed.
      await approvePlan(String(planId), { comment: 'Approved by Director' });
      // Fetch fresh status from backend instead of hardcoding
      let freshStatus: string | undefined;
      try {
        const refreshed = await fetchFullPlan(String(planId));
        freshStatus = String(refreshed?.status || refreshed?.auditStatus || '').trim();
      } catch (e) {
        console.warn('Failed to fetch refreshed plan after approve, fallback to previous status', e);
      }
      setAuditPlans(prev => prev.map(p => (String(p.planId) === String(planId)
        ? { ...p, status: freshStatus && freshStatus.length ? freshStatus : p.status }
        : p)));
      // Fetch full plan to derive recipients & due date
      try {
        const full = await fetchFullPlan(String(planId));
        const usersArr = await getAdminUsers();
        const recipients = getRecipientsForApproval(full, usersArr);
        const { dueDate } = extractDueDate(full);
        const title = 'Kế hoạch được phê duyệt';
        const baseMsg = `Kế hoạch kiểm toán '${full?.title || planId}' đã được Giám đốc phê duyệt.`;
        const dueMsg = dueDate ? ` Hạn chuẩn bị bằng chứng: ${new Date(dueDate).toLocaleDateString()}.` : '';
        await Promise.all(
          recipients.map(r =>
            createNotification({
              userId: r.userId,
              title,
              message: baseMsg + dueMsg,
              entityType: 'AuditPlan',
              entityId: String(planId),
              category: r.reason,
              status: 'Sent',
            }).catch(() => null)
          )
        );
      } catch (notifyErr) {
        console.warn('Notification dispatch failed (non-blocking):', notifyErr);
      }
      alert('✅ Plan approved successfully.');
    } catch (err: any) {
      console.error('Failed to approve plan', err);
      const serverMsg = err?.response?.data || err?.message || String(err);
      try {
        const pretty = typeof serverMsg === 'object' ? JSON.stringify(serverMsg, null, 2) : String(serverMsg);
        alert('Failed to approve plan. Server response:\n' + pretty);
      } catch {
        alert('Failed to approve plan: ' + (err?.message || String(err)));
      }
    } finally {
      setProcessingIdStr(null);
    }
  };

  const handleRejectPlan = async (planId: string, comment?: string) => {
    try {
      await rejectPlanContent(String(planId), { comment });
      setAuditPlans(prev => prev.map(p => (String(p.planId) === String(planId) ? { ...p, status: 'Rejected' } : p)));
      alert('✅ Plan rejected.');
    } catch (err: any) {
      console.error('Failed to reject plan', err);
      alert('Reject failed: ' + (err?.response?.data?.message || err?.message || String(err)));
    }
  };

  const openDetails = async (plan: AuditPlan) => {
    try {
      const raw = await getAuditPlanById(String(plan.planId));
      const normalized = normalizePlanDetails(raw, { departments, criteriaList, users: ownerOptions });
      setSelectedDetails(normalized);
    } catch (err) {
      console.warn('Failed to load full details, using mapped summary', err);
      // Fallback: basic shape from list
      setSelectedDetails({
        ...plan,
        auditId: plan.planId,
        scopeDepartments: { values: [] },
        criteria: { values: [] },
        auditTeams: { values: [] },
        schedules: { values: [] },
        createdByUser: { fullName: plan.submittedBy, email: '', roleName: 'Unknown' },
        status: plan.status,
      });
    }
  };

  // Using imported getStatusColor from constants; remove local implementation

  const stats = {
    total: auditPlans.length,
    pending: auditPlans.filter((p) => {
      const s = String(p.status || '').toLowerCase();
      return s === 'pendingdirectorapproval' || s === 'pending director approval' || s === 'pendingreview' || s === 'pending review';
    }).length,
    approved: auditPlans.filter((p) => {
      const s = String(p.status || '').toLowerCase();
      return s === 'approved' || s === 'approve';
    }).length,
    rejected: auditPlans.filter((p) => String(p.status || '').toLowerCase() === 'rejected').length,
  };

  // Optionally show simple loading indicator (not rendered yet) — keep variable to avoid unused warning

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Review Audit Plans</h1>
            <p className="text-gray-600 mt-1">Review plans approved by Lead Auditor</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/director')}>
            Back to Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Plans</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['All', 'Pending Review', 'Approved', 'Rejected'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filter === status ? 'primary' : 'secondary'}
              onClick={() => setFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No audit plans found for the selected filter</p>
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{plan.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Plan ID: {plan.planId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Department</p>
                      <p className="font-medium text-gray-800">{plan.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Audit Period</p>
                      <p className="font-medium text-gray-800">
                        {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Submitted By</p>
                      <p className="font-medium text-gray-800">{plan.submittedBy}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Scope</p>
                    <p className="text-gray-700">{plan.scope}</p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button onClick={() => openDetails(plan)} size="sm">
                      View Details
                    </Button>
                    {String(plan.status).toLowerCase() === 'pendingdirectorapproval' || String(plan.status).toLowerCase() === 'pending director approval' ? (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleApprovePlan(plan.planId)}
                          isLoading={processingIdStr === plan.planId}
                          disabled={processingIdStr === plan.planId}
                        >
                          {processingIdStr === plan.planId ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const c = window.prompt('Nhập lý do từ chối (tùy chọn):') || '';
                            handleRejectPlan(plan.planId, c);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {selectedDetails && (
        <PlanDetailsModal
          showModal={true}
          selectedPlanDetails={selectedDetails}
          onClose={() => setSelectedDetails(null)}
          // Director actions
          onApprove={async (id, comment) => {
            await approvePlan(String(id), { comment });
            // Refresh local list state using backend status
            let freshStatus: string | undefined;
            try {
              const refreshed = await fetchFullPlan(String(id));
              freshStatus = String(refreshed?.status || refreshed?.auditStatus || '').trim();
            } catch (e) {
              console.warn('Modal approve: failed to fetch refreshed plan status', e);
            }
            setAuditPlans(prev => prev.map(p => (String(p.planId) === String(id)
              ? { ...p, status: freshStatus && freshStatus.length ? freshStatus : p.status }
              : p)));
            // Fire notifications similarly
            try {
              const full = await fetchFullPlan(String(id));
              const usersArr = await getAdminUsers();
              const recipients = getRecipientsForApproval(full, usersArr);
              const { dueDate } = extractDueDate(full);
              const title = 'Kế hoạch được phê duyệt';
              const baseMsg = `Kế hoạch kiểm toán '${full?.title || id}' đã được Giám đốc phê duyệt.`;
              const dueMsg = dueDate ? ` Hạn chuẩn bị bằng chứng: ${new Date(dueDate).toLocaleDateString()}.` : '';
              await Promise.all(
                recipients.map(r =>
                  createNotification({
                    userId: r.userId,
                    title,
                    message: baseMsg + dueMsg,
                    entityType: 'AuditPlan',
                    entityId: String(id),
                    category: r.reason,
                    status: 'Sent',
                  }).catch(() => null)
                )
              );
            } catch (notifyErr) {
              console.warn('Notification dispatch failed (modal) (non-blocking):', notifyErr);
            }
            alert('✅ Approved.');
            setSelectedDetails(null);
          }}
          onRejectPlan={async (id, comment) => {
            await rejectPlanContent(String(id), { comment });
            setAuditPlans(prev => prev.map(p => (String(p.planId) === String(id) ? { ...p, status: 'Rejected' } : p)));
            alert('✅ Rejected.');
            setSelectedDetails(null);
          }}
          getCriterionName={(id: any) => String(id)}
          getDepartmentName={(id: any) => getDepartmentName(id, departments)}
          getStatusColor={getStatusColor}
          getBadgeVariant={getBadgeVariant}
          ownerOptions={ownerOptions}
        />
      )}
    </MainLayout>
  );
};

export default ReviewAuditPlans;
