import { sendWhatsAppMessage, sendWhatsAppList } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getProductsByBusiness } from "../services/productService.js";
import { getCustomersByBusiness } from "../services/customerService.js";
import { detectIntent } from "../services/intentService.js";
import { t } from "../utils/i18n.js";
import { STEPS } from "../utils/steps.js";
import { MAIN_MENU_ITEMS } from "../utils/mainMenuItems.js";

/**
 * Affiche le menu principal sous forme de liste WhatsApp interactive.
 */
export async function showMainMenu(phone, business) {

    const sections = [{
        title: t("common.mainMenuTitle"),
        rows: MAIN_MENU_ITEMS.map(item => ({ id: item.id, title: t(item.titleKey) }))
    }];

    return sendWhatsAppList(
        phone,
        t("menu.greeting", { businessName: business.name }),
        t("common.chooseButton"),
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
                return sendWhatsAppMessage(phone, t("menu.noProducts"));
            }

            await updateConversation(phone, STEPS.SALE_SELECT_PRODUCT, { items: [] });

            return sendWhatsAppMessage(phone, buildProductListMessage(products, t("sale.newSaleTitle")));
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

        case "LOW_STOCK_ALERT": {
            const { showLowStockFromAi } = await import("./stockHandler.js");
            await showLowStockFromAi(phone, business, intentResult.items[0]?.threshold);
            return true;
        }

        case "DELETE_CUSTOMERS": {
            if (!intentResult.items.length) return false;
            const { startBulkDelete } = await import("./bulkDeleteHandler.js");
            await startBulkDelete(phone, business, "customers", intentResult.items, { customers });
            return true;
        }

        case "LIST_CUSTOMERS": {
            const { listCustomersFromAi } = await import("./customerHandler.js");
            await listCustomersFromAi(phone, business);
            return true;
        }

        case "CREATE_CUSTOMER": {
            if (!intentResult.items.length) return false;
            const { createCustomerFromAi } = await import("./customerHandler.js");
            await createCustomerFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "EDIT_CUSTOMER": {
            if (!intentResult.items.length) return false;
            const { editCustomerFromAi } = await import("./customerHandler.js");
            await editCustomerFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "PAY_DEBT": {
            if (!intentResult.items.length) return false;
            const { startPayDebtFromAi } = await import("./debtHandler.js");
            await startPayDebtFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "FORGIVE_DEBT": {
            if (!intentResult.items.length) return false;
            const { forgiveDebtFromAi } = await import("./debtHandler.js");
            await forgiveDebtFromAi(phone, business, intentResult.items[0]);
            return true;
        }

        case "LIST_DEBTS": {
            const { showDebtMenu } = await import("./debtHandler.js");
            await showDebtMenu(phone, business);
            return true;
        }

        case "LIST_INVOICES": {
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

        case "CANCEL_LAST_SALE": {
            const { startCancelLastSaleFromAi } = await import("./orderHandler.js");
            await startCancelLastSaleFromAi(phone, business);
            return true;
        }

        case "ANALYSIS_QUESTION": {
            const { startAnalysisFromAi } = await import("./aiAnalysisHandler.js");
            const question = intentResult.items[0]?.question || "";
            await startAnalysisFromAi(phone, business, question);
            return true;
        }

        case "SHOW_FINANCES": {
            const { showFinancesFromAi } = await import("./businessHandler.js");
            await showFinancesFromAi(phone, business, user);
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

        case "SWITCH_BUSINESS": {
            if (!intentResult.items.length) return false;
            const { switchBusinessFromAi } = await import("./businessHandler.js");
            await switchBusinessFromAi(phone, user, intentResult.items[0]?.business_query);
            return true;
        }

        case "ADD_BUSINESS": {
            const { addBusinessFromAi } = await import("./businessHandler.js");
            await addBusinessFromAi(phone);
            return true;
        }

        case "LIST_BUSINESSES": {
            const { listBusinessesFromAi } = await import("./businessHandler.js");
            await listBusinessesFromAi(phone, business, user);
            return true;
        }

        case "HELP": {
            await sendWhatsAppMessage(phone, t("menu.help"));
            return true;
        }

        case "CHANGE_LANGUAGE": {
            const { changeLanguageFromAi } = await import("./accountHandler.js");
            await changeLanguageFromAi(phone, business, user, intentResult.items[0]?.language);
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
        `${i + 1}. ${p.name} — ${p.price} FCFA (${t("common.stockLabel")} : ${p.stock_quantity} ${p.unit})`
    );

    return `${title}\n\n${lines.join("\n")}\n\n${t("sale.chooseProductFooter")}`;
}

export function buildStockListMessage(products) {
    return products
        .map((p, i) => `${i + 1}. ${p.name} — ${p.stock_quantity} ${p.unit} (${p.price} FCFA)`)
        .join("\n");
}
