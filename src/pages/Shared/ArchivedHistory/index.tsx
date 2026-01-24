import { useEffect, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans, getAuditPlanById, getSensitiveDepartments } from '../../../api/audits';
import { getAdminUsers, type AdminUserDto } from '../../../api/adminUsers';
import { getDepartments } from '../../../api/departments';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { getChecklistTemplateById } from '../../../api/checklists';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getCriterionName, getDepartmentName } from '../../../helpers/auditPlanHelpers';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor } from '../../../constants';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import ReportHistoryModal from '../../../components/ReportHistoryModal';
import { getReportRequestByAuditId } from '../../../api/reportRequest';

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
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);

  // Report History modal state
  const [showReportHistoryModal, setShowReportHistoryModal] = useState(false);
  const [reportHistoryEntityId, setReportHistoryEntityId] = useState<string>('');
  const [reportHistoryAuditTitle, setReportHistoryAuditTitle] = useState<string>('');

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

  // Handle view details
  const handleViewReportHistory = async (auditId: string, auditTitle: string) => {
    try {
      // Get the report request for this audit
      const reportRequest = await getReportRequestByAuditId(auditId);
      if (reportRequest?.reportRequestId) {
        setReportHistoryEntityId(reportRequest.reportRequestId);
        setReportHistoryAuditTitle(auditTitle);
        setShowReportHistoryModal(true);
      } else {
        setError('No report request found for this audit');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to load report request:', err);
      setError(err?.message || 'Failed to load report request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleViewDetails = async (auditId: string) => {
    setSelectedAuditId(auditId);
    setShowDetailModal(true);
    setAuditDetail(null);
    setChecklistTemplates([]);

    try {
      const [auditData, templatesData] = await Promise.allSettled([
        getAuditPlanById(auditId),
        getAuditChecklistTemplateMapsByAudit(auditId).catch(() => []),
      ]);

      // Set audit detail
      if (auditData.status === 'fulfilled') {
        const auditPayload = auditData.value?.audit || auditData.value?.data?.audit || auditData.value;
        
        // Load sensitive areas and build sensitiveAreasByDept
        try {
          const sensitiveDepts = await getSensitiveDepartments(auditId);
          
          if (sensitiveDepts && sensitiveDepts.length > 0) {
            // Build sensitiveAreasByDept map: { [deptId]: [area1, area2, ...] }
            const sensitiveAreasByDept: Record<string, string[]> = {};
            
            sensitiveDepts.forEach((sd: any) => {
              const deptId = String(sd.deptId);
              
              // Extract areas from various possible structures
              let areasArray: string[] = [];
              if (Array.isArray(sd.Areas)) {
                areasArray = sd.Areas.map((a: any) => a.sensitiveArea || String(a));
              } else if (sd.areas) {
                areasArray = Array.isArray(sd.areas) ? sd.areas : [sd.areas];
              } else if (sd.sensitiveArea) {
                areasArray = [sd.sensitiveArea];
              }
              
              if (areasArray.length > 0) {
                sensitiveAreasByDept[deptId] = areasArray;
              }
            });
            
            // Attach sensitiveAreasByDept to auditPayload
            auditPayload.sensitiveAreasByDept = sensitiveAreasByDept;
          }
        } catch (sensitiveErr) {
          console.error('Failed to load sensitive areas:', sensitiveErr);
        }
        
        setAuditDetail(auditPayload);
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
    } catch (err: any) {
      console.error('Failed to load audit details:', err);
      setError(err?.message || 'Failed to load audit details');
    } finally {
    }
  };


  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-6 animate-slideInLeft">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Archived History</h1>
            <p className="text-[#5b6166] text-sm mt-1">View archived audit plans</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Search Section */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 animate-slideInRight animate-delay-100">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, type, status, or creator..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
            />
            <div className="text-sm text-[#5b6166] whitespace-nowrap">
              {filteredAudits.length} of {audits.length} archived audits
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg mt-4">
              {error}
            </div>
          )}
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden animate-slideUp animate-delay-200 font-noto">
          <div className="bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
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
                <tbody className="bg-white">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-sm text-gray-500 text-center">
                        Loading archived audits...
                      </td>
                    </tr>
                  )}
                  {!loading && filteredAudits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-sm text-gray-500 text-center">
                        {audits.length === 0
                          ? 'No archived audits found.'
                          : 'No audits match your search criteria.'}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredAudits.map((audit, idx) => (
                      <tr key={audit.auditId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 align-middle">
                          <span className="text-sm text-gray-700">{idx + 1}</span>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className="text-sm font-bold text-black">{audit.title}</span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span className="text-sm text-[#5b6166]">{audit.type}</span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              audit.status
                            )}`}
                          >
                            {audit.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span className="text-sm text-[#5b6166]">{audit.createdDate || '—'}</span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span className="text-sm text-[#5b6166]">{audit.createdBy || '—'}</span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewDetails(audit.auditId)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="View Audit Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleViewReportHistory(audit.auditId, audit.title)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                              title="View Report History"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <PlanDetailsModal
        showModal={showDetailModal}
        selectedPlanDetails={auditDetail}
        templatesForPlan={checklistTemplates}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedAuditId('');
          setAuditDetail(null);
          setChecklistTemplates([]);
        }}
        getCriterionName={(criterionId) => getCriterionName(criterionId, criteriaList)}
        getDepartmentName={(deptId) => getDepartmentName(deptId, departments)}
        getStatusColor={getStatusColor}
        getBadgeVariant={getBadgeVariant}
        getAuditTypeBadgeColor={getAuditTypeBadgeColor}
        ownerOptions={adminUsers}
        auditorOptions={adminUsers}
      />

      <ReportHistoryModal
        isOpen={showReportHistoryModal}
        onClose={() => {
          setShowReportHistoryModal(false);
          setReportHistoryEntityId('');
          setReportHistoryAuditTitle('');
        }}
        reportRequestId={reportHistoryEntityId}
        auditTitle={reportHistoryAuditTitle}
      />
    </MainLayout>
  );
};

export default ArchivedHistoryPage;

