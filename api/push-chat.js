import { supabase } from "./supabaseClient";

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
    .gte("start_at", nowISO())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ------------------------------
// ÚLTIMO MENSAJE POR PARTIDO (badge)
// Devuelve: { [matchId]: timestamp_ms }
// ------------------------------
export async function fetchLatestChatTimes(matchIds = []) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};

  const { data, error } = await supabase
    .from("match_messages")
    .select("match_id, created_at")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const out = {};
  for (const row of data ?? []) {
    const id = row.match_id;
    if (!id) continue;
    if (out[id]) continue;
    const ts = new Date(row.created_at).getTime();
    out[id] = Number.isFinite(ts) ? ts : 0;
  }
  return out;
}

// ------------------------------
// CREAR PARTIDO
// ------------------------------
export async function createMatch({
  clubId,
  clubName,
  startAtISO,
  durationMin = 90,
  level = "medio",
  alreadyPlayers = 1,
} = {}) {
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
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
// SOLICITAR UNIRSE
// ------------------------------
export async function requestJoin(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const payload = { match_id: matchId, user_id: session.user.id, status: "pending" };
  const { error } = await supabase.from("match_requests").insert(payload);
  if (error) throw error;
  return true;
}

export async function cancelMyJoin(matchId) {
  if (!matchId) throw new Error("Falta matchId");
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const { error } = await supabase
    .from("match_requests")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", session.user.id);

  if (error) throw error;
  return true;
}

// ------------------------------
// MIS REQUESTS para matchIds
// ------------------------------
export async function fetchMyRequestsForMatchIds(matchIds = []) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) return {};

  const { data, error } = await supabase
    .from("match_requests")
    .select("*")
    .in("match_id", matchIds)
    .eq("user_id", session.user.id);

  if (error) throw error;

  const out = {};
  for (const r of data ?? []) out[r.match_id] = r;
  return out;
}

// ------------------------------
// CONTAR APROBADOS por matchId
// ------------------------------
export async function fetchApprovedCounts(matchIds = []) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};

  const { data, error } = await supabase
    .from("match_requests")
    .select("match_id, status")
    .in("match_id", matchIds);

  if (error) throw error;

  const out = {};
  for (const r of data ?? []) {
    if (r.status !== "approved") continue;
    out[r.match_id] = (out[r.match_id] || 0) + 1;
  }
  return out;
}

// ------------------------------
// PENDIENTES (solo creador por RLS)
// ------------------------------
export async function fetchPendingRequests(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const { data, error } = await supabase
    .from("match_requests")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function approveRequest({ requestId }) {
  if (!requestId) throw new Error("Falta requestId");
  const { error } = await supabase.from("match_requests").update({ status: "approved" }).eq("id", requestId);
  if (error) throw error;
}

export async function rejectRequest({ requestId }) {
  if (!requestId) throw new Error("Falta requestId");
  const { error } = await supabase.from("match_requests").update({ status: "rejected" }).eq("id", requestId);
  if (error) throw error;
}

// ------------------------------
// PREVIEW PARTIDOS POR CLUB (solo futuros)
// ------------------------------
export async function fetchMatchesForClubPreview({ clubId, clubName, limit = 5 }) {
  let q = supabase
    .from("matches")
    .select("id, club_id, club_name, start_at, duration_min, level")
    .gte("start_at", nowISO())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (clubId) q = q.eq("club_id", String(clubId));
  else if (clubName) q = q.eq("club_name", String(clubName));

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ------------------------------
// ELIMINAR PARTIDO
// ------------------------------
export async function deleteMatch(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw error;
}

// ------------------------------
// CHAT: mensajes
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

// ✅ ESTE ES EL IMPORTANTE (push real desde backend)
export async function sendMatchMessage({ matchId, message } = {}) {
  if (!matchId) throw new Error("Falta matchId");
  const text = String(message ?? "").trim();
  if (!text) throw new Error("Mensaje vacío");
  if (text.length > 1000) throw new Error("Máximo 1000 caracteres.");

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa.");

  // 1) Guardar mensaje (tu tabla usa "message" según tu doc)
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

  // 2) Disparar push desde backend (una llamada)
  // (el backend decide receptores, consulta sus subs con service role)
  try {
    const res = await fetch("/api/push-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        senderId: session.user.id,
        textPreview: text.slice(0, 140),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) console.warn("[push] /api/push-chat error:", res.status, json);
    else console.log("[push] /api/push-chat ok:", json);
  } catch (e) {
    console.warn("[push] /api/push-chat fallo (red):", e);
  }

  return data;
}
