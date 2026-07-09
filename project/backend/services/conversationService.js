import { supabase } from "../lib/supabase.js";



export async function getConversation(phone){


    const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();



    if(error){

        console.log(
            "Erreur récupération conversation :",
            error
        );

        return null;
    }


    return data;

}





export async function createConversation(phone){


    const { data, error } = await supabase
        .from("conversations")
        .insert({

            phone,

            step:"START",

            data:{}

        })
        .select()
        .single();



    if(error){

        console.log(
            "Erreur création conversation :",
            error
        );

        return null;
    }



    return data;

}





export async function updateConversation(
    phone,
    step,
    data
){


    const { error } = await supabase
        .from("conversations")
        .update({

            step,

            data

        })
        .eq("phone", phone);



    if(error){

        console.log(
            "Erreur update conversation :",
            error
        );

    }

}