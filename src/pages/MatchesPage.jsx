// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import "./MatchesPage.css";

import {
  createMatch,
  fetchMatches,
  fetchMyRequestsForMatchIds,
  fetchApprovedCounts,
  requestJoin,
  cancelMyJoin,
  fetchPendingRequests,
  fetchMatchMessages,
  sendMatchMessage,
  approveRequest,
  rejectRequest,
  fetchLatestChatTimes,
  deleteMatch,
  subscribeMatchesRealtime,
  subscribeJoinRequestsRealtime,
  subscribeAllMatchMessagesRealtime,
  subscribeMatchMessagesRealtime,
} from "../services/matches";

import { fetchProfilesByIds } from "../services/profilesPublic";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";
import { scheduleEndWarningsForEvent, unscheduleEventWarnings } from "../services/gorilaSound";

import {
  notifyMatchInvite,
  notifyMatchTransferReceived,
} from "../services/notifications";

/* Utils */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) {
    const [y, mo, d] = m[1].split("-").map(Number);
    const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function combineDateTimeToISO(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
  const [hh, mm] = String(timeStr || "19:00").split(":").map((n) => Number(n));
  
  // Formato: 2026-02-19T19:00:00
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

function localYMDFromStartAt(startAt) {
  if (!startAt) return "";
  const s = String(startAt);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const dt = safeParseDate(startAt);
  return dt ? toDateInputValue(dt) : "";
}

function sortByStartAtAsc(list) {
  return [...(list || [])].sort((a, b) => {
    const da = safeParseDate(a.start_at);
    const db = safeParseDate(b.start_at);
    return (da?.getTime?.() || 0) - (db?.getTime?.() || 0);
  });
}

function upsertMatchSorted(prev, match) {
  const next = Array.isArray(prev) ? [...prev] : [];
  const idx = next.findIndex((x) => x.id === match.id);
  if (idx >= 0) next[idx] = { ...next[idx], ...match };
  else next.push(match);
  return sortByStartAtAsc(next);
}

function removeMatch(prev, matchId) {
  return Array.isArray(prev) ? prev.filter((x) => x.id !== matchId) : [];
}

function uniqById(list) {
  const seen = new Set();
  const out = [];
  for (const it of list || []) {
    const id = it?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function formatWhen(startAt) {
  try {
    if (!startAt) return "";
    const s = String(startAt);
    
    // Parsear formato ISO local: 2026-02-19T19:00:00
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [_, year, month, day, hour, minute] = match;
      const dt = new Date(+year, +month - 1, +day, +hour, +minute);
      
      return dt.toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    
    // Fallback
    return String(startAt);
  } catch {
    return String(startAt || "");
  }
}

export default function MatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const normStatus = (s) => String(s || "").trim().toLowerCase();

  const [playersByMatchId, setPlayersByMatchId] = useState({});
  const [rosterProfilesById, setRosterProfilesById] = useState({});
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  //OBTENER SESIÓN
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  
    return () => subscription.unsubscribe();
  }, []);

  const todayISO = toDateInputValue(new Date());
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const clubIdParam = searchParams.get("clubId") || "";
  const clubNameParam = searchParams.get("clubName") || "";
  const createParam = searchParams.get("create") === "1";
  const isClubFilter = !!clubIdParam || !!clubNameParam;

  const openChatFromUrl = qs.get("openChat") || "";
  const openRequestsParam = qs.get("openRequests") || "";
  const openChatFromStorage =
    (typeof window !== "undefined" && window.sessionStorage?.getItem?.("openChat")) || "";
  const openChatParam = openChatFromUrl || openChatFromStorage || "";

  const showPushButton = !!session;
  const debug = qs.get("debug") === "1";

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [inPlayersByMatchId, setInPlayersByMatchId] = useState({});
  const [latestChatTsByMatch, setLatestChatTsByMatch] = useState({});

  const [requestsOpenFor, setRequestsOpenFor] = useState(null);
  const [pending, setPending] = useState([]);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [profilesById, setProfilesById] = useState({});

  const [viewMode, setViewMode] = useState("mine");
  const [selectedDay, setSelectedDay] = useState(todayISO);

  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatItems, setChatItems] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [cedeOpenFor, setCedeOpenFor] = useState(null);
  const [cedeQuery, setCedeQuery] = useState("");
  const [cedeBusy, setCedeBusy] = useState(false);
  const [cedeResults, setCedeResults] = useState([]);

  const [inviteOpenFor, setInviteOpenFor] = useState(null);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSelected, setInviteSelected] = useState([]);

  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [clubsSheet, setClubsSheet] = useState([]);
  const [clubQuery, setClubQuery] = useState("");
  const [showClubSuggest, setShowClubSuggest] = useState(false);

  const [form, setForm] = useState({
    clubName: "",
    clubId: "",
    date: todayISO,
    time: "19:00",
    durationMin: 90,
    level: "medio",
    alreadyPlayers: 1,
    pricePerPlayer: "",
  });

  function closeAllModals() {
    setChatOpenFor(null);
    setRequestsOpenFor(null);
    setInviteOpenFor(null);
    setCedeOpenFor(null);
  }

  function openCreateModal() {
    setOpenCreate(true);
    setForm((prev) => ({ ...prev, date: selectedDay || todayISO }));
  }

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  function goLogin() {
    navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
  }

  useEffect(() => {
    if (!session) return;
    
    load();
    
    // Suscripción en tiempo real
    const channel = supabase
      .channel('matches-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'matches' }, 
        (payload) => {
          console.log('🔄 Cambio en matches:', payload);
          load(); // Recargar cuando haya cambios
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        await ensurePushSubscription();
      } catch (e) {
        if (!cancelled && debug) console.log("🔔 ensurePushSubscription falló:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, debug]);

  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => {
        setClubsSheet(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        setClubsSheet([]);
      });
  }, []);

  async function fetchInPlayersMap(matchIds, uid) {
    const out = {};
    if (!uid || !matchIds?.length) return out;
    const uidNoDashes = String(uid).replace(/-/g, "");
    const candidatePlayerIds = Array.from(new Set([String(uid), `u_${uid}`, `u_${uidNoDashes}`].filter(Boolean)));
    try {
      const { data, error } = await supabase
        .from("match_players")
        .select("match_id")
        .in("match_id", matchIds)
        .eq("player_uuid", String(uid));
      if (!error) {
        for (const r of data || []) out[String(r.match_id)] = true;
        return out;
      }
    } catch {}
    try {
      const { data, error } = await supabase
        .from("match_players")
        .select("match_id, player_id")
        .in("match_id", matchIds)
        .in("player_id", candidatePlayerIds);
      if (!error) {
        for (const r of data || []) out[String(r.match_id)] = true;
      }
    } catch {}
    return out;
  }

  async function fetchRosterProfilesByMatch(matchIds) {
    if (!matchIds?.length) return {};
    let rows = [];
    try {
      const { data, error } = await supabase.from("match_players").select("match_id, player_uuid").in("match_id", matchIds);
      if (!error && Array.isArray(data)) {
        rows = data.map((r) => ({ match_id: r.match_id, user_id: r.player_uuid })).filter((r) => r.user_id);
      }
    } catch {}
    if (!rows.length) {
      try {
        const { data, error } = await supabase.from("match_players").select("match_id, player_id").in("match_id", matchIds);
        if (!error && Array.isArray(data)) {
          rows = data.map((r) => ({ match_id: r.match_id, user_id: r.player_id })).filter((r) => r.user_id);
        }
      } catch {}
    }
    if (!rows.length) return {};
    const mapIds = {};
    const allUserIds = new Set();
    for (const r of rows) {
      const mid = String(r.match_id);
      const uid = String(r.user_id);
      if (!mapIds[mid]) mapIds[mid] = [];
      mapIds[mid].push(uid);
      allUserIds.add(uid);
    }
    const profiles = await fetchProfilesByIds(Array.from(allUserIds));
    const enriched = {};
    for (const [mid, uids] of Object.entries(mapIds)) {
      enriched[mid] = (uids || []).map((uid) => profiles?.[String(uid)]).filter(Boolean);
    }
    return enriched;
  }

  async function load() {
    try {
      setStatus({ loading: true, error: null });
      const list = await fetchMatches({ limit: 400 });
      if (!aliveRef.current) return;
      const unique = uniqById(list);
      setItems(sortByStartAtAsc(unique));

      const ids = unique.map((m) => m.id);

      const my = await fetchMyRequestsForMatchIds(ids);
      if (!aliveRef.current) return;
      setMyReqStatus(my || {});

      try {
        const uid = session?.user?.id ? String(session.user.id) : "";
        const map = await fetchInPlayersMap(ids, uid);
        if (aliveRef.current) setInPlayersByMatchId(map || {});
      } catch {
        if (aliveRef.current) setInPlayersByMatchId({});
      }

      const counts = await fetchApprovedCounts(ids);
      if (!aliveRef.current) return;
      setApprovedCounts(counts || {});

      const latest = await fetchLatestChatTimes(ids);
      if (!aliveRef.current) return;
      setLatestChatTsByMatch(latest || {});

      try {
        const creatorIds = Array.from(new Set((unique || []).map((m) => m?.created_by_user).filter(Boolean).map(String)));
        if (creatorIds.length) {
          const profs = await fetchProfilesByIds(creatorIds);
          if (aliveRef.current) {
            setRosterProfilesById((prev) => ({ ...prev, ...(profs || {}) }));
          }
        }
      } catch {
        setRosterProfilesById({});
      }

      try {
        const roster = await fetchRosterProfilesByMatch(ids);
        if (aliveRef.current) setPlayersByMatchId(roster || {});
      } catch {
        if (aliveRef.current) setPlayersByMatchId({});
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setStatus({ loading: false, error: e?.message || "No se pudieron cargar los partidos" });
      setItems([]);
    } finally {
      if (!aliveRef.current) return;
      setStatus((s) => ({ ...s, loading: false }));
    }
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session?.user?.id]);

  useEffect(() => {
    const unsub1 = subscribeMatchesRealtime((payload) => {
      const t = payload?.eventType;
      const row = payload?.new || payload?.old;
      if (!row?.id) return;
      if (t === "DELETE") setItems((prev) => removeMatch(prev, row.id));
      else setItems((prev) => upsertMatchSorted(prev, row));
    });
    const unsub2 = subscribeJoinRequestsRealtime(() => load());
    const unsub3 = subscribeAllMatchMessagesRealtime(() => load());
    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    const onPush = (e) => {
      const p = e?.detail || {};
      const title = String(p.title || "Gorila Pádel");
      const body = String(p.body || "");
      if (body) toast.success(`${title}: ${body}`);
      else toast.success(title);
      if (debug) console.log("📩 gp:push", p);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("gp:push", onPush);
      return () => window.removeEventListener("gp:push", onPush);
    }
  }, [toast, debug]);

  useEffect(() => {
    if (!openChatParam) return;
    if (!authReady) return;
    if (!session) {
      goLogin();
      return;
    }
    try {
      window.sessionStorage?.removeItem?.("openChat");
    } catch {}
    openChat(openChatParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatParam, authReady, session]);

  useEffect(() => {
    if (!openRequestsParam) return;
    if (!authReady) return;
    if (!session) {
      goLogin();
      return;
    }
    openRequests(openRequestsParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequestsParam, authReady, session]);

  useEffect(() => {
    if (!createParam) return;
    if (!authReady) return;
    if (!session) {
      goLogin();
      return;
    }
    setOpenCreate(true);
    setForm((prev) => ({
      ...prev,
      clubId: clubIdParam || prev.clubId,
      clubName: clubNameParam || prev.clubName,
      date: selectedDay || prev.date || todayISO,
    }));
    setClubQuery(clubNameParam || "");
    setShowClubSuggest(false);
  }, [createParam, clubIdParam, clubNameParam, authReady, session, todayISO, selectedDay]);

  const filteredList = useMemo(() => {
    let list = items;
    if (clubIdParam) list = list.filter((m) => String(m.club_id) === String(clubIdParam));
    if (selectedDay) list = list.filter((m) => localYMDFromStartAt(m.start_at) === selectedDay);
    return list;
  }, [items, clubIdParam, selectedDay]);

  const myList = useMemo(() => {
    if (!session) return [];
    const uid = String(session.user.id);
    return filteredList.filter((m) => {
      const st = normStatus(myReqStatus?.[m.id]);
      return String(m.created_by_user) === uid || st === "approved" || st === "pending";
    });
  }, [filteredList, myReqStatus, session]);

  const visibleList = viewMode === "mine" ? myList : filteredList;

  useEffect(() => {
    if (!authReady) return;
    const uid = session?.user?.id ? String(session.user.id) : "";
    const desired = new Set();
    for (const m of visibleList || []) {
      const isCreator = uid && String(m.created_by_user) === uid;
      const myStatus2 = myReqStatus?.[m.id] || null;
      const myStatusNorm = String(myStatus2 || "").trim().toLowerCase();
      if (!isCreator && myStatus2 !== "approved") continue;
      const startMs = safeParseDate(m.start_at)?.getTime?.();
      const durMin = Number(m.duration_min) || 90;
      const endMs = Number.isFinite(startMs) ? startMs + durMin * 60 * 1000 : NaN;
      if (!Number.isFinite(endMs)) continue;
      const key = `match:${m.id}`;
      desired.add(key);
      scheduleEndWarningsForEvent({ key, endMs, warn5MinTimes: 2, endTimes: 4 });
    }
    unscheduleEventWarnings((key) => key.startsWith("match:") && !desired.has(key));
  }, [authReady, session?.user?.id, visibleList, myReqStatus, debug]);

  function addDays(dateStr, deltaDays) {
    const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
    const now = new Date();
    const base = new Date(
      Number.isFinite(y) ? y : now.getFullYear(),
      Number.isFinite(m) ? m - 1 : now.getMonth(),
      Number.isFinite(d) ? d : now.getDate(),
      0,
      0,
      0,
      0
    );
    base.setDate(base.getDate() + deltaDays);
    return toDateInputValue(base);
  }

  function fmtDayLabel(dateStr) {
    try {
      const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
      const now = new Date();
      const dt = new Date(
        Number.isFinite(y) ? y : now.getFullYear(),
        Number.isFinite(m) ? m - 1 : now.getMonth(),
        Number.isFinite(d) ? d : now.getDate(),
        0,
        0,
        0,
        0
      );
      return dt.toLocaleDateString("es-ES", { weekday: "short" });
    } catch {
      return "";
    }
  }

  const calendarDays = useMemo(() => {
    const base = selectedDay || todayISO;
    const out = [];
    for (let i = -3; i <= 10; i++) out.push(addDays(base, i));
    return out;
  }, [selectedDay, todayISO]);

  const dayCounts = useMemo(() => {
    let list = items;
    if (clubIdParam) list = list.filter((m) => String(m.club_id) === String(clubIdParam));
    const map = {};
    for (const m of list || []) {
      const k = localYMDFromStartAt(m.start_at);
      if (!k) continue;
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [items, clubIdParam]);

  async function searchPublicProfiles(q) {
    const query = String(q || "").trim();
    if (query.length < 3) return [];
    const { data, error } = await supabase
      .from("profiles_public")
      .select("id, name, handle, avatar_url")
      .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
      .limit(12);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  useEffect(() => {
    let t = null;
    const q = cedeQuery.trim();
    if (q.length < 3) {
      setCedeResults([]);
      return;
    }
    t = setTimeout(async () => {
      try {
        const rows = await searchPublicProfiles(q);
        if (!aliveRef.current) return;
        setCedeResults(rows);
      } catch {
        if (!aliveRef.current) return;
        setCedeResults([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [cedeQuery]);

  useEffect(() => {
    let t = null;
    const q = inviteQuery.trim();
    if (q.length < 3) {
      setInviteResults([]);
      return;
    }
    t = setTimeout(async () => {
      try {
        const rows = await searchPublicProfiles(q);
        if (!aliveRef.current) return;
        setInviteResults(rows);
      } catch {
        if (!aliveRef.current) return;
        setInviteResults([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [inviteQuery]);

  async function transferSpot({ matchId, toUserId }) {
    if (!session) return goLogin();
    if (!matchId || !toUserId) return;
    setCedeBusy(true);
    try {
      const { error } = await supabase.rpc("gp_transfer_match_spot", {
        p_match_id: matchId,
        p_to_user_id: toUserId,
      });
      if (error) throw error;
      toast.success("Plaza cedida ✅");
      setCedeOpenFor(null);
      setCedeQuery("");
      setCedeResults([]);
      await load();
  
      // NOTIFICACIÓN AQUÍ DENTRO
      try {
        const { data: match } = await supabase
          .from("matches")
          .select("club_name")
          .eq("id", matchId)
          .single();
      
        const { data: fromUser } = await supabase
          .from("profiles_public")
          .select("name, handle")
          .eq("id", session.user.id)
          .single();
      
        await notifyMatchTransferReceived({
          matchId,
          matchName: match?.club_name || 'Partido',
          fromUserName: fromUser?.name || fromUser?.handle || 'Un jugador',
          toUserId: toUserId
        });
      } catch (notifError) {
        console.error('Error sending transfer notification:', notifError);
      }
  
    } catch (e) {
      toast.error(e?.message || "No se pudo ceder la plaza");
    } finally {
      setCedeBusy(false);
    }
  }

  async function sendInvites({ matchId, userIds }) {
    if (!session) return goLogin();
    const uniq = Array.from(new Set((userIds || []).map(String).filter(Boolean))).slice(0, 10);
    if (!matchId || uniq.length === 0) return;
    setInviteBusy(true);
    try {
      const { data: existing, error: exErr } = await supabase
        .from("match_invites")
        .select("to_user_id")
        .eq("match_id", matchId)
        .in("to_user_id", uniq);
      if (exErr) throw exErr;
  
      const existingSet = new Set((existing || []).map((r) => String(r.to_user_id)));
      const toInsert = uniq.filter((id) => !existingSet.has(String(id)));
  
      if (toInsert.length === 0) {
        toast.success("Ya estaban invitados ✅");
        setInviteOpenFor(null);
        setInviteQuery("");
        setInviteResults([]);
        setInviteSelected([]);
        return;
      }
  
      const payload = toInsert.map((to) => ({
        match_id: matchId,
        from_user_id: session.user.id,
        to_user_id: to,
      }));
      const { error } = await supabase.from("match_invites").insert(payload);
      if (error) throw error;
  
      // NOTIFICACIONES AQUÍ
      try {
        const { data: match } = await supabase
          .from("matches")
          .select("club_name")
          .eq("id", matchId)
          .single();
  
        const { data: fromUser } = await supabase
          .from("profiles_public")
          .select("name, handle")
          .eq("id", session.user.id)
          .single();
  
        // Notificar a cada invitado
        for (const toUserId of toInsert) {
          await notifyMatchInvite({
            matchId,
            matchName: match?.club_name || 'Partido',
            fromUserId: session.user.id,
            fromUserName: fromUser?.name || fromUser?.handle || 'Un jugador',
            toUserId
          });
        }
      } catch (notifError) {
        console.error('Error sending invite notifications:', notifError);
      }
  
      toast.success(`Invitaciones enviadas ✅ (${toInsert.length})`);
      setInviteOpenFor(null);
      setInviteQuery("");
      setInviteResults([]);
      setInviteSelected([]);
    } catch (e) {
      toast.error(e?.message || "No se pudieron enviar invitaciones");
    } finally {
      setInviteBusy(false);
    }
  }

  async function openRequests(matchId) {
    try {
      closeAllModals();
      setRequestsOpenFor(matchId);
      setPendingBusy(true);

      const rows = await fetchPendingRequests(matchId);
      setPending(Array.isArray(rows) ? rows : []);

      // Construir profilesById desde los datos del JOIN
      const profs = {};
      for (const r of rows || []) {
        if (r.profiles_public) {
          profs[String(r.user_id)] = r.profiles_public;
        }
      }
      setProfilesById(profs);
    } catch (e) {
      toast.error(e?.message || "No pude cargar solicitudes");
      setPending([]);
    } finally {
      setPendingBusy(false);
    }
  }

  async function handleApprove(requestId) {
    try {
      await approveRequest({ requestId });
      
      // NOTIFICACIÓN AL SOLICITANTE
      try {
        const request = pending.find(r => r.id === requestId);
        if (request) {
          const { data: match } = await supabase
            .from("matches")
            .select("id, club_name")
            .eq("id", requestsOpenFor)
            .single();
          
            const { notifyMatchApproved } = await import('../services/notifications');
            await notifyMatchApproved({
            matchId: match.id,
            matchName: match.club_name,
            toUserId: request.user_id
          });
        }
      } catch (notifError) {
        console.error('Error sending approval notification:', notifError);
      }
      
      await openRequests(requestsOpenFor);
      toast.success("Aprobado");
      await load();
    } catch (e) {
      toast.error(e?.message ?? "No se pudo aprobar");
    }
  }

  async function handleReject(requestId) {
    try {
      await rejectRequest({ requestId });
      
      // NOTIFICACIÓN AL SOLICITANTE
      try {
        const request = pending.find(r => r.id === requestId);
        if (request) {
          const { data: match } = await supabase
            .from("matches")
            .select("id, club_name")
            .eq("id", requestsOpenFor)
            .single();
          
          const { notifyMatchRejected } = await import('../services/notifications');
          await notifyMatchRejected({
            matchId: match.id,
            matchName: match.club_name,
            toUserId: request.user_id
          });
        }
      } catch (notifError) {
        console.error('Error sending rejection notification:', notifError);
      }
      
      await openRequests(requestsOpenFor);
      toast.success("Rechazado");
      await load();
    } catch (e) {
      toast.error(e?.message ?? "No se pudo rechazar");
    }
  }

  async function handleLeave(matchId) {
    try {
      await cancelMyJoin(matchId);
      toast.success("Has salido del partido");
      await load();
    } catch (e) {
      toast.error(e?.message || "No se pudo salir del partido");
    }
  }

  async function handleDelete(matchId) {
    const ok = confirm("¿Seguro que quieres eliminar este partido? Esto no se puede deshacer.");
    if (!ok) return;
    try {
      await deleteMatch(matchId);
      toast.success("Partido eliminado");
      await load();
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar el partido");
    }
  }

  const clubSuggestions = useMemo(() => {
    const q = (clubQuery || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return (clubsSheet || [])
      .filter((c) => String(c?.name || "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [clubQuery, clubsSheet]);

  function pickClub(c) {
    const id = String(c?.id ?? "");
    const name = String(c?.name ?? "");
    setForm((prev) => ({ ...prev, clubId: id, clubName: name }));
    setClubQuery(name);
    setShowClubSuggest(false);
  }

  async function handleCreate() {
    console.log("🚀 INICIO handleCreate - session:", !!session);
    if (!session) return goLogin();
    try {
      setSaveError(null);
      setSaving(true);
      const startAtISO = combineDateTimeToISO(form.date, form.time);
  
      if (!String(form.clubName || "").trim()) throw new Error("Pon el nombre del club.");
      if (!String(form.clubId || "").trim()) throw new Error("Selecciona el club de la lista.");
  
      await createMatch({
        clubId: form.clubId,
        clubName: form.clubName,
        startAtISO,
        durationMin: Number(form.durationMin) || 90,
        level: form.level,
        alreadyPlayers: Number(form.alreadyPlayers) || 1,
        pricePerPlayer: form.pricePerPlayer,
        userId: session.user.id,
      });

      
  
      // Actualizar fecha seleccionada
      setSelectedDay(form.date);
      
      // Cerrar modal
      setOpenCreate(false);
      
      // Resetear formulario
      setForm({
        clubName: "",
        clubId: "",
        date: todayISO,
        time: "19:00",
        durationMin: 90,
        level: "medio",
        alreadyPlayers: 1,
        pricePerPlayer: "",
      });
      setClubQuery("");
      
      toast.success("Partido creado ✅");

        console.log("🔥 DEBUG: Después de crear partido");
        console.log("🔥 selectedDay:", form.date);
        console.log("🔥 viewMode será:", 'mine');

        // Recargar partidos
        await load();
      
      // FORZAR VISTA "LOS MÍOS" para ver el partido recién creado
      setViewMode('mine');
  
      // Obtener perfil del creador
      try {
        const { data: profile, error } = await supabase
          .from("profiles_public")
          .select("id, name, handle, avatar_url")
          .eq("id", session.user.id)
          .single();
        if (!error && profile && aliveRef.current) {
          setRosterProfilesById((prev) => ({ ...prev, [String(session.user.id)]: profile }));
        }
      } catch {}
      
    } catch (e) {
      setSaveError(e?.message || "No se pudo crear el partido");
      toast.error(e?.message || "No se pudo crear el partido");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    if (!session) return goLogin();
    try {
      setPushBusy(true);
      await ensurePushSubscription();
      toast.success("Push activado");
    } catch (e) {
      console.error(e);
      toast.error("Error push: " + (e?.message || String(e)));
    } finally {
      setPushBusy(false);
    }
  }

  async function openChat(matchId) {
    try {
      closeAllModals();
      setChatOpenFor(matchId);
      setChatItems([]);
      setChatText("");
      setChatLoading(true);
      const rows = await fetchMatchMessages(matchId);
      setChatItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e?.message || "No pude abrir el chat");
      setChatItems([]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSendChat() {
    if (!chatOpenFor) return;
    try {
      const message = chatText.trim();
      if (!message) return;
      setChatText("");
      
      await sendMatchMessage({ matchId: chatOpenFor, message });
      
      // NOTIFICACIÓN A PARTICIPANTES
      try {
        const { data: match } = await supabase
          .from("matches")
          .select("id, club_name, created_by_user")
          .eq("id", chatOpenFor)
          .single();
        
        const { data: players } = await supabase
          .from("match_players")
          .select("player_uuid")
          .eq("match_id", chatOpenFor);
        
        const { data: senderProfile } = await supabase
          .from("profiles_public")
          .select("name, handle")
          .eq("id", session.user.id)
          .single();
        
        // Notificar a todos excepto al que envió el mensaje
        const participants = new Set([match.created_by_user, ...(players || []).map(p => p.player_uuid)]);
        participants.delete(session.user.id);
        
        const { notifyMatchMessage } = await import('../services/notifications');
        for (const userId of participants) {
          await notifyMatchMessage({
            matchId: match.id,
            matchName: match.club_name,
            fromUserId: session.user.id,
            fromUserName: senderProfile?.name || senderProfile?.handle || 'Un jugador',
            toUserId: userId,
            messagePreview: message.substring(0, 50)
          });
        }
      } catch (notifError) {
        console.error('Error sending chat notification:', notifError);
      }
      
      const rows = await fetchMatchMessages(chatOpenFor);
      setChatItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e?.message || "No pude enviar");
    }
  }

  useEffect(() => {
    if (!chatOpenFor) return;
    const unsub = subscribeMatchMessagesRealtime(chatOpenFor, async () => {
      try {
        const rows = await fetchMatchMessages(chatOpenFor);
        if (!aliveRef.current) return;
        setChatItems(Array.isArray(rows) ? rows : []);
      } catch {}
    });
    return () => unsub?.();
  }, [chatOpenFor]);

  useEffect(() => {
    const inputFecha = document.querySelector('.gpRow .gpInput[type="date"]');
    if (!inputFecha || !selectedDay) return;
    const partidosEseDia = dayCounts[selectedDay] || 0;
    if (partidosEseDia > 0) inputFecha.classList.add("hasMatches");
    else inputFecha.classList.remove("hasMatches");
  }, [selectedDay, dayCounts]);

  return (
    <div className="page pageWithHeader gpMatchesPage">
      <div className="pageWrap">
        <div className="container">
          {/* HEADER */}
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Partidos</h1>
              <div className="pageMeta">
                {status.loading ? "Cargando…" : `${visibleList.length} partido(s)`}
                {isClubFilter ? ` · Club: ${clubNameParam || clubIdParam}` : ""}
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="gpActions">
            <div
              className="gpCalendarStrip"
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                padding: "8px 0",
                WebkitOverflowScrolling: "touch",
              }}
            >
                {calendarDays.map((d) => {
                const isActive = d === selectedDay;
                const hasMatches = (dayCounts[d] || 0) > 0;

                return (
                  <button
                    key={d}
                    className={`gpDayPill ${isActive ? "isActive" : ""} ${hasMatches ? "hasMatches" : ""}`}
                    onClick={() => setSelectedDay(d)}
                  >
                    <div className="gpDayLabel">{fmtDayLabel(d)}</div>
                    <div className="gpDayNumber">{d.slice(8, 10)}</div>
                  </button>
                );
              })}
            </div>

            <div className="gpRow">
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Día:</div>
              <input className="gpInput" type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
            </div>

            {!isClubFilter ? (
              <div className="gpSegmented">
                <button className={viewMode === "mine" ? "isActive" : ""} onClick={() => setViewMode("mine")}>
                  Los míos
                </button>
                <button className={viewMode === "all" ? "isActive" : ""} onClick={() => setViewMode("all")}>
                  Todos
                </button>
              </div>
            ) : null}

            <button
              className="btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreateModal();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                openCreateModal();
              }}
              style={{ position: "relative", zIndex: 999999, pointerEvents: "auto", touchAction: "manipulation" }}
            >
              ➕ Crear
            </button>

            {showPushButton ? (
              <button className="btn ghost" onClick={handleEnablePush} disabled={pushBusy}>
                {pushBusy ? "Activando…" : "🔔 Push"}
              </button>
            ) : null}
          </div>

          {/* GRID */}
          <div className="gpMatchesSnapWrap">
            <ul className="gpMatchesGrid">
            {visibleList.map((m) => {
  const myStatusRaw = myReqStatus?.[m.id] ?? null;
  const myStatus2 = normStatus(myStatusRaw);
  const isCreator = !!(session?.user?.id && String(m.created_by_user) === String(session.user.id));
  const occupied = Math.min(4, (Number(m.reserved_spots) || 1) + (approvedCounts[m.id] || 0));
  const left = Math.max(0, 4 - occupied);
  const iAmInPlayers = !!inPlayersByMatchId?.[String(m.id)];
  const iAmInside = isCreator || iAmInPlayers || myStatus2 === "approved" || myStatus2 === "pending";

  const creatorId = m.created_by_user ? String(m.created_by_user) : "";
  const creatorProf = rosterProfilesById?.[creatorId] || null;
  const creatorName = (creatorProf?.name && String(creatorProf.name).trim()) || (creatorProf?.handle && String(creatorProf.handle).trim()) || "Creador";
  const creatorAvatar = creatorProf?.avatar_url || "";

  const roster = (playersByMatchId?.[String(m.id)] || []).filter((p) => String(p?.id || "") !== creatorId).slice(0, 3);

  // Equipo izquierdo: Creador + 1 jugador
  const leftTeam = [
    { name: creatorName, avatar: creatorAvatar, isCreator: true },
    roster[0] || null
  ];

  // Equipo derecho: 2 jugadores restantes
  const rightTeam = [
    roster[1] || null,
    roster[2] || null
  ];

  return (
    <li key={m.id} className="gpMatchCard">

      <div className="gpMatchHeader" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
  <div className="gpClubName">📍 {m.club_name}</div>
  <div style={{fontSize:'10px', fontWeight:800, color:'#fff', flexShrink:0, marginLeft:8}}>
    {isCreator && '👑 Creador'}
    {myStatus2 === 'approved' && '✅ Dentro'}
    {myStatus2 === 'pending' && '⏳ Pendiente'}
  </div>
</div>

 {/* ROSTER CON VS */}
      <div className="gpMatchRoster">
   <div className="gpTeamSide left">
  {[0,1].map((idx) => {
    const player = leftTeam[idx];
    return (
      <div key={idx} className="gpPlayerAvatar">
        {player?.avatar ? <img src={player.avatar} alt="" />
          : player?.avatar_url ? <img src={player.avatar_url} alt="" />
          : <span style={{fontSize:24}}>🦍</span>}
      </div>
    );
  })}
</div>

<img src="/images/vs-icon.png" alt="VS" className="gpVsIcon" />

<div className="gpTeamSide right">
  {[0,1].map((idx) => {
    const player = rightTeam[idx];
    return (
      <div key={idx} className="gpPlayerAvatar">
        {player?.avatar_url ? <img src={player.avatar_url} alt="" />
          : player?.avatar ? <img src={player.avatar} alt="" />
          : <span style={{fontSize:24}}>🦍</span>}
      </div>
    );
  })}
</div>
      </div>

      {/* INFO CHIPS */}
      <div className="gpMatchInfo">
        <div className="gpInfoChip" style={{fontSize:'9px'}}>🗓️ {formatWhen(m.start_at)}</div>
        <div className="gpInfoChip" style={{fontSize:'9px'}}>⏱️ {m.duration_min} min</div>
        <div className="gpInfoChip" style={{fontSize:'9px'}}>🎚️ {String(m.level || "").toUpperCase()}</div>
      </div>

      <div className="gpDivider" />

      {/* ACTION BUTTONS */}
      <div className="gpMatchActions">
        {!session && <button className="gpActionBtn primary" onClick={goLogin}>PARTICIPAR</button>}
        
        {session && !isCreator && !myStatus2 && left > 0 && (
          <button className="gpActionBtn primary" onClick={async () => {
            try {
              await requestJoin(m.id);
              toast.success("Solicitud enviada");
              await load();
            } catch (e) {
              toast.error(e?.message || "No se pudo enviar la solicitud");
            }
          }}>PARTICIPAR</button>
        )}

        {isCreator && (
          <button className="gpActionBtn secondary" onClick={() => openRequests(m.id)} title="Solicitudes">📥</button>
        )}

        {session && (isCreator || myStatus2 === "approved" || iAmInPlayers) && (
          <button className="gpActionBtn secondary" onClick={() => {
            closeAllModals(); setCedeOpenFor(m.id); setCedeQuery(""); setCedeResults([]);
          }} title="Ceder plaza">🤝</button>
        )}

        {session && iAmInside && (
          <button className="gpActionBtn secondary" onClick={() => openChat(m.id)} title="Chat">💬</button>
        )}

        {session && isCreator && (
          <button className="gpActionBtn secondary" onClick={() => {
            closeAllModals(); setInviteOpenFor(m.id); setInviteQuery(""); setInviteResults([]); setInviteSelected([]);
          }} title="Invitar">📣</button>
        )}

       {session && isCreator && (
          <button className="gpActionBtn danger" onClick={() => handleDelete(m.id)} title="Eliminar">🗑️</button>
        )}
      </div>
    </li>
  );
})}
            </ul>
          </div>

          {status.error ? <div style={{ marginTop: 12, color: "#dc2626", fontWeight: 900 }}>{status.error}</div> : null}
        </div>
      </div>

      {/* ===========================
         MODAL: CREAR
      =========================== */}
      {openCreate && (
        <div
          className="modal"
          onClick={() => setOpenCreate(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid rgba(116, 184, 0, 0.2)",
            }}
          >
            <h2 style={{ color: "#74B800", marginBottom: "20px", fontSize: "22px", fontWeight: 900 }}>➕ Crear Partido</h2>

            {saveError ? (
              <div
                style={{
                  background: "rgba(220, 38, 38, 0.2)",
                  padding: "12px",
                  borderRadius: "10px",
                  color: "#ff6b6b",
                  marginBottom: "16px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {saveError}
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                  Club *
                </label>
                <input
                  type="text"
                  value={clubQuery}
                  onChange={(e) => {
                    setClubQuery(e.target.value);
                    setShowClubSuggest(true);
                  }}
                  placeholder="Buscar club..."
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {showClubSuggest && clubSuggestions.length > 0 ? (
                  <div
                    style={{
                      background: "#2a2a2a",
                      borderRadius: "10px",
                      marginTop: "8px",
                      maxHeight: "200px",
                      overflowY: "auto",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {clubSuggestions.map((c, idx) => (
                      <div
                        key={c.id || idx}
                        onClick={() => pickClub(c)}
                        style={{
                          padding: "12px",
                          cursor: "pointer",
                          borderBottom: idx < clubSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          color: "#fff",
                          fontSize: "14px",
                          transition: "background 0.2s",
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    disabled={saving}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Hora
                  </label>
                  <input
                    type="time"
                    step="900"
                    value={form.time}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':');
                      const roundedMinute = Math.round(+m / 15) * 15;
                      const formattedTime = `${h}:${String(roundedMinute % 60).padStart(2, '0')}`;
                      setForm({ ...form, time: formattedTime });
                    }}
                    disabled={saving}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
               </div>

              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                  Nivel
                </label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="iniciacion" style={{ background: "#1a1a1a" }}>Iniciación</option>
                  <option value="medio" style={{ background: "#1a1a1a" }}>Medio</option>
                  <option value="alto" style={{ background: "#1a1a1a" }}>Alto</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: parseInt(e.target.value) || 90 })}
                    disabled={saving}
                    min="30"
                    max="180"
                    step="15"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Precio/jugador €
                  </label>
                  <input
                    type="number"
                    value={form.pricePerPlayer}
                    onChange={(e) => setForm({ ...form, pricePerPlayer: e.target.value })}
                    disabled={saving}
                    placeholder="10"
                    min="0"
                    step="0.5"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "12px",
                    background: saving ? "rgba(116, 184, 0, 0.5)" : "linear-gradient(135deg, #74B800 0%, #9BE800 100%)",
                    color: "#000",
                    fontWeight: 900,
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontSize: "15px",
                    boxShadow: "0 4px 12px rgba(116, 184, 0, 0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {saving ? "⏳ Creando..." : "✅ Crear Partido"}
                </button>

                <button
                  onClick={() => setOpenCreate(false)}
                  disabled={saving}
                  style={{
                    padding: "14px 20px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontSize: "15px",
                    transition: "all 0.2s",
                  }}
                >
                  ❌
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ===========================
    MODAL: CHAT
=========================== */}
{chatOpenFor ? (
  <div
    className="modal gpModal"
    onClick={() => setChatOpenFor(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.65)",
      zIndex: 30000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
      boxSizing: "border-box",
      overflow: "hidden",
      overscrollBehavior: "contain",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(640px, calc(100% - 24px))",
        maxWidth: "min(640px, calc(100% - 24px))",
        overflowX: "hidden",
        background: "#111",
        transform: "translateZ(0)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.14)",
        padding: 12,
        boxSizing: "border-box",
        maxHeight: "70vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ fontWeight: 900, color: "#74B800" }}>💬 Chat del partido</div>
        <button className="btn ghost" onClick={() => setChatOpenFor(null)}>❌</button>
      </div>

      <div
        style={{
          marginTop: 10,
          flex: "1 1 auto",
          minHeight: 160,
          overflowY: "auto",
          paddingRight: 6,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {chatLoading ? (
          <div style={{ color: "#fff", opacity: 0.75, fontWeight: 700 }}>Cargando…</div>
        ) : chatItems.length === 0 ? (
          <div style={{ color: "#fff", opacity: 0.75, fontWeight: 700 }}>Aún no hay mensajes.</div>
        ) : (
          chatItems.map((it, idx) => (
            <div key={it.id || idx} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>
                {it.author_name || it.author || "Jugador"}
              </div>
              <div style={{ color: "#fff", opacity: 0.9, fontSize: 13, overflowWrap: "anywhere" }}>
                {it.message || it.text || ""}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Barra escribir: 100% fija y sin desbordar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendChat();
        }}
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          width: "100%",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Escribe…"
          style={{
            width: "100%",
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          className="btn"
          style={{
            width: 96,
            minWidth: 96,
            whiteSpace: "nowrap",
            fontWeight: 900,
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  </div>
) : null}

      {/* ===========================
         MODAL: SOLICITUDES
      =========================== */}
      {requestsOpenFor ? (
        <div
          className="modal"
          onClick={() => setRequestsOpenFor(null)}
          style={{
            position: "fixed",
            left: 0, right: 0, top: 0, bottom: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 28000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 640,
              background: "#111",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              padding: 12,
              maxHeight: "80vh",
              overflow: "auto",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, color: "#74B800" }}>📥 Solicitudes</div>
              <button className="btn ghost" onClick={() => setRequestsOpenFor(null)}>❌</button>
            </div>

            <div style={{ marginTop: 10 }}>
              {pendingBusy ? (
                <div style={{ color: "#fff", opacity: 0.75, fontWeight: 800 }}>Cargando…</div>
              ) : pending.length === 0 ? (
                <div style={{ color: "#fff", opacity: 0.75, fontWeight: 800 }}>No hay solicitudes pendientes.</div>
              ) : (
                pending.map((r) => {
                  const pid = String(r.user_id || "");
                  const p = profilesById?.[pid] || null;
                  const name =
                    (p?.name && String(p.name).trim()) ||
                    (p?.handle && String(p.handle).trim()) ||
                    pid.slice(0, 8);

                  return (
                    <div
                      key={r.id}
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ color: "#fff", fontWeight: 900 }}>{name}</div>
                        <div style={{ color: "#fff", opacity: 0.7, fontSize: 12 }}>@{p?.handle || pid.slice(0, 6)}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => handleApprove(r.id)} style={{ fontWeight: 900 }}>
                          Aprobar
                        </button>
                        <button className="btn ghost" onClick={() => handleReject(r.id)} style={{ fontWeight: 900 }}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ===========================
         MODAL: INVITAR
      =========================== */}
      {inviteOpenFor ? (
        <div
          className="modal"
          onClick={() => setInviteOpenFor(null)}
          style={{
            position: "fixed",
            left: 0, right: 0, top: 0, bottom: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 29000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(640px, calc(100% - 24px))",
              maxWidth: "min(640px, calc(100% - 24px))",
              overflowX: "hidden",
              background: "#111",
              transform: "translateZ(0)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              padding: 12,
              maxHeight: "70vh",
              overflow: "auto",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, color: "#74B800" }}>📣 Invitar</div>
              <button className="btn ghost" onClick={() => setInviteOpenFor(null)}>❌</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                placeholder="Busca por nombre o @handle… (mín. 3 letras)"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {inviteSelected.length > 0 ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {inviteSelected.map((id) => (
                    <button
                      key={id}
                      className="btn ghost"
                      onClick={() => setInviteSelected((prev) => prev.filter((x) => x !== id))}
                    >
                      ✅ {String(id).slice(0, 8)} ✕
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: 10 }}>
                {inviteQuery.trim().length < 3 ? (
                  <div style={{ color: "#fff", opacity: 0.7, fontWeight: 700 }}>
                    Escribe al menos 3 letras para buscar.
                  </div>
                ) : inviteResults.length === 0 ? (
                  <div style={{ color: "#fff", opacity: 0.7, fontWeight: 700 }}>
                    Sin resultados.
                  </div>
                ) : (
                  inviteResults.map((p) => {
                    const pid = String(p.id);
                    const name =
                      (p?.name && String(p.name).trim()) ||
                      (p?.handle && String(p.handle).trim()) ||
                      pid.slice(0, 8);

                    const selected = inviteSelected.includes(pid);

                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          setInviteSelected((prev) => {
                            if (prev.includes(pid)) return prev.filter((x) => x !== pid);
                            return [...prev, pid].slice(0, 10);
                          });
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          marginTop: 8,
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: selected ? "rgba(116,184,0,0.18)" : "rgba(255,255,255,0.04)",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {selected ? "✅ " : ""}{name}
                        </div>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>
                          @{p?.handle || pid.slice(0, 6)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  className="btn"
                  disabled={inviteBusy || inviteSelected.length === 0}
                  onClick={() => sendInvites({ matchId: inviteOpenFor, userIds: inviteSelected })}
                  style={{ fontWeight: 900, flex: 1, opacity: inviteBusy || inviteSelected.length === 0 ? 0.6 : 1 }}
                >
                  {inviteBusy ? "Enviando…" : `Enviar invitaciones (${inviteSelected.length})`}
                </button>

                <button
                  className="btn ghost"
                  onClick={() => {
                    setInviteQuery("");
                    setInviteResults([]);
                    setInviteSelected([]);
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===========================
         MODAL: CEDER PLAZA
      =========================== */}
      {cedeOpenFor ? (
        <div
        className="modal"
        onClick={() => setCedeOpenFor(null)}
        style={{
          position: "fixed",
          left: 0, right: 0, top: 0, bottom: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 26000,
          display: "flex",
          alignItems: "center", // ERA "flex-end"
          justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 640,
              background: "#111",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              padding: 12,
              maxHeight: "80vh",
              overflow: "auto",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, color: "#74B800" }}>🤝 Ceder plaza</div>
              <button className="btn ghost" onClick={() => setCedeOpenFor(null)}>❌</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                value={cedeQuery}
                onChange={(e) => setCedeQuery(e.target.value)}
                placeholder="Busca a quién ceder (mín. 3 letras)…"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <div style={{ marginTop: 10 }}>
                {cedeQuery.trim().length < 3 ? (
                  <div style={{ color: "#fff", opacity: 0.7, fontWeight: 700 }}>
                    Escribe al menos 3 letras para buscar.
                  </div>
                ) : cedeResults.length === 0 ? (
                  <div style={{ color: "#fff", opacity: 0.7, fontWeight: 700 }}>
                    Sin resultados.
                  </div>
                ) : (
                  cedeResults.map((p) => {
                    const pid = String(p.id);
                    const name =
                      (p?.name && String(p.name).trim()) ||
                      (p?.handle && String(p.handle).trim()) ||
                      pid.slice(0, 8);

                    return (
                      <div
                        key={pid}
                        style={{
                          marginTop: 8,
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.04)",
                          color: "#fff",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>{name}</div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            @{p?.handle || pid.slice(0, 6)}
                          </div>
                        </div>

                        <button
                          className="btn"
                          disabled={cedeBusy}
                          onClick={() => transferSpot({ matchId: cedeOpenFor, toUserId: pid })}
                          style={{ fontWeight: 900, opacity: cedeBusy ? 0.6 : 1 }}
                        >
                          {cedeBusy ? "Cediendo…" : "Ceder"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}