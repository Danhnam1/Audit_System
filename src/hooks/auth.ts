
import type {
  LoginPayload,
  LoginResponse,
  RefreshResponse,
  RegisterPayload,
  RegisterResponse,
  ProfileResponse
} from '../constants/type/user'
import type {ApiResponse } from './axios'
import { apiClient } from './axios'


const authService = {
  login: async (payload: LoginPayload): Promise<ApiResponse<LoginResponse>> => {
    return apiClient.post('/Auth/login', payload)
  },
  register: async (payload: RegisterPayload): Promise<ApiResponse<RegisterResponse>> => {
    return apiClient.post('/Auth/register', payload)
  },
  logout: async (): Promise<ApiResponse<void>> => {
    return apiClient.post('/Auth/logout')
  },
  refresh: async (): Promise<ApiResponse<RefreshResponse>> => {
    return apiClient.post('/Auth/refresh-token')
  },
  profile: async (): Promise<ApiResponse<ProfileResponse>> => {
    return apiClient.get('/Auth/profile')
  }
}

export default authService