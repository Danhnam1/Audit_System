import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

const AuditPlanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plan] = useState({
    code: 'AUD-2025-001',
    title: 'Audit Khoa Phi công - Q1/2025',
    assignedBy: 'SQA Head - Nguyễn Văn F',
    startDate: '01/11/2025',
    endDate: '15/11/2025',
    scope: [
      'Kiểm tra chương trình đào tạo PPL',
      'Chuẩn bị hồ sơ instructor (license, medical cert)',
      'Kiểm tra simulator facility',
      'Hồ sơ học viên (training records, logbooks)',
    ],
    documents: [
      { name: 'Checklist_Audit_2025.pdf', size: '2.5 MB' },
      { name: 'Yeu_cau_minh_chung.docx', size: '850 KB' },
    ],
    auditors: {
      caav: 'Đoàn CAAV: 3 người',
      internal: 'Internal: SQA Staff',
    },
    notes: 'Đây là audit quan trọng, vui lòng chuẩn bị kỹ hồ sơ instructor và training records. Deadline nộp minh chứng sơ bộ: 28/10/2025.',
  });

  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    // Navigate to confirm modal page
    navigate(`/department-head/audit-plans/${id}/confirm`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/department-head/audit-plans')}
              className="text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Kế hoạch Audit mới</h1>
          </div>
        </div>

        {/* New Plan Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm font-medium text-blue-800">
            🆕 Bạn có 1 kế hoạch audit mới được giao!
          </p>
        </div>

        {/* Plan Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Thông tin Kế hoạch</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mã kế hoạch</label>
              <p className="mt-1 text-sm text-gray-900">{plan.code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
              <p className="mt-1 text-sm text-gray-900">{plan.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Người giao</label>
              <p className="mt-1 text-sm text-gray-900">{plan.assignedBy}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ngày bắt đầu</label>
              <p className="mt-1 text-sm text-gray-900">{plan.startDate}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ngày kết thúc</label>
              <p className="mt-1 text-sm text-gray-900">{plan.endDate}</p>
            </div>
          </div>
        </div>

        {/* Scope & Requirements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 Phạm vi & Yêu cầu</h2>
          <ul className="space-y-2">
            {plan.scope.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span className="text-sm text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📎 Tài liệu Hướng dẫn</h2>
          <div className="space-y-2">
            {plan.documents.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">{doc.name}</span>
                  <span className="text-xs text-gray-500">({doc.size})</span>
                </div>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Tải xuống
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Auditors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Auditor</h2>
          <ul className="space-y-2">
            <li className="text-sm text-gray-700">• {plan.auditors.caav}</li>
            <li className="text-sm text-gray-700">• {plan.auditors.internal}</li>
          </ul>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">💬 Lưu ý từ SQA Head</h2>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 italic">"{plan.notes}"</p>
          </div>
        </div>

        {/* Confirmation */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="confirm-checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="confirm-checkbox" className="text-sm text-gray-700">
              Tôi đã đọc và hiểu rõ yêu cầu
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!confirmed}
              className={`px-6 py-2 rounded-lg font-medium ${
                confirmed
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Xác nhận đã nhận
            </button>
            <button
              onClick={() => navigate('/department-head/audit-plans')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Hỏi thêm
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditPlanDetail;

