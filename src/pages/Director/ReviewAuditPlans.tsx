import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { approvePlan, getAuditPlanById, rejectPlanContent, getSensitiveDepartments } from '../../api/audits';
import { normalizePlanDetails, unwrap } from '../../utils/normalize';
import { getDepartments } from '../../api/departments';
import { getAuditCriteria } from '../../api/auditCriteria';
import { getAdminUsers } from '../../api/adminUsers';
import { getPlansWithDepartments } from '../../services/auditPlanning.service';
import { getStatusColor, getBadgeVariant } from '../../constants';
import { PlanDetailsModal } from '../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getDepartmentName, getCriterionName } from '../../helpers/auditPlanHelpers';
import { getChecklistTemplates } from '../../api/checklists';
import { getAuditSchedules } from '../../api/auditSchedule';
import { getAuditTeam } from '../../api/auditTeam';
import { MainLayout } from '../../layouts';
import { StatCard, Button } from '../../components';

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

 
  

  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  // loading currently unused; reserved for future spinner

  const filteredPlans = filter === 'All'
    ? auditPlans
    : auditPlans.filter((plan) => {
      const s = String(plan.status || '').toLowerCase();
      if (filter === 'Pending Review') {
        return s === 'pendingdirectorapproval' || s === 'pending director approval';
      }
      if (filter === 'Approved') {
        // Director wants the Approved tab to also show audits that are in progress
        const isApprovedLike = s === 'approved' || s === 'approve';
        const isInProgressLike = s === 'inprogress' || s === 'in progress';
        return isApprovedLike || isInProgressLike;
      }
      if (filter === 'Rejected') return s === 'rejected';
      return false;
    });

  const [processingIdStr, setProcessingIdStr] = useState<string | null>(null);

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

      // Keep plans visible after actions: include PendingDirectorApproval + Approved + InProgress + Rejected
      const directorRelevant = mapped.filter((m) => {
        const s = String(m.status || '').toLowerCase();
        return (
          s === 'pendingdirectorapproval' ||
          s === 'pending director approval' ||
          s === 'approved' ||
          s === 'approve' ||
          s === 'inprogress' ||
          s === 'in progress' ||
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
      // Refresh audit teams after loading plans to ensure we have latest team assignments
      await fetchAuditTeams();
    } catch (err) {
      console.error('Failed to reload plans', err);
    }
  };

  // Load audit teams - needs to be refreshed when plans change
  const fetchAuditTeams = async () => {
    try {
      const teams = await getAuditTeam();
      const teamsArray = unwrap(teams) || [];
      // Filter out AuditeeOwner from audit teams
      const filteredTeams = Array.isArray(teamsArray) 
        ? teamsArray.filter((m: any) => {
            const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
            return role !== 'auditeeowner';
          })
        : [];
      setAuditTeams(filteredTeams);
    } catch (err) {
      console.error("Failed to load audit teams", err);
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

        // Keep plans visible after actions: include PendingDirectorApproval + Approved + InProgress + Rejected
        const directorRelevant = mapped.filter((m) => {
          const s = String(m.status || '').toLowerCase();
          return (
            s === 'pendingdirectorapproval' ||
            s === 'pending director approval' ||
            s === 'approved' ||
            s === 'approve' ||
            s === 'inprogress' ||
            s === 'in progress' ||
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

  // Also load audit teams on initial mount (before plans are loaded)
  useEffect(() => {
    fetchAuditTeams();
  }, []);

  const handleRejectPlan = async (planId: string, comment?: string) => {
    try {
      await rejectPlanContent(String(planId), { comment });
      toast.success('Rejected the Audit Plan');
      // Reload plans to get fresh data
      await reloadPlans();
    } catch (err: any) {
      console.error('Failed to reject plan', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
      throw err; // Re-throw to let PlanDetailsModal handle the error
    }
  };

  const openDetails = async (plan: AuditPlan) => {
    try {
      const raw = await getAuditPlanById(String(plan.planId));
      const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
      
      // Fetch schedules separately if not included in main response
      let schedulesData = raw?.schedules;
      if (
        !schedulesData ||
        (!schedulesData.values && !schedulesData.$values && !Array.isArray(schedulesData))
      ) {
        try {
          const schedulesResponse = await getAuditSchedules(String(plan.planId));
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          schedulesData = { values: [] };
        }
      }

      // Merge schedules into raw
      const detailsWithSchedules = {
        ...raw,
        schedules: schedulesData,
      };

      // Load sensitive areas
      let sensitiveFlag = false;
      let sensitiveAreas: string[] = [];
      let sensitiveAreasByDept: Record<number, string[]> = {};
      
      try {
        const sensitiveDepts = await getSensitiveDepartments(String(plan.planId));
        
        if (sensitiveDepts && sensitiveDepts.length > 0) {
          sensitiveFlag = sensitiveDepts.some((sd: any) => sd.sensitiveFlag === true);
          
          const allAreas = new Set<string>();
          
          sensitiveDepts.forEach((sd: any) => {
            const deptId = Number(sd.deptId);
            let areasArray: string[] = [];
            
            // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
            if (Array.isArray(sd.Areas)) {
              areasArray = sd.Areas;
            } else if (sd.Areas && typeof sd.Areas === 'string') {
              try {
                const parsed = JSON.parse(sd.Areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
              } catch {
                areasArray = [sd.Areas];
              }
            } else if (sd.Areas && typeof sd.Areas === 'object' && sd.Areas.$values) {
              areasArray = Array.isArray(sd.Areas.$values) ? sd.Areas.$values : [];
            } else if (Array.isArray(sd.areas)) {
              areasArray = sd.areas;
            } else if (sd.areas && typeof sd.areas === 'string') {
              try {
                const parsed = JSON.parse(sd.areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
              } catch {
                areasArray = [sd.areas];
              }
            } else if (sd.areas && typeof sd.areas === 'object' && sd.areas.$values) {
              areasArray = Array.isArray(sd.areas.$values) ? sd.areas.$values : [];
            }
            
            // Store areas by deptId
            if (deptId && areasArray.length > 0) {
              sensitiveAreasByDept[deptId] = areasArray.filter((area: string) => area && typeof area === 'string' && area.trim()).map((a: string) => a.trim());
            }
            
            areasArray.forEach((area: string) => {
              if (area && typeof area === 'string' && area.trim()) {
                allAreas.add(area.trim());
              }
            });
          });
          
          sensitiveAreas = Array.from(allAreas);
        }
      } catch (sensitiveErr) {
        console.warn('Failed to load sensitive areas', sensitiveErr);
      }

      const normalized = normalizePlanDetails(detailsWithSchedules, { departments, criteriaList, users: allUsers });
      
      // Add sensitive areas data
      const detailsWithSensitive = {
        ...normalized,
        sensitiveFlag,
        sensitiveAreas,
        sensitiveAreasByDept,
      };
      
      setSelectedDetails(detailsWithSensitive);
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
        sensitiveFlag: false,
        sensitiveAreas: [],
        sensitiveAreasByDept: {},
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
        <div className="animate-slideInLeft rounded-xl border-b shadow-md border-primary-100 bg-white px-6 py-8 mb-6">
          <h1 className="text-2xl font-bold text-black">Review Audit Plans</h1>
          <p className="text-[#5b6166] text-sm mt-1">Review and approve audit plans forwarded by Lead Auditor</p>
        </div>

        {/* Stats Cards */}
        <div className="animate-slideInRight animate-delay-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
        <div className="animate-slideUp animate-delay-200 bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden mb-6">
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
        <div className="animate-slideUp animate-delay-200 bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-white">
            <h2 className="text-lg font-semibold text-black">
              {filter === 'Pending Review' ? 'Pending Review Plans' : filter === 'Approved' ? 'Approved Plans' : filter === 'Rejected' ? 'Rejected Plans' : 'All Audit Plans'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-noto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">No.</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">Title</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">Department</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">Start Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">End Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-black">Submitted By</th>
                  
                  <th className="px-6 py-4 text-center text-sm font-bold text-black">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-[#5b6166]">
                      No audit plans found
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan, index) => (
                    <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-ms font-bold text-black">{plan.title}</span>
                      </td>
                      <td className="px-6 py-4  max-w-xs">
                        {(() => {
                          const raw = plan.department || '';
                          const parts = raw
                            .split(',')
                            .map((p) => p.trim())
                            .filter(Boolean);
                          const MAX_VISIBLE = 3;
                          if (parts.length === 0) {
                            return <span className="text-ms text-[#5b6166]">—</span>;
                          }
                          if (parts.length <= MAX_VISIBLE) {
                            return (
                              <span className="text-ms text-[#5b6166]" title={raw}>
                                {parts.join(' / ')}
                              </span>
                            );
                          }
                          // More than 3 departments: hide list, show gray helper text (non-clickable)
                          return (
                            <span className="text-xs text-gray-400">
                              Click view for more details
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-ms text-[#5b6166]">
                          {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-ms text-[#5b6166]">
                          {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-ms text-[#5b6166]">{plan.submittedBy}</span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetails(plan)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
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
      {selectedDetails && (() => {
        const canApproveOrRejectPlan = canApproveOrReject(selectedDetails.status);
        return (
          <PlanDetailsModal
            showModal={true}
            selectedPlanDetails={selectedDetails}
            onClose={() => setSelectedDetails(null)}
            onApprove={canApproveOrRejectPlan ? async (auditId: string, comment?: string) => {
              try {
                setProcessingIdStr(auditId);
                await approvePlan(String(auditId), { comment: comment || 'Approved by Director' });
                toast.success('Plan approved successfully.');
                setSelectedDetails(null);
                await reloadPlans();
              } catch (err: any) {
                console.error('Failed to approve plan', err);
                const errorMessage = err?.response?.data?.message || err?.message || String(err);
                toast.error('Failed to approve plan: ' + errorMessage);
              } finally {
                setProcessingIdStr(null);
              }
            } : undefined}
            onRejectPlan={canApproveOrRejectPlan ? async (auditId: string, comment?: string) => {
              try {
                await handleRejectPlan(auditId, comment);
                setSelectedDetails(null);
              } catch (err: any) {
                console.error('Failed to reject plan', err);
                const errorMessage = err?.response?.data?.message || err?.message || String(err);
                toast.error('Failed to reject plan: ' + errorMessage);
              }
            } : undefined}
            approveButtonText="Approve"
            auditTeamsForPlan={auditTeams.filter((m: any) => {
              const currentAuditId = selectedDetails.auditId || selectedDetails.id;
              if (!currentAuditId) return false;
              const teamAuditId = String(m?.auditId || "").trim();
              return (
                teamAuditId === String(currentAuditId).trim() ||
                teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
              );
            })}
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
        );
      })()}


    </MainLayout>
  );
};

export default ReviewAuditPlans;

