import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { formatFCFA, formatDateTime } from "../utils/format.js";
import { t } from "../utils/i18n.js";

const INVOICES_DIR = path.resolve("storage/invoices");

if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export async function generateInvoicePdf(business, sale, items, customer) {

    const filePath = path.join(INVOICES_DIR, `${sale.invoice_number}.pdf`);

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
                console.log("⚠️  Logo illisible, facture générée sans logo :", err.message);
            }
        }

        doc.fontSize(20).fillColor("#000").text(business.name || t("pdf.businessFallback"), headerX, 45, { align: "left" });
        doc.fontSize(10).fillColor("#555")
            .text(business.city || "", headerX, doc.y)
            .text(business.phone || "", headerX, doc.y);

        const paymentLabel = sale.payment_type === "credit" ? t("pdf.paymentCredit") : t("pdf.paymentCash");

        doc.moveDown(1.5);
        doc.fillColor("#000").fontSize(16).text(t("pdf.invoiceTitle"), { align: "right" });
        doc.fontSize(10).fillColor("#555")
            .text(t("pdf.invoiceNumber", { number: sale.invoice_number }), { align: "right" })
            .text(t("pdf.date", { date: formatDateTime(sale.created_at || new Date()) }), { align: "right" })
            .text(t("pdf.payment", { label: paymentLabel }), { align: "right" });

        doc.moveDown();

        doc.fillColor("#000").fontSize(11).text(
            t("pdf.client", { name: customer?.name || t("pdf.cashCustomer") }),
            { align: "left" }
        );
        if (customer?.phone) {
            doc.fontSize(10).fillColor("#555").text(customer.phone);
        }

        doc.moveDown(1.5);

        const tableTop = doc.y;
        const col = { name: 50, qty: 260, price: 340, subtotal: 440 };

        doc.fillColor("#000").fontSize(10).font("Helvetica-Bold");
        doc.text(t("pdf.colArticle"), col.name, tableTop);
        doc.text(t("pdf.colQty"), col.qty, tableTop);
        doc.text(t("pdf.colUnitPrice"), col.price, tableTop);
        doc.text(t("pdf.colSubtotal"), col.subtotal, tableTop);

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

        doc.font("Helvetica-Bold").fontSize(12)
            .text(t("pdf.total", { amount: formatFCFA(sale.total_amount) }), col.subtotal - 60, y + 20);

        doc.moveDown(4);
        doc.font("Helvetica").fontSize(9).fillColor("#888")
            .text(t("pdf.thankYou"), 50, doc.y, {
                align: "center",
                width: 495
            });

        drawYamobizBadge(doc);

        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
}

function drawYamobizBadge(doc) {
    const x = 480;
    const y = 780;
    doc.save();
    doc.roundedRect(x, y, 65, 18, 3).fill("#111827");
    doc.fillColor("#ffffff").fontSize(8).text("⚡ Yamobiz", x + 6, y + 5);
    doc.restore();
}

export { drawYamobizBadge };
