// Synonymes reconnus comme "français" (langue source du code, donc aucune
// traduction nécessaire). Centralisé ici pour être partagé entre l'inscription,
// le changement de langue dans "Mon compte", et le service de traduction.
export const FRENCH_ALIASES = ["fr", "français", "francais", "french"];

/**
 * Normalise ce que l'utilisateur a tapé comme langue souhaitée. Ne restreint à
 * aucune liste fermée : "n'importe quelle langue qui existe" doit fonctionner,
 * donc on se contente de nettoyer la saisie et de repérer les synonymes du
 * français ; tout le reste est transmis tel quel à Gemini au moment de traduire.
 */
export function normalizeLanguageInput(text) {

    const trimmed = String(text || "").trim();

    if (!trimmed) {
        return "fr";
    }

    const lower = trimmed.toLowerCase();

    if (FRENCH_ALIASES.includes(lower)) {
        return "fr";
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
