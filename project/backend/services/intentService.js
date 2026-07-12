import { askGemini } from "./geminiService.js";

/**
 * Analyse un message libre (texte tapé ou transcription vocale) et tente d'y détecter
 * l'une des intentions supportées, avec les entités associées.
 *
 * Cette fonction est appelée à CHAQUE message qui ne ressemble pas à une réponse
 * strictement attendue par l'étape en cours (voir isStructuredReply dans
 * messageHandler.js) — y compris quand l'utilisateur se trouve déjà au milieu d'un
 * autre écran/flow. C'est ce qui permet l'interception universelle : le scénario
 * classique (boutons/numéros) reste la référence tant qu'on le suit, mais dès que
 * la réponse ne correspond pas à ce qui est attendu, l'IA prend le relais — sur
 * TOUTES les rubriques de l'application (vente, stock, créances, commandes/factures,
 * analyse, profil, entreprise, compte).
 *
 * Intentions reconnues :
 * - NEW_SALE           : vendre un ou plusieurs produits
 * - ADD_STOCK          : ajouter/réapprovisionner un ou plusieurs produits (en bloc)
 * - EDIT_PRODUCT       : modifier le nom ou le prix d'un produit existant
 * - DELETE_PRODUCTS    : supprimer un ou plusieurs produits du stock
 * - LIST_INVENTORY     : afficher tout le stock/inventaire
 * - DELETE_CUSTOMERS   : supprimer un ou plusieurs clients
 * - PAY_DEBT           : enregistrer un paiement sur la créance d'un client
 * - LIST_DEBTS         : afficher les créances en cours
 * - LIST_ORDERS        : afficher les dernières commandes/factures
 * - DELETE_SALES       : supprimer/annuler une ou plusieurs ventes (par numéro de facture)
 * - ANALYSIS_QUESTION  : poser une question ou demander une analyse sur l'activité
 * - EDIT_PROFILE_NAME  : modifier le nom de l'utilisateur
 * - EDIT_BUSINESS      : modifier le nom, la ville ou le secteur de l'entreprise
 * - DELETE_ACCOUNT     : supprimer le compte (ne déclenche JAMAIS la suppression
 *                        directement — redirige systématiquement vers l'écran de
 *                        confirmation existant, qui reste seul maître de l'action)
 * - UNKNOWN            : aucune intention claire détectée
 *
 * Retourne null si l'appel IA échoue ou si la réponse est invalide (fallback silencieux
 * vers le flow scénarisé côté appelant — aucune action destructive ou d'écriture n'est
 * jamais prise directement ici, seulement une proposition à confirmer).
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
- ADD_STOCK : ajouter/réapprovisionner un ou plusieurs produits en stock, éventuellement plusieurs à la fois (ex: "ajoute 10 riz à 500 et 20 sucre à 300 chacun")
- EDIT_PRODUCT : modifier le nom ou le prix d'un produit existant (ex: "modifie le prix du riz à 600", "renomme sucre en sucre blanc")
- DELETE_PRODUCTS : supprimer un ou plusieurs produits du stock (ex: "supprime riz et sucre")
- LIST_INVENTORY : voir/afficher tout le stock ou l'inventaire (ex: "donne-moi tout l'inventaire", "montre-moi mon stock")
- DELETE_CUSTOMERS : supprimer un ou plusieurs clients (ex: "supprime le client Paul")
- PAY_DEBT : enregistrer un paiement reçu d'un client sur sa créance (ex: "Paul a payé 5000", "j'ai reçu 2000 de Marie pour sa dette")
- LIST_DEBTS : voir les créances / qui doit de l'argent (ex: "montre les créances", "qui me doit de l'argent")
- LIST_ORDERS : voir les dernières commandes ou factures (ex: "montre mes commandes", "donne-moi mes dernières factures")
- DELETE_SALES : supprimer/annuler une ou plusieurs ventes en indiquant leur(s) numéro(s) de facture explicitement mentionné(s) dans le message (ex: "annule la commande INV-20260710-1234")
- ANALYSIS_QUESTION : poser une question sur l'activité ou demander une analyse (ex: "fais-moi une analyse de mes ventes ce mois", "quel est mon produit le plus vendu ?", "comment se porte mon business ?")
- EDIT_PROFILE_NAME : modifier le nom de l'utilisateur (ex: "change mon nom en Lyne", "je m'appelle désormais Paul")
- EDIT_BUSINESS : modifier le nom, la ville ou le secteur d'activité de l'entreprise (ex: "change le nom de mon entreprise en Yamo Shop", "ma ville c'est maintenant Yaoundé")
- DELETE_ACCOUNT : demande de suppression du compte (ex: "supprime mon compte", "je veux fermer mon compte")
- UNKNOWN : aucune de ces intentions n'est claire (salutation, question hors sujet, message ambigu, ou réponse normale attendue par l'étape en cours comme un simple nom ou une simple valeur)

Réponds UNIQUEMENT avec un JSON strict, sans balises markdown, sans texte autour, selon l'intention détectée :

NEW_SALE : {"intent":"NEW_SALE","items":[{"product_query":"...","quantity":nombre}]}
ADD_STOCK : {"intent":"ADD_STOCK","items":[{"product_query":"...","quantity":nombre,"price":nombre_ou_null}]}
EDIT_PRODUCT : {"intent":"EDIT_PRODUCT","items":[{"product_query":"...","field":"name|price","value":"nouvelle_valeur_ou_null"}]}
DELETE_PRODUCTS : {"intent":"DELETE_PRODUCTS","items":[{"product_query":"..."}]}
LIST_INVENTORY : {"intent":"LIST_INVENTORY","items":[]}
DELETE_CUSTOMERS : {"intent":"DELETE_CUSTOMERS","items":[{"customer_query":"..."}]}
PAY_DEBT : {"intent":"PAY_DEBT","items":[{"customer_query":"...","amount":nombre_ou_null}]}
LIST_DEBTS : {"intent":"LIST_DEBTS","items":[]}
LIST_ORDERS : {"intent":"LIST_ORDERS","items":[]}
DELETE_SALES : {"intent":"DELETE_SALES","items":[{"invoice_number":"..."}]}
ANALYSIS_QUESTION : {"intent":"ANALYSIS_QUESTION","items":[{"question":"la question reformulée, ou vide si demande générique"}]}
EDIT_PROFILE_NAME : {"intent":"EDIT_PROFILE_NAME","items":[{"value":"nouveau_nom"}]}
EDIT_BUSINESS : {"intent":"EDIT_BUSINESS","items":[{"field":"name|city|sector","value":"nouvelle_valeur"}]}
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

    const validIntents = [
        "NEW_SALE", "ADD_STOCK", "EDIT_PRODUCT", "DELETE_PRODUCTS", "LIST_INVENTORY",
        "DELETE_CUSTOMERS", "PAY_DEBT", "LIST_DEBTS", "LIST_ORDERS", "DELETE_SALES",
        "ANALYSIS_QUESTION", "EDIT_PROFILE_NAME", "EDIT_BUSINESS", "DELETE_ACCOUNT",
        "UNKNOWN"
    ];

    if (!validIntents.includes(parsed.intent)) {
        return null;
    }

    if (!Array.isArray(parsed.items)) {
        parsed.items = [];
    }

    parsed.items = parsed.items.filter(Boolean);

    return parsed;
}
