import { supabase } from "../lib/supabase.js";

/**
 * Recherche un utilisateur par son numéro WhatsApp.
 */
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


/**
 * Crée un nouvel utilisateur.
 */
export async function createUser(phone) {

    const { data: user, error } = await supabase
        .from("users")
        .insert({
            phone
        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création utilisateur :", error);
        return null;
    }

    return user;
}


/**
 * Retourne un utilisateur s'il existe,
 * sinon le crée automatiquement.
 */
export async function getOrCreateUser(phone) {

    let user = await getUserByPhone(phone);

    if (user) {
        return user;
    }

    return await createUser(phone);
}


/**
 * Recherche un utilisateur par son id.
 */
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


/**
 * Met à jour les informations d'un utilisateur.
 */
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


/**
 * Supprime un utilisateur.
 */
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