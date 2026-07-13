# Connexion WhatsApp pour l'app web YamoBiz

## Architecture (mise à jour — découplée du bot)

- **Frontend web** → ne parle qu'à Supabase (Auth, DB, et maintenant Edge
  Functions). Aucun appel vers ton backend bot.
- **Backend bot Node.js** → continue de tourner exactement comme avant, ne
  parle qu'à Supabase (DB) pour ses propres besoins.
- **Les deux ne partagent que la base de données** (et implicitement, l'API
  Meta WhatsApp — mais chacun l'appelle indépendamment).

La logique OTP (générer le code, l'envoyer sur WhatsApp, le vérifier, créer
la session) vit dans **2 Supabase Edge Functions**, qui font partie de
Supabase — pas de ton serveur bot. Le frontend les appelle via
`supabase.functions.invoke(...)`, exactement comme il appelle déjà
`supabase.from(...)`.

## Le flow
1. L'utilisateur crée son compte sur le web (email + mot de passe + numéro
   WhatsApp) — c'est toujours le point d'entrée.
2. Plus tard, sur web ou WhatsApp, il peut se connecter avec ce numéro.
   `whatsapp-request-otp` cherche le business par téléphone, génère un code,
   l'envoie via l'API Meta.
3. `whatsapp-verify-otp` vérifie le code, retrouve le compte Supabase Auth
   déjà lié à ce business (créé à l'étape 1) et génère un lien magique pour
   ce même compte.
4. Le frontend échange ce lien contre une vraie session via
   `supabase.auth.verifyOtp(...)`.

Un numéro jamais inscrit ne peut pas se connecter par WhatsApp —
`Login.jsx` affiche un message avec un lien vers `/register`.

## Fichiers fournis
| Fichier | Où le mettre |
|---|---|
| `AuthContext.jsx` | Remplace `src/context/AuthContext.jsx` (app web) |
| `Login.jsx` | Remplace `src/pages/Login.jsx` (app web) |
| `Register.jsx` | Remplace `src/pages/Register.jsx` (app web) |
| `normalizePhone.js` | Nouveau fichier `src/lib/normalizePhone.js` (app web) |
| `migration_whatsapp_auth.sql` | À exécuter dans Supabase (SQL Editor) |
| `supabase/functions/_shared/cors.ts` | Dans le repo Supabase de ton projet (pas le frontend ni le bot) |
| `supabase/functions/whatsapp-request-otp/index.ts` | idem |
| `supabase/functions/whatsapp-verify-otp/index.ts` | idem |

Le dossier `supabase/functions` n'appartient ni à ton frontend Vite ni à ton
backend bot — c'est un 3e espace, géré par la CLI Supabase, qui vit à côté
(ou dans un repo dédié `supabase/`).

## Étapes de mise en route

1. **Migration SQL** — exécute `migration_whatsapp_auth.sql` dans le SQL
   Editor de Supabase (table `whatsapp_otp_codes` + `businesses.auth_email` +
   index unique sur `businesses.phone`).

2. **Installer la CLI Supabase** (si pas déjà fait) :
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref TON_PROJECT_REF
   ```

3. **Configurer les secrets des Edge Functions** (jamais dans le frontend) :
   ```bash
   supabase secrets set WHATSAPP_ACCESS_TOKEN=xxxx
   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=xxxx
   ```
   `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement
   par Supabase dans toutes les Edge Functions — rien à faire pour ceux-là.

4. **Déployer les 2 fonctions** :
   ```bash
   supabase functions deploy whatsapp-request-otp
   supabase functions deploy whatsapp-verify-otp
   ```

5. **App web** — remplace `AuthContext.jsx`, `Login.jsx`, `Register.jsx`,
   ajoute `src/lib/normalizePhone.js`. **Aucune variable d'environnement à
   ajouter** — le frontend continue d'utiliser uniquement
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` qu'il a déjà.

6. **Teste le flow** :
   - Un numéro déjà lié à un business (inscrit sur le web) reçoit le code et
     se connecte.
   - Un numéro inconnu voit le message "Créez votre compte pour l'activer"
     avec un lien vers `/register`.
   - "Renvoyer le code" est bloqué 60s.

## Ce qui n'est pas couvert (à voir ensuite si besoin)
- Vérification du numéro à l'inscription (pas bloquant — la vérification a
  lieu de toute façon au moment de la connexion WhatsApp).
- Rate limiting au niveau IP (seulement au niveau numéro pour l'instant).
- Restriction CORS des Edge Functions à ton seul domaine (actuellement `*`
  dans `_shared/cors.ts` — à resserrer si tu veux être strict).
