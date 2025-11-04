import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts';

const DirectorWelcome = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-lg p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Welcome, {user?.fullName}!</h1>
          <p className="mt-2 text-sky-100 text-base sm:text-lg">Director Dashboard</p>
          <p className="mt-4 text-xs sm:text-sm text-sky-200">
            You are logged in as <span className="font-semibold">{user?.role}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Departments</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">12</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">Active</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Audits</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">45</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">+8.2%</span>
              <span className="ml-2 text-gray-600">from last week</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">23</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-orange-600 font-medium">Needs attention</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Rate</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">94%</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-medium">Excellent</span>
            </div>
          </div>
        </div>

        {/* Urgent Decisions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔔 Decisions Required</h2>
          <div className="space-y-4">
            <div className="p-5 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">🔴 Audit Plan Q1/2026 - Khoa Phi công</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Đã được Lead Auditor duyệt | 2 ngày trước
                  </p>
                  <p className="text-xs text-gray-600">
                    Cần Director phê duyệt để tiến hành audit theo timeline
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
                    Phê duyệt
                  </button>
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium">
                    Yêu cầu điều chỉnh
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 mb-2">🟡 Kết quả Audit Q3/2025 - Khoa Kỹ thuật</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Đã hoàn tất, chờ Director duyệt | 1 ngày trước
                  </p>
                  <p className="text-xs text-gray-600">
                    Tất cả findings đã được verify và đóng
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
                    Phê duyệt
                  </button>
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium">
                    Xem báo cáo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 Compliance Trend (12 months)</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="relative h-48 flex items-end justify-between gap-2">
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '65%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">N</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '70%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">D</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '75%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">J</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '80%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">F</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '85%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">M</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '88%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">A</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-500 rounded-t" style={{ height: '90%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">M</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-600 rounded-t" style={{ height: '87%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">J</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-600 rounded-t" style={{ height: '92%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">J</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-600 rounded-t" style={{ height: '95%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">A</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-600 rounded-t" style={{ height: '93%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">S</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t h-32 flex items-end">
                  <div className="w-full bg-sky-600 rounded-t" style={{ height: '87.5%' }}></div>
                </div>
                <span className="text-xs text-gray-600 mt-2">O</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-sky-600 rounded"></div>
                <span>Actual: 87.5%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-gray-400 border-dashed"></div>
                <span>Target: 90%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Risk Alerts</h2>
          <div className="space-y-3">
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-sm text-gray-700">
                • Khoa Tiếp viên: 3 Major findings chưa đóng (&gt;30 ngày)
              </p>
            </div>
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-sm text-gray-700">
                • Budget Audit vượt 15% so với kế hoạch Q4
              </p>
            </div>
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-gray-700">
                • Sắp đến đợt Audit CAAV định kỳ (45 ngày nữa)
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
              📊 Xem báo cáo đầy đủ
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
              📧 Gửi báo cáo Board
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DirectorWelcome;
