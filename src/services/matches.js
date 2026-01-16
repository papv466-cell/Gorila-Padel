// src/services/matches.js
import { supabase } from "./supabaseClient";

/**
 * matches table expected fields:
 * - id (uuid)
 * - club_id (text)
 * - club_name (text)
 * - start_at (timestamptz)
 * - duration_min (int)
 * - level (text)
 * - created_by_user (uuid)
 * - reserved_spots (int) // "ya somos…" (1..3)
 * - spots_total (int) // default 4
 */

/**
 * match_requests table expected fields:
 * - id (uuid)
 * - match_id (uuid)
 * - user_id (uuid)
 * - status (text) // pending | approved | rejected
 * - created_at
 */

function nowISO() {
  return new Date().toISOString();
}

// ------------------------------
// LISTAR PARTIDOS (solo futuros)
// ------------------------------
export async function fetchMatches({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("start_at", nowISO()) // ✅ solo futuros
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ------------------------------
// CREAR PARTIDO (requiere sesión)
// ------------------------------
export async function createMatch({
  clubId,
  clubName,
  startAtISO,
  durationMin = 90,
  level = "medio",
  alreadyPlayers = 1,
} = {}) {
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const payload = {
    club_id: String(clubId ?? "").trim(),
    club_name: String(clubName ?? "").trim(),
    start_at: startAtISO,
    duration_min: Number(durationMin) || 90,
    level,
    created_by_user: session.user.id,
    reserved_spots: Math.min(3, Math.max(1, Number(alreadyPlayers) || 1)),
    spots_total: 4,
  };

  const { data, error } = await supabase.from("matches").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

// ------------------------------
// ENVIAR SOLICITUD DE UNIRSE
// ------------------------------
export async function requestJoin(matchId) {
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.from("match_requests").insert({
    match_id: matchId,
    user_id: session.user.id,
    status: "pending",
  });

  if (error) throw error;
}

// ------------------------------
// SALIR / CANCELAR MI SOLICITUD (approved o pending)
// Borra mi fila en match_requests para ese match
// ------------------------------
export async function cancelMyJoin(matchId) {
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) throw new Error("No hay sesión activa.");

  // ✅ borramos y confirmamos
  const { data, error } = await supabase
    .from("match_requests")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", session.user.id)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    // aquí ya sabemos que NO había request tuya
    throw new Error("No tienes una solicitud en este partido. Si eres la creadora, elimínalo.");
  }

  return data;
}

// ------------------------------
// ESTADO DE MIS SOLICITUDES (varios matches)
// returns: { [matchId]: "pending" | "approved" | "rejected" }
// ------------------------------
export async function fetchMyRequestsForMatchIds(matchIds = []) {
  if (!matchIds.length) return {};

  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) return {};

  const { data, error } = await supabase
    .from("match_requests")
    .select("match_id, status")
    .eq("user_id", session.user.id)
    .in("match_id", matchIds);

  if (error) throw error;

  const out = {};
  for (const r of data ?? []) out[r.match_id] = r.status;
  return out;
}

// ------------------------------
// CONTADOR DE APROBADOS (varios matches)
// returns: { [matchId]: number }
// ------------------------------
export async function fetchApprovedCounts(matchIds = []) {
  if (!matchIds.length) return {};

  const { data, error } = await supabase
    .from("match_requests")
    .select("match_id, status")
    .in("match_id", matchIds)
    .eq("status", "approved");

  if (error) throw error;

  const out = {};
  for (const r of data ?? []) out[r.match_id] = (out[r.match_id] ?? 0) + 1;
  return out;
}

// ------------------------------
// SOLICITUDES PENDIENTES (solo creador)
// ------------------------------
export async function fetchPendingRequests(matchId) {
  const { data, error } = await supabase
    .from("match_requests")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ------------------------------
// APROBAR / RECHAZAR
// ------------------------------
export async function approveRequest({ requestId }) {
  const { error } = await supabase
    .from("match_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (error) throw error;
}

export async function rejectRequest({ requestId }) {
  const { error } = await supabase
    .from("match_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) throw error;
}

// ------------------------------
// POPUP MAPA: preview de partidos para un club
// (solo futuros)
// ------------------------------
export async function fetchMatchesForClubPreview({ clubId, clubName, limit = 5 }) {
  let q = supabase
    .from("matches")
    .select("id, club_id, club_name, start_at, duration_min, level")
    .gte("start_at", nowISO()) // ✅ solo futuros
    .order("start_at", { ascending: true })
    .limit(limit);

  if (clubId) q = q.eq("club_id", String(clubId));
  else if (clubName) q = q.eq("club_name", String(clubName));

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
// ------------------------------
// ELIMINAR PARTIDO (solo creador por RLS)
// ------------------------------
export async function deleteMatch(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.from("matches").delete().eq("id", matchId);

  if (error) throw error;
}

// ------------------------------
// CHAT: mensajes de un partido
// match_messages expected fields:
// - id (uuid)
// - match_id (uuid)
// - user_id (uuid)
// - message (text)
// - created_at (timestamptz)
// ------------------------------

export async function fetchMatchMessages(matchId, { limit = 120 } = {}) {
  if (!matchId) throw new Error("Falta matchId");

  const { data, error } = await supabase
    .from("match_messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function sendMatchMessage({ matchId, message } = {}) {
  if (!matchId) throw new Error("Falta matchId");

  const text = String(message ?? "").trim();
  if (!text) throw new Error("Mensaje vacío");

  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr) throw sessErr;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const { data, error } = await supabase
    .from("match_messages")
    .insert({
      match_id: matchId,
      user_id: session.user.id,
      message: text,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
// ------------------------------
// ÚLTIMO MENSAJE POR PARTIDO (para badge)
// Devuelve: { [matchId]: created_at_iso }
// ------------------------------
export async function fetchLastMessageAtForMatchIds(matchIds = []) {
  if (!matchIds.length) return {};

  const { data, error } = await supabase
    .from("match_messages")
    .select("match_id, created_at")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const out = {};
  for (const row of data ?? []) {
    if (!out[row.match_id]) out[row.match_id] = row.created_at; // nos quedamos con el primero
  }
  return out;
}
