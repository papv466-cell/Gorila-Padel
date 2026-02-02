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

// ✅ avisos sonoros
import { scheduleEndWarningsForEvent, unscheduleEventWarnings } from "../services/gorilaSound";

/* Utils */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function combineDateTimeToISO(dateStr, timeStr) {
  const [hh, mm] = String(timeStr || "19:00")
    .split(":")
    .map((x) => Number(x));
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(Number.isFinite(hh) ? hh : 19, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d.toISOString();
}

function sortByStartAtAsc(list) {
  return [...(list || [])].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
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

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso || "");
  }
}

export default function MatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

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

  /* initial clubs (sheet) */
  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => setClubsSheet(Array.isArray(rows) ? rows : []))
      .catch(() => setClubsSheet([]));
  }, []);

  /* load matches + status */
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

      const counts = await fetchApprovedCounts(ids);
      if (!aliveRef.current) return;
      setApprovedCounts(counts || {});

      const latest = await fetchLatestChatTimes(ids);
      if (!aliveRef.current) return;
      setLatestChatTsByMatch(latest || {});
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
  }, [authReady]);

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
  }, []);

  /* ✅ Push dentro de la app abierta (SW → window event) */
  useEffect(() => {
    const onPush = (e) => {
      const p = e?.detail || {};
      const title = String(p.title || "Gorila Pádel");
      const body = String(p.body || "");

      // ✅ toast dentro de la app (app abierta)
      if (body) toast.success(`${title}: ${body}`);
      else toast.success(title);

      if (debug) console.log("📩 gp:push", p);
    };

    window.addEventListener("gp:push", onPush);
    return () => window.removeEventListener("gp:push", onPush);
  }, [toast, debug]);

  /* auto-open chat from url/storage */
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

  /* auto-open requests from url */
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
      date: prev.date || todayISO,
    }));
    setClubQuery(clubNameParam || "");
    setShowClubSuggest(false);
  }, [createParam, clubIdParam, clubNameParam, authReady, session, todayISO]);

  /* Lists */
  const filteredList = useMemo(() => {
    let list = items;

    if (clubIdParam) list = list.filter((m) => String(m.club_id) === String(clubIdParam));

    if (isClubFilter) {
      list = list.filter((m) => {
        const d = toDateInputValue(new Date(m.start_at));
        return d === selectedDay;
      });
    }

    return list;
  }, [items, clubIdParam, isClubFilter, selectedDay]);

  const myList = useMemo(() => {
    if (!session) return [];
    return filteredList.filter((m) => {
      const st = myReqStatus[m.id];
      return m.created_by_user === session.user.id || st === "approved" || st === "pending";
    });
  }, [filteredList, myReqStatus, session]);

  const visibleList = viewMode === "mine" ? myList : filteredList;

  /* =========================
     ⏱️ Avisos sonoros (5 min antes + fin)
  ========================= */
  useEffect(() => {
    if (!authReady) return;

    const uid = session?.user?.id ? String(session.user.id) : "";
    const desired = new Set();

    for (const m of visibleList || []) {
      const isCreator = uid && String(m.created_by_user) === uid;
      const myStatus = myReqStatus?.[m.id] || null;

      if (!isCreator && myStatus !== "approved") continue;

      const startMs = new Date(m.start_at).getTime();
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
  }, [authReady, session?.user?.id, visibleList, myReqStatus]);

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
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar el partido");
    }
  }

  /* Create helpers */
  const clubSuggestions = useMemo(() => {
    const q = (clubQuery || "").trim().toLowerCase();
    if (!q) return [];
    return (clubsSheet || [])
      .filter((c) => String(c?.name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [clubQuery, clubsSheet]);

  function pickClub(c) {
    const id = String(c?.id ?? "");
    const name = String(c?.name ?? "");
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

      if (!String(form.clubName || "").trim()) throw new Error("Pon el nombre del club.");
      if (!String(form.clubId || "").trim()) throw new Error("Selecciona el club de la lista (para evitar errores).");

      await createMatch({
        clubId: form.clubId,
        clubName: form.clubName,
        startAtISO,
        durationMin: Number(form.durationMin) || 90,
        level: form.level,
        alreadyPlayers: Number(form.alreadyPlayers) || 1,
        pricePerPlayer: form.pricePerPlayer,
      });

      setOpenCreate(false);
      toast.success("Partido creado");
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

      // ✅ matches.js espera { matchId, message }
      await sendMatchMessage({ matchId: chatOpenFor, message });

      const rows = await fetchMatchMessages(chatOpenFor);
      setChatItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e?.message || "No pude enviar");
    }
  }

  // ✅ realtime cuando está abierto
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
    <div className="gpPage">
      <style>{`
        .gpPage{height:100%;min-height:0;display:flex;flex-direction:column;padding:18px 16px 30px;}
        .gpWrap{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;max-width:980px;margin:0 auto;}
        .gpHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;}
        .gpTitle{font-size:40px;line-height:1.05;margin:0;font-weight:900;letter-spacing:-0.02em;}
        .gpMeta{margin-top:6px;font-size:13px;opacity:.75;font-weight:700;}
        .gpTopActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
        .gpRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .gpBtn{border:0;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;background:#111;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.12);}
        .gpBtn:disabled{opacity:.55;cursor:not-allowed;}
        .gpBtnGhost{background:transparent;color:#111;border:1px solid rgba(0,0,0,.12);box-shadow:none;}
        .gpBtnDanger{background:#dc2626;color:#fff;}
        .gpCard{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px;box-shadow:0 10px 24px rgba(0,0,0,.06);}
        .gpGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px;}
        .gpBox{background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:10px;}
        .gpLabel{font-size:11px;opacity:.65;font-weight:900;}
        .gpVal{margin-top:4px;font-weight:900;font-size:13px;}
        .gpBadges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
        .gpBadge{font-size:12px;font-weight:900;border-radius:999px;padding:6px 10px;border:1px solid rgba(0,0,0,.08);background:rgba(0,0,0,.03);}
        .gpOk{background:rgba(34,197,94,.12);color:rgb(21,128,61);}
        .gpWarn{background:rgba(245,158,11,.14);color:rgb(146,64,14);}
        .gpBad{background:rgba(220,38,38,.12);color:rgb(185,28,28);}
        .gpActions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px;}
        .gpTabs{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 0;}
        .gpTab{border:1px solid rgba(0,0,0,.12);background:transparent;border-radius:999px;padding:8px 12px;font-weight:900;cursor:pointer;}
        .gpTabOn{background:#111;color:#fff;border-color:#111;}
        .gpList{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:12px;}
        .gpModalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:grid;place-items:center;padding:14px;z-index:9999;}
        .gpModal{width:min(860px,100%);background:#fff;border-radius:18px;border:1px solid rgba(0,0,0,.12);padding:14px;box-shadow:0 30px 80px rgba(0,0,0,.28);max-height:85vh;overflow:auto;}
        .gpModalHeader{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
        .gpH2{margin:0;font-size:18px;font-weight:950;}
        .gpInput{width:100%;border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:10px 12px;font-weight:800;outline:none;}
        .gpInput:focus{border-color:#111;box-shadow:0 0 0 3px rgba(17,17,17,.12);}
        .gpTextarea{width:100%;min-height:90px;border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:10px 12px;font-weight:800;outline:none;resize:vertical;}
        .gpTextarea:focus{border-color:#111;box-shadow:0 0 0 3px rgba(17,17,17,.12);}
        .gpSuggest{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:14px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.18);z-index:9999;}
        .gpSuggestBtn{width:100%;text-align:left;border:0;background:transparent;padding:10px 12px;font-weight:900;cursor:pointer;}
        .gpSuggestBtn:hover{background:rgba(0,0,0,.04);}
        @media(max-width:720px){.gpTitle{font-size:30px}.gpGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>

      <div className="gpWrap">
        <div className="gpHeader">
          <div>
            <h1 className="gpTitle">Partidos</h1>
            <div className="gpMeta">
              {status.loading ? "Cargando…" : `${visibleList.length} partido(s)`}
              {isClubFilter ? ` · Club: ${clubNameParam || clubIdParam}` : ""}
            </div>
          </div>

          <div className="gpTopActions">
            {isClubFilter ? (
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
            ) : (
              <div className="gpTabs">
                <button className={`gpTab ${viewMode === "mine" ? "gpTabOn" : ""}`} onClick={() => setViewMode("mine")}>
                  Los míos
                </button>
                <button className={`gpTab ${viewMode === "all" ? "gpTabOn" : ""}`} onClick={() => setViewMode("all")}>
                  Todos
                </button>
              </div>
            )}

            <button className="gpBtn" onClick={() => setOpenCreate(true)}>
              ➕ Crear
            </button>

            {showPushButton ? (
              <button className="gpBtn gpBtnGhost" onClick={handleEnablePush} disabled={pushBusy}>
                {pushBusy ? "Activando…" : "🔔 Push"}
              </button>
            ) : null}
          </div>
        </div>

        <ul className="gpList">
          {visibleList.map((m) => {
            const occupied = Math.min(4, (Number(m.reserved_spots) || 1) + (approvedCounts[m.id] || 0));
            const left = Math.max(0, 4 - occupied);

            const myStatus = myReqStatus[m.id] || null;
            const isCreator = session?.user?.id && String(m.created_by_user) === String(session.user.id);

            return (
              <li key={m.id} className="gpCard">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 260, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 950 }}>{m.club_name}</div>

                    <div className="gpGrid">
                      <div className="gpBox">
                        <div className="gpLabel">Fecha y hora</div>
                        <div className="gpVal">{formatWhen(m.start_at)}</div>
                      </div>

                      <div className="gpBox">
                        <div className="gpLabel">Duración</div>
                        <div className="gpVal">{m.duration_min} min</div>
                      </div>

                      <div className="gpBox">
                        <div className="gpLabel">Nivel</div>
                        <div className="gpVal">{String(m.level || "").toUpperCase()}</div>
                      </div>

                      <div className="gpBox">
                        <div className="gpLabel">Plazas</div>
                        <div className="gpVal">
                          {occupied}/4 ocupadas · {left} libres
                        </div>
                      </div>
                    </div>

                    <div className="gpBadges">
                      {myStatus === "approved" ? <span className="gpBadge gpOk">✅ Estás dentro</span> : null}
                      {myStatus === "pending" ? <span className="gpBadge gpWarn">⏳ Solicitud pendiente</span> : null}
                      {myStatus === "rejected" ? <span className="gpBadge gpBad">❌ Rechazado</span> : null}
                      {isCreator ? <span className="gpBadge gpOk">👑 Eres creador</span> : null}
                      {latestChatTsByMatch[m.id] ? <span className="gpBadge">💬 Chat activo</span> : null}
                    </div>
                  </div>

                  <div className="gpActions">
                    {!session ? (
                      <button className="gpBtn" onClick={goLogin}>
                        Entrar
                      </button>
                    ) : null}

                    {session && !isCreator && !myStatus && left > 0 ? (
                      <button
                        className="gpBtn"
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
                        className="gpBtn gpBtnGhost"
                        onClick={async () => {
                          try {
                            await cancelMyJoin(m.id);
                            toast.success("Solicitud cancelada");
                          } catch (e) {
                            toast.error(e?.message || "No se pudo cancelar");
                          }
                        }}
                      >
                        Cancelar solicitud
                      </button>
                    ) : null}

                    {session && myStatus === "rejected" ? (
                      <button
                        className="gpBtn"
                        onClick={async () => {
                          try {
                            await cancelMyJoin(m.id);
                            await requestJoin(m.id);
                            toast.success("Solicitud enviada");
                          } catch (e) {
                            toast.error(e?.message || "No se pudo enviar");
                          }
                        }}
                      >
                        Solicitar de nuevo
                      </button>
                    ) : null}

                    {isCreator ? (
                      <button type="button" className="gpBtn gpBtnGhost" onClick={() => openRequests(m.id)}>
                        📥 Solicitudes
                      </button>
                    ) : null}

                    {session && (isCreator || myStatus === "approved" || myStatus === "pending") ? (
                      <button className="gpBtn gpBtnGhost" onClick={() => openChat(m.id)}>
                        💬 Chat
                      </button>
                    ) : null}

                    {session && !isCreator && (myStatus === "approved" || myStatus === "pending") ? (
                      <button className="gpBtn gpBtnGhost" onClick={() => handleLeave(m.id)}>
                        Salir
                      </button>
                    ) : null}

                    {session && isCreator ? (
                      <button className="gpBtn gpBtnDanger" onClick={() => handleDelete(m.id)}>
                        🗑️ Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {status.error ? <div style={{ marginTop: 12, color: "#dc2626", fontWeight: 900 }}>{status.error}</div> : null}
      </div>

      {/* REQUESTS MODAL */}
      {requestsOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setRequestsOpenFor(null)}>
          <div className="gpModal" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <h2 className="gpH2">Solicitudes pendientes</h2>
              <button className="gpBtn gpBtnGhost" onClick={() => setRequestsOpenFor(null)}>
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
                      className="gpCard"
                      style={{ padding: 12, borderRadius: 14, display: "flex", justifyContent: "space-between", gap: 10 }}
                    >
                      <div>
                        <div style={{ fontWeight: 950 }}>{name}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(r.created_at).toLocaleString("es-ES")}</div>
                      </div>
                      <div className="gpRow">
                        <button className="gpBtn" onClick={() => handleApprove(r.id)}>
                          ✅ Aprobar
                        </button>
                        <button className="gpBtn gpBtnGhost" onClick={() => handleReject(r.id)}>
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
          <div className="gpModal" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <h2 className="gpH2">Crear partido</h2>
              <button className="gpBtn gpBtnGhost" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpRow" style={{ gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Club</div>
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

                {showClubSuggest && clubSuggestions.length ? (
                  <div className="gpSuggest">
                    {clubSuggestions.map((c) => (
                      <button key={c.id} className="gpSuggestBtn" onClick={() => pickClub(c)} type="button">
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ width: 170 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Fecha</div>
                <input className="gpInput" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
              </div>

              <div style={{ width: 140 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Hora</div>
                <input className="gpInput" type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} />
              </div>
            </div>

            <div className="gpRow" style={{ gap: 12, marginTop: 12 }}>
              <div style={{ width: 170 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Duración (min)</div>
                <input className="gpInput" type="number" value={form.durationMin} onChange={(e) => setForm((prev) => ({ ...prev, durationMin: e.target.value }))} />
              </div>

              <div style={{ width: 170 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Nivel</div>
                <select className="gpInput" value={form.level} onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>

              <div style={{ width: 190 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Ya sois</div>
                <select className="gpInput" value={form.alreadyPlayers} onChange={(e) => setForm((prev) => ({ ...prev, alreadyPlayers: e.target.value }))}>
                  <option value={1}>1 (solo yo)</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>

              <div style={{ width: 170 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Precio/jugador</div>
                <input className="gpInput" type="number" value={form.pricePerPlayer} onChange={(e) => setForm((prev) => ({ ...prev, pricePerPlayer: e.target.value }))} placeholder="(opcional)" />
              </div>
            </div>

            {saveError ? <div style={{ marginTop: 10, color: "#dc2626", fontWeight: 900 }}>{saveError}</div> : null}

            <div className="gpRow" style={{ marginTop: 14 }}>
              <button className="gpBtn" onClick={handleCreate} disabled={saving}>
                {saving ? "Creando…" : "Crear partido"}
              </button>
              <button className="gpBtn gpBtnGhost" onClick={() => setOpenCreate(false)} disabled={saving}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CHAT MODAL */}
      {chatOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setChatOpenFor(null)}>
          <div className="gpModal" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <h2 className="gpH2">Chat</h2>
              <button className="gpBtn gpBtnGhost" onClick={() => setChatOpenFor(null)}>
                Cerrar
              </button>
            </div>

            {chatLoading ? (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 900 }}>Cargando…</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {(chatItems || []).map((it) => (
                  <div key={it.id} className="gpCard" style={{ padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 900 }}>
                      {it.user_id?.slice?.(0, 6)}… · {new Date(it.created_at).toLocaleString("es-ES")}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800 }}>{it.message}</div>
                  </div>
                ))}
              </div>
            )}

            <textarea className="gpTextarea" value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Escribe…" />

            <div className="gpRow" style={{ marginTop: 10 }}>
              <button className="gpBtn" onClick={handleSendChat} disabled={!chatText.trim()}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
