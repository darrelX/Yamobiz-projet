import axios from "axios";
import fs from "fs";
import FormData from "form-data";

import {
    WHATSAPP_TOKEN,
    WHATSAPP_BASE_URL,
    WHATSAPP_API_VERSION
} from "../config/whatsapp.js";
import { MAIN_MENU_ITEMS } from "../utils/mainMenuItems.js";
import { t } from "../utils/i18n.js";

const authHeaders = {
    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    "Content-Type": "application/json"
};

// Préfixe utilisé pour les ids du menu "raccourci" omniprésent, afin de ne jamais
// être confondu avec un simple chiffre "1".."8" attendu par un autre écran
// (ex: une quantité, un numéro de créance...). messageHandler.js reconnaît ce
// préfixe et route directement vers l'option correspondante du menu principal.
export const QUICK_MENU_PREFIX = "qm_";

/**
 * Envoie le bouton "Choisir" omniprésent, accroché après (quasi) chaque réponse du
 * bot : il ouvre directement la même liste d'options que le menu principal, en un
 * seul tap, depuis N'IMPORTE QUEL écran de l'application. Les libellés viennent de
 * t() (fichiers de langue préchargés), donc déjà dans la langue de l'utilisateur.
 */
async function sendMenuShortcut(phone) {
    try {

        const sections = [{
            title: t("common.mainMenuTitle"),
            rows: MAIN_MENU_ITEMS.map(item => ({
                id: `${QUICK_MENU_PREFIX}${item.id}`,
                title: t(item.titleKey)
            }))
        }];

        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "interactive",
            interactive: {
                type: "list",
                body: { text: t("common.quickAccessBody") },
                action: {
                    button: t("common.chooseButton"),
                    sections
                }
            }
        };

        await axios.post(`${WHATSAPP_BASE_URL}/messages`, payload, { headers: authHeaders });

    } catch (error) {
        logWhatsAppError("bouton menu", error);
    }
}

export async function sendWhatsAppMessage(phone, message, { skipMenuFooter = false } = {}) {
    try {

        console.log("📤 Envoi WhatsApp (texte) →", phone);

        const response = await axios.post(
            `${WHATSAPP_BASE_URL}/messages`,
            {
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: message }
            },
            { headers: authHeaders }
        );

        if (!skipMenuFooter) {
            await sendMenuShortcut(phone);
        }

        return response.data;

    } catch (error) {
        logWhatsAppError("texte", error);
        return null;
    }
}

export async function sendWhatsAppButtons(phone, bodyText, buttons, footer = null, { skipMenuFooter = false } = {}) {
    try {

        console.log("📤 Envoi WhatsApp (boutons) →", phone);

        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: bodyText },
                action: {
                    buttons: buttons.slice(0, 3).map(b => ({
                        type: "reply",
                        reply: { id: b.id, title: String(b.title).slice(0, 20) }
                    }))
                }
            }
        };

        if (footer) {
            payload.interactive.footer = { text: footer };
        }

        const response = await axios.post(`${WHATSAPP_BASE_URL}/messages`, payload, { headers: authHeaders });

        if (!skipMenuFooter) {
            await sendMenuShortcut(phone);
        }

        return response.data;

    } catch (error) {
        logWhatsAppError("boutons", error);
        return null;
    }
}

export async function sendWhatsAppList(phone, bodyText, buttonText, sections, footer = null, { skipMenuFooter = false } = {}) {
    try {

        console.log("📤 Envoi WhatsApp (liste) →", phone);

        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "interactive",
            interactive: {
                type: "list",
                body: { text: bodyText },
                action: {
                    button: String(buttonText).slice(0, 20),
                    sections
                }
            }
        };

        if (footer) {
            payload.interactive.footer = { text: footer };
        }

        const response = await axios.post(`${WHATSAPP_BASE_URL}/messages`, payload, { headers: authHeaders });

        if (!skipMenuFooter) {
            await sendMenuShortcut(phone);
        }

        return response.data;

    } catch (error) {
        logWhatsAppError("liste", error);
        return null;
    }
}

export async function sendWhatsAppDocument(phone, filePath, filename, caption = "") {
    try {

        console.log("📤 Envoi WhatsApp (document) →", phone, filePath);

        const mediaId = await uploadWhatsAppMedia(filePath);

        if (!mediaId) {
            console.log("❌ Upload média échoué, document non envoyé");
            return null;
        }

        const response = await axios.post(
            `${WHATSAPP_BASE_URL}/messages`,
            {
                messaging_product: "whatsapp",
                to: phone,
                type: "document",
                document: {
                    id: mediaId,
                    filename,
                    caption
                }
            },
            { headers: authHeaders }
        );

        return response.data;

    } catch (error) {
        logWhatsAppError("document", error);
        return null;
    }
}

async function uploadWhatsAppMedia(filePath) {
    try {

        const form = new FormData();
        form.append("messaging_product", "whatsapp");
        form.append("file", fs.createReadStream(filePath), {
            contentType: "application/pdf"
        });

        const response = await axios.post(
            `${WHATSAPP_BASE_URL}/media`,
            form,
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    ...form.getHeaders()
                }
            }
        );

        return response.data?.id ?? null;

    } catch (error) {
        logWhatsAppError("upload média", error);
        return null;
    }
}

export async function downloadWhatsAppMedia(mediaId) {
    try {

        console.log("📥 Téléchargement média WhatsApp →", mediaId);

        const metaResponse = await axios.get(
            `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${mediaId}`,
            { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
        );

        const mediaUrl = metaResponse.data?.url;
        const mimeType = metaResponse.data?.mime_type || "image/jpeg";

        if (!mediaUrl) {
            console.log("❌ URL média introuvable dans la réponse Meta");
            return null;
        }

        const fileResponse = await axios.get(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
            responseType: "arraybuffer"
        });

        return {
            buffer: Buffer.from(fileResponse.data),
            mimeType
        };

    } catch (error) {
        logWhatsAppError("téléchargement média", error);
        return null;
    }
}

function logWhatsAppError(context, error) {
    console.log(`❌ Erreur WhatsApp (${context})`);

    if (error.response) {
        console.log("Status :", error.response.status);
        console.log("Data :", error.response.data);
    } else {
        console.log(error.message);
    }
}
