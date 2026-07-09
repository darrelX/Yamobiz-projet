/**
 * Formate un montant en Francs CFA.
 */
export function formatFCFA(amount) {
    const value = Number(amount) || 0;
    return `${value.toLocaleString("fr-FR")} FCFA`;
}

/**
 * Normalise un numéro WhatsApp au format international avec "+".
 */
export function normalizePhone(phone) {
    if (!phone) return null;
    return phone.startsWith("+") ? phone : `+${phone}`;
}

/**
 * Convertit une entrée utilisateur en nombre positif, ou null si invalide.
 */
export function parsePositiveNumber(text) {
    if (!text) return null;

    const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
    const value = parseFloat(cleaned);

    if (isNaN(value) || value <= 0) {
        return null;
    }

    return value;
}

/**
 * Interprète une réponse oui/non de l'utilisateur.
 * Retourne true, false, ou null si ambigu.
 */
export function parseYesNo(text) {
    if (!text) return null;

    const t = text.trim().toLowerCase();

    if (["oui", "o", "yes", "y", "1"].includes(t)) return true;
    if (["non", "n", "no", "2"].includes(t)) return false;

    return null;
}

/**
 * Génère un numéro de facture lisible et unique.
 * Ex: INV-20260709-4821
 */
export function generateInvoiceNumber() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `INV-${datePart}-${randomPart}`;
}
