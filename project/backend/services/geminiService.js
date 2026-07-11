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
 * Envoie un prompt à Gemini et retourne le texte généré (ou null en cas d'échec).
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
