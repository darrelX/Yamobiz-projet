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
import { deleteSalesByBusiness, getTotalRevenue, getCashBalance } from "../services/saleService.js";
import { deleteDebtsByBusiness } from "../services/debtService.js";
import { deleteCustomersByBusiness } from "../services/customerService.js";
import { deleteInvoicesByBusiness } from "../services/invoiceService.js";
import { getRecentActivityLogs } from "../services/loggerService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { showMainMenu } from "./menuHandler.js";

const SKIP_WORDS = ["passer", "plus tard", "skip", "non", "aucun", "later", "no", "none"];

export async function showCompanyMenu(phone, business, user) {

    await updateConversation(phone, STEPS.COMPANY_MENU, {});

    const businesses = await getBusinessesByUserId(user.id);

    const rows = [
        { id: "1", title: t("business.actionEditName") },
        { id: "2", title: t("business.actionEditCity") },
        { id: "3", title: t("business.actionEditSector") },
        { id: "4", title: t("business.actionEditLogo") },
        { id: "5", title: t("business.actionAdd") }
    ];

    if (businesses.length > 1) {
        rows.push({ id: "6", title: t("business.actionSwitch") });
        rows.push({ id: "7", title: t("business.actionDelete") });
    }

    rows.push({ id: "finances", title: t("business.actionFinances") });
    rows.push({ id: "activity_log", title: t("business.actionActivityLog") });
    rows.push({ id: "0", title: t("common.backToMenuButton") });

    const sections = [{ title: t("business.menuTitle"), rows }];

    const multiInfo = businesses.length > 1 ? t("business.multiInfo", { count: businesses.length }) : "";

    return sendWhatsAppList(
        phone,
        t("business.menuBody", {
            name: business.name,
            city: business.city || "-",
            sector: business.sector || "-",
            logoStatus: business.logo_path ? t("business.logoSet") : t("business.logoNotSet"),
            multiInfo
        }),
        t("common.chooseButton"),
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
        name: { key: "name", label: t("business.fieldName"), step: STEPS.COMPANY_EDIT_NAME, prompt: t("business.askNewName") },
        city: { key: "city", label: t("business.fieldCity"), step: STEPS.COMPANY_EDIT_CITY, prompt: t("business.askNewCity") },
        sector: { key: "sector", label: t("business.fieldSector"), step: STEPS.COMPANY_EDIT_SECTOR, prompt: t("business.askNewSector") }
    };

    const config = fieldMap[item.field] || fieldMap.name;

    if (item.value && String(item.value).trim()) {
        return applyCompanyUpdate(phone, business, { [config.key]: String(item.value).trim() }, config.label);
    }

    await updateConversation(phone, config.step, {});
    return sendWhatsAppMessage(phone, config.prompt);
}

/**
 * Point d'entrée "finances" (chiffre d'affaires + caisse), "journal d'activité",
 * "changer/ajouter/lister mes entreprises" détectés par l'IA depuis n'importe quelle
 * rubrique. Affiche/agit directement puis revient à la rubrique Entreprise ou au
 * menu, comme le fait déjà le flow manuel correspondant.
 */
export async function showFinancesFromAi(phone, business, user) {
    await showFinances(phone, business, user);
}

export async function showActivityLogFromAi(phone, business, user) {
    await showActivityLog(phone, business, user);
}

export async function switchBusinessFromAi(phone, user, businessQuery) {

    const businesses = await getBusinessesByUserId(user.id);

    if (businesses.length <= 1) {
        return sendWhatsAppMessage(phone, t("business.onlyOne"));
    }

    const match = businesses.find(b =>
        b.name.toLowerCase().includes(String(businessQuery || "").toLowerCase().trim())
    );

    if (!match) {
        const names = businesses.map(b => `• ${b.name}`).join("\n");
        return sendWhatsAppMessage(phone, t("business.switchNotFound", { query: businessQuery, list: names }));
    }

    await updateUser(user.id, { active_business_id: match.id });

    return sendWhatsAppMessage(phone, t("business.switchDone", { name: match.name }));
}

export async function addBusinessFromAi(phone) {
    await updateConversation(phone, STEPS.COMPANY_ADD_NAME, {});
    return sendWhatsAppMessage(phone, t("business.askNewBusinessName"));
}

export async function listBusinessesFromAi(phone, business, user) {

    const businesses = await getBusinessesByUserId(user.id);

    const lines = businesses.map(b => `• ${b.name}${b.id === business.id ? ` ${t("business.activeSuffix")}` : ""}`);

    return sendWhatsAppMessage(phone, t("business.listTitle", { list: lines.join("\n") }));
}

export async function handleBusiness(phone, text, conversation, business, user, message) {

    switch (conversation.step) {

        case STEPS.COMPANY_MENU:
            return handleCompanyMenuChoice(phone, text, business, user);

        case STEPS.COMPANY_EDIT_NAME:
            return applyCompanyUpdate(phone, business, { name: text?.trim() }, t("business.fieldName"));

        case STEPS.COMPANY_EDIT_CITY:
            return applyCompanyUpdate(phone, business, { city: text?.trim() }, t("business.fieldCity"));

        case STEPS.COMPANY_EDIT_SECTOR:
            return applyCompanyUpdate(phone, business, { sector: text?.trim() }, t("business.fieldSector"));

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
        return sendWhatsAppMessage(phone, t("business.askNewName"));
    }

    if (choice === "2") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_CITY, {});
        return sendWhatsAppMessage(phone, t("business.askNewCity"));
    }

    if (choice === "3") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_SECTOR, {});
        return sendWhatsAppMessage(phone, t("business.askNewSector"));
    }

    if (choice === "4") {
        await updateConversation(phone, STEPS.COMPANY_EDIT_LOGO, {});
        return sendWhatsAppMessage(phone, t("business.askLogoPhoto"));
    }

    if (choice === "5") {
        await updateConversation(phone, STEPS.COMPANY_ADD_NAME, {});
        return sendWhatsAppMessage(phone, t("business.askNewBusinessName"));
    }

    if (choice === "6") {

        const businesses = await getBusinessesByUserId(user.id);

        if (businesses.length <= 1) {
            await resetToMenu(phone);
            return showMainMenu(phone, business);
        }

        await updateConversation(phone, STEPS.COMPANY_SWITCH, { businessIds: businesses.map(b => b.id) });

        const lines = businesses.map((b, i) => `${i + 1}. ${b.name}${b.id === business.id ? ` ${t("business.currentSuffix")}` : ""}`);

        return sendWhatsAppMessage(phone, t("business.switchPrompt", { list: lines.join("\n") }));
    }

    if (choice === "7") {

        const businesses = await getBusinessesByUserId(user.id);

        if (businesses.length <= 1) {
            await resetToMenu(phone);
            await sendWhatsAppMessage(phone, t("business.cannotDeleteOnly"));
            return showMainMenu(phone, business);
        }

        await updateConversation(phone, STEPS.COMPANY_DELETE_CONFIRM, {});

        return sendWhatsAppButtons(
            phone,
            t("business.deleteConfirmQuestion", { name: business.name }),
            [
                { id: "confirm_delete", title: t("common.yesDeleteButton") },
                { id: "menu", title: t("common.cancelButton") }
            ]
        );
    }

    if (choice === "finances") {
        return showFinances(phone, business, user);
    }

    if (choice === "activity_log") {
        return showActivityLog(phone, business, user);
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

/**
 * Sous-rubrique "Finances" : chiffre d'affaires cumulé (toutes ventes, comptant et
 * crédit confondus) ET montant actuellement en caisse (ventes comptant uniquement —
 * l'argent réellement en main, contrairement au crédit pas encore encaissé).
 */
async function showFinances(phone, business, user) {

    const [totalRevenue, cashBalance] = await Promise.all([
        getTotalRevenue(business.id),
        getCashBalance(business.id)
    ]);

    await sendWhatsAppMessage(
        phone,
        t("business.financesBody", {
            name: business.name,
            revenue: formatFCFA(totalRevenue),
            cash: formatFCFA(cashBalance)
        })
    );

    return showCompanyMenu(phone, business, user);
}

const LOG_TYPE_KEYS = {
    vente: "business.logTypeSale",
    stock_ajout: "business.logTypeStockAdd",
    stock_retrait: "business.logTypeStockRemove"
};

/**
 * Sous-rubrique "Journal d'activité" : historique horodaté des ventes et des
 * mouvements de stock (ajouts/retraits), les plus récents en premier.
 */
async function showActivityLog(phone, business, user) {

    const logs = await getRecentActivityLogs(business.id, 20);

    if (!logs.length) {
        await sendWhatsAppMessage(phone, t("business.noActivity"));
        return showCompanyMenu(phone, business, user);
    }

    const lines = logs.map(l => {
        const label = t(LOG_TYPE_KEYS[l.type] || l.type);
        return `• ${formatDateTime(l.created_at)} — ${label} : ${l.message}`;
    });

    await sendWhatsAppMessage(phone, t("business.activityLogTitle", { name: business.name, list: lines.join("\n") }));

    return showCompanyMenu(phone, business, user);
}

async function applyCompanyUpdate(phone, business, values, label) {

    const value = Object.values(values)[0];

    if (!value) {
        return sendWhatsAppMessage(phone, t("business.fieldRequired", { label }));
    }

    const updated = await updateBusiness(business.id, values);

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, t("business.fieldUpdateError", { label }));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("business.fieldUpdated", { label }));
    return showMainMenu(phone, updated);
}

async function handleLogoUpload(phone, message, business) {

    if (!message || message.type !== "image" || !message.raw?.image?.id) {
        return sendWhatsAppMessage(phone, t("business.logoUploadRequired"));
    }

    const media = await downloadWhatsAppMedia(message.raw.image.id);

    if (!media) {
        return sendWhatsAppMessage(phone, t("business.logoDownloadError"));
    }

    const ext = media.mimeType.includes("png") ? "png" : "jpg";
    const logoPath = await saveBusinessLogo(business.id, media.buffer, ext);
    const updated = await updateBusiness(business.id, { logo_path: logoPath });

    await resetToMenu(phone);

    if (!updated) {
        await sendWhatsAppMessage(phone, t("business.logoSaveError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(phone, t("business.logoUpdated"));
    return showMainMenu(phone, updated);
}

async function handleAddBusinessName(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("business.nameRequired"));
    }

    await updateConversation(phone, STEPS.COMPANY_ADD_CITY, {
        businessName: text.trim()
    });

    return sendWhatsAppMessage(phone, t("business.askNewBusinessCity"));
}

async function handleAddBusinessCity(phone, text, conversation) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("business.cityRequired"));
    }

    await updateConversation(phone, STEPS.COMPANY_ADD_LOGO, {
        ...conversation.data,
        city: text.trim()
    });

    return sendWhatsAppMessage(phone, t("business.askNewBusinessLogo"));
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
            return sendWhatsAppMessage(phone, t("business.askNewBusinessLogo"));
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
        await sendWhatsAppMessage(phone, t("business.createError"));
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

    await sendWhatsAppMessage(phone, t("business.created", { name: finalBusiness.name }));

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
        return sendWhatsAppMessage(phone, t("business.switchInvalidChoice"));
    }

    const newActiveId = businessIds[index];
    await updateUser(user.id, { active_business_id: newActiveId });

    const businesses = await getBusinessesByUserId(user.id);
    const newActive = businesses.find(b => b.id === newActiveId) || business;

    await resetToMenu(phone);
    await sendWhatsAppMessage(phone, t("business.switchDone", { name: newActive.name }));
    return showMainMenu(phone, newActive);
}

async function handleCompanyDeleteConfirm(phone, text, business, user) {

    const choice = (text || "").trim().toLowerCase();

    if (choice !== "confirm_delete" && !["oui", "o", "yes", "1"].includes(choice)) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("business.deleteCancelled"));
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

    await sendWhatsAppMessage(phone, t("business.deleted"));

    if (nextActive) {
        return showMainMenu(phone, nextActive);
    }

    return sendWhatsAppMessage(phone, t("business.noneLeft"));
}
