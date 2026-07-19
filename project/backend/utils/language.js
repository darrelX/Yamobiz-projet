// Synonymes reconnus comme "français" et "anglais". Centralisé ici pour être
// partagé entre l'inscription, le changement de langue dans "Mon compte", et
// l'interception IA (CHANGE_LANGUAGE).
export const FRENCH_ALIASES = ["fr", "français", "francais", "french"];
export const ENGLISH_ALIASES = ["en", "anglais", "english", "engli", "anglai"];

/**
 * Normalise ce que l'utilisateur a tapé comme langue souhaitée vers un code de
 * langue effectivement supporté par le registre de locales ("fr" ou "en").
 *
 * Retourne le code normalisé, ou null si la langue demandée n'est pas supportée.
 * IMPORTANT : ne jamais stocker la valeur brute en base — t() (utils/i18n.js) ne
 * connaît que les clés du registre locales/index.js ; toute autre valeur ferait
 * silencieusement retomber TOUTE l'interface sur le français par défaut, donnant
 * l'impression que le changement de langue "ne marche jamais".
 */
export function normalizeLanguageInput(text) {

    const lower = String(text || "").trim().toLowerCase();

    if (!lower) {
        return null;
    }

    if (FRENCH_ALIASES.includes(lower)) {
        return "fr";
    }

    if (ENGLISH_ALIASES.includes(lower)) {
        return "en";
    }

    return null;
}
