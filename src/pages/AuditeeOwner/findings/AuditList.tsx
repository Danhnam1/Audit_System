import { MainLayout } from '../../../layouts';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import { getAuditPlanById } from '../../../api/audits';
import { DataTable } from '../../../components/DataTable';
import type { TableColumn } from '../../../components/DataTable';

interface AuditCard {
  auditId: string;
  auditTitle: string;
  auditType: string;
  scope?: string;
  status: string;
  findingCount: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  createdBy?: string;
  objective?: string;
  isPublished?: boolean;
  rawData?: any; // Store raw data for debugging
}

const getStatusBadgeColor = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  switch (statusLower) {
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'in progress':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800 border border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
};

const getAuditTypeBadgeColor = (auditType: string) => {
  const typeLower = auditType?.toLowerCase() || '';
  switch (typeLower) {
    case 'internal':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'external':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'compliance':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
};

const AuditeeOwnerAuditList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Get user's department ID from token
  const getUserDeptId = (): number | null => {
    const token = localStorage.getItem('auth-storage');
    if (!token) return null;

    try {
      const authData = JSON.parse(token);
      const jwtToken = authData?.state?.token;
      if (jwtToken) {
        const base64Url = jwtToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const deptId = payload['DeptId'];
        return deptId ? parseInt(deptId) : null;
      }
    } catch (err) {
      console.error('Error parsing token:', err);
    }
    return null;
  };

  useEffect(() => {
    const loadAudits = async () => {
      setLoading(true);
      setError(null);

      try {
        const deptId = getUserDeptId();
        if (!deptId) {
          setError('Department ID not found in token');
          setLoading(false);
          return;
        }

        const findings = await getFindingsByDepartment(deptId);
        
        // Log each finding's status
        if (findings && findings.length > 0) {
          findings.forEach((f: Finding, index: number) => {
          
          });
        }

        if (!findings || findings.length === 0) {
          setAudits([]);
          setLoading(false);
          return;
        }

        // Filter out archived findings
        const activeFindings = findings.filter((f: Finding) => {
          const statusLower = (f.status || '').toLowerCase().trim();
          const isArchived = statusLower === 'archived';
          if (isArchived) {
          }
          return !isArchived;
        });
        

        // Group findings by auditId
        const auditMap = new Map<string, Finding[]>();
        activeFindings.forEach((finding: Finding) => {
          // Try to get auditId from multiple possible locations
          const auditId = finding.auditId || (finding as any).audit?.auditId;
          if (!auditId) {
          } else {
            if (!auditMap.has(auditId)) {
              auditMap.set(auditId, []);
            }
            auditMap.get(auditId)!.push(finding);
          }
        });

    

        // Load audit info and create audit cards
        const auditPromises = Array.from(auditMap.entries()).map(async ([auditId, auditFindings]) => {
          try {
            
            // Get initial audit data from finding (as fallback)
            const findingWithAudit = auditFindings.find(f => (f as any).audit);
            const nestedAuditData = findingWithAudit ? (findingWithAudit as any).audit : null;
            
            const auditData = await getAuditPlanById(auditId);
            
        

            // Try multiple possible field names for title (with nested audit data as fallback)
            let auditTitle = auditData.title ||
              auditData.Title ||
              auditData.name ||
              auditData.Name ||
              auditData.auditTitle ||
              auditData.audit?.title ||
              auditData.audit?.Title ||
              auditData.audit?.name ||
              auditData.audit?.Name ||
              auditData.audit?.auditTitle ||
              nestedAuditData?.title ||
              nestedAuditData?.Title ||
              '';

            if (!auditTitle) {
              auditTitle = `Audit ${auditId.substring(0, 8)}...`;
            } else {
            }

            const auditType = auditData.type ||
              auditData.Type ||
              auditData.auditType ||
              auditData.audit?.type ||
              auditData.audit?.Type ||
              auditData.audit?.auditType ||
              nestedAuditData?.type ||
              nestedAuditData?.Type || '';

            const status = auditData.status ||
              auditData.Status ||
              auditData.auditStatus ||
              auditData.audit?.status ||
              auditData.audit?.Status ||
              nestedAuditData?.status ||
              nestedAuditData?.Status ||
              'Unknown';

            const scope = auditData.scope ||
              auditData.Scope ||
              auditData.auditScope ||
              auditData.audit?.scope ||
              nestedAuditData?.scope ||
              nestedAuditData?.Scope ||
              '';

            const objective = auditData.objective ||
              auditData.Objective ||
              auditData.goal ||
              auditData.audit?.objective ||
              nestedAuditData?.objective ||
              nestedAuditData?.Objective ||
              '';

            const createdAt = auditData.createdAt ||
              auditData.CreatedAt ||
              auditData.created ||
              auditData.audit?.createdAt ||
              nestedAuditData?.createdAt ||
              nestedAuditData?.CreatedAt ||
              '';

            const createdBy = auditData.createdBy ||
              auditData.CreatedBy ||
              auditData.createdByUser?.fullName ||
              auditData.audit?.createdBy ||
              nestedAuditData?.createdBy ||
              nestedAuditData?.CreatedBy ||
              '';

            const auditCard: AuditCard = {
              auditId: auditId,
              auditTitle: auditTitle,
              auditType: auditType,
              scope: scope,
              status: status,
              findingCount: auditFindings.length,
              startDate: auditData.startDate || auditData.audit?.startDate || nestedAuditData?.startDate,
              endDate: auditData.endDate || auditData.audit?.endDate || nestedAuditData?.endDate,
              createdAt: createdAt,
              createdBy: createdBy,
              objective: objective,
              isPublished: auditData.isPublished,
              rawData: auditData,
            };
            return auditCard;
          } catch (err) {
            console.error(` Error loading audit ${auditId}:`, err);
            // Fallback: create card with basic info
            return {
              auditId: auditId,
              auditTitle: `Audit ${auditId.substring(0, 8)}...`,
              auditType: '',
              status: 'Unknown',
              findingCount: auditFindings.length,
            };
          }
        });

        const auditResults = await Promise.all(auditPromises);
        const validAudits: AuditCard[] = auditResults.filter((audit): audit is AuditCard => audit !== null);

        // Filter out audits with status "Archived" or "Inactive"
        const nonArchivedAudits = validAudits.filter((audit) => {
          const status = audit.status || '';
          const statusLower = String(status).toLowerCase().trim();

          // Filter out "Archived" and "Inactive" status
          const shouldFilter = statusLower === 'archived' || 
                               statusLower === 'archive' || 
                               statusLower === 'inactive';

          if (shouldFilter) {
          } else {
          }

          return !shouldFilter;
        });

      

        setAudits(nonArchivedAudits);
      } catch (err: any) {
        console.error(' Error loading audits:', err);
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    loadAudits();
  }, []);

  const handleAuditClick = (audit: AuditCard) => {
    navigate(`/auditee-owner/findings/audit/${audit.auditId}`, {
      state: { auditId: audit.auditId, auditTitle: audit.auditTitle }
    });
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="  mb-6 px-6">
        <div className="rounded-xl border-b  shadow-sm  border-primary-100 bg-white px-6 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black">Fingding management</h1>

          </div>
        
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading audits...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-semibold">Error loading audits</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Available Audits - Table View */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <DataTable
              columns={[
                {
                  key: 'no',
                  header: 'No.',
                  cellClassName: 'whitespace-nowrap',
                  render: (_, index) => (
                    <span className="text-sm text-gray-700">{index + 1}</span>
                  ),
                },
                {
                  key: 'auditTitle',
                  header: 'Audit Title',
                  render: (audit: AuditCard) => (
                    <div className="max-w-[250px]">
                      <p className="text-sm font-semibold text-gray-900 truncate">{audit.auditTitle}</p>
                    </div>
                  ),
                },
                {
                  key: 'type',
                  header: 'Type',
                  cellClassName: 'whitespace-nowrap',
                  render: (audit: AuditCard) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getAuditTypeBadgeColor(audit.auditType)}`}>
                      {audit.auditType || 'N/A'}
                    </span>
                  ),
                },
                {
                  key: 'scope',
                  header: 'Scope',
                  cellClassName: 'whitespace-nowrap',
                  render: (audit: AuditCard) => (
                    <span className="text-sm text-gray-700">{audit.scope || 'N/A'}</span>
                  ),
                },
                {
                  key: 'period',
                  header: 'Period',
                  cellClassName: 'whitespace-nowrap',
                  render: (audit: AuditCard) => {
                    const formatDate = (dateStr?: string) => {
                      if (!dateStr) return 'N/A';
                      try {
                        return new Date(dateStr).toLocaleDateString();
                      } catch {
                        return dateStr;
                      }
                    };
                    return (
                      <div className="text-sm text-gray-600">
                        {formatDate(audit.startDate)} - {formatDate(audit.endDate)}
                      </div>
                    );
                  },
                },
                {
                  key: 'status',
                  header: 'Status',
                  cellClassName: 'whitespace-nowrap',
                  render: (audit: AuditCard) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(audit.status)}`}>
                      {audit.status || 'Unknown'}
                    </span>
                  ),
                },
                {
                  key: 'findingCount',
                  header: 'Findings',
                  cellClassName: 'whitespace-nowrap text-center',
                  align: 'center' as const,
                  render: (audit: AuditCard) => (
                    <div className="flex items-center justify-center gap-1">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-900">{audit.findingCount}</span>
                    </div>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Created At',
                  cellClassName: 'whitespace-nowrap',
                  render: (audit: AuditCard) => {
                    if (!audit.createdAt) return <span className="text-sm text-gray-500">N/A</span>;
                    try {
                      const date = new Date(audit.createdAt);
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const year = date.getFullYear();
                      return (
                        <span className="text-sm text-gray-600">
                          {hours}:{minutes} {day}/{month}/{year}
                        </span>
                      );
                    } catch {
                      return <span className="text-sm text-gray-500">{audit.createdAt}</span>;
                    }
                  },
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  align: 'center' as const,
                  cellClassName: 'whitespace-nowrap text-center',
                  render: (audit: AuditCard) => (
                    <button
                      onClick={() => handleAuditClick(audit)}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1 mx-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                  ),
                },
              ] as TableColumn<AuditCard>[]}
              data={audits}
              loading={false}
              emptyState="No audits available. Audits will appear here when findings are assigned to your department."
              rowKey={(audit) => audit.auditId}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AuditeeOwnerAuditList;

