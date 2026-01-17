import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useUserId } from '../../../store/useAuthStore';
import { getDepartments } from '../../../api/departments';
import { getAuditPlans, getAuditScopeDepartments, getAuditPlanById } from '../../../api/audits';
import { unwrap, normalizePlanDetails } from '../../../utils/normalize';
import { getDepartmentName, getCriterionName } from '../../../helpers/auditPlanHelpers';
import { getAdminUsers, getUserById } from '../../../api/adminUsers';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getChecklistTemplates } from '../../../api/checklists';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { Button, Pagination } from '../../../components';

const AuditPlans = () => {
	const { user: layoutCtxUser } = useAuth();
	const layoutUser = layoutCtxUser ? { name: layoutCtxUser.fullName, avatar: undefined } : undefined;

	const [plans, setPlans] = useState<any[]>([]);
	const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
	const [loading, setLoading] = useState(false);
  const [effectiveDeptId, setEffectiveDeptId] = useState<string | number | null>(null);
	const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
	const [criteriaList, setCriteriaList] = useState<any[]>([]);
	const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
	const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
	const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 7;
	
	// Search and filter states
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
	const [dateTo, setDateTo] = useState<string>('');

	const userId = useUserId();

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const [plansRes, scopesRes, deptsRes, usersRes, critRes, templatesRes] = await Promise.all([
					getAuditPlans(),
					getAuditScopeDepartments(),
					getDepartments(),
					getAdminUsers(),
					getAuditCriteria(),
					getChecklistTemplates(),
				]);
				const plansList = unwrap<any>(plansRes);
				const scopesList = unwrap<any>(scopesRes);
				const deptList = Array.isArray(deptsRes)
					? deptsRes.map((d: any) => ({ deptId: d.deptId , name: d.name || d.code || '—' }))
					: [];
				setDepartments(deptList);
				setCriteriaList(Array.isArray(critRes) ? critRes : []);
				setChecklistTemplates(Array.isArray(templatesRes) ? templatesRes : []);

				const usersArr = Array.isArray(usersRes) ? usersRes : [];
				const owners = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditee'));
				const auditors = usersArr.filter((u: any) => String(u.roleName || '').toLowerCase().includes('auditor'));
				setOwnerOptions(owners);
				setAuditorOptions(auditors);

				// Get user's deptId from getUserById API (same as Profile page)
				let effDeptId: string | number | null = null;
				if (userId) {
					try {
						const userData = await getUserById(userId);
						effDeptId = userData?.deptId ?? null;
					} catch (err) {
						console.warn('Failed to get user by ID:', err);
					}
				}
				setEffectiveDeptId(effDeptId);

				// Build scope mapping for all audits (used in filteredPlans)
				const normalizedScopes = (Array.isArray(scopesList) ? scopesList : []).map((sd: any) => ({
					auditId: String(sd.auditId ?? sd.auditPlanId ?? ''),
					deptId: String(sd.deptId ?? ''),
					deptName: sd.deptName || sd.name || sd.departmentName || sd.code,
				})).filter((x: any) => x.auditId);

				const scopesByAudit = normalizedScopes.reduce((acc: any, s: any) => {
					(acc[s.auditId] ||= []).push({ deptId: s.deptId, deptName: s.deptName });
					return acc;
				}, {} as Record<string, Array<{deptId: string; deptName?: string}>>);

				const publishedPlans = (Array.isArray(plansList) ? plansList : []).filter((p: any) => p?.isPublished === true);
				
				// Filter by user's deptId if available
				let filteredList = publishedPlans;
				if (effDeptId != null) {
					const userDeptIdStr = String(effDeptId);
					const matchingAuditIds = new Set(
						normalizedScopes
							.filter((s: any) => String(s.deptId) === userDeptIdStr)
							.map((s: any) => s.auditId)
					);
					
					filteredList = publishedPlans.filter((p: any) => {
						const auditId = String(p.auditId || p.id || p.$id || '');
						const scope = String(p.scope || '').toLowerCase();
						return scope === 'academy' || matchingAuditIds.has(auditId);
					});
				}

				const withScopes = filteredList.map((p: any) => {
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
		let result = plans || [];
		
		if (searchTerm) {
			const searchLower = searchTerm.toLowerCase();
			result = result.filter((plan: any) => 
				(plan.title || '').toLowerCase().includes(searchLower)
			);
		}
		
		if (dateFrom) {
			result = result.filter((plan: any) => {
				if (!plan.startDate) return false;
				const planDate = new Date(plan.startDate);
				const fromDate = new Date(dateFrom);
				fromDate.setHours(0, 0, 0, 0);
				planDate.setHours(0, 0, 0, 0);
				return planDate >= fromDate;
			});
		}
		
		if (dateTo) {
			result = result.filter((plan: any) => {
				if (!plan.startDate) return false;
				const planDate = new Date(plan.startDate);
				const toDate = new Date(dateTo);
				toDate.setHours(23, 59, 59, 999);
				return planDate <= toDate;
			});
		}
		
		return result;
	}, [plans, searchTerm, dateFrom, dateTo]);

	const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);

	// Reset to page 1 when filters change
	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, dateFrom, dateTo]);
	
	// Reset to page 1 if current page is out of bounds
	useEffect(() => {
		if (currentPage > totalPages && totalPages > 0) {
			setCurrentPage(1);
		}
	}, [filteredPlans.length, totalPages, currentPage]);

	const paginatedPlans = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return filteredPlans.slice(startIndex, endIndex);
	}, [filteredPlans, currentPage]);

	const userDepartmentName = useMemo(() => {
		if (!effectiveDeptId || departments.length === 0) return '';
		const dept = departments.find((d) => String(d.deptId) === String(effectiveDeptId));
		return dept?.name || '';
	}, [effectiveDeptId, departments]);

	const openDetails = async (plan: any) => {
		try {
			const id = String(plan.auditId || plan.id || plan.$id || '');
			const raw = await getAuditPlanById(id);
			const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
			const normalized = normalizePlanDetails(raw, { departments, criteriaList, users: allUsers });
			setSelectedDetails(normalized);
		} catch (err) {
			console.warn('Failed to load full details, using mapped summary', err);
			// Fallback: basic shape from list
			setSelectedDetails({
				...plan,
				auditId: String(plan.auditId || plan.id || plan.$id || ''),
				scopeDepartments: { values: plan.scopeDepartments || [] },
				criteria: { values: [] },
				auditTeams: { values: [] },
				schedules: { values: [] },
				createdByUser: { fullName: 'Unknown', email: '', roleName: 'Unknown' },
				status: plan.status,
			});
		}
	};

	return (
		<MainLayout user={layoutUser}>
			<div className="px-6 py-6 space-y-6">
				<div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
					<h1 className="text-2xl font-semibold ">
						Audit Plans{userDepartmentName ? ` of ${userDepartmentName}` : ''}
					</h1>
					
					{loading && <p className="text-sm text-gray-500 mt-2">Loading...</p>}
				</div>

				<div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
					<div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
						<h2 className="text-lg font-semibold text-white">List of plans</h2>
					</div>
					
					{/* Search and Filter Bar */}
					<div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
						<div className="space-y-4">
							<div className="flex flex-col sm:flex-row gap-3">
								{/* Search Input */}
								<div className="flex-1">
									<div className="relative">
										<input
											type="text"
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											placeholder="Search by title..."
											className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
										/>
										<svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
										</svg>
									</div>
								</div>
								
								{/* Date From */}
								<div className="w-full sm:w-48">
									<input
										type="date"
										value={dateFrom}
										onChange={(e) => setDateFrom(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
										placeholder="From Date"
									/>
								</div>
								
								{/* Date To */}
								<div className="w-full sm:w-48">
									<input
										type="date"
										value={dateTo}
										onChange={(e) => setDateTo(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
										placeholder="To Date"
									/>
								</div>
								
								{/* Clear Filters */}
								{(searchTerm || dateFrom || dateTo) && (
									<button
										onClick={() => {
											setSearchTerm('');
											setDateFrom(new Date().toISOString().split('T')[0]);
											setDateTo('');
										}}
										className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
									>
										Clear
									</button>
								)}
							</div>
							
							{/* Results Count */}
							<div className="text-sm text-gray-600">
								Showing {paginatedPlans.length} of {filteredPlans.length} plans
							</div>
						</div>
					</div>
					
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">No.</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
									{/* <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Departments</th> */}
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">End Date</th>
									<th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{paginatedPlans.map((p: any, idx: number) => {
									const id = String(p.auditId || p.id || p.$id || `plan_${idx}`);
									const start = p.startDate ? new Date(p.startDate).toISOString().slice(0,10) : '';
									const end = p.endDate ? new Date(p.endDate).toISOString().slice(0,10) : '';
									const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
									return (
										<tr key={id} className="hover:bg-gray-50">
											<td className="px-6 py-3 text-sm text-primary-600 font-medium">{rowNumber}</td>
											<td className="px-6 py-3 text-sm font-semibold text-gray-900">{p.title || '—'}</td>
											{/* <td className="px-6 py-3 text-sm text-gray-700">{deptNames.length ? deptNames.join(', ') : '—'}</td> */}
											<td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{start || '—'}</td>
											<td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{end || '—'}</td>
											<td className="px-6 py-3 whitespace-nowrap text-center">
												<div className="flex items-center justify-center gap-2">
													<Button onClick={() => openDetails(p)} size="sm" variant="secondary">
														View
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
								{filteredPlans.length === 0 && !loading && (
									<tr>
										<td className="px-6 py-6 text-center text-gray-500" colSpan={5}>There are no published plans that match your department.</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					{/* Pagination */}
					{filteredPlans.length > 0 && (
						<div className="px-6 py-4 border-t border-gray-200 flex justify-center">
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={setCurrentPage}
							/>
						</div>
					)}
				</div>
			</div>
			{selectedDetails && (
				<PlanDetailsModal
					showModal={true}
					selectedPlanDetails={selectedDetails}
					onClose={() => setSelectedDetails(null)}
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
					hideSections={['auditTeam', 'auditCriteria', 'status', 'scopeDepartments']}
				/>
			)}
		</MainLayout>
	);
};

export default AuditPlans;

