// src/services/inclusiveMatches.js
import { supabase } from "./supabaseClient";

const baseSelect = "id, created_at, club_name, city, start_at, duration_min, level, needs, mix_allowed, notes, accessibility_notes, price_per_player, max_players, created_by_user, user_id, sport";

export async function fetchInclusiveMatches({ limit = 200, sport = "padel" } = {}) {
  try {
    const { data, error } = await supabase
      .from("inclusive_matches")
      .select(baseSelect)
      .eq("sport", sport)
      .order("start_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      needs: Array.isArray(m.needs) ? m.needs : typeof m.needs === 'string' ? m.needs.split(',').filter(Boolean) : []
    }));
  } catch (e) {
    throw e;
  }
}

export async function createInclusiveMatch(payload) {
  try {
    const cleanPayload = {
      ...payload,
      needs: Array.isArray(payload.needs) ? payload.needs : [payload.needs].filter(Boolean),
    };

    const { data, error } = await supabase
      .from("inclusive_matches")
      .insert([cleanPayload])
      .select(baseSelect)
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
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