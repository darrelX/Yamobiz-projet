import { supabase } from "../config/supabase.js";

/**
 * Enregistre la référence d'une facture générée (numéro + chemin du PDF).
 */
export async function createInvoiceRecord(businessId, { saleId, invoiceNumber, pdfPath }) {

    const { data, error } = await supabase
        .from("invoices")
        .insert({
            business_id: businessId,
            sale_id: saleId,
            invoice_number: invoiceNumber,
            pdf_path: pdfPath
        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur enregistrement facture :", error);
        return null;
    }

    return data;
}

/**
 * Récupère une facture par numéro.
 */
export async function getInvoiceByNumber(invoiceNumber) {

    const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche facture :", error);
        return null;
    }

    return data;
}
