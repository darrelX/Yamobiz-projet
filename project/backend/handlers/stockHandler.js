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
import { STEPS } from "../utils/steps.js";
import { parsePositiveNumber, formatFCFA, formatDateTime } from "../utils/format.js";
import { buildStockListMessage, showMainMenu } from "./menuHandler.js";

/**
 * Affiche la liste du stock + les actions disponibles au premier niveau.
 */
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
        `📦 *Votre stock*\n\n${list}\n\n1️⃣ Ajouter un produit\nEntrez le *numéro* d'un produit pour le gérer (modifier, ajuster le stock, historique, supprimer)\n0️⃣ Retour au menu`
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

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
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

async function showProductActions(phone, product) {

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

    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        `✅ Produit ajouté : *${product.name}* — ${formatFCFA(product.price)} — stock : ${product.stock_quantity}`
    );

    return showMainMenu(phone, business);
}
