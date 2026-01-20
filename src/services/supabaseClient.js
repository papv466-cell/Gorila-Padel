import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Logs seguros (sin exponer keys completas)
console.log("[ENV] VITE_SUPABASE_URL:", supabaseUrl ? "OK" : "MISSING");
console.log("[ENV] VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "OK" : "MISSING");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (en .env.local y en Vercel)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
