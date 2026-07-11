import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log("⚠️  SUPABASE_URL ou SUPABASE_KEY manquant(e) dans .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("✅ Client Supabase initialisé");
