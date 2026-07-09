import { supabase } from "../lib/supabase.js";



export async function getBusinessByUserId(userId) {

    const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.log("Erreur recherche entreprise :", error);
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

            city: data.city,

            sector: data.sector,

            phone: data.phone,

            plan: "standard"

        })
        .select()
        .single();

    if (error) {
        console.log(error);
        return null;
    }

    return business;

}
