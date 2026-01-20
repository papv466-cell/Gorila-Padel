// src/services/matches.js
import { supabase } from "./supabaseClient";
import { ensurePushSubscription } from "../services/push";

useEffect(() => {
  if (!session) return;

  // intentamos activar push sin molestar demasiado
  ensurePushSubscription().catch(() => {
    // no hacemos alert aquí para no ser pesados
    // luego si quieres lo mostramos en Perfil/Ajustes con un botón
  });
}, [session]);

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
// ÚLTIMO MENSAJE POR PARTIDO (para badge)
// Devuelve: { [matchId]: timestamp_ms }
// ------------------------------
export async function fetchLatestChatTimes(matchIds = []) {
  if (!matchIds.length) return {};

  const { data, error } = await supabase
    .from("match_messages")
    .select("match_id, created_at")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const out = {};
  for (const row of data ?? []) {
    const id = row.match_id;
    if (out[id]) continue; // ya tenemos el mas reciente de ese match
    const ts = new Date(row.created_at).getTime();
    out[id] = Number.isFinite(ts) ? ts : 0;
  }
  return out;
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

  const { data, error } = await supabase
    .from("match_requests")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", session.user.id)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
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
// POPUP MAPA: preview de partidos para un club (solo futuros)
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

  // 1) Guardar el mensaje
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

  // 2) Sacar participantes del partido (menos yo)
  // ⚠️ Necesitamos saber cómo se llama tu tabla de participantes:
  // - match_participants (recomendado)
  // - o match_requests con status=approved
  //
  // Vamos a probar primero con match_requests approved (porque ya la usas en la app)
  const { data: approvedUsers, error: apprErr } = await supabase
    .from("match_requests")
    .select("user_id")
    .eq("match_id", matchId)
    .eq("status", "approved");

  if (apprErr) {
    // si falla, no rompemos el chat
    return data;
  }

  const targetUserIds = (approvedUsers ?? [])
    .map((r) => r.user_id)
    .filter((uid) => uid && uid !== session.user.id);

  if (targetUserIds.length === 0) return data;

  // 3) Buscar endpoints de esos usuarios
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .in("user_id", targetUserIds);

  if (subsErr || !subs?.length) return data;

  // 4) Mandar push (TOC TOC) a cada endpoint
  for (const s of subs) {
    if (!s?.endpoint) continue;

    supabase.functions
      .invoke("push-chat", {
        body: { endpoint: s.endpoint },
      })
      .catch(() => {});
  }

  return data;
}

