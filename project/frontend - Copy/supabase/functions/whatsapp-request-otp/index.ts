// Supabase Edge Function — POST /functions/v1/whatsapp-request-otp
// Body: { phone: string }
//
// Cette fonction vit dans Supabase, pas dans ton backend bot. Elle parle
// directement à l'API Meta WhatsApp Cloud pour envoyer le code — ton bot
// Node.js n'est jamais impliqué. Frontend et bot ne partagent que la DB.
//
// Secrets requis (supabase secrets set ...), à récupérer sur
// developers.facebook.com (App Meta → WhatsApp → API Setup) :
//   WHATSAPP_ACCESS_TOKEN       <- token d'accès Meta
//   WHATSAPP_PHONE_NUMBER_ID    <- l'ID du numéro expéditeur côté Meta
//   WHATSAPP_API_VERSION        <- optionnel, défaut 'v21.0' si absent
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement
// par Supabase dans toutes les Edge Functions — rien à configurer pour ça.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const WHATSAPP_API_VERSION = Deno.env.get('WHATSAPP_API_VERSION') || 'v21.0'

const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(phone: string) {
  // Doit rester identique à src/lib/normalizePhone.js côté frontend.
  return (phone || '').trim().replace(/[^\d+]/g, '')
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function hashCode(code: string) {
  const bytes = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sendWhatsAppOtp(phone: string, code: string) {
  const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'text',
      text: {
        body: `🔐 Votre code de connexion YamoBiz : ${code}\n\nCe code expire dans 5 minutes. Ne le partagez avec personne.`,
      },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`whatsapp_send_failed: ${errText}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone: rawPhone } = await req.json()
    const phone = normalizePhone(rawPhone)
    if (!phone) return json({ ok: false, error: 'phone_required' })

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, phone')
      .eq('phone', phone)
      .maybeSingle()

    if (!business) return json({ ok: false, error: 'business_not_found' })

    const { data: recent } = await supabaseAdmin
      .from('whatsapp_otp_codes')
      .select('created_at')
      .eq('phone', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return json({ ok: false, error: 'too_many_requests' })
    }

    const code = generateOtp()
    const code_hash = await hashCode(code)

    const { error: insertErr } = await supabaseAdmin.from('whatsapp_otp_codes').insert({
      phone,
      code_hash,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })

    if (insertErr) {
      console.error('whatsapp_otp_codes insert error', insertErr)
      return json({ ok: false, error: 'internal_error' })
    }

    await sendWhatsAppOtp(phone, code)

    return json({ ok: true })
  } catch (err) {
    console.error('whatsapp-request-otp error', err)
    return json({ ok: false, error: 'internal_error' })
  }
})
