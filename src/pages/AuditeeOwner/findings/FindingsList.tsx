import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

const FindingsList = () => {
  const navigate = useNavigate();

  const findings = [
    {
      id: '1',
      code: '#007',
      title: 'Thiếu hồ sơ instructor',
      priority: 'major',
      deadline: '28/10/2025',
      daysRemaining: 3,
    },
    {
      id: '2',
      code: '#005',
      title: 'Cập nhật training record',
      priority: 'minor',
      deadline: '30/10/2025',
      daysRemaining: 5,
    },
    {
      id: '3',
      code: '#012',
      title: 'Scan hồ sơ học viên',
      priority: 'minor',
      deadline: '01/11/2025',
      daysRemaining: 7,
    },
  ];

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
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Danh sách Findings được giao</h1>
          <p className="text-gray-600">Xem tất cả findings cần phân công cho nhân viên</p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tất cả Findings</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {findings.map((finding) => (
              <div key={finding.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-gray-900">{finding.code}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          finding.priority === 'major'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {finding.priority.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-2">{finding.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Deadline: {finding.deadline}</span>
                      <span>Còn {finding.daysRemaining} ngày</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(finding.id)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Phân công Staff
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FindingsList;

