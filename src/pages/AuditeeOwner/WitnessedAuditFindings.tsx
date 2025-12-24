import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { getMyWitnessedFindings, type Finding } from '../../api/findings';
import { getSeverityColor } from '../../constants/statusColors';
import WitnessedFindingDetailModal from '../Shared/WitnessedFindingDetailModal';

interface FindingWithAudit extends Finding {
  auditTitle?: string;
  auditType?: string;
}

const WitnessedAuditFindings = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const auditTitle = (location.state as any)?.auditTitle || 'Audit Details';

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

        // Filter findings by auditId - use audit.auditId if available, fallback to finding.auditId
        const filteredFindings = witnessedFindings
          .filter((finding) => {
            const findingAuditId = finding.audit?.auditId || finding.auditId;
            return findingAuditId === auditId;
          })
          .map((finding) => ({
            ...finding,
            auditTitle: finding.audit?.title || 'N/A',
            auditType: finding.audit?.type || 'N/A',
          }));

        setFindings(filteredFindings);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching witnessed findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    if (auditId) {
      fetchWitnessedFindings();
    }
  }, [auditId]);

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

  const handleBack = () => {
    navigate('/auditee-owner/my-witnessed');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Audits</span>
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{auditTitle}</h1>
          <p className="text-gray-600">Witnessed Findings for this Audit (View Only)</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading findings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        ) : findings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">No findings found for this audit.</p>
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
                      Title
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
                <tbody className="bg-white divide-y divide-gray-200">
                  {findings.map((finding, idx) => {
                    const daysRemaining = finding.deadline ? calculateDaysRemaining(finding.deadline) : null;
                    return (
                      <tr key={finding.findingId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{idx + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{finding.title}</div>
                        </td>
                       
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            finding.status === 'Open' 
                              ? 'bg-blue-100 text-blue-700'
                              : finding.status === 'Received'
                              ? 'bg-yellow-100 text-yellow-700'
                              : finding.status === 'Closed'
                              ? 'bg-green-100 text-green-700'
                              : finding.status === 'Return'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {finding.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        <td className="px-6 py-4 whitespace-nowrap text-center">
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

export default WitnessedAuditFindings;

