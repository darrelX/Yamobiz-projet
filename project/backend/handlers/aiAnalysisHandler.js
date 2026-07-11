import { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppDocument } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { STEPS } from "../utils/steps.js";
import { startAnalysis } from "./analysisHandler.js";
import { runNaturalLanguageAnalysis } from "../services/analysisService.js";
import { generateChartImage } from "../services/chartService.js";
import { generateAnalysisReportPdf } from "../services/reportService.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * Affiche le menu Analyse : résumé rapide (existant) ou question libre à l'IA.
 */
export async function showAnalysisMenu(phone, business) {

    await updateConversation(phone, STEPS.ANALYSIS_MENU, {});

    return sendWhatsAppButtons(
        phone,
        "📊 *Analyse financière*\n\nQue voulez-vous consulter ?",
        [
            { id: "analysis_quick", title: "📈 Résumé rapide" },
            { id: "analysis_ai", title: "🤖 Poser une question" }
        ]
    );
}

export async function handleAnalysis(phone, text, conversation, business) {

    switch (conversation.step) {

        case STEPS.ANALYSIS_MENU:
            return handleAnalysisMenuChoice(phone, text, business);

        case STEPS.ANALYSIS_AI_QUESTION:
            return handleAiQuestion(phone, text, business);

        default:
            await resetToMenu(phone);
            return showMainMenu(phone, business);
    }
}

async function handleAnalysisMenuChoice(phone, text, business) {

    const choice = (text || "").trim().toLowerCase();

    if (choice === "analysis_quick") {
        return startAnalysis(phone, business);
    }

    if (choice === "analysis_ai") {
        await updateConversation(phone, STEPS.ANALYSIS_AI_QUESTION, {});
        return sendWhatsAppMessage(
            phone,
            '🤖 Posez votre question sur vos ventes, votre stock ou vos créances, en français.\n\nEx : "Quel est mon produit le plus vendu ce mois-ci ?", "Quel client me doit le plus d\'argent ?", "Quel jour ai-je fait le plus de chiffre d\'affaires ce trimestre ?"'
        );
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleAiQuestion(phone, text, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, "❌ Merci de poser une question.");
    }

    await sendWhatsAppMessage(phone, "🤖 Analyse en cours, un instant...");

    const analysis = await runNaturalLanguageAnalysis(business, text.trim());

    if (analysis.error) {
        await resetToMenu(phone);
        await sendWhatsAppMessage(phone, `❌ ${analysis.error}`);
        return showMainMenu(phone, business);
    }

    const chartBuffer = analysis.chartSpec
        ? await generateChartImage(analysis.chartSpec, analysis.rows)
        : null;

    let pdfPath = null;

    try {
        pdfPath = await generateAnalysisReportPdf(business, analysis, chartBuffer);
    } catch (err) {
        console.log("❌ Erreur génération rapport PDF :", err);
    }

    await resetToMenu(phone);

    await sendWhatsAppMessage(phone, `📊 *Résultat*\n\n${analysis.summary || "Analyse indisponible."}`);

    if (pdfPath) {
        await sendWhatsAppDocument(
            phone,
            pdfPath,
            "rapport-analyse.pdf",
            "📄 Rapport complet (graphique, données détaillées et requête utilisée)."
        );
    }

    return showMainMenu(phone, business);
}
