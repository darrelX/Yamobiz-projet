import { supabase } from "../config/supabase.js";

export async function findCustomerByName(businessId, name) {

    const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId)
        .ilike("name", name)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche client :", error);
        return null;
    }

    return data;
}

/**
 * Liste tous les clients d'une entreprise. Utilisé pour la correspondance
 * approximative nom -> client lors d'une suppression en bloc par IA/vocal.
 */
export async function getCustomersByBusiness(businessId) {

    const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur récupération clients :", error);
        return [];
    }

    return data || [];
}

export async function createCustomer(businessId, { name, phone }) {

    const { data, error } = await supabase
        .from("customers")
        .insert({ business_id: businessId, name, phone: phone ?? null })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création client :", error);
        return null;
    }

    return data;
}

export async function getOrCreateCustomer(businessId, name, phone = null) {

    if (!name) return null;

    const existing = await findCustomerByName(businessId, name);

    if (existing) {
        return existing;
    }

    return await createCustomer(businessId, { name, phone });
}

/**
 * Met à jour un client (nom, téléphone).
 */
export async function updateCustomer(id, values) {

    const { data, error } = await supabase
        .from("customers")
        .update(values)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour client :", error);
        return null;
    }

    return data;
}

/**
 * Supprime un client précis par id (utilisé par la suppression en bloc).
 */
export async function deleteCustomerById(id) {

    const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("❌ Erreur suppression client :", error);
        return false;
    }

    return true;
}

export async function deleteCustomersByBusiness(businessId) {

    const { error } = await supabase
        .from("customers")
        .delete()
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur suppression clients :", error);
        return false;
    }

    return true;
}
