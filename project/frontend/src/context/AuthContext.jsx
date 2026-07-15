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
      if (session?.user) fetchBusinesses(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchBusinesses(session.user.email)
      else {
        setBusinesses([])
        setActiveBusinessId(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // NOTE IMPORTANTE : businesses.user_id est une FK NOT NULL vers
  // public.users(id) — la table d'identité du BOT WhatsApp, indexée par
  // téléphone. Ce n'est PAS le même espace d'ID que auth.users (Supabase
  // Auth). Le pont entre "compte web connecté" et "entreprise" est donc la
  // colonne businesses.auth_email (déjà utilisée par l'Edge Function
  // whatsapp-verify-otp pour la même raison), pas user_id.
  // On NE fetch donc JAMAIS les entreprises par user_id ici.

  // Récupère TOUTES les entreprises de l'utilisateur (un compte peut en
  // gérer plusieurs), liées via auth_email. L'entreprise "active" (celle
  // affichée dans le dashboard) est retenue en local (localStorage) — il
  // n'existe pas de table `profiles` en base, et on évite volontairement
  // de réutiliser public.users.active_business_id qui appartient à l'état
  // conversationnel du bot WhatsApp.
  async function fetchBusinesses(userEmail) {
    const { data: bizList } = await supabase
      .from('businesses')
      .select('*')
      .eq('auth_email', userEmail)
      .order('created_at', { ascending: true })

    const list = bizList || []
    setBusinesses(list)
    setActiveBusinessId(readStoredActiveBusiness(userEmail, list))
    setLoading(false)
  }

  function readStoredActiveBusiness(userEmail, list) {
    let stored = null
    try { stored = localStorage.getItem(activeBusinessStorageKey(userEmail)) } catch { /* noop */ }
    return stored && list.some(b => b.id === stored) ? stored : (list[0]?.id ?? null)
  }

  function activeBusinessStorageKey(userEmail) {
    return `yamobiz_active_business:${userEmail}`
  }

  function persistActiveBusiness(userEmail, businessId) {
    try { localStorage.setItem(activeBusinessStorageKey(userEmail), businessId) } catch { /* noop */ }
  }

  // Récupère (ou crée) la ligne public.users correspondant à ce numéro —
  // la table d'identité du bot, requise pour satisfaire la FK NOT NULL
  // businesses.user_id. On ne gère pas le cycle de vie de cette table par
  // ailleurs (c'est le bot qui la peuple normalement) ; on s'assure juste
  // qu'une ligne existe avant de créer/rattacher une entreprise.
  async function getOrCreateBotUserId(phone, name) {
    const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle()
    if (existing) return existing.id

    const { data: created, error } = await supabase.from('users').insert({ phone, name }).select('id').single()
    if (error) {
      // Course possible avec une insertion concurrente (ex: le bot) sur le
      // même téléphone (contrainte UNIQUE) — on relit dans ce cas.
      if (error.code === '23505') {
        const { data: retry } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle()
        if (retry) return retry.id
      }
      throw error
    }
    return created.id
  }

  async function signUp(email, password, businessData) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      // Le business est créé ici, sur le web — le numéro est normalisé pour
      // que la connexion WhatsApp (basée sur le même champ `phone`) le
      // retrouve plus tard sans ambiguïté de format.
      const phone = normalizePhone(businessData.phone)

      // businesses.user_id doit pointer vers public.users(id) (identité du
      // bot), pas vers auth.users(id) — on résout/crée cette ligne d'abord.
      const botUserId = await getOrCreateBotUserId(phone, businessData.name)

      const { data: biz, error: bizError } = await supabase
        .from('businesses')
        .insert({
          user_id: botUserId,
          ...businessData,
          phone,
          // Pont entre ce compte Supabase Auth (web) et l'entreprise — la
          // même colonne que celle déjà utilisée par whatsapp-verify-otp
          // pour rattacher une session au bon business par téléphone.
          auth_email: email,
        })
        .select()
        .single()
      if (bizError) throw bizError

      // Important : onAuthStateChange peut avoir déclenché fetchBusinesses()
      // AVANT que cet insert ne soit terminé (course entre la session créée
      // par auth.signUp et cet insert), ce qui laisse `businesses` vide dans
      // le contexte. On force donc l'état ici avec la ligne qu'on vient de
      // créer, pour ne pas dépendre du timing du listener.
      setBusinesses([biz])
      setActiveBusinessId(biz.id)
      persistActiveBusiness(email, biz.id)
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
    if (user) await fetchBusinesses(user.email)
  }

  // --- Gestion multi-entreprises ---

  // Change l'entreprise active (celle affichée dans le dashboard et les
  // autres pages). Persisté en local (pas de table `profiles` en base) —
  // ça survit au rechargement sur ce même navigateur.
  async function switchBusiness(businessId) {
    if (!user || !businesses.some(b => b.id === businessId)) return
    setActiveBusinessId(businessId)
    persistActiveBusiness(user.email, businessId)
  }

  // Ajoute une nouvelle entreprise au compte, et la rend active.
  async function addBusiness(businessData) {
    if (!user) throw new Error('not_authenticated')
    const phone = normalizePhone(businessData.phone)
    const botUserId = await getOrCreateBotUserId(phone, businessData.name)
    const { data: biz, error } = await supabase
      .from('businesses')
      .insert({
        user_id: botUserId,
        ...businessData,
        phone,
        auth_email: user.email,
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
    if (payload.phone) {
      payload.phone = normalizePhone(payload.phone)
      // Le numéro change potentiellement l'identité bot rattachée.
      payload.user_id = await getOrCreateBotUserId(payload.phone, payload.name ?? updates.name)
    }
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
      if (user) persistActiveBusiness(user.email, next)
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
