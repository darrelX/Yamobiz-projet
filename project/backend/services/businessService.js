import { supabase } from "../config/supabase.js";

export async function getBusinessByUserId(userId) {

    const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche entreprise :", error);
        return null;
    }

    return business;
}

export async function getBusinessesByUserId(userId) {

    const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

    if (error) {
        console.log("❌ Erreur recherche entreprises :", error);
        return [];
    }

    return data || [];
}

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

export async function updateBusiness(id, values) {

    const { data: business, error } = await supabase
        .from("businesses")
        .update({ ...values, updated_at: new Date() })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour entreprise :", error);
        return null;
    }

    return business;
}

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
