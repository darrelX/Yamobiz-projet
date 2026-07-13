import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { getOpenDebts, getDebtById, recordPayment } from "../services/debtService.js";
import { matchCustomerByName } from "../utils/productMatcher.js";
import { STEPS } from "../utils/steps.js";
import { formatFCFA, parsePositiveNumber, formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Point d'entrée "efface la créance de X" détecté par l'IA depuis n'importe quelle
 * rubrique. On applique directement (comme un paiement complet du restant dû),
 * sans écran de confirmation supplémentaire — cohérent avec le fait que
 * l'enregistrement d'un paiement ne demande déjà pas de confirmation dans le flow
 * manuel.
 */
export async function forgiveDebtFromAi(phone, business, item) {

    const debts = await getOpenDebts(business.id);

    if (!debts.length) {
        await sendWhatsAppMessage(phone, t("debt.noneOpen"));
        return showMainMenu(phone, business);
    }

    const customersWithDebt = debts.map(d => ({ id: d.id, name: d.customers?.name || "" }));
    const match = matchCustomerByName(customersWithDebt, item.customer_query);

    if (!match) {
        await sendWhatsAppMessage(phone, t("debt.notFoundForCustomer", { query: item.customer_query }));
        return showDebtMenu(phone, business);
    }

    const debt = await getDebtById(match.id, business.id);
    const remaining = Number(debt.amount_total) - Number(debt.amount_paid);

    const updated = await recordPayment(debt.id, remaining);

    if (!updated) {
        await sendWhatsAppMessage(phone, t("debt.forgiveError"));
        return showMainMenu(phone, business);
    }

    await sendWhatsAppMessage(
        phone,
        t("debt.forgiven", { name: debt.customers?.name || t("common.thisCustomer"), amount: formatFCFA(remaining) })
    );

    return showMainMenu(phone, business);
}

export async function showDebtMenu(phone, business) {

    const debts = await getOpenDebts(business.id);

    if (!debts.length) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, t("debt.noneCongrats"));
        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.DEBT_MENU, { debtIds: debts.map(d => d.id) });

    return sendWhatsAppMessage(phone, buildDebtListMessage(debts));
}

/**
 * Point d'entrée "paiement de créance" détecté par l'IA (ex: "Paul a payé 5000").
 * On cherche la créance ouverte du client mentionné. Si un montant a été précisé et
 * qu'il est valide, on applique le paiement directement (comme le fait déjà le flow
 * manuel, qui n'a pas d'étape de confirmation supplémentaire) ; sinon on demande le
 * montant en rejoignant l'étape existante.
 */
export async function startPayDebtFromAi(phone, business, item) {

    const debts = await getOpenDebts(business.id);

    if (!debts.length) {
        await sendWhatsAppMessage(phone, t("debt.noneOpen"));
        return showMainMenu(phone, business);
    }

    const customersWithDebt = debts.map(d => ({ id: d.id, name: d.customers?.name || "" }));
    const match = matchCustomerByName(customersWithDebt, item.customer_query);

    if (!match) {
        await sendWhatsAppMessage(phone, t("debt.notFoundForCustomer", { query: item.customer_query }));
        return showDebtMenu(phone, business);
    }

    const debt = await getDebtById(match.id, business.id);
    const remaining = Number(debt.amount_total) - Number(debt.amount_paid);
    const amount = item.amount ? parsePositiveNumber(String(item.amount)) : null;

    if (amount) {

        if (amount > remaining) {
            await sendWhatsAppMessage(
                phone,
                t("debt.amountExceedsRemainingFor", { name: debt.customers?.name || t("common.thisCustomer"), remaining: formatFCFA(remaining) })
            );
            return showDebtMenu(phone, business);
        }

        const updated = await recordPayment(debt.id, amount);

        if (!updated) {
            await sendWhatsAppMessage(phone, t("debt.paymentError"));
            return showMainMenu(phone, business);
        }

        await resetToMenu(phone);

        const statusLabel = updated.status === "paid" ? t("debt.fullySettled") : t("debt.partialRecorded");
        const newRemaining = Number(updated.amount_total) - Number(updated.amount_paid);

        await sendWhatsAppMessage(
            phone,
            `${statusLabel}\n\n${t("debt.paymentSummary", {
                name: debt.customers?.name || "-",
                paid: formatFCFA(amount),
                remaining: formatFCFA(newRemaining)
            })}`
        );

        return showMainMenu(phone, business);
    }

    await updateConversation(phone, STEPS.DEBT_AMOUNT, {
        selectedDebtId: debt.id,
        remaining
    });

    return sendWhatsAppMessage(
        phone,
        t("debt.askAmountPaid", { name: debt.customers?.name || t("common.client"), remaining: formatFCFA(remaining) })
    );
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
        return sendWhatsAppMessage(phone, t("debt.invalidChoice"));
    }

    const debt = await getDebtById(debtIds[index], business.id);

    if (!debt) {
        return sendWhatsAppMessage(phone, t("debt.notFound"));
    }

    const remaining = Number(debt.amount_total) - Number(debt.amount_paid);

    await updateConversation(phone, STEPS.DEBT_AMOUNT, {
        selectedDebtId: debt.id,
        remaining
    });

    return sendWhatsAppMessage(
        phone,
        t("debt.askAmountPaid", { name: debt.customers?.name || t("common.client"), remaining: formatFCFA(remaining) })
    );
}

async function handleDebtAmount(phone, text, conversation, business) {

    const amount = parsePositiveNumber(text);
    const { selectedDebtId, remaining } = conversation.data;

    if (!amount) {
        return sendWhatsAppMessage(phone, t("debt.amountRequired"));
    }

    if (amount > remaining) {
        return sendWhatsAppMessage(phone, t("debt.amountExceedsRemaining", { remaining: formatFCFA(remaining) }));
    }

    const debt = await recordPayment(selectedDebtId, amount);

    if (!debt) {
        await resetToMenu(phone);
        return sendWhatsAppMessage(phone, t("debt.paymentError"));
    }

    await resetToMenu(phone);

    const statusLabel = debt.status === "paid" ? t("debt.fullySettled") : t("debt.partialRecorded");
    const newRemaining = Number(debt.amount_total) - Number(debt.amount_paid);

    await sendWhatsAppMessage(
        phone,
        `${statusLabel}\n\n${t("debt.paymentSummaryNoName", { paid: formatFCFA(amount), remaining: formatFCFA(newRemaining) })}`
    );

    return showMainMenu(phone, business);
}

function buildDebtListMessage(debts) {

    const lines = debts.map((d, i) => {
        const remaining = Number(d.amount_total) - Number(d.amount_paid);
        return `${i + 1}. ${d.customers?.name || t("common.client")} — ${t("debt.remainingLabel")} : ${formatFCFA(remaining)} (${t("debt.sinceDate", { date: formatDateTime(d.created_at) })})`;
    });

    return t("debt.listTitle", { list: lines.join("\n") });
}
