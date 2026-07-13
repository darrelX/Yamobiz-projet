import alasql from "alasql";
import { askGemini } from "./geminiService.js";
import { getBusinessDatasetForAnalysis } from "./analysisDataService.js";
import { t } from "../utils/i18n.js";
import { getCurrentLanguage } from "../utils/requestContext.js";
import { FRENCH_ALIASES } from "../utils/language.js";

export async function runNaturalLanguageAnalysis(business, question) {

    const dataset = await getBusinessDatasetForAnalysis(business.id);

    loadInMemoryTables(dataset);

    const schemaDescription = buildSchemaDescription();

    const sqlPrompt = `Tu es un assistant qui traduit une question posée par un commerçant (dans n'importe quelle langue) en une requête SQL.
Le moteur SQL est alasql (dialecte proche de SQLite). Voici le schéma disponible (données déjà filtrées pour cette entreprise, ${dataset.sales.length} vente(s) sur les 12 derniers mois) :

${schemaDescription}

Règles strictes :
- Réponds UNIQUEMENT avec la requête SQL, sans explication, sans balises markdown, sans point-virgule final.
- Utilise uniquement des instructions SELECT (aucune modification de données).
- N'utilise que les tables et colonnes listées ci-dessus.
- N'utilise jamais "total" comme alias de colonne (mot réservé) — utilise par exemple "montant_total".
- Si la question porte sur une période, utilise le champ created_at (format ISO).

Question : "${question}"

Requête SQL :`;

    const rawSql = await askGemini(sqlPrompt, { temperature: 0 });

    if (!rawSql) {
        return { error: t("analysisService.aiUnreachable") };
    }

    const sql = sanitizeGeneratedSql(rawSql);

    if (!sql) {
        return { error: t("analysisService.cannotTranslateQuestion") };
    }

    let rows;

    try {
        rows = alasql(sql);
    } catch (err) {
        console.log("❌ Erreur exécution SQL généré :", err.message, "\nSQL :", sql);
        return { error: t("analysisService.sqlExecutionFailed") };
    }

    if (!Array.isArray(rows)) {
        rows = [];
    }

    // Le résumé est un contenu généré par l'IA (différent à chaque question) : il n'y a
    // pas de version "préchargée" possible. On demande donc directement à Gemini de le
    // rédiger dans la langue courante de l'utilisateur — ce n'est pas une traduction de
    // l'interface, seulement la langue de rédaction d'un texte de toute façon généré à
    // la volée à partir des données réelles.
    const currentLanguage = getCurrentLanguage();
    const isFrench = FRENCH_ALIASES.includes(String(currentLanguage).toLowerCase());
    const languageInstruction = isFrench ? "" : `\n\nRédige ta réponse ENTIÈREMENT en ${currentLanguage}.`;

    const analysisPrompt = `Voici une question posée par un commerçant : "${question}"

Voici le résultat de la requête SQL exécutée sur ses données (format JSON, ${rows.length} ligne(s)) :
${JSON.stringify(rows).slice(0, 6000)}

Rédige :
1) Une analyse claire et concise (5 à 8 lignes maximum), avec des chiffres concrets tirés du résultat, orientée conseils business si pertinent.
2) Une dernière ligne, sur sa propre ligne, au format JSON strict précédée de "CHART:", décrivant un graphique pertinent pour visualiser ce résultat :
CHART:{"type":"bar|line|pie|doughnut","labelField":"nom_du_champ_du_resultat","valueField":"nom_du_champ_du_resultat","title":"titre court"}
Si aucun graphique n'est pertinent (résultat non numérique, une seule valeur, ou trop peu de lignes), réponds exactement : CHART:null${languageInstruction}`;

    const analysisText = await askGemini(analysisPrompt, { temperature: 0.4 });

    const { summary, chartSpec } = parseAnalysisResponse(analysisText);

    return {
        question,
        sql,
        rows,
        summary,
        chartSpec
    };
}

function loadInMemoryTables(dataset) {

    for (const table of ["sales", "sale_items", "products", "customers", "debts"]) {
        try {
            alasql(`DROP TABLE IF EXISTS ${table}`);
        } catch {
            // ignore
        }
        alasql(`CREATE TABLE ${table}`);
    }

    alasql.tables.sales.data = dataset.sales;
    alasql.tables.sale_items.data = dataset.saleItems;
    alasql.tables.products.data = dataset.products;
    alasql.tables.customers.data = dataset.customers;
    alasql.tables.debts.data = dataset.debts;
}

function buildSchemaDescription() {
    return `- sales(id, created_at, total_amount, payment_type, status, invoice_number, customer_id)
- sale_items(id, sale_id, product_id, product_name, quantity, unit_price, subtotal)
- products(id, name, price, stock_quantity, unit)
- customers(id, name, phone)
- debts(id, sale_id, customer_id, amount_total, amount_paid, status, created_at)`;
}

function sanitizeGeneratedSql(raw) {

    let sql = raw.trim();
    sql = sql.replace(/```sql/gi, "").replace(/```/g, "").trim();
    sql = sql.split(";")[0].trim();

    if (!/^select\b/i.test(sql)) {
        return null;
    }

    const forbidden = /\b(insert|update|delete|drop|alter|create|attach|grant|pragma|into\s+outfile)\b/i;

    if (forbidden.test(sql)) {
        return null;
    }

    return sql;
}

function parseAnalysisResponse(text) {

    if (!text) {
        return { summary: t("analysisService.unavailable"), chartSpec: null };
    }

    const lines = text.split("\n");
    const chartLineIndex = lines.findIndex(l => l.trim().startsWith("CHART:"));

    let chartSpec = null;
    let summaryLines = lines;

    if (chartLineIndex !== -1) {

        summaryLines = lines.slice(0, chartLineIndex);
        const chartRaw = lines[chartLineIndex].replace("CHART:", "").trim();

        if (chartRaw && chartRaw !== "null") {
            try {
                chartSpec = JSON.parse(chartRaw);
            } catch {
                chartSpec = null;
            }
        }
    }

    return {
        summary: summaryLines.join("\n").trim(),
        chartSpec
    };
}
