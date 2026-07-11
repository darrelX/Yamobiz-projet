import { sendWhatsAppMessage, sendWhatsAppButtons } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { updateUser } from "../services/userService.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Affiche le profil de l'utilisateur (nom + téléphone) avec option de modification.
 */
export async function showProfileMenu(phone, business, user) {

    await updateConversation(phone, STEPS.PROFILE_MENU, {});

    const name = user.name || "(non renseigné)";

    return sendWhatsAppButtons(
        phone,
        `👤 *Mon profil*\n\nNom : ${name}\nTéléphone : ${user.phone}`,
        [
            { id: "profile_edit_name", title: "✏️ Modifier nom" },
            { id: "menu", title: "⬅️ Retour" }
        ]
    );
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
        return sendWhatsAppMessage(phone, "Quel est votre nouveau nom ?");
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleProfileEditName(phone, text, business, user) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un nom valide.");
    }

    const updated = await updateUser(user.id, { name: text.trim() });

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, "❌ Une erreur est survenue lors de la mise à jour du profil.");
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, `✅ Nom mis à jour : *${updated.name}*`);
    return showMainMenu(phone, business);
}
