import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import useAuthStore from '../../../store/useAuthStore';
import { getDepartments } from '../../../api/departments';
import { getAuditPlans, getAuditScopeDepartments } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';
import { getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { getAdminUsers } from '../../../api/adminUsers';

const AuditPlans = () => {
	const { user: layoutCtxUser } = useAuth();
	const { user: storeUser } = useAuthStore();
	const layoutUser = layoutCtxUser ? { name: layoutCtxUser.fullName, avatar: undefined } : undefined;
	const navigate = useNavigate();

	const [plans, setPlans] = useState<any[]>([]);
	const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
	const [loading, setLoading] = useState(false);
  const [effectiveDeptId, setEffectiveDeptId] = useState<string | number | null>(null);

	const myDeptId = storeUser?.deptId ?? (storeUser as any)?.departmentId ?? (storeUser as any)?.deptCode;

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const [plansRes, scopesRes, deptsRes, usersRes] = await Promise.all([
					getAuditPlans(),
					getAuditScopeDepartments(),
					getDepartments(),
					getAdminUsers(),
				]);
				const plansList = unwrap<any>(plansRes);
				const scopesList = unwrap<any>(scopesRes);
				const deptList = Array.isArray(deptsRes)
					? deptsRes.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
					: [];
				setDepartments(deptList);

				// Resolve effective department id for current user
				let effDeptId: string | number | null | undefined = myDeptId as any;
				if (effDeptId == null) {
					const users = Array.isArray(usersRes) ? usersRes : [];
					const me = users.find((u: any) => {
						const targets = [storeUser?.email, (storeUser as any)?.userId, storeUser?.fullName]
							.filter(Boolean)
							.map((v: any) => String(v).toLowerCase());
						const keys = [u.email, u.userId, u.fullName].filter(Boolean).map((v: any) => String(v).toLowerCase());
						return targets.some((t: string) => keys.includes(t));
					});
					effDeptId = me?.deptId ?? null;
				}
				setEffectiveDeptId(effDeptId ?? null);

				// If user has a department, filter auditIds directly by deptId
				const myIdStr = effDeptId != null ? String(effDeptId) : undefined;
				const normalizedScopes = (Array.isArray(scopesList) ? scopesList : []).map((sd: any) => ({
					auditId: String(sd.auditId ?? sd.auditPlanId ?? ''),
					deptId: String(sd.deptId ?? ''),
					deptName: sd.deptName || sd.name || sd.departmentName || sd.code,
				})).filter((x: any) => x.auditId);

				const scopesByAudit = normalizedScopes.reduce((acc: any, s: any) => {
					(acc[s.auditId] ||= []).push({ deptId: s.deptId, deptName: s.deptName });
					return acc;
				}, {} as Record<string, Array<{deptId: string; deptName?: string}>>);

				let list: any[] = Array.isArray(plansList) ? plansList : [];
				if (myIdStr) {
					const allowedAuditIds = new Set(
						normalizedScopes.filter((s: any) => s.deptId === myIdStr).map((s: any) => s.auditId)
					);
					list = list.filter((p: any) => allowedAuditIds.has(String(p.auditId || p.id || p.$id)));
				}

				// Only keep published plans by backend boolean flag
				list = list.filter((p: any) => p?.isPublished === true);

				// attach scopeDepartments for display
				const withScopes = list.map((p: any) => {
					const id = String(p.auditId || p.id || p.$id || '');
					return {
						...p,
						scopeDepartments: scopesByAudit[id] || [],
					};
				});
				setPlans(withScopes);
			} catch (err) {
				console.error('Failed to load audit plans for AuditeeOwner', err);
				setPlans([]);
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const filteredPlans = useMemo(() => {
		if (effectiveDeptId == null) return [];
		const myIdStr = String(effectiveDeptId);
		const matchesDept = (plan: any) => {
			const normIds = Array.isArray(plan?.normalizedDeptIds) ? plan.normalizedDeptIds.map((x: any) => String(x)) : [];
			if (normIds.includes(myIdStr)) return true;
			const scopes = Array.isArray(plan?.scopeDepartments) ? plan.scopeDepartments : (plan?.scopeDepartments?.values || []);
			const scopeIds = (scopes || []).map((sd: any) => String(sd?.deptId ?? sd?.id ?? sd?.$id ?? sd?.departmentId ?? sd?.deptCode ?? '')).filter(Boolean);
			const planLevelIds = [plan?.department, plan?.deptId, plan?.departmentId, plan?.deptCode]
				.map((v: any) => (v != null ? String(v) : ''))
				.filter(Boolean);
			return [...normIds, ...scopeIds, ...planLevelIds].some((id) => id === myIdStr);
		};
		const isPublished = (p: any) => p?.isPublished === true;
		return (plans || []).filter(matchesDept).filter(isPublished);
	}, [plans, effectiveDeptId]);

	return (
		<MainLayout user={layoutUser}>
			<div className="px-6 py-6 space-y-6">
				<div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
					<h1 className="text-2xl font-semibold text-primary-600">Audit Plans</h1>
					<p className="text-gray-600 mt-1">Các kế hoạch audit liên quan đến phòng ban của bạn</p>
					{loading && <p className="text-sm text-gray-500 mt-2">Đang tải...</p>}
				</div>

				<div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
					<div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
						<h2 className="text-lg font-semibold text-white">Danh sách kế hoạch</h2>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Plan ID</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Departments</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{filteredPlans.map((p: any, idx: number) => {
									const id = String(p.auditId || p.id || p.$id || `plan_${idx}`);
									const scopes = Array.isArray(p?.scopeDepartments) ? p.scopeDepartments : (p?.scopeDepartments?.values || []);
									const deptNames = (scopes || []).map((sd: any) => sd.deptName || getDepartmentName(String(sd.deptId ?? sd.id ?? sd.$id), departments)).filter(Boolean);
									const start = p.startDate ? new Date(p.startDate).toISOString().slice(0,10) : '';
									const end = p.endDate ? new Date(p.endDate).toISOString().slice(0,10) : '';
									return (
										<tr key={id} className="hover:bg-gray-50">
											<td className="px-6 py-3 text-sm text-primary-600 font-medium">{id.slice(0,8)}…</td>
											<td className="px-6 py-3 text-sm font-semibold text-gray-900">{p.title || '—'}</td>
											<td className="px-6 py-3 text-sm text-gray-700">{deptNames.length ? deptNames.join(', ') : '—'}</td>
											<td className="px-6 py-3 text-sm text-gray-700">{start} {start || end ? '→' : ''} {end}</td>
											<td className="px-6 py-3 whitespace-nowrap">
												<div className="flex gap-2">
													<button onClick={() => navigate(`/auditee-owner/audit-plans/${id}/detail`)} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
													<span className="text-gray-300">|</span>
													<button onClick={() => navigate(`/auditee-owner/audit-plans/${id}/confirm`)} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">Confirm</button>
												</div>
											</td>
										</tr>
									);
								})}
								{filteredPlans.length === 0 && !loading && (
									<tr>
										<td className="px-6 py-6 text-center text-gray-500" colSpan={5}>Không có kế hoạch đã publish phù hợp với phòng ban của bạn</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</MainLayout>
	);
};

export default AuditPlans;

