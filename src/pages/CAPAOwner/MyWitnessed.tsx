import { useState, useEffect } from 'react';
import { MainLayout } from '../../layouts';
import { getMyWitnessedFindings, type Finding } from '../../api/findings';
import { getAuditPlanById } from '../../api/audits';
import { getSeverityColor } from '../../constants/statusColors';
import WitnessedFindingDetailModal from '../Shared/WitnessedFindingDetailModal';

interface FindingWithAudit extends Finding {
  auditTitle?: string;
  auditType?: string;
}

const MyWitnessed = () => {
  const [findings, setFindings] = useState<FindingWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWitnessedFindings = async () => {
      try {
        setLoading(true);

        // Fetch witnessed findings from dedicated API endpoint
        const witnessedFindings = await getMyWitnessedFindings();
        console.log('Witnessed Findings:', witnessedFindings);

        // Fetch audit details for each finding
        const findingsWithAudit = await Promise.all(
          witnessedFindings.map(async (finding) => {
            try {
              const audit = await getAuditPlanById(finding.auditId);
              return {
                ...finding,
                auditTitle: audit?.title,
                auditType: audit?.type,
              };
            } catch (err) {
              console.error(`Error fetching audit ${finding.auditId}:`, err);
              return {
                ...finding,
                auditTitle: 'N/A',
                auditType: 'N/A',
              };
            }
          })
        );

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

  const calculateDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const handleViewDetail = (findingId: string) => {
    setSelectedFindingId(findingId);
    setShowDetailModal(true);
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
        ) : findings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">You are not assigned as a witness for any findings.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                Witnessed Findings ({findings.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      No.
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Audit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-black uppercase tracking-wider">
                      Deadline
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-black uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {findings.map((finding, idx) => {
                    const daysRemaining = finding.deadline ? calculateDaysRemaining(finding.deadline) : null;
                    return (
                      <tr key={finding.findingId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{idx + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{finding.title}</div>
                          <div className="text-sm text-[#5b6166] line-clamp-1">{finding.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{finding.auditTitle || 'N/A'}</div>
                          <div className="text-xs text-[#5b6166]">{finding.auditType || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            finding.status === 'Open' 
                              ? 'bg-blue-100 text-blue-700'
                              : finding.status === 'Received'
                              ? 'bg-yellow-100 text-yellow-700'
                              : finding.status === 'Closed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {finding.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {finding.deadline ? (
                            <div>
                              <div className="text-sm text-gray-900">
                                {new Date(finding.deadline).toLocaleDateString('vi-VN')}
                              </div>
                              {daysRemaining !== null && (
                                <div className={`text-xs font-medium ${
                                  daysRemaining < 0 
                                    ? 'text-red-600'
                                    : daysRemaining <= 3
                                    ? 'text-orange-600'
                                    : 'text-gray-600'
                                }`}>
                                  {daysRemaining < 0 
                                    ? `${Math.abs(daysRemaining)} days overdue`
                                    : `${daysRemaining} days left`
                                  }
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-[#5b6166]">No deadline</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleViewDetail(finding.findingId)}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Witnessed Finding Detail Modal */}
      {showDetailModal && selectedFindingId && (
        <WitnessedFindingDetailModal
          isOpen={showDetailModal}
          findingId={selectedFindingId}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFindingId(null);
          }}
        />
      )}
    </MainLayout>
  );
};

export default MyWitnessed;
