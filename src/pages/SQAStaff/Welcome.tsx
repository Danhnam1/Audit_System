import { useAuth } from '../../contexts';

const SQAStaffWelcome = () => {
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-sky-600 to-sky-700 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-12 w-full max-w-4xl">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-sky-100 rounded-full mb-4">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Welcome, {user?.fullName}!</h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-2">Software Quality Assurance Portal</p>
              <p className="text-sm text-gray-500">Role: <span className="font-semibold text-sky-700">{user?.role}</span></p>
            </div>
            
            <div className="border-t border-gray-200 my-6"></div>
            
            <p className="text-gray-700 mb-8 text-base sm:text-lg">
              Ensure quality standards across all departments and processes.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Quality Audits</h3>
                    <p className="text-sm text-gray-700">Conduct and manage quality audits</p>
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
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Documentation Review</h3>
                    <p className="text-sm text-gray-700">Review and approve documents</p>
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
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Quality Reports</h3>
                    <p className="text-sm text-gray-700">Generate comprehensive reports</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6 rounded-xl border border-sky-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sky-900 mb-1 text-base sm:text-lg">Standards Management</h3>
                    <p className="text-sm text-gray-700">Manage quality standards</p>
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

export default SQAStaffWelcome;
