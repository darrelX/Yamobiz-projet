import { sendWhatsAppMessage, sendWhatsAppList } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness } from "../services/productService.js";
import { STEPS } from "../utils/steps.js";

/**
 * Affiche le menu principal sous forme de liste WhatsApp interactive.
 */
export async function showMainMenu(phone, business) {

    const sections = [{
        title: "Menu principal",
        rows: [
            { id: "1", title: "🛒 Nouvelle vente" },
            { id: "2", title: "📦 Gérer le stock" },
            { id: "3", title: "💰 Créances" },
            { id: "4", title: "📊 Analyse" },
            { id: "5", title: "📋 Commandes" },
            { id: "6", title: "👤 Mon profil" },
            { id: "7", title: "🏢 Mon entreprise" },
            { id: "8", title: "⚙️ Mon compte" }
        ]
    }];

    return sendWhatsAppList(
        phone,
        `Bonjour ${business.name} 👋\n\nQue voulez-vous faire ?`,
        "Choisir",
        sections,
        'Tapez "menu" à tout moment pour revenir ici.'
    );
}

/**
 * Traite le choix de l'utilisateur au menu principal (1 à 8).
 */
export async function handleMenuSelection(phone, text, business, user) {

    const choice = (text || "").trim();

    switch (choice) {

        case "1": {

            const products = await getProductsByBusiness(business.id);

            if (!products.length) {
                await resetToMenu(phone);
                return sendWhatsAppMessage(
                    phone,
                    "❌ Vous n'avez encore aucun produit en stock.\n\nAllez d'abord dans *2️⃣ Gérer le stock* pour en ajouter."
                );
            }

            await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, { items: [] });

            return sendWhatsAppMessage(phone, buildProductListMessage(products, "🛒 Nouvelle vente"));
        }

        case "2": {
            const { showStockMenu } = await import("./stockHandler.js");
            return showStockMenu(phone, business);
        }

        case "3": {
            const { showDebtMenu } = await import("./debtHandler.js");
            return showDebtMenu(phone, business);
        }

        case "4": {
            const { showAnalysisMenu } = await import("./aiAnalysisHandler.js");
            return showAnalysisMenu(phone, business);
        }

        case "5": {
            const { showOrderMenu } = await import("./orderHandler.js");
            return showOrderMenu(phone, business);
        }

        case "6": {
            const { showProfileMenu } = await import("./profileHandler.js");
            return showProfileMenu(phone, business, user);
        }

        case "7": {
            const { showCompanyMenu } = await import("./businessHandler.js");
            return showCompanyMenu(phone, business, user);
        }

        case "8": {
            const { showAccountMenu } = await import("./accountHandler.js");
            return showAccountMenu(phone, business, user);
        }

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
