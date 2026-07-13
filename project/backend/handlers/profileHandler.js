import { sendWhatsAppMessage, sendWhatsAppButtons } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { updateUser } from "../services/userService.js";
import { t } from "../utils/i18n.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

export async function showProfileMenu(phone, business, user) {

    await updateConversation(phone, STEPS.PROFILE_MENU, {});

    const name = user.name || t("profile.notSet");

    return sendWhatsAppButtons(
        phone,
        t("profile.menuBody", { name, phone: user.phone }),
        [
            { id: "profile_edit_name", title: t("profile.editNameButton") },
            { id: "menu", title: t("common.backButton") }
        ]
    );
}

/**
 * Point d'entrée "modifier mon nom" détecté par l'IA depuis n'importe quelle rubrique
 * (ex: "change mon nom en Lyne"). Si une valeur a été comprise, on applique directement
 * (comme le fait déjà le flow manuel, sans étape de confirmation supplémentaire) ;
 * sinon on redirige vers l'étape existante qui demande le nom.
 */
export async function startEditProfileNameFromAi(phone, business, user, value) {

    if (value && String(value).trim()) {
        return handleProfileEditName(phone, String(value).trim(), business, user);
    }

    await updateConversation(phone, STEPS.PROFILE_EDIT_NAME, {});
    return sendWhatsAppMessage(phone, t("profile.askNewName"));
}

export async function handleProfile(phone, text, conversation, business, user) {

    switch (conversation.step) {

        case STEPS.PROFILE_MENU:
            return handleProfileMenuChoice(phone, text, business, user);

        case STEPS.PROFILE_EDIT_NAME:
            return handleProfileEditName(phone, text, business, user);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleProfileMenuChoice(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice === "profile_edit_name" || choice === "1") {
        await updateConversation(phone, STEPS.PROFILE_EDIT_NAME, {});
        return sendWhatsAppMessage(phone, t("profile.askNewName"));
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleProfileEditName(phone, text, business, user) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("profile.nameRequired"));
    }

    const updated = await updateUser(user.id, { name: text.trim() });

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, t("profile.updateError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("profile.nameUpdated", { name: updated.name }));
    return showMainMenu(phone, business);
}
