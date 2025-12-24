import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../../hooks/auth'
import useAuthStore from '../../store/useAuthStore'
import Background from '../../../public/images/backgorundlogin.jpg'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const { setToken, setUser, setRememberMe: setRememberMeStore, setRole } = useAuthStore()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authService.login({ email, password })

      
      const userData = (response as any).token 
        ? response
        : ((response.data as any)?.data || response.data)
      
      if (userData) {
        const token = userData.token || response.data?.token || ''
        const userRole = userData.role || userData.roleName
        
        setToken(token)
        setUser(userData)
        setRole(userRole)
        setRememberMeStore(rememberMe)

     

        const roleName = userRole?.toLowerCase().replace(/\s+/g, '')
        
        
        switch (roleName) {
          case 'admin':
            navigate('/admin/departments')
            break
          case 'leadauditor':
            navigate('/sqahead/dashboard')
            break
          case 'auditor':
            navigate('/auditor/planning')
            break
          case 'auditeeowner':
            navigate('/departmenthead/dashboard')
            break
          case 'capaowner':
            navigate('/capa-owner/tasks')
            break
          case 'director':
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
    <div className="relative flex h-full w-full">
      <div className="h-screen w-1/2 bg-white">
        <div className="mx-auto flex h-full w-2/3 flex-col justify-center text-black xl:w-1/2">
          <div>
            <p className="text-2xl">Login</p>
            <p>Please login to continue</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-600/80 border border-red-400 rounded-lg">
              <p className="text-sm text-white">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 mt-10">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
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
                  className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base text-gray-900"
                  placeholder="your.email@example.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
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
                  className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base text-gray-900"
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
                <label htmlFor="remember-me" className="ml-2 block text-sm text-black">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-gradient-to-r from-[#6a11cb] to-[#2575fc] hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
      <div className="h-screen w-1/2 bg-blue-600">
        <img src={Background} className="h-full w-full object-cover" alt="Background" />
      </div>
    </div>
  );
}