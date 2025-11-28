import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import AuditReviewList from './components/AuditReviewList';
import { FilterBar } from './components/FilterBar';
import { getAuditPlanById, approveForwardDirector, rejectPlanContent } from '../../../api/audits';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { normalizePlanDetails, unwrap } from '../../../utils/normalize';
import { getChecklistTemplates } from '../../../api/checklists';
import { PlanDetailsModal } from '../AuditPlanning/components/PlanDetailsModal';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { getDepartments } from '../../../api/departments';
import { getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAuditTeam } from '../../../api/auditTeam';
import { StatCard } from '../../../components';

const AuditorAuditReview = () => {
  const { user } = useAuth();
  const [selectedPlanFull, setSelectedPlanFull] = useState<any | null>(null);
  const [pendingPlans, setPendingPlans] = useState<any[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<any[]>([]);
  const [rejectedPlans, setRejectedPlans] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Filter state
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [sortDateOrder, setSortDateOrder] = useState<string>('desc'); // Default: newest first
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal states for actions
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [rejectPlanId, setRejectPlanId] = useState<string | null>(null);
  const [forwardPlanId, setForwardPlanId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const loadPlans = async () => {
    setLoading(true);
    try {
  // fetch plans, admin users, departments, criteria, checklist templates, and audit teams in parallel
  const [resPlans, adminUsers, deptsRes, critRes, templatesRes, teamsRes] = await Promise.all([
    getPlansWithDepartments(), 
    getAdminUsers(), 
    getDepartments(), 
    getAuditCriteria(),
    getChecklistTemplates(),
    getAuditTeam()
  ]);

  // Get current user's userId from adminUsers
  const users = Array.isArray(adminUsers) ? adminUsers : [];
  let currentUserId: string | null = null;
  if (user?.email) {
    const found = users.find((u: any) => {
      const uEmail = String(u?.email || '').toLowerCase().trim();
      const userEmail = String(user.email).toLowerCase().trim();
      return uEmail === userEmail;
    });
    if (found?.userId) {
      currentUserId = String(found.userId);
    } else if (found?.$id) {
      currentUserId = String(found.$id);
    }
  }

  // Get audit IDs where current user is Lead (isLead = true)
  const teams = Array.isArray(teamsRes) ? teamsRes : [];
  const leadAuditIds = new Set<string>();
  if (currentUserId) {
    teams.forEach((m: any) => {
      if (m?.isLead && String(m?.userId) === String(currentUserId)) {
        const auditId = String(m?.auditId || '');
        if (auditId) leadAuditIds.add(auditId);
      }
    });
  }

  // normalize list wrapper variations (array | { $values: [] } | { values: [] })
  let list: any = unwrap(resPlans);

      // Split into Pending, Approved, Rejected
      const isPending = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        return v.includes('pendingreview');
      };
      const isApproved = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        return v.includes('approved') || v.includes('approve') || v.includes('pendingdirectorapproval') || v.includes('pendingdirector');
      };
      const isRejected = (s: string) => {
        const v = String(s || '').toLowerCase().replace(/\s+/g, '');
        return v === 'rejected' || v.includes('reject');
      };
      
      // Filter plans: only show audits where current user is Lead
      const filteredList = (Array.isArray(list) ? list : []).filter((p: any) => {
        const auditId = String(p.auditId || p.id || p.$id || '');
        return leadAuditIds.has(auditId);
      });
      
      const pending = filteredList.filter((p: any) => isPending(p.status || p.state));
      const approved = filteredList.filter((p: any) => isApproved(p.status || p.state));
      const rejected = filteredList.filter((p: any) => isRejected(p.status || p.state));
      // normalize departments list from API
      const deptList = Array.isArray(deptsRes)
        ? deptsRes.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
        : [];
      setDepartments(deptList);

      // Normalize each plan for display in the list: derive department names if possible
      // Build deptMap with multiple possible id keys so lookups by numeric id or $id both work
      const deptMap = (Array.isArray(deptList) ? deptList : []).reduce((acc: any, d: any) => {
        const name = d.name || d.deptName || d.code || String(d.deptId ?? d.$id ?? d.id ?? '');
        const keys = [d.deptId, d.$id, d.id].filter(Boolean);
        keys.forEach((k: any) => {
          acc[String(k)] = name;
        });
        // also index by the stringified numeric deptId if present
        if (d.deptId !== undefined && d.deptId !== null) {
          acc[String(Number(d.deptId))] = name;
        }
        return acc;
      }, {} as any);

      // build user map from adminUsers so we can resolve submitter/creator names
      const userMap = users.reduce((acc: any, u: any) => {
        const keys = [u.userId, u.id, u.$id, u.email, u.fullName].filter(Boolean).map((k: any) => String(k).toLowerCase());
        keys.forEach((k: string) => (acc[k] = u));
        return acc;
      }, {} as any);

      const normalizeForList = (p: any) => {
        const scopeArr = unwrap(p.scopeDepartments || p.scope || p.scopeDepartment);
        const deptNames = (scopeArr || [])
          .map((d: any) => d.deptName || deptMap[String(d.deptId ?? d.id ?? d.$id ?? d.departmentId ?? d.deptCode)] || d.deptId || d.id || d.$id || d.departmentId || d.deptCode || d.name || String(d))
          .filter(Boolean);

        let finalDeptNames = deptNames.length > 0 ? deptNames : [];
        if (finalDeptNames.length === 0 && p.department) {
          // p.department might be an id; try to resolve using deptMap
          const lookup = deptMap[String(p.department)];
          if (lookup) finalDeptNames = [lookup];
          else finalDeptNames = [p.department];
        }

        // Resolve createdBy/submittedBy to a user object (fullName) when possible
        let createdByUser = p.createdByUser;
        // If createdByUser is a primitive id/string, try to look up
        if (createdByUser && typeof createdByUser === 'string') {
          const lookup = userMap[String(createdByUser).toLowerCase()];
          if (lookup) createdByUser = lookup;
          else createdByUser = { fullName: createdByUser };
        }
        // If no createdByUser, try p.createdBy or p.submittedBy or p.submittedByUser
        if (!createdByUser) {
          const candidate = p.createdBy || p.submittedBy || p.submittedByUser;
          if (candidate) {
            const lookup = userMap[String(candidate).toLowerCase()];
            createdByUser = lookup || { fullName: String(candidate) };
          }
        }

        return {
          ...p,
          department: finalDeptNames.length > 0 ? finalDeptNames.join(', ') : 'N/A',
          scopeDepartments: scopeArr,
          createdByUser,
        };
      };

      const pendingNormalized = pending.map(normalizeForList);
      const approvedNormalized = approved.map(normalizeForList);
      const rejectedNormalized = rejected.map(normalizeForList);
      
      // Sort by newest first (by createdAt or startDate)
      const sortByNewest = (a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA; // Newest first
      };
      
      // Store all plans (will be filtered later)
      setPendingPlans(pendingNormalized.sort(sortByNewest));
      setApprovedPlans(approvedNormalized.sort(sortByNewest));
      setRejectedPlans(rejectedNormalized.sort(sortByNewest));
      const usersArr = Array.isArray(adminUsers) ? adminUsers : [];
      const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
      const auditors = usersArr.filter((u: any) => norm(u.roleName) === 'auditor');
      const owners = usersArr.filter((u: any) => norm(u.roleName) === 'auditeeowner');
      setOwnerOptions(owners);
      setAuditorOptions(auditors);
      setCriteriaList(Array.isArray(critRes) ? critRes : []);
      setChecklistTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    } catch (err) {
      console.error('Failed to load audit plans for review', err);
      setPendingPlans([]);
      setApprovedPlans([]);
      setRejectedPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  // Filter and sort plans based on filter criteria
  const filteredPendingPlans = useMemo(() => {
    let filtered = pendingPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [pendingPlans, filterDepartment, sortDateOrder, filterStatus]);

  const filteredApprovedPlans = useMemo(() => {
    let filtered = approvedPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [approvedPlans, filterDepartment, sortDateOrder, filterStatus]);

  const filteredRejectedPlans = useMemo(() => {
    let filtered = rejectedPlans.filter((plan: any) => {
      // Department filter
      if (filterDepartment) {
        const scopeArr = plan.scopeDepartments || [];
        const hasDept = Array.isArray(scopeArr)
          ? scopeArr.some((d: any) => {
              const deptId = String(d.deptId || d.id || d.$id || d.departmentId || '');
              return deptId === String(filterDepartment);
            })
          : false;
        if (!hasDept) return false;
      }

      // Status filter
      if (filterStatus) {
        const planStatus = plan.status || plan.state || '';
        if (String(planStatus) !== filterStatus) return false;
      }

      return true;
    });

    // Sort by date if sortDateOrder is set
    if (sortDateOrder) {
      filtered = filtered.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (sortDateOrder === 'desc') {
          return dateB - dateA; // Newest first
        } else if (sortDateOrder === 'asc') {
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
    }

    return filtered;
  }, [rejectedPlans, filterDepartment, sortDateOrder, filterStatus]);

  // Get current filtered plans based on active tab
  const currentFilteredPlans = 
    activeTab === 'pending' ? filteredPendingPlans :
    activeTab === 'approved' ? filteredApprovedPlans :
    filteredRejectedPlans;
  
  const currentTotalPlans = 
    activeTab === 'pending' ? pendingPlans.length :
    activeTab === 'approved' ? approvedPlans.length :
    rejectedPlans.length;

  // Clear all filters
  const clearFilters = () => {
    setFilterDepartment('');
    setSortDateOrder('desc'); // Reset to default: newest first
    setFilterStatus('');
  };

  const handleForwardToDirector = async (auditId: string) => {
    try {
      await approveForwardDirector(auditId, { comment: '' });
      await loadPlans();
      toast.success('Plan forwarded to Director successfully.');
      setShowForwardModal(false);
      setForwardPlanId(null);
      setSelectedPlanFull(null);
    } catch (err: any) {
      console.error('Failed to forward to director', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Failed to forward to Director: ' + errorMessage);
    }
  };

  const handleReject = async (auditId: string, comment?: string) => {
    try {
      await rejectPlanContent(auditId, { comment });
      await loadPlans();
      toast.success('Rejected the Audit Plan');
      setShowRejectModal(false);
      setRejectPlanId(null);
      setRejectComment('');
      setSelectedPlanFull(null);
    } catch (err: any) {
      console.error('Failed to reject plan', err);
      const errorMessage = err?.response?.data?.message || err?.message || String(err);
      toast.error('Reject failed: ' + errorMessage);
    }
  };

  const openRejectModal = (auditId: string) => {
    setRejectPlanId(auditId);
    setRejectComment('');
    setShowRejectModal(true);
  };

  const openForwardModal = (auditId: string) => {
    setForwardPlanId(auditId);
    setShowForwardModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectPlanId(null);
    setRejectComment('');
  };

  const closeForwardModal = () => {
    setShowForwardModal(false);
    setForwardPlanId(null);
  };

  const handleSelectPlan = async (auditId: string) => {
    setLoading(true);
    try {
      const details = await getAuditPlanById(auditId);
      const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
      const normalized = normalizePlanDetails(details, { departments: departments || [], criteriaList: criteriaList || [], users: allUsers });

      setSelectedPlanFull(normalized);

      // update plans list with department name derived from normalized details
    const deptNames = ((normalized.scopeDepartments?.values || []) as any).map((d: any) => d.deptName || d.name).filter(Boolean);
      setPendingPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setApprovedPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setRejectedPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
    } catch (err) {
      console.error('Failed to load plan details', err);
      alert('Unable to load plan details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    total: pendingPlans.length + approvedPlans.length + rejectedPlans.length,
    pending: pendingPlans.length,
    approved: approvedPlans.length,
    rejected: rejectedPlans.length,
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary-600">Audit Review</h1>
            <p className="text-gray-600 text-sm mt-1">Review and approve audit plans submitted by Auditor</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'approved'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'rejected'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>
        </div>

        {!selectedPlanFull ? (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
              <h2 className="text-lg font-semibold text-white">
                {activeTab === 'pending' ? 'Pending Audit Plans' : activeTab === 'approved' ? 'Approved Audit Plans' : 'Rejected Audit Plans'}
              </h2>
            </div>

            <FilterBar
              filterDepartment={filterDepartment}
              sortDateOrder={sortDateOrder}
              filterStatus={filterStatus}
              departments={departments}
              onFilterDepartmentChange={setFilterDepartment}
              onSortDateOrderChange={setSortDateOrder}
              onFilterStatusChange={setFilterStatus}
              onClearFilters={clearFilters}
              filteredCount={currentFilteredPlans.length}
              totalCount={currentTotalPlans}
            />

            <AuditReviewList
              title={activeTab === 'pending' ? 'Pending Audit Plans' : activeTab === 'approved' ? 'Approved Audit Plans' : 'Rejected Audit Plans'}
              plans={currentFilteredPlans}
              onSelect={(id) => void handleSelectPlan(id)}
              onApprove={activeTab === 'pending' ? (id) => openForwardModal(id) : undefined}
              onReject={activeTab === 'pending' ? (id) => openRejectModal(id) : undefined}
              getDepartmentName={(id:any)=> getDepartmentName(id, departments)}
            />
            {loading && <p className="text-sm text-gray-500 mt-2 px-6 pb-4">Loading...</p>}
          </div>
        ) : (
          <>
            <PlanDetailsModal
              showModal={true}
              selectedPlanDetails={selectedPlanFull}
              onClose={() => setSelectedPlanFull(null)}
              getCriterionName={(id: any) => String(id)}
              getDepartmentName={(id: any) => getDepartmentName(id, departments)}
              getStatusColor={getStatusColor}
              getBadgeVariant={getBadgeVariant}
              ownerOptions={ownerOptions}
              auditorOptions={auditorOptions}
              getTemplateName={(tid) => {
                const t = checklistTemplates.find((tpl: any) => String(tpl.templateId) === String(tid));
                return  t?.name || `Template ${String(tid ?? '')}`;
              }}
            />
          </>
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
                        handleReject(rejectPlanId, rejectComment || undefined);
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

        {/* Forward to Director Confirmation Modal */}
        {showForwardModal && forwardPlanId && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={closeForwardModal}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Forward to Director
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure to submit to Director?
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeForwardModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (forwardPlanId) {
                        handleForwardToDirector(forwardPlanId);
                      }
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Forward
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </MainLayout>
  );
};

export default AuditorAuditReview;

