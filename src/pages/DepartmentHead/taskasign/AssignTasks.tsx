import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';

interface Finding {
  id: string;
  code: string;
  title: string;
  priority: 'major' | 'minor' | 'observation';
  deadline: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed';
  assignedTo?: string;
}

const AssignTasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [findings] = useState<Finding[]>([
    {
      id: '1',
      code: '#007',
      title: 'Thiếu hồ sơ instructor',
      priority: 'major',
      deadline: '28/10/2025',
      status: 'pending',
    },
    {
      id: '2',
      code: '#005',
      title: 'Cập nhật training record',
      priority: 'minor',
      deadline: '30/10/2025',
      status: 'assigned',
      assignedTo: 'Nguyễn Thị C',
    },
    {
      id: '3',
      code: '#012',
      title: 'Scan hồ sơ học viên',
      priority: 'minor',
      deadline: '01/11/2025',
      status: 'in-progress',
      assignedTo: 'Trần Văn D',
    },
  ]);

  const handleViewFindings = () => {
    navigate('/department-head/assign-tasks/findings');
  };

  const handleAssignStaff = (findingId: string) => {
    navigate(`/department-head/assign-tasks/${findingId}/assign`);
  };

  const getPriorityBadge = (priority: Finding['priority']) => {
    const priorityMap = {
      major: { label: 'MAJOR', color: 'bg-red-100 text-red-700' },
      minor: { label: 'MINOR', color: 'bg-yellow-100 text-yellow-700' },
      observation: { label: 'OBSERVATION', color: 'bg-gray-100 text-gray-700' },
    };
    const info = priorityMap[priority];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  const getStatusBadge = (status: Finding['status']) => {
    const statusMap = {
      pending: { label: 'Chờ phân công', color: 'bg-gray-100 text-gray-700' },
      assigned: { label: 'Đã phân công', color: 'bg-blue-100 text-blue-700' },
      'in-progress': { label: 'Đang xử lý', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
    };
    const info = statusMap[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📋 Phân công Nhiệm vụ</h1>
            <p className="mt-2 text-gray-600">Quản lý và phân công findings cho nhân viên</p>
          </div>
          <button
            onClick={handleViewFindings}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
          >
            Xem danh sách findings
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Tổng Findings</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{findings.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Chờ phân công</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {findings.filter((f) => f.status === 'pending').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Đã phân công</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {findings.filter((f) => f.status === 'assigned' || f.status === 'in-progress').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Hoàn thành</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {findings.filter((f) => f.status === 'completed').length}
            </div>
          </div>
        </div>

        {/* Findings List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Danh sách Findings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mã
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tiêu đề
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Độ ưu tiên
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deadline
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Người được giao
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {findings.map((finding) => (
                  <tr key={finding.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {finding.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{finding.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getPriorityBadge(finding.priority)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {finding.deadline}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(finding.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {finding.assignedTo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {finding.status === 'pending' ? (
                        <button
                          onClick={() => handleAssignStaff(finding.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Phân công
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAssignStaff(finding.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Xem/Sửa
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

export default AssignTasks;

