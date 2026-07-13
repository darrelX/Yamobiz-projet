import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizePhone } from '../lib/normalizePhone'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchBusiness(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchBusiness(session.user.id)
      else {
        setBusiness(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchBusiness(userId) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setBusiness(data)
    setLoading(false)
  }

  async function signUp(email, password, businessData) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      // Le business est créé ici, sur le web — le numéro est normalisé pour
      // que la connexion WhatsApp (basée sur le même champ `phone`) le
      // retrouve plus tard sans ambiguïté de format.
      const { error: bizError } = await supabase.from('businesses').insert({
        user_id: data.user.id,
        ...businessData,
        phone: normalizePhone(businessData.phone),
      })
      if (bizError) throw bizError
    }
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    })
    if (error) throw error
    return data
  }

  // --- WhatsApp phone login ---
  // Ces 2 fonctions appellent des Supabase Edge Functions — pas ton backend
  // bot. Le frontend ne parle qu'à Supabase, exactement comme pour le reste
  // de l'app.

  // Step 1: demande l'envoi d'un code à usage unique sur WhatsApp.
  // Le numéro doit déjà être lié à un business (créé via l'inscription web).
  async function requestWhatsAppOtp(phone) {
    const { data, error } = await supabase.functions.invoke('whatsapp-request-otp', {
      body: { phone: normalizePhone(phone) },
    })
    if (error) {
      const err = new Error('request_failed')
      err.code = 'request_failed'
      throw err
    }
    if (!data?.ok) {
      const err = new Error(data?.error || 'request_failed')
      err.code = data?.error || 'request_failed'
      throw err
    }
    return data
  }

  // Step 2: vérifie le code reçu, puis l'échange contre une vraie session Supabase.
  async function verifyWhatsAppOtp(phone, code) {
    const { data, error } = await supabase.functions.invoke('whatsapp-verify-otp', {
      body: { phone: normalizePhone(phone), code },
    })
    if (error) {
      const err = new Error('verify_failed')
      err.code = 'verify_failed'
      throw err
    }
    if (!data?.ok) {
      const err = new Error(data?.error || 'verify_failed')
      err.code = data?.error || 'verify_failed'
      throw err
    }

    const { error: sessionErr } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })
    if (sessionErr) throw sessionErr
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshBusiness() {
    if (user) await fetchBusiness(user.id)
  }

  return (
    <AuthContext.Provider value={{
      user, business, loading,
      signUp, signIn, resetPassword, signOut, refreshBusiness,
      requestWhatsAppOtp, verifyWhatsAppOtp,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
