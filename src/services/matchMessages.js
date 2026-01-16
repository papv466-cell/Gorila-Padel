import { supabase } from "./supabaseClient";

export async function fetchMatchMessages(matchId, { limit = 80 } = {}) {
  const { data, error } = await supabase
    .from("match_messages")
    .select("id, match_id, user_id, message, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function sendMatchMessage({ matchId, message }) {
  const msg = String(message ?? "").trim();
  if (!msg) throw new Error("Escribe un mensaje.");
  if (msg.length > 1000) throw new Error("Máximo 1000 caracteres.");

  const { data: auth } = await supabase.auth.getSession();
  const userId = auth?.session?.user?.id;
  if (!userId) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("match_messages")
    .insert([{ match_id: matchId, user_id: userId, message: msg }])
    .select("id, match_id, user_id, message, created_at")
    .single();

  if (error) throw error;
  return data;
}
