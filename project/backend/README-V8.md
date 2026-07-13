# YamoBiz v8 — Traduction préchargée (FR/EN), sans IA

## Ce qui a changé par rapport à la version précédente

La version précédente traduisait chaque message à la volée via Gemini. **Ce chantier
la remplace entièrement** par un système de fichiers de langue préchargés,
statiques, sans aucun appel IA pour l'affichage de l'interface. C'est demandé
explicitement : "je ne veux pas de traduction par IA".

## Architecture

- **`locales/fr.js`** — fichier source de vérité, 304 clés, tout le texte de
  l'application en français.
- **`locales/en.js`** — même structure exacte (mêmes clés, mêmes variables
  `{comme_ceci}`), traduction anglaise.
- **`locales/index.js`** — registre des langues disponibles. Pour ajouter une
  langue plus tard : créer `locales/xx.js` (copier `en.js` comme modèle, traduire
  chaque valeur, garder les clés identiques), puis l'importer et l'ajouter au
  registre. Aucune autre modification de code n'est nécessaire ailleurs.
- **`utils/i18n.js`** — fonction `t(clé, variables)` : lit la langue courante
  (voir `utils/requestContext.js`, inchangé depuis la version précédente — toujours
  basé sur `AsyncLocalStorage` pour isoler correctement les utilisateurs traités en
  parallèle), cherche la clé, remplace les `{variables}`, et **replie automatiquement
  sur le français** si la clé n'existe pas dans la langue demandée (utile le temps
  qu'une nouvelle langue soit complètement traduite) ou si la langue elle-même
  n'est pas enregistrée dans `locales/index.js`.
- **`services/whatsapp.js`** redevient un simple transport (il ne traduit plus
  rien) : chaque handler appelle `t(...)` lui-même avant d'envoyer, avec le texte
  déjà dans la bonne langue.

## Couverture : "absolument tout"

- **Les 14 handlers** (vente, stock, créances, factures, profil, entreprise,
  compte, analyse, suppression en bloc, clients, inscription, menu, routeur
  central) — chaque message utilisateur passe par `t()`.
- **Les factures PDF** (`services/pdfService.js`) et **les rapports d'analyse PDF**
  (`services/reportService.js`) — tous les libellés (FACTURE/INVOICE, Client/Customer,
  colonnes du tableau, total...) sont traduits.
- **Les messages générés par les intentions IA** (`startXFromAi(...)` dans chaque
  handler) — même circuit `t()`, donc déjà couverts par construction.
- **Le résumé d'analyse en langage naturel** (`services/analysisService.js`) est un
  cas particulier assumé : c'est un texte **généré par l'IA à partir des données de
  vente**, différent à chaque question — impossible à précharger. On demande donc à
  Gemini de le rédiger directement dans la langue de l'utilisateur (pas une
  traduction a posteriori de l'interface, juste la langue de rédaction d'un contenu
  de toute façon généré à la volée). Tous les messages d'erreur autour de ce
  pipeline (IA injoignable, requête invalide...) sont eux bien préchargés via `t()`.

## Sélection de la langue — désormais par boutons, pas texte libre

Comme seules deux langues sont préchargées pour l'instant, le choix se fait par
boutons WhatsApp ("🇫🇷 Français" / "🇬🇧 English") plutôt que par texte libre à
interpréter :
1. **À l'inscription**, en toute première question.
2. **Depuis "Mon compte" → 🌍 Changer de langue**.
3. **Par l'IA** ("mets l'app en anglais") — l'intention `CHANGE_LANGUAGE` reste
   disponible depuis n'importe où ; elle normalise ce que l'utilisateur a écrit
   (reconnaît "fran...", "english"/"anglais"...) vers un code `fr`/`en`.

## Vérifications effectuées

- **304 clés** utilisées dans le code, vérifiées automatiquement présentes dans
  `fr.js` ET `en.js` (script de contrôle dédié).
- **Structure identique** entre `fr.js` et `en.js` confirmée automatiquement (mêmes
  clés de part et d'autre, aucun oubli dans un sens ou l'autre).
- **Cohérence des variables** `{comme_ceci}` vérifiée automatiquement : chaque clé a
  exactement le même jeu de variables en français et en anglais.
- **Recherche exhaustive** de texte français resté en dur hors du système `t()` :
  un seul résidu identifié et volontairement conservé (message d'erreur avant même
  que l'utilisateur soit connu en base — cas limite qui ne peut pas être traduit
  puisqu'on ne sait pas encore dans quelle langue).
- **46 fichiers** passent `node --check`.
- **32 modules-clés rechargés réellement** avec leurs dépendances : aucune erreur
  d'export manquant.
- **Test fonctionnel réel** de `t()` : rendu correct en FR et EN avec substitution
  de variables, repli propre sur la clé elle-même si une clé est introuvable (avec
  avertissement en log, sans jamais planter), et repli sur le français si la langue
  demandée n'est pas encore enregistrée dans `locales/index.js`.

## Limite connue

Les commandes déterministes du panier de vente ("modifier N", "supprimer N",
"ajouter", "client X") reconnaissent maintenant le français ET l'anglais
("edit N", "delete N", "add", "customer X") — corrigé dans ce chantier pour rester
cohérent avec le reste de l'application désormais bilingue.
