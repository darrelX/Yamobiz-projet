import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";
import { drawYamobizBadge } from "./pdfService.js";

const REPORTS_DIR = path.resolve("storage/reports");

if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function generateAnalysisReportPdf(business, analysis, chartBuffer) {

    const fileName = `analyse-${business.id}-${Date.now()}.pdf`;
    const filePath = path.join(REPORTS_DIR, fileName);

    return new Promise((resolve, reject) => {

        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        const hasLogo = business.logo_path && fs.existsSync(business.logo_path);
        const headerX = hasLogo ? 115 : 50;

        if (hasLogo) {
            try {
                doc.image(business.logo_path, 50, 40, { fit: [55, 55] });
            } catch (err) {
                console.log("⚠️  Logo illisible pour le rapport :", err.message);
            }
        }

        doc.fontSize(18).fillColor("#000").text(business.name, headerX, 45);
        doc.fontSize(9).fillColor("#555").text(
            t("report.generatedOn", { date: formatDateTime(new Date()) }),
            headerX,
            doc.y
        );

        doc.moveDown(3);

        doc.fontSize(13).fillColor("#000").text(t("report.questionAsked"), { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor("#333").text(analysis.question);

        doc.moveDown();
        doc.fontSize(13).fillColor("#000").text(t("report.analysisTitle"), { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor("#333").text(analysis.summary || "—");

        if (chartBuffer) {
            doc.addPage();
            doc.fontSize(13).fillColor("#000").text(t("report.chartTitle"), { underline: true });
            doc.moveDown(0.5);
            try {
                doc.image(chartBuffer, { fit: [495, 350], align: "center" });
            } catch (err) {
                console.log("⚠️  Graphique illisible :", err.message);
            }
        }

        if (analysis.rows?.length) {
            doc.addPage();
            doc.fontSize(13).fillColor("#000").text(t("report.detailedDataTitle"), { underline: true });
            doc.moveDown(0.5);
            renderTable(doc, analysis.rows);
        }

        doc.addPage();
        doc.fontSize(10).fillColor("#000").text(t("report.sqlTitle"), { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor("#555").font("Courier").text(analysis.sql || "-", { width: 495 });
        doc.font("Helvetica");
        doc.moveDown();
        doc.fontSize(8).fillColor("#999").text(t("report.sqlDisclaimer"), { width: 495 });

        drawYamobizBadge(doc);

        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
}

function renderTable(doc, rows) {

    const columns = Object.keys(rows[0]).slice(0, 5);
    const colWidth = 495 / columns.length;
    const startX = 50;
    let y = doc.y;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
    columns.forEach((col, i) => {
        doc.text(col, startX + i * colWidth, y, { width: colWidth - 4 });
    });

    y += 16;
    doc.moveTo(startX, y).lineTo(545, y).strokeColor("#ccc").stroke();
    y += 6;

    doc.font("Helvetica").fontSize(9).fillColor("#333");

    for (const row of rows.slice(0, 40)) {

        columns.forEach((col, i) => {
            const value = row[col];
            const display = typeof value === "number"
                ? String(Math.round(value * 100) / 100)
                : String(value ?? "-");
            doc.text(display.slice(0, 24), startX + i * colWidth, y, { width: colWidth - 4 });
        });

        y += 14;

        if (y > 760) {
            doc.addPage();
            y = 50;
        }
    }

    if (rows.length > 40) {
        doc.moveDown();
        doc.fontSize(8).fillColor("#999").text(t("report.moreRows", { count: rows.length - 40 }));
    }
}
