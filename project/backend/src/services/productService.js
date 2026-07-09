import { supabase } from "../config/supabase.js";

/**
 * Liste les produits d'une entreprise (triés par nom).
 */
export async function getProductsByBusiness(businessId) {

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .order("name", { ascending: true });

    if (error) {
        console.log("❌ Erreur récupération produits :", error);
        return [];
    }

    return data;
}

/**
 * Récupère un produit par id (et vérifie qu'il appartient bien à l'entreprise).
 */
export async function getProductById(id, businessId) {

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("business_id", businessId)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche produit :", error);
        return null;
    }

    return data;
}

/**
 * Crée un produit.
 */
export async function createProduct(businessId, { name, price, stock_quantity, unit }) {

    const { data, error } = await supabase
        .from("products")
        .insert({
            business_id: businessId,
            name,
            price,
            stock_quantity: stock_quantity ?? 0,
            unit: unit ?? "unité"
        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création produit :", error);
        return null;
    }

    return data;
}

/**
 * Met à jour un produit.
 */
export async function updateProduct(id, values) {

    const { data, error } = await supabase
        .from("products")
        .update({ ...values, updated_at: new Date() })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour produit :", error);
        return null;
    }

    return data;
}

/**
 * Décrémente le stock d'un produit après une vente.
 * Utilise le stock actuel plutôt qu'une opération atomique SQL pour rester
 * simple ; à faible volume ceci est suffisant.
 */
export async function decrementStock(id, quantity) {

    const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", id)
        .single();

    if (fetchError || !product) {
        console.log("❌ Erreur lecture stock avant décrément :", fetchError);
        return null;
    }

    const newStock = Math.max(0, Number(product.stock_quantity) - Number(quantity));

    return await updateProduct(id, { stock_quantity: newStock });
}

/**
 * Supprime un produit.
 */
export async function deleteProduct(id) {

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("❌ Erreur suppression produit :", error);
        return false;
    }

    return true;
}
