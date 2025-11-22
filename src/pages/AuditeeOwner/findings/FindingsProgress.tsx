import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import { getSeverityColor } from '../../../constants/statusColors';
import FindingDetailModal from '../../../pages/Auditor/FindingManagement/FindingDetailModal';

const FindingsProgress = () => {
  const { user } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
    const fetchFindings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const deptId = getUserDeptId();
        if (!deptId) {
          setError('Department ID not found in token');
          return;
        }

        const data = await getFindingsByDepartment(deptId);
        setFindings(data);
      } catch (err: any) {
        console.error('Error fetching findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, []);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Calculate statistics
  const totalFindings = findings.length;
  const openFindings = findings.filter(f => f.status?.toLowerCase() === 'open').length;
  const closedFindings = findings.filter(f => f.status?.toLowerCase() === 'closed').length;
  const overdueFindings = findings.filter(f => {
    if (!f.deadline) return false;
    const deadline = new Date(f.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadline < today && f.status?.toLowerCase() !== 'closed';
  }).length;

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return null;
    try {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'closed') return 'bg-green-100 text-green-700';
    if (statusLower === 'open') return 'bg-blue-100 text-blue-700';
    if (statusLower === 'overdue') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Get severity badge color
  const getSeverityBadgeColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower === 'high' || severityLower === 'major') return 'bg-red-100 text-red-700';
    if (severityLower === 'medium') return 'bg-yellow-100 text-yellow-700';
    if (severityLower === 'low' || severityLower === 'minor') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Findings Progress
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Track and monitor the progress of findings in your department
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading findings...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Findings</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{totalFindings}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Open</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{openFindings}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Closed</div>
                <div className="text-xl sm:text-2xl font-bold text-green-600">{closedFindings}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Overdue</div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">{overdueFindings}</div>
              </div>
            </div>

            {/* Findings Table */}
            <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                  Findings List ({totalFindings})
                </h2>
              </div>

              {findings.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No findings found for your department</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {findings.map((finding) => (
                        <tr key={finding.findingId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2">
                              {finding.title}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityBadgeColor(finding.severity)}`}>
                              {finding.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(finding.deadline)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedFindingId(finding.findingId);
                                setShowDetailModal(true);
                              }}
                              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95"
                              title="View Details"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Finding Detail Modal */}
        {selectedFindingId && (
          <FindingDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedFindingId(null);
            }}
            findingId={selectedFindingId}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default FindingsProgress;
