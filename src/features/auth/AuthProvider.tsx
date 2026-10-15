import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { createSupabaseClient, hasSupabaseConfig } from '../../services/supabase/client'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = hasSupabaseConfig()
  const [authState, setAuthState] = useState<{
    session: Session | null
    loading: boolean
    error: string | null
  }>({ session: null, loading: configured, error: null })

  useEffect(() => {
    if (!configured) return

    const client = createSupabaseClient()
    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthState({ session, loading: false, error: null })
      }
    })

    client.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        setAuthState({
          session: data.session,
          loading: false,
          error: error?.message ?? null,
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        setAuthState({
          session: null,
          loading: false,
          error: cause instanceof Error
            ? cause.message
            : 'No se pudo comprobar la sesión.',
        })
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [configured])

  const value = useMemo<AuthContextValue>(() => ({
    configured,
    loading: authState.loading,
    user: authState.session?.user ?? null,
    error: authState.error,
    async signIn(email, password) {
      const { error } = await createSupabaseClient().auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw new Error(error.message)
    },
    async signUp(email, password, username) {
      const { data, error } = await createSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) throw new Error(error.message)
      return data.session !== null
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await createSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (error) throw new Error(error.message)
    },
    async updatePassword(password) {
      const { error } = await createSupabaseClient().auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      const { error } = await createSupabaseClient().auth.signOut()
      if (error) throw new Error(error.message)
    },
  }), [authState, configured])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
