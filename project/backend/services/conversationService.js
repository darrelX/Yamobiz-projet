import { supabase } from "../lib/supabase.js";


export async function getConversation(phone) {

    const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("phone_number", phone)
        .single();


    if(error){
        return null;
    }

    return data;
}



export async function createConversation(phone){

    const { data, error } = await supabase
        .from("whatsapp_sessions")
        .insert({
            phone_number: phone,
            step: "START",
            data: {}
        })
        .select()
        .single();


    if(error){
        console.log(error);
        return null;
    }


    return data;
}



export async function updateConversation(phone, step, newData){

    const { data, error } = await supabase
        .from("whatsapp_sessions")
        .update({
            step,
            data: newData,
            updated_at: new Date()
        })
        .eq("phone_number", phone)
        .select()
        .single();


    if(error){
        console.log(error);
        return null;
    }


    return data;
}