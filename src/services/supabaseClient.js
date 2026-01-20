console.log("[ENV]", {
  url: import.meta.env.VITE_SUPABASE_URL,
  hasAnon: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
});

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Esto hará que NO haya pantalla blanca y que veamos el motivo claro en consola
  console.error("[ENV] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
  console.error("[ENV] VITE_SUPABASE_URL =", supabaseUrl);
  console.error("[ENV] VITE_SUPABASE_ANON_KEY existe =", !!supabaseAnonKey);
  throw new Error("Faltan variables de entorno de Supabase en producción (Vercel).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
