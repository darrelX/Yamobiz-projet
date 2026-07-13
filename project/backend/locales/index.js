import fr from "./fr.js";
import en from "./en.js";

export const DEFAULT_LANGUAGE = "fr";

/**
 * Registre des langues disponibles. Pour ajouter une nouvelle langue plus tard :
 * 1) Créer locales/xx.js (copier locales/en.js comme modèle, traduire chaque valeur
 *    — la structure des clés doit rester IDENTIQUE, seules les valeurs changent).
 * 2) L'importer et l'ajouter ci-dessous.
 * Aucune autre modification de code n'est nécessaire ailleurs dans l'application :
 * tout le texte affiché à l'utilisateur passe déjà par t() (utils/i18n.js), qui lit
 * ce registre. Les boutons de choix de langue (inscription, "Mon compte") devront
 * simplement être étendus pour proposer la nouvelle langue.
 */
export const locales = {
    fr,
    en
};

export const AVAILABLE_LANGUAGES = Object.keys(locales);

export function isLanguageSupported(lang) {
    return AVAILABLE_LANGUAGES.includes(String(lang || "").toLowerCase());
}
