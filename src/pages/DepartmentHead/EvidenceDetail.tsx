import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layouts';

const EvidenceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rejectionReason, setRejectionReason] = useState('');
  const [checkedItems, setCheckedItems] = useState({
    sufficient: false,
    quality: false,
    valid: false,
    updated: false,
  });

  const evidence = {
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
    note: 'Em đã liên hệ và thu thập đủ 3 medical certificates. Tất cả còn hiệu lực > 6 tháng. Em đã cập nhật vào personal file và chụp ảnh minh chứng.',
  };

  const handleApprove = () => {
    // Handle approval logic
    alert('Đã phê duyệt và gửi lên SQA!');
    navigate('/department-head/review-evidence');
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    // Handle rejection logic
    alert('Đã từ chối và yêu cầu chỉnh sửa!');
    navigate('/department-head/review-evidence');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/department-head/review-evidence')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Duyệt Minh chứng</h1>
        </div>

        {/* Evidence Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Finding: {evidence.findingCode} - {evidence.findingTitle}</p>
            <p className="text-sm text-gray-600 mb-1">Người thực hiện: {evidence.staffName}</p>
            <p className="text-sm text-gray-600 mb-1">Ngày upload: {evidence.uploadDate}</p>
            <p className="text-sm text-gray-600">
              Trạng thái: <span className="font-medium">Chờ Department Head duyệt</span>
            </p>
          </div>

          {/* Files */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📎 Minh chứng đã tải lên</h3>
            <div className="space-y-2">
              {evidence.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">({file.size})</span>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    Xem
                  </button>
                </div>
              ))}
            </div>
            <button className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
              🔍 Xem tất cả trong viewer
            </button>
          </div>

          {/* Staff Note */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">💬 Ghi chú từ Staff</h3>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{evidence.note}</p>
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">✅ Checklist Kiểm tra</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedItems.sufficient}
                  onChange={(e) =>
                    setCheckedItems({ ...checkedItems, sufficient: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Đủ số lượng tài liệu yêu cầu</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedItems.quality}
                  onChange={(e) =>
                    setCheckedItems({ ...checkedItems, quality: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Chất lượng scan rõ ràng, đọc được</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedItems.valid}
                  onChange={(e) =>
                    setCheckedItems({ ...checkedItems, valid: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Thông tin trên cert hợp lệ (tên, ngày hết hạn)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedItems.updated}
                  onChange={(e) =>
                    setCheckedItems({ ...checkedItems, updated: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Đã cập nhật vào hệ thống quản lý</span>
              </label>
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              💬 Nhận xét của bạn (nếu reject)
            </h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Để trống nếu approve"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            ❌ Từ chối - Yêu cầu chỉnh sửa
          </button>
          <button
            onClick={handleApprove}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            ✅ Phê duyệt - Gửi SQA
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default EvidenceDetail;

