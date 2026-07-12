import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// NB: le nom des modèles Gemini évolue régulièrement — vérifier sur
// https://ai.google.dev/gemini-api/docs/models si ce modèle devient obsolète.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

if (!GEMINI_API_KEY) {
    console.log("⚠️  GEMINI_API_KEY manquant dans .env — l'analyse IA sera indisponible");
}

/**
 * Envoie un prompt texte à Gemini et retourne le texte généré (ou null en cas d'échec).
 */
export async function askGemini(prompt, { temperature = 0.2 } = {}) {

    if (!GEMINI_API_KEY) {
        console.log("❌ GEMINI_API_KEY manquant, appel Gemini annulé");
        return null;
    }

    try {

        const response = await axios.post(
            `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature }
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const text = response.data?.candidates?.[0]?.content?.parts
            ?.map(p => p.text)
            .filter(Boolean)
            .join("\n") ?? null;

        return text;

    } catch (error) {
        console.log("❌ Erreur appel Gemini :", error.response?.data || error.message);
        return null;
    }
}

/**
 * Envoie un prompt texte + un fichier audio (encodé en base64) à Gemini, qui accepte
 * l'audio nativement en entrée multimodale. Utilisé pour la transcription vocale :
 * pas besoin d'un service de speech-to-text séparé.
 */
export async function askGeminiWithAudio(prompt, audioBase64, mimeType, { temperature = 0.2 } = {}) {

    if (!GEMINI_API_KEY) {
        console.log("❌ GEMINI_API_KEY manquant, appel Gemini (audio) annulé");
        return null;
    }

    try {

        const response = await axios.post(
            `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: audioBase64 } }
                    ]
                }],
                generationConfig: { temperature }
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const text = response.data?.candidates?.[0]?.content?.parts
            ?.map(p => p.text)
            .filter(Boolean)
            .join("\n") ?? null;

        return text;

    } catch (error) {
        console.log("❌ Erreur appel Gemini (audio) :", error.response?.data || error.message);
        return null;
    }
}

/**
 * Transcrit un message vocal WhatsApp (buffer audio) en texte français.
 * Retourne null si Gemini n'est pas joignable ou ne renvoie rien d'exploitable.
 *
 * NB: WhatsApp envoie généralement des notes vocales au format "audio/ogg; codecs=opus".
 * On retire les paramètres après le ";" avant de transmettre le mime type à Gemini.
 */
export async function transcribeAudio(audioBuffer, mimeType = "audio/ogg") {

    const cleanMimeType = String(mimeType).split(";")[0].trim();
    const base64 = audioBuffer.toString("base64");

    const prompt = "Transcris fidèlement, en français, le contenu de ce message vocal. Réponds UNIQUEMENT avec le texte transcrit, sans aucun commentaire ni ponctuation de présentation autour.";

    const text = await askGeminiWithAudio(prompt, base64, cleanMimeType, { temperature: 0 });

    return text ? text.trim() : null;
}
