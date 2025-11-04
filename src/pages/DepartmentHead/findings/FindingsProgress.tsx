import { useState } from 'react';
import { MainLayout } from '../../../layouts';

const FindingsProgress = () => {
  const [findings] = useState([
    {
      id: '1',
      code: '#007',
      title: 'Medical certificates',
      status: 'Chờ duyệt',
      deadline: '3 ngày',
      progress: 100,
      daysRemaining: 3,
    },
    {
      id: '2',
      code: '#005',
      title: 'Training record',
      status: 'Đang làm',
      deadline: '1 ngày',
      progress: 60,
      daysRemaining: 1,
    },
    {
      id: '3',
      code: '#012',
      title: 'Scan hồ sơ HV',
      status: 'Hoàn thành',
      deadline: '5 ngày',
      progress: 100,
      daysRemaining: 5,
    },
  ]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 Theo dõi Findings</h1>
          <p className="mt-2 text-gray-600">Xem tiến độ xử lý findings của khoa</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Tổng Findings</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{findings.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Đang xử lý</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {findings.filter((f) => f.status === 'Đang làm').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Chờ duyệt</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {findings.filter((f) => f.status === 'Chờ duyệt').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Hoàn thành</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {findings.filter((f) => f.status === 'Hoàn thành').length}
            </div>
          </div>
        </div>

        {/* Findings Progress Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tiến độ Xử lý Findings</h2>
            <div className="flex gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>Tất cả</option>
                <option>Theo deadline</option>
                <option>Theo trạng thái</option>
              </select>
              <input
                type="text"
                placeholder="🔍 Tìm kiếm..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nội dung</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiến độ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {findings.map((finding) => (
                  <tr key={finding.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {finding.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{finding.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          finding.status === 'Hoàn thành'
                            ? 'bg-green-100 text-green-700'
                            : finding.status === 'Chờ duyệt'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {finding.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {finding.deadline}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              finding.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${finding.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{finding.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Thống kê</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Tỷ lệ hoàn thành đúng hạn</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">95%</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Tổng findings đã xử lý</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">15</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Đánh giá từ SQA</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">⭐⭐⭐⭐⭐</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FindingsProgress;

