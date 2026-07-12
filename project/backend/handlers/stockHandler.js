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
import { buildStockListMessage, showMainMenu } from "./menuHandler.js";

export async function showStockMenu(phone, business) {

    const products = await getProductsByBusiness(business.id);

    await updateConversation(phone, STEPS.STOCK_MENU, {
        productIds: products.map(p => p.id)
    });

    const list = products.length
        ? buildStockListMessage(products)
        : "Aucun produit enregistré pour le moment.";

    return sendWhatsAppMessage(
        phone,
        `📦 *Votre stock*\n\n${list}\n\n1️⃣ Ajouter un produit\nEntrez le *numéro* d'un produit pour le gérer (modifier, ajuster le stock, historique, supprimer)\n0️⃣ Retour au menu\n\n_Astuce : vous pouvez aussi m'écrire directement, ex. "ajoute 10 riz à 500 et 20 sucre à 300"._`
    );
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
            unresolved.push(`${item.product_query} (prix manquant pour un nouveau produit)`);
        }
    }

    if (!toCreate.length && !toRestock.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(
            phone,
            `🤖 Je n'ai pas pu traiter votre demande d'ajout de stock.${unresolved.length ? `\n\n❓ ${unresolved.join(", ")}` : ""}`
        );
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.STOCK_ADD_BULK_REVIEW, { toCreate, toRestock });

    return sendWhatsAppMessage(phone, buildBulkAddReviewMessage(toCreate, toRestock, unresolved));
}

function buildBulkAddReviewMessage(toCreate, toRestock, unresolved) {

    const lines = [];

    for (const p of toRestock) {
        lines.push(`• ${p.name} : +${p.quantity} ${p.unit} (réapprovisionnement)`);
    }

    for (const p of toCreate) {
        lines.push(`• ${p.name} (nouveau) : ${p.quantity} unité(s) à ${formatFCFA(p.price)}`);
    }

    let message = `🤖 *Ajout de stock — récapitulatif*\n\n${lines.join("\n")}`;

    if (unresolved.length) {
        message += `\n\n❓ Non traité(s) : ${unresolved.join(", ")}`;
    }

    message += "\n\nConfirmez-vous cet ajout ? (oui / non)";

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
        await sendWhatsAppMessage(phone, `❌ Je n'ai pas trouvé de produit correspondant à "${item.product_query}".`);
        return showStockMenu(phone, business);
    }

    if (item.field === "price") {

        const price = item.value ? parsePositiveNumber(String(item.value)) : null;

        if (price) {
            const updated = await updateProduct(product.id, { price });
            await sendWhatsAppMessage(phone, `✅ Prix mis à jour : *${updated.name}* — ${formatFCFA(updated.price)}`);
            return showProductActions(phone, updated);
        }

        await updateConversation(phone, STEPS.STOCK_EDIT_PRICE, { selectedProductId: product.id });
        return sendWhatsAppMessage(phone, `Nouveau prix pour "${product.name}" (en FCFA) ?`);
    }

    // field === "name" (ou non précisé)
    const name = item.value ? String(item.value).trim() : null;

    if (name) {
        const updated = await updateProduct(product.id, { name });
        await sendWhatsAppMessage(phone, `✅ Nom mis à jour : *${updated.name}*`);
        return showProductActions(phone, updated);
    }

    await updateConversation(phone, STEPS.STOCK_EDIT_NAME, { selectedProductId: product.id });
    return sendWhatsAppMessage(phone, `Nouveau nom pour "${product.name}" ?`);
}

async function handleBulkAddConfirm(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, "Répondez par *oui* ou *non*.");
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "Ajout de stock annulé.");
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

    await sendWhatsAppMessage(phone, `✅ Stock mis à jour pour ${count} produit(s).`);

    return showMainMenu(phone, business);
}

async function handleStockMenuChoice(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "1") {
        await updateConversation(phone, STEPS.STOCK_ADD_NAME, {});
        return sendWhatsAppMessage(phone, "Quel est le nom du nouveau produit ?");
    }

    if (choice === "0") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    const index = parseInt(choice, 10) - 1;
    const productIds = conversation.data.productIds || [];

    if (isNaN(index) || !productIds[index]) {
        return sendWhatsAppMessage(
            phone,
            "❌ Choix invalide. Entrez le numéro d'un produit, 1️⃣ pour en ajouter un, ou 0️⃣ pour revenir."
        );
    }

    const product = await getProductById(productIds[index], business.id);

    if (!product) {
        return sendWhatsAppMessage(phone, "❌ Produit introuvable.");
    }

    return showProductActions(phone, product);
}

export async function showProductActions(phone, product) {

    await updateConversation(phone, STEPS.STOCK_PRODUCT_ACTIONS, {
        selectedProductId: product.id
    });

    const sections = [{
        title: "Actions",
        rows: [
            { id: "edit_name", title: "✏️ Modifier le nom" },
            { id: "edit_price", title: "💲 Modifier le prix" },
            { id: "add_stock", title: "➕ Ajouter des unités" },
            { id: "remove_stock", title: "➖ Retirer des unités" },
            { id: "history", title: "📜 Historique des ventes" },
            { id: "delete", title: "🗑️ Supprimer le produit" },
            { id: "back", title: "⬅️ Retour au stock" }
        ]
    }];

    return sendWhatsAppList(
        phone,
        `📦 *${product.name}*\n\nPrix : ${formatFCFA(product.price)}\nStock : ${product.stock_quantity} ${product.unit}`,
        "Choisir",
        sections
    );
}

async function handleProductActions(phone, text, conversation, business) {

    const choice = (text || "").trim().toLowerCase();
    const productId = conversation.data.selectedProductId;

    const product = await getProductById(productId, business.id);

    if (!product) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Ce produit n'existe plus.");
        return showMainMenu(phone, business);
    }

    switch (choice) {

        case "edit_name":
            await updateConversation(phone, STEPS.STOCK_EDIT_NAME, { selectedProductId: productId });
            return sendWhatsAppMessage(phone, `Nouveau nom pour "${product.name}" ?`);

        case "edit_price":
            await updateConversation(phone, STEPS.STOCK_EDIT_PRICE, { selectedProductId: productId });
            return sendWhatsAppMessage(phone, `Nouveau prix pour "${product.name}" (en FCFA) ?`);

        case "add_stock":
            await updateConversation(phone, STEPS.STOCK_ADJUST_QTY, { selectedProductId: productId, adjustSign: 1 });
            return sendWhatsAppMessage(phone, `Combien d'unités ajouter à "${product.name}" ?`);

        case "remove_stock":
            await updateConversation(phone, STEPS.STOCK_ADJUST_QTY, { selectedProductId: productId, adjustSign: -1 });
            return sendWhatsAppMessage(
                phone,
                `Combien d'unités retirer de "${product.name}" ? (stock actuel : ${product.stock_quantity})`
            );

        case "history":
            return handleHistory(phone, product);

        case "delete":
            await updateConversation(phone, STEPS.STOCK_DELETE_CONFIRM, { selectedProductId: productId });
            return sendWhatsAppMessage(
                phone,
                `⚠️ Confirmez-vous la suppression définitive de "${product.name}" ? (oui / non)`
            );

        case "back":
        default:
            return showStockMenu(phone, business);
    }
}

async function handleHistory(phone, product) {

    const history = await getSalesHistoryForProduct(product.id, 15);

    if (!history.length) {
        await sendWhatsAppMessage(phone, `📜 Aucune vente enregistrée pour "${product.name}" pour le moment.`);
        return showProductActions(phone, product);
    }

    const lines = history.map(h => {
        const date = h.sales?.created_at ? formatDateTime(h.sales.created_at) : "-";
        return `• ${date} — ${h.quantity} ${product.unit} vendu(s) — ${formatFCFA(h.subtotal)} (${h.sales?.invoice_number || ""})`;
    });

    await sendWhatsAppMessage(phone, `📜 *Historique des ventes — ${product.name}*\n\n${lines.join("\n")}`);

    return showProductActions(phone, product);
}

async function handleEditName(phone, text, conversation, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un nom valide.");
    }

    const updated = await updateProduct(conversation.data.selectedProductId, { name: text.trim() });

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Erreur lors de la mise à jour.");
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, `✅ Nom mis à jour : *${updated.name}*`);
    return showProductActions(phone, updated);
}

async function handleEditPrice(phone, text, conversation, business) {

    const price = parsePositiveNumber(text);

    if (!price) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un prix valide (nombre positif).");
    }

    const updated = await updateProduct(conversation.data.selectedProductId, { price });

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Erreur lors de la mise à jour.");
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, `✅ Prix mis à jour : ${formatFCFA(updated.price)}`);
    return showProductActions(phone, updated);
}

async function handleAdjustQty(phone, text, conversation, business) {

    const qty = parsePositiveNumber(text);

    if (!qty) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer une quantité valide (nombre positif).");
    }

    const { selectedProductId, adjustSign } = conversation.data;
    const product = await getProductById(selectedProductId, business.id);

    if (!product) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Produit introuvable.");
        return showMainMenu(phone, business);
    }

    if (adjustSign < 0 && qty > Number(product.stock_quantity)) {
        return sendWhatsAppMessage(
            phone,
            `❌ Vous ne pouvez pas retirer plus que le stock actuel (${product.stock_quantity}).`
        );
    }

    const updated = await adjustStock(selectedProductId, qty * adjustSign);

    if (!updated) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Erreur lors de la mise à jour du stock.");
        return showMainMenu(phone, business);
    }

    const verb = adjustSign > 0 ? "ajoutée(s)" : "retirée(s)";
    const logType = adjustSign > 0 ? "stock_ajout" : "stock_retrait";
    const sign = adjustSign > 0 ? "+" : "-";

    await logEvent(
        business.id,
        logType,
        `${updated.name} : ${sign}${qty} ${updated.unit} (nouveau stock : ${updated.stock_quantity})`
    );

    await sendWhatsAppMessage(
        phone,
        `✅ ${qty} unité(s) ${verb}. Nouveau stock : ${updated.stock_quantity} ${updated.unit}`
    );
    return showProductActions(phone, updated);
}

async function handleDeleteConfirm(phone, text, conversation, business) {

    const answer = (text || "").trim().toLowerCase();

    if (!["oui", "o", "yes", "1"].includes(answer)) {
        const product = await getProductById(conversation.data.selectedProductId, business.id);
        await sendWhatsAppMessage(phone, "Suppression annulée.");
        return product ? showProductActions(phone, product) : showStockMenu(phone, business);
    }

    const deleted = await deleteProduct(conversation.data.selectedProductId);

    await resetToMenu(phone);

    if (!deleted) {
        await sendWhatsAppMessage(phone, "❌ Erreur lors de la suppression.");
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, "✅ Produit supprimé.");
    return showMainMenu(phone, business);
}

async function handleAddName(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un nom de produit valide.");
    }

    await updateConversation(phone, STEPS.STOCK_ADD_PRICE, {
        ...conversation.data,
        productName: text.trim()
    });

    return sendWhatsAppMessage(phone, `Quel est le prix unitaire de "${text.trim()}" (en FCFA) ?`);
}

async function handleAddPrice(phone, text, conversation) {

    const price = parsePositiveNumber(text);

    if (!price) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un prix valide (nombre positif).");
    }

    await updateConversation(phone, STEPS.STOCK_ADD_STOCK, {
        ...conversation.data,
        productPrice: price
    });

    return sendWhatsAppMessage(phone, "Quelle est la quantité initiale en stock ?");
}

async function handleAddStock(phone, text, conversation, business) {

    const quantity = parsePositiveNumber(text);

    if (!quantity) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer une quantité valide (nombre positif).");
    }

    const { productName, productPrice } = conversation.data;

    const product = await createProduct(business.id, {
        name: productName,
        price: productPrice,
        stock_quantity: quantity
    });

    if (!product) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, "❌ Une erreur est survenue lors de la création du produit.");
    }

    await logEvent(business.id, "stock_ajout", `Nouveau produit : ${product.name} — ${product.stock_quantity} ${product.unit}`);

    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        `✅ Produit ajouté : *${product.name}* — ${formatFCFA(product.price)} — stock : ${product.stock_quantity}`
    );

    return showMainMenu(phone, business);
}
