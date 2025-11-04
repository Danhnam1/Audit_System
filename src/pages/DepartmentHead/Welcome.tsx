import { useAuth } from '../../contexts';
import { MainLayout } from '../../layouts';

const DepartmentHeadWelcome = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-lg p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Welcome, {user?.fullName}!</h1>
          <p className="mt-2 text-sky-100 text-base sm:text-lg">Department Head Dashboard</p>
          <p className="mt-4 text-xs sm:text-sm text-sky-200">
            You are logged in as <span className="font-semibold">{user?.role}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Findings</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">12</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">8</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">4</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="mt-2 text-3xl font-semibold text-red-600">1</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔔 New Notifications</h2>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-gray-700">
                • Audit Plan Q1/2025 đã được phê duyệt - <span className="text-blue-600 font-medium cursor-pointer hover:underline">Xem ngay</span>
              </p>
            </div>
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-sm text-gray-700">
                • 4 minh chứng đang chờ bạn duyệt
              </p>
            </div>
            <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
              <p className="text-sm text-gray-700">
                • Finding #003 sắp đến hạn (còn 2 ngày)
              </p>
            </div>
          </div>
        </div>

        {/* Employee Progress */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Employee Progress</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Nguyễn Thị C</span>
                <span className="text-sm text-gray-600">80% - 4/5 findings completed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Trần Văn D</span>
                <span className="text-sm text-gray-600">60% - 3/5 findings completed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Lê Thị E</span>
                <span className="text-sm text-gray-600">100% - 3/3 findings completed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Urgent Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Action Required</h2>
          <div className="space-y-3">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-red-900">#007 - Thiếu hồ sơ instructor</p>
                  <p className="text-sm text-gray-600 mt-1">MAJOR - Còn 1 ngày</p>
                </div>
                <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                  Xem ngay
                </button>
              </div>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-yellow-900">4 minh chứng chờ duyệt</p>
                  <p className="text-sm text-gray-600 mt-1">Cần xem xét và phê duyệt</p>
                </div>
                <button className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700">
                  Duyệt
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
              Xem tất cả findings
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
              Phân công công việc
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DepartmentHeadWelcome;