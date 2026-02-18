// src/services/inclusiveMatches.js
import { supabase } from "./supabaseClient";

/**
 * Tabla: inclusive_matches
 * Campos esperados (ideal):
 * - id (uuid)
 * - created_at (timestamptz)
 * - club_name (text)
 * - city (text)            // (puede NO existir aún)
 * - start_at (timestamptz)
 * - duration_min (int)
 * - level (text)
 * - needs (text[])         // ["wheelchair","blind",...]
 * - mix_allowed (bool)
 * - notes (text)
 */

export async function fetchInclusiveMatches({ limit = 200 } = {}) {
  // ✅ No uses select("*") si estás teniendo líos de schema cache:
  // seleccionamos campos conocidos (y "city" solo si existe, pero aquí no podemos detectarlo).
  // Solución práctica: intentamos con city, y si falla por city, repetimos sin city.
  const baseSelect = "id, created_at, club_name, start_at, duration_min, level, needs, mix_allowed, notes";

  // Intento 1: con city
  try {
    const { data, error } = await supabase
      .from("inclusive_matches")
      .select(`${baseSelect}, city`)
      .order("start_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (e) {
    const msg = String(e?.message || e || "").toLowerCase();
    if (msg.includes("could not find the 'city' column")) {
      // ✅ Intento 2: sin city
      const { data, error } = await supabase
        .from("inclusive_matches")
        .select(baseSelect)
        .order("start_at", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }
    throw e;
  }
}

export async function createInclusiveMatch(payload) {
  // ✅ Intento 1: tal cual (con city si viene)
  try {
    const { data, error } = await supabase
      .from("inclusive_matches")
      .insert([payload])
      .select("id, created_at, club_name, city, start_at, duration_min, level, needs, mix_allowed, notes")
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    const msg = String(e?.message || e || "").toLowerCase();

    // ✅ Si no existe city en la tabla, reintentamos sin city
    if (msg.includes("could not find the 'city' column")) {
      const { city, ...rest } = payload || {};
      const { data, error } = await supabase
        .from("inclusive_matches")
        .insert([rest])
        .select("id, created_at, club_name, start_at, duration_min, level, needs, mix_allowed, notes")
        .single();

      if (error) throw error;
      return data;
    }

    throw e;
  }
}

export function subscribeInclusiveRealtime(onChange) {
  const ch = supabase
    .channel("inclusive_matches_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "inclusive_matches" }, () => onChange?.())
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {}
  };
}