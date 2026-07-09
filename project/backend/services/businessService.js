import { supabase } from "../lib/supabase.js";


export async function getBusinessByPhone(phone) {

    const { data: business, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();


    if(error){
        console.log("Erreur recherche entreprise :", error);
        return null;
    }


    return business;
}



export async function createBusiness(data){

    const { data: business, error } = await supabase
        .from("businesses")
        .insert({
            name: data.businessName,
            phone: data.phone,
            city: data.city,
            sector: data.sector
        })
        .select()
        .single();


    if(error){
        console.log("Erreur création entreprise :", error);
        return null;
    }


    return business;
}