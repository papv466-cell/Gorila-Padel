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

  const showPushButton = import.meta.env.DEV || qs.get("push") === "1";
  const debug = qs.get("debug") === "1";

  /* Session */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

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

  // Dedupe toasts de mensajes (StrictMode/DEV)
  const seenMsgIdsRef = useRef(new Set());
  const hasSeenMsg = (id) => seenMsgIdsRef.current.has(String(id));
  const markSeenMsg = (id) => {
    const s = seenMsgIdsRef.current;
    s.add(String(id));
    if (s.size > 500) {
      const arr = Array.from(s);
      seenMsgIdsRef.current = new Set(arr.slice(-250));
    }
  };

  function goLogin() {
    navigate("/login", { state: { from: location.pathname + location.search } });
  }

  /* session */
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
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

  /* Persist openChat si viene en URL */
  useEffect(() => {
    if (!openChatFromUrl) return;
    try {
      window.sessionStorage?.setItem?.("openChat", openChatFromUrl);
    } catch {}
  }, [openChatFromUrl]);

  /* load clubs sheet once */
  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => setClubsSheet(rows ?? []))
      .catch(() => {});
  }, []);

  /* Carga inicial */
  async function reloadFull() {
    try {
      setStatus({ loading: true, error: null });

      const data = await fetchMatches({ limit: 500 });
      if (!aliveRef.current) return;

      setItems(sortByStartAtAsc(data));

      const ids = data.map((m) => m.id);
      if (session && ids.length) {
        const [mine, counts, latest] = await Promise.all([
          fetchMyRequestsForMatchIds(ids),
          fetchApprovedCounts(ids),
          fetchLatestChatTimes(ids),
        ]);
        if (!aliveRef.current) return;

        setMyReqStatus(mine || {});
        setApprovedCounts(counts || {});
        setLatestChatTsByMatch(latest || {});
      } else {
        setMyReqStatus({});
        setApprovedCounts({});
        setLatestChatTsByMatch({});
      }

      setStatus({ loading: false, error: null });
    } catch (e) {
      if (!aliveRef.current) return;
      setStatus({ loading: false, error: e?.message || "Error cargando partidos" });
    }
  }

  useEffect(() => {
    if (!authReady) return;
    reloadFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session]);

  /* Realtime matches */
  useEffect(() => {
    if (!authReady) return;

    const unsub = subscribeMatchesRealtime((payload) => {
      const type = payload?.eventType;
      const rowNew = payload?.new || null;
      const rowOld = payload?.old || null;

      if (type === "INSERT" && rowNew?.id) {
        setItems((prev) => upsertMatchSorted(prev, rowNew));
        setApprovedCounts((prev) => ({ ...prev, [rowNew.id]: prev[rowNew.id] || 0 }));
      }

      if (type === "UPDATE" && rowNew?.id) {
        setItems((prev) => upsertMatchSorted(prev, rowNew));
      }

      if (type === "DELETE") {
        const id = rowOld?.id;
        if (id) {
          setItems((prev) => removeMatch(prev, id));
          setMyReqStatus((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setApprovedCounts((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setLatestChatTsByMatch((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          if (chatOpenFor === id) setChatOpenFor(null);
          if (requestsOpenFor === id) setRequestsOpenFor(null);
        }
      }
    });

    return () => unsub?.();
  }, [authReady, chatOpenFor, requestsOpenFor]);

  /* Requests modal */
  async function openRequests(matchId) {
    if (!session) return goLogin();
    try {
      setPendingBusy(true);
      setRequestsOpenFor(matchId);

      const reqs = await fetchPendingRequests(matchId);
      if (!aliveRef.current) return;
      setPending(reqs || []);

      const ids = (reqs || []).map((r) => r.user_id).filter(Boolean);
      if (ids.length > 0) {
        const profs = await fetchProfilesByIds(ids);
        if (!aliveRef.current) return;
        setProfilesById((prev) => ({ ...prev, ...(profs || {}) }));
      }
    } catch (e) {
      toast.error(e?.message ?? "No se pudieron cargar solicitudes");
      setRequestsOpenFor(null);
      setPending([]);
    } finally {
      if (aliveRef.current) setPendingBusy(false);
    }
  }

  /* Realtime join requests + popup al creador */
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user?.id) return;

    const unsub = subscribeJoinRequestsRealtime(async (payload) => {
      const type = payload?.eventType;
      const rowNew = payload?.new || null;
      const rowOld = payload?.old || null;

      const matchId = String(rowNew?.match_id || rowOld?.match_id || "");
      if (!matchId) return;

      // Toast al creador si entra una solicitud pending
      if (type === "INSERT") {
        const match = items.find((x) => String(x.id) === matchId);
        const isCreator = match?.created_by_user && match.created_by_user === session.user.id;
        const statusNew = String(rowNew?.status || "pending");
        const isPending = statusNew === "pending" || !statusNew;

        if (isCreator && isPending && String(requestsOpenFor || "") !== matchId) {
          toast.info("Nueva solicitud para unirse", {
            title: match?.club_name || "Tu partido",
            duration: 4500,
            onClick: () => openRequests(matchId),
          });
        }
      }

      // Recalcula contadores SOLO ese partido
      try {
        const counts = await fetchApprovedCounts([matchId]);
        if (aliveRef.current) setApprovedCounts((prev) => ({ ...prev, ...(counts || {}) }));
      } catch {}

      // Mi estado SOLO ese partido
      try {
        const mine = await fetchMyRequestsForMatchIds([matchId]);
        if (aliveRef.current) setMyReqStatus((prev) => ({ ...prev, ...(mine || {}) }));
      } catch {}

      // Si modal abierto, refresca pendientes
      if (String(requestsOpenFor || "") === matchId) {
        try {
          setPendingBusy(true);
          const reqs = await fetchPendingRequests(matchId);
          if (!aliveRef.current) return;

          setPending(reqs || []);
          const ids = (reqs || []).map((r) => r.user_id).filter(Boolean);
          if (ids.length > 0) {
            const profs = await fetchProfilesByIds(ids);
            if (!aliveRef.current) return;
            setProfilesById((prev) => ({ ...prev, ...(profs || {}) }));
          }
        } catch {
          // no rompemos UI
        } finally {
          if (aliveRef.current) setPendingBusy(false);
        }
      }
    });

    return () => unsub?.();
  }, [authReady, session, items, requestsOpenFor, toast]);

  /* Chat */
  async function openChat(matchId) {
    if (!session) return goLogin();
    setChatLoading(true);
    setChatOpenFor(matchId);
    try {
      const msgs = await fetchMatchMessages(matchId, { limit: 200 });
      const list = Array.isArray(msgs) ? msgs : Array.isArray(msgs?.data) ? msgs.data : [];
      setChatItems(list || []);
    } finally {
      setChatLoading(false);
    }
  }

  /* Realtime mensajes globales (toast cuando chat está cerrado) */
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user?.id) return;

    const unsub = subscribeAllMatchMessagesRealtime((payload) => {
      const rowNew = payload?.new || null;
      if (!rowNew?.id) return;

      // dedupe
      if (hasSeenMsg(rowNew.id)) return;
      markSeenMsg(rowNew.id);

      const matchId = String(rowNew.match_id || "");
      if (!matchId) return;

      // si es mío, fuera
      const mine = rowNew.user_id && rowNew.user_id === session.user.id;
      if (mine) return;

      // si tengo el chat abierto de ese partido, no toast (ya lo veo)
      if (chatOpenFor && String(chatOpenFor) === matchId) return;

      // Solo avisar si me afecta: creador o approved/pending
      const match = items.find((x) => String(x.id) === matchId);
      const isCreator = match?.created_by_user && match.created_by_user === session.user.id;
      const st = myReqStatus[matchId];
      const isParticipant = st === "approved" || st === "pending";
      if (!isCreator && !isParticipant) return;

      // guarda último mensaje
      if (rowNew?.created_at) {
        const ts = new Date(rowNew.created_at).getTime();
        if (Number.isFinite(ts)) setLatestChatTsByMatch((prev) => ({ ...prev, [matchId]: ts }));
      }

      toast.info("📩 Nuevo mensaje", {
        title: match?.club_name || "Chat",
        duration: 4500,
        onClick: () => openChat(matchId),
      });
    });

    return () => unsub?.();
  }, [authReady, session, chatOpenFor, items, myReqStatus, toast]);

  /* Realtime chat (solo cuando chat abierto) */
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user?.id) return;
    if (!chatOpenFor) return;

    const unsub = subscribeMatchMessagesRealtime(chatOpenFor, (payload) => {
      const type = payload?.eventType;
      const rowNew = payload?.new || null;

      if (type === "INSERT" && rowNew?.id) {
        setChatItems((prev) => uniqById([...(prev || []), rowNew]));

        // actualiza último mensaje
        if (rowNew?.created_at) {
          const ts = new Date(rowNew.created_at).getTime();
          if (Number.isFinite(ts)) setLatestChatTsByMatch((prev) => ({ ...prev, [chatOpenFor]: ts }));
        }
      }
    });

    return () => unsub?.();
  }, [authReady, session, chatOpenFor]);

  async function handleSendChat() {
    if (!chatOpenFor) return;
    const text = chatText.trim();
    if (!text) return;

    try {
      setChatText("");
      await sendMatchMessage({ matchId: chatOpenFor, message: text });
    } catch (e) {
      toast.error(e?.message || "No se pudo enviar el mensaje");
      setChatText(text);
    }
  }

  /* Auto-open chat desde notificación */
  useEffect(() => {
    if (!openChatParam) return;
    if (!authReady) return;

    if (!session) {
      goLogin();
      return;
    }

    const t = setTimeout(async () => {
      try {
        await openChat(openChatParam);
        try {
          window.sessionStorage?.removeItem?.("openChat");
        } catch {}
      } catch (e) {
        console.error("Auto-open chat falló:", e);
      }
    }, 120);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatParam, authReady, session]);

  /* Auto-open requests desde notificación */
  useEffect(() => {
    if (!openRequestsParam) return;
    if (!authReady) return;

    if (!session) {
      goLogin();
      return;
    }

    const t = setTimeout(() => openRequests(openRequestsParam), 120);
    return () => clearTimeout(t);
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
      if (!String(form.clubId || "").trim())
        throw new Error("Selecciona el club de la lista (para evitar errores).");

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

  return (
    <div className="gpPage">
      {/* Estilos “pro” (fallback si tu CSS global cambió) */}
      <style>{`
  .gpPage{
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 18px 16px 30px;
  }

  .gpWrap{
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    max-width: 980px;
    margin: 0 auto;
  }
        .gpHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;}
        .gpTitle{font-size:40px;line-height:1.05;margin:0;font-weight:900;letter-spacing:-0.02em;}
        .gpMeta{margin-top:6px;font-size:13px;opacity:.75;font-weight:700;}
        .gpTopActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
        .gpRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .gpBtn{border:0;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;background:#111;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.12);}
        .gpBtn:disabled{opacity:.55;cursor:not-allowed;}
        .gpBtnGhost{background:transparent;color:#111;border:1px solid rgba(0,0,0,.12);box-shadow:none;}
        .gpBtnDanger{background:#dc2626;}
        .gpTabs{display:flex;gap:10px;margin-top:10px;margin-bottom:12px;}
        .gpInput{width:100%;max-width:520px;padding:10px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);outline:none;}
        .gpCard{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:14px 14px 12px;box-shadow:0 16px 40px rgba(0,0,0,.06);}
        .gpCardTop{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;}
        .gpClub{font-size:18px;font-weight:950;margin:0;}
        .gpInfo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;}
        @media(min-width:720px){.gpInfo{grid-template-columns:repeat(4,minmax(0,1fr));}}
        .gpBox{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.0));}
        .gpLabel{font-size:11px;opacity:.7;font-weight:800;}
        .gpVal{margin-top:4px;font-size:13px;font-weight:900;}
        .gpBadges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
        .gpBadge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;}
        .gpOk{background:rgba(22,163,74,.12);color:#166534;border:1px solid rgba(22,163,74,.25);}
        .gpWarn{background:rgba(245,158,11,.14);color:#92400e;border:1px solid rgba(245,158,11,.28);}
        .gpBad{background:rgba(220,38,38,.12);color:#991b1b;border:1px solid rgba(220,38,38,.25);}
        .gpActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;}
        .gpList{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:12px;}
        .gpModalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;z-index:9999;}
        .gpModal{background:#fff;border-radius:18px;max-width:720px;width:100%;max-height:85vh;overflow:auto;padding:14px;border:1px solid rgba(0,0,0,.1);box-shadow:0 30px 80px rgba(0,0,0,.35);}
        .gpModalHeader{display:flex;justify-content:space-between;align-items:center;gap:10px;}
        .gpH2{margin:0;font-size:18px;font-weight:950;}
        .gpChatBox{display:flex;flex-direction:column;gap:10px;min-height:220px;max-height:46vh;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px;background:rgba(0,0,0,.02);margin-top:10px;}
        .gpMsg{padding:10px 12px;border-radius:14px;border:1px solid rgba(0,0,0,.08);background:#fff;max-width:85%;}
        .gpTextarea{width:100%;min-height:86px;border-radius:14px;border:1px solid rgba(0,0,0,.12);padding:10px 12px;margin-top:10px;outline:none;}
        .gpSuggest{margin-top:8px;border:1px solid rgba(0,0,0,.12);border-radius:14px;overflow:hidden;background:#fff;}
        .gpSuggestItem{display:block;width:100%;text-align:left;border:0;background:#fff;padding:10px 12px;cursor:pointer;font-weight:900;}
        .gpSuggestItem:hover{background:rgba(0,0,0,.04);}
      `}</style>

      {/* DEBUG */}
      {debug ? (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: 999999,
            background: "#fff",
            border: "2px solid #000",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          openChatParam: {openChatParam || "(vacío)"} <br />
          openRequestsParam: {openRequestsParam || "(vacío)"} <br />
          authReady: {String(authReady)} <br />
          session: {session ? "SI" : "NO"}
        </div>
      ) : null}

      <div className="gpWrap">
        {/* HEADER */}
        <div className="gpHeader">
          <div>
            <h1 className="gpTitle">Partidos</h1>
            <div className="gpMeta">{status.loading ? "Cargando…" : `Mostrando ${visibleList.length}`}</div>
          </div>

          <div className="gpTopActions">
            {showPushButton ? (
              <button
                type="button"
                className="gpBtn gpBtnGhost"
                onClick={handleEnablePush}
                disabled={pushBusy}
                title={!session ? "Tienes que iniciar sesión" : ""}
              >
                {pushBusy ? "Activando…" : "🔔 Activar Push"}
              </button>
            ) : null}

            <button
              className="gpBtn"
              onClick={() => {
                if (!session) return goLogin();
                setOpenCreate(true);

                if (clubIdParam || clubNameParam) {
                  setForm((prev) => ({
                    ...prev,
                    clubId: clubIdParam || prev.clubId,
                    clubName: clubNameParam || prev.clubName,
                  }));
                  setClubQuery(clubNameParam || "");
                  setShowClubSuggest(false);
                }
              }}
            >
              ➕ Crear partido
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="gpTabs">
          <button
            className={`gpBtn ${viewMode === "mine" ? "" : "gpBtnGhost"}`}
            disabled={!session}
            onClick={() => setViewMode("mine")}
          >
            Mis partidos
          </button>
          <button className={`gpBtn ${viewMode === "all" ? "" : "gpBtnGhost"}`} onClick={() => setViewMode("all")}>
            Todos
          </button>
        </div>

        {/* filtro día si vienes de club */}
        {isClubFilter ? (
          <div className="gpRow" style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.8 }}>Día:</div>
            <input
              className="gpInput"
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              style={{ maxWidth: 190 }}
            />
          </div>
        ) : null}

        {/* LIST */}
        <ul className="gpList">
          {visibleList.map((m) => {
            const approved = approvedCounts[m.id] || 0;
            const occupied = Math.min(4, approved + (m.reserved_spots || 1));
            const left = 4 - occupied;

            const myStatus = myReqStatus[m.id];
            const isCreator = session?.user?.id === m.created_by_user;

            return (
              <li key={m.id}>
                <div className="gpCard">
                  <div className="gpCardTop">
                    <div style={{ width: "100%" }}>
                      <p className="gpClub">{m.club_name}</p>

                      <div className="gpInfo">
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
                      </div>
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
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75, fontWeight: 800 }}>
                No hay solicitudes pendientes.
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
                {pending.map((r) => (
                  <li key={r.id} style={{ padding: 12, border: "1px solid rgba(0,0,0,.12)", borderRadius: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>
                      Solicitud de: <strong>{profilesById[r.user_id]?.name || r.user_id}</strong>
                    </div>

                    <div className="gpActions" style={{ marginTop: 10 }}>
                      <button className="gpBtn" onClick={() => handleApprove(r.id)}>
                        Aprobar
                      </button>
                      <button className="gpBtn gpBtnGhost" onClick={() => handleReject(r.id)}>
                        Rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
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

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Club</label>
              <input
                className="gpInput"
                value={clubQuery}
                placeholder="Escribe el nombre…"
                onChange={(e) => {
                  setClubQuery(e.target.value);
                  setShowClubSuggest(true);
                  setForm((prev) => ({ ...prev, clubName: e.target.value, clubId: "" }));
                }}
                onFocus={() => setShowClubSuggest(true)}
              />

              {showClubSuggest && clubSuggestions.length > 0 ? (
                <div className="gpSuggest">
                  {clubSuggestions.map((c) => (
                    <button key={String(c.id)} className="gpSuggestItem" onClick={() => pickClub(c)} type="button">
                      <strong>{c.name}</strong>
                      {c.city ? <span style={{ opacity: 0.7 }}> · {c.city}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Fecha</label>
                  <input
                    className="gpInput"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Hora</label>
                  <input
                    className="gpInput"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Duración (min)</label>
                  <input
                    className="gpInput"
                    type="number"
                    value={form.durationMin}
                    onChange={(e) => setForm((p) => ({ ...p, durationMin: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Nivel</label>
                  <select
                    className="gpInput"
                    value={form.level}
                    onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                  >
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Ya somos</label>
                  <select
                    className="gpInput"
                    value={form.alreadyPlayers}
                    onChange={(e) => setForm((p) => ({ ...p, alreadyPlayers: e.target.value }))}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Precio / jugador (opcional)</label>
                  <input
                    className="gpInput"
                    value={form.pricePerPlayer}
                    onChange={(e) => setForm((p) => ({ ...p, pricePerPlayer: e.target.value }))}
                  />
                </div>
              </div>

              {saveError ? <div style={{ color: "#dc2626", marginTop: 10, fontWeight: 900 }}>{saveError}</div> : null}

              <div className="gpRow" style={{ marginTop: 14 }}>
                <button className="gpBtn" disabled={saving} onClick={handleCreate}>
                  {saving ? "Guardando…" : "Crear"}
                </button>
                <button className="gpBtn gpBtnGhost" onClick={() => setOpenCreate(false)}>
                  Cancelar
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                *Para evitar equivocaciones, el club debe seleccionarse desde la lista.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* CHAT MODAL */}
      {chatOpenFor ? (
        <div className="gpModalOverlay" onClick={() => setChatOpenFor(null)}>
          <div className="gpModal" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <h2 className="gpH2">Chat del partido</h2>
              <button className="gpBtn gpBtnGhost" onClick={() => setChatOpenFor(null)}>
                Cerrar
              </button>
            </div>

            {chatLoading ? <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>Cargando chat…</div> : null}

            <div className="gpChatBox">
              {chatItems.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 13, fontWeight: 800 }}>Aún no hay mensajes.</div>
              ) : (
                chatItems.map((m) => {
                  const mine = session?.user?.id && m.user_id === session.user.id;
                  return (
                    <div
                      key={m.id}
                      className="gpMsg"
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        background: mine ? "rgba(0,0,0,.06)" : "#fff",
                      }}
                    >
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", fontWeight: 800 }}>{m.message}</div>
                      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.6, textAlign: mine ? "right" : "left" }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString("es-ES") : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <textarea
              className="gpTextarea"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Escribe…"
            />

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
