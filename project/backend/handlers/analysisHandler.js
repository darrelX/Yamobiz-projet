import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { getSalesBetween, getTopProducts } from "../services/saleService.js";
import { getTotalOutstandingDebt } from "../services/debtService.js";
import { formatFCFA } from "../utils/format.js";
import { resetToMenu } from "../services/conversationService.js";
import { showMainMenu } from "./menuHandler.js";

export async function startAnalysis(phone, business) {

    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nowIso = now.toISOString();

    const [todaySales, weekSales, monthSales, outstandingDebt] = await Promise.all([
        getSalesBetween(business.id, startOfDay, nowIso),
        getSalesBetween(business.id, startOfWeek, nowIso),
        getSalesBetween(business.id, startOfMonth, nowIso),
        getTotalOutstandingDebt(business.id)
    ]);

    const todayTotal = sumSales(todaySales);
    const weekTotal = sumSales(weekSales);
    const monthTotal = sumSales(monthSales);

    const topProducts = await getTopProducts(monthSales.map(s => s.id), 3);

    const topProductsText = topProducts.length
        ? topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.quantity} vendu(s))`).join("\n")
        : "Aucune vente ce mois-ci.";

    const message =
`📊 *Analyse — ${business.name}*

*Aujourd'hui*
Ventes : ${todaySales.length} — Total : ${formatFCFA(todayTotal)}

*7 derniers jours*
Ventes : ${weekSales.length} — Total : ${formatFCFA(weekTotal)}

*Ce mois-ci*
Ventes : ${monthSales.length} — Total : ${formatFCFA(monthTotal)}

*Top produits du mois*
${topProductsText}

*Créances en cours*
${formatFCFA(outstandingDebt)}`;

    await resetToMenu(phone);
    await sendWhatsAppMessage(phone, message);
    return showMainMenu(phone, business);
}

function sumSales(sales) {
    return sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
}
