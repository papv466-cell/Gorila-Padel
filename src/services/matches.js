// src/services/matches.js
import { supabase } from "./supabaseClient";

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
 * ✅ LOCAL vs VERCEL
 * - En Vercel: API_BASE = ""  → fetch("/api/..") normal
 * - En local:  API_BASE = "https://gorila-padel.vercel.app" para probar push
 *
 * Si quieres control fino, en tu .env.local pon:
 * VITE_API_BASE=https://gorila-padel.vercel.app
 */
function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE;
  if (envBase) return String(envBase).replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return "https://gorila-padel.vercel.app";
  }
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

  // Intentamos leer texto siempre (para debug)
  const txt = await r.text().catch(() => "");

  // Log útil siempre
  console.log(`[API ${path}] status=${r.status} body=${txt}`);

  // Si no es OK devolvemos info pero NO rompemos el flujo
  if (!r.ok) {
    console.warn(`[API ${path}] ❌ status=${r.status} body=${txt}`);
    return { ok: false, status: r.status, text: txt };
  }

  // Si es OK, intentamos parsear JSON (si lo hay)
  let json = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {}

  return { ok: true, status: r.status, text: txt, json };
}

/* =========================
   LISTAR PARTIDOS (futuros)
========================= */
export async function fetchMatches({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("start_at", startOfTodayISO())
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
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
export async function createMatch({
  clubId,
  clubName,
  startAtISO,
  durationMin = 90,
  level = "medio",
  alreadyPlayers = 1,
  pricePerPlayer = null,
} = {}) {
  const session = await getSessionOrThrow();

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

  if (pricePerPlayer != null && String(pricePerPlayer).trim() !== "") {
    payload.price_per_player = Number(pricePerPlayer);
  }

  const { data, error } = await supabase.from("matches").insert(payload).select("*").single();
  if (error) throw error;

  return data;
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

  // ✅ Push al creador (si falla NO rompe)
  try {
    const out = await callApi("/api/push-join", {
      session,
      body: { matchId: data.match_id, requestId: data.id },
    });

    // Si responde pero no envía, lo verás aquí
    if (out?.ok && out?.json && (out.json.sent ?? 0) === 0) {
      console.warn("⚠️ push-join NO enviado:", out.json);
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

// ✅ acepta { matchId, text } o { matchId, message }
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

    // ✅ Push chat (si falla, NO rompe)
    try {
      const session = await getSessionOrThrow();
  
      const r = await fetch("/api/push-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messageId: inserted.id }),
      });
  
      const txt = await r.text().catch(() => "");
      console.log("push-chat raw:", r.status, txt);
  
      if (!r.ok) console.warn("push-chat status:", r.status, txt);
      else {
        try {
          const j = JSON.parse(txt);
          console.log("push-chat json:", j);
          if ((j.sent ?? 0) === 0) console.warn("⚠️ push-chat NO enviado:", j);
        } catch {}
      }
    } catch (e) {
      console.warn("Push falló pero el mensaje se guardó:", e?.message || e);
    }  

  return inserted;
}

/* =========================
   REALTIME SUBSCRIPTIONS
========================= */
export function subscribeMatchesRealtime(onChange) {
  const channel = supabase
    .channel("rt:matches")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (payload) => {
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
