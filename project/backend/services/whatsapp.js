import axios from "axios";
import fs from "fs";
import FormData from "form-data";

import {
    WHATSAPP_TOKEN,
    WHATSAPP_BASE_URL,
    WHATSAPP_API_VERSION
} from "../config/whatsapp.js";

const authHeaders = {
    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    "Content-Type": "application/json"
};

const MENU_BUTTON_ID = "menu";
const MENU_BUTTON_TITLE = "🏠 Menu principal";

/**
 * Envoie un petit message-bouton "🏠 Menu principal", automatiquement accroché
 * après (quasi) chaque réponse du bot, pour que l'utilisateur puisse revenir au
 * menu principal en un tap depuis N'IMPORTE QUEL écran de l'application.
 */
async function sendMenuShortcut(phone) {
    try {

        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: "🏠" },
                action: {
                    buttons: [{ type: "reply", reply: { id: MENU_BUTTON_ID, title: MENU_BUTTON_TITLE } }]
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

        // Si "🏠 Menu principal" ne fait pas déjà partie des boutons affichés, on l'ajoute
        // en message de suivi, pour qu'il soit accessible même depuis un écran à boutons.
        const alreadyHasMenu = buttons.some(b => b.id === MENU_BUTTON_ID);

        if (!skipMenuFooter && !alreadyHasMenu) {
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
