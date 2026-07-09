/**
 * Extrait un message exploitable depuis le payload brut envoyé par Meta.
 * Retourne null si le webhook ne contient pas de message utilisateur
 * (accusés de lecture, statuts de livraison, etc. sont ignorés).
 */
export function parseWebhook(reqBody) {

    const message = reqBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
        return null;
    }

    return {
        phone: `+${message.from}`,
        messageId: message.id,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body ?? null,
        raw: message
    };
}
