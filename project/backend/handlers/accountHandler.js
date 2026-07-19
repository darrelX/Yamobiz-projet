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
import { isLanguageSupported } from "../locales/index.js";
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
 * rubrique (ex: "je veux que ce soit en anglais"). Applique directement si la
 * langue demandée est supportée ; sinon informe l'utilisateur des langues
 * disponibles (au lieu de stocker une valeur invalide en base, ce qui rendait le
 * changement de langue silencieusement inopérant).
 */
export async function changeLanguageFromAi(phone, business, user, languageRaw) {

    if (!languageRaw || !String(languageRaw).trim()) {
        await updateConversation(phone, STEPS.ACCOUNT_LANGUAGE, {});
        return sendWhatsAppMessage(phone, t("account.languagePromptShort"));
    }

    const language = normalizeLanguageInput(String(languageRaw));

    if (!language || !isLanguageSupported(language)) {
        // On réinitialise le step AVANT d'afficher le menu principal : sinon la
        // conversation resterait sur une étape périmée (ex: ACCOUNT_LANGUAGE) et le
        // prochain choix du menu ("8"...) serait interprété comme une réponse à
        // cette vieille étape au lieu d'un choix de menu.
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("account.languageUnsupported"));
        return showMainMenu(phone, business);
    }

    await updateUser(user.id, { language });
    setCurrentLanguage(language);

    // Même raison : le step doit revenir sur MENU pour que le menu principal affiché
    // juste après soit réellement fonctionnel (cf. commentaire ci-dessus).
    await resetToMenu(phone);

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

    // Langue non supportée : on RESTE sur l'étape ACCOUNT_LANGUAGE pour laisser
    // l'utilisateur réessayer, au lieu d'enregistrer une valeur invalide qui
    // ferait retomber toute l'interface sur le français par défaut.
    if (!language || !isLanguageSupported(language)) {
        return sendWhatsAppMessage(phone, t("account.languageUnsupported"));
    }

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
