import {
    sendWhatsAppMessage,
    sendWhatsAppList,
    sendWhatsAppButtons,
    downloadWhatsAppMedia
} from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import {
    updateBusiness,
    createBusiness,
    getBusinessesByUserId,
    deleteBusiness
} from "../services/businessService.js";
import { updateUser } from "../services/userService.js";
import { saveBusinessLogo } from "../services/mediaService.js";
import { deleteProductsByBusiness } from "../services/productService.js";
import { deleteSalesByBusiness, getTotalRevenue } from "../services/saleService.js";
import { deleteDebtsByBusiness } from "../services/debtService.js";
import { deleteCustomersByBusiness } from "../services/customerService.js";
import { deleteInvoicesByBusiness } from "../services/invoiceService.js";
import { getRecentActivityLogs } from "../services/loggerService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, formatDateTime } from "../utils/format.js";
import { showMainMenu } from "./menuHandler.js";

const SKIP_WORDS = ["passer", "plus tard", "skip", "non", "aucun"];

export async function showCompanyMenu(phone, business, user) {

    await updateConversation(phone, STEPS.COMPANY_MENU, {});

    const businesses = await getBusinessesByUserId(user.id);

    const rows = [
        { id: "1", title: "✏️ Modifier le nom" },
        { id: "2", title: "✏️ Modifier la ville" },
        { id: "3", title: "✏️ Modifier le secteur" },
        { id: "4", title: "🖼️ Modifier le logo" },
        { id: "5", title: "➕ Ajouter une entreprise" }
    ];

    if (businesses.length > 1) {
        rows.push({ id: "6", title: "🔀 Changer d'entreprise" });
        rows.push({ id: "7", title: "🗑️ Supprimer cette entreprise" });
    }

    rows.push({ id: "revenue", title: "💰 Chiffre d'affaires" });
    rows.push({ id: "activity_log", title: "📜 Journal d'activité" });
    rows.push({ id: "0", title: "⬅️ Retour au menu" });

    const sections = [{ title: "Entreprise", rows }];

    const multiInfo = businesses.length > 1 ? `\n\nVous gérez ${businesses.length} entreprises.` : "";

    return sendWhatsAppList(
        phone,
        `🏢 *${business.name}*\n\nVille : ${business.city || "-"}\nSecteur : ${business.sector || "-"}\nLogo : ${business.logo_path ? "✅ défini" : "non défini"}${multiInfo}`,
        "Choisir",
        sections
    );
}

/**
 * Point d'entrée "modifier mon entreprise" détecté par l'IA depuis n'importe quelle
 * rubrique (ex: "change le nom de mon entreprise en Yamo Shop"). Si une valeur a été
 * comprise, on applique directement (comme le fait le flow manuel, sans confirmation
 * supplémentaire) ; sinon on redirige vers l'étape de saisie correspondante.
 */
export async function startEditBusinessFromAi(phone, business, item) {

    const fieldMap = {
        name: { key: "name", label: "nom de l'entreprise", step: STEPS.COMPANY_EDIT_NAME, prompt: "Nouveau nom de l'entreprise ?" },
        city: { key: "city", label: "ville", step: STEPS.COMPANY_EDIT_CITY, prompt: "Nouvelle ville ?" },
        sector: { key: "sector", label: "secteur d'activité", step: STEPS.COMPANY_EDIT_SECTOR, prompt: "Nouveau secteur d'activité ?" }
    };

    const config = fieldMap[item.field] || fieldMap.name;

    if (item.value && String(item.value).trim()) {
        return applyCompanyUpdate(phone, business, { [config.key]: String(item.value).trim() }, config.label);
    }

    await updateConversation(phone, config.step, {});
    return sendWhatsAppMessage(phone, config.prompt);
}

/**
 * Point d'entrée "chiffre d'affaires" / "journal d'activité" détecté par l'IA depuis
 * n'importe quelle rubrique. Affiche directement le résultat puis revient à la
 * rubrique Entreprise (comme le fait le flow manuel).
 */
export async function showRevenueFromAi(phone, business, user) {
    await showRevenue(phone, business, user);
}

export async function showActivityLogFromAi(phone, business, user) {
    await showActivityLog(phone, business, user);
}

export async function handleBusiness(phone, text, conversation, business, user, message) {

    switch (conversation.step) {

        case STEPS.COMPANY_MENU:
            return handleCompanyMenuChoice(phone, text, business, user);

        case STEPS.COMPANY_EDIT_NAME:
            return applyCompanyUpdate(phone, business, { name: text?.trim() }, "nom de l'entreprise");

        case STEPS.COMPANY_EDIT_CITY:
            return applyCompanyUpdate(phone, business, { city: text?.trim() }, "ville");

        case STEPS.COMPANY_EDIT_SECTOR:
            return applyCompanyUpdate(phone, business, { sector: text?.trim() }, "secteur d'activité");

        case STEPS.COMPANY_EDIT_LOGO:
            return handleLogoUpload(phone, message, business);

        case STEPS.COMPANY_ADD_NAME:
            return handleAddBusinessName(phone, text, conversation, business);

        case STEPS.COMPANY_ADD_CITY:
            return handleAddBusinessCity(phone, text, conversation, business);

        case STEPS.COMPANY_ADD_LOGO:
            return handleAddBusinessLogo(phone, text, conversation, business, user, message);

        case STEPS.COMPANY_SWITCH:
            return handleCompanySwitch(phone, text, conversation, business, user);

        case STEPS.COMPANY_DELETE_CONFIRM:
            return handleCompanyDeleteConfirm(phone, text, business, user);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleCompanyMenuChoice(phone, text, business, user) {

    const choice = (text || "").trim();

    if (choice === "1") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_NAME, {});
        return sendWhatsAppMessage(phone, "Nouveau nom de l'entreprise ?");
    }

    if (choice === "2") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_CITY, {});
        return sendWhatsAppMessage(phone, "Nouvelle ville ?");
    }

    if (choice === "3") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_SECTOR, {});
        return sendWhatsAppMessage(phone, "Nouveau secteur d'activité ?");
    }

    if (choice === "4") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_LOGO, {});
        return sendWhatsAppMessage(phone, "📷 Envoyez directement la photo du logo de votre entreprise.");
    }

    if (choice === "5") {
        await updateConversation(phone, STEPS.COMPANY_ADD_NAME, {});
        return sendWhatsAppMessage(phone, "Quel est le nom de la nouvelle entreprise ?");
    }

    if (choice === "6") {

        const businesses = await getBusinessesByUserId(user.id);

        if (businesses.length <= 1) {
            await resetToMenu(phone);
            return showMainMenu(phone, business);
        }

        await updateConversation(phone, STEPS.COMPANY_SWITCH, { businessIds: businesses.map(b => b.id) });

        const lines = businesses.map((b, i) => `${i + 1}. ${b.name}${b.id === business.id ? " (actuelle)" : ""}`);

        return sendWhatsAppMessage(
            phone,
            `🔀 *Choisissez l'entreprise active*\n\n${lines.join("\n")}\n\nEntrez le numéro, ou 0 pour annuler.`
        );
    }

    if (choice === "7") {

        const businesses = await getBusinessesByUserId(user.id);

        if (businesses.length <= 1) {
            await resetToMenu(phone);
            await sendWhatsAppMessage(
                phone,
                '❌ Vous ne pouvez pas supprimer votre unique entreprise ici. Utilisez plutôt "⚙️ Mon compte" pour supprimer tout votre compte.'
            );
            return showMainMenu(phone, business);
        }

        await updateConversation(phone, STEPS.COMPANY_DELETE_CONFIRM, {});

        return sendWhatsAppButtons(
            phone,
            `⚠️ Confirmez-vous la suppression définitive de "${business.name}" et de toutes ses données (stock, commandes, créances, clients) ?`,
            [
                { id: "confirm_delete", title: "✅ Oui, supprimer" },
                { id: "menu", title: "❌ Annuler" }
            ]
        );
    }

    if (choice === "revenue") {
        return showRevenue(phone, business, user);
    }

    if (choice === "activity_log") {
        return showActivityLog(phone, business, user);
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

/**
 * Sous-rubrique "Chiffre d'affaires" : cumul de toutes les ventes de l'entreprise,
 * depuis toujours (pas seulement le mois en cours, contrairement au résumé rapide
 * de la rubrique Analyse).
 */
async function showRevenue(phone, business, user) {

    const total = await getTotalRevenue(business.id);

    await sendWhatsAppMessage(
        phone,
        `💰 *Chiffre d'affaires — ${business.name}*\n\nCumul de toutes vos ventes depuis toujours : ${formatFCFA(total)}`
    );

    return showCompanyMenu(phone, business, user);
}

const LOG_TYPE_LABELS = {
    vente: "🛒 Vente",
    stock_ajout: "📦 Ajout stock",
    stock_retrait: "📉 Retrait stock"
};

/**
 * Sous-rubrique "Journal d'activité" : historique horodaté des ventes et des
 * mouvements de stock (ajouts/retraits), les plus récents en premier.
 */
async function showActivityLog(phone, business, user) {

    const logs = await getRecentActivityLogs(business.id, 20);

    if (!logs.length) {
        await sendWhatsAppMessage(phone, "📜 Aucune activité enregistrée pour le moment.");
        return showCompanyMenu(phone, business, user);
    }

    const lines = logs.map(l => {
        const label = LOG_TYPE_LABELS[l.type] || l.type;
        return `• ${formatDateTime(l.created_at)} — ${label} : ${l.message}`;
    });

    await sendWhatsAppMessage(
        phone,
        `📜 *Journal d'activité — ${business.name}*\n\n${lines.join("\n")}`
    );

    return showCompanyMenu(phone, business, user);
}

async function applyCompanyUpdate(phone, business, values, label) {

    const value = Object.values(values)[0];

    if (!value) {
        return sendWhatsAppMessage(phone, `❌ Merci d'indiquer un(e) ${label} valide.`);
    }

    const updated = await updateBusiness(business.id, values);

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, `❌ Erreur lors de la mise à jour du ${label}.`);
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, `✅ ${label.charAt(0).toUpperCase() + label.slice(1)} mis à jour.`);
    return showMainMenu(phone, updated);
}

async function handleLogoUpload(phone, message, business) {

    if (!message || message.type !== "image" || !message.raw?.image?.id) {
        return sendWhatsAppMessage(
            phone,
            '❌ Merci d\'envoyer directement une image (photo) pour le logo, ou tapez "menu" pour annuler.'
        );
    }

    const media = await downloadWhatsAppMedia(message.raw.image.id);

    if (!media) {
        return sendWhatsAppMessage(phone, "❌ Erreur lors du téléchargement de l'image. Réessayez.");
    }

    const ext = media.mimeType.includes("png") ? "png" : "jpg";
    const logoPath = await saveBusinessLogo(business.id, media.buffer, ext);
    const updated = await updateBusiness(business.id, { logo_path: logoPath });

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, "❌ Erreur lors de l'enregistrement du logo.");
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, "✅ Logo mis à jour ! Il apparaîtra désormais sur vos factures et vos rapports d'analyse.");
    return showMainMenu(phone, updated);
}

async function handleAddBusinessName(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un nom valide.");
    }

    await updateConversation(phone, STEPS.COMPANY_ADD_CITY, {
        businessName: text.trim()
    });

    return sendWhatsAppMessage(phone, "Dans quelle ville se trouve cette entreprise ?");
}

async function handleAddBusinessCity(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer une ville.");
    }

    await updateConversation(phone, STEPS.COMPANY_ADD_LOGO, {
        ...conversation.data,
        city: text.trim()
    });

    return sendWhatsAppMessage(
        phone,
        '📷 Envoyez la photo du logo de cette entreprise, ou écrivez "passer" pour continuer sans logo pour le moment.'
    );
}

/**
 * Dernière étape de l'ajout d'une (nouvelle) entreprise : capture facultative du
 * logo, puis création. Même logique que l'inscription initiale — le secteur
 * d'activité n'est plus demandé à la création (il reste modifiable ensuite depuis
 * le menu Entreprise si besoin).
 */
async function handleAddBusinessLogo(phone, text, conversation, business, user, message) {

    const wantsSkip = SKIP_WORDS.includes((text || "").trim().toLowerCase());

    let logoBuffer = null;
    let logoExt = null;

    if (!wantsSkip) {

        if (message?.type === "image" && message.raw?.image?.id) {

            const media = await downloadWhatsAppMedia(message.raw.image.id);

            if (media) {
                logoBuffer = media.buffer;
                logoExt = media.mimeType.includes("png") ? "png" : "jpg";
            }

        } else {
            return sendWhatsAppMessage(
                phone,
                '📷 Envoyez directement la photo du logo, ou écrivez "passer" pour continuer sans logo pour le moment.'
            );
        }
    }

    const newBusiness = await createBusiness(user.id, {
        businessName: conversation.data.businessName,
        city: conversation.data.city,
        sector: null,
        phone
    });

    if (!newBusiness) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "❌ Impossible de créer cette entreprise. Réessayez.");
        return showMainMenu(phone, business);
    }

    let finalBusiness = newBusiness;

    if (logoBuffer) {
        const logoPath = await saveBusinessLogo(newBusiness.id, logoBuffer, logoExt);
        const updated = await updateBusiness(newBusiness.id, { logo_path: logoPath });
        finalBusiness = updated || newBusiness;
    }

    await updateUser(user.id, { active_business_id: newBusiness.id });
    await resetToMenu(phone);

    await sendWhatsAppMessage(
        phone,
        `🎉 Entreprise "${finalBusiness.name}" créée et activée !\n\n_Changez d'entreprise active à tout moment depuis "🏢 Mon entreprise"._`
    );

    return showMainMenu(phone, finalBusiness);
}

async function handleCompanySwitch(phone, text, conversation, business, user) {

    const choice = (text || "").trim();

    if (choice === "0") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    const index = parseInt(choice, 10) - 1;
    const businessIds = conversation.data.businessIds || [];

    if (isNaN(index) || !businessIds[index]) {
        return sendWhatsAppMessage(phone, "❌ Choix invalide. Entrez le numéro d'une entreprise, ou 0 pour annuler.");
    }

    const newActiveId = businessIds[index];
    await updateUser(user.id, { active_business_id: newActiveId });

    const businesses = await getBusinessesByUserId(user.id);
    const newActive = businesses.find(b => b.id === newActiveId) || business;

    await resetToMenu(phone);
    await sendWhatsAppMessage(phone, `✅ Entreprise active : *${newActive.name}*`);
    return showMainMenu(phone, newActive);
}

async function handleCompanyDeleteConfirm(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice !== "confirm_delete" && !["oui", "o", "yes", "1"].includes(choice)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "Suppression annulée.");
        return showMainMenu(phone, business);
    }

    await deleteDebtsByBusiness(business.id);
    await deleteInvoicesByBusiness(business.id);
    await deleteSalesByBusiness(business.id);
    await deleteProductsByBusiness(business.id);
    await deleteCustomersByBusiness(business.id);
    await deleteBusiness(business.id);

    const remaining = await getBusinessesByUserId(user.id);
    const nextActive = remaining[0] || null;

    await updateUser(user.id, { active_business_id: nextActive?.id ?? null });
    await resetToMenu(phone);

    await sendWhatsAppMessage(phone, "✅ Entreprise supprimée.");

    if (nextActive) {
        return showMainMenu(phone, nextActive);
    }

    return sendWhatsAppMessage(phone, "Vous n'avez plus aucune entreprise. Écrivez-moi n'importe quoi pour en créer une nouvelle 👋");
}
