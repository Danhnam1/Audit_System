import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../../hooks/auth'
import useAuthStore from '../../store/useAuthStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [showCredentials, setShowCredentials] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const { setToken, setUser, setRememberMe: setRememberMeStore } = useAuthStore()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authService.login({ email, password })
      
      // Log full response for debugging
      console.log('=== LOGIN RESPONSE ===')
      console.log('Full response:', response)
      console.log('Response.data:', response.data)
      console.log('=====================')
      
      // Handle different response structures
      // Backend returns user data directly in response (not in response.data)
      // Case 1: response itself is the user data (current backend behavior)
      // Case 2: response.data contains user info (standard axios pattern)
      // Case 3: response.data.data contains user info (nested)
      const userData = (response as any).token 
        ? response  // Backend returns data directly
        : ((response.data as any)?.data || response.data)  // Standard axios wrapper
      
      if (userData) {
        // Store token and user data
        const token = userData.token || response.data?.token || ''
        setToken(token)
        setUser(userData)
        setRememberMeStore(rememberMe)

        // Log for debugging
        console.log('User data:', userData)
        console.log('Token:', token)
        console.log('Role:', userData.role)
        console.log('RoleName:', userData.roleName)

        // Navigate based on role - API returns "role" not "roleName"
        const roleName = (userData.role || userData.roleName)?.toLowerCase()
        
        console.log('Navigating with role:', roleName)
        
        switch (roleName) {
          case 'admin':
            console.log('Navigating to: /admin/users')
            navigate('/admin/users')
            break
          case 'sqahead':
            console.log('Navigating to: /sqahead/dashboard')
            navigate('/sqahead/dashboard')
            break
          case 'sqastaff':
            console.log('Navigating to: /sqastaff/dashboard')
            navigate('/sqastaff/dashboard')
            break
          case 'departmenthead':
            console.log('Navigating to: /departmenthead/dashboard')
            navigate('/departmenthead/dashboard')
            break
          case 'departmentstaff':
            console.log('Navigating to: /departmentstaff/dashboard')
            navigate('/departmentstaff/dashboard')
            break
          case 'director':
            console.log('Navigating to: /director/dashboard')
            navigate('/director/dashboard')
            break
          default:
            console.warn('Unknown role:', roleName, '- Navigating to home')
            navigate('/')
        }
      } else {
        console.error('No user data in response')
        setError('Đăng nhập thất bại. Không nhận được dữ liệu người dùng.')
      }
    } catch (err: any) {
      console.error('=== LOGIN ERROR ===')
      console.error('Error:', err)
      console.error('Error response:', err.response)
      console.error('Error message:', err.message)
      console.error('==================')
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.')
    } finally {
      setIsLoading(false)
    }
  }

  const demoCredentials = [
    { role: 'Admin', email: 'admin@ams.com', password: 'admin123' },
    { role: 'SQA Staff', email: 'sqastaff@ams.com', password: 'sqa123' },
    { role: 'SQA Head', email: 'sqahead@ams.com', password: 'sqahead123' },
    { role: 'Department Staff', email: 'deptstaff@ams.com', password: 'dept123' },
    { role: 'Department Head', email: 'depthead@ams.com', password: 'head123' },
    { role: 'Director', email: 'director@ams.com', password: 'director123' },
  ]

  const quickLogin = (email: string, password: string) => {
    setEmail(email)
    setPassword(password)
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto">
      {/* Background Image with Blur */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://images.travelandleisureasia.com/wp-content/uploads/sites/3/2024/04/08165017/airplane.jpeg?tr=w-1200,q-60)',
          filter: 'blur(4px)',
          transform: 'scale(1.1)',
        }}
      />

      {/* Overlay to darken background slightly */}
      <div className="fixed inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl">
          {/* Main Container */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Login Form */}
            <div className="w-full lg:flex-1 lg:max-w-md mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-3 sm:mb-4">
                    <svg
                      className="w-7 h-7 sm:w-8 sm:h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                    Welcome Back
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600">Sign in to your AMS account</p>
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
                      <p className="text-sm text-red-800 flex-1">{error}</p>
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  {/* Email Input */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                {/* Demo Credentials Toggle - Mobile */}
                <div className="mt-6 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {showCredentials ? 'Hide' : 'Show'} Demo Credentials
                  </button>
                </div>
              </div>
            </div>

            {/* Demo Credentials Panel - Always visible on desktop, toggleable on mobile */}
            <div
              className={`w-full lg:flex-1 lg:max-w-md mx-auto ${
                showCredentials ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Demo Credentials</h3>
                    <p className="text-sm text-gray-600">Click any credential to auto-fill</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {demoCredentials.map((cred, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => quickLogin(cred.email, cred.password)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">{cred.role}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Demo
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500">Email:</span>
                              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                {cred.email}
                              </code>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500">Password:</span>
                              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                {cred.password}
                              </code>
                            </div>
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 mb-1">
                        Development Mode
                      </h4>
                      <p className="text-xs text-yellow-700">
                        These credentials are for testing purposes only. In production, use your
                        actual account credentials.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-white/90 drop-shadow-lg">
              © 2024 Audit Management System. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
