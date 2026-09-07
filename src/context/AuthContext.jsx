import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) {
      console.error('Failed to load profile', error)
      setProfile(null)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      setSession(session)
      await loadProfile(session?.user?.id)
      if (!cancelled) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      await loadProfile(newSession?.user?.id)
    })

    return () => {
      cancelled = true
      listener?.subscription?.unsubscribe()
    }
  }, [loadProfile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp({ email, password, fullName, studentNumber, programme, yearOfStudy, gender }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    // IMPORTANT: data.user existing does NOT mean we're authenticated yet.
    // If this Supabase project requires email confirmation (the default for
    // new projects), signUp() returns a user but data.session is null until
    // the confirmation link is clicked — attempting the profile update here
    // would run with no auth.uid(), fail RLS, and (this was the actual bug)
    // leave full_name/student_number/gender permanently unset with no clear
    // error surfaced. Only attempt the fill-in when we actually have a
    // session; otherwise the new profile-completion gate on Apply For A
    // Room (RequireCompleteProfile) catches it on first real login instead.
    const hasSession = !!data.session

    if (data.user && hasSession) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          student_number: studentNumber,
          programme,
          year_of_study: yearOfStudy,
          gender,
        })
        .eq('id', data.user.id)
      if (profileError) throw profileError
      await loadProfile(data.user.id)
    }

    return { hasSession }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
