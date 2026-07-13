import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Permet à n'importe quel point du code (en particulier services/whatsapp.js) de
 * savoir dans quelle langue répondre à l'utilisateur actuellement traité, SANS avoir
 * à faire transiter ce paramètre à travers des centaines d'appels de fonctions.
 *
 * Utilise AsyncLocalStorage (et non une simple variable de module) car le serveur
 * traite potentiellement plusieurs messages de plusieurs utilisateurs en parallèle :
 * une variable partagée classique créerait un risque de mélange de langue entre
 * deux conversations traitées en même temps.
 */
const storage = new AsyncLocalStorage();

/**
 * Démarre le contexte de langue pour tout le traitement d'un message entrant.
 * À appeler une seule fois, tout en haut de handleMessage() dans messageHandler.js.
 */
export function runWithLanguage(language, fn) {
    return storage.run({ language: language || "fr" }, fn);
}

/**
 * Langue courante de l'utilisateur en cours de traitement ("fr" par défaut si le
 * contexte n'a pas été initialisé, ce qui ne devrait arriver qu'en dehors du flow
 * normal de traitement d'un message, par exemple dans un script de test).
 */
export function getCurrentLanguage() {
    return storage.getStore()?.language || "fr";
}

/**
 * Met à jour la langue courante EN COURS DE REQUÊTE (ex: juste après que
 * l'utilisateur vient de choisir/changer sa langue), pour que la toute prochaine
 * réponse envoyée dans le même échange soit déjà traduite dans la nouvelle langue,
 * sans attendre le message suivant.
 */
export function setCurrentLanguage(language) {
    const store = storage.getStore();
    if (store) {
        store.language = language || "fr";
    }
}
