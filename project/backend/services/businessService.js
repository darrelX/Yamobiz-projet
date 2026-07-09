import { supabase } from "../lib/supabase.js";

/**
 * Retourne l'entreprise d'un utilisateur.
 */
export async function getBusinessByUserId(userId) {

    const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche entreprise :", error);
        return null;
    }

    return business;
}


/**
 * Recherche une entreprise par son id.
 */
export async function getBusinessById(id) {

    const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche entreprise :", error);
        return null;
    }

    return business;
}


/**
 * Crée une entreprise.
 */
export async function createBusiness(userId, data) {

    const { data: business, error } = await supabase
        .from("businesses")
        .insert({

            user_id: userId,

            name: data.businessName,

            phone: data.phone,

            city: data.city,

            sector: data.sector,

            plan: "standard"

        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création entreprise :", error);
        return null;
    }

    return business;
}


/**
 * Met à jour une entreprise.
 */
export async function updateBusiness(id, values) {

    const { data: business, error } = await supabase
        .from("businesses")
        .update(values)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour entreprise :", error);
        return null;
    }

    return business;
}


/**
 * Supprime une entreprise.
 */
export async function deleteBusiness(id) {

    const { error } = await supabase
        .from("businesses")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("❌ Erreur suppression entreprise :", error);
        return false;
    }

    return true;
}


/**
 * Liste toutes les entreprises.
 * (utile pour l'administration)
 */
export async function getBusinesses() {

    const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.log("❌ Erreur récupération entreprises :", error);
        return [];
    }

    return data;
}