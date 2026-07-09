import { supabase } from "../lib/supabase.js";


export async function getUserByPhone(phone){

    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();


    if(error){
        console.log("Erreur recherche utilisateur :", error);
        return null;
    }


    return user;
}



export async function createUser(phone){

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await getUserByPhone(phone);


    if(existingUser){
        return existingUser;
    }



    const { data: user, error } = await supabase
        .from("users")
        .insert({
            phone
        })
        .select()
        .single();



    if(error){
        console.log("Erreur création utilisateur :", error);
        return null;
    }


    return user;

    export async function getOrCreateUser(phone) {

    let user = await getUserByPhone(phone);

    if (user) {
        return user;
    }

    user = await createUser(phone);

    return user;
}
}