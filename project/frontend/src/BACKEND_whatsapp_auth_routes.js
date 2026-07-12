/**
 * WhatsApp login for the YamoBiz web app.
 *
 * Ajoute ces 2 routes à ton backend Node.js existant (celui qui fait déjà
 * tourner le bot WhatsApp). Elles réutilisent :
 *   - ta fonction d'envoi WhatsApp existante (sendWhatsAppMessage)
 *   - le même Supabase (avec la clé service_role, PAS l'anon key)
 *
 * Variables d'environnement nécessaires (déjà présentes normalement pour
 * SUPABASE_URL, sauf SUPABASE_SERVICE_ROLE_KEY à ajouter — jamais côté
 * frontend) :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   <-- clé "service_role" de Supabase (Project Settings > API)
 *
 * Remplace `sendWhatsAppMessage` par ta fonction réelle d'envoi (celle
 * utilisée par ton bot pour répondre aux clients).
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
// import { sendWhatsAppMessage } from './whatsapp.js' // <- ta fonction existante

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const OTP_TTL_MS = 5 * 60 * 1000      // le code expire après 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000  // 1 nouveau code max toutes les 60s
const MAX_ATTEMPTS = 5                // 5 essais max avant de devoir redemander un code

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function normalizePhone(phone) {
  // Doit rester identique à src/lib/normalizePhone.js côté web, sinon les
  // numéros ne correspondront plus lors du lookup dans `businesses.phone`.
  return (phone || '').trim().replace(/[^\d+]/g, '')
}

export function registerWhatsAppAuthRoutes(app) {
  // ---------------------------------------------------------------------
  // POST /auth/whatsapp/request-otp
  // Body: { phone: string }
  // ---------------------------------------------------------------------
  app.post('/auth/whatsapp/request-otp', async (req, res) => {
    try {
      const phone = normalizePhone(req.body.phone || '')
      if (!phone) return res.status(400).json({ error: 'phone_required' })

      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id, phone')
        .eq('phone', phone)
        .maybeSingle()

      if (!business) {
        return res.status(404).json({ error: 'business_not_found' })
      }

      // Anti-spam: refuse if a code was issued less than RESEND_COOLDOWN_MS ago
      const { data: recent } = await supabaseAdmin
        .from('whatsapp_otp_codes')
        .select('created_at')
        .eq('phone', phone)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ error: 'too_many_requests' })
      }

      const code = generateOtp()

      await supabaseAdmin.from('whatsapp_otp_codes').insert({
        phone,
        code_hash: hashCode(code),
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })

      await sendWhatsAppMessage(
        phone,
        `🔐 Votre code de connexion YamoBiz : *${code}*\n\nCe code expire dans 5 minutes. Ne le partagez avec personne.`
      )

      return res.json({ ok: true })
    } catch (err) {
      console.error('request-otp error', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  // ---------------------------------------------------------------------
  // POST /auth/whatsapp/verify-otp
  // Body: { phone: string, code: string }
  // Response: { email, token_hash } — à échanger côté frontend via
  // supabase.auth.verifyOtp({ email, token: token_hash, type: 'magiclink' })
  // ---------------------------------------------------------------------
  app.post('/auth/whatsapp/verify-otp', async (req, res) => {
    try {
      const phone = normalizePhone(req.body.phone || '')
      const code = (req.body.code || '').trim()
      if (!phone || !code) return res.status(400).json({ error: 'phone_and_code_required' })

      const { data: otpRow } = await supabaseAdmin
        .from('whatsapp_otp_codes')
        .select('*')
        .eq('phone', phone)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!otpRow) return res.status(400).json({ error: 'no_active_code' })
      if (new Date(otpRow.expires_at) < new Date()) {
        return res.status(400).json({ error: 'code_expired' })
      }
      if (otpRow.attempts >= MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'too_many_attempts' })
      }

      if (hashCode(code) !== otpRow.code_hash) {
        await supabaseAdmin
          .from('whatsapp_otp_codes')
          .update({ attempts: otpRow.attempts + 1 })
          .eq('id', otpRow.id)
        return res.status(400).json({ error: 'invalid_code' })
      }

      await supabaseAdmin
        .from('whatsapp_otp_codes')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', otpRow.id)

      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .eq('phone', phone)
        .single()

      let authEmail = business.auth_email

      if (!authEmail) {
        if (business.user_id) {
          // Cas normal désormais : le business a été créé sur le web (avec un
          // vrai email + mot de passe). On réutilise ce compte plutôt que
          // d'en créer un second — WhatsApp devient juste un 2e moyen de
          // s'y connecter, sur le même user_id.
          const { data: userData, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(business.user_id)
          if (getUserErr || !userData?.user?.email) {
            console.error('getUserById error', getUserErr)
            return res.status(500).json({ error: 'account_lookup_failed' })
          }
          authEmail = userData.user.email

          await supabaseAdmin
            .from('businesses')
            .update({ auth_email: authEmail })
            .eq('id', business.id)
        } else {
          // Cas plus rare : business sans compte web (ex. créé manuellement,
          // ou provenance future directement depuis WhatsApp). On crée un
          // compte Supabase synthétique pour pouvoir générer une session.
          authEmail = `wa+${phone.replace(/\D/g, '')}@yamobiz.app`

          const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
          let userId = existing?.users?.find(u => u.email === authEmail)?.id

          if (!userId) {
            const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: authEmail,
              email_confirm: true,
              user_metadata: { source: 'whatsapp', phone },
            })
            if (createErr) {
              console.error('createUser error', createErr)
              return res.status(500).json({ error: 'user_creation_failed' })
            }
            userId = created.user.id
          }

          await supabaseAdmin
            .from('businesses')
            .update({ auth_email: authEmail, user_id: userId })
            .eq('id', business.id)
        }
      }

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: authEmail,
      })

      if (linkErr) {
        console.error('generateLink error', linkErr)
        return res.status(500).json({ error: 'session_generation_failed' })
      }

      return res.json({
        email: authEmail,
        token_hash: linkData.properties.hashed_token,
      })
    } catch (err) {
      console.error('verify-otp error', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}

// Dans ton fichier principal (index.js / server.js) :
//
//   import { registerWhatsAppAuthRoutes } from './auth/whatsappAuthRoutes.js'
//   registerWhatsAppAuthRoutes(app)
//
// N'oublie pas d'activer CORS pour l'origine de ton app web (Vite dev + prod)
// sur ces 2 routes si ce n'est pas déjà fait globalement.
