import { supabase } from "../config/supabase.js";

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

export async function deleteInvoicesByBusiness(businessId) {

    const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur suppression factures :", error);
        return false;
    }

    return true;
}
