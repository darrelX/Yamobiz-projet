import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getRecentSales, getSaleWithItems, deleteSale } from "../services/saleService.js";
import { incrementStock } from "../services/productService.js";
import { deleteDebtBySaleId } from "../services/debtService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { showMainMenu } from "./menuHandler.js";

export async function showOrderMenu(phone, business) {

    const sales = await getRecentSales(business.id, 10);

    if (!sales.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("invoice.none"));
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.ORDER_MENU, { saleIds: sales.map(s => s.id) });

    const lines = sales.map((s, i) => {
        const date = formatDateTime(s.created_at);
        const client = s.customers?.name ? ` — ${s.customers.name}` : "";
        return `${i + 1}. ${s.invoice_number} — ${formatFCFA(s.total_amount)} — ${date}${client}`;
    });

    return sendWhatsAppMessage(phone, t("invoice.listTitle", { list: lines.join("\n") }));
}

/**
 * Point d'entrée "annule ma dernière vente" détecté par l'IA depuis n'importe quelle
 * rubrique. Redirige vers l'écran de confirmation existant (jamais d'exécution
 * directe pour une action qui réajuste le stock et supprime une créance éventuelle).
 */
export async function startCancelLastSaleFromAi(phone, business) {

    const sales = await getRecentSales(business.id, 1);

    if (!sales.length) {
        await sendWhatsAppMessage(phone, t("invoice.noSaleToCancel"));
        return showMainMenu(phone, business);
    }

    const sale = sales[0];

    await updateConversation(phone, STEPS.ORDER_CANCEL_CONFIRM, { selectedSaleId: sale.id });

    return sendWhatsAppMessage(
        phone,
        t("invoice.cancelLastConfirm", { invoiceNumber: sale.invoice_number, total: formatFCFA(sale.total_amount) })
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
        return sendWhatsAppMessage(phone, t("invoice.invalidChoice"));
    }

    const sale = await getSaleWithItems(saleIds[index]);

    if (!sale) {
        return sendWhatsAppMessage(phone, t("invoice.notFound"));
    }

    await updateConversation(phone, STEPS.ORDER_ACTIONS, { selectedSaleId: sale.id });

    const lines = sale.items.map(i => `• ${i.product_name} x${i.quantity} = ${formatFCFA(i.subtotal)}`);
    const paymentLabel = sale.payment_type === "credit" ? t("sale.paymentCredit") : t("sale.paymentCash");

    return sendWhatsAppMessage(
        phone,
        t("invoice.detailBody", {
            invoiceNumber: sale.invoice_number,
            date: formatDateTime(sale.created_at),
            list: lines.join("\n"),
            total: formatFCFA(sale.total_amount),
            payment: paymentLabel
        })
    );
}

async function handleOrderAction(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "1") {
        await updateConversation(phone, STEPS.ORDER_CANCEL_CONFIRM, conversation.data);
        return sendWhatsAppMessage(phone, t("invoice.cancelConfirm"));
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleOrderCancelConfirm(phone, text, conversation, business) {

    const answer = (text || "").trim().toLowerCase();

    if (!["oui", "o", "yes", "1"].includes(answer)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("invoice.cancelAbandoned"));
        return showMainMenu(phone, business);
    }

    const sale = await getSaleWithItems(conversation.data.selectedSaleId);

    if (!sale) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("invoice.notFound"));
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

    await sendWhatsAppMessage(phone, t("invoice.cancelled", { invoiceNumber: sale.invoice_number }));
    return showMainMenu(phone, business);
}
