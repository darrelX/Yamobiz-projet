import { sendWhatsAppMessage, sendWhatsAppDocument } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness, getProductById, decrementStock } from "../services/productService.js";
import { getOrCreateCustomer } from "../services/customerService.js";
import { createSale } from "../services/saleService.js";
import { createDebt } from "../services/debtService.js";
import { createInvoiceRecord } from "../services/invoiceService.js";
import { generateInvoicePdf } from "../services/pdfService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, parsePositiveNumber, parseYesNo } from "../utils/format.js";
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

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleSelectProduct(phone, text, conversation, business) {

    const products = await getProductsByBusiness(business.id);
    const index = parseInt((text || "").trim(), 10) - 1;

    if (isNaN(index) || !products[index]) {
        return sendWhatsAppMessage(
            phone,
            `❌ Choix invalide.\n\n${buildProductListMessage(products, "🛒 Sélectionnez un produit")}`
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
        `Quantité de *${product.name}* ? (stock disponible : ${product.stock_quantity} ${product.unit})`
    );
}

async function handleQuantity(phone, text, conversation, business) {

    const quantity = parsePositiveNumber(text);
    const { currentProductStock, currentProductId, currentProductName, currentProductPrice } = conversation.data;

    if (!quantity) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer une quantité valide (nombre positif).");
    }

    if (quantity > Number(currentProductStock)) {
        return sendWhatsAppMessage(
            phone,
            `❌ Stock insuffisant. Il ne reste que ${currentProductStock} unité(s) de ${currentProductName}.`
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
        `✅ Ajouté : ${currentProductName} x${quantity} = ${formatFCFA(subtotal)}\n\nVoulez-vous ajouter un autre produit ? (oui / non)`
    );
}

async function handleAddMore(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, "Répondez par *oui* ou *non*.");
    }

    if (answer) {

        const products = await getProductsByBusiness(business.id);

        await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, conversation.data);

        return sendWhatsAppMessage(phone, buildProductListMessage(products, "🛒 Ajouter un produit"));
    }

    await updateConversation(phone, STEPS.SALE_PAYMENT_TYPE, conversation.data);

    return sendWhatsAppMessage(
        phone,
        "Mode de paiement ?\n\n1️⃣ Comptant\n2️⃣ Crédit (créance client)"
    );
}

async function handlePaymentType(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "1") {

        await updateConversation(phone, STEPS.SALE_CONFIRM, {
            ...conversation.data,
            paymentType: "cash"
        });

        return sendWhatsAppMessage(phone, buildSummary({ ...conversation.data, paymentType: "cash" }));
    }

    if (choice === "2") {

        await updateConversation(phone, STEPS.SALE_CUSTOMER_NAME, {
            ...conversation.data,
            paymentType: "credit"
        });

        return sendWhatsAppMessage(phone, "Nom du client (pour la créance et la facture) ?");
    }

    return sendWhatsAppMessage(phone, "Répondez avec 1️⃣ (Comptant) ou 2️⃣ (Crédit).");
}

async function handleCustomerName(phone, text, conversation, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer le nom du client.");
    }

    const data = { ...conversation.data, customerName: text.trim() };

    await updateConversation(phone, STEPS.SALE_CONFIRM, data);

    return sendWhatsAppMessage(phone, buildSummary(data));
}

async function handleConfirm(phone, text, conversation, business) {

    const answer = parseYesNo(text);

    if (answer === null) {
        return sendWhatsAppMessage(phone, "Confirmez-vous la vente ? Répondez par *oui* ou *non*.");
    }

    if (!answer) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Vente annulée.");
        return showMainMenu(phone, business);
    }

    const { items, paymentType, customerName } = conversation.data;

    // Client (pour créance / facture) si vente à crédit
    let customer = null;
    if (paymentType === "credit" && customerName) {
        customer = await getOrCreateCustomer(business.id, customerName);
    }

    // 1) Créer la vente + lignes
    const sale = await createSale(business.id, {
        customerId: customer?.id,
        cartItems: items,
        paymentType
    });

    if (!sale) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, "❌ Une erreur est survenue lors de l'enregistrement de la vente.");
    }

    // 2) Décrémenter le stock de chaque produit vendu
    for (const item of items) {
        await decrementStock(item.product_id, item.quantity);
    }

    // 3) Si vente à crédit, créer la créance
    if (paymentType === "credit") {
        await createDebt(business.id, {
            saleId: sale.id,
            customerId: customer?.id,
            amountTotal: sale.total_amount
        });
    }

    // 4) Générer et envoyer la facture PDF
    try {

        const pdfPath = await generateInvoicePdf(business, sale, items, customer);

        await createInvoiceRecord(business.id, {
            saleId: sale.id,
            invoiceNumber: sale.invoice_number,
            pdfPath
        });

        await sendWhatsAppDocument(
            phone,
            pdfPath,
            `${sale.invoice_number}.pdf`,
            "🧾 Voici votre facture."
        );

    } catch (err) {
        console.log("❌ Erreur génération/envoi facture PDF :", err);
    }

    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        `✅ Vente enregistrée avec succès !\n\nTotal : ${formatFCFA(sale.total_amount)}\nFacture n° ${sale.invoice_number}\n\n_Besoin d'annuler cette commande ? Rendez-vous dans "📋 Commandes" depuis le menu._`
    );

    return showMainMenu(phone, business);
}

function buildSummary(data) {

    const lines = data.items.map(i =>
        `• ${i.product_name} x${i.quantity} = ${formatFCFA(i.subtotal)}`
    );

    const total = data.items.reduce((sum, i) => sum + i.subtotal, 0);
    const paymentLabel = data.paymentType === "credit" ? "Crédit (créance)" : "Comptant";

    let summary = `🧾 *Récapitulatif de la vente*\n\n${lines.join("\n")}\n\nTotal : ${formatFCFA(total)}\nPaiement : ${paymentLabel}`;

    if (data.customerName) {
        summary += `\nClient : ${data.customerName}`;
    }

    summary += "\n\nConfirmez-vous cette vente ? (oui / non)";

    return summary;
}
