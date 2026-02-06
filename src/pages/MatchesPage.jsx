// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

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

// ✅ avisos sonoros (NO TOCAR)
import { scheduleEndWarningsForEvent, unscheduleEventWarnings } from "../services/gorilaSound";

/* Utils */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ parse robusto para fechas
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

// ✅ Construcción segura LOCAL → ISO UTC
function combineDateTimeToISO(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
  const [hh, mm] = String(timeStr || "19:00").split(":").map((n) => Number(n));

  const now = new Date();
  const dt = new Date(
    Number.isFinite(y) ? y : now.getFullYear(),
    Number.isFinite(m) ? m - 1 : now.getMonth(),
    Number.isFinite(d) ? d : now.getDate(),
    Number.isFinite(hh) ? hh : 19,
    Number.isFinite(mm) ? mm : 0,
    0,
    0
  );

  return dt.toISOString();
}

// ✅ Clave día local robusta desde start_at
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
    const dt = safeParseDate(startAt);
    if (!dt) return String(startAt || "");
    return dt.toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(startAt || "");
  }
}

export default function MatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ✅ roster real por partido (match_id -> [profiles])
  const [playersByMatchId, setPlayersByMatchId] = useState({});

  // Perfiles para avatar del creador (solo UI)
  const [rosterProfilesById, setRosterProfilesById] = useState({});

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

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

  /* Data */
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [inPlayersByMatchId, setInPlayersByMatchId] = useState({});
  const [latestChatTsByMatch, setLatestChatTsByMatch] = useState({});

  /* Requests modal (creator) */
  const [requestsOpenFor, setRequestsOpenFor] = useState(null);
  const [pending, setPending] = useState([]);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [profilesById, setProfilesById] = useState({});

  /* Tabs/filter */
  const [viewMode, setViewMode] = useState("mine");
  const [selectedDay, setSelectedDay] = useState(todayISO);

  /* Chat modal */
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatItems, setChatItems] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  /* ✅ CEDER */
  const [cedeOpenFor, setCedeOpenFor] = useState(null);
  const [cedeQuery, setCedeQuery] = useState("");
  const [cedeBusy, setCedeBusy] = useState(false);
  const [cedeResults, setCedeResults] = useState([]);

  /* ✅ INVITAR */
  const [inviteOpenFor, setInviteOpenFor] = useState(null);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSelected, setInviteSelected] = useState([]);

  /* Create modal */
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  /* Push button state */
  const [pushBusy, setPushBusy] = useState(false);

  /* Clubs suggest */
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

  // ✅ Abrir modal Crear sincronizando el día
  function openCreateModal() {
    setOpenCreate(true);
    setForm((prev) => ({
      ...prev,
      date: selectedDay || todayISO,
    }));
  }

  // evita setState after unmount
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

  /* Session load */
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s ?? null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ Asegurar suscripción push al tener sesión (silencioso)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, debug]);

  /* initial clubs (sheet) */
  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => {
        console.log('🏟️ Clubs cargados:', rows.length);
        setClubsSheet(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error('❌ Error cargando clubs:', err);
        setClubsSheet([]);
      });
  }, []);

  // ✅ helper: "estoy dentro" leyendo match_players sin romper según schema
  async function fetchInPlayersMap(matchIds, uid) {
    const out = {};
    if (!uid || !matchIds?.length) return out;

    const uidNoDashes = String(uid).replace(/-/g, "");
    const candidatePlayerIds = Array.from(
      new Set([String(uid), `u_${uid}`, `u_${uidNoDashes}`].filter(Boolean))
    );

    // 1) intento player_uuid
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

      const msg = String(error?.message || "").toLowerCase();
      if (!msg.includes('column "player_uuid"')) {
        // seguimos a fallback igualmente
      }
    } catch {
      // seguimos a fallback
    }

    // 2) fallback player_id
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

  // ✅ roster real por partido (match_players -> profiles)
  async function fetchRosterProfilesByMatch(matchIds) {
    if (!matchIds?.length) return {};

    // intentamos leer player_uuid; si no existe, fallback player_id
    let rows = [];
    try {
      const { data, error } = await supabase
        .from("match_players")
        .select("match_id, player_uuid")
        .in("match_id", matchIds);

      if (!error && Array.isArray(data)) {
        rows = data.map((r) => ({ match_id: r.match_id, user_id: r.player_uuid })).filter((r) => r.user_id);
      } else {
        const msg = String(error?.message || "").toLowerCase();
        if (!msg.includes('column "player_uuid"')) {
          // si es otro error, seguimos a fallback igualmente
        }
      }
    } catch {
      // fallback
    }

    if (!rows.length) {
      try {
        const { data, error } = await supabase
          .from("match_players")
          .select("match_id, player_id")
          .in("match_id", matchIds);

        if (!error && Array.isArray(data)) {
          rows = data.map((r) => ({ match_id: r.match_id, user_id: r.player_id })).filter((r) => r.user_id);
        }
      } catch {
        // nada
      }
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

  /* load matches + status */
  async function load() {
    try {
      setStatus({ loading: true, error: null });

      const list = await fetchMatches({ limit: 400 });
      if (!aliveRef.current) return;

      const unique = uniqById(list);
      setItems(sortByStartAtAsc(unique));

      const ids = unique.map((m) => m.id);

      // Mis requests
      const my = await fetchMyRequestsForMatchIds(ids);
      if (!aliveRef.current) return;
      setMyReqStatus(my || {});

      // mapa "estoy dentro"
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

      // perfiles creador
      try {
        const creatorIds = Array.from(
          new Set((unique || []).map((m) => m?.created_by_user).filter(Boolean).map(String))
        );
        if (creatorIds.length) {
          const profs = await fetchProfilesByIds(creatorIds);
          if (aliveRef.current) setRosterProfilesById(profs || {});
        } else {
          setRosterProfilesById({});
        }
      } catch {
        setRosterProfilesById({});
      }

      // ✅ roster real
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

  /* realtime */
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

  /* ✅ Push dentro de la app abierta */
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

  /* auto-open chat */
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

  /* auto-open requests */
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

  /* auto-open create if coming from map */
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

  /* Lists */
  const filteredList = useMemo(() => {
    let list = items;

    if (clubIdParam) list = list.filter((m) => String(m.club_id) === String(clubIdParam));

    if (selectedDay) {
      list = list.filter((m) => localYMDFromStartAt(m.start_at) === selectedDay);
    }

    return list;
  }, [items, clubIdParam, selectedDay]);

  const myList = useMemo(() => {
    if (!session) return [];
    return filteredList.filter((m) => {
      const st = myReqStatus[m.id];
      return m.created_by_user === session.user.id || st === "approved" || st === "pending";
    });
  }, [filteredList, myReqStatus, session]);

  const visibleList = viewMode === "mine" ? myList : filteredList;

  /* =========================
     ⏱️ Avisos sonoros (NO TOCAR)
  ========================= */
  useEffect(() => {
    if (!authReady) return;

    const uid = session?.user?.id ? String(session.user.id) : "";
    const desired = new Set();

    for (const m of visibleList || []) {
      const isCreator = uid && String(m.created_by_user) === uid;
      const myStatus = myReqStatus?.[m.id] || null;

      if (debug) {
        console.log("match", m.id, { myStatus, isCreator });
      }
      
      if (!isCreator && myStatus !== "approved") continue;

      const startMs = safeParseDate(m.start_at)?.getTime?.();
      const durMin = Number(m.duration_min) || 90;
      const endMs = Number.isFinite(startMs) ? startMs + durMin * 60 * 1000 : NaN;
      if (!Number.isFinite(endMs)) continue;

      const key = `match:${m.id}`;
      desired.add(key);

      scheduleEndWarningsForEvent({
        key,
        endMs,
        warn5MinTimes: 2,
        endTimes: 4,
      });
    }

    unscheduleEventWarnings((key) => key.startsWith("match:") && !desired.has(key));
  }, [authReady, session?.user?.id, visibleList, myReqStatus, debug]);

  // =========
  // Calendar helpers
  // =========
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

  // =========
  // Búsqueda pública de perfiles (CEDER / INVITAR)
  // =========
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

  // Debounce CEDER
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedeQuery]);

  // Debounce INVITAR
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setRequestsOpenFor(matchId);
      setPendingBusy(true);

      const rows = await fetchPendingRequests(matchId);
      setPending(Array.isArray(rows) ? rows : []);

      const ids = (rows || []).map((r) => r.user_id);
      const profs = await fetchProfilesByIds(ids);
      setProfilesById(profs || {});
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
      await openRequests(requestsOpenFor);
      toast.success("Aprobado");
    } catch (e) {
      toast.error(e?.message ?? "No se pudo aprobar");
    }
  }

  async function handleReject(requestId) {
    try {
      await rejectRequest({ requestId });
      await openRequests(requestsOpenFor);
      toast.success("Rechazado");
    } catch (e) {
      toast.error(e?.message ?? "No se pudo rechazar");
    }
  }

  async function handleLeave(matchId) {
    try {
      await cancelMyJoin(matchId);
      toast.success("Has salido del partido");
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

  /* Create helpers */
  const clubSuggestions = useMemo(() => {
    const q = (clubQuery || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    
    console.log('🔍 Buscando clubs con query:', q);
    console.log('📋 Total clubs disponibles:', clubsSheet.length);
    
    const results = (clubsSheet || [])
      .filter((c) => {
        const name = String(c?.name || "").toLowerCase();
        const matches = name.includes(q);
        if (matches) console.log('✅ Match:', c.name);
        return matches;
      })
      .slice(0, 10);
    
    console.log('📊 Resultados encontrados:', results.length);
    return results;
  }, [clubQuery, clubsSheet]);

  function pickClub(c) {
    const id = String(c?.id ?? "");
    const name = String(c?.name ?? "");
    console.log('✅ Club seleccionado:', { id, name });
    setForm((prev) => ({ ...prev, clubId: id, clubName: name }));
    setClubQuery(name);
    setShowClubSuggest(false);
  }

  async function handleCreate() {
    if (!session) return goLogin();

    try {
      setSaveError(null);
      setSaving(true);

      const startAtISO = combineDateTimeToISO(form.date, form.time);

      console.log('🔍 Validando formulario:', {
        clubName: form.clubName,
        clubId: form.clubId,
        date: form.date,
        time: form.time,
        startAtISO,
      });

      if (!String(form.clubName || "").trim()) {
        throw new Error("Pon el nombre del club.");
      }
      
      if (!String(form.clubId || "").trim()) {
        throw new Error("Selecciona el club de la lista (para evitar errores).");
      }

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

      setSelectedDay(form.date);
      setOpenCreate(false);
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
      await load();
    } catch (e) {
      console.error('❌ Error al crear partido:', e);
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

  /* Chat */
  async function openChat(matchId) {
    try {
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

      const rows = await fetchMatchMessages(chatOpenFor);
      setChatItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e?.message || "No pude enviar");
    }
  }

  // ✅ realtime cuando chat abierto
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

  return (
    <div className="page gpMatchesPage">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Partidos</h1>
              <div className="pageMeta">
                {status.loading ? "Cargando…" : `${visibleList.length} partido(s)`}
                {isClubFilter ? ` · Club: ${clubNameParam || clubIdParam}` : ""}
              </div>
            </div>

            <div className="gpActions" style={{ justifyContent: "flex-end" }}>
              <div className="gpCalendarStrip" role="tablist" aria-label="Calendario de partidos">
                {calendarDays.map((d) => {
                  const isActive = d === selectedDay;
                  const count = dayCounts[d] || 0;

                  return (
                    <button
                      key={d}
                      type="button"
                      className={`gpDayPill ${isActive ? "isActive" : ""}`}
                      onClick={() => setSelectedDay(d)}
                      title={count ? `${count} partido(s)` : "Sin partidos"}
                    >
                      <div className="gpDow">{fmtDayLabel(d)}</div>
                      <div className="gpDom">{d.slice(8, 10)}</div>
                      {count ? <div className="gpDot" /> : <div className="gpDot isOff" />}
                    </button>
                  );
                })}
              </div>

              <div className="gpRow">
                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Día:</div>
                <input
                  className="gpInput"
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={{ width: 170 }}
                />
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

              <button className="btn" onClick={openCreateModal}>
                ➕ Crear
              </button>

              {showPushButton ? (
                <button className="btn ghost" onClick={handleEnablePush} disabled={pushBusy}>
                  {pushBusy ? "Activando…" : "🔔 Push"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="gpMatchesSnapWrap">
          <ul className="gpMatchesGrid gpMatchesSnapList" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {visibleList.map((m) => {
              const myStatus = myReqStatus?.[m.id] || null;
              const isCreator = !!(session?.user?.id && String(m.created_by_user) === String(session.user.id));

              const occupied = Math.min(4, (Number(m.reserved_spots) || 1) + (approvedCounts[m.id] || 0));
              const left = Math.max(0, 4 - occupied);

              const iAmInPlayers = !!inPlayersByMatchId?.[String(m.id)];
              const iAmInside = isCreator || iAmInPlayers || myStatus === "approved" || myStatus === "pending";

              // ✅ creador (solo UI)
              const creatorId = m.created_by_user ? String(m.created_by_user) : "";
              const creatorProf = rosterProfilesById?.[creatorId] || null;
              const creatorName =
                (creatorProf?.name && String(creatorProf.name).trim()) ||
                (creatorProf?.handle && String(creatorProf.handle).trim()) ||
                "Creador";
              const creatorAvatar = creatorProf?.avatar_url || "";

              // ✅ roster real: cogemos hasta 3 perfiles (sin duplicar creador)
              const roster = (playersByMatchId?.[String(m.id)] || [])
                .filter((p) => String(p?.id || "") !== creatorId)
                .slice(0, 3);

              const slotProfile = (idx) => roster[idx] || null;

              const Slot = ({ prof, fallbackMeta }) => {
                const name =
                  (prof?.name && String(prof.name).trim()) ||
                  (prof?.handle && String(prof.handle).trim()) ||
                  "Jugador";
                const avatar = prof?.avatar_url || "";

                return (
                  <div className={`gpSlot ${prof ? "" : "gpSlotEmpty"}`}>
                    {avatar ? (
                      <img className="gpSlotImg" src={avatar} alt={name} />
                    ) : (
                      <div className="gpSlotImg" style={{ display: "grid", placeItems: "center", fontWeight: 1000 }}>
                        🦍
                      </div>
                    )}
                    <div className="gpSlotText">
                      <div className="gpSlotName">{prof ? name : ""}</div>
                      <div className="gpSlotMeta">{prof ? "@"+(prof?.handle || String(prof?.id||"").slice(0,6)) : fallbackMeta}</div>
                    </div>
                  </div>
                );
              };

              return (
                <li key={m.id} className="gpMatchCard gpMatchSnapCard">
                  {/* ROSTER (UI + REAL) */}
                  <div className="gpRoster">
                    <div className="gpTeam">
                      {/* creador */}
                      <div className="gpSlot">
                        {creatorAvatar ? (
                          <img className="gpSlotImg" src={creatorAvatar} alt={creatorName} />
                        ) : (
                          <div className="gpSlotImg" style={{ display: "grid", placeItems: "center", fontWeight: 1000 }}>
                            🦍
                          </div>
                        )}
                        <div className="gpSlotText">
                          <div className="gpSlotName">{creatorName}</div>
                          <div className="gpSlotMeta">Creador</div>
                        </div>
                      </div>

                      {/* slot 2 */}
                      <Slot prof={slotProfile(0)} fallbackMeta="Falta jugador…" />
                    </div>

                    <div className="gpVs">VS</div>

                    <div className="gpTeam">
                      <Slot prof={slotProfile(1)} fallbackMeta="Aquí puede ir alguien" />
                      <Slot prof={slotProfile(2)} fallbackMeta="¿Te apuntas?" />
                    </div>
                  </div>

                  <div className="gpHeadline">{m.club_name}</div>

                  <div className="gpCaption">
                    <div className="gpChip">🗓️ {formatWhen(m.start_at)}</div>
                    <div className="gpChip">⏱️ {m.duration_min} min</div>
                    <div className="gpChip">🎚️ {String(m.level || "").toUpperCase()}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {myStatus === "approved" ? (
                      <span className="meta" style={{ fontWeight: 950 }}>
                        ✅ Estás dentro
                      </span>
                    ) : null}
                    {myStatus === "pending" ? (
                      <span className="meta" style={{ fontWeight: 950 }}>
                        ⏳ Pendiente
                      </span>
                    ) : null}
                    {myStatus === "rejected" ? (
                      <span className="meta" style={{ fontWeight: 950 }}>
                        ❌ Rechazado
                      </span>
                    ) : null}
                    {isCreator ? (
                      <span className="meta" style={{ fontWeight: 950 }}>
                        👑 Eres creador
                      </span>
                    ) : null}
                    {latestChatTsByMatch[m.id] ? (
                      <span className="meta" style={{ fontWeight: 950 }}>
                        💬 Chat activo
                      </span>
                    ) : null}
                  </div>

                  <div className="gpDivider" />

                  <div className="gpActionBar">
                    <div className="gpActionLeft">
                      {isCreator ? (
                        <button type="button" className="btn ghost gpIconBtn" onClick={() => openRequests(m.id)}>
                          📥 Solicitudes
                        </button>
                      ) : null}

                      {session && !isCreator && (myStatus === "approved" || iAmInPlayers) ? (
                        <button
                          type="button"
                          className="btn ghost gpIconBtn"
                          onClick={() => {
                            setCedeOpenFor(m.id);
                            setCedeQuery("");
                            setCedeResults([]);
                          }}
                        >
                          🫱 Ceder
                        </button>
                      ) : null}

                      {session && isCreator ? (
                        <button
                          type="button"
                          className="btn ghost gpIconBtn"
                          onClick={() => {
                            setInviteOpenFor(m.id);
                            setInviteQuery("");
                            setInviteResults([]);
                            setInviteSelected([]);
                          }}
                        >
                          📣 Invitar
                        </button>
                      ) : null}

                      {session && iAmInside ? (
                        <button className="btn ghost gpIconBtn" onClick={() => openChat(m.id)}>
                          💬 Chat
                        </button>
                      ) : null}
                    </div>

                    <div className="gpActionRight">
                      {!session ? (
                        <button className="btn" onClick={goLogin}>
                          Entrar
                        </button>
                      ) : null}

                      {session && !isCreator && !myStatus && left > 0 ? (
                        <button
                          className="btn"
                          onClick={async () => {
                            try {
                              await requestJoin(m.id);
                              toast.success("Solicitud enviada");
                            } catch (e) {
                              toast.error(e?.message || "No se pudo enviar la solicitud");
                            }
                          }}
                        >
                          🤝 Unirme
                        </button>
                      ) : null}

                      {session && myStatus === "pending" ? (
                        <button
                          className="btn ghost"
                          onClick={async () => {
                            try {
                              await cancelMyJoin(m.id);
                              toast.success("Solicitud cancelada");
                            } catch (e) {
                              toast.error(e?.message || "No se pudo cancelar");
                            }
                          }}
                        >
                          Cancelar
                        </button>
                      ) : null}

                      {session && !isCreator && iAmInside ? (
                        <button className="btn ghost" onClick={() => handleLeave(m.id)}>
                          Salir
                        </button>
                      ) : null}

                      {session && isCreator ? (
                        <button className="btn danger" onClick={() => handleDelete(m.id)}>
                          🗑️ Eliminar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
           </ul>
          </div>

          {status.error ? (
            <div style={{ marginTop: 12, color: "#dc2626", fontWeight: 900 }}>{status.error}</div>
          ) : null}
        </div>
      </div>

      {/* MODAL: CEDER */}
      {cedeOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setCedeOpenFor(null)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ceder plaza</div>
              <button className="btn ghost" onClick={() => setCedeOpenFor(null)}>
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="gpLabel">Escribe 3+ letras (nombre o @handle)</label>
              <input
                className="gpInput"
                value={cedeQuery}
                onChange={(e) => setCedeQuery(e.target.value)}
                placeholder="Ej: car / @carlos"
              />
              <div className="meta" style={{ marginTop: 6 }}>Selecciona a quién quieres ceder tu sitio.</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {(cedeResults || []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="card"
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 14,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
                    opacity: cedeBusy ? 0.7 : 1,
                  }}
                  onClick={() => transferSpot({ matchId: cedeOpenFor, toUserId: u.id })}
                  disabled={cedeBusy}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.name || u.handle || "user"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 1000 }}>
                        🦍
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.name || "Usuario"}
                    </div>
                    <div className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      @{u.handle || String(u.id).slice(0, 6)}
                    </div>
                  </div>
                </button>
              ))}
              {cedeQuery.trim().length >= 3 && (cedeResults || []).length === 0 ? (
                <div className="meta" style={{ opacity: 0.75 }}>
                  No hay resultados.
                </div>
              ) : null}
            </div>

            <div className="gpRow" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => setCedeOpenFor(null)} disabled={cedeBusy}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL: INVITAR */}
      {inviteOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setInviteOpenFor(null)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Invitar jugadores</div>
              <button className="btn ghost" onClick={() => setInviteOpenFor(null)}>
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="gpLabel">Busca (3+ letras)</label>
              <input
                className="gpInput"
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                placeholder="Ej: ana / @antonio"
              />
              <div className="meta" style={{ marginTop: 6 }}>
                Puedes seleccionar hasta 10.
              </div>
            </div>

            {inviteSelected.length ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {inviteSelected.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="gpChip"
                    onClick={() => setInviteSelected((prev) => prev.filter((x) => x.id !== u.id))}
                    title="Quitar"
                  >
                    @{u.handle || u.name || String(u.id).slice(0, 6)} ✕
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {(inviteResults || []).map((u) => {
                const already = inviteSelected.some((x) => x.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className="card"
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 14,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      cursor: "pointer",
                      opacity: already ? 0.55 : 1,
                    }}
                    onClick={() => {
                      if (already) return;
                      setInviteSelected((prev) => (prev.length >= 10 ? prev : [...prev, u]));
                    }}
                    disabled={already || inviteBusy}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.name || u.handle || "user"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 1000 }}>
                          🦍
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name || "Usuario"}
                      </div>
                      <div className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        @{u.handle || String(u.id).slice(0, 6)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="gpRow" style={{ marginTop: 14, justifyContent: "space-between" }}>
              <div className="meta">{inviteSelected.length}/10 seleccionados</div>

              <div className="gpRow">
                <button
                  className="btn"
                  onClick={() => sendInvites({ matchId: inviteOpenFor, userIds: inviteSelected.map((x) => x.id) })}
                  disabled={inviteBusy || inviteSelected.length === 0}
                >
                  {inviteBusy ? "Enviando…" : "Enviar invitaciones"}
                </button>
                <button className="btn ghost" onClick={() => setInviteOpenFor(null)} disabled={inviteBusy}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* REQUESTS MODAL */}
      {requestsOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setRequestsOpenFor(null)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Solicitudes pendientes</div>
              <button className="btn ghost" onClick={() => setRequestsOpenFor(null)}>
                Cerrar
              </button>
            </div>

            {pendingBusy ? (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 900 }}>Cargando…</div>
            ) : pending.length === 0 ? (
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>No hay solicitudes pendientes.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {pending.map((r) => {
                  const p = profilesById?.[String(r.user_id)] || null;
                  const name = p?.name || p?.handle || String(r.user_id).slice(0, 6) + "…";
                  return (
                    <div
                      key={r.id}
                      className="card"
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 950 }}>{name}</div>
                        <div className="meta" style={{ marginTop: 4 }}>
                          {new Date(r.created_at).toLocaleString("es-ES")}
                        </div>
                      </div>
                      <div className="gpRow">
                        <button className="btn" onClick={() => handleApprove(r.id)}>
                          ✅ Aprobar
                        </button>
                        <button className="btn ghost" onClick={() => handleReject(r.id)}>
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* CREATE MODAL */}
      {openCreate ? (
        <div className="gpModalOverlay" onClick={() => setOpenCreate(false)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear partido</div>
              <button className="btn ghost" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpGrid2" style={{ marginTop: 10 }}>
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <label className="gpLabel">Club (escribe 2–3 letras y elige)</label>
                <input
                  className="gpInput"
                  value={clubQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClubQuery(v);
                    setShowClubSuggest(true);
                    setForm((prev) => ({ ...prev, clubName: v, clubId: "" }));
                  }}
                  onFocus={() => setShowClubSuggest(true)}
                  placeholder="Escribe 2–3 letras…"
                />

                {showClubSuggest && clubSuggestions.length > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "calc(100% + 6px)",
                      background: "rgba(16,18,22,0.98)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                      zIndex: 9999,
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    {clubSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickClub(c)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: 0,
                          background: "transparent",
                          padding: "10px 12px",
                          fontWeight: 900,
                          cursor: "pointer",
                          color: "inherit",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {form.clubName && !form.clubId ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "crimson", fontWeight: 800 }}>
                    Selecciona el club de la lista (para evitar errores).
                  </div>
                ) : null}
              </div>

              <div>
                <label className="gpLabel">Fecha</label>
                <input
                  className="gpInput"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="gpLabel">Hora</label>
                <input
                  className="gpInput"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div>
                <label className="gpLabel">Duración (min)</label>
                <input
                  className="gpInput"
                  type="number"
                  value={form.durationMin}
                  onChange={(e) => setForm((prev) => ({ ...prev, durationMin: e.target.value }))}
                />
              </div>

              <div>
                <label className="gpLabel">Nivel</label>
                <select
                  className="gpInput"
                  value={form.level}
                  onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}
                >
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>

              <div>
                <label className="gpLabel">Ya sois</label>
                <select
                  className="gpInput"
                  value={form.alreadyPlayers}
                  onChange={(e) => setForm((prev) => ({ ...prev, alreadyPlayers: e.target.value }))}
                >
                  <option value={1}>1 (solo yo)</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>

              <div>
                <label className="gpLabel">Precio/jugador (opcional)</label>
                <input
                  className="gpInput"
                  type="number"
                  value={form.pricePerPlayer}
                  onChange={(e) => setForm((prev) => ({ ...prev, pricePerPlayer: e.target.value }))}
                />
              </div>
            </div>

            {saveError ? <div style={{ marginTop: 10, color: "#dc2626", fontWeight: 900 }}>{saveError}</div> : null}

            <div className="gpRow" style={{ marginTop: 14 }}>
              <button className="btn" onClick={handleCreate} disabled={saving || !!(form.clubName && !form.clubId)}>
                {saving ? "Creando…" : "Crear partido"}
              </button>
              <button className="btn ghost" onClick={() => setOpenCreate(false)} disabled={saving}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CHAT MODAL */}
      {chatOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setChatOpenFor(null)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Chat</div>
              <button className="btn ghost" onClick={() => setChatOpenFor(null)}>
                Cerrar
              </button>
            </div>

            {chatLoading ? (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 900 }}>Cargando…</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {(chatItems || []).map((it) => (
                  <div key={it.id} className="card" style={{ padding: 10 }}>
                    <div className="meta" style={{ fontWeight: 900 }}>
                      {it.user_id?.slice?.(0, 6)}… · {new Date(it.created_at).toLocaleString("es-ES")}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800 }}>{it.message}</div>
                  </div>
                ))}
              </div>
            )}

            <textarea
              className="gpTextarea"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Escribe…"
            />

            <div className="gpRow" style={{ marginTop: 10 }}>
              <button className="btn" onClick={handleSendChat} disabled={!chatText.trim()}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
