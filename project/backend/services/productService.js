import { supabase } from "../config/supabase.js";

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

export async function incrementStock(id, quantity) {

    const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", id)
        .single();

    if (fetchError || !product) {
        console.log("❌ Erreur lecture stock avant incrément :", fetchError);
        return null;
    }

    const newStock = Number(product.stock_quantity) + Number(quantity);

    return await updateProduct(id, { stock_quantity: newStock });
}

export async function adjustStock(id, delta) {

    const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", id)
        .single();

    if (fetchError || !product) {
        console.log("❌ Erreur lecture stock avant ajustement :", fetchError);
        return null;
    }

    const newStock = Math.max(0, Number(product.stock_quantity) + Number(delta));

    return await updateProduct(id, { stock_quantity: newStock });
}

export async function getSalesHistoryForProduct(productId, limit = 20) {

    const { data, error } = await supabase
        .from("sale_items")
        .select("quantity, subtotal, unit_price, sale_id, sales(created_at, invoice_number)")
        .eq("product_id", productId);

    if (error) {
        console.log("❌ Erreur historique produit :", error);
        return [];
    }

    return (data || [])
        .sort((a, b) => new Date(b.sales?.created_at || 0) - new Date(a.sales?.created_at || 0))
        .slice(0, limit);
}

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

export async function deleteProductsByBusiness(businessId) {

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur suppression produits :", error);
        return false;
    }

    return true;
}
