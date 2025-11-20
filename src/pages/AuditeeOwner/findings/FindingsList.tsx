import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getFindingsByDepartment, type Finding } from '../../../api/findings';
import { getSeverityColor } from '../../../constants/statusColors';

const FindingsList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const userDeptId = getUserDeptId();
        console.log('🔍 DEBUG - User DeptId from token:', userDeptId, 'Type:', typeof userDeptId);

        if (userDeptId === null) {
          console.warn('⚠️ No userDeptId found in token');
          setError('Không tìm thấy thông tin phòng ban. Vui lòng liên hệ admin.');
          setFindings([]);
          setLoading(false);
          return;
        }

        // Fetch findings by department using dedicated API
        const deptFindings = await getFindingsByDepartment(userDeptId);
        console.log('🔍 DEBUG - Department findings:', deptFindings.length);

        setFindings(deptFindings);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, []);

  const calculateDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const handleAssign = (findingId: string) => {
    navigate(`/auditee-owner/assign-tasks/${findingId}/assign`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/auditee-owner/assign-tasks')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          
          {/* DEBUG BUTTON */}
          <button
            onClick={() => {
              const deptId = getUserDeptId();
              const token = localStorage.getItem('auth-storage');
              console.log('=== DEBUG INFO ===');
              console.log('Token storage:', token);
              console.log('User DeptId:', deptId);
              console.log('Findings count:', findings.length);
              console.log('All findings:', findings);
              alert(`DeptId: ${deptId}\nFindings: ${findings.length}\nCheck console for details`);
            }}
            className="px-3 py-1 bg-purple-600 text-white rounded text-xs"
          >
            🐛 Debug Info
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Danh sách Findings của Phòng ban</h1>
          <p className="text-gray-600">Xem và phân công findings cho nhân viên xử lý</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Đang tải findings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        ) : findings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">Chưa có findings nào cho phòng ban của bạn</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Tất cả Findings ({findings.length})
              </h2>
              <span className="text-sm text-gray-600">
                Department ID: {getUserDeptId()}
              </span>
            </div>
            <div className="divide-y divide-gray-200">
              {findings.map((finding) => {
                const daysRemaining = finding.deadline ? calculateDaysRemaining(finding.deadline) : null;
                return (
                  <div key={finding.findingId} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-sm font-mono text-gray-500">
                            #{finding.findingId.slice(0, 8)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            finding.status === 'Open' 
                              ? 'bg-blue-100 text-blue-700'
                              : finding.status === 'In Progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {finding.status}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">{finding.title}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{finding.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {finding.deadline && (
                            <>
                              <span className="flex items-center gap-1">
                                📅 Deadline: {new Date(finding.deadline).toLocaleDateString('vi-VN')}
                              </span>
                              {daysRemaining !== null && (
                                <span className={`font-medium ${
                                  daysRemaining < 0 
                                    ? 'text-red-600' 
                                    : daysRemaining <= 3 
                                    ? 'text-orange-600' 
                                    : 'text-green-600'
                                }`}>
                                  {daysRemaining < 0 ? `Quá hạn ${Math.abs(daysRemaining)} ngày` : `Còn ${daysRemaining} ngày`}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(finding.findingId)}
                        className="ml-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium transition-all shadow-md hover:shadow-lg shrink-0"
                      >
                        👤 Phân công Staff
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default FindingsList;

