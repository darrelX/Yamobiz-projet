import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizePhone } from '../lib/normalizePhone'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [activeBusinessId, setActiveBusinessId] = useState(null)
  const [loading, setLoading] = useState(true)

  const business = businesses.find(b => b.id === activeBusinessId) || businesses[0] || null

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchBusinesses(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchBusinesses(session.user.id)
      else {
        setBusinesses([])
        setActiveBusinessId(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Récupère TOUTES les entreprises de l'utilisateur (un compte peut en
  // gérer plusieurs) + le profil qui retient laquelle est "active" (celle
  // affichée dans le dashboard / les autres pages).
  async function fetchBusinesses(userId) {
    const [{ data: bizList }, { data: profile }] = await Promise.all([
      supabase.from('businesses').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('profiles').select('active_business_id').eq('id', userId).maybeSingle(),
    ])
    const list = bizList || []
    setBusinesses(list)

    let active = profile?.active_business_id
    if (!active || !list.some(b => b.id === active)) {
      active = list[0]?.id ?? null
    }
    setActiveBusinessId(active)
    setLoading(false)
  }

  async function signUp(email, password, businessData) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      // Le business est créé ici, sur le web — le numéro est normalisé pour
      // que la connexion WhatsApp (basée sur le même champ `phone`) le
      // retrouve plus tard sans ambiguïté de format.
      const { data: biz, error: bizError } = await supabase
        .from('businesses')
        .insert({
          user_id: data.user.id,
          ...businessData,
          phone: normalizePhone(businessData.phone),
        })
        .select()
        .single()
      if (bizError) throw bizError

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id, active_business_id: biz.id })
      if (profileError) throw profileError

      // Important : onAuthStateChange peut avoir déclenché fetchBusinesses()
      // AVANT que cet insert ne soit terminé (course entre la session créée
      // par auth.signUp et cet insert), ce qui laisse `businesses` vide dans
      // le contexte. On force donc l'état ici avec la ligne qu'on vient de
      // créer, pour ne pas dépendre du timing du listener.
      setBusinesses([biz])
      setActiveBusinessId(biz.id)
      setLoading(false)
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
    if (user) await fetchBusinesses(user.id)
  }

  // --- Gestion multi-entreprises ---

  // Change l'entreprise active (celle affichée dans le dashboard et les
  // autres pages). Persisté en base pour survivre à un rechargement.
  async function switchBusiness(businessId) {
    if (!user || !businesses.some(b => b.id === businessId)) return
    setActiveBusinessId(businessId)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, active_business_id: businessId })
    if (error) throw error
  }

  // Ajoute une nouvelle entreprise au compte, et la rend active.
  async function addBusiness(businessData) {
    if (!user) throw new Error('not_authenticated')
    const { data: biz, error } = await supabase
      .from('businesses')
      .insert({
        user_id: user.id,
        ...businessData,
        phone: normalizePhone(businessData.phone),
      })
      .select()
      .single()
    if (error) throw error
    setBusinesses(prev => [...prev, biz])
    await switchBusiness(biz.id)
    return biz
  }

  async function updateBusiness(businessId, updates) {
    const payload = { ...updates }
    if (payload.phone) payload.phone = normalizePhone(payload.phone)
    const { data, error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', businessId)
      .select()
      .single()
    if (error) throw error
    setBusinesses(prev => prev.map(b => (b.id === businessId ? data : b)))
    return data
  }

  // Supprime une entreprise (et toutes ses données liées, via cascade côté
  // DB). Si c'était l'entreprise active, une autre prend le relais.
  async function deleteBusiness(businessId) {
    const { error } = await supabase.from('businesses').delete().eq('id', businessId)
    if (error) throw error
    const remaining = businesses.filter(b => b.id !== businessId)
    setBusinesses(remaining)
    if (activeBusinessId === businessId) {
      const next = remaining[0]?.id ?? null
      setActiveBusinessId(next)
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, active_business_id: next })
      }
    }
  }

  // --- Gestion du compte (email / mot de passe) ---

  async function updateEmail(newEmail) {
    const { data, error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
    return data
  }

  async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, business, businesses, loading,
      signUp, signIn, resetPassword, signOut, refreshBusiness,
      requestWhatsAppOtp, verifyWhatsAppOtp,
      switchBusiness, addBusiness, updateBusiness, deleteBusiness,
      updateEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
