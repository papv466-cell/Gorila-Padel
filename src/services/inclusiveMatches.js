// src/services/inclusiveMatches.js
import { supabase } from "./supabaseClient";

/**
 * Tabla: inclusive_matches
 * Campos esperados:
 * - id (uuid)
 * - created_at (timestamptz)
 * - club_name (text)
 * - city (text)
 * - start_at (timestamptz)
 * - duration_min (int)
 * - level (text)
 * - needs (text[])     // ["wheelchair","blind",...]
 * - mix_allowed (bool)
 * - notes (text)
 */
export async function fetchInclusiveMatches({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from("inclusive_matches")
    .select("*")
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createInclusiveMatch(payload) {
  const { data, error } = await supabase
    .from("inclusive_matches")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export function subscribeInclusiveRealtime(onChange) {
  const ch = supabase
    .channel("inclusive_matches_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inclusive_matches" },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {}
  };
}
