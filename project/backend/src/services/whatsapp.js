import axios from "axios";
import fs from "fs";
import FormData from "form-data";

import {
    WHATSAPP_TOKEN,
    WHATSAPP_BASE_URL
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

function logWhatsAppError(context, error) {
    console.log(`❌ Erreur WhatsApp (${context})`);

    if (error.response) {
        console.log("Status :", error.response.status);
        console.log("Data :", error.response.data);
    } else {
        console.log(error.message);
    }
}
