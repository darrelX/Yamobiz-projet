import { supabase } from "../config/supabase.js";

/**
 * Cherche un client existant par nom (insensible à la casse) pour une entreprise.
 */
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
 * Crée un client.
 */
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

/**
 * Récupère un client existant, ou le crée s'il n'existe pas encore.
 */
export async function getOrCreateCustomer(businessId, name, phone = null) {

    if (!name) return null;

    const existing = await findCustomerByName(businessId, name);

    if (existing) {
        return existing;
    }

    return await createCustomer(businessId, { name, phone });
}

/**
 * Supprime tous les clients d'une entreprise (utilisé lors de la suppression du compte).
 */
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
