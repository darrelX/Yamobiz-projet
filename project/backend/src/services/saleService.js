import { supabase } from "../config/supabase.js";
import { generateInvoiceNumber } from "../utils/format.js";

/**
 * Crée une vente complète (sale + sale_items) à partir d'un panier.
 *
 * cartItems attendu : [{ product_id, product_name, quantity, unit_price, subtotal }]
 */
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

/**
 * Récupère une vente avec ses lignes.
 */
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
 * Liste les ventes d'une entreprise sur une période donnée (bornes ISO incluses).
 */
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

/**
 * Récupère les lignes de vente les plus vendues sur un ensemble de ventes.
 */
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
