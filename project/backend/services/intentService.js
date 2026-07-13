import { askGemini } from "./geminiService.js";

/**
 * Analyse un message libre (texte tapé ou transcription vocale) et tente d'y détecter
 * l'une des intentions supportées, avec les entités associées.
 *
 * Cette fonction est appelée à CHAQUE message qui ne ressemble pas à une réponse
 * strictement attendue par l'étape en cours (voir isStructuredReply dans
 * messageHandler.js) — y compris quand l'utilisateur se trouve déjà au milieu d'un
 * autre écran/flow. Le scénario classique (boutons/numéros) reste la référence tant
 * qu'on le suit ; l'IA ne prend le relais QUE lorsque la réponse s'en écarte — sur
 * TOUTES les rubriques de l'application.
 *
 * Intentions reconnues :
 * - NEW_SALE           : vendre un ou plusieurs produits
 * - ADD_STOCK          : ajouter/réapprovisionner un ou plusieurs produits (en bloc)
 * - EDIT_PRODUCT       : modifier le nom ou le prix d'un produit existant
 * - DELETE_PRODUCTS    : supprimer un ou plusieurs produits du stock
 * - LIST_INVENTORY     : afficher tout le stock/inventaire
 * - LOW_STOCK_ALERT    : afficher les produits presque épuisés
 * - DELETE_CUSTOMERS   : supprimer un ou plusieurs clients
 * - LIST_CUSTOMERS     : afficher la liste des clients
 * - CREATE_CUSTOMER    : ajouter un client (sans vente associée)
 * - EDIT_CUSTOMER      : modifier le nom ou le téléphone d'un client
 * - PAY_DEBT           : enregistrer un paiement sur la créance d'un client
 * - FORGIVE_DEBT       : effacer/annuler la créance d'un client
 * - LIST_DEBTS         : afficher les créances en cours
 * - LIST_INVOICES      : afficher les dernières factures
 * - DELETE_SALES       : supprimer/annuler une ou plusieurs ventes (par numéro de facture)
 * - CANCEL_LAST_SALE   : annuler la toute dernière vente enregistrée
 * - ANALYSIS_QUESTION  : poser une question ou demander une analyse sur l'activité
 * - SHOW_FINANCES      : afficher le chiffre d'affaires et le montant en caisse
 * - LIST_ACTIVITY_LOG  : afficher le journal d'activité (ventes, mouvements de stock)
 * - EDIT_PROFILE_NAME  : modifier le nom de l'utilisateur
 * - EDIT_BUSINESS      : modifier le nom, la ville ou le secteur de l'entreprise
 * - SWITCH_BUSINESS    : changer d'entreprise active (support multi-entreprises)
 * - ADD_BUSINESS       : ajouter une nouvelle entreprise
 * - LIST_BUSINESSES    : afficher la liste des entreprises de l'utilisateur
 * - HELP               : demande d'aide générale sur ce que l'application sait faire
 * - CHANGE_LANGUAGE    : changer la langue de l'application
 * - DELETE_ACCOUNT     : supprimer le compte (ne déclenche JAMAIS la suppression
 *                        directement — redirige systématiquement vers l'écran de
 *                        confirmation existant, qui reste seul maître de l'action)
 * - UNKNOWN            : aucune intention claire détectée
 *
 * Retourne null si l'appel IA échoue ou si la réponse est invalide (fallback silencieux
 * vers le flow scénarisé côté appelant — aucune action destructive ou d'écriture n'est
 * jamais prise directement ici, seulement une proposition à confirmer quand la sécurité
 * de l'action le justifie).
 */
export async function detectIntent(business, text, context = {}) {

    if (!text || text.trim().length < 3) {
        return null;
    }

    const { products = [], customers = [] } = context;

    const productNames = products.map(p => p.name).join(", ");
    const customerNames = customers.map(c => c.name).join(", ");

    const prompt = `Tu es un assistant qui analyse un message WhatsApp écrit ou dicté par un commerçant camerounais utilisant l'application "${business.name}".

Produits actuellement en stock : ${productNames || "(aucun)"}
Clients enregistrés : ${customerNames || "(aucun)"}

Détermine l'intention du message parmi :
- NEW_SALE : vendre un ou plusieurs produits (ex: "je veux vendre 5 sacs de riz", "riz et sucre, 3 et 4")
- ADD_STOCK : ajouter/réapprovisionner un ou plusieurs produits en stock (ex: "ajoute 10 riz à 500 et 20 sucre à 300 chacun")
- EDIT_PRODUCT : modifier le nom ou le prix d'un produit existant (ex: "modifie le prix du riz à 600", "renomme sucre en sucre blanc")
- DELETE_PRODUCTS : supprimer un ou plusieurs produits du stock (ex: "supprime riz et sucre")
- LIST_INVENTORY : voir/afficher tout le stock ou l'inventaire (ex: "donne-moi tout l'inventaire", "montre-moi mon stock")
- LOW_STOCK_ALERT : voir les produits presque épuisés (ex: "quels produits sont presque finis ?", "qu'est-ce qu'il faut réapprovisionner ?")
- DELETE_CUSTOMERS : supprimer un ou plusieurs clients (ex: "supprime le client Paul")
- LIST_CUSTOMERS : voir la liste des clients (ex: "montre mes clients", "quels sont mes clients ?")
- CREATE_CUSTOMER : ajouter un client sans vente associée (ex: "ajoute le client Paul", "enregistre Marie comme cliente, son numéro est...")
- EDIT_CUSTOMER : modifier le nom ou le téléphone d'un client existant (ex: "renomme le client Paul en Paul Nkeng", "change le numéro de Marie")
- PAY_DEBT : enregistrer un paiement reçu d'un client sur sa créance (ex: "Paul a payé 5000", "j'ai reçu 2000 de Marie pour sa dette")
- FORGIVE_DEBT : effacer/annuler complètement la créance d'un client, sans paiement (ex: "efface la dette de Paul", "annule la créance de Marie")
- LIST_DEBTS : voir les créances / qui doit de l'argent (ex: "montre les créances", "qui me doit de l'argent")
- LIST_INVOICES : voir les dernières factures (ex: "montre mes factures", "donne-moi mes dernières factures")
- DELETE_SALES : supprimer/annuler une ou plusieurs ventes en indiquant leur(s) numéro(s) de facture explicitement mentionné(s) (ex: "annule la facture INV-20260710-1234")
- CANCEL_LAST_SALE : annuler la toute dernière vente enregistrée, sans préciser de numéro (ex: "annule ma dernière vente", "j'ai fait une erreur sur la dernière vente")
- ANALYSIS_QUESTION : poser une question sur l'activité ou demander une analyse (ex: "fais-moi une analyse de mes ventes ce mois", "quel est mon produit le plus vendu ?")
- SHOW_FINANCES : voir le chiffre d'affaires et/ou le montant actuellement en caisse (ex: "quel est mon chiffre d'affaires ?", "combien j'ai en caisse ?", "combien j'ai gagné au total ?")
- LIST_ACTIVITY_LOG : voir le journal/historique d'activité (ex: "montre le journal d'activité", "montre l'historique des actions")
- EDIT_PROFILE_NAME : modifier le nom de l'utilisateur (ex: "change mon nom en Lyne")
- EDIT_BUSINESS : modifier le nom, la ville ou le secteur d'activité de l'entreprise (ex: "change le nom de mon entreprise en Yamo Shop", "ma ville c'est maintenant Yaoundé")
- SWITCH_BUSINESS : changer d'entreprise active, pour un utilisateur qui en a plusieurs (ex: "passe sur mon autre entreprise", "active la boutique de Douala")
- ADD_BUSINESS : ajouter une nouvelle entreprise (ex: "je veux ajouter une entreprise", "créer une nouvelle boutique")
- LIST_BUSINESSES : voir la liste des entreprises de l'utilisateur (ex: "montre mes entreprises")
- HELP : demande d'aide générale sur ce que l'application peut faire (ex: "que peux-tu faire ?", "aide", "comment ça marche ?")
- CHANGE_LANGUAGE : changer la langue de l'application (ex: "je veux que ce soit en français", "mets l'app en anglais", "parle-moi en espagnol", "switch to English")
- DELETE_ACCOUNT : demande de suppression du compte (ex: "supprime mon compte", "je veux fermer mon compte")
- UNKNOWN : aucune de ces intentions n'est claire (salutation, question hors sujet, message ambigu, ou réponse normale attendue par l'étape en cours comme un simple nom ou une simple valeur)

Réponds UNIQUEMENT avec un JSON strict, sans balises markdown, sans texte autour, selon l'intention détectée :

NEW_SALE : {"intent":"NEW_SALE","items":[{"product_query":"...","quantity":nombre}]}
ADD_STOCK : {"intent":"ADD_STOCK","items":[{"product_query":"...","quantity":nombre,"price":nombre_ou_null}]}
EDIT_PRODUCT : {"intent":"EDIT_PRODUCT","items":[{"product_query":"...","field":"name|price","value":"nouvelle_valeur_ou_null"}]}
DELETE_PRODUCTS : {"intent":"DELETE_PRODUCTS","items":[{"product_query":"..."}]}
LIST_INVENTORY : {"intent":"LIST_INVENTORY","items":[]}
LOW_STOCK_ALERT : {"intent":"LOW_STOCK_ALERT","items":[{"threshold":nombre_ou_null}]}
DELETE_CUSTOMERS : {"intent":"DELETE_CUSTOMERS","items":[{"customer_query":"..."}]}
LIST_CUSTOMERS : {"intent":"LIST_CUSTOMERS","items":[]}
CREATE_CUSTOMER : {"intent":"CREATE_CUSTOMER","items":[{"name":"...","phone":"numero_ou_null"}]}
EDIT_CUSTOMER : {"intent":"EDIT_CUSTOMER","items":[{"customer_query":"...","field":"name|phone","value":"..."}]}
PAY_DEBT : {"intent":"PAY_DEBT","items":[{"customer_query":"...","amount":nombre_ou_null}]}
FORGIVE_DEBT : {"intent":"FORGIVE_DEBT","items":[{"customer_query":"..."}]}
LIST_DEBTS : {"intent":"LIST_DEBTS","items":[]}
LIST_INVOICES : {"intent":"LIST_INVOICES","items":[]}
DELETE_SALES : {"intent":"DELETE_SALES","items":[{"invoice_number":"..."}]}
CANCEL_LAST_SALE : {"intent":"CANCEL_LAST_SALE","items":[]}
ANALYSIS_QUESTION : {"intent":"ANALYSIS_QUESTION","items":[{"question":"la question reformulée, ou vide si demande générique"}]}
SHOW_FINANCES : {"intent":"SHOW_FINANCES","items":[]}
LIST_ACTIVITY_LOG : {"intent":"LIST_ACTIVITY_LOG","items":[]}
EDIT_PROFILE_NAME : {"intent":"EDIT_PROFILE_NAME","items":[{"value":"nouveau_nom"}]}
EDIT_BUSINESS : {"intent":"EDIT_BUSINESS","items":[{"field":"name|city|sector","value":"nouvelle_valeur"}]}
SWITCH_BUSINESS : {"intent":"SWITCH_BUSINESS","items":[{"business_query":"..."}]}
ADD_BUSINESS : {"intent":"ADD_BUSINESS","items":[]}
LIST_BUSINESSES : {"intent":"LIST_BUSINESSES","items":[]}
HELP : {"intent":"HELP","items":[]}
CHANGE_LANGUAGE : {"intent":"CHANGE_LANGUAGE","items":[{"language":"..."}]}
DELETE_ACCOUNT : {"intent":"DELETE_ACCOUNT","items":[{}]}
UNKNOWN : {"intent":"UNKNOWN","items":[]}

Message à analyser : "${text}"

JSON :`;

    const raw = await askGemini(prompt, { temperature: 0 });

    if (!raw) {
        return null;
    }

    return parseIntentResponse(raw);
}

const VALID_INTENTS = [
    "NEW_SALE", "ADD_STOCK", "EDIT_PRODUCT", "DELETE_PRODUCTS", "LIST_INVENTORY",
    "LOW_STOCK_ALERT", "DELETE_CUSTOMERS", "LIST_CUSTOMERS", "CREATE_CUSTOMER",
    "EDIT_CUSTOMER", "PAY_DEBT", "FORGIVE_DEBT", "LIST_DEBTS", "LIST_INVOICES",
    "DELETE_SALES", "CANCEL_LAST_SALE", "ANALYSIS_QUESTION", "SHOW_FINANCES",
    "LIST_ACTIVITY_LOG", "EDIT_PROFILE_NAME", "EDIT_BUSINESS", "SWITCH_BUSINESS",
    "ADD_BUSINESS", "LIST_BUSINESSES", "HELP", "CHANGE_LANGUAGE", "DELETE_ACCOUNT",
    "UNKNOWN"
];

function parseIntentResponse(raw) {

    const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;

    try {
        parsed = JSON.parse(cleaned);
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== "object") {
        return null;
    }

    if (!VALID_INTENTS.includes(parsed.intent)) {
        return null;
    }

    if (!Array.isArray(parsed.items)) {
        parsed.items = [];
    }

    parsed.items = parsed.items.filter(Boolean);

    return parsed;
}
