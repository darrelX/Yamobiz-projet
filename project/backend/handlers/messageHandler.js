import { getOrCreateUser, updateUser } from "../services/userService.js";
import { getBusinessesByUserId } from "../services/businessService.js";
import { getProductsByBusiness } from "../services/productService.js";
import { getCustomersByBusiness } from "../services/customerService.js";
import { getOrCreateConversation, resetToMenu } from "../services/conversationService.js";
import { sendWhatsAppMessage, downloadWhatsAppMedia, QUICK_MENU_PREFIX } from "../services/whatsapp.js";
import { transcribeAudio } from "../services/geminiService.js";
import { detectIntent } from "../services/intentService.js";
import { normalizePhone } from "../utils/format.js";
import { STEPS, REGISTRATION_STEPS, stepBelongsTo } from "../utils/steps.js";

import { handleRegistration } from "./registrationHandler.js";
import { showMainMenu, handleMenuSelection, dispatchIntent } from "./menuHandler.js";
import { handleSale } from "./saleHandler.js";
import { handleStock } from "./stockHandler.js";
import { handleDebt } from "./debtHandler.js";
import { handleOrder } from "./orderHandler.js";
import { handleProfile } from "./profileHandler.js";
import { handleBusiness } from "./businessHandler.js";
import { handleAccount } from "./accountHandler.js";
import { handleAnalysis } from "./aiAnalysisHandler.js";
import { handleBulkDelete } from "./bulkDeleteHandler.js";

// Mots/phrases qui ramènent explicitement au menu principal (ou annulent l'étape en
// cours), depuis n'importe où dans l'application — reconnus AVANT toute autre logique,
// donc toujours prioritaires, y compris pendant un ajout de produit ou une saisie en cours.
const MENU_KEYWORDS = new Set([
    "menu", "menu principal", "accueil", "retour au menu", "revenir au menu",
    "annule", "annuler", "stop"
]);

// Étapes de confirmation d'une action potentiellement irréversible ou déjà engagée :
// on n'y intercepte JAMAIS avec une nouvelle intention IA, pour garder ces
// confirmations parfaitement déterministes. Le mot-clé "menu"/"annuler" reste
// cependant toujours actif pour en sortir (voir MENU_KEYWORDS ci-dessus).
const CONFIRM_STEPS = new Set([
    STEPS.SALE_CONFIRM,
    STEPS.SALE_AI_REVIEW,
    STEPS.SALE_ADD_MORE,
    STEPS.STOCK_DELETE_CONFIRM,
    STEPS.STOCK_ADD_BULK_REVIEW,
    STEPS.ACCOUNT_DELETE_CONFIRM,
    STEPS.COMPANY_DELETE_CONFIRM,
    STEPS.ORDER_CANCEL_CONFIRM,
    STEPS.BULK_DELETE_REVIEW
]);

// Identifiants de boutons/listes générés par l'app elle-même : toujours traités par
// le flow scénarisé correspondant, jamais réinterprétés par l'IA.
const KNOWN_BUTTON_IDS = new Set([
    "menu", "confirm_delete", "account_delete", "profile_edit_name",
    "edit_name", "edit_price", "add_stock", "remove_stock", "history",
    "delete", "back", "analysis_quick", "analysis_ai", "confirm_yes", "confirm_no"
]);

/**
 * Détermine si `text` ressemble à une réponse STRICTEMENT attendue par l'étape
 * en cours (un numéro, un oui/non, un identifiant de bouton connu...). Si c'est
 * le cas, on laisse le flow scénarisé s'en occuper normalement, sans passer par
 * l'IA (plus rapide, moins cher, et sans risque de mauvaise interprétation d'une
 * simple quantité ou d'un simple nom de produit).
 *
 * Si ce n'est PAS le cas, le message est un texte libre — c'est le signal qu'on
 * doit tenter l'interception IA universelle avant de retomber sur le comportement
 * par défaut de l'étape (voir handleMessage plus bas).
 */
function isStructuredReply(step, text) {

    if (CONFIRM_STEPS.has(step)) {
        return true;
    }

    const t = (text || "").trim().toLowerCase();

    if (!t || t.length < 3) return true;
    if (/^\d+([.,]\d+)?$/.test(t)) return true;
    if (["oui", "o", "yes", "y", "non", "n", "no"].includes(t)) return true;
    if (KNOWN_BUTTON_IDS.has(t)) return true;

    return false;
}

export async function handleMessage(message) {

    const phone = normalizePhone(message.phone);

    if (!phone) {
        console.log("Numéro absent, message ignoré");
        return;
    }

    let text = (message.text || "").trim();

    // 0 - message vocal : transcrit par Gemini (qui accepte l'audio nativement), puis
    // traité EXACTEMENT comme un message texte classique — menu, confirmations,
    // saisies, et interception IA universelle fonctionnent donc aussi à la voix,
    // sans logique dupliquée.
    if (message.type === "audio" && message.raw?.audio?.id) {

        const media = await downloadWhatsAppMedia(message.raw.audio.id);

        if (!media) {
            return sendWhatsAppMessage(
                phone,
                "❌ Je n'ai pas pu récupérer votre message vocal. Réessayez, ou écrivez votre demande."
            );
        }

        const transcription = await transcribeAudio(media.buffer, media.mimeType || "audio/ogg");

        if (!transcription) {
            return sendWhatsAppMessage(
                phone,
                "❌ Je n'ai pas réussi à comprendre votre message vocal. Réessayez, ou écrivez votre demande."
            );
        }

        await sendWhatsAppMessage(phone, `🎤 J'ai compris : "${transcription}"`, { skipMenuFooter: true });

        text = transcription.trim();
    }

    // 1 - récupérer ou créer l'utilisateur
    const user = await getOrCreateUser(phone);

    if (!user) {
        return sendWhatsAppMessage(phone, "❌ Impossible de créer votre compte. Réessayez plus tard.");
    }

    // 2 - récupérer ou créer la conversation
    const conversation = await getOrCreateConversation(phone);

    if (!conversation) {
        return sendWhatsAppMessage(phone, "❌ Une erreur est survenue. Réessayez plus tard.");
    }

    // 3 - récupérer TOUTES les entreprises de l'utilisateur (support multi-entreprises)
    const businesses = await getBusinessesByUserId(user.id);

    // 4 - aucune entreprise => flux d'inscription, quelle que soit l'étape
    if (!businesses.length) {
        return handleRegistration(phone, text, conversation, user, message);
    }

    // 5 - déterminer l'entreprise active (persistée sur users.active_business_id)
    let business = businesses.find(b => b.id === user.active_business_id);

    if (!business) {
        business = businesses[0];
        await updateUser(user.id, { active_business_id: business.id });
    }

    const step = conversation.step;

    // 6 - raccourci global : mots-clés de retour/annulation, à tout moment, quelle
    // que soit l'étape (y compris pour annuler un ajout de produit en cours, etc.)
    const normalizedText = text.toLowerCase().trim().replace(/[.!?]+$/, "");

    if (MENU_KEYWORDS.has(normalizedText)) {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 6bis - le bouton "Choisir" omniprésent envoie un id "qm_X" (X = 1 à 8) : on
    // route directement vers l'option correspondante du menu principal, quelle que
    // soit l'étape en cours — c'est un accès direct, pas une simple demande de
    // retour au menu.
    const quickMenuMatch = normalizedText.match(/^qm_([1-8])$/);

    if (quickMenuMatch) {
        await resetToMenu(phone);
        return handleMenuSelection(phone, quickMenuMatch[1], business, user);
    }

    // 7 - interception IA universelle : si le message ne ressemble pas à une réponse
    // structurée attendue par l'étape courante, on tente d'abord de comprendre une
    // intention globale (vente, stock, créances, analyse, profil, entreprise,
    // compte...) avant de retomber sur le flow scénarisé en cours. Le scénario
    // classique (boutons/numéros) reste la référence tant qu'on le suit ; l'IA ne
    // prend le relais QUE lorsque la réponse s'en écarte.
    if (step !== STEPS.MENU && !isStructuredReply(step, text)) {

        const [products, customers] = await Promise.all([
            getProductsByBusiness(business.id),
            getCustomersByBusiness(business.id)
        ]);

        const intentResult = await detectIntent(business, text, { products, customers });

        if (intentResult && intentResult.intent !== "UNKNOWN") {
            const handled = await dispatchIntent(phone, business, user, intentResult, { products, customers });
            if (handled) {
                return;
            }
        }
        // Sinon (UNKNOWN, ou IA indisponible) : on continue normalement ci-dessous —
        // le texte est alors traité comme une réponse légitime à l'étape en cours
        // (ex: un nom de produit, un nom de client...).
    }

    // 8 - router selon l'étape courante de la conversation
    if (step === STEPS.MENU) {
        return handleMenuSelection(phone, text, business, user);
    }

    if (stepBelongsTo(step, "SALE_")) {
        return handleSale(phone, text, conversation, business);
    }

    if (stepBelongsTo(step, "STOCK_")) {
        return handleStock(phone, text, conversation, business);
    }

    if (stepBelongsTo(step, "DEBT_")) {
        return handleDebt(phone, text, conversation, business);
    }

    if (stepBelongsTo(step, "ORDER_")) {
        return handleOrder(phone, text, conversation, business);
    }

    if (stepBelongsTo(step, "PROFILE_")) {
        return handleProfile(phone, text, conversation, business, user);
    }

    if (stepBelongsTo(step, "COMPANY_")) {
        // "message" (objet brut) est transmis pour gérer l'upload du logo (image WhatsApp)
        return handleBusiness(phone, text, conversation, business, user, message);
    }

    if (stepBelongsTo(step, "ACCOUNT_")) {
        return handleAccount(phone, text, conversation, business, user);
    }

    if (stepBelongsTo(step, "ANALYSIS_")) {
        return handleAnalysis(phone, text, conversation, business);
    }

    if (stepBelongsTo(step, "BULK_")) {
        return handleBulkDelete(phone, text, conversation, business);
    }

    if (REGISTRATION_STEPS.includes(step)) {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 9 - filet de sécurité : étape inconnue
    await resetToMenu(phone);
    return showMainMenu(phone, business);
}
