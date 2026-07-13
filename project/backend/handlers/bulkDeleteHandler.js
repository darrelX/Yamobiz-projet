import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { deleteProduct, incrementStock } from "../services/productService.js";
import { deleteCustomerById } from "../services/customerService.js";
import { deleteSale, getSaleWithItems, getSaleByInvoiceNumber } from "../services/saleService.js";
import { deleteDebtBySaleId } from "../services/debtService.js";
import { matchProductByName, matchCustomerByName } from "../utils/productMatcher.js";
import { STEPS } from "../utils/steps.js";
import { parseYesNo } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Suppression en bloc, détectée par l'IA depuis un message libre ou vocal.
 * Couvre trois types d'entités : produits, clients, ventes.
 * Aucune suppression réelle n'a lieu sans confirmation explicite de l'utilisateur.
 */
export async function handleBulkDelete(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.BULK_DELETE_REVIEW:
            return handleBulkDeleteConfirm(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

/**
 * Résout les éléments demandés et affiche un récap avant toute suppression réelle.
 * entityType: "products" | "customers" | "sales"
 * context: { products?, customers? } — listes déjà chargées, pour éviter les doubles requêtes.
 */
export async function startBulkDelete(phone, business, entityType, aiItems, context = {}) {

    const resolved = [];
    const unresolved = [];

    if (entityType === "products") {

        for (const item of aiItems) {
            const product = matchProductByName(context.products || [], item.product_query);
            if (product) {
                resolved.push({ id: product.id, label: product.name });
            } else {
                unresolved.push(item.product_query);
            }
        }

    } else if (entityType === "customers") {

        for (const item of aiItems) {
            const customer = matchCustomerByName(context.customers || [], item.customer_query);
            if (customer) {
                resolved.push({ id: customer.id, label: customer.name });
            } else {
                unresolved.push(item.customer_query);
            }
        }

    } else if (entityType === "sales") {

        for (const item of aiItems) {
            const sale = await getSaleByInvoiceNumber(business.id, item.invoice_number);
            if (sale) {
                resolved.push({ id: sale.id, label: sale.invoice_number });
            } else {
                unresolved.push(item.invoice_number);
            }
        }
    }

    if (!resolved.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(
            phone,
            unresolved.length
                ? t("bulkDelete.noneFoundWithList", { list: unresolved.join(", ") })
                : t("bulkDelete.noneFound")
        );
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.BULK_DELETE_REVIEW, { entityType, resolved });

    const label = entityLabel(entityType);
    const lines = resolved.map((r, i) => `${i + 1}. ${r.label}`);

    let message = t("bulkDelete.reviewTitle", { label, list: lines.join("\n") });

    if (unresolved.length) {
        message += `\n\n${t("bulkDelete.unresolvedPrefix", { list: unresolved.join(", ") })}`;
    }

    message += `\n\n${t("bulkDelete.confirmQuestion", { count: resolved.length })}`;

    return sendWhatsAppMessage(phone, message);
}

async function handleBulkDeleteConfirm(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, t("common.yesNoPrompt"));
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("bulkDelete.cancelled"));
        return showMainMenu(phone, business);
    }

    const { entityType, resolved } = conversation.data;
    let successCount = 0;

    for (const item of resolved) {

        if (entityType === "products") {
            const ok = await deleteProduct(item.id);
            if (ok) successCount++;
        }

        if (entityType === "customers") {
            const ok = await deleteCustomerById(item.id);
            if (ok) successCount++;
        }

        if (entityType === "sales") {

            const sale = await getSaleWithItems(item.id);

            if (sale) {

                for (const line of sale.items) {
                    await incrementStock(line.product_id, line.quantity);
                }

                if (sale.payment_type === "credit") {
                    await deleteDebtBySaleId(sale.id);
                }

                const ok = await deleteSale(sale.id);
                if (ok) successCount++;
            }
        }
    }

    await resetToMenu(phone);

    const stockNote = entityType === "sales" ? ` ${t("bulkDelete.stockAdjustedNote")}` : "";

    await sendWhatsAppMessage(
        phone,
        `${t("bulkDelete.done", { success: successCount, total: resolved.length })}${stockNote}`
    );

    return showMainMenu(phone, business);
}

function entityLabel(entityType) {
    if (entityType === "products") return t("bulkDelete.entityProducts");
    if (entityType === "customers") return t("bulkDelete.entityCustomers");
    if (entityType === "sales") return t("bulkDelete.entitySales");
    return t("bulkDelete.entityGeneric");
}
