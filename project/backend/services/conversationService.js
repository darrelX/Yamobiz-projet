import { supabase } from "../config/supabase.js";
import { STEPS } from "../utils/steps.js";

export async function getConversation(phone) {

    const { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur récupération conversation :", error);
        return null;
    }

    return conversation;
}

export async function createConversation(phone) {

    const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
            phone,
            step: STEPS.NAME,
            data: {}
        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création conversation :", error);
        return null;
    }

    return conversation;
}

export async function getOrCreateConversation(phone) {

    const conversation = await getConversation(phone);

    if (conversation) {
        return conversation;
    }

    return await createConversation(phone);
}

export async function updateStep(phone, step) {

    const { data, error } = await supabase
        .from("conversations")
        .update({ step, updated_at: new Date() })
        .eq("phone", phone)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour étape :", error);
        return null;
    }

    return data;
}

export async function updateData(phone, data) {

    const { data: conversation, error } = await supabase
        .from("conversations")
        .update({ data, updated_at: new Date() })
        .eq("phone", phone)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour données :", error);
        return null;
    }

    return conversation;
}

export async function updateConversation(phone, step, data) {

    const { data: conversation, error } = await supabase
        .from("conversations")
        .update({ step, data, updated_at: new Date() })
        .eq("phone", phone)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour conversation :", error);
        return null;
    }

    return conversation;
}

export async function resetToMenu(phone) {
    return updateConversation(phone, STEPS.MENU, {});
}

export async function resetConversation(phone) {

    const { data, error } = await supabase
        .from("conversations")
        .update({
            step: STEPS.NAME,
            data: {},
            updated_at: new Date()
        })
        .eq("phone", phone)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur reset conversation :", error);
        return null;
    }

    return data;
}

export async function deleteConversation(phone) {

    const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("phone", phone);

    if (error) {
        console.log("❌ Erreur suppression conversation :", error);
        return false;
    }

    return true;
}
