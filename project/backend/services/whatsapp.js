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

/**
 * Envoie un message texte simple.
 */
export async function sendWhatsAppMessage(phone, message) {
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

        return response.data;

    } catch (error) {
        logWhatsAppError("texte", error);
        return null;
    }
}

/**
 * Envoie jusqu'à 3 boutons de réponse rapide ("Reply Buttons").
 * buttons: [{ id: string, title: string }] — title limité à 20 caractères par l'API.
 */
export async function sendWhatsAppButtons(phone, bodyText, buttons, footer = null) {
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

        return response.data;

    } catch (error) {
        logWhatsAppError("boutons", error);
        return null;
    }
}

/**
 * Envoie une liste déroulante ("List Message"), utile au-delà de 3 options.
 * sections: [{ title: string, rows: [{ id, title, description? }] }] — max 10 lignes au total.
 */
export async function sendWhatsAppList(phone, bodyText, buttonText, sections, footer = null) {
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

        return response.data;

    } catch (error) {
        logWhatsAppError("liste", error);
        return null;
    }
}

/**
 * Envoie un document (ex: facture PDF) depuis un fichier local.
 * 1) Upload du fichier vers Meta pour obtenir un media_id
 * 2) Envoi du message "document" référençant ce media_id
 */
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

/**
 * Upload un fichier local vers l'API WhatsApp et retourne le media_id.
 */
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

/**
 * Télécharge un média envoyé par l'utilisateur (ex: photo du logo).
 * 1) Récupère l'URL temporaire + le type MIME depuis Meta
 * 2) Télécharge le contenu binaire
 * Retourne { buffer, mimeType } ou null en cas d'échec.
 */
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
