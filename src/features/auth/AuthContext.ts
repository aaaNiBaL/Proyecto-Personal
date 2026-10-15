import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface AuthContextValue {
  configured: boolean
  loading: boolean
  user: User | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<boolean>
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.')
  }
  return value
}
