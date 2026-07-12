# YamoBiz v5

## Nouveautés de cette version

### 1. Journal d'activité (logger consultable)
Chaque vente et chaque mouvement de stock (ajout ou retrait, manuel ou via l'IA) est
désormais horodaté dans une nouvelle table `activity_logs`. Consultable via
**Mon entreprise → 📜 Journal d'activité**, ou en le demandant directement à l'IA
("montre le journal d'activité"), depuis n'importe où dans l'application.

Implémenté dans `services/loggerService.js` (`logEvent`, `getRecentActivityLogs`),
branché dans `saleHandler.js` (confirmation de vente) et `stockHandler.js` (ajout
manuel, retrait manuel, création de produit, ajout en bloc via IA).

### 2. Chiffre d'affaires (nouvelle sous-rubrique dans "Mon entreprise")
Cumul de toutes les ventes de l'entreprise depuis toujours (pas seulement le mois en
cours). Nouvelle fonction `getTotalRevenue()` dans `saleService.js`, accessible via
**Mon entreprise → 💰 Chiffre d'affaires**, ou par l'IA ("quel est mon chiffre
d'affaires ?").

### 3. Bouton omniprésent : "Choisir" au lieu de "Menu principal"
Le petit bouton qui suivait chaque réponse a été remplacé par le **même bouton
"Choisir"** que celui du menu principal : il ouvre directement la liste complète des
8 rubriques en un tap, depuis n'importe quel écran — pas juste un raccourci vers
l'accueil.

Techniquement : les lignes de cette liste "rapide" utilisent des ids préfixés `qm_`
(ex: `qm_3`) pour ne jamais être confondues avec un chiffre "3" attendu par un autre
écran (une quantité, un numéro de créance...). `messageHandler.js` reconnaît ce
préfixe et route directement vers l'option correspondante, sans repasser par l'écran
du menu. La liste des options est centralisée dans `utils/mainMenuItems.js`, partagée
entre `menuHandler.js` (menu principal) et `services/whatsapp.js` (bouton
omniprésent) pour rester toujours synchronisée.

### 4. Inscription sans secteur d'activité — logo à la place
Le flow d'inscription (et celui d'ajout d'une entreprise supplémentaire) demande
désormais : nom de la personne → nom de l'entreprise → ville → **logo** (facultatif,
on peut écrire "passer"). Le secteur d'activité n'est plus demandé à la création ; la
colonne `businesses.sector` reste en base et reste modifiable ensuite depuis
**Mon entreprise → Modifier le secteur**, pour qui veut le renseigner plus tard.

Migration nécessaire : `MIGRATION.sql` inclut `alter table businesses alter column
sector drop not null` pour garantir que la création avec `sector: null` ne casse pas
si la colonne était contrainte NOT NULL dans ton schéma actuel.

### 5. Facture : nouveau texte de remerciement
`pdfService.js` affiche désormais *"Merci d'avoir utilisé Yamobiz."* en bas de chaque
facture PDF (au lieu de "Merci pour votre confiance.").

## Migration à exécuter

`MIGRATION.sql` contient tout : la nouvelle table `activity_logs` (avec index sur
`business_id, created_at`), et le `drop not null` sur `businesses.sector`. Rien
d'autre n'est requis (aucune nouvelle variable d'environnement).

## Vérifications effectuées

- 39 fichiers passent `node --check` (syntaxe valide).
- 20 modules-clés ont été réellement chargés (`import`) avec leurs dépendances
  installées, pour confirmer l'absence d'export manquant ou de dépendance circulaire
  cassée (notamment `utils/mainMenuItems.js`, partagé entre `menuHandler.js` et
  `services/whatsapp.js`, un point de friction classique pour les imports circulaires
  — vérifié explicitement).

## À tester en conditions réelles

- Le bouton "Choisir" omniprésent envoie désormais un message-liste complet après
  chaque réponse : vérifie que le volume de messages supplémentaires reste acceptable
  pour tes utilisateurs (chaque échange en génère un de plus qu'avant).
- Le flow d'inscription sans secteur : confirme que `businesses.sector` accepte bien
  NULL après la migration avant de déployer, sinon la création de compte échouera.
- Le journal d'activité n'est pour l'instant alimenté que par les ventes et les
  mouvements de stock, comme demandé. Il serait facile d'étendre `logEvent(...)` à
  d'autres actions (suppressions, paiements de créance...) si tu veux un historique
  plus complet plus tard.
