import { supabase } from "./supabaseClient";

/** Devuelve la fila de teacher del usuario actual (o null si no existe) */
export async function fetchMyTeacher() {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  if (!user) return null;

  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle(); // ✅ importante: evita "Cannot coerce to single JSON object"

  if (error) throw error;
  return data ?? null;
}

/** Crea (o reactiva) tu ficha de profesor */
export async function upsertMyTeacher() {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  if (!user) throw new Error("No hay sesión.");

  // 1) comprobar si existe
  const { data: existing, error: exErr } = await supabase
    .from("teachers")
    .select("id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (exErr) throw exErr;

  // 2) si no existe → crear
  if (!existing) {
    const { error: insErr } = await supabase
      .from("teachers")
      .insert({ id: user.id, is_active: true });

    if (insErr) throw insErr;
    return { id: user.id, is_active: true };
  }

  // 3) si existe → activar
  if (existing.is_active !== true) {
    const { error: upErr } = await supabase
      .from("teachers")
      .update({ is_active: true })
      .eq("id", user.id);

    if (upErr) throw upErr;
  }

  return { ...existing, is_active: true };
}
