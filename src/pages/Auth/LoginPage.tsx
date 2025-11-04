import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts';


export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);

  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    try {
      await login({ username, password });
      // Navigation will be handled by App.tsx based on user role
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const demoCredentials = [
    { role: 'Admin', username: 'admin', password: 'admin123' },
    { role: 'Auditor', username: 'sqa', password: 'sqa123' },
    { role: 'Lead Auditor', username: 'sqahead', password: 'sqahead123' },

    { role: 'CAPA Owner', username: 'deptstaff', password: 'dept123' },
    { role: 'Auditee Owner', username: 'depthead', password: 'head123' },
    { role: 'Director', username: 'director', password: 'director123' },

  ];

  const quickLogin = (username: string, password: string) => {
    setUsername(username);
    setPassword(password);
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto">
      {/* Background Image with Blur */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://images.travelandleisureasia.com/wp-content/uploads/sites/3/2024/04/08165017/airplane.jpeg?tr=w-1200,q-60)',
          filter: 'blur(4px)',
          transform: 'scale(1.1)', // Prevent white edges from blur
        }}
      />

      {/* Overlay to darken background slightly */}
      <div className="fixed inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl">
          {/* Main Container - Responsive flex direction */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Login Form - Always visible, centered on mobile */}
            <div className="w-full lg:flex-1 lg:max-w-md mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full overflow-hidden">
                    <img
                      src="/icon/logo.png"
                      alt="AMS Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-600 mb-2">
                    AMS
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600">Đăng nhập hệ thống</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <p className="text-red-800 text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-left text-sm font-medium text-gray-700 mb-2"
                    >
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Enter your username"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-left text-sm font-medium text-gray-700 mb-2"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 sm:py-3 px-4 rounded-lg text-sm sm:text-base font-semibold hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Login'
                    )}
                  </button>
                </form>

                {/* Demo Credentials Toggle */}
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2 mx-auto"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showCredentials ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {showCredentials ? 'Hide' : 'Show'} Demo Credentials
                  </button>
                </div>
              </div>
            </div>

            {/* Demo Credentials Panel - Responsive */}
            {showCredentials && (
              <div className="w-full lg:flex-1 lg:max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
                    Demo Accounts
                  </h2>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {demoCredentials.map((cred, index) => (
                      <div
                        key={index}
                        className="p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:border-blue-300 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">
                            {cred.role}
                          </h3>
                          <button
                            onClick={() => quickLogin(cred.username, cred.password)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition w-fit"
                          >
                            Quick Login
                          </button>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 space-y-1 text-left">
                          <p className="break-all">
                            <span className="font-medium">Username:</span>{' '}
                            <code className="bg-gray-200 px-2 py-0.5 rounded">
                              {cred.username}
                            </code>
                          </p>
                          <p className="break-all">
                            <span className="font-medium">Password:</span>{' '}
                            <code className="bg-gray-200 px-2 py-0.5 rounded">
                              {cred.password}
                            </code>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
