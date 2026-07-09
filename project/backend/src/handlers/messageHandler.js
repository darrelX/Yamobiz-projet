import { getOrCreateUser } from "../services/userService.js";
import { getBusinessByUserId } from "../services/businessService.js";
import { getOrCreateConversation, resetToMenu } from "../services/conversationService.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { normalizePhone } from "../utils/format.js";
import { STEPS, REGISTRATION_STEPS, stepBelongsTo } from "../utils/steps.js";

import { handleRegistration } from "./registrationHandler.js";
import { showMainMenu, handleMenuSelection } from "./menuHandler.js";
import { handleSale } from "./saleHandler.js";
import { handleStock } from "./stockHandler.js";
import { handleDebt } from "./debtHandler.js";

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

    // 3 - vérifier si l'utilisateur possède déjà une entreprise
    const business = await getBusinessByUserId(user.id);

    // 4 - pas encore d'entreprise => flux d'inscription, quelle que soit l'étape
    if (!business) {
        return handleRegistration(phone, text, conversation, user);
    }

    // 5 - raccourci global : "menu" ramène toujours au menu principal
    if (text.toLowerCase() === "menu") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 6 - router selon l'étape courante de la conversation
    const step = conversation.step;

    if (step === STEPS.MENU) {
        return handleMenuSelection(phone, text, business);
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

    if (REGISTRATION_STEPS.includes(step)) {
        // Entreprise déjà créée mais conversation restée sur une étape
        // d'inscription (cas limite) : on la ramène au menu.
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    // 7 - filet de sécurité : étape inconnue
    await resetToMenu(phone);
    return showMainMenu(phone, business);
}
