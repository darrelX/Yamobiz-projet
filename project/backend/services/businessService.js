import { supabase } from "../lib/supabase.js";


export async function getBusinessByPhone(phone) {


  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();


    if(error){

        console.error(error);
        return null;

    }


    return data;

}



export async function createBusiness(business){


    const { data, error } = await supabase
        .from("businesses")
        .insert(business)
        .select()
        .single();


    if(error){

        console.error(error);
        return null;

    }


    return data;

}