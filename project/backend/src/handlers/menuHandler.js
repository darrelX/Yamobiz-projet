import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness } from "../services/productService.js";
import { STEPS } from "../utils/steps.js";
import { startAnalysis } from "./analysisHandler.js";

/**
 * Affiche le menu principal.
 */
export async function showMainMenu(phone, business) {

    return sendWhatsAppMessage(
        phone,
        `Bonjour ${business.name} 👋\n\nQue voulez-vous faire ?\n\n1️⃣ Nouvelle vente\n2️⃣ Voir / gérer le stock\n3️⃣ Créances\n4️⃣ Analyse\n\n_(Répondez avec le numéro de votre choix. Tapez "menu" à tout moment pour revenir ici.)_`
    );
}

/**
 * Traite le choix de l'utilisateur au menu principal (1 à 4).
 */
export async function handleMenuSelection(phone, text, business) {

    const choice = (text || "").trim();

    switch (choice) {

        case "1": {

            const products = await getProductsByBusiness(business.id);

            if (!products.length) {
                await resetToMenu(phone);
                return sendWhatsAppMessage(
                    phone,
                    "❌ Vous n'avez encore aucun produit en stock.\n\nAllez d'abord dans *2️⃣ Voir / gérer le stock* pour en ajouter."
                );
            }

            await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, { items: [] });

            return sendWhatsAppMessage(phone, buildProductListMessage(products, "🛒 Nouvelle vente"));
        }

        case "2": {

            const products = await getProductsByBusiness(business.id);

            await updateConversation(phone, STEPS.STOCK_MENU, {});

            const list = products.length
                ? buildStockListMessage(products)
                : "Aucun produit enregistré pour le moment.";

            return sendWhatsAppMessage(
                phone,
                `📦 *Votre stock*\n\n${list}\n\n1️⃣ Ajouter un produit\n2️⃣ Retour au menu`
            );
        }

        case "3": {

            await updateConversation(phone, STEPS.DEBT_MENU, {});

            // Le handler créances construit et envoie la liste directement.
            const { showDebtMenu } = await import("./debtHandler.js");
            return showDebtMenu(phone, business);
        }

        case "4":

            return startAnalysis(phone, business);

        default:

            return showMainMenu(phone, business);
    }
}

export function buildProductListMessage(products, title) {

    const lines = products.map((p, i) =>
        `${i + 1}. ${p.name} — ${p.price} FCFA (stock : ${p.stock_quantity} ${p.unit})`
    );

    return `${title}\n\n${lines.join("\n")}\n\nRépondez avec le *numéro* du produit vendu.`;
}

export function buildStockListMessage(products) {
    return products
        .map((p, i) => `${i + 1}. ${p.name} — ${p.stock_quantity} ${p.unit} (${p.price} FCFA)`)
        .join("\n");
}
