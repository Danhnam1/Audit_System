import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

const AssignStaff = () => {
  // const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedStaff, setSelectedStaff] = useState('');
  const [internalDeadline, setInternalDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [setReminder, setSetReminder] = useState(true);

  const staffMembers = [
    { id: '1', name: 'Nguyễn Thị C', role: 'HR Coordinator' },
    { id: '2', name: 'Trần Văn D', role: 'Training Officer' },
    { id: '3', name: 'Lê Thị E', role: 'Document Specialist' },
  ];

  const finding = {
    code: '#007',
    title: 'Thiếu hồ sơ instructor',
    priority: 'MAJOR',
    deadline: '28/10/2025',
    description:
      'Hồ sơ của 3 instructor không có bản sao medical certificate còn hiệu lực. Yêu cầu cung cấp trong 5 ngày.',
    correctiveAction: [
      'Liên hệ 3 instructor lấy medical cert',
      'Scan và upload lên hệ thống',
      'Cập nhật vào personal file',
    ],
  };

  const handleAssign = () => {
    // Handle assignment logic
    alert('Đã phân công thành công!');
  navigate('/auditee-owner/assign-tasks');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Phân công Xử lý Findings</h1>
          <p className="mt-2 text-gray-600">Phân công finding cho nhân viên và đặt deadline</p>
        </div>

        {/* Finding Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Finding: {finding.code} - {finding.title} ({finding.priority})
            </h2>
            <p className="text-sm text-gray-600">Deadline SQA: {finding.deadline} (còn 4 ngày)</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">📝 Mô tả Finding (từ Audit)</h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{finding.description}</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">🎯 Corrective Action Yêu cầu</h3>
            <ul className="space-y-1">
              {finding.correctiveAction.map((action, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Assignment Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân công</h2>

          <div className="space-y-4">
            {/* Select Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Phân công cho
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Chọn staff...</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Internal Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Deadline nội bộ
              </label>
              <input
                type="date"
                value={internalDeadline}
                onChange={(e) => setInternalDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="27/10/2025 (1 ngày trước deadline SQA)"
              />
              <p className="mt-1 text-xs text-gray-500">Nên đặt trước deadline SQA 1 ngày</p>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💬 Hướng dẫn cho Staff
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Liên hệ ngay với các instructor sau: John Smith, Nguyễn Văn G, Trần Thị H. Cần medical cert còn hạn ít nhất 6 tháng."
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Gửi email thông báo đến staff</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={setReminder}
                  onChange={(e) => setSetReminder(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Đặt reminder trước deadline 1 ngày</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/auditee-owner/assign-tasks')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedStaff || !internalDeadline}
            className={`px-6 py-2 rounded-lg font-medium ${
              selectedStaff && internalDeadline
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Giao việc
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default AssignStaff;

