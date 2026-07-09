import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;


console.log("SUPABASE URL :", supabaseUrl);


export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);

console.log("✅ Supabase Cloud connecté");