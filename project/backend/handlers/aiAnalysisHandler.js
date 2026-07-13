import { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppDocument } from "../services/whatsapp.js";
import { updateConversation, resetToMenu } from "../services/conversationService.js";
import { STEPS } from "../utils/steps.js";
import { t } from "../utils/i18n.js";
import { startAnalysis } from "./analysisHandler.js";
import { runNaturalLanguageAnalysis } from "../services/analysisService.js";
import { generateChartImage } from "../services/chartService.js";
import { generateAnalysisReportPdf } from "../services/reportService.js";
import { showMainMenu } from "./menuHandler.js";

export async function showAnalysisMenu(phone, business) {

    await updateConversation(phone, STEPS.ANALYSIS_MENU, {});

    return sendWhatsAppButtons(
        phone,
        t("analysis.menuTitle"),
        [
            { id: "analysis_quick", title: t("analysis.quickButton") },
            { id: "analysis_ai", title: t("analysis.aiButton") }
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
        return sendWhatsAppMessage(phone, t("analysis.askQuestion"));
    }

    await resetToMenu(phone);
    return showMainMenu(phone, business);
}

async function handleAiQuestion(phone, text, business) {

    if (!text || !text.trim()) {
        return sendWhatsAppMessage(phone, t("analysis.questionRequired"));
    }

    return runAiQuestionFlow(phone, business, text.trim());
}

/**
 * Point d'entrée "analyse" détecté par l'IA depuis n'importe quelle rubrique de
 * l'application (ex: "fais-moi une analyse de mes ventes ce mois"). Si une question
 * précise a été comprise, on lance directement l'analyse en langage naturel ; sinon
 * (demande générique du type "fais une analyse") on affiche le résumé rapide.
 */
export async function startAnalysisFromAi(phone, business, question) {

    if (question && question.trim()) {
        return runAiQuestionFlow(phone, business, question.trim());
    }

    return startAnalysis(phone, business);
}

/**
 * Exécute le pipeline complet d'analyse en langage naturel (SQL généré par l'IA,
 * résumé, graphique, rapport PDF) pour une question donnée, indépendamment de
 * l'étape de conversation en cours. Utilisée à la fois par le flow scénarisé
 * classique (ANALYSIS_AI_QUESTION) et par l'interception IA universelle.
 *
 * Note : contrairement au reste de l'interface (textes fixes, préchargés), le
 * résumé produit ici est un contenu généré par l'IA à partir des données de vente —
 * il n'existe pas de version "préchargée" possible pour un texte différent à chaque
 * question. On demande donc directement à Gemini de rédiger ce résumé dans la
 * langue courante de l'utilisateur (voir analysisService.js) — ce n'est pas une
 * traduction a posteriori de l'interface, seulement la langue de rédaction d'un
 * contenu de toute façon généré à la volée.
 */
export async function runAiQuestionFlow(phone, business, question) {

    await sendWhatsAppMessage(phone, t("analysis.inProgress"));

    const analysis = await runNaturalLanguageAnalysis(business, question);

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

    await sendWhatsAppMessage(phone, t("analysis.resultTitle", { summary: analysis.summary || t("analysis.unavailable") }));

    if (pdfPath) {
        await sendWhatsAppDocument(phone, pdfPath, "rapport-analyse.pdf", t("analysis.reportCaption"));
    }

    return showMainMenu(phone, business);
}
