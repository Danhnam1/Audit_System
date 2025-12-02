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
  const [isLoading, setIsLoading] = useState(false)
  const [_showCredentials, _setShowCredentials] = useState(false)

  const navigate = useNavigate()
  const { setToken, setUser, setRememberMe: setRememberMeStore, setRole } = useAuthStore()

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

      const userData = (response as any).token 
        ? response  // Backend returns data directly
        : ((response.data as any)?.data || response.data)  // Standard axios wrapper
      
      if (userData) {
        // Store token and user data
        const token = userData.token || response.data?.token || ''
        const userRole = userData.role || userData.roleName;
        
        setToken(token)
        setUser(userData)
        setRole(userRole) // Save role to persist
        setRememberMeStore(rememberMe)

        // Log for debugging
        console.log('User data:', userData)
        console.log('Token:', token)
        console.log('Role:', userData.role)
        console.log('RoleName:', userData.roleName)
        console.log('Setting role to store:', userRole)

        // Navigate based on role - API returns "role" not "roleName"
        const roleName = userRole?.toLowerCase().replace(/\s+/g, '')
        
        console.log('Navigating with role:', roleName)
        
        switch (roleName) {
          case 'admin':
            console.log('Navigating to: /admin/departments')
            navigate('/admin/departments')
            break
          case 'leadauditor':
            console.log('Navigating to: /sqahead/dashboard')
            navigate('/sqahead/dashboard')
            break
          case 'auditor':
            console.log('Navigating to: /auditor/planning')
            navigate('/auditor/planning')
            break
          case 'auditeeowner':
            console.log('Navigating to: /departmenthead/dashboard')
            navigate('/departmenthead/dashboard')
            break
          case 'capaowner':
            console.log('Navigating to: /capa-owner/tasks')
            navigate('/capa-owner/tasks')
            break
          case 'director':
            console.log('Navigating to: /director/review-plans')
            navigate('/director/review-plans')
            break
          default:
            console.warn('Unknown role:', roleName, '- Navigating to home')
            navigate('/')
        }
      } else {
        console.error('No user data in response')
        setError('Login failed. User data was not received.')
      }
    } catch (err: any) {
      console.error('=== LOGIN ERROR ===')
      console.error('Error:', err)
      // Guarded access because err may be undefined or not an AxiosError
      const resp = err?.response
      const msg = err?.message
      console.error('Error response:', resp)
      console.error('Error message:', msg)
      console.error('==================')
      const serverMsg = resp?.data?.message || resp?.data || msg
      setError(
        typeof serverMsg === 'string'
          ? serverMsg
          : 'Login failed. Please check your email and password.'
      )
    } finally {
      setIsLoading(false)
    }
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
                  <p className="text-sm sm:text-base text-gray-600">Sign in to the system</p>
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

            
              </div>
            </div>

          
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-white/90 drop-shadow-lg">
              1.0.0 Audit Management System. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
