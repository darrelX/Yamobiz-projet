# YamoBiz v3 — "IA partout" 🤖🎤

Ce paquet contient l'intégralité du projet (fichiers inchangés + nouveautés), prêt à remplacer
ton dossier actuel. Aucune migration SQL supplémentaire n'est nécessaire.

## Ce qui est nouveau

### 1. Vente intelligente (texte libre + multi-produits)
Écris ou dis simplement : *"je veux vendre 5 sacs de riz"* ou *"riz et sucre, 3 et 4"*.
L'IA (Gemini) extrait les produits et quantités, les fait correspondre à ton vrai stock,
vérifie la disponibilité, et affiche un récap que tu dois confirmer avant tout enregistrement.

### 2. Ajout de stock en bloc
*"ajoute 10 riz à 500 et 20 sucre à 300"* → réapprovisionne les produits existants et propose
de créer les nouveaux (si un prix est précisé), avec récap + confirmation avant écriture.

### 3. Suppression en bloc (produits, ventes, clients)
- *"supprime riz et sucre"* → produits
- *"supprime le client Paul"* → clients
- *"annule la commande INV-20260710-1234"* → ventes (par numéro de facture explicite,
  pour éviter toute ambiguïté sur une action irréversible)

Chaque suppression passe par un récap détaillé + confirmation oui/non. Pour les ventes
supprimées, le stock vendu est automatiquement réajusté (comme une annulation manuelle).

### 4. Vocal partout
N'importe quel message vocal WhatsApp est téléchargé, transcrit en texte par Gemini
(qui accepte l'audio nativement — pas besoin de service de transcription séparé), puis
traité exactement comme un message tapé : ça fonctionne pour confirmer une vente ("oui"),
choisir une option de menu, ou déclencher une intention IA (vente, stock, suppression).
L'utilisateur reçoit toujours un aperçu ("🎤 J'ai compris : ...") pour vérifier la
transcription avant que quoi que ce soit ne se passe.

### 5. Routage hybride à chaque message
Dans `menuHandler.js`, tout message qui ne correspond à aucun choix du menu (1-8) est
maintenant envoyé à `detectIntent()` (dans `intentService.js`) avant d'abandonner vers le
menu. C'est le cœur de la logique "convivialité totale" : le menu structuré et la
compréhension libre coexistent, sans jamais se marcher dessus.

## Fichiers à copier

Remplace entièrement ton dossier projet par celui-ci (mêmes chemins relatifs :
`config/`, `handlers/`, `parsers/`, `routes/`, `services/`, `utils/`).

## Points d'attention avant mise en prod

- **Coût/latence** : chaque message libre déclenche un appel Gemini (`detectIntent`).
  C'est voulu ("à chaque message, l'IA décide"), mais surveille ta consommation d'API
  si le volume grossit.
- **Fiabilité de l'extraction multi-produits** : teste en conditions réelles des phrases
  comme *"riz et sucre, 3 et 4"* — l'association nom↔quantité dans le bon ordre dépend
  de Gemini, qui s'en sort généralement bien mais mérite des tests avec du vrai monde.
- **DELETE_SALES** exige que l'utilisateur mentionne un vrai numéro de facture
  (ex: INV-20260710-1234). C'est un choix délibéré de sécurité : deviner "quelle
  commande" à partir d'une description floue serait trop risqué pour une action
  irréversible impliquant réajustement de stock et suppression de créances.
- **Format audio WhatsApp** : les notes vocales WhatsApp arrivent en général en
  `audio/ogg; codecs=opus`. Le code nettoie le paramètre `codecs` avant de l'envoyer à
  Gemini. Si tu rencontres des erreurs de transcription, vérifie le `mime_type` réellement
  renvoyé par l'API Meta dans tes logs.
- **Aucune nouvelle variable d'environnement** n'est requise : tout repose sur
  `GEMINI_API_KEY` déjà en place pour l'analyse financière.

## Prochaines pistes (non incluses ici)

- Anonymisation des noms de clients avant envoi à Gemini/QuickChart (protection PII).
- Étendre `detectIntent` à d'autres intentions (ex: consulter une créance, voir l'historique
  d'un produit) pour aller encore plus loin dans le "tout par le chat/vocal".
- Ajouter un bouton "🎤" explicite dans les menus pour rappeler aux utilisateurs que le
  vocal est disponible partout.
