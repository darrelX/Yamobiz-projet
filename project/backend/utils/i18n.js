import { getCurrentLanguage } from "./requestContext.js";
import { locales, DEFAULT_LANGUAGE } from "../locales/index.js";

function getNested(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (match, key) => (params[key] !== undefined ? String(params[key]) : match));
}

/**
 * Traduit une clé (ex: "sale.confirmPrompt") vers la langue courante de
 * l'utilisateur (voir utils/requestContext.js), avec des variables `{comme_ceci}`
 * remplacées par `params`.
 *
 * Repli automatique en deux temps si une clé n'existe pas :
 * 1) Vers le français (langue de référence, toujours complète).
 * 2) Vers la clé elle-même si même le français ne l'a pas — ça n'arrive normalement
 *    jamais (le français est la source de vérité), mais ça évite un plantage et
 *    permet de repérer facilement une clé oubliée dans les logs.
 */
export function t(key, params = null) {

    const lang = getCurrentLanguage();
    const dict = locales[lang] || locales[DEFAULT_LANGUAGE];

    let value = getNested(dict, key);

    if (value === undefined && lang !== DEFAULT_LANGUAGE) {
        value = getNested(locales[DEFAULT_LANGUAGE], key);
    }

    if (value === undefined) {
        console.log(`⚠️  Clé de traduction manquante : ${key}`);
        return key;
    }

    return interpolate(value, params);
}
