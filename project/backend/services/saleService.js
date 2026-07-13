import { supabase } from "../config/supabase.js";
import { generateInvoiceNumber } from "../utils/format.js";

export async function createSale(businessId, {
    customerId,
    cartItems,
    paymentType
}) {

    const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const invoiceNumber = generateInvoiceNumber();

    const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
            business_id: businessId,
            customer_id: customerId ?? null,
            total_amount: totalAmount,
            payment_type: paymentType,
            status: "completed",
            invoice_number: invoiceNumber
        })
        .select()
        .single();

    if (saleError) {
        console.log("❌ Erreur création vente :", saleError);
        return null;
    }

    const itemsToInsert = cartItems.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal
    }));

    const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsToInsert);

    if (itemsError) {
        console.log("❌ Erreur création lignes de vente :", itemsError);
        return null;
    }

    return sale;
}

export async function getSaleWithItems(saleId) {

    const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .maybeSingle();

    if (saleError || !sale) {
        console.log("❌ Erreur récupération vente :", saleError);
        return null;
    }

    const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", saleId);

    if (itemsError) {
        console.log("❌ Erreur récupération lignes de vente :", itemsError);
        return { ...sale, items: [] };
    }

    return { ...sale, items };
}

/**
 * Recherche une vente par son numéro de facture, dans le périmètre d'une entreprise.
 * Utilisé pour la suppression en bloc de ventes via message libre/vocal
 * (l'utilisateur doit mentionner explicitement le(s) numéro(s) de facture).
 */
export async function getSaleByInvoiceNumber(businessId, invoiceNumber) {

    const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("business_id", businessId)
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche vente par facture :", error);
        return null;
    }

    return data;
}

/**
 * Montant de la caisse : cumul des ventes réglées comptant uniquement (l'argent
 * réellement encaissé). Les ventes à crédit ne comptent que lorsqu'une créance est
 * payée — non inclus ici pour rester simple ; voir aussi getTotalRevenue() pour le
 * chiffre d'affaires total (comptant + crédit confondus).
 */
export async function getCashBalance(businessId) {

    const { data, error } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("business_id", businessId)
        .eq("payment_type", "cash");

    if (error) {
        console.log("❌ Erreur calcul montant caisse :", error);
        return 0;
    }

    return (data || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
}

/**
 * Calcule le chiffre d'affaires cumulé de l'entreprise, depuis toujours
 * (toutes les ventes, sans limite de période).
 */
export async function getTotalRevenue(businessId) {

    const { data, error } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur calcul chiffre d'affaires :", error);
        return 0;
    }

    return (data || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
}

export async function getSalesBetween(businessId, fromIso, toIso) {

    const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("business_id", businessId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });

    if (error) {
        console.log("❌ Erreur récupération ventes :", error);
        return [];
    }

    return data;
}

export async function getRecentSales(businessId, limit = 10) {

    const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.log("❌ Erreur récupération factures :", error);
        return [];
    }

    return data;
}

export async function deleteSale(saleId) {

    const { error: itemsError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", saleId);

    if (itemsError) {
        console.log("❌ Erreur suppression lignes de vente :", itemsError);
        return false;
    }

    const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", saleId);

    if (error) {
        console.log("❌ Erreur suppression vente :", error);
        return false;
    }

    return true;
}

export async function deleteSalesByBusiness(businessId) {

    const { data: sales, error: fetchError } = await supabase
        .from("sales")
        .select("id")
        .eq("business_id", businessId);

    if (fetchError) {
        console.log("❌ Erreur lecture ventes :", fetchError);
        return false;
    }

    const saleIds = (sales || []).map(s => s.id);

    if (saleIds.length) {
        const { error: itemsError } = await supabase
            .from("sale_items")
            .delete()
            .in("sale_id", saleIds);

        if (itemsError) {
            console.log("❌ Erreur suppression lignes de vente :", itemsError);
            return false;
        }
    }

    const { error } = await supabase
        .from("sales")
        .delete()
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur suppression ventes :", error);
        return false;
    }

    return true;
}

export async function getTopProducts(saleIds, limit = 3) {

    if (!saleIds.length) return [];

    const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, quantity")
        .in("sale_id", saleIds);

    if (error) {
        console.log("❌ Erreur récupération top produits :", error);
        return [];
    }

    const totals = {};

    for (const item of data) {
        totals[item.product_name] = (totals[item.product_name] || 0) + Number(item.quantity);
    }

    return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, quantity]) => ({ name, quantity }));
}
