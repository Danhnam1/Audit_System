import { useAuth } from '../../contexts';

const DepartmentStaffWelcome = () => {
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-sky-600 to-sky-700 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-12 w-full max-w-4xl">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-sky-100 rounded-full mb-4">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Welcome, {user?.fullName}!</h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-2">Department Staff Portal</p>
              <p className="text-sm text-gray-500">Role: <span className="font-semibold text-sky-700">{user?.role}</span></p>
            </div>
            
            <div className="border-t border-gray-200 my-6"></div>
            
            <p className="text-gray-700 mb-8 text-base sm:text-lg">
              Manage your department's daily operations and tasks.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Task Management</h3>
                    <p className="text-sm text-gray-700">Manage your assigned tasks</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Documentation</h3>
                    <p className="text-sm text-gray-700">Submit and review documents</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Schedule</h3>
                    <p className="text-sm text-gray-700">View your work schedule</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Performance</h3>
                    <p className="text-sm text-gray-700">Track your performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentStaffWelcome;
