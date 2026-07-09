import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getOpenDebts, getDebtById, recordPayment } from "../services/debtService.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, parsePositiveNumber } from "../utils/format.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Affiche la liste des créances ouvertes (appelée depuis le menu principal).
 */
export async function showDebtMenu(phone, business) {

    const debts = await getOpenDebts(business.id);

    if (!debts.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, "✅ Aucune créance en cours. Bravo !");
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.DEBT_MENU, { debtIds: debts.map(d => d.id) });

    return sendWhatsAppMessage(phone, buildDebtListMessage(debts));
}

export async function handleDebt(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.DEBT_MENU:
            return handleDebtSelection(phone, text, conversation, business);

        case STEPS.DEBT_AMOUNT:
            return handleDebtAmount(phone, text, conversation, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleDebtSelection(phone, text, conversation, business) {

    const choice = (text || "").trim();

    if (choice === "0") {
        await resetToMenu(phone);
        return showMainMenu(phone, business);
    }

    const index = parseInt(choice, 10) - 1;
    const debtIds = conversation.data.debtIds || [];

    if (isNaN(index) || !debtIds[index]) {
        return sendWhatsAppMessage(phone, "❌ Choix invalide. Entrez le numéro de la créance, ou 0 pour revenir au menu.");
    }

    const debt = await getDebtById(debtIds[index], business.id);

    if (!debt) {
        return sendWhatsAppMessage(phone, "❌ Créance introuvable.");
    }

    const remaining = Number(debt.amount_total) - Number(debt.amount_paid);

    await updateConversation(phone, STEPS.DEBT_AMOUNT, {
        selectedDebtId: debt.id,
        remaining
    });

    return sendWhatsAppMessage(
        phone,
        `Créance de ${debt.customers?.name || "client"} — restant dû : ${formatFCFA(remaining)}\n\nQuel montant a été payé ?`
    );
}

async function handleDebtAmount(phone, text, conversation, business) {

    const amount = parsePositiveNumber(text);
    const { selectedDebtId, remaining } = conversation.data;

    if (!amount) {
        return sendWhatsAppMessage(phone, "❌ Merci d'indiquer un montant valide (nombre positif).");
    }

    if (amount > remaining) {
        return sendWhatsAppMessage(
            phone,
            `❌ Ce montant dépasse le restant dû (${formatFCFA(remaining)}). Merci de saisir un montant plus faible.`
        );
    }

    const debt = await recordPayment(selectedDebtId, amount);

    if (!debt) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, "❌ Une erreur est survenue lors de l'enregistrement du paiement.");
    }

    await resetToMenu(phone);

    const statusLabel = debt.status === "paid" ? "✅ Créance totalement soldée !" : "🟡 Paiement partiel enregistré.";
    const newRemaining = Number(debt.amount_total) - Number(debt.amount_paid);

    await sendWhatsAppMessage(
        phone,
        `${statusLabel}\n\nMontant payé : ${formatFCFA(amount)}\nRestant dû : ${formatFCFA(newRemaining)}`
    );

    return showMainMenu(phone, business);
}

function buildDebtListMessage(debts) {

    const lines = debts.map((d, i) => {
        const remaining = Number(d.amount_total) - Number(d.amount_paid);
        return `${i + 1}. ${d.customers?.name || "Client"} — restant dû : ${formatFCFA(remaining)}`;
    });

    return `💰 *Créances en cours*\n\n${lines.join("\n")}\n\nEntrez le *numéro* de la créance à régler, ou *0* pour revenir au menu.`;
}
