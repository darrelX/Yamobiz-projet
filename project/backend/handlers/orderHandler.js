import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getRecentSales, getSaleWithItems, deleteSale } from "../services/saleService.js";
import { incrementStock } from "../services/productService.js";
import { deleteDebtBySaleId } from "../services/debtService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, formatDateTime } from "../utils/format.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Affiche la liste des dernières commandes de l'entreprise.
 */
export async function showOrderMenu(phone, business) {

    const sales = await getRecentSales(business.id, 10);

    if (!sales.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "Aucune commande enregistrée pour le moment.");
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.ORDER_MENU, { saleIds: sales.map(s => s.id) });

    const lines = sales.map((s, i) => {
        const date = formatDateTime(s.created_at);
        const client = s.customers?.name ? ` — ${s.customers.name}` : "";
        return `${i + 1}. ${s.invoice_number} — ${formatFCFA(s.total_amount)} — ${date}${client}`;
    });

    return sendWhatsAppMessage(
        phone,
        `📋 *Vos dernières commandes*\n\n${lines.join("\n")}\n\nEntrez le *numéro* d'une commande pour la consulter, ou *0* pour revenir au menu.`
    );
}

export async function handleOrder(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.ORDER_MENU:
            return handleOrderSelection(phone, text, conversation, business);

        case STEPS.ORDER_ACTIONS:
            return handleOrderAction(phone, text, conversation, business);

        case STEPS.ORDER_CANCEL_CONFIRM:
            return handleOrderCancelConfirm(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleOrderSelection(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "0") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    const index = parseInt(choice, 10) - 1;
    const saleIds = conversation.data.saleIds || [];

    if (isNaN(index) || !saleIds[index]) {
        return sendWhatsAppMessage(phone, "❌ Choix invalide. Entrez le numéro d'une commande, ou 0 pour revenir au menu.");
    }

    const sale = await getSaleWithItems(saleIds[index]);

    if (!sale) {
        return sendWhatsAppMessage(phone, "❌ Commande introuvable.");
    }

    await updateConversation(phone, STEPS.ORDER_ACTIONS, { selectedSaleId: sale.id });

    const lines = sale.items.map(i => `• ${i.product_name} x${i.quantity} = ${formatFCFA(i.subtotal)}`);

    return sendWhatsAppMessage(
        phone,
        `🧾 *Commande ${sale.invoice_number}*\n\nDate exacte : ${formatDateTime(sale.created_at)}\n\n${lines.join("\n")}\n\nTotal : ${formatFCFA(sale.total_amount)}\nPaiement : ${sale.payment_type === "credit" ? "Crédit" : "Comptant"}\n\n1️⃣ Annuler cette commande\n0️⃣ Retour`
    );
}

async function handleOrderAction(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "1") {
        await updateConversation(phone, STEPS.ORDER_CANCEL_CONFIRM, conversation.data);
        return sendWhatsAppMessage(
            phone,
            "⚠️ Confirmez-vous l'annulation de cette commande ? Le stock vendu sera réajusté et la créance associée (le cas échéant) supprimée. (oui / non)"
        );
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleOrderCancelConfirm(phone, text, conversation, business) {

    const answer = (text || "").trim().toLowerCase();

    if (!["oui", "o", "yes", "1"].includes(answer)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "Annulation abandonnée, la commande est conservée.");
        return showMainMenu(phone, business);
    }

    const sale = await getSaleWithItems(conversation.data.selectedSaleId);

    if (!sale) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Commande introuvable.");
        return showMainMenu(phone, business);
    }

    for (const item of sale.items) {
        await incrementStock(item.product_id, item.quantity);
    }

    if (sale.payment_type === "credit") {
        await deleteDebtBySaleId(sale.id);
    }

    await deleteSale(sale.id);

    await resetToMenu(phone);

    await sendWhatsAppMessage(phone, `✅ Commande ${sale.invoice_number} annulée, le stock a été réajusté.`);
    return showMainMenu(phone, business);
}
