import { MainLayout, ClockIcon, AuditIcon, ChartBarIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useEffect, useState } from 'react';
import { StatCard } from '../../../components';
import AuditReviewList from './components/AuditReviewList';
// PlanReviewPanel previously provided inline actions; we removed inline panel to avoid duplicate UI with modal
// import PlanReviewPanel from './components/PlanReviewPanel';
import { getAuditPlanById, approveForwardDirector, rejectPlanContent } from '../../../api/audits';
import { getPlansWithDepartments } from '../../../services/auditPlanning.service';
import { normalizePlanDetails, unwrap } from '../../../utils/normalize';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { getDepartments } from '../../../api/departments';
import { getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getAdminUsers } from '../../../api/adminUsers';

const SQAHeadAuditReview = () => {
  const { user } = useAuth();
  const [selectedPlanFull, setSelectedPlanFull] = useState<any | null>(null);
  const [pendingPlans, setPendingPlans] = useState<any[]>([]);
  const [reviewedPlans, setReviewedPlans] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const loadPlans = async () => {
    setLoading(true);
    try {
  // fetch plans, admin users and departments in parallel
  const [resPlans, adminUsers, deptsRes, critRes] = await Promise.all([getPlansWithDepartments(), getAdminUsers(), getDepartments(), getAuditCriteria()]);

  // normalize list wrapper variations (array | { $values: [] } | { values: [] })
  let list: any = unwrap(resPlans);

      // Split into Pending vs Reviewed
      const isPending = (s: string) => {
        const v = String(s || '').toLowerCase();
        return v.includes('pendingreview') ;
      };
      const isReviewed = (s: string) => {
        const v = String(s || '').toLowerCase();
        return v.includes('approve') || v.includes('reject') || v.includes('published') || v.includes('pending director');
      };
      const pending = list.filter((p: any) => isPending(p.status || p.state));
      const reviewed = list.filter((p: any) => isReviewed(p.status || p.state));
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
      const users = Array.isArray(adminUsers) ? adminUsers : [];
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

        // no debug logs; keep fallback behavior

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
      const reviewedNormalized = reviewed.map(normalizeForList);
      setPendingPlans(pendingNormalized);
      setReviewedPlans(reviewedNormalized);
      setOwnerOptions(Array.isArray(adminUsers) ? adminUsers : []);
      setCriteriaList(Array.isArray(critRes) ? critRes : []);
    } catch (err) {
      console.error('Failed to load audit plans for review', err);
      setPendingPlans([]);
      setReviewedPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const handleForwardToDirector = async (auditId: string, comment?: string) => {
    try {
      await approveForwardDirector(auditId, { comment });
      await loadPlans();
  alert('✅ Plan forwarded to Director successfully.');
  setSelectedPlanFull(null);
    } catch (err: any) {
      console.error('Failed to forward to director', err);
      alert('Failed to forward to Director: ' + (err?.response?.data?.message || err?.message || String(err)));
    }
  };

  const handleReject = async (auditId: string, comment?: string) => {
    try {
      await rejectPlanContent(auditId, { comment });
      await loadPlans();
  alert('✅ Plan rejected successfully.');
  setSelectedPlanFull(null);
    } catch (err: any) {
      // Log full error for debugging
      console.error('Failed to reject plan', err);
      const status = err?.response?.status;
      const data = err?.response?.data;
      // Show more detailed error info to help debug server 500 responses
      alert(
        `Failed to reject plan. HTTP ${status || ''}\n` +
          (data ? JSON.stringify(data, null, 2) : (err?.message || String(err)))
      );
    }
  };

  const handleSelectPlan = async (auditId: string) => {
    setLoading(true);
    try {
      const details = await getAuditPlanById(auditId);
      const normalized = normalizePlanDetails(details, { departments: departments || [], criteriaList: criteriaList || [], users: ownerOptions || [] });

      setSelectedPlanFull(normalized);

      // update plans list with department name derived from normalized details
    const deptNames = ((normalized.scopeDepartments?.values || []) as any).map((d: any) => d.deptName || d.name).filter(Boolean);
      setPendingPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
      setReviewedPlans((prev: any[]) => prev.map((p: any) => (String(p.auditId || p.id) === String(auditId) ? { ...p, department: deptNames.length ? deptNames.join(', ') : p.department } : p)));
    } catch (err) {
      console.error('Failed to load plan details', err);
      alert('Không thể tải chi tiết kế hoạch. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Audit Review</h1>
          <p className="text-gray-600 text-sm mt-1">Review and approve audit plans submitted by Auditor</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Pending Review" value={pendingPlans.length.toString()} icon={<ClockIcon />} variant="primary-light" />
          <StatCard title="High Priority" value={pendingPlans.filter((a: any) => a.priority === 'High').length.toString()} icon={<AuditIcon />} variant="primary-dark" />
          <StatCard title="Reviewed" value={reviewedPlans.length.toString()} icon={<ChartBarIcon />} variant="primary" />
        </div>

        {!selectedPlanFull ? (
          <div>
            <div className="mb-3 flex gap-2">
              <button onClick={() => setActiveTab('pending')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab==='pending' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Pending</button>
              <button onClick={() => setActiveTab('reviewed')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab==='reviewed' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Reviewed</button>
            </div>
            <AuditReviewList
              title={activeTab==='pending' ? 'Pending Audit Plans' : 'Reviewed Audit Plans'}
              plans={activeTab==='pending' ? pendingPlans : reviewedPlans}
              onSelect={(id) => void handleSelectPlan(id)}
              getDepartmentName={(id:any)=> getDepartmentName(id, departments)}
            />
            {loading && <p className="text-sm text-gray-500 mt-2">Loading...</p>}
          </div>
        ) : (
          <>
            {/* Show the auditor modal UI so Lead Auditor sees identical details */}
            <PlanDetailsModal
              showModal={true}
              selectedPlanDetails={selectedPlanFull}
              onClose={() => setSelectedPlanFull(null)}
              // Lead Auditor should NOT be able to edit the plan here, so we do NOT pass onEdit
              onForwardToDirector={handleForwardToDirector}
              onRejectPlan={handleReject}
              // Request Revision is intentionally not provided so it will be handled via Reject
              getCriterionName={(id: any) => String(id)}
              getDepartmentName={(id: any) => getDepartmentName(id, departments)}
              getStatusColor={getStatusColor}
              getBadgeVariant={getBadgeVariant}
              ownerOptions={ownerOptions}
            />
            {/* Inline review panel removed to avoid duplicate UI behind the modal. Actions are available in the modal. */}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default SQAHeadAuditReview;
