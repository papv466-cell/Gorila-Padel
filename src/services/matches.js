// src/services/matches.js
import { supabase } from "./supabaseClient";
import { sanitizeString, validateLevel, validateDuration, validatePlayers } from "../utils/validation";
import { 
  notifyMatchApproved, 
  notifyMatchRejected,
  notifyMatchRequest,
  notifyMatchInvite,
  notifyMatchTransferReceived,
  notifyMatchChat
} from './notifications';

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

export async function cancelMyJoin({ matchId }) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  const { error } = await supabase
    .from("match_players")
    .delete()
    .eq("match_id", matchId)
    .eq("player_uuid", uid);

  if (error) throw error;
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

  // Insertar creador en match_players
  try {
    await supabase.from("match_players").insert({
      match_id: row.id,
      player_uuid: data.userId,
    });
  } catch (e) {
    console.error("Error insertando creador en match_players:", e);
  }

  return row;

  return row;
}

export async function requestJoin(matchId, mood = null) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  // Obtener info del partido y creador
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, club_name, created_by_user")
    .eq("id", matchId)
    .single();

  if (matchError) throw matchError;

  // Obtener perfil del solicitante
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", uid)
    .single();

  const { data, error } = await supabase
    .from("match_join_requests")
    .insert({
      match_id: matchId,
      user_id: uid,
      status: "pending",
      mood: mood || null,
    })
    .select()
    .single();

  if (error) throw error;

  // NOTIFICAR AL CREADOR
  try {
    const { notifyMatchRequest } = await import('./notifications');
    await notifyMatchRequest({
      matchId: match.id,
      matchName: match.club_name,
      requesterId: uid,
      requesterName: profile?.full_name || profile?.email || 'Un jugador',
      creatorId: match.created_by_user
    });
  } catch (notifError) {
    console.error('Error sending notification:', notifError);
  }

  return data;
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
   .in("status", ["pending", "approved", "red_carded"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Enriquecer con perfiles manualmente
  const rows = data ?? [];
  const ids = rows.map(r => r.user_id).filter(Boolean);
  
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("id, name, handle, avatar_url")
      .in("id", ids);
    
    const profileMap = {};
    for (const p of profiles || []) profileMap[p.id] = p;
    
    return rows.map(r => ({
      ...r,
      profiles_public: profileMap[r.user_id] || null
    }));
  }

  return rows;
}

export async function approveRequest({ requestId }) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  // Primero obtener la solicitud con info del partido
  const { data: request, error: reqError } = await supabase
    .from("match_join_requests")
    .select("*, matches(id, club_name)")
    .eq("id", requestId)
    .single();

  if (reqError) throw reqError;



  // Aprobar
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

  if (error) throw error;

  // Insertar en match_players para que aparezca en el roster
  try {
    const { error: mpError } = await supabase
      .from("match_players")
      .insert({
        match_id: data.match_id,
        player_uuid: data.user_id,
      });
    if (mpError) console.error("Error insertando en match_players:", mpError);
  } catch (e) {
    console.error("Error match_players:", e);
  }

  // Notificar
  try {
    await notifyMatchApproved({
      matchId: request.match_id,
      matchName: request.matches?.club_name || 'Partido',
      creatorName: 'El organizador',
      userId: request.user_id
    });
  } catch (notifError) {
    console.error('Error sending notification:', notifError);
  }

  return data;
}

export async function rejectRequest({ requestId }) {
  const session = await getSessionOrThrow();
  const uid = session?.user?.id;

  // Obtener solicitud con info del partido
  const { data: request, error: reqError } = await supabase
    .from("match_join_requests")
    .select("*, matches(id, club_name)")
    .eq("id", requestId)
    .single();

  if (reqError) throw reqError;

  // Rechazar
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

  // Notificar
  try {
    await notifyMatchRejected({
      matchId: request.match_id,
      matchName: request.matches?.club_name || 'Partido',
      creatorName: 'El organizador',
      userId: request.user_id
    });
  } catch (notifError) {
    console.error('Error sending notification:', notifError);
  }

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

          // Obtener todos los jugadores del partido excepto el que envió
        const { data: players } = await supabase
        .from("match_players")
        .select("player_uuid")
        .eq("match_id", matchId)
        .neq("player_uuid", session.user.id);

        const { data: match } = await supabase
        .from("matches")
        .select("club_name, created_by_user")
        .eq("id", matchId)
        .single();

        // Obtener perfil del remitente
        const { data: sender } = await supabase
        .from("profiles_public")
        .select("name, handle")
        .eq("id", session.user.id)
        .single();

        // Notificar a todos menos al que envió
        const userIds = [...new Set([
        match?.created_by_user,
        ...(players || []).map(p => p.player_uuid)
        ].filter(id => id && id !== session.user.id))];

        if (userIds.length > 0) {
        try {
          await notifyMatchChat({
            matchId,
            matchName: match?.club_name || 'Partido',
            senderName: sender?.name || sender?.handle || 'Un jugador',
            message,
            userIds
          });
        } catch (notifError) {
          console.error('Error sending chat notifications:', notifError);
        }
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
/* =========================
   TARJETA ROJA GORILA
========================= */
export async function giveRedCard({ matchId, toUserId }) {
  const session = await getSessionOrThrow();
  const creatorId = session?.user?.id;

  // Verificar que quien da la tarjeta es el creador del partido
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("created_by_user")
    .eq("id", matchId)
    .single();
  if (matchError) throw matchError;
  if (String(match.created_by_user) !== String(creatorId)) throw new Error("Solo el creador puede dar tarjeta roja");

  // Verificar que el jugador estaba aprobado
  const { data: req, error: reqError } = await supabase
    .from("match_join_requests")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("user_id", toUserId)
    .eq("status", "approved")
    .single();
  if (reqError || !req) throw new Error("Este jugador no estaba en el partido");

  // Incrementar red_cards en profiles_public
  const { data: profile, error: profileError } = await supabase
    .from("profiles_public")
    .select("red_cards")
    .eq("id", toUserId)
    .single();
  if (profileError) throw profileError;

  const newCount = (Number(profile?.red_cards) || 0) + 1;
  const { error: updateError } = await supabase
    .from("profiles_public")
    .update({ red_cards: newCount })
    .eq("id", toUserId);
  if (updateError) throw updateError;

  // Marcar la solicitud con tarjeta roja
  await supabase
    .from("match_join_requests")
    .update({ status: "red_carded" })
    .eq("id", req.id);

  return { newCount };
}

export async function redeemRedCard({ userId }) {
  const { data: profile, error } = await supabase
    .from("profiles_public")
    .select("red_cards, matches_played")
    .eq("id", userId)
    .single();
  if (error) throw error;

  const cards = Number(profile?.red_cards) || 0;
  const played = Number(profile?.matches_played) || 0;
  if (cards <= 0) throw new Error("No tienes tarjetas rojas");
  if (played < 1) throw new Error("Necesitas jugar un partido para redimir una tarjeta");

  const { error: updateError } = await supabase
    .from("profiles_public")
    .update({ red_cards: cards - 1, matches_played: played - 1 })
    .eq("id", userId);
  if (updateError) throw updateError;

  return { red_cards: cards - 1 };
}
/* =========================
   SOS CUARTO JUGADOR
========================= */
export async function triggerSOS({ matchId }) {
  const session = await getSessionOrThrow();
  const creatorId = session?.user?.id;

  // Verificar que es el creador
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, club_name, level, start_at, created_by_user, reserved_spots")
    .eq("id", matchId)
    .single();
  if (matchError) throw matchError;
  if (String(match.created_by_user) !== String(creatorId)) throw new Error("Solo el creador puede activar SOS");

  // Marcar el partido como SOS activo
  const { error: updateError } = await supabase
    .from("matches")
    .update({ sos_active: true })
    .eq("id", matchId);
  if (updateError) throw updateError;

  // Buscar usuarios que NO están ya en el partido
  const { data: alreadyIn } = await supabase
    .from("match_join_requests")
    .select("user_id")
    .eq("match_id", matchId)
    .in("status", ["pending", "approved"]);

  const excludeIds = [creatorId, ...(alreadyIn||[]).map(r => r.user_id)];

  // Buscar todos los usuarios registrados excepto los ya dentro
  const { data: candidates } = await supabase
    .from("profiles_public")
    .select("id")
    .eq("sos_enabled", true)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(200);

  const userIds = (candidates||[]).map(u => u.id);
  if (userIds.length === 0) return { sent: 0 };

  // Formatear hora
  const s = String(match.start_at||"");
  const tm = s.match(/T(\d{2}:\d{2})/);
  const startTime = tm ? tm[1] : "";

  const { notifySOSMatch } = await import("./notifications");
  await notifySOSMatch({
    matchId,
    matchName: match.club_name,
    clubName: match.club_name,
    level: match.level || "",
    startTime,
    userIds,
  });

  return { sent: userIds.length };
}
/* =========================
   POST PARTIDO
========================= */
export async function submitMatchResult({ matchId, scoreLeft, scoreRight, notes, sets }) {
  const session = await getSessionOrThrow();
  const { data, error } = await supabase
    .from("match_results")
    .insert({ match_id: matchId, score_left: scoreLeft, score_right: scoreRight, notes: notes||null, sets: sets||[], created_by: session.user.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getMatchResult(matchId) {
  const { data, error } = await supabase
    .from("match_results")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitPlayerRating({ matchId, toUserId, rating, vibe }) {
  const session = await getSessionOrThrow();
  const { data, error } = await supabase
    .from("player_ratings")
    .upsert({ match_id: matchId, from_user_id: session.user.id, to_user_id: toUserId, rating, vibe: vibe||null },
      { onConflict: "match_id,from_user_id,to_user_id" })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getMyRatingsForMatch(matchId) {
  const session = await getSessionOrThrow();
  const { data, error } = await supabase
    .from("player_ratings")
    .select("to_user_id, rating, vibe")
    .eq("match_id", matchId)
    .eq("from_user_id", session.user.id);
  if (error) throw error;
  return data || [];
}