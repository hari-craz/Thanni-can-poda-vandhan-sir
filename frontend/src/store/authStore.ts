import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, UserRole } from '@/types/auth'
import { loginUser, logoutUser } from '@/services/auth'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  isSuperAdmin: () => boolean
  hasRole: (role: UserRole) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await loginUser(username, password)
          localStorage.setItem('hydronix_token', response.access_token)
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (err: unknown) {
          const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed'
          set({ isLoading: false, error: message })
          throw err
        }
      },

      logout: async () => {
        try {
          await logoutUser()
        } catch {
          // Ignore logout API errors
        }
        localStorage.removeItem('hydronix_token')
        set({ user: null, token: null, isAuthenticated: false, error: null })
      },

      clearError: () => set({ error: null }),

      isSuperAdmin: () => get().user?.role === 'superadmin',

      hasRole: (role: UserRole) => {
        const userRole = get().user?.role
        if (role === 'admin') return userRole === 'admin' || userRole === 'superadmin'
        return userRole === role
      },
    }),
    {
      name: 'hydronix-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
