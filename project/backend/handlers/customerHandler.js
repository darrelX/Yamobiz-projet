import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { getCustomersByBusiness, getOrCreateCustomer, updateCustomer } from "../services/customerService.js";
import { matchCustomerByName } from "../utils/productMatcher.js";
import { t } from "../utils/i18n.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Point d'entrée "montre mes clients" détecté par l'IA depuis n'importe quelle
 * rubrique.
 */
export async function listCustomersFromAi(phone, business) {

    const customers = await getCustomersByBusiness(business.id);

    if (!customers.length) {
        await sendWhatsAppMessage(phone, t("customer.none"));
        return showMainMenu(phone, business);
    }

    const lines = customers.map(c => `• ${c.name}${c.phone ? ` — ${c.phone}` : ""}`);

    await sendWhatsAppMessage(phone, t("customer.listTitle", { list: lines.join("\n") }));

    return showMainMenu(phone, business);
}

/**
 * Point d'entrée "ajoute le client X" détecté par l'IA. Crée le client s'il
 * n'existe pas déjà (recherche insensible à la casse), sans confirmation
 * supplémentaire — une simple création de fiche n'est pas une action sensible.
 */
export async function createCustomerFromAi(phone, business, item) {

    if (!item.name || !String(item.name).trim()) {
        await sendWhatsAppMessage(phone, t("customer.nameRequired"));
        return showMainMenu(phone, business);
    }

    const customer = await getOrCreateCustomer(business.id, String(item.name).trim(), item.phone || null);

    if (!customer) {
        await sendWhatsAppMessage(phone, t("customer.createError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(
        phone,
        t("customer.created", { name: customer.name, phoneSuffix: customer.phone ? ` — ${customer.phone}` : "" })
    );

    return showMainMenu(phone, business);
}

/**
 * Point d'entrée "renomme le client X en Y" / "change le téléphone de X"
 * détecté par l'IA.
 */
export async function editCustomerFromAi(phone, business, item) {

    const customers = await getCustomersByBusiness(business.id);
    const match = matchCustomerByName(customers, item.customer_query);

    if (!match) {
        await sendWhatsAppMessage(phone, t("customer.notFound", { query: item.customer_query }));
        return showMainMenu(phone, business);
    }

    if (!item.value || !String(item.value).trim()) {
        await sendWhatsAppMessage(phone, t("customer.valueRequired"));
        return showMainMenu(phone, business);
    }

    const field = item.field === "phone" ? "phone" : "name";
    const updated = await updateCustomer(match.id, { [field]: String(item.value).trim() });

    if (!updated) {
        await sendWhatsAppMessage(phone, t("customer.updateError"));
        return showMainMenu(phone, business);
    }

    const label = field === "phone" ? t("customer.fieldPhone") : t("customer.fieldName");

    await sendWhatsAppMessage(
        phone,
        t("customer.updated", { label, name: updated.name, phoneSuffix: updated.phone ? ` — ${updated.phone}` : "" })
    );

    return showMainMenu(phone, business);
}
