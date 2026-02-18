// src/services/matches.js
import { supabase } from "./supabaseClient";
import { sanitizeString, validateLevel, validateDuration, validatePlayers } from "../utils/validation";

/* =========================
   Utils
========================= */
function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getSessionOrThrow() {
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa.");
  return session;
}

/**
 * ✅ MISMO ORIGEN SIEMPRE
 * - En Vercel: /api/... va a las serverless functions
 * - En local:  /api/... lo pilla el proxy de Vite (vite.config.js)
 */
function getApiBase() {
  return "";
}

async function callApi(path, { method = "POST", session, body } = {}) {
  const API_BASE = getApiBase();
  const url = `${API_BASE}${path}`;

  const r = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const txt = await r.text().catch(() => "");
  let json = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {}

  console.log(`[API ${path}] status=${r.status}`, json ?? txt);

  if (!r.ok) {
    console.warn(`[API ${path}] ❌ status=${r.status}`, json ?? txt);
    return { ok: false, status: r.status, text: txt, json };
  }

  return { ok: true, status: r.status, text: txt, json };
}

/* =========================
   LISTAR PARTIDOS (futuros)
========================= */
export async function fetchMatches({ limit = 400 } = {}) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/* =========================
   ÚLTIMO MENSAJE POR PARTIDO
   Devuelve: { [matchId]: timestamp_ms }
========================= */
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

/* =========================
   CREAR PARTIDO
========================= */
export async function createMatch(data) {
  console.log('🔍 createMatch recibió:', data);
  
  // Validar nombre del club
  const clubName = sanitizeString(data.clubName, 200);
  if (!clubName) {
    throw new Error('El nombre del club es obligatorio');
  }
  
  // Validar otros campos
  const level = validateLevel(data.level);
  const durationMin = validateDuration(data.durationMin);
  const playersNeeded = validatePlayers(data.alreadyPlayers || 1);
  
  // ✅ CORRECCIÓN: El formulario envía startAtISO, no date/time separados
  const startAt = data.startAtISO;
  
  console.log('🔍 startAt recibido:', startAt);
  
  if (!startAt) {
    throw new Error('Fecha y hora son obligatorias');
  }
  
  // Verificar que la fecha sea futura
  const startDate = new Date(startAt);
  if (!startDate || !Number.isFinite(startDate.getTime())) {
    throw new Error('Fecha inválida');
  }
  
  if (startDate <= new Date()) {
    throw new Error('La fecha debe ser futura');
  }

  console.log('✅ Validación OK, insertando en BD...');

  const { data: row, error } = await supabase
    .from("matches")
    .insert({
      club_id: data.clubId || null,
      club_name: clubName,
      level,
      duration_min: durationMin,
      players_needed: playersNeeded,
      reserved_spots: playersNeeded, // ✅ Añadido para compatibilidad
      start_at: startAt,
      // notes: sanitizeString(data.notes || '', 500),
      price_per_player: data.pricePerPlayer ? Number(data.pricePerPlayer) : null,
      created_by_user: data.userId,
    })
    .select()
    .single();

  if (error) {
    console.error("[CREATE_MATCH_ERROR]", error);
    throw new Error(error.message || "No se pudo crear el partido");
  }

  console.log('✅ Partido creado:', row);
  return row;
}

/* =========================
   SOLICITAR UNIRSE
========================= */
export async function requestJoin(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const session = await getSessionOrThrow();

  const payload = { match_id: matchId, user_id: session.user.id, status: "pending" };

  const { data, error } = await supabase
    .from("match_join_requests")
    .insert(payload)
    .select("id, match_id")
    .single();

  if (error) throw error;

  // ✅ Push al creador (NO rompe si falla)
  try {
    const out = await callApi("/api/push-join", {
      session,
      body: { matchId: data.match_id, requestId: data.id },
    });

    if (out?.ok && out?.json && (out.json.sent ?? 0) === 0) {
      console.warn("⚠️ push-join respondió OK pero NO envió:", out.json);
    }
  } catch (e) {
    console.warn("Push join falló pero la solicitud se guardó:", e?.message || e);
  }

  return true;
}

export async function cancelMyJoin(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const session = await getSessionOrThrow();

  const { error } = await supabase
    .from("match_join_requests")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", session.user.id);

  if (error) throw error;
  return true;
}

/* =========================
   MIS REQUESTS para matchIds
   Devuelve: { [matchId]: status }
========================= */
export async function fetchMyRequestsForMatchIds(matchIds = []) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};

  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const session = sessData?.session;
  if (!session?.user) return {};

  const { data, error } = await supabase
    .from("match_join_requests")
    .select("match_id, status")
    .in("match_id", matchIds)
    .eq("user_id", session.user.id);

  if (error) throw error;

  const out = {};
  for (const r of data ?? []) out[r.match_id] = r.status;
  return out;
}

/* =========================
   CONTAR APROBADOS por matchId
========================= */
export async function fetchApprovedCounts(matchIds = []) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};

  const { data, error } = await supabase
    .from("match_join_requests")
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

/* =========================
   PENDIENTES
========================= */
export async function fetchPendingRequests(matchId) {
  if (!matchId) throw new Error("Falta matchId");

  const { data, error } = await supabase
    .from("match_join_requests")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function approveRequest({ requestId }) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  const { data, error } = await supabase
    .from("match_join_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: uid,
    })
    .eq("id", requestId)
    .select("id,status,match_id,user_id")
    .single();

  if (error) throw error;
  return data;
}

export async function rejectRequest({ requestId }) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  const { data, error } = await supabase
    .from("match_join_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: uid,
    })
    .eq("id", requestId)
    .select("id,status,match_id,user_id")
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   PREVIEW PARTIDOS POR CLUB (futuros)
========================= */
export async function fetchMatchesForClubPreview({ clubId, clubName, limit = 5 }) {
  let q = supabase
    .from("matches")
    .select("id, club_id, club_name, start_at, duration_min, level")
    .gte("start_at", startOfTodayISO())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (clubId) q = q.eq("club_id", String(clubId));
  else if (clubName) q = q.eq("club_name", String(clubName));

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/* =========================
   ELIMINAR PARTIDO
========================= */
export async function deleteMatch(matchId) {
  if (!matchId) throw new Error("Falta matchId");
  await getSessionOrThrow();

  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw error;
  return true;
}

/* =========================
   CHAT: mensajes
========================= */
export async function fetchMatchMessages(matchId, opts = {}) {
  const limit = opts?.limit ?? 120;

  const { data, error } = await supabase
    .from("match_messages")
    .select("id, match_id, user_id, message, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function sendMatchMessage({ matchId, text, message } = {}) {
  if (!matchId) throw new Error("Falta matchId");

  const msg = String((text ?? message) ?? "").trim();
  if (!msg) throw new Error("Mensaje vacío");
  if (msg.length > 1000) throw new Error("Máximo 1000 caracteres.");

  const session = await getSessionOrThrow();

  const { data: inserted, error: insErr } = await supabase
    .from("match_messages")
    .insert([
      {
        match_id: matchId,
        user_id: session.user.id,
        message: msg,
      },
    ])
    .select("id, match_id")
    .single();

  if (insErr) throw insErr;

  try {
    const out = await callApi("/api/push-chat", {
      session,
      body: { messageId: inserted.id },
    });

    if (out?.ok && out?.json && (out.json.sent ?? 0) === 0) {
      console.warn("⚠️ push-chat respondió OK pero NO envió:", out.json);
    }
  } catch (e) {
    console.warn("Push chat falló pero el mensaje se guardó:", e?.message || e);
  }

  return inserted;
}

/* =========================
   REALTIME SUBSCRIPTIONS
========================= */
export function subscribeMatchesRealtime(onChange) {
  const channel = supabase
    .channel("rt:matches")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches_v2" }, (payload) => {
      try {
        onChange?.(payload);
      } catch (e) {
        console.warn("onChange matches realtime error", e);
      }
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

export function subscribeJoinRequestsRealtime(onChange) {
  const channel = supabase
    .channel("rt:join-requests")
    .on("postgres_changes", { event: "*", schema: "public", table: "match_join_requests" }, (payload) => {
      try {
        onChange?.(payload);
      } catch (e) {
        console.warn("onChange join_requests realtime error", e);
      }
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

export function subscribeAllMatchMessagesRealtime(onPayload) {
  const channel = supabase
    .channel("rt:match_messages_all")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_messages" }, (payload) =>
      onPayload?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeMatchMessagesRealtime(matchId, onChange) {
  const mid = String(matchId || "");
  if (!mid) return () => {};

  const channel = supabase
    .channel(`rt:match-messages:${mid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_messages", filter: `match_id=eq.${mid}` },
      (payload) => {
        try {
          onChange?.(payload);
        } catch (e) {
          console.warn("onChange match_messages realtime error", e);
        }
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}