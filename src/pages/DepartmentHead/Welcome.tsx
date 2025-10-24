import { useAuth } from '../../contexts';

const DepartmentHeadWelcome = () => {
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-sky-600 to-sky-700 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-12 w-full max-w-4xl">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-sky-100 rounded-full mb-4">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Welcome, {user?.fullName}!</h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-2">Department Management Portal</p>
              <p className="text-sm text-gray-500">Role: <span className="font-semibold text-sky-700">{user?.role}</span></p>
            </div>
            
            <div className="border-t border-gray-200 my-6"></div>
            
            <p className="text-gray-700 mb-8 text-base sm:text-lg">
              Oversee and manage your department's operations and team.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Team Management</h3>
                    <p className="text-sm text-gray-700">Manage department staff</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Resource Planning</h3>
                    <p className="text-sm text-gray-700">Allocate department resources</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Performance Reports</h3>
                    <p className="text-sm text-gray-700">Track department metrics</p>
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
                    <p className="text-sm text-gray-700">Manage department docs</p>
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

export default DepartmentHeadWelcome;