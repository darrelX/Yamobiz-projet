-- ============================================================
-- Migration Yamobiz (v2) — inchangée pour la v3 "IA partout"
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================

alter table users
    add column if not exists name text;

alter table users
    add column if not exists updated_at timestamptz default now();

alter table users
    add column if not exists active_business_id uuid references businesses(id) on delete set null;

-- Langue préférée de l'utilisateur ("fr" par défaut). Code correspondant à une clé
-- du registre locales/index.js — actuellement "fr" ou "en". Ajouter une langue :
-- voir locales/index.js (aucune migration de schéma supplémentaire nécessaire,
-- cette colonne accepte n'importe quel code texte).
alter table users
    add column if not exists language text default 'fr';

alter table businesses
    add column if not exists logo_path text;

alter table businesses
    add column if not exists updated_at timestamptz default now();

alter table products
    add column if not exists updated_at timestamptz default now();

alter table debts        add column if not exists updated_at timestamptz default now();
alter table conversations add column if not exists updated_at timestamptz default now();

-- ============================================================
-- v5 : Journal d'activité, chiffre d'affaires, inscription sans secteur
-- ============================================================

-- Le secteur d'activité n'est plus demandé à la création d'une entreprise
-- (remplacé par le logo). La colonne reste disponible pour une modification
-- ultérieure depuis le menu "Mon entreprise" ; on s'assure juste qu'elle
-- accepte désormais les valeurs vides (sans effet si elle l'était déjà).
alter table businesses
    alter column sector drop not null;

-- Journal d'activité : ventes, ajouts et retraits de stock, horodatés.
create table if not exists activity_logs (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references businesses(id) on delete cascade,
    type text not null,
    message text not null,
    created_at timestamptz default now()
);

create index if not exists idx_activity_logs_business_id
    on activity_logs (business_id, created_at desc);

-- ============================================================
-- v3 "IA partout" (vente/stock/suppression en langage naturel + vocal) :
-- AUCUNE migration de schéma supplémentaire n'est nécessaire.
-- Toutes les nouvelles fonctionnalités réutilisent les tables et colonnes
-- existantes (products, customers, sales, sale_items, debts).
-- ============================================================

-- ============================================================
-- Variables d'environnement à ajouter dans .env :
--
-- GEMINI_API_KEY=votre_clé_api_gemini   (obtenue sur https://aistudio.google.com/apikey)
-- GEMINI_MODEL=gemini-2.0-flash          (optionnel, valeur par défaut)
--
-- Aucune clé QuickChart n'est nécessaire (endpoint public gratuit).
-- Aucun service de transcription séparé n'est nécessaire : Gemini accepte
-- l'audio nativement (utilisé pour transcrire les messages vocaux WhatsApp).
-- ============================================================

-- ============================================================
-- Note sur la suppression (compte, entreprise, ou suppression en bloc IA) :
-- Le code supprime manuellement, dans l'ordre, les créances, factures,
-- ventes (+ lignes), produits et clients concernés avant de supprimer
-- l'entité elle-même. Cela fonctionne même sans contraintes
-- ON DELETE CASCADE en base.
-- ============================================================
