import { sendWhatsAppMessage, sendWhatsAppButtons } from "../services/whatsapp.js";
import { updateConversation, resetToMenu, deleteConversation } from "../services/conversationService.js";
import { deleteUser } from "../services/userService.js";
import { deleteBusiness, getBusinessesByUserId } from "../services/businessService.js";
import { deleteProductsByBusiness } from "../services/productService.js";
import { deleteSalesByBusiness } from "../services/saleService.js";
import { deleteDebtsByBusiness } from "../services/debtService.js";
import { deleteCustomersByBusiness } from "../services/customerService.js";
import { deleteInvoicesByBusiness } from "../services/invoiceService.js";
import { STEPS } from "../utils/steps.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Affiche le menu du compte utilisateur, avec l'option de suppression totale.
 */
export async function showAccountMenu(phone, business, user) {

    await updateConversation(phone, STEPS.ACCOUNT_MENU, {});

    const businesses = await getBusinessesByUserId(user.id);
    const bizWarning = businesses.length > 1
        ? `vos ${businesses.length} entreprises`
        : "votre entreprise";

    return sendWhatsAppButtons(
        phone,
        `⚙️ *Mon compte*\n\nTéléphone : ${user.phone}\n\n⚠️ La suppression du compte effacera définitivement ${bizWarning}, tout le stock, toutes les commandes et toutes les créances.`,
        [
            { id: "account_delete", title: "🗑️ Supprimer" },
            { id: "menu", title: "⬅️ Retour" }
        ]
    );
}

export async function handleAccount(phone, text, conversation, business, user) {

    switch (conversation.step) {

        case STEPS.ACCOUNT_MENU:
            return handleAccountMenuChoice(phone, text, business, user);

        case STEPS.ACCOUNT_DELETE_CONFIRM:
            return handleAccountDeleteConfirm(phone, text, business, user);

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
            "❗ Confirmez-vous la suppression *définitive* de votre compte et de toutes vos données ? Cette action est irréversible.",
            [
                { id: "confirm_delete", title: "✅ Oui, supprimer" },
                { id: "menu", title: "❌ Annuler" }
            ]
        );
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleAccountDeleteConfirm(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice !== "confirm_delete" && !["oui", "o", "yes", "1"].includes(choice)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "Suppression annulée. Vos données sont conservées.");
        return showMainMenu(phone, business);
    }

    // Nettoyage complet de TOUTES les entreprises de l'utilisateur (multi-entreprises).
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

    return sendWhatsAppMessage(
        phone,
        "✅ Votre compte et toutes vos entreprises ont été supprimés définitivement. Merci d'avoir utilisé Yamobiz. 👋"
    );
}
