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
      
      console.log('=== LOGIN RESPONSE ===')
      console.log('Full response:', response)
      console.log('Response.data:', response.data)
      console.log('=====================')
      
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

        console.log('User data:', userData)
        console.log('Token:', token)
        console.log('Role:', userRole)

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
  <div className="h-screen w-1/2 bg-black">
    <div className="mx-auto flex h-full w-2/3 flex-col justify-center text-white xl:w-1/2">
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

      <div className="mt-10">
        <form onSubmit={handleSubmit}>
          <div>
            <label className="mb-2.5 block font-extrabold" htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="inline-block w-full rounded-full bg-white p-2.5 leading-none text-black placeholder-indigo-900 shadow placeholder:opacity-30" 
              placeholder="mail@user.com"
              required
            />
          </div>
          <div className="mt-4">
            <label className="mb-2.5 block font-extrabold" htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="inline-block w-full rounded-full bg-white p-2.5 leading-none text-black placeholder-indigo-900 shadow"
              required
            />
          </div>
          <div className="mt-4 flex w-full flex-col justify-between sm:flex-row">
            {/* Remember me */}
            <div>
              <input 
                type="checkbox" 
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember" className="mx-2 text-sm">Remember me</label>
            </div>
            {/* Forgot password */}
            <div>
              <a href="#" className="text-sm hover:text-gray-200">Forgot password</a>
            </div>
          </div>
          <div className="my-10">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-gradient-to-r from-[#6a11cb] to-[#2575fc] p-5 font-medium text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center"
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
                'Login'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <div className="h-screen w-3/6 bg-blue-600 ">
    <img src={Background} className="h-full w-full " alt="Background" />
  </div>
</div>
  );
}