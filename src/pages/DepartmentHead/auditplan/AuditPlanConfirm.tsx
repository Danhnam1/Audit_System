import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

const AuditPlanConfirm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(true);

  const handleConfirm = () => {
    // Handle confirmation logic here
    setShowModal(false);
    navigate('/department-head/audit-plans');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Modal Confirm */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                  Xác nhận đã nhận kế hoạch
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Bạn có chắc chắn đã đọc và hiểu rõ yêu cầu của kế hoạch audit này?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/department-head/audit-plans/${id}/detail`)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {!showModal && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Đã xác nhận thành công!
              </h2>
              <p className="text-gray-600 mb-6">
                Kế hoạch audit đã được xác nhận. Bạn sẽ nhận được thông báo khi có cập nhật.
              </p>
              <button
                onClick={() => navigate('/department-head/audit-plans')}
                className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                Quay về danh sách
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AuditPlanConfirm;

