import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { approvePlan, getAuditPlanById, rejectPlanContent } from '../../api/audits';
import { normalizePlanDetails, unwrap } from '../../utils/normalize';
import { getDepartments } from '../../api/departments';
import { getAuditCriteria } from '../../api/auditCriteria';
import { getAdminUsers } from '../../api/adminUsers';
import { getPlansWithDepartments } from '../../services/auditPlanning.service';
import { getStatusColor, getBadgeVariant } from '../../constants';
import { PlanDetailsModal } from '../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getDepartmentName, getCriterionName } from '../../helpers/auditPlanHelpers';
import { getChecklistTemplates } from '../../api/checklists';
import { MainLayout } from '../../layouts';
import { Button, StatCard } from '../../components';
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
  const [filter, setFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected'>('Pending Review');

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
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  // loading currently unused; reserved for future spinner

  const filteredPlans = filter === 'All'
    ? auditPlans
    : auditPlans.filter((plan) => {
      const s = String(plan.status || '').toLowerCase();
      if (filter === 'Pending Review') {
        return s === 'pendingdirectorapproval' || s === 'pending director approval';
      }
      if (filter === 'Approved') return s === 'approved' || s === 'approve';
      if (filter === 'Rejected') return s === 'rejected';
      return false;
    });

  const [processingIdStr, setProcessingIdStr] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectPlanId, setRejectPlanId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvePlanId, setApprovePlanId] = useState<string | null>(null);

  // Helper function to check if plan can be approved/rejected
  const canApproveOrReject = (status: string): boolean => {
    const s = String(status || '').toLowerCase();
    return s === 'pendingdirectorapproval' || s === 'pending director approval';
  };

  // Function to reload plans
  const reloadPlans = async () => {
    try {
      const [plansRes, deptRes, critRes, usersRes, templatesRes] = await Promise.all([
        getPlansWithDepartments(),
        getDepartments(),
        getAuditCriteria(),
        getAdminUsers(),
        getChecklistTemplates(),
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

      setAuditPlans(directorRelevant);
      setDepartments(deptList);
      setCriteriaList(Array.isArray(critRes) ? critRes : []);
      setChecklistTemplates(Array.isArray(templatesRes) ? templatesRes : []);
      const owners = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditee'));
      const auditors = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditor'));
      setOwnerOptions(owners);
      setAuditorOptions(auditors);
    } catch (err) {
      console.error('Failed to reload plans', err);
    }
  };

  // Fetch plans from backend (prefer plans that were forwarded to Director)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [plansRes, deptRes, critRes, usersRes, templatesRes] = await Promise.all([
          getPlansWithDepartments(),
          getDepartments(),
          getAuditCriteria(),
          getAdminUsers(),
          getChecklistTemplates(),
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

        if (mounted) {
          setAuditPlans(directorRelevant);
          setDepartments(deptList);
          setCriteriaList(Array.isArray(critRes) ? critRes : []);
          setChecklistTemplates(Array.isArray(templatesRes) ? templatesRes : []);
          const owners = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditee'));
          const auditors = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditor'));
          setOwnerOptions(owners);
          setAuditorOptions(auditors);
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

  const openApproveModal = (planId: string) => {
    setApprovePlanId(planId);
    setShowApproveModal(true);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setApprovePlanId(null);
  };

  const handleApprovePlan = async () => {
    if (!approvePlanId) return;
    try {
      setProcessingIdStr(approvePlanId);
      // Call backend API to approve. Send optional comment if needed.
      await approvePlan(String(approvePlanId), { comment: 'Approved by Director' });
      toast.success('Plan approved successfully.');
      closeApproveModal();
      // Reload plans to get fresh data
      await reloadPlans();
    } catch (err: any) {
      console.error('Failed to approve plan', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to approve plan: ' + errorMessage);
    } finally {
      setProcessingIdStr(null);
    }
  };

  const handleRejectPlan = async (planId: string, comment?: string) => {
    try {
      await rejectPlanContent(String(planId), { comment });
      toast.success('Rejected the Audit Plan');
      setShowRejectModal(false);
      setRejectPlanId(null);
      setRejectComment('');
      // Reload plans to get fresh data
      await reloadPlans();
    } catch (err: any) {
      console.error('Failed to reject plan', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
    }
  };

  const openRejectModal = (planId: string) => {
    setRejectPlanId(planId);
    setRejectComment('');
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectPlanId(null);
    setRejectComment('');
  };

  const openDetails = async (plan: AuditPlan) => {
    try {
      const raw = await getAuditPlanById(String(plan.planId));
      const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
      const normalized = normalizePlanDetails(raw, { departments, criteriaList, users: allUsers });
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
      return s === 'pendingdirectorapproval' || s === 'pending director approval';
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
        <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary-600">Review Audit Plans</h1>
            <p className="text-gray-600 text-sm mt-1">Review and approve audit plans forwarded by Lead Auditor</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Plans"
            value={stats.total}
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-dark"
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            icon={
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
            variant="gray"
          />
        </div>


        {/* Status Tabs */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-primary-100">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('Pending Review')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'Pending Review'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setFilter('Approved')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'Approved'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('Rejected')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'Rejected'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>
        </div>

        {/* Plans Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">
              {filter === 'Pending Review' ? 'Pending Review Plans' : filter === 'Approved' ? 'Approved Plans' : filter === 'Rejected' ? 'Rejected Plans' : 'All Audit Plans'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No audit plans found
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan, index) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-primary-600">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">{plan.title}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{plan.department}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{plan.submittedBy}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Button onClick={() => openDetails(plan)} size="sm" variant="secondary">
                            View
                          </Button>
                          {canApproveOrReject(plan.status) ? (
                            <>
                              <button
                                onClick={() => openApproveModal(plan.planId)}
                                disabled={processingIdStr === plan.planId}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${processingIdStr === plan.planId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Approved') + ' hover:opacity-90'}`}
                              >
                                {processingIdStr === plan.planId ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => openRejectModal(plan.planId)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Rejected') + ' hover:opacity-90'}`}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedDetails && (
        <PlanDetailsModal
          showModal={true}
          selectedPlanDetails={selectedDetails}
          onClose={() => setSelectedDetails(null)}
          // Director actions are only available in the table, not in the modal
          getCriterionName={(id: any) => getCriterionName(id, criteriaList)}
          getDepartmentName={(id: any) => getDepartmentName(id, departments)}
          getStatusColor={getStatusColor}
          getBadgeVariant={getBadgeVariant}
          ownerOptions={ownerOptions}
          auditorOptions={auditorOptions}
          getTemplateName={(tid) => {
            const t = checklistTemplates.find((tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(tid));
            return t?.name || t?.title || `Template ${String(tid ?? '')}`;
          }}
        />
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && approvePlanId && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeApproveModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Approve Audit Plan
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure to approve Audit Plan?
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeApproveModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprovePlan}
                  disabled={processingIdStr === approvePlanId}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${processingIdStr === approvePlanId ? 'bg-gray-300 cursor-not-allowed text-white' : getStatusColor('Approved') + ' hover:opacity-90'}`}
                >
                  {processingIdStr === approvePlanId ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Confirmation Modal */}
      {showRejectModal && rejectPlanId && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeRejectModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Reject Audit Plan
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejection (optional):
              </p>
              
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-6 min-h-[100px] resize-y"
              />
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rejectPlanId) {
                      handleRejectPlan(rejectPlanId, rejectComment || undefined);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Rejected') + ' hover:opacity-90'}`}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </MainLayout>
  );
};

export default ReviewAuditPlans;
