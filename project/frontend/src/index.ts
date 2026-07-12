// Supabase Edge Function — POST /functions/v1/whatsapp-verify-otp
// Body: { phone: string, code: string }
// Réponse (succès) : { ok: true, email, token_hash }
//   -> à échanger côté frontend via supabase.auth.verifyOtp({ email, token: token_hash, type: 'magiclink' })

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MAX_ATTEMPTS = 5

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(phone: string) {
  return (phone || '').trim().replace(/[^\d+]/g, '')
}

async function hashCode(code: string) {
  const bytes = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone: rawPhone, code } = await req.json()
    const phone = normalizePhone(rawPhone)
    if (!phone || !code) return json({ ok: false, error: 'phone_and_code_required' })

    const { data: otpRow } = await supabaseAdmin
      .from('whatsapp_otp_codes')
      .select('*')
      .eq('phone', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRow) return json({ ok: false, error: 'no_active_code' })
    if (new Date(otpRow.expires_at) < new Date()) return json({ ok: false, error: 'code_expired' })
    if (otpRow.attempts >= MAX_ATTEMPTS) return json({ ok: false, error: 'too_many_attempts' })

    const codeHash = await hashCode(String(code).trim())
    if (codeHash !== otpRow.code_hash) {
      await supabaseAdmin
        .from('whatsapp_otp_codes')
        .update({ attempts: otpRow.attempts + 1 })
        .eq('id', otpRow.id)
      return json({ ok: false, error: 'invalid_code' })
    }

    // Ne PAS marquer le code consommé ici : si une étape suivante échoue, on
    // veut pouvoir retenter avec le même code plutôt que de le brûler pour rien.

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('phone', phone)
      .single()

    if (!business) return json({ ok: false, error: 'business_not_found' })

    let authEmail = business.auth_email as string | null

    if (!authEmail && business.user_id) {
      // Cas normal : le business a été créé sur le web (email + mot de
      // passe). On réutilise ce compte — WhatsApp devient un 2e moyen de
      // se connecter au même user_id, pas un compte séparé.
      const { data: userData, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(business.user_id)
      if (getUserErr || !userData?.user?.email) {
        // user_id enregistré mais compte introuvable côté Auth (donnée
        // orpheline, ex. business créé/modifié manuellement) : on ne bloque
        // pas, on retombe sur la création d'un compte propre ci-dessous.
        console.error('getUserById error — falling back to synthetic account', getUserErr)
      } else {
        authEmail = userData.user.email
        await supabaseAdmin.from('businesses').update({ auth_email: authEmail }).eq('id', business.id)
      }
    }

    if (!authEmail) {
      // Cas business sans compte web valide : on crée/retrouve un compte
      // Supabase synthétique pour pouvoir générer une session.
      authEmail = `wa+${phone.replace(/\D/g, '')}@yamobiz.app`

      const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
      let syntheticUserId = existing?.users?.find(u => u.email === authEmail)?.id

      if (!syntheticUserId) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          email_confirm: true,
          user_metadata: { source: 'whatsapp', phone },
        })
        if (createErr) {
          console.error('createUser error', createErr)
          return json({ ok: false, error: 'user_creation_failed' })
        }
        syntheticUserId = created.user.id
      }

      await supabaseAdmin
        .from('businesses')
        .update({ auth_email: authEmail, user_id: syntheticUserId })
        .eq('id', business.id)
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })

    if (linkErr) {
      console.error('generateLink error', linkErr)
      return json({ ok: false, error: 'session_generation_failed' })
    }

    // Tout a réussi : on peut brûler le code maintenant.
    await supabaseAdmin
      .from('whatsapp_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otpRow.id)

    return json({
      ok: true,
      email: authEmail,
      token_hash: linkData.properties.hashed_token,
    })
  } catch (err) {
    console.error('whatsapp-verify-otp error', err)
    return json({ ok: false, error: 'internal_error' })
  }
})