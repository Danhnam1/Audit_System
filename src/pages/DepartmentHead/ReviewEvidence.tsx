import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';

interface Evidence {
  id: string;
  findingCode: string;
  findingTitle: string;
  staffName: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
  files: { name: string; size: string }[];
}

const ReviewEvidence = () => {
  const navigate = useNavigate();
  const [evidences] = useState<Evidence[]>([
    {
      id: '1',
      findingCode: '#007',
      findingTitle: 'Thiếu hồ sơ instructor',
      staffName: 'Nguyễn Thị C',
      uploadDate: '24/10/2025 10:30',
      status: 'pending',
      files: [
        { name: 'Medical_Cert_John_Smith.pdf', size: '1.2 MB' },
        { name: 'Medical_Cert_Nguyen_Van_G.pdf', size: '980 KB' },
        { name: 'Medical_Cert_Tran_Thi_H.pdf', size: '1.1 MB' },
        { name: 'Photo_PersonalFile_Update.jpg', size: '2.3 MB' },
      ],
    },
    {
      id: '2',
      findingCode: '#005',
      findingTitle: 'Cập nhật training record',
      staffName: 'Trần Văn D',
      uploadDate: '25/10/2025 14:20',
      status: 'pending',
      files: [{ name: 'Training_Record_Updated.xlsx', size: '450 KB' }],
    },
  ]);

  const handleViewDetail = (id: string) => {
    navigate(`/department-head/review-evidence/${id}`);
  };

  const getStatusBadge = (status: Evidence['status']) => {
    const statusMap = {
      pending: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
      approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-700' },
      rejected: { label: 'Đã từ chối', color: 'bg-red-100 text-red-700' },
    };
    const info = statusMap[status];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">✅ Duyệt Minh chứng</h1>
            <p className="mt-2 text-gray-600">Xem xét và phê duyệt minh chứng từ nhân viên</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Chờ duyệt</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {evidences.filter((e) => e.status === 'pending').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Đã duyệt</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {evidences.filter((e) => e.status === 'approved').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Đã từ chối</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {evidences.filter((e) => e.status === 'rejected').length}
            </div>
          </div>
        </div>

        {/* Evidence List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách Minh chứng</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {evidences.map((evidence) => (
              <div key={evidence.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-gray-900">{evidence.findingCode}</span>
                      {getStatusBadge(evidence.status)}
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-2">
                      {evidence.findingTitle}
                    </h3>
                    <div className="text-sm text-gray-600 mb-3">
                      <p>Người thực hiện: {evidence.staffName}</p>
                      <p>Ngày upload: {evidence.uploadDate}</p>
                      <p>Trạng thái: Chờ Department Head duyệt</p>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        📎 Minh chứng đã tải lên ({evidence.files.length} files):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {evidence.files.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-gray-700">{file.name}</span>
                            <span className="text-gray-500 text-xs">({file.size})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDetail(evidence.id)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Xem chi tiết
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

export default ReviewEvidence;

