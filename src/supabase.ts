import { createClient } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) console.warn("Isi variabel Supabase pada file .env");
export const supabase = createClient(url || "https://example.supabase.co", anonKey || "example-anon-key");
