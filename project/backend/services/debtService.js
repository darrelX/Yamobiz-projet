import { supabase } from "../config/supabase.js";

export async function createDebt(businessId, { saleId, customerId, amountTotal }) {

    const { data, error } = await supabase
        .from("debts")
        .insert({
            business_id: businessId,
            sale_id: saleId,
            customer_id: customerId ?? null,
            amount_total: amountTotal,
            amount_paid: 0,
            status: "unpaid"
        })
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur création créance :", error);
        return null;
    }

    return data;
}

export async function getOpenDebts(businessId) {

    const { data, error } = await supabase
        .from("debts")
        .select("*, customers(name, phone)")
        .eq("business_id", businessId)
        .neq("status", "paid")
        .order("created_at", { ascending: true });

    if (error) {
        console.log("❌ Erreur récupération créances :", error);
        return [];
    }

    return data;
}

export async function getDebtById(id, businessId) {

    const { data, error } = await supabase
        .from("debts")
        .select("*, customers(name, phone)")
        .eq("id", id)
        .eq("business_id", businessId)
        .maybeSingle();

    if (error) {
        console.log("❌ Erreur recherche créance :", error);
        return null;
    }

    return data;
}

export async function recordPayment(id, amountPaidNow) {

    const { data: debt, error: fetchError } = await supabase
        .from("debts")
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !debt) {
        console.log("❌ Erreur lecture créance avant paiement :", fetchError);
        return null;
    }

    const newAmountPaid = Number(debt.amount_paid) + Number(amountPaidNow);
    const status = newAmountPaid >= Number(debt.amount_total) ? "paid" : "partial";

    const { data, error } = await supabase
        .from("debts")
        .update({
            amount_paid: newAmountPaid,
            status,
            updated_at: new Date()
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.log("❌ Erreur mise à jour créance :", error);
        return null;
    }

    return data;
}

export async function getTotalOutstandingDebt(businessId) {

    const debts = await getOpenDebts(businessId);

    return debts.reduce(
        (sum, d) => sum + (Number(d.amount_total) - Number(d.amount_paid)),
        0
    );
}

export async function deleteDebtBySaleId(saleId) {

    const { error } = await supabase
        .from("debts")
        .delete()
        .eq("sale_id", saleId);

    if (error) {
        console.log("❌ Erreur suppression créance :", error);
        return false;
    }

    return true;
}

export async function deleteDebtsByBusiness(businessId) {

    const { error } = await supabase
        .from("debts")
        .delete()
        .eq("business_id", businessId);

    if (error) {
        console.log("❌ Erreur suppression créances :", error);
        return false;
    }

    return true;
}
