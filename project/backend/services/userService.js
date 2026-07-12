import { supabase } from "../config/supabase.js";

export async function getUserByPhone(phone) {

    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche utilisateur :", error);
        return null;
    }

    return user;
}

export async function createUser(phone) {

    const { data: user, error } = await supabase
        .from("users")
        .insert({ phone })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création utilisateur :", error);
        return null;
    }

    return user;
}

export async function getOrCreateUser(phone) {

    const user = await getUserByPhone(phone);

    if (user) {
        return user;
    }

    return await createUser(phone);
}

export async function getUserById(id) {

    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche utilisateur :", error);
        return null;
    }

    return user;
}

export async function updateUser(id, values) {

    const { data: user, error } = await supabase
        .from("users")
        .update(values)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour utilisateur :", error);
        return null;
    }

    return user;
}

export async function deleteUser(id) {

    const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("❌ Erreur suppression utilisateur :", error);
        return false;
    }

    return true;
}
