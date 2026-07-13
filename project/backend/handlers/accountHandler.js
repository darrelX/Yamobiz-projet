import { sendWhatsAppMessage, sendWhatsAppButtons } from "../services/whatsapp.js";
import { updateConversation, resetToMenu, deleteConversation } from "../services/conversationService.js";
import { deleteUser, updateUser } from "../services/userService.js";
import { deleteBusiness, getBusinessesByUserId } from "../services/businessService.js";
import { deleteProductsByBusiness } from "../services/productService.js";
import { deleteSalesByBusiness } from "../services/saleService.js";
import { deleteDebtsByBusiness } from "../services/debtService.js";
import { deleteCustomersByBusiness } from "../services/customerService.js";
import { deleteInvoicesByBusiness } from "../services/invoiceService.js";
import { normalizeLanguageInput } from "../utils/language.js";
import { setCurrentLanguage } from "../utils/requestContext.js";
import { t } from "../utils/i18n.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

function bizWarning(count) {
    return count > 1 ? t("account.bizWarningMultiple", { count }) : t("account.bizWarningSingle");
}

/**
 * Point d'entrée "supprimer mon compte" détecté par l'IA depuis n'importe quelle
 * rubrique. Contrairement aux autres actions IA, celle-ci ne s'applique JAMAIS
 * directement, même si la formulation semble catégorique : on redirige toujours
 * vers l'écran de confirmation existant, qui reste seul maître d'une action aussi
 * définitive (compte + toutes les entreprises + tout l'historique).
 */
export async function startAccountDeleteFromAi(phone, business, user) {

    await updateConversation(phone, STEPS.ACCOUNT_DELETE_CONFIRM, {});

    const businesses = await getBusinessesByUserId(user.id);

    return sendWhatsAppButtons(
        phone,
        t("account.deleteRequestWarning", { bizWarning: bizWarning(businesses.length) }),
        [
            { id: "confirm_delete", title: t("common.yesDeleteButton") },
            { id: "menu", title: t("common.cancelButton") }
        ]
    );
}

/**
 * Point d'entrée "change la langue en X" détecté par l'IA depuis n'importe quelle
 * rubrique (ex: "je veux que ce soit en anglais"). Applique directement — changer
 * une préférence d'affichage n'est pas une action sensible, comme les autres
 * changements de préférence (nom, ville...) qui ne demandent déjà pas de confirmation.
 */
export async function changeLanguageFromAi(phone, business, user, languageRaw) {

    if (!languageRaw || !String(languageRaw).trim()) {
        await updateConversation(phone, STEPS.ACCOUNT_LANGUAGE, {});
        return sendWhatsAppMessage(phone, t("account.languagePromptShort"));
    }

    const language = normalizeLanguageInput(String(languageRaw));

    await updateUser(user.id, { language });
    setCurrentLanguage(language);

    await sendWhatsAppMessage(phone, t("account.languageUpdated"));

    return showMainMenu(phone, business);
}

export async function showAccountMenu(phone, business, user) {

    await updateConversation(phone, STEPS.ACCOUNT_MENU, {});

    const businesses = await getBusinessesByUserId(user.id);

    return sendWhatsAppButtons(
        phone,
        t("account.menuBody", { phone: user.phone, bizWarning: bizWarning(businesses.length) }),
        [
            { id: "account_language", title: t("account.languageButton") },
            { id: "account_delete", title: t("account.deleteButton") },
            { id: "menu", title: t("common.backButton") }
        ]
    );
}

export async function handleAccount(phone, text, conversation, business, user) {

    switch (conversation.step) {

        case STEPS.ACCOUNT_MENU:
            return handleAccountMenuChoice(phone, text, business, user);

        case STEPS.ACCOUNT_DELETE_CONFIRM:
            return handleAccountDeleteConfirm(phone, text, business, user);

        case STEPS.ACCOUNT_LANGUAGE:
            return handleAccountLanguage(phone, text, business, user);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleAccountMenuChoice(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice === "account_delete") {

        await updateConversation(phone, STEPS.ACCOUNT_DELETE_CONFIRM, {});

        return sendWhatsAppButtons(
            phone,
            t("account.deleteConfirmQuestion"),
            [
                { id: "confirm_delete", title: t("common.yesDeleteButton") },
                { id: "menu", title: t("common.cancelButton") }
            ]
        );
    }

    if (choice === "account_language") {

        await updateConversation(phone, STEPS.ACCOUNT_LANGUAGE, {});

        return sendWhatsAppMessage(phone, t("account.languagePrompt"));
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleAccountLanguage(phone, text, business, user) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("account.languageRequired"));
    }

    const language = normalizeLanguageInput(text);

    await updateUser(user.id, { language });

    // Effet immédiat sur CETTE réponse : le message de confirmation ci-dessous
    // (et tout ce qui suit) est déjà envoyé dans la nouvelle langue.
    setCurrentLanguage(language);

    await resetToMenu(phone);

    await sendWhatsAppMessage(phone, t("account.languageUpdated"));

    return showMainMenu(phone, business);
}

async function handleAccountDeleteConfirm(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice !== "confirm_delete" && !["oui", "o", "yes", "1"].includes(choice)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("account.deleteCancelled"));
        return showMainMenu(phone, business);
    }

    const businesses = await getBusinessesByUserId(user.id);

    for (const biz of businesses) {
        await deleteDebtsByBusiness(biz.id);
        await deleteInvoicesByBusiness(biz.id);
        await deleteSalesByBusiness(biz.id);
        await deleteProductsByBusiness(biz.id);
        await deleteCustomersByBusiness(biz.id);
        await deleteBusiness(biz.id);
    }

    await deleteUser(user.id);
    await deleteConversation(phone);

    return sendWhatsAppMessage(phone, t("account.deleted"));
}
