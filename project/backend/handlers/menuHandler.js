import { sendWhatsAppMessage, sendWhatsAppList } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness } from "../services/productService.js";
import { getCustomersByBusiness } from "../services/customerService.js";
import { detectIntent } from "../services/intentService.js";
import { STEPS } from "../utils/steps.js";
import { MAIN_MENU_ITEMS } from "../utils/mainMenuItems.js";

/**
 * Affiche le menu principal sous forme de liste WhatsApp interactive.
 */
export async function showMainMenu(phone, business) {

    const sections = [{
        title: "Menu principal",
        rows: MAIN_MENU_ITEMS
    }];

    return sendWhatsAppList(
        phone,
        `Bonjour ${business.name} 👋\n\nQue voulez-vous faire ? Vous pouvez aussi m'écrire ou m'envoyer un *message vocal* à tout moment, où que vous soyez dans l'application — ex. "je veux vendre 5 sacs de riz", "montre-moi mon inventaire", "modifie le prix du riz à 600".`,
        "Choisir",
        sections,
        null,
        { skipMenuFooter: true }
    );
}

/**
 * Traite le choix de l'utilisateur au menu principal (1 à 8), ou tente de comprendre
 * un message libre via l'IA avant d'abandonner et de réafficher le menu.
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

            return handleFreeTextMessage(phone, choice, business, user);
    }
}

/**
 * Exécute une intention déjà détectée par l'IA, quelle que soit la rubrique où se
 * trouve l'utilisateur. C'est le "routeur central" partagé entre :
 * - le menu principal (texte libre qui ne correspond à aucun choix 1-8)
 * - l'interception universelle dans messageHandler.js (texte libre depuis N'IMPORTE
 *   QUELLE autre étape de l'application)
 *
 * Retourne true si une action a effectivement été déclenchée (l'appelant ne doit
 * alors rien faire de plus), false sinon (l'appelant doit retomber sur son propre
 * comportement par défaut — menu principal ou poursuite du flow scénarisé en cours).
 *
 * Aucune intention ne provoque jamais une écriture destructive/irréversible sans
 * passer par un écran de récap + confirmation oui/non (voir chaque handler concerné).
 */
export async function dispatchIntent(phone, business, user, intentResult, context) {

    if (!intentResult || intentResult.intent === "UNKNOWN") {
        return false;
    }

    const { products = [], customers = [] } = context;

    switch (intentResult.intent) {

        case "NEW_SALE": {
            if (!intentResult.items.length) return false;
            const { startSaleFromAiItems } = await import("./saleHandler.js");
            await startSaleFromAiItems(phone, business, intentResult.items, products);
            return true;
        }

        case "ADD_STOCK": {
            if (!intentResult.items.length) return false;
            const { startBulkAddFromAiItems } = await import("./stockHandler.js");
            await startBulkAddFromAiItems(phone, business, intentResult.items, products);
            return true;
        }

        case "EDIT_PRODUCT": {
            if (!intentResult.items.length) return false;
            const { startEditProductFromAi } = await import("./stockHandler.js");
            await startEditProductFromAi(phone, business, intentResult.items[0], products);
            return true;
        }

        case "DELETE_PRODUCTS": {
            if (!intentResult.items.length) return false;
            const { startBulkDelete } = await import("./bulkDeleteHandler.js");
            await startBulkDelete(phone, business, "products", intentResult.items, { products });
            return true;
        }

        case "LIST_INVENTORY": {
            const { showStockMenu } = await import("./stockHandler.js");
            await showStockMenu(phone, business);
            return true;
        }

        case "DELETE_CUSTOMERS": {
            if (!intentResult.items.length) return false;
            const { startBulkDelete } = await import("./bulkDeleteHandler.js");
            await startBulkDelete(phone, business, "customers", intentResult.items, { customers });
            return true;
        }

        case "PAY_DEBT": {
            if (!intentResult.items.length) return false;
            const { startPayDebtFromAi } = await import("./debtHandler.js");
            await startPayDebtFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "LIST_DEBTS": {
            const { showDebtMenu } = await import("./debtHandler.js");
            await showDebtMenu(phone, business);
            return true;
        }

        case "LIST_ORDERS": {
            const { showOrderMenu } = await import("./orderHandler.js");
            await showOrderMenu(phone, business);
            return true;
        }

        case "DELETE_SALES": {
            if (!intentResult.items.length) return false;
            const { startBulkDelete } = await import("./bulkDeleteHandler.js");
            await startBulkDelete(phone, business, "sales", intentResult.items, {});
            return true;
        }

        case "ANALYSIS_QUESTION": {
            const { startAnalysisFromAi } = await import("./aiAnalysisHandler.js");
            const question = intentResult.items[0]?.question || "";
            await startAnalysisFromAi(phone, business, question);
            return true;
        }

        case "SHOW_REVENUE": {
            const { showRevenueFromAi } = await import("./businessHandler.js");
            await showRevenueFromAi(phone, business, user);
            return true;
        }

        case "LIST_ACTIVITY_LOG": {
            const { showActivityLogFromAi } = await import("./businessHandler.js");
            await showActivityLogFromAi(phone, business, user);
            return true;
        }

        case "EDIT_PROFILE_NAME": {
            const { startEditProfileNameFromAi } = await import("./profileHandler.js");
            await startEditProfileNameFromAi(phone, business, user, intentResult.items[0]?.value);
            return true;
        }

        case "EDIT_BUSINESS": {
            if (!intentResult.items.length) return false;
            const { startEditBusinessFromAi } = await import("./businessHandler.js");
            await startEditBusinessFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "DELETE_ACCOUNT": {
            const { startAccountDeleteFromAi } = await import("./accountHandler.js");
            await startAccountDeleteFromAi(phone, business, user);
            return true;
        }

        default:
            return false;
    }
}

/**
 * Le message ne correspond à aucun choix connu du menu : on tente de le faire
 * interpréter par l'IA via dispatchIntent. En cas d'échec ou d'intention non
 * reconnue, on retombe simplement sur le menu classique.
 */
async function handleFreeTextMessage(phone, text, business, user) {

    const [products, customers] = await Promise.all([
        getProductsByBusiness(business.id),
        getCustomersByBusiness(business.id)
    ]);

    const intentResult = await detectIntent(business, text, { products, customers });
    const handled = await dispatchIntent(phone, business, user, intentResult, { products, customers });

    if (!handled) {
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
