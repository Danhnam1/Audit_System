import type { AxiosInstance, AxiosResponse } from 'axios'
import axios from 'axios'

import { RequestStatus } from '../constants/enum'
import { queryClient } from '../config/react-query'
import useAuthStore from '../store/useAuthStore'
import authService from './auth'
import { clearOnLogout } from '../utils/clearOnLogout'

// Query keys constant
export const QueryKeys = {
  PROFILE: 'profile',
  USER: 'user',
} as const


export interface ApiResponse<T = unknown> {
  status: number
  message: string
  data: T
}

export interface ApiError<T = unknown> {
  status: number
  message: string
  errors?: T
}

// Get base URL from environment variable or use default
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

setupInterceptors(apiClient)

function setupInterceptors(apiClient: AxiosInstance) {
  let isRefreshing = false
  let refreshSubscribers: ((token: string) => void)[] = []

  const subscribeTokenRefresh = (cb: (token: string) => void) => {
    refreshSubscribers.push(cb)
  }

  const onRefreshed = (token: string) => {
    refreshSubscribers.forEach(cb => cb(token))
    refreshSubscribers = []
  }

  //Interceptor request
  apiClient.interceptors.request.use(
    async request => {
      const token = useAuthStore.getState().token

      if (token) {
        request.headers.Authorization = `Bearer ${token}`
      }

      return request
    },
    error => {
      return Promise.reject(error)
    }
  )

  //Interceptor response
  apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
      return response.data
    },
    async error => {
      const originalRequest = error.config

      // Get rememberMe from auth store
      const { rememberMe } = useAuthStore.getState()
      
      if (error.response?.status === RequestStatus.UNAUTHORIZED && !originalRequest._retry && rememberMe) {
        if (isRefreshing) {
          // Wait for the token to be refreshed
          return new Promise(resolve => {
            subscribeTokenRefresh(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(apiClient(originalRequest))
            })
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const refreshResponse: any = await authService.refresh()

          const { token } = refreshResponse.data

          useAuthStore.getState().setToken(token)

          // Invalidate and refetch user profile
          await queryClient.invalidateQueries({ queryKey: [QueryKeys.PROFILE] })

          originalRequest.headers.Authorization = `Bearer ${token}`
          onRefreshed(token)

          return apiClient(originalRequest)
        } catch (refreshError) {
          useAuthStore.getState().setToken(null)
          useAuthStore.getState().setUser(undefined)
 

          // window.location.href = '/login' ===>>>> AuthGuard will do It's Job

          await clearOnLogout()

          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      } else if (error.response?.status === RequestStatus.NOT_FOUND) {
        // 404 responses should not automatically log the user out.
        // Log details for debugging and allow callers to handle the error.
        try {
          console.warn('API 404 Not Found:', {
            url: originalRequest?.url || originalRequest?.baseURL,
            method: originalRequest?.method,
            status: error.response?.status,
            data: error.response?.data,
          });
        } catch (logErr) {
          // ignore logging errors
        }
      } else if (error.response?.status === RequestStatus.UNAUTHORIZED) {
        // Clear auth state when server returns 401 Unauthorized.
        console.warn('API 401 Unauthorized - clearing auth state', {
          url: originalRequest?.url,
          method: originalRequest?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        useAuthStore.getState().setToken(null)
        useAuthStore.getState().setLoading(false)
        useAuthStore.getState().setIsGlobalLoading(false)
        useAuthStore.getState().setUser(undefined)
        queryClient.removeQueries({ queryKey: [QueryKeys.PROFILE] })
      }

      // Important: reject the original error object so callers can inspect
      // network errors (where response may be undefined, e.g., CORS/preflight).
      // Previously this returned `error.response?.data`, which could be undefined
      // and caused consumers to crash when accessing `err.response`.
      return Promise.reject(error)
    }
  )
}
