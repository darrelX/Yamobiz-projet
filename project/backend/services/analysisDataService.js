import { supabase } from "../config/supabase.js";

export async function getBusinessDatasetForAnalysis(businessId, monthsBack = 12) {

    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    const sinceIso = since.toISOString();

    const [salesRes, productsRes, customersRes, debtsRes] = await Promise.all([
        supabase.from("sales").select("*").eq("business_id", businessId).gte("created_at", sinceIso),
        supabase.from("products").select("*").eq("business_id", businessId),
        supabase.from("customers").select("*").eq("business_id", businessId),
        supabase.from("debts").select("*").eq("business_id", businessId).gte("created_at", sinceIso)
    ]);

    if (salesRes.error) console.log("❌ Erreur chargement ventes (analyse) :", salesRes.error);
    if (productsRes.error) console.log("❌ Erreur chargement produits (analyse) :", productsRes.error);
    if (customersRes.error) console.log("❌ Erreur chargement clients (analyse) :", customersRes.error);
    if (debtsRes.error) console.log("❌ Erreur chargement créances (analyse) :", debtsRes.error);

    const sales = salesRes.data || [];
    const saleIds = sales.map(s => s.id);

    let saleItems = [];

    if (saleIds.length) {
        const { data, error } = await supabase
            .from("sale_items")
            .select("*")
            .in("sale_id", saleIds);

        if (error) {
            console.log("❌ Erreur chargement lignes de vente (analyse) :", error);
        } else {
            saleItems = data || [];
        }
    }

    return {
        sales,
        saleItems,
        products: productsRes.data || [],
        customers: customersRes.data || [],
        debts: debtsRes.data || []
    };
}
