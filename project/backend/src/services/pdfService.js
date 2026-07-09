import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { formatFCFA } from "../utils/format.js";

const INVOICES_DIR = path.resolve("storage/invoices");

if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

/**
 * Génère un PDF de facture pour une vente et retourne son chemin local.
 *
 * @param {object} business  { name, city, phone, sector }
 * @param {object} sale      { invoice_number, payment_type, total_amount, created_at }
 * @param {array}  items     [{ product_name, quantity, unit_price, subtotal }]
 * @param {object} customer  { name, phone } | null
 */
export async function generateInvoicePdf(business, sale, items, customer) {

    const filePath = path.join(INVOICES_DIR, `${sale.invoice_number}.pdf`);

    return new Promise((resolve, reject) => {

        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // --- En-tête ---
        doc.fontSize(20).text(business.name || "Entreprise", { align: "left" });
        doc.fontSize(10).fillColor("#555")
            .text(business.city || "", { align: "left" })
            .text(business.phone || "", { align: "left" });

        doc.moveDown(1.5);
        doc.fillColor("#000").fontSize(16).text("FACTURE", { align: "right" });
        doc.fontSize(10).fillColor("#555")
            .text(`N° ${sale.invoice_number}`, { align: "right" })
            .text(`Date : ${new Date(sale.created_at || Date.now()).toLocaleString("fr-FR")}`, { align: "right" })
            .text(`Paiement : ${sale.payment_type === "credit" ? "Crédit (créance)" : "Comptant"}`, { align: "right" });

        doc.moveDown();

        // --- Client ---
        doc.fillColor("#000").fontSize(11).text(
            `Client : ${customer?.name || "Client comptant"}`,
            { align: "left" }
        );
        if (customer?.phone) {
            doc.fontSize(10).fillColor("#555").text(customer.phone);
        }

        doc.moveDown(1.5);

        // --- Tableau des articles ---
        const tableTop = doc.y;
        const col = { name: 50, qty: 260, price: 340, subtotal: 440 };

        doc.fillColor("#000").fontSize(10).font("Helvetica-Bold");
        doc.text("Article", col.name, tableTop);
        doc.text("Qté", col.qty, tableTop);
        doc.text("Prix unit.", col.price, tableTop);
        doc.text("Sous-total", col.subtotal, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#ccc").stroke();

        let y = tableTop + 22;
        doc.font("Helvetica").fontSize(10);

        for (const item of items) {
            doc.text(item.product_name, col.name, y, { width: 200 });
            doc.text(String(item.quantity), col.qty, y);
            doc.text(formatFCFA(item.unit_price), col.price, y);
            doc.text(formatFCFA(item.subtotal), col.subtotal, y);
            y += 20;
        }

        doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor("#ccc").stroke();

        // --- Total ---
        doc.font("Helvetica-Bold").fontSize(12)
            .text(`TOTAL : ${formatFCFA(sale.total_amount)}`, col.subtotal - 60, y + 20);

        doc.moveDown(4);
        doc.font("Helvetica").fontSize(9).fillColor("#888")
            .text("Merci pour votre confiance — Facture générée automatiquement via Yamobiz.", 50, doc.y, {
                align: "center",
                width: 495
            });

        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
}
