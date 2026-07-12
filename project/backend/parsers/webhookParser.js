/**
 * Extrait un message exploitable depuis le payload brut envoyé par Meta.
 * Retourne null si le webhook ne contient pas de message utilisateur
 * (accusés de lecture, statuts de livraison, etc. sont ignorés).
 *
 * Gère aussi les réponses aux messages interactifs (boutons / listes) :
 * l'id du bouton ou de la ligne choisie est utilisé comme "text", ce qui
 * permet aux handlers existants (basés sur des choix numériques ou des
 * mots-clés) de fonctionner sans modification.
 *
 * Les messages vocaux (type "audio") sont laissés tels quels ici : c'est
 * messageHandler qui se charge de les télécharger et de les transcrire.
 */
export function parseWebhook(reqBody) {

    const message = reqBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
        return null;
    }

    let text = message.text?.body ?? null;

    if (message.type === "interactive") {
        const interactive = message.interactive;

        if (interactive?.button_reply) {
            text = interactive.button_reply.id;
        } else if (interactive?.list_reply) {
            text = interactive.list_reply.id;
        }
    }

    return {
        phone: `+${message.from}`,
        messageId: message.id,
        timestamp: message.timestamp,
        type: message.type,
        text,
        raw: message
    };
}
