import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

interface AuditPlan {
  id: string;
  code: string;
  title: string;
  department: string;
  assignedBy: string;
  startDate: string;
  endDate: string;
  status: 'new' | 'confirmed' | 'in-progress' | 'completed';
  hasNotification: boolean;
}

const AuditPlans = () => {
  const navigate = useNavigate();
  const [plans] = useState<AuditPlan[]>([
    {
      id: '1',
      code: 'AUD-2025-001',
      title: 'Audit Khoa Phi công - Q1/2025',
      department: 'Khoa Phi công',
      assignedBy: 'SQA Head - Nguyễn Văn F',
      startDate: '01/11/2025',
      endDate: '15/11/2025',
      status: 'new',
      hasNotification: true,
    },
    {
      id: '2',
      code: 'AUD-2025-002',
      title: 'Audit Khoa Kỹ thuật - Q4/2025',
      department: 'Khoa Kỹ thuật',
      assignedBy: 'SQA Head - Nguyễn Văn F',
      startDate: '01/12/2025',
      endDate: '20/12/2025',
      status: 'confirmed',
      hasNotification: false,
    },
  ]);

  const handleViewDetail = (id: string) => {
    navigate(`/department-head/audit-plans/${id}/detail`);
  };

  const handleConfirm = (id: string) => {
    navigate(`/department-head/audit-plans/${id}/confirm`);
  };

  const getStatusBadge = (status: AuditPlan['status']) => {
    const statusMap = {
      new: { label: 'Mới', color: 'bg-blue-100 text-blue-700' },
      confirmed: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-700' },
      'in-progress': { label: 'Đang thực hiện', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-700' },
    };
    const statusInfo = statusMap[status];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📋 Audit Plans</h1>
            <p className="mt-2 text-gray-600">Quản lý kế hoạch audit được giao cho khoa</p>
          </div>
        </div>

        {/* Notifications Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                🆕 Bạn có <strong>1 kế hoạch audit mới</strong> được giao!
              </p>
            </div>
          </div>
        </div>

        {/* Plans List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách Kế hoạch Audit</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mã kế hoạch
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiêu đề
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Người giao
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thời gian
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{plan.code}</span>
                        {plan.hasNotification && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Mới
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{plan.title}</div>
                      <div className="text-sm text-gray-500">{plan.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.assignedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.startDate} - {plan.endDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(plan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewDetail(plan.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Xem chi tiết
                      </button>
                      {plan.status === 'new' && (
                        <button
                          onClick={() => handleConfirm(plan.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Xác nhận
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditPlans;

