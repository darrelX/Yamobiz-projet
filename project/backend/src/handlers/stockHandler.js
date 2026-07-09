import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { createProduct } from "../services/productService.js";
import { STEPS } from "../utils/steps.js";
import { parsePositiveNumber } from "../utils/format.js";
import { showMainMenu } from "./menuHandler.js";

export async function handleStock(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.STOCK_MENU:
            return handleStockMenu(phone, text, business);

        case STEPS.STOCK_ADD_NAME:
            return handleAddName(phone, text, conversation);

        case STEPS.STOCK_ADD_PRICE:
            return handleAddPrice(phone, text, conversation);

        case STEPS.STOCK_ADD_STOCK:
            return handleAddStock(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleStockMenu(phone, text, business) {

    const choice = (text || "").trim();

    if (choice === "1") {
        await updateConversation(phone, STEPS.STOCK_ADD_NAME, {});
        return sendWhatsAppMessage(phone, "Quel est le nom du nouveau produit ?");
    }

    await resetToMenu(phone);
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
        `✅ Produit ajouté : *${product.name}* — ${product.price} FCFA — stock : ${product.stock_quantity}`
    );

    return showMainMenu(phone, business);
}
