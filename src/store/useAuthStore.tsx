import { create } from 'zustand'

import { persist } from 'zustand/middleware'

import authService from '../hooks/auth'
import type { User, ProfileResponse , RefreshResponse} from '../constants/type/user'

import { clearOnLogout } from '../utils/clearOnLogout'

type RoleName = 'Admin' | 'SQAHead'

// Helper to decode JWT and get deptId
const getDeptIdFromToken = (token: string | null): number | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const deptId = payload['DeptId'];
    return deptId ? Number(deptId) : null;
  } catch (err) {
    console.error('Failed to decode token', err);
    return null;
  }
};

// Helper to decode JWT and get userId
const getUserIdFromToken = (token: string | null): string | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Try different possible claim names (the actual claim is the full URL)
    const userId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] 
      || payload['nameidentifier']
      || payload['sub'] 
      || payload['userId'] 
      || payload['UserId'] 
      || payload['nameid'] 
      || null;
    return userId;
  } catch (err) {
    console.error('Failed to decode token for userId', err);
    return null;
  }
};

// Export for use in components
export const useDeptId = () => {
  const token = useAuthStore(state => state.token);
  return getDeptIdFromToken(token);
};

// Export userId hook
export const useUserId = () => {
  const token = useAuthStore(state => state.token);
  return getUserIdFromToken(token);
};

interface AuthState {
  user: ProfileResponse | null
  token: string | null
  rememberMe: boolean
  setUser: (user: User | undefined) => void
  setToken: (token: string | null) => void
  setRememberMe: (value: boolean) => void
  isLoggingIn: boolean
  logout: () => Promise<void>
  refreshToken: () => Promise<RefreshResponse | null>
  fetchUser: () => Promise<ProfileResponse | null | undefined>
  isFetchingUser: boolean
  loading: boolean
  setLoading: (value: boolean) => void
  isGlobalLoading: boolean
  setIsGlobalLoading: (value: boolean) => void
  role: RoleName | string | undefined
  setRole: (groupCode: string | undefined) => void
  isI18nLoading: boolean
  setIsI18nLoading: (value: boolean) => void
  isLoggingOut: boolean
  setIsLoggingOut: (value: boolean) => void
}

const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      rememberMe: false,
      balance: undefined,
      loading: true,
      setLoading: value => set({ loading: value }),
      setUser: user => {
        set({ user });
      },
      setToken: token => {
        set({ token });
      },
      setRememberMe: rememberMe => set({ rememberMe }),
      role: undefined,
      setRole: role => {
        set({ role });
      },
      isLoggingIn: false,
      isGlobalLoading: true,
      setIsGlobalLoading: value => set({ isGlobalLoading: value }),
      isI18nLoading: true,
      setIsI18nLoading: value => set({ isI18nLoading: value }),
      logout: async () => {
        useAuthStore.getState().setIsLoggingOut(true)
        await authService.logout().catch(reason => {
        })
        set({
          user: null,
          token: null,
        })

        await clearOnLogout()

        setTimeout(()=> {set({isLoggingOut: false})}, 500)
      },
      isLoggingOut: false,
      setIsLoggingOut: value => set({ isLoggingOut: value }),

      refreshToken: async () => {
        const res = await authService.refresh().catch((reason: any) => {
          console.error('Refresh Token Error:', reason)
          return null
        })

        if (res?.data) {
          const refreshData = res.data as RefreshResponse
          set({
            token: refreshData.token || null,
            user: refreshData as ProfileResponse
          })
          return refreshData
        }

        return null
      },

      isFetchingUser: false,
      fetchUser: async () => {
        const isFetchingUser = useAuthStore.getState().isFetchingUser
        const setRole = useAuthStore.getState().setRole

        if (isFetchingUser) {
          return undefined
        }

        set({ isFetchingUser: true })

        const res = await authService.profile().catch((reason: any) => {
          console.error('Fetch User Error:', reason)
          set({ isFetchingUser: false })
          return null
        })

        if (!res) {
          set({ isFetchingUser: false })
          return null
        }

        set({
          user: res.data,
          isFetchingUser: false
        })
        
        if (res.data.group_code) {
          setRole(res.data.group_code)
        }

        return res.data
      },
    }),

    {
      name: 'auth-storage',
      version: 1, // Add version to clear old cache
      partialize: state => {
      
        return {
          token: state.token, 
          user: state.user, 
          rememberMe: state.rememberMe, 
          role: state.role
        };
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('[AuthStore] Hydration error:', error);
          } else {
           
            
            // Set loading to false after hydration
            if (state) {
              state.setLoading(false);
            }
          }
        };
      }
    }
  )
)

export default useAuthStore
