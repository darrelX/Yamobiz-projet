# Ce qui a changé (v2)

## ⚠️ À faire avant de déployer
1. **Exécuter `MIGRATION.sql`** dans Supabase (ajoute `users.name`, `users.active_business_id`, `businesses.logo_path`, etc.)
2. **Ajouter dans `.env`** :
   ```
   GEMINI_API_KEY=votre_clé
   GEMINI_MODEL=gemini-2.0-flash   (optionnel)
   ```
   Clé obtenue sur https://aistudio.google.com/apikey — vérifie le nom du modèle sur https://ai.google.dev/gemini-api/docs/models si `gemini-2.0-flash` devient obsolète.
3. **Révoquer le token WhatsApp** qui était en clair dans `test.http` (rappel de la fois précédente), et régénérer un nouveau token.

## 1. Plusieurs entreprises par utilisateur
- Un même compte WhatsApp peut désormais posséder **plusieurs entreprises**.
- `users.active_business_id` retient l'entreprise actuellement "active" pour cet utilisateur — tout le bot (ventes, stock, etc.) agit sur cette entreprise-là.
- Depuis **🏢 Mon entreprise** :
  - ➕ Ajouter une entreprise (redemande nom / ville / secteur, l'active automatiquement)
  - 🔀 Changer d'entreprise active (visible seulement si vous en avez plusieurs)
  - 🗑️ Supprimer cette entreprise (visible seulement si vous en avez plusieurs — sinon redirigé vers "Mon compte")
- La suppression de compte (`accountHandler.js`) nettoie maintenant **toutes** les entreprises du user, pas seulement une.

## 2. Logo d'entreprise
- Nouvelle option **🖼️ Modifier le logo** dans le menu Entreprise : envoyez simplement une photo par WhatsApp.
- Le logo est téléchargé depuis l'API WhatsApp (`services/whatsapp.js` → `downloadWhatsAppMedia`) et stocké localement dans `storage/logos/{business_id}.{ext}` (chemin en base : `businesses.logo_path`).
- Le logo apparaît désormais **en haut à gauche** des factures PDF et des rapports d'analyse.
- Un petit badge **"⚡ Yamobiz"** est ajouté en bas de chaque PDF généré (facture et rapport), pour la marque de la plateforme elle-même.

## 3. Dates exactes à la seconde près
- Nouvelle fonction `formatDateTime()` dans `utils/format.js` (format `JJ/MM/AAAA HH:MM:SS`).
- Appliquée à : liste et détail des commandes, historique des ventes d'un produit, créances, factures PDF, rapports d'analyse.
- Les colonnes `created_at` en base sont déjà en `timestamptz` (précision native à la microseconde) — seul l'affichage a été enrichi.

## 4. Analyse financière par IA (Gemini, NL → SQL) + graphiques + rapport PDF complet
Le menu **📊 Analyse** propose désormais deux options :
- **📈 Résumé rapide** : l'ancien comportement (ventes du jour/semaine/mois, top produits, créances).
- **🤖 Poser une question** : analyse en langage naturel.

### Fonctionnement du pipeline (`services/analysisService.js`)
1. **Chargement sécurisé des données** (`analysisDataService.js`) : ventes, lignes de vente, produits, clients, créances des 12 derniers mois — **toujours filtrés côté serveur par `business_id`**, jamais laissé au choix de l'IA.
2. **Chargement en mémoire** de ces données dans des tables `alasql` (moteur SQL 100% JavaScript, aucune dépendance native).
3. **Gemini traduit la question en SQL** (dialecte proche SQLite), avec le schéma exact fourni dans le prompt.
4. **Validation stricte** du SQL généré (`sanitizeGeneratedSql`) : doit commencer par `SELECT`, aucun mot-clé de modification (`INSERT`/`UPDATE`/`DELETE`/`DROP`/...), une seule instruction.
5. **Exécution du SQL** — mais uniquement contre la copie en mémoire, jamais contre la vraie base Postgres. Même un SQL malveillant ne peut ni casser ni sortir du périmètre de cette entreprise.
6. **Gemini analyse le résultat** et rédige une synthèse en français + suggère un type de graphique pertinent (`bar`/`line`/`pie`/`doughnut`) avec les champs à utiliser.
7. **Génération du graphique** (`chartService.js`) via l'API publique QuickChart.io (pas de lib "canvas" native à compiler — évite les soucis d'installation déjà rencontrés).
8. **Génération du rapport PDF complet** (`reportService.js`) : question posée, analyse en français, graphique, tableau des données détaillées (40 lignes max affichées), et **la requête SQL utilisée** (transparence/traçabilité — utile aussi pour ton mémoire de fin d'études).
9. Réponse WhatsApp : le résumé en texte + le PDF complet en pièce jointe.

### Sécurité du design
Ce n'est **pas** du NL-to-SQL exécuté directement sur la base de production (ce qui serait dangereux, même avec des garde-fous). L'IA ne voit et ne peut interroger qu'une copie temporaire, en mémoire, des données déjà filtrées pour l'entreprise en cours — c'est un choix d'architecture assumé, à mentionner tel quel dans ton dossier de soutenance si besoin.

## Nouveaux fichiers
- `services/geminiService.js` — appel à l'API Gemini
- `services/analysisDataService.js` — chargement sécurisé des données par entreprise
- `services/analysisService.js` — pipeline NL → SQL → exécution → analyse
- `services/chartService.js` — génération d'image de graphique (QuickChart)
- `services/reportService.js` — génération du rapport PDF d'analyse
- `services/mediaService.js` — sauvegarde locale des logos uploadés
- `handlers/aiAnalysisHandler.js` — flow WhatsApp du menu Analyse (rapide + IA)

## Fichiers modifiés en profondeur
- `businessHandler.js` — entièrement réécrit (multi-entreprises, logo, ajout/suppression/switch)
- `accountHandler.js` — boucle sur toutes les entreprises lors de la suppression de compte
- `messageHandler.js` — routage multi-entreprises + transmission du message brut (upload logo) + route Analyse
- `menuHandler.js` — option 4 pointe vers le nouveau menu Analyse, option 7 passe `user`
- `registrationHandler.js` — évite de redemander le nom si déjà connu (cas ajout d'entreprise après suppression totale)
- `pdfService.js` — logo entreprise + badge Yamobiz sur la facture
- `orderHandler.js`, `stockHandler.js`, `debtHandler.js` — dates affichées à la seconde près
- `utils/format.js` — nouvelle fonction `formatDateTime`
- `utils/steps.js` — nouvelles étapes (multi-entreprises, logo, analyse IA)

## Limite connue / dépendances externes à surveiller
- **Coût Gemini** : chaque question IA fait 2 appels à l'API Gemini (SQL + analyse). Vérifie les tarifs/quotas selon ton volume d'utilisateurs.
- **QuickChart.io** : service tiers gratuit public, sans clé — en cas d'indisponibilité, le rapport est quand même généré sans graphique.
- Le nom du modèle Gemini (`GEMINI_MODEL`) est configurable via `.env` car les noms de modèles évoluent régulièrement chez Google.
