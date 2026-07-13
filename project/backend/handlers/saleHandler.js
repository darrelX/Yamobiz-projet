import { sendWhatsAppMessage, sendWhatsAppDocument } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness, getProductById, decrementStock } from "../services/productService.js";
import { getOrCreateCustomer } from "../services/customerService.js";
import { createSale } from "../services/saleService.js";
import { createDebt } from "../services/debtService.js";
import { createInvoiceRecord } from "../services/invoiceService.js";
import { generateInvoicePdf } from "../services/pdfService.js";
import { logEvent } from "../services/loggerService.js";
import { matchProductByName } from "../utils/productMatcher.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, parsePositiveNumber, parseYesNo } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { buildProductListMessage, showMainMenu } from "./menuHandler.js";

export async function handleSale(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.SALE_SELECT_PRODUCT:
            return handleSelectProduct(phone, text, conversation, business);

        case STEPS.SALE_QUANTITY:
            return handleQuantity(phone, text, conversation, business);

        case STEPS.SALE_ADD_MORE:
            return handleAddMore(phone, text, conversation, business);

        case STEPS.SALE_PAYMENT_TYPE:
            return handlePaymentType(phone, text, conversation, business);

        case STEPS.SALE_CUSTOMER_NAME:
            return handleCustomerName(phone, text, conversation, business);

        case STEPS.SALE_CONFIRM:
            return handleConfirm(phone, text, conversation, business);

        case STEPS.SALE_EDIT_QUANTITY:
            return handleEditQuantity(phone, text, conversation, business);

        case STEPS.SALE_AI_REVIEW:
            return handleAiReviewConfirm(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

/**
 * Point d'entrée "vente intelligente" : appelé depuis menuHandler quand l'IA a détecté
 * une intention de vente dans un message libre (tapé ou dicté), avec une liste de
 * { product_query, quantity }.
 *
 * Ne crée JAMAIS la vente directement : on résout les produits, on vérifie le stock,
 * puis on affiche systématiquement un récap ("J'ai compris ceci...") que l'utilisateur
 * doit confirmer, exactement comme pour une vente saisie manuellement.
 */
export async function startSaleFromAiItems(phone, business, aiItems, products = null) {

    const productList = products || await getProductsByBusiness(business.id);

    if (!productList.length) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, t("sale.noProductsInStock"));
    }

    const resolved = [];
    const unresolved = [];
    const insufficientStock = [];

    for (const aiItem of aiItems) {

        const product = matchProductByName(productList, aiItem.product_query);
        const quantity = Number(aiItem.quantity);

        if (!product || !quantity || quantity <= 0) {
            unresolved.push(aiItem.product_query);
            continue;
        }

        if (quantity > Number(product.stock_quantity)) {
            insufficientStock.push({
                name: product.name,
                available: product.stock_quantity,
                requested: quantity
            });
            continue;
        }

        const existing = resolved.find(r => r.product_id === product.id);

        if (existing) {
            existing.quantity += quantity;
            existing.subtotal = existing.quantity * Number(product.price);
        } else {
            resolved.push({
                product_id: product.id,
                product_name: product.name,
                quantity,
                unit_price: product.price,
                subtotal: quantity * Number(product.price)
            });
        }
    }

    if (!resolved.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("sale.aiNoProductFound"));
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.SALE_AI_REVIEW, { items: resolved });

    return sendWhatsAppMessage(phone, buildAiReviewMessage(resolved, unresolved, insufficientStock));
}

async function handleAiReviewConfirm(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, t("sale.aiReviewYesNoPrompt"));
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("sale.aiReviewCancelled"));
        return showMainMenu(phone, business);
    }

    // Une fois confirmé, on rejoint le flow classique — le panier reste modifiable
    // à volonté (numéro par numéro) une fois arrivé à l'écran de récapitulatif final.
    await updateConversation(phone, STEPS.SALE_ADD_MORE, { items: conversation.data.items });

    return sendWhatsAppMessage(phone, t("sale.addMoreQuestion"));
}

function buildAiReviewMessage(resolved, unresolved, insufficientStock) {

    const lines = resolved.map((i, idx) => `${idx + 1}. ${i.product_name} x${i.quantity} = ${formatFCFA(i.subtotal)}`);
    const total = resolved.reduce((sum, i) => sum + i.subtotal, 0);

    let message = `${t("sale.aiReviewTitle")}\n\n${lines.join("\n")}\n\n${t("sale.aiReviewTotal", { total: formatFCFA(total) })}`;

    if (insufficientStock.length) {
        const warnings = insufficientStock.map(w => t("sale.aiReviewStockWarning", {
            name: w.name,
            available: w.available,
            requested: w.requested
        }));
        message += `\n\n${warnings.join("\n")}`;
    }

    if (unresolved.length) {
        message += `\n\n${t("sale.aiReviewUnresolved", { list: unresolved.join(", ") })}`;
    }

    message += `\n\n${t("sale.aiReviewConfirmQuestion")}`;

    return message;
}

async function handleSelectProduct(phone, text, conversation, business) {

    const products = await getProductsByBusiness(business.id);
    const index = parseInt((text || "").trim(), 10) - 1;

    if (isNaN(index) || !products[index]) {
        return sendWhatsAppMessage(
            phone,
            `${t("sale.invalidChoice")}\n\n${buildProductListMessage(products, t("sale.selectProductTitle"))}`
        );
    }

    const product = products[index];

    await updateConversation(phone, STEPS.SALE_QUANTITY, {
        ...conversation.data,
        currentProductId: product.id,
        currentProductName: product.name,
        currentProductPrice: product.price,
        currentProductStock: product.stock_quantity
    });

    return sendWhatsAppMessage(
        phone,
        t("sale.quantityPrompt", { name: product.name, stock: product.stock_quantity, unit: product.unit })
    );
}

async function handleQuantity(phone, text, conversation, business) {

    const quantity = parsePositiveNumber(text);
    const { currentProductStock, currentProductId, currentProductName, currentProductPrice } = conversation.data;

    if (!quantity) {
        return sendWhatsAppMessage(phone, t("sale.quantityInvalid"));
    }

    if (quantity > Number(currentProductStock)) {
        return sendWhatsAppMessage(
            phone,
            t("sale.stockInsufficient", { available: currentProductStock, name: currentProductName })
        );
    }

    const subtotal = quantity * Number(currentProductPrice);

    const items = [...(conversation.data.items || []), {
        product_id: currentProductId,
        product_name: currentProductName,
        quantity,
        unit_price: currentProductPrice,
        subtotal
    }];

    await updateConversation(phone, STEPS.SALE_ADD_MORE, {
        items
    });

    return sendWhatsAppMessage(
        phone,
        t("sale.itemAdded", { name: currentProductName, quantity, subtotal: formatFCFA(subtotal) })
    );
}

async function handleAddMore(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, t("sale.yesNoPrompt"));
    }

    if (answer) {

        const products = await getProductsByBusiness(business.id);

        await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, conversation.data);

        return sendWhatsAppMessage(phone, buildProductListMessage(products, t("sale.addProductTitle")));
    }

    await updateConversation(phone, STEPS.SALE_PAYMENT_TYPE, conversation.data);

    return sendWhatsAppMessage(phone, t("sale.paymentTypePrompt"));
}

async function handlePaymentType(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "1") {

        const data = { ...conversation.data, paymentType: "cash" };
        await updateConversation(phone, STEPS.SALE_CONFIRM, data);

        return sendWhatsAppMessage(phone, buildSummary(data));
    }

    if (choice === "2") {

        await updateConversation(phone, STEPS.SALE_CUSTOMER_NAME, {
            ...conversation.data,
            paymentType: "credit"
        });

        return sendWhatsAppMessage(phone, t("sale.customerNamePrompt"));
    }

    return sendWhatsAppMessage(phone, t("sale.paymentTypeInvalid"));
}

async function handleCustomerName(phone, text, conversation, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("sale.customerNameRequired"));
    }

    const data = { ...conversation.data, customerName: text.trim() };

    await updateConversation(phone, STEPS.SALE_CONFIRM, data);

    return sendWhatsAppMessage(phone, buildSummary(data));
}

/**
 * Écran final avant facture. En plus de oui/non, accepte des commandes déterministes
 * (aucun appel IA, simple correspondance de motif) pour tout modifier à ce stade :
 * - "modifier <numéro>"  → change la quantité d'une ligne
 * - "supprimer <numéro>" → retire une ligne du panier
 * - "ajouter"            → repart choisir un produit supplémentaire
 * - "client <nom>"       → associe un nom de client à la facture (même en comptant)
 *
 * Ces motifs reconnaissent le français ET l'anglais (reconnaissance déterministe,
 * pas d'IA), pour rester utilisables quelle que soit la langue de l'utilisateur.
 */
async function handleConfirm(phone, text, conversation, business) {

    const trimmed = (text || "").trim();

    const modifyMatch = trimmed.match(/^(modifier|edit)\s+(\d+)$/i);
    const deleteMatch = trimmed.match(/^(supprimer|delete|remove)\s+(\d+)$/i);
    const clientMatch = trimmed.match(/^(client|customer)\s+(.+)$/i);
    const wantsAddMore = /^(ajouter|add)$/i.test(trimmed);

    if (modifyMatch) {
        return startEditQuantity(phone, conversation, parseInt(modifyMatch[2], 10) - 1);
    }

    if (deleteMatch) {
        return removeCartItem(phone, business, conversation, parseInt(deleteMatch[2], 10) - 1);
    }

    if (clientMatch) {
        const data = { ...conversation.data, customerName: clientMatch[2].trim() };
        await updateConversation(phone, STEPS.SALE_CONFIRM, data);
        return sendWhatsAppMessage(phone, buildSummary(data));
    }

    if (wantsAddMore) {
        const products = await getProductsByBusiness(business.id);
        await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, conversation.data);
        return sendWhatsAppMessage(phone, buildProductListMessage(products, t("sale.addProductTitle")));
    }

    const answer = parseYesNo(trimmed);

    if (answer === null) {
        return sendWhatsAppMessage(phone, `${t("sale.yesNoPrompt")}${t("sale.editHint")}`);
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("sale.cancelled"));
        return showMainMenu(phone, business);
    }

    const { items, paymentType, customerName } = conversation.data;

    let customer = null;
    if (customerName) {
        customer = await getOrCreateCustomer(business.id, customerName);
    }

    const sale = await createSale(business.id, {
        customerId: customer?.id,
        cartItems: items,
        paymentType
    });

    if (!sale) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, t("sale.saleError"));
    }

    await logEvent(business.id, "vente", `Vente ${sale.invoice_number} — ${formatFCFA(sale.total_amount)}`);

    for (const item of items) {
        await decrementStock(item.product_id, item.quantity);
    }

    if (paymentType === "credit") {
        await createDebt(business.id, {
            saleId: sale.id,
            customerId: customer?.id,
            amountTotal: sale.total_amount
        });
    }

    try {

        const pdfPath = await generateInvoicePdf(business, sale, items, customer);

        await createInvoiceRecord(business.id, {
            saleId: sale.id,
            invoiceNumber: sale.invoice_number,
            pdfPath
        });

        await sendWhatsAppDocument(phone, pdfPath, `${sale.invoice_number}.pdf`, t("sale.invoiceCaption"));

    } catch (err) {
        console.log("❌ Erreur génération/envoi facture PDF :", err);
    }

    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        t("sale.success", { total: formatFCFA(sale.total_amount), invoiceNumber: sale.invoice_number })
    );

    return showMainMenu(phone, business);
}

async function startEditQuantity(phone, conversation, index) {

    const items = conversation.data.items || [];

    if (isNaN(index) || !items[index]) {
        return sendWhatsAppMessage(phone, t("sale.invalidIndex", { max: items.length }));
    }

    await updateConversation(phone, STEPS.SALE_EDIT_QUANTITY, { ...conversation.data, editIndex: index });

    return sendWhatsAppMessage(
        phone,
        t("sale.editQuantityPrompt", { name: items[index].product_name, quantity: items[index].quantity })
    );
}

async function handleEditQuantity(phone, text, conversation, business) {

    const quantity = parsePositiveNumber(text);
    const { items, editIndex } = conversation.data;
    const item = items?.[editIndex];

    if (!item) {
        await updateConversation(phone, STEPS.SALE_CONFIRM, { ...conversation.data, editIndex: undefined });
        return sendWhatsAppMessage(phone, buildSummary(conversation.data));
    }

    if (!quantity) {
        return sendWhatsAppMessage(phone, t("sale.quantityInvalid"));
    }

    const product = await getProductById(item.product_id, business.id);
    const available = product ? Number(product.stock_quantity) : null;

    if (available !== null && quantity > available) {
        return sendWhatsAppMessage(phone, t("sale.stockInsufficient", { available, name: item.product_name }));
    }

    const updatedItems = items.map((it, i) => i === Number(editIndex)
        ? { ...it, quantity, subtotal: quantity * Number(it.unit_price) }
        : it
    );

    const data = { ...conversation.data, items: updatedItems, editIndex: undefined };
    await updateConversation(phone, STEPS.SALE_CONFIRM, data);

    await sendWhatsAppMessage(phone, t("sale.quantityUpdated", { name: item.product_name, quantity }));
    return sendWhatsAppMessage(phone, buildSummary(data));
}

async function removeCartItem(phone, business, conversation, index) {

    const items = conversation.data.items || [];

    if (isNaN(index) || !items[index]) {
        return sendWhatsAppMessage(phone, t("sale.invalidIndex", { max: items.length }));
    }

    const removed = items[index];
    const newItems = items.filter((_, i) => i !== index);

    if (!newItems.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("sale.itemRemovedEmpty", { name: removed.product_name }));
        return showMainMenu(phone, business);
    }

    const data = { ...conversation.data, items: newItems };
    await updateConversation(phone, STEPS.SALE_CONFIRM, data);

    await sendWhatsAppMessage(phone, t("sale.itemRemoved", { name: removed.product_name }));
    return sendWhatsAppMessage(phone, buildSummary(data));
}

function buildSummary(data) {

    const lines = data.items.map((i, idx) =>
        `${idx + 1}. ${i.product_name} x${i.quantity} = ${formatFCFA(i.subtotal)}`
    );

    const total = data.items.reduce((sum, i) => sum + i.subtotal, 0);
    const paymentLabel = data.paymentType === "credit" ? t("sale.paymentCredit") : t("sale.paymentCash");

    let summary = `${t("sale.summaryTitle")}\n\n${lines.join("\n")}\n\n${t("sale.summaryTotal", { total: formatFCFA(total) })}\n${t("sale.summaryPayment", { label: paymentLabel })}`;

    if (data.customerName) {
        summary += `\n${t("sale.summaryClient", { name: data.customerName })}`;
    }

    summary += `${t("sale.editHint")}\n\n${t("sale.confirmQuestion")}`;

    return summary;
}
