import { create } from 'zustand'

import { persist } from 'zustand/middleware'

import authService from '../hooks/auth'
import type { User, ProfileResponse , RefreshResponse} from '../constants/type/user'

import { clearOnLogout } from '../utils/clearOnLogout'

type RoleName = 'Admin' | 'SQAHead'

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
        console.log('[AuthStore] Setting user:', user);
        set({ user });
      },
      setToken: token => {
        console.log('[AuthStore] Setting token:', token ? 'exists' : 'null');
        set({ token });
      },
      setRememberMe: rememberMe => set({ rememberMe }),
      role: undefined,
      setRole: role => {
        console.log('[AuthStore] Setting role:', role);
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
          console.log('Error on Logout:', reason)
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
        console.log('[AuthStore] Saving to localStorage:', {
          hasToken: !!state.token,
          hasUser: !!state.user,
          hasRole: !!state.role,
          user: state.user
        });
        return {
          token: state.token, 
          user: state.user, 
          rememberMe: state.rememberMe, 
          role: state.role
        };
      },
      onRehydrateStorage: () => {
        console.log('[AuthStore] Starting hydration from localStorage...');
        return (state, error) => {
          if (error) {
            console.error('[AuthStore] Hydration error:', error);
          } else {
            console.log('[AuthStore] Hydration complete:', {
              hasToken: !!state?.token,
              hasUser: !!state?.user,
              hasRole: !!state?.role,
              user: state?.user,
              token: state?.token ? 'exists' : 'null'
            });
            
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
