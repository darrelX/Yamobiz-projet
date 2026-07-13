-- Migration: authentification WhatsApp pour l'app web YamoBiz
-- À exécuter dans le SQL Editor de Supabase (ou via ta CLI de migrations)

-- 1. Table des codes OTP envoyés par WhatsApp
create table if not exists whatsapp_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,        -- on ne stocke jamais le code en clair
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_otp_phone
  on whatsapp_otp_codes (phone);

-- Cette table n'est manipulée que par le backend via la clé service_role.
-- RLS activé + aucune policy => inaccessible depuis le frontend (anon key).
alter table whatsapp_otp_codes enable row level security;

-- 2. Lien entre un business et son utilisateur Supabase Auth "synthétique"
--    créé lors de la première connexion WhatsApp.
alter table businesses
  add column if not exists auth_email text unique;

-- 3. S'assurer qu'un numéro de téléphone ne peut correspondre qu'à un seul
--    commerce (nécessaire pour que le lookup par phone soit fiable).
create unique index if not exists idx_businesses_phone_unique
  on businesses (phone)
  where phone is not null;

-- (Optionnel mais recommandé) nettoyage périodique des codes expirés,
-- via une Supabase Edge Function planifiée (cron) ou un job côté backend :
--
--   delete from whatsapp_otp_codes
--   where expires_at < now() - interval '1 day';
