import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AppRole, Tables } from '@/lib/types'

interface AuthState {
  ready: boolean
  session: Session | null
  user: User | null
  profile: Tables<'profiles'> | null
  roles: AppRole[]
  isStaff: boolean
  hasRole: (...roles: AppRole[]) => boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      qc.invalidateQueries()
    })
    return () => sub.subscription.unsubscribe()
  }, [qc])

  const uid = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['me', uid],
    enabled: !!supabase && !!uid,
    queryFn: async () => {
      const [{ data: profile, error }, { data: roles }] = await Promise.all([
        supabase!.from('profiles').select('*').eq('id', uid!).maybeSingle(),
        supabase!.rpc('my_roles'),
      ])
      if (error) throw error
      return { profile, roles: (roles ?? []) as AppRole[] }
    },
  })

  const refreshProfile = useCallback(async () => { await profileQuery.refetch() }, [profileQuery])
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    qc.clear()
  }, [qc])

  const value = useMemo<AuthState>(() => {
    const roles = profileQuery.data?.roles ?? []
    return {
      ready: ready && (!uid || !profileQuery.isLoading),
      session,
      user: session?.user ?? null,
      profile: profileQuery.data?.profile ?? null,
      roles,
      isStaff: roles.length > 0,
      hasRole: (...want) => roles.includes('super_admin') || want.some((r) => roles.includes(r)),
      refreshProfile,
      signOut,
    }
  }, [ready, uid, session, profileQuery.data, profileQuery.isLoading, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
