import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditPlanById, getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { getFindingsByAudit } from '../../../api/findings';
import { getActionsByFinding } from '../../../api/actions';
import { getAttachments } from '../../../api/attachments';
import { getAdminUsers, getUserById, type AdminUserDto } from '../../../api/adminUsers';
import { getDepartments } from '../../../api/departments';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getCriteriaForAudit } from '../../../api/auditCriteriaMap';
import { getAuditCriterionById } from '../../../api/auditCriteria';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { getChecklistTemplateById } from '../../../api/checklists';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getDepartmentName as resolveDeptName } from '../../../helpers/auditPlanHelpers';
import { getCriterionName } from '../../../helpers/auditPlanHelpers';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';

interface AuditRow {
  auditId: string;
  title: string;
  status: string;
  type: string;
  createdDate: string;
  createdBy: string;
}

const ArchivedHistoryPage = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  
  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [, setSelectedAuditId] = useState<string>('');
  const [auditDetail, setAuditDetail] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  
  // Additional plan details
  const [scopeDepartments, setScopeDepartments] = useState<any[]>([]);
  const [auditTeam, setAuditTeam] = useState<any[]>([]);
  const [auditCriteria, setAuditCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [auditSchedules, setAuditSchedules] = useState<any[]>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);

  // Load admin users, departments, and criteria for name resolution
  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, depts, criteria] = await Promise.all([
          getAdminUsers(),
          getDepartments(),
          getAuditCriteria().catch(() => [])
        ]);
        setAdminUsers(Array.isArray(users) ? users : []);
        const deptList = Array.isArray(depts)
          ? depts.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
          : [];
        setDepartments(deptList);
        setCriteriaList(Array.isArray(criteria) ? criteria : []);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

  // Helper function to resolve user name from userId
  const getCreatedByLabel = (a: any): string => {
    const src =
      a?.createdByUser ||
      a?.createdBy ||
      a?.submittedBy;
    if (!src) return '—';

    const normalize = (v: any) => String(v || '').toLowerCase().trim();

    if (typeof src === 'string') {
      const sNorm = normalize(src);
      const found = adminUsers.find(u => {
        const id = u.userId || (u as any).$id;
        const email = u.email;
        return (id && normalize(id) === sNorm) || (email && normalize(email) === sNorm);
      });
      if (found?.fullName) return found.fullName;
      if (found?.email) return found.email;
      return src;
    }

    if (src.fullName) return src.fullName;
    if (src.email) return src.email;

    const id = src.userId || src.id || src.$id;
    if (id) {
      const idNorm = normalize(id);
      const foundById = adminUsers.find(u => {
        const uid = u.userId || (u as any).$id;
        return uid && normalize(uid) === idNorm;
      });
      if (foundById?.fullName) return foundById.fullName;
      if (foundById?.email) return foundById.email;
      return String(id);
    }

    return '—';
  };

  useEffect(() => {
    const loadArchivedAudits = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAuditPlans();
        const arr = unwrap(res);
        // Filter only archived audits
        const archived = (Array.isArray(arr) ? arr : []).filter((a: any) => {
          const status = String(a.status || a.state || a.approvalStatus || '').toLowerCase().trim();
          return status === 'archived';
        });

        // Map to AuditRow format
        const mapped: AuditRow[] = archived.map((a: any, idx: number) => {
          const id = String(a.auditId || a.id || a.$id || `audit_${idx}`);
          const title = a.title || a.name || `Audit ${idx + 1}`;
          const type = a.type || a.auditType || a.category || '—';
          const rawStatus = a.status || a.state || a.approvalStatus || 'Archived';
          const createdRaw = a.createdAt || a.startDate || a.createdDate || a.start;
          const createdDate = createdRaw ? new Date(createdRaw).toISOString().slice(0, 10) : '';
          const createdBy = getCreatedByLabel(a);

          return {
            auditId: id,
            title,
            status: rawStatus,
            type,
            createdDate,
            createdBy,
          };
        });

        setAudits(mapped);
      } catch (err: any) {
        console.error('Failed to load archived audits:', err);
        setError(err?.message || 'Failed to load archived audits');
      } finally {
        setLoading(false);
      }
    };

    loadArchivedAudits();
  }, [adminUsers]);

  const filteredAudits = audits.filter((audit) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      audit.title.toLowerCase().includes(searchLower) ||
      audit.type.toLowerCase().includes(searchLower) ||
      audit.status.toLowerCase().includes(searchLower) ||
      audit.createdBy.toLowerCase().includes(searchLower)
    );
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Draft Report': 'bg-gray-100 text-gray-700 border-gray-200',
      'Final Report': 'bg-primary-100 text-primary-700 border-primary-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // Handle view details
  const handleViewDetails = async (auditId: string) => {
    setSelectedAuditId(auditId);
    setShowDetailModal(true);
    setLoadingDetail(true);
    setAuditDetail(null);
    setFindings([]);
    setExpandedFindings(new Set());
    setScopeDepartments([]);
    setAuditTeam([]);
    setAuditCriteria([]);
    setChecklistTemplates([]);
    setAuditSchedules([]);

    try {
      // Load all data in parallel
      const [
        auditData,
        findingsData,
        scopeDeptsData,
        teamData,
        criteriaMapData,
        templatesData,
        schedulesData,
      ] = await Promise.allSettled([
        getAuditPlanById(auditId),
        getFindingsByAudit(auditId),
        getAuditScopeDepartmentsByAuditId(auditId).catch(() => []),
        getAuditorsByAuditId(auditId).catch(() => []),
        getCriteriaForAudit(auditId).catch(() => []),
        getAuditChecklistTemplateMapsByAudit(auditId).catch(() => []),
        getAuditSchedules(auditId).catch(() => []),
      ]);

      // Set audit detail
      if (auditData.status === 'fulfilled') {
        const auditPayload = auditData.value?.audit || auditData.value?.data?.audit || auditData.value;
        setAuditDetail(auditPayload);
      }

      // Set scope departments with department names
      if (scopeDeptsData.status === 'fulfilled') {
        const deptList = unwrap(scopeDeptsData.value);
        const deptArray = Array.isArray(deptList) ? deptList : [];
        // Enrich with department names
        const enrichedDepts = deptArray.map((dept: any) => {
          const deptId = dept.deptId || dept.id || dept.$id;
          const deptName = dept.deptName || resolveDeptName(String(deptId || ''), departments) || `Department ${deptId || ''}`;
          return {
            ...dept,
            deptName: deptName,
          };
        });
        setScopeDepartments(enrichedDepts);
      }

      // Set audit team with user names - get all auditor names
      if (teamData.status === 'fulfilled') {
        const teamList = unwrap(teamData.value);
        const teamArray = Array.isArray(teamList) ? teamList : [];
        const enrichedTeam = await Promise.all(
          teamArray.map(async (member: any) => {
            try {
              const userId = member.userId || member.id || member.$id;
              let fullName = member.fullName || '—';
              let email = member.email || '—';
              
              // Try to get user name from userId
              if (userId) {
                // First try from adminUsers list (already loaded)
                const foundUser = adminUsers.find((u: any) => {
                  const uId = u.userId || (u as any).$id;
                  return String(uId) === String(userId);
                });
                
                if (foundUser) {
                  fullName = foundUser.fullName || foundUser.email || fullName;
                  email = foundUser.email || email;
                } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId))) {
                  // If not found in list, try API call
                  const user = await getUserById(String(userId)).catch(() => null);
                  if (user) {
                    fullName = user.fullName || user.email || fullName;
                    email = user.email || email;
                  }
                }
              }
              
              return {
                ...member,
                fullName: fullName,
                email: email,
              };
            } catch (err) {
              return { ...member, fullName: member.fullName || '—', email: member.email || '—' };
            }
          })
        );
        setAuditTeam(enrichedTeam);
      }

      // Set audit criteria with names
      if (criteriaMapData.status === 'fulfilled') {
        const criteriaMapList = unwrap(criteriaMapData.value);
        const criteriaArray = Array.isArray(criteriaMapList) ? criteriaMapList : [];
        const enrichedCriteria = await Promise.allSettled(
          criteriaArray.map(async (item: any) => {
            try {
              const criterionDetail = await getAuditCriterionById(item.criteriaId || item.criterionId).catch(() => null);
              return {
                criteriaId: item.criteriaId || item.criterionId,
                name: criterionDetail?.name || getCriterionName(item.criteriaId || item.criterionId, criteriaList) || 'N/A',
                description: criterionDetail?.description || 'No description',
                referenceCode: criterionDetail?.referenceCode || 'N/A',
              };
            } catch (err) {
              return {
                criteriaId: item.criteriaId || item.criterionId,
                name: getCriterionName(item.criteriaId || item.criterionId, criteriaList) || 'N/A',
                description: 'No description',
                referenceCode: 'N/A',
              };
            }
          })
        );
        const validCriteria = enrichedCriteria
          .filter((r) => r.status === 'fulfilled')
          .map((r) => (r as PromiseFulfilledResult<any>).value);
        setAuditCriteria(validCriteria);
      }

      // Set checklist templates with full template details
      if (templatesData.status === 'fulfilled') {
        const templatesList = unwrap(templatesData.value);
        const templatesArray = Array.isArray(templatesList) ? templatesList : [];
        
        // Enrich templates with full details from templateId
        const enrichedTemplates = await Promise.allSettled(
          templatesArray.map(async (map: any) => {
            try {
              const templateId = map.templateId || map.id || map.$id;
              if (!templateId) return map;
              
              const templateDetail = await getChecklistTemplateById(String(templateId)).catch(() => null);
              if (templateDetail) {
                return {
                  ...map,
                  title: templateDetail.name || 'Untitled Template',
                  name: templateDetail.name || 'Untitled Template',
                  version: templateDetail.version || '—',
                  description: templateDetail.description || '—',
                  deptId: templateDetail.deptId || map.deptId,
                };
              }
              
              return {
                ...map,
                title: map.name || (map as any).title || 'Untitled Template',
                name: map.name || (map as any).title || 'Untitled Template',
                version: map.version || '—',
                description: map.description || '—',
              };
            } catch (err) {
              console.error('Error loading template detail:', err);
              return {
                ...map,
                title: map.name || map.title || 'Untitled Template',
                name: map.name || map.title || 'Untitled Template',
                version: map.version || '—',
                description: map.description || '—',
              };
            }
          })
        );
        
        const validTemplates = enrichedTemplates
          .filter((r) => r.status === 'fulfilled')
          .map((r) => (r as PromiseFulfilledResult<any>).value);
        setChecklistTemplates(validTemplates);
      }

      // Set audit schedules
      if (schedulesData.status === 'fulfilled') {
        const schedulesList = unwrap(schedulesData.value);
        setAuditSchedules(Array.isArray(schedulesList) ? schedulesList : []);
      }

      // Load findings
      if (findingsData.status === 'fulfilled') {
        const findingsList = Array.isArray(findingsData.value) ? findingsData.value : [];

        // Enrich findings with actions, attachments, and resolve all IDs to names
        const enrichedFindings = await Promise.all(
          findingsList.map(async (finding: any) => {
            try {
              // Resolve department name
              const deptId = finding.deptId || finding.departmentId;
              const deptName = deptId ? resolveDeptName(String(deptId), departments) : '—';
              
              // Resolve created by name
              const createdById = finding.createdBy || finding.createdByUser?.userId || finding.createdByUser?.id;
              let createdByName = '—';
              if (createdById) {
                const foundUser = adminUsers.find((u: any) => {
                  const uId = u.userId || (u as any).$id;
                  return String(uId) === String(createdById);
                });
                if (foundUser) {
                  createdByName = foundUser.fullName || foundUser.email || '—';
                } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(createdById))) {
                  try {
                    const user = await getUserById(String(createdById)).catch(() => null);
                    createdByName = user?.fullName || user?.email || '—';
                  } catch (err) {
                    // Ignore
                  }
                }
              }
              
              const [findingAttachments, actions] = await Promise.all([
                getAttachments('finding', finding.findingId || finding.id).catch(() => []),
                getActionsByFinding(finding.findingId || finding.id).catch(() => []),
              ]);

              // Enrich actions with attachments and user names
              const enrichedActions = await Promise.all(
                (actions || []).map(async (action: any) => {
                  try {
                    // Resolve assignedTo name
                    let assignedUserName = action.assignedTo || '—';
                    if (action.assignedTo) {
                      const foundUser = adminUsers.find((u: any) => {
                        const uId = u.userId || (u as any).$id;
                        return String(uId) === String(action.assignedTo);
                      });
                      if (foundUser) {
                        assignedUserName = foundUser.fullName || foundUser.email || assignedUserName;
                      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.assignedTo)) {
                        try {
                          const user = await getUserById(action.assignedTo).catch(() => null);
                          assignedUserName = user?.fullName || user?.email || assignedUserName;
                        } catch (err) {
                          // Ignore
                        }
                      }
                    }
                    
                    const [actionAttachments] = await Promise.all([
                      getAttachments('Action', action.actionId || action.id).catch(() => []),
                    ]);

                    return {
                      ...action,
                      attachments: actionAttachments || [],
                      assignedUserName: assignedUserName,
                    };
                  } catch (err) {
                    console.error('Error enriching action:', err);
                    return { ...action, attachments: [], assignedUserName: action.assignedTo || '—' };
                  }
                })
              );

              return {
                ...finding,
                deptName: deptName, // Add resolved department name
                createdByName: createdByName, // Add resolved creator name
                attachments: findingAttachments || [],
                actions: enrichedActions,
              };
            } catch (err) {
              console.error('Error enriching finding:', err);
              return { ...finding, attachments: [], actions: [], deptName: '—', createdByName: '—' };
            }
          })
        );

        setFindings(enrichedFindings);
      }
    } catch (err: any) {
      console.error('Failed to load audit details:', err);
      setError(err?.message || 'Failed to load audit details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleFindingExpansion = (findingId: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const severityColor = (sev: string) => {
    const k = String(sev || '').toLowerCase();
    if (k.includes('critical') || k.includes('high') || k.includes('major')) return '#ef4444';
    if (k.includes('medium') || k.includes('normal')) return '#f59e0b';
    return '#3b82f6'; // minor/low default
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Archived History</h1>
            <p className="text-gray-600 text-sm mt-1">View archived audit plans</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Archived Audit Plans</h2>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Search bar */}
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, type, status, or creator..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <div className="text-sm text-gray-500">
                {filteredAudits.length} of {audits.length} archived audits
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-sm text-gray-500 text-center">
                      Loading archived audits...
                    </td>
                  </tr>
                )}
                {!loading && filteredAudits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-sm text-gray-500 text-center">
                      {audits.length === 0
                        ? 'No archived audits found.'
                        : 'No audits match your search criteria.'}
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredAudits.map((audit, idx) => (
                    <tr key={audit.auditId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{audit.title}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(
                            audit.type
                          )}`}
                        >
                          {audit.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            audit.status
                          )}`}
                        >
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{audit.createdDate || '—'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">{audit.createdBy || '—'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewDetails(audit.auditId)}
                          className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-primary flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Audit Plan Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAuditId('');
                  setAuditDetail(null);
                  setFindings([]);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading audit details...</div>
                </div>
              ) : (
                <>
                  {/* Audit Plan Information */}
                  {auditDetail && (
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                        <h3 className="text-base font-bold text-primary-700">Audit Plan Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Title:</span>
                          <span className="text-sm text-gray-900 flex-1">{auditDetail.title || auditDetail.name || '—'}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Type:</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-700`}>
                            {auditDetail.type || auditDetail.auditType || '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Status:</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getStatusColor(auditDetail.status || auditDetail.state || '')}`}>
                            {auditDetail.status || auditDetail.state || '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Start Date:</span>
                          <span className="text-sm text-gray-900">
                            {auditDetail.startDate ? new Date(auditDetail.startDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">End Date:</span>
                          <span className="text-sm text-gray-900">
                            {auditDetail.endDate ? new Date(auditDetail.endDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Created By:</span>
                          <span className="text-sm text-gray-900">{getCreatedByLabel(auditDetail)}</span>
                        </div>
                        {auditDetail.scope && (
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Scope:</span>
                            <span className="text-xs px-2 py-0.5 rounded-full text-gray-900 font-medium">
                              {auditDetail.scope}
                            </span>
                          </div>
                        )}
                        {auditDetail.objective && (
                          <div className="flex items-start gap-3 md:col-span-2">
                            <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Objective:</span>
                            <span className="text-sm text-gray-900 flex-1 leading-relaxed">{auditDetail.objective}</span>
                          </div>
                        )}
                        {auditDetail.description && (
                          <div className="flex items-start gap-3 md:col-span-2">
                            <span className="text-xs font-semibold text-gray-600 w-[100px] flex-shrink-0">Description:</span>
                            <span className="text-sm text-gray-900 flex-1 leading-relaxed">{auditDetail.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scope Departments Section */}
                  {scopeDepartments.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Scope Departments</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {scopeDepartments.map((dept: any, idx: number) => {
                          const deptName = dept.deptName || resolveDeptName(String(dept.deptId || ''), departments) || `Department ${dept.deptId || idx + 1}`;
                          return (
                            <div
                              key={idx}
                              className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-primary-300 transition-all"
                            >
                              <p className="text-sm font-semibold text-gray-900 text-center">{deptName}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Audit Criteria Section */}
                  {auditCriteria.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Criteria</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {auditCriteria.map((criterion: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                          >
                            <div className="bg-primary-600 rounded-full p-1">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-sm text-gray-900">{criterion.name || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit Team Section */}
                  {auditTeam.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Team</h3>
                      <div className="space-y-2">
                        {auditTeam
                          .filter((m: any) => String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '') !== 'auditeeowner')
                          .sort((a: any, b: any) => {
                            if (a.isLead && !b.isLead) return -1;
                            if (!a.isLead && b.isLead) return 1;
                            return 0;
                          })
                          .map((member: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50"
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                member.isLead ? 'bg-primary-600' : 'bg-gray-300'
                              }`}>
                                <span className={`text-xs font-bold ${
                                  member.isLead ? 'text-white' : 'text-gray-700'
                                }`}>
                                  {member.fullName?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm ${member.isLead ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
                                    {member.fullName || '—'}
                                  </span>
                                  {member.isLead && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary-600 text-white">
                                      Lead Auditor
                                    </span>
                                  )}
                                  {member.roleInTeam && !member.isLead && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-700">
                                      {member.roleInTeam}
                                    </span>
                                  )}
                                </div>
                                {member.email && (
                                  <p className="text-xs text-gray-500 mt-1">{member.email}</p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Checklist Templates Section */}
                  {checklistTemplates.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Checklist Templates</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {checklistTemplates.map((tpl: any, index: number) => {
                          const displayName = tpl.title || tpl.name || tpl.templateName || `Template ${index + 1}`;
                          const version = tpl.version;
                          const description = tpl.description;
                          const deptId = tpl.deptId;
                          const deptName = deptId != null ? resolveDeptName(String(deptId), departments) : null;

                          return (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-gray-900 flex-1 line-clamp-2">
                                  {displayName}
                                </h4>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                                  {index + 1}
                                </span>
                              </div>
                              {version && (
                                <div className="text-xs text-gray-600 mb-1">
                                  <span className="font-semibold">Version:</span> {version}
                                </div>
                              )}
                              {deptName && (
                                <div className="text-xs text-gray-600 mb-1">
                                  <span className="font-semibold">Department:</span> {deptName}
                                </div>
                              )}
                              {description && (
                                <p className="text-xs text-gray-600 line-clamp-3 mt-2">{description}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Schedule & Milestones Section */}
                  {auditSchedules.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule & Milestones</h3>
                      <div className="space-y-3">
                        {auditSchedules
                          .sort((a: any, b: any) => {
                            const ta = a?.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                            const tb = b?.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                            return ta - tb;
                          })
                          .map((schedule: any, idx: number) => {
                            const milestoneName = schedule.milestoneName || schedule.name || `Milestone ${idx + 1}`;
                            const dueDate = schedule.dueDate ? new Date(schedule.dueDate).toLocaleDateString() : '—';
                            return (
                              <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">{idx + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{milestoneName}</p>
                                  {schedule.notes && (
                                    <p className="text-xs text-gray-600 mt-1">{schedule.notes}</p>
                                  )}
                                </div>
                                <div className="text-sm text-gray-700 font-medium">{dueDate}</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Findings Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Findings</h3>
                      <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                        {findings.length} Total
                      </span>
                    </div>

                    {findings.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No findings found for this audit.</p>
                    ) : (
                      <div className="space-y-4">
                        {findings.map((finding: any, idx: number) => {
                          const isExpanded = expandedFindings.has(finding.findingId || finding.id);
                          return (
                            <div key={finding.findingId || finding.id || idx} className="border border-gray-200 rounded-lg overflow-hidden">
                              {/* Finding Header */}
                              <div
                                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                                onClick={() => toggleFindingExpansion(finding.findingId || finding.id)}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-gray-900">{finding.title || 'Untitled Finding'}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                                        style={{
                                          backgroundColor: severityColor(finding.severity) + '20',
                                          color: severityColor(finding.severity),
                                        }}
                                      >
                                        {finding.severity || 'N/A'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {resolveDeptName(String(finding.deptId || ''), departments) || '—'}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(finding.status || '')}`}>
                                        {finding.status || '—'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {finding.actions?.length > 0 && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                      {finding.actions.length} Action(s)
                                    </span>
                                  )}
                                  {finding.attachments?.length > 0 && (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                      {finding.attachments.length} File(s)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Finding Details (Expanded) */}
                              {isExpanded && (
                                <div className="px-4 py-4 space-y-4 bg-white">
                                  {finding.description && (
                                    <div>
                                      <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                                      <p className="text-sm text-gray-900 mt-1">{finding.description}</p>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                    {finding.deadline && (
                                      <div>
                                        <span className="text-gray-500">Deadline:</span>
                                        <p className="text-gray-900 font-medium mt-1">
                                          {new Date(finding.deadline).toLocaleDateString()}
                                        </p>
                                      </div>
                                    )}
                                    {finding.createdByName && (
                                      <div>
                                        <span className="text-gray-500">Created By:</span>
                                        <p className="text-gray-900 font-medium mt-1">{finding.createdByName}</p>
                                      </div>
                                    )}
                                    {finding.status && (
                                      <div>
                                        <span className="text-gray-500">Status:</span>
                                        <p className="text-gray-900 font-medium mt-1">{finding.status}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  {finding.actions && finding.actions.length > 0 && (
                                    <div>
                                      <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Actions</label>
                                      <div className="space-y-3">
                                        {finding.actions.map((action: any, actionIdx: number) => (
                                          <div key={action.actionId || action.id || actionIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                            <div className="flex items-center justify-between mb-2">
                                              <h5 className="text-sm font-semibold text-gray-900">{action.title || 'Untitled Action'}</h5>
                                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(action.status || '')}`}>
                                                {action.status || '—'}
                                              </span>
                                            </div>
                                            {action.description && (
                                              <p className="text-xs text-gray-600 mb-2">{action.description}</p>
                                            )}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-500">Assigned To:</span>
                                                <p className="text-gray-900 font-medium">{action.assignedUserName || '—'}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Progress:</span>
                                                <p className="text-gray-900 font-medium">{action.progressPercent || 0}%</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Due Date:</span>
                                                <p className="text-gray-900 font-medium">
                                                  {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : '—'}
                                                </p>
                                              </div>
                                              {action.attachments && action.attachments.length > 0 && (
                                                <div>
                                                  <span className="text-gray-500">Attachments:</span>
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {action.attachments.map((att: any, attIdx: number) => {
                                                      const fileUrl = att.filePath || att.blobPath || att.url || att.link;
                                                      const fileName = att.fileName || att.originalFileName || att.name || `File ${attIdx + 1}`;
                                                      if (fileUrl) {
                                                        return (
                                                          <a
                                                            key={att.attachmentId || att.id || attIdx}
                                                            href={fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors cursor-pointer"
                                                            title={fileName}
                                                          >
                                                            📎 {fileName.length > 15 ? fileName.substring(0, 15) + '...' : fileName}
                                                          </a>
                                                        );
                                                      }
                                                      return (
                                                        <span
                                                          key={att.attachmentId || att.id || attIdx}
                                                          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded cursor-not-allowed"
                                                          title="No download link available"
                                                        >
                                                          📎 {fileName.length > 15 ? fileName.substring(0, 15) + '...' : fileName}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                              {(!action.attachments || action.attachments.length === 0) && (
                                                <div>
                                                  <span className="text-gray-500">Attachments:</span>
                                                  <p className="text-gray-900 font-medium">0</p>
                                                </div>
                                              )}
                                            </div>
                                            {action.reviewFeedback && (
                                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                <span className="font-medium text-yellow-800">Review Feedback:</span>
                                                <p className="text-yellow-700 mt-1">{action.reviewFeedback}</p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Finding Attachments */}
                                  {finding.attachments && finding.attachments.length > 0 && (
                                    <div>
                                      <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Attachments</label>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {finding.attachments.map((att: any, attIdx: number) => {
                                          const fileUrl = att.filePath || att.blobPath || att.url || att.link;
                                          const fileName = att.fileName || att.originalFileName || att.name || `File ${attIdx + 1}`;
                                          const fileSize = att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : '—';
                                          if (fileUrl) {
                                            return (
                                              <a
                                                key={att.attachmentId || att.id || attIdx}
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 bg-white hover:bg-primary-50 hover:border-primary-300 transition-all cursor-pointer group"
                                              >
                                                <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{fileName}</p>
                                                  <p className="text-xs text-gray-500 mt-0.5">{fileSize}</p>
                                                </div>
                                                <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                              </a>
                                            );
                                          }
                                          return (
                                            <div
                                              key={att.attachmentId || att.id || attIdx}
                                              className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50 opacity-60"
                                              title="No download link available"
                                            >
                                              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-500 truncate">{fileName}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{fileSize}</p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAuditId('');
                  setAuditDetail(null);
                  setFindings([]);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </MainLayout>
  );
};

export default ArchivedHistoryPage;

