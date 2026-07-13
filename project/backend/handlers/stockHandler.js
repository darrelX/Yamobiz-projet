import { sendWhatsAppMessage, sendWhatsAppList } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import {
    getProductsByBusiness,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    getSalesHistoryForProduct
} from "../services/productService.js";
import { logEvent } from "../services/loggerService.js";
import { matchProductByName } from "../utils/productMatcher.js";
import { STEPS } from "../utils/steps.js";
import { parsePositiveNumber, parseYesNo, formatFCFA, formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { buildStockListMessage, showMainMenu } from "./menuHandler.js";

/**
 * Point d'entrée "quels produits sont presque épuisés" détecté par l'IA depuis
 * n'importe quelle rubrique. Seuil par défaut de 5 unités si non précisé.
 */
export async function showLowStockFromAi(phone, business, threshold) {

    const limit = Number(threshold) > 0 ? Number(threshold) : 5;
    const products = await getProductsByBusiness(business.id);
    const low = products.filter(p => Number(p.stock_quantity) <= limit);

    if (!low.length) {
        await sendWhatsAppMessage(phone, t("stock.noneLow", { limit }));
        return showMainMenu(phone, business);
    }

    const lines = low.map(p => `• ${p.name} : ${p.stock_quantity} ${p.unit} ${t("stock.remainingSuffix")}`);

    await sendWhatsAppMessage(phone, `${t("stock.lowStockTitle", { limit })}\n\n${lines.join("\n")}`);

    return showMainMenu(phone, business);
}

export async function showStockMenu(phone, business) {

    const products = await getProductsByBusiness(business.id);

    await updateConversation(phone, STEPS.STOCK_MENU, {
        productIds: products.map(p => p.id)
    });

    const list = products.length ? buildStockListMessage(products) : t("stock.noProducts");

    return sendWhatsAppMessage(phone, t("stock.menuBody", { list }));
}

export async function handleStock(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.STOCK_MENU:
            return handleStockMenuChoice(phone, text, conversation, business);

        case STEPS.STOCK_ADD_NAME:
            return handleAddName(phone, text, conversation);

        case STEPS.STOCK_ADD_PRICE:
            return handleAddPrice(phone, text, conversation);

        case STEPS.STOCK_ADD_STOCK:
            return handleAddStock(phone, text, conversation, business);

        case STEPS.STOCK_PRODUCT_ACTIONS:
            return handleProductActions(phone, text, conversation, business);

        case STEPS.STOCK_EDIT_NAME:
            return handleEditName(phone, text, conversation, business);

        case STEPS.STOCK_EDIT_PRICE:
            return handleEditPrice(phone, text, conversation, business);

        case STEPS.STOCK_ADJUST_QTY:
            return handleAdjustQty(phone, text, conversation, business);

        case STEPS.STOCK_DELETE_CONFIRM:
            return handleDeleteConfirm(phone, text, conversation, business);

        case STEPS.STOCK_ADD_BULK_REVIEW:
            return handleBulkAddConfirm(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

/**
 * Point d'entrée "ajout de stock en bloc" : appelé depuis menuHandler quand l'IA a détecté
 * une intention ADD_STOCK dans un message libre/vocal, avec une liste de
 * { product_query, quantity, price? }.
 *
 * Si le produit existe déjà (correspondance approximative par nom), on incrémente son stock.
 * Sinon, on le crée — mais seulement si un prix a été fourni. Rien n'est écrit en base
 * avant confirmation explicite de l'utilisateur.
 */
export async function startBulkAddFromAiItems(phone, business, aiItems, products = null) {

    const productList = products || await getProductsByBusiness(business.id);

    const toRestock = [];
    const toCreate = [];
    const unresolved = [];

    for (const item of aiItems) {

        const quantity = Number(item.quantity);

        if (!item.product_query || !quantity || quantity <= 0) {
            unresolved.push(item.product_query || "?");
            continue;
        }

        const existing = matchProductByName(productList, item.product_query);

        if (existing) {
            toRestock.push({ id: existing.id, name: existing.name, quantity, unit: existing.unit });
        } else if (item.price) {
            toCreate.push({ name: item.product_query.trim(), price: Number(item.price), quantity });
        } else {
            unresolved.push(t("stock.missingPriceSuffix", { query: item.product_query }));
        }
    }

    if (!toCreate.length && !toRestock.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(
            phone,
            `${t("stock.bulkAddFailed")}${unresolved.length ? `\n\n${t("stock.unresolvedPrefix", { list: unresolved.join(", ") })}` : ""}`
        );
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.STOCK_ADD_BULK_REVIEW, { toCreate, toRestock });

    return sendWhatsAppMessage(phone, buildBulkAddReviewMessage(toCreate, toRestock, unresolved));
}

function buildBulkAddReviewMessage(toCreate, toRestock, unresolved) {

    const lines = [];

    for (const p of toRestock) {
        lines.push(`• ${p.name} : +${p.quantity} ${p.unit} (${t("stock.restockSuffix")})`);
    }

    for (const p of toCreate) {
        lines.push(`• ${t("stock.newProductLine", { name: p.name, quantity: p.quantity, price: formatFCFA(p.price) })}`);
    }

    let message = `${t("stock.bulkAddReviewTitle")}\n\n${lines.join("\n")}`;

    if (unresolved.length) {
        message += `\n\n${t("stock.unresolvedPrefix", { list: unresolved.join(", ") })}`;
    }

    message += `\n\n${t("stock.bulkAddConfirmQuestion")}`;

    return message;
}

/**
 * Point d'entrée "modifier un produit" détecté par l'IA depuis n'importe quelle
 * rubrique (ex: "modifie le prix du riz à 600", "renomme sucre en sucre blanc").
 * Si une valeur a été comprise, on applique directement (comme le fait déjà le flow
 * manuel, sans confirmation supplémentaire) ; sinon on redirige vers l'étape de
 * saisie correspondante.
 */
export async function startEditProductFromAi(phone, business, item, products = null) {

    const productList = products || await getProductsByBusiness(business.id);
    const product = matchProductByName(productList, item.product_query);

    if (!product) {
        await sendWhatsAppMessage(phone, t("stock.productNotFound", { query: item.product_query }));
        return showStockMenu(phone, business);
    }

    if (item.field === "price") {

        const price = item.value ? parsePositiveNumber(String(item.value)) : null;

        if (price) {
            const updated = await updateProduct(product.id, { price });
            await sendWhatsAppMessage(phone, t("stock.priceUpdated", { name: updated.name, price: formatFCFA(updated.price) }));
            return showProductActions(phone, updated);
        }

        await updateConversation(phone, STEPS.STOCK_EDIT_PRICE, { selectedProductId: product.id });
        return sendWhatsAppMessage(phone, t("stock.askNewPrice", { name: product.name }));
    }

    // field === "name" (ou non précisé)
    const name = item.value ? String(item.value).trim() : null;

    if (name) {
        const updated = await updateProduct(product.id, { name });
        await sendWhatsAppMessage(phone, t("stock.nameUpdated", { name: updated.name }));
        return showProductActions(phone, updated);
    }

    await updateConversation(phone, STEPS.STOCK_EDIT_NAME, { selectedProductId: product.id });
    return sendWhatsAppMessage(phone, t("stock.askNewName", { name: product.name }));
}

async function handleBulkAddConfirm(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, t("common.yesNoPrompt"));
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.bulkAddCancelled"));
        return showMainMenu(phone, business);
    }

    const { toCreate, toRestock } = conversation.data;
    let count = 0;

    for (const p of toRestock) {
        const updated = await adjustStock(p.id, p.quantity);
        if (updated) {
            count++;
            await logEvent(business.id, "stock_ajout", `${p.name} : +${p.quantity} ${p.unit} (via IA)`);
        }
    }

    for (const p of toCreate) {
        const created = await createProduct(business.id, {
            name: p.name,
            price: p.price,
            stock_quantity: p.quantity
        });
        if (created) {
            count++;
            await logEvent(business.id, "stock_ajout", `Nouveau produit (via IA) : ${p.name} — ${p.quantity} unité(s)`);
        }
    }

    await resetToMenu(phone);

    await sendWhatsAppMessage(phone, t("stock.bulkAddDone", { count }));

    return showMainMenu(phone, business);
}

async function handleStockMenuChoice(phone, text, conversation, business) {

    const choice = (text || "").trim().toLowerCase();

    if (choice === "a" || choice === "A") {
        await updateConversation(phone, STEPS.STOCK_ADD_NAME, {});
        return sendWhatsAppMessage(phone, t("stock.askNewProductName"));
    }

    if (choice === "0") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    const index = parseInt(choice, 10) - 1;
    const productIds = conversation.data.productIds || [];

    if (isNaN(index) || !productIds[index]) {
        return sendWhatsAppMessage(phone, t("stock.menuInvalidChoice"));
    }

    const product = await getProductById(productIds[index], business.id);

    if (!product) {
        return sendWhatsAppMessage(phone, t("stock.productNotFoundGeneric"));
    }

    return showProductActions(phone, product);
}

export async function showProductActions(phone, product) {

    await updateConversation(phone, STEPS.STOCK_PRODUCT_ACTIONS, {
        selectedProductId: product.id
    });

    const sections = [{
        title: t("stock.actionsTitle"),
        rows: [
            { id: "edit_name", title: t("stock.actionEditName") },
            { id: "edit_price", title: t("stock.actionEditPrice") },
            { id: "add_stock", title: t("stock.actionAddUnits") },
            { id: "remove_stock", title: t("stock.actionRemoveUnits") },
            { id: "history", title: t("stock.actionHistory") },
            { id: "delete", title: t("stock.actionDelete") },
            { id: "back", title: t("stock.actionBack") }
        ]
    }];

    return sendWhatsAppList(
        phone,
        t("stock.productDetailBody", { name: product.name, price: formatFCFA(product.price), stock: product.stock_quantity, unit: product.unit }),
        t("common.chooseButton"),
        sections
    );
}

async function handleProductActions(phone, text, conversation, business) {

    const choice = (text || "").trim().toLowerCase();
    const productId = conversation.data.selectedProductId;

    const product = await getProductById(productId, business.id);

    if (!product) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.productGone"));
        return showMainMenu(phone, business);
    }

    switch (choice) {

        case "edit_name":
            await updateConversation(phone, STEPS.STOCK_EDIT_NAME, { selectedProductId: productId });
            return sendWhatsAppMessage(phone, t("stock.askNewName", { name: product.name }));

        case "edit_price":
            await updateConversation(phone, STEPS.STOCK_EDIT_PRICE, { selectedProductId: productId });
            return sendWhatsAppMessage(phone, t("stock.askNewPrice", { name: product.name }));

        case "add_stock":
            await updateConversation(phone, STEPS.STOCK_ADJUST_QTY, { selectedProductId: productId, adjustSign: 1 });
            return sendWhatsAppMessage(phone, t("stock.askAddUnits", { name: product.name }));

        case "remove_stock":
            await updateConversation(phone, STEPS.STOCK_ADJUST_QTY, { selectedProductId: productId, adjustSign: -1 });
            return sendWhatsAppMessage(phone, t("stock.askRemoveUnits", { name: product.name, stock: product.stock_quantity }));

        case "history":
            return handleHistory(phone, product);

        case "delete":
            await updateConversation(phone, STEPS.STOCK_DELETE_CONFIRM, { selectedProductId: productId });
            return sendWhatsAppMessage(phone, t("stock.deleteConfirmQuestion", { name: product.name }));

        case "back":
        default:
            return showStockMenu(phone, business);
    }
}

async function handleHistory(phone, product) {

    const history = await getSalesHistoryForProduct(product.id, 15);

    if (!history.length) {
        await sendWhatsAppMessage(phone, t("stock.noHistory", { name: product.name }));
        return showProductActions(phone, product);
    }

    const lines = history.map(h => {
        const date = h.sales?.created_at ? formatDateTime(h.sales.created_at) : "-";
        return `• ${date} — ${h.quantity} ${product.unit} ${t("stock.soldSuffix")} — ${formatFCFA(h.subtotal)} (${h.sales?.invoice_number || ""})`;
    });

    await sendWhatsAppMessage(phone, t("stock.historyTitle", { name: product.name, list: lines.join("\n") }));

    return showProductActions(phone, product);
}

async function handleEditName(phone, text, conversation, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("stock.nameRequired"));
    }

    const updated = await updateProduct(conversation.data.selectedProductId, { name: text.trim() });

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.updateError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("stock.nameUpdated", { name: updated.name }));
    return showProductActions(phone, updated);
}

async function handleEditPrice(phone, text, conversation, business) {

    const price = parsePositiveNumber(text);

    if (!price) {
        return sendWhatsAppMessage(phone, t("stock.priceRequired"));
    }

    const updated = await updateProduct(conversation.data.selectedProductId, { price });

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.updateError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("stock.priceUpdated", { name: updated.name, price: formatFCFA(updated.price) }));
    return showProductActions(phone, updated);
}

async function handleAdjustQty(phone, text, conversation, business) {

    const qty = parsePositiveNumber(text);

    if (!qty) {
        return sendWhatsAppMessage(phone, t("stock.quantityRequired"));
    }

    const { selectedProductId, adjustSign } = conversation.data;
    const product = await getProductById(selectedProductId, business.id);

    if (!product) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.productNotFoundGeneric"));
        return showMainMenu(phone, business);
    }

    if (adjustSign < 0 && qty > Number(product.stock_quantity)) {
        return sendWhatsAppMessage(phone, t("stock.cannotRemoveMoreThanStock", { stock: product.stock_quantity }));
    }

    const updated = await adjustStock(selectedProductId, qty * adjustSign);

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("stock.stockUpdateError"));
        return showMainMenu(phone, business);
    }

    const logType = adjustSign > 0 ? "stock_ajout" : "stock_retrait";
    const sign = adjustSign > 0 ? "+" : "-";

    await logEvent(
        business.id,
        logType,
        `${updated.name} : ${sign}${qty} ${updated.unit} (nouveau stock : ${updated.stock_quantity})`
    );

    const verbKey = adjustSign > 0 ? "stock.unitsAdded" : "stock.unitsRemoved";

    await sendWhatsAppMessage(phone, t(verbKey, { qty, stock: updated.stock_quantity, unit: updated.unit }));
    return showProductActions(phone, updated);
}

async function handleDeleteConfirm(phone, text, conversation, business) {

    const answer = (text || "").trim().toLowerCase();

    if (!["oui", "o", "yes", "1"].includes(answer)) {
        const product = await getProductById(conversation.data.selectedProductId, business.id);
        await sendWhatsAppMessage(phone, t("stock.deleteCancelled"));
        return product ? showProductActions(phone, product) : showStockMenu(phone, business);
    }

    const deleted = await deleteProduct(conversation.data.selectedProductId);

    await resetToMenu(phone);

    if (!deleted) {
        await sendWhatsAppMessage(phone, t("stock.deleteError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("stock.deleted"));
    return showMainMenu(phone, business);
}

/**
 * Reconnaît une commande de correction déterministe du type "nom <valeur>" /
 * "name <valeur>" ou "prix <valeur>" / "price <valeur>" (FR et EN), utilisable à
 * tout moment pendant l'ajout d'un nouveau produit pour revenir corriger un champ
 * déjà saisi, sans casser la progression du flow.
 */
function matchFieldOverride(text) {

    const trimmed = (text || "").trim();

    let m = trimmed.match(/^(nom|name)\s*:?\s*(.+)$/i);
    if (m) return { field: "name", value: m[2].trim() };

    m = trimmed.match(/^(prix|price)\s*:?\s*(.+)$/i);
    if (m) return { field: "price", value: m[2].trim() };

    return null;
}

async function handleAddName(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("stock.newProductNameRequired"));
    }

    await updateConversation(phone, STEPS.STOCK_ADD_PRICE, {
        ...conversation.data,
        productName: text.trim()
    });

    return sendWhatsAppMessage(phone, t("stock.askUnitPrice", { name: text.trim() }));
}

async function handleAddPrice(phone, text, conversation) {

    const override = matchFieldOverride(text);

    if (override?.field === "name") {
        await updateConversation(phone, STEPS.STOCK_ADD_PRICE, { ...conversation.data, productName: override.value });
        return sendWhatsAppMessage(phone, t("stock.nameUpdatedAskPrice", { name: override.value }));
    }

    const price = parsePositiveNumber(text);

    if (!price) {
        return sendWhatsAppMessage(phone, t("stock.priceRequiredWithHint"));
    }

    await updateConversation(phone, STEPS.STOCK_ADD_STOCK, {
        ...conversation.data,
        productPrice: price
    });

    return sendWhatsAppMessage(phone, t("stock.askInitialStock"));
}

async function handleAddStock(phone, text, conversation, business) {

    const override = matchFieldOverride(text);

    if (override?.field === "name") {
        await updateConversation(phone, STEPS.STOCK_ADD_STOCK, { ...conversation.data, productName: override.value });
        return sendWhatsAppMessage(phone, t("stock.nameUpdatedAskStock", { name: override.value }));
    }

    if (override?.field === "price") {
        const price = parsePositiveNumber(override.value);
        if (!price) {
            return sendWhatsAppMessage(phone, t("stock.invalidPrice"));
        }
        await updateConversation(phone, STEPS.STOCK_ADD_STOCK, { ...conversation.data, productPrice: price });
        return sendWhatsAppMessage(phone, t("stock.priceUpdatedAskStock", { price: formatFCFA(price) }));
    }

    const quantity = parsePositiveNumber(text);

    if (!quantity) {
        return sendWhatsAppMessage(phone, t("stock.quantityRequiredWithHint"));
    }

    const { productName, productPrice } = conversation.data;

    const product = await createProduct(business.id, {
        name: productName,
        price: productPrice,
        stock_quantity: quantity
    });

    if (!product) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, t("stock.createError"));
    }

    await logEvent(business.id, "stock_ajout", `Nouveau produit : ${product.name} — ${product.stock_quantity} ${product.unit}`);

    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        t("stock.productCreated", { name: product.name, price: formatFCFA(product.price), stock: product.stock_quantity })
    );

    return showMainMenu(phone, business);
}
