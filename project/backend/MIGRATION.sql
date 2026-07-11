-- ============================================================
-- Migration nécessaire pour les fonctionnalités Yamobiz (v2)
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================

-- 1) Identification enrichie : nom de l'utilisateur + horodatage
alter table users
    add column if not exists name text;

alter table users
    add column if not exists updated_at timestamptz default now();

-- 2) Multi-entreprises : l'entreprise "active" d'un utilisateur
alter table users
    add column if not exists active_business_id uuid references businesses(id) on delete set null;

-- 3) Logo d'entreprise (chemin local du fichier stocké sur le serveur)
alter table businesses
    add column if not exists logo_path text;

alter table businesses
    add column if not exists updated_at timestamptz default now();

-- 4) S'assurer que products.updated_at existe (utilisé par updateProduct/adjustStock)
alter table products
    add column if not exists updated_at timestamptz default now();

-- 5) (Recommandé) S'assurer que les timestamps par défaut existent partout,
--    avec précision à la seconde (timestamptz gère nativement la précision
--    microseconde — aucune perte de précision côté base de données ; seul
--    l'affichage a été mis à jour côté code pour montrer heure:minute:seconde).
alter table debts        add column if not exists updated_at timestamptz default now();
alter table conversations add column if not exists updated_at timestamptz default now();

-- ============================================================
-- Note sur la suppression (compte ou entreprise individuelle) :
-- Le code supprime manuellement, dans l'ordre, les créances, factures,
-- ventes (+ lignes), produits et clients d'une entreprise avant de
-- supprimer l'entreprise elle-même. Cela fonctionne même sans
-- contraintes ON DELETE CASCADE en base.
-- ============================================================

-- ============================================================
-- Variables d'environnement à ajouter dans .env :
--
-- GEMINI_API_KEY=votre_clé_api_gemini   (obtenue sur https://aistudio.google.com/apikey)
-- GEMINI_MODEL=gemini-2.0-flash          (optionnel, valeur par défaut)
--
-- Aucune clé QuickChart n'est nécessaire (endpoint public gratuit,
-- suffisant pour un usage de ce volume).
-- ============================================================
