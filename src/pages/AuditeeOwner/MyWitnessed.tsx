import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { getMyWitnessedFindings, type Finding } from '../../api/findings';

interface FindingWithAudit extends Finding {
  auditTitle?: string;
  auditType?: string;
}

interface GroupedAudit {
  auditId: string;
  auditTitle: string;
  auditType: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  findingsCount: number;
}

const MyWitnessed = () => {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedAudits, setGroupedAudits] = useState<GroupedAudit[]>([]);

  useEffect(() => {
    const fetchWitnessedFindings = async () => {
      try {
        setLoading(true);

        // Fetch witnessed findings from dedicated API endpoint
        const witnessedFindings = await getMyWitnessedFindings();

        // API already returns audit object, just extract the needed fields
        const findingsWithAudit = witnessedFindings.map((finding) => ({
          ...finding,
          auditTitle: finding.audit?.title || 'N/A',
          auditType: finding.audit?.type || 'N/A',
        }));

        setFindings(findingsWithAudit);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching witnessed findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchWitnessedFindings();
  }, []);

  // Group findings by audit - fix: use finding.audit?.auditId || finding.auditId
  useEffect(() => {
    const auditMap = new Map<string, GroupedAudit>();

    findings.forEach((finding) => {
      // Fix: Use audit.auditId if available, fallback to finding.auditId
      const auditId = finding.audit?.auditId || finding.auditId;
      
      if (!auditId) {
        console.warn('Finding missing auditId:', finding);
        return;
      }

      if (auditMap.has(auditId)) {
        const existing = auditMap.get(auditId)!;
        existing.findingsCount += 1;
      } else {
        auditMap.set(auditId, {
          auditId: auditId,
          auditTitle: finding.auditTitle || finding.audit?.title || 'N/A',
          auditType: finding.auditType || finding.audit?.type || 'N/A',
          status: finding.audit?.status || 'N/A',
          startDate: (finding.audit as any)?.startDate,
          endDate: (finding.audit as any)?.endDate,
          findingsCount: 1,
        });
      }
    });

    setGroupedAudits(Array.from(auditMap.values()));
  }, [findings]);

  const handleAuditClick = (auditId: string, auditTitle: string) => {
    navigate(`/auditee-owner/my-witnessed/audit/${auditId}`, {
      state: { auditId, auditTitle }
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN');
    } catch {
      return 'N/A';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Witnessed Findings</h1>
          <p className="text-gray-600">Findings where you are assigned as a witness (View Only)</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading witnessed findings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        ) : groupedAudits.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">You are not assigned as a witness for any findings.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Audit Title
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-black uppercase tracking-wider">
                      Findings Count
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-black uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedAudits.map((audit, idx) => (
                    <tr 
                      key={audit.auditId} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleAuditClick(audit.auditId, audit.auditTitle)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{idx + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{audit.auditTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{audit.auditType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          audit.status === 'InProgress' || audit.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-700'
                            : audit.status === 'Approved'
                            ? 'bg-green-100 text-green-700'
                            : audit.status === 'Draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {audit.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{formatDate(audit.startDate)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{formatDate(audit.endDate)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {audit.findingsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAuditClick(audit.auditId, audit.auditTitle);
                          }}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MyWitnessed;
