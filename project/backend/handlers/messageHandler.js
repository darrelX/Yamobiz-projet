import { getOrCreateUser, updateUser } from "../services/userService.js";
import { getBusinessesByUserId } from "../services/businessService.js";
import { getOrCreateConversation, resetToMenu } from "../services/conversationService.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { normalizePhone } from "../utils/format.js";
import { STEPS, REGISTRATION_STEPS, stepBelongsTo } from "../utils/steps.js";

import { handleRegistration } from "./registrationHandler.js";
import { showMainMenu, handleMenuSelection } from "./menuHandler.js";
import { handleSale } from "./saleHandler.js";
import { handleStock } from "./stockHandler.js";
import { handleDebt } from "./debtHandler.js";
import { handleOrder } from "./orderHandler.js";
import { handleProfile } from "./profileHandler.js";
import { handleBusiness } from "./businessHandler.js";
import { handleAccount } from "./accountHandler.js";
import { handleAnalysis } from "./aiAnalysisHandler.js";

export async function handleMessage(message) {

    const phone = normalizePhone(message.phone);

    if (!phone) {
        console.log("Numéro absent, message ignoré");
        return;
    }

    const text = (message.text || "").trim();

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
        return handleRegistration(phone, text, conversation, user);
    }

    // 5 - déterminer l'entreprise active (persistée sur users.active_business_id)
    let business = businesses.find(b => b.id === user.active_business_id);

    if (!business) {
        business = businesses[0];
        await updateUser(user.id, { active_business_id: business.id });
    }

    // 6 - raccourci global : "menu" ramène toujours au menu principal, à tout moment
    if (text.toLowerCase() === "menu") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 7 - router selon l'étape courante de la conversation
    const step = conversation.step;

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

    if (REGISTRATION_STEPS.includes(step)) {
        // Entreprise(s) déjà existante(s) mais conversation restée sur une étape
        // d'inscription (cas limite) : on la ramène au menu.
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 8 - filet de sécurité : étape inconnue
    await resetToMenu(phone);
    return showMainMenu(phone, business);
}
