import { supabase } from "../config/supabase.js";

/**
 * Enregistre un événement d'activité (vente, ajout de stock, retrait de stock)
 * horodaté automatiquement par la base (created_at). N'échoue jamais bruyamment :
 * une erreur de log ne doit jamais interrompre l'action métier qui l'a déclenchée.
 */
export async function logEvent(businessId, type, message) {

    const { error } = await supabase
        .from("activity_logs")
        .insert({ business_id: businessId, type, message });

    if (error) {
        console.log("❌ Erreur enregistrement log activité :", error);
    }
}

/**
 * Récupère les événements les plus récents d'une entreprise, du plus récent au
 * plus ancien.
 */
export async function getRecentActivityLogs(businessId, limit = 20) {

    const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.log("❌ Erreur récupération logs activité :", error);
        return [];
    }

    return data || [];
}
