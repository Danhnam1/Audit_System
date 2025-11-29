import { useAuth } from '../../contexts';
import { MainLayout } from '../../layouts';

const DepartmentStaffWelcome = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-lg p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Welcome, {user?.fullName}!</h1>
          <p className="mt-2 text-sky-100 text-base sm:text-lg">CAPA Owner Dashboard</p>
          <p className="mt-4 text-xs sm:text-sm text-sky-200">
            You are logged in as <span className="font-semibold">{user?.role}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">5</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">2</p>
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
                <p className="mt-2 text-3xl font-semibold text-gray-900">1</p>
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
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="mt-2 text-3xl font-semibold text-green-600">2</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔔 Notifications</h2>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-gray-700">
                • You have been assigned a new task from Head - <span className="text-blue-600 font-medium cursor-pointer hover:underline">View now</span>
              </p>
            </div>
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-sm text-gray-700">
                • Finding #007 is waiting for you to upload evidence.
              </p>
            </div>
            <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
              <p className="text-sm text-gray-700">
                • Reminder: #005 is approaching its deadline (1 day remaining).
              </p>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Tasks to Complete</h2>
          <div className="space-y-3">
            <div className="p-4 border border-red-300 rounded-lg bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600 font-semibold">#007</span>
                    <span className="text-sm text-gray-700">Collect medical certificate</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">In progress</span>
                  </div>
                  <p className="text-xs text-gray-600">3 days remaining</p>
                </div>
                <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                  View
                </button>
              </div>
            </div>
            <div className="p-4 border border-yellow-300 rounded-lg bg-yellow-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-600 font-semibold">#005</span>
                    <span className="text-sm text-gray-700">Update training record</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">In progress</span>
                  </div>
                  <p className="text-xs text-gray-600">1 day remaining</p>
                </div>
                <button className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700">
                  View
                </button>
              </div>
            </div>
            <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-600 font-semibold">#012</span>
                    <span className="text-sm text-gray-700">Scan trainee records</span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Pending approval</span>
                  </div>
                  <p className="text-xs text-gray-600">5 days remaining</p>
                </div>
                <button className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                  View
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">✅ Recently Completed</h2>
          <div className="space-y-2">
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-gray-700">
                • #003 - Update checklist <span className="text-green-600 font-medium">(Closed)</span>
              </p>
            </div>
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-gray-700">
                • #008 - Upload simulator photos <span className="text-green-600 font-medium">(Approved)</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
              View all
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
              Task history
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DepartmentStaffWelcome;
