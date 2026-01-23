// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useState, useRef  } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
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
} from "../services/matches";
import { fetchProfilesByIds } from "../services/profilesPublic";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription, isPushEnabledInBrowser } from "../services/push";

/* Utils */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function combineDateTimeToISO(dateStr, timeStr) {
  const [hh, mm] = String(timeStr || "19:00").split(":").map((x) => Number(x));
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(Number.isFinite(hh) ? hh : 19, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d.toISOString();
}

export default function MatchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const openChatFromUrl = new URLSearchParams(location.search).get("openChat") || "";
  const openChatStored = sessionStorage.getItem("openChat") || "";
  const openChatParam = openChatFromUrl || openChatStored;
  
  const todayISO = toDateInputValue(new Date());

  const clubIdParam = searchParams.get("clubId") || "";
  const clubNameParam = searchParams.get("clubName") || "";
  const createParam = searchParams.get("create") === "1";
  const isClubFilter = !!clubIdParam || !!clubNameParam;

  const forcePushUI = new URLSearchParams(location.search).get("push") === "1"; // debug
  const showPushButton = forcePushUI || (!pushEnabled && !pushChecking);

  /* Session */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // ✅ Estado UI push
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushChecking, setPushChecking] = useState(true);

  // ✅ Detecta si el navegador ya tiene push activo
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setPushChecking(true);
        const ok = await isPushEnabledInBrowser();
        if (alive) setPushEnabled(ok);
      } finally {
        if (alive) setPushChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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
  const [viewMode, setViewMode] = useState("explore");
  const [selectedDay, setSelectedDay] = useState(todayISO);

  /* Chat modal */
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatItems, setChatItems] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

// Evita que una respuesta antigua “pise” una nueva
const chatReqIdRef = useRef(0);

// Canal realtime
const chatChannelRef = useRef(null);


  /* Create modal */
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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

  function goLogin() {
    navigate("/login", { state: { from: location.pathname + location.search } });
  }

  useEffect(() => {
    if (openChatFromUrl) {
      sessionStorage.setItem("openChat", openChatFromUrl);
    }
  }, [openChatFromUrl]);  

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
      sub.subscription.unsubscribe();
    };
  }, []);

  /* load clubs sheet once (for suggestions) */
  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => setClubsSheet(rows ?? []))
      .catch(() => {});
  }, []);

  /* reload */
  async function reload() {
    try {
      setStatus({ loading: true, error: null });
      const data = await fetchMatches({ limit: 500 });
      setItems(data);

      const ids = data.map((m) => m.id);
      if (session && ids.length) {
        setMyReqStatus(await fetchMyRequestsForMatchIds(ids));
        setApprovedCounts(await fetchApprovedCounts(ids));
        setLatestChatTsByMatch(await fetchLatestChatTimes(ids));
      } else {
        setMyReqStatus({});
        setApprovedCounts({});
        setLatestChatTsByMatch({});
      }

      setStatus({ loading: false, error: null });
    } catch (e) {
      setStatus({ loading: false, error: e?.message || "Error cargando partidos" });
    }
  }

  useEffect(() => {
    if (!authReady) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session]);

  /* Chat */
  async function openChat(matchId) {
    if (!session) return goLogin();
    if (!matchId) return;
  
    setChatOpenFor(matchId);
    setChatLoading(true);
  
    // Incrementa id de request
    const reqId = ++chatReqIdRef.current;
  
    try {
      const msgs = await fetchMatchMessages(matchId, { limit: 200 });
      // Si entre medias abriste otro chat, ignoramos este resultado
      if (reqId !== chatReqIdRef.current) return;
  
      const list = Array.isArray(msgs) ? msgs : Array.isArray(msgs?.data) ? msgs.data : [];
      setChatItems(list);
    } catch (e) {
      console.error("openChat error:", e);
      // No vaciamos chatItems por error, para no “borrar” UI
    } finally {
      if (reqId === chatReqIdRef.current) setChatLoading(false);
    }
  }  

  useEffect(() => {
    // Limpia canal anterior
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }
  
    if (!chatOpenFor || !session) return;
  
    const channel = supabase
      .channel(`chat:${chatOpenFor}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_messages",
          filter: `match_id=eq.${chatOpenFor}`,
        },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
  
          setChatItems((prev) => {
            // evita duplicados si ya lo añadimos en optimistic
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();
  
    chatChannelRef.current = channel;
  
    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [chatOpenFor, session]);
  

  async function handleSendChat() {
    if (!chatOpenFor) return;
    const text = String(chatText || "").trim();
    if (!text) return;
    if (!session) return goLogin();
    if (chatSending) return;
  
    setChatSending(true);
    setChatText("");
  
    // optimistic: pintamos YA el mensaje
    const tempId = `tmp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      match_id: chatOpenFor,
      user_id: session.user.id,
      message: text,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };
  
    setChatItems((prev) => [...prev, optimistic]);
  
    try {
      const inserted = await sendMatchMessage({ matchId: chatOpenFor, message: text });
  
      // Reemplaza el temporal por el real si llega
      if (inserted?.id) {
        setChatItems((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, ...inserted, __optimistic: false } : m))
        );
      }
    } catch (e) {
      console.error("send chat error:", e);
      // Si falla, marcamos el temporal como error
      setChatItems((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, __error: true } : m))
      );
      alert(e?.message || "No se pudo enviar el mensaje");
    } finally {
      setChatSending(false);
    }
  }
  

  // 🔐 Persistimos openChat si viene por push (evita perderlo por redirects)
useEffect(() => {
  const p = new URLSearchParams(window.location.search).get("openChat");
  if (p) {
    sessionStorage.setItem("openChat", p);
  }
}, []);

  /* ✅ AUTO-OPEN CHAT DESDE NOTIFICACIÓN (UNA SOLA VEZ, SIN DUPLICADOS) */
  useEffect(() => {
    if (!openChatParam) return;
    if (!authReady) return;
  
    if (!session) {
      goLogin(); // al volver, seguirá openChat en sessionStorage
      return;
    }
  
    const t = setTimeout(async () => {
      try {
        await openChat(openChatParam);
  
        // ✅ opcional: limpiar URL para que no se reabra en refresh
        // navigate("/partidos", { replace: true });
  
        // ✅ importante: una vez abierto, limpia storage para que no vuelva a abrir “fantasma”
        sessionStorage.removeItem("openChat");
      } catch (e) {
        console.error("Auto-open chat falló:", e);
      }
    }, 150);
  
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatParam, authReady, session]);
  

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

  /* list */
  const filteredList = useMemo(() => {
    let list = items;

    if (clubIdParam) list = list.filter((m) => m.club_id === clubIdParam);
    if (clubNameParam) list = list.filter((m) => m.club_name === clubNameParam);

    if (!isClubFilter) return list;

    return list.filter((m) => {
      const d = toDateInputValue(new Date(m.start_at));
      return d === selectedDay;
    });
  }, [items, clubIdParam, clubNameParam, selectedDay, isClubFilter]);

  const myList = useMemo(() => {
    if (!session) return [];
    return filteredList.filter((m) => {
      const st = myReqStatus[m.id];
      return m.created_by_user === session.user.id || st === "approved" || st === "pending";
    });
  }, [filteredList, myReqStatus, session]);

  const visibleList = viewMode === "mine" ? myList : filteredList;

  /* Requests modal */
  async function openRequests(matchId) {
    if (!session) return goLogin();
    try {
      setPendingBusy(true);
      setRequestsOpenFor(matchId);

      const reqs = await fetchPendingRequests(matchId);
      setPending(reqs);

      const ids = reqs.map((r) => r.user_id).filter(Boolean);
      if (ids.length > 0) {
        const profs = await fetchProfilesByIds(ids);
        setProfilesById((prev) => ({ ...prev, ...profs }));
      }
    } catch (e) {
      alert(e?.message ?? "No se pudieron cargar solicitudes");
      setRequestsOpenFor(null);
      setPending([]);
    } finally {
      setPendingBusy(false);
    }
  }

  async function handleApprove(requestId) {
    try {
      await approveRequest({ requestId });
      await openRequests(requestsOpenFor);
      await reload();
    } catch (e) {
      alert(e?.message ?? "No se pudo aprobar");
    }
  }

  async function handleReject(requestId) {
    try {
      await rejectRequest({ requestId });
      await openRequests(requestsOpenFor);
      await reload();
    } catch (e) {
      alert(e?.message ?? "No se pudo rechazar");
    }
  }

  /* Create form helpers */
  const clubSuggestions = useMemo(() => {
    const q = (clubQuery || "").trim().toLowerCase();
    if (!q) return [];
    return clubsSheet
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
      await reload();
      alert("Partido creado ✅");
    } catch (e) {
      setSaveError(e?.message || "No se pudo crear el partido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      {/* DEBUG SOLO SI ?debug=1 */}
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
          authReady: {String(authReady)} <br />
          session: {session ? "SI" : "NO"}
        </div>
      ) : null}

      {/* ✅ BOTÓN PUSH (solo si URL tiene ?push=1) */}
      {new URLSearchParams(location.search).get("push") === "1" ? (
        <button
          type="button"
          onClick={async () => {
            try {
              await ensurePushSubscription();
              setPushEnabled(true)
              alert("✅ Push activado");
            } catch (e) {
              console.error(e);
              alert("❌ Error push: " + (e?.message || String(e)));
            }
          }}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 999999,
            padding: "12px 14px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          🔔 Activar Push
        </button>
      ) : null}

      <div className="pageWrap">
        <div className="container">
          {/* HEADER */}
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Partidos</h1>
              <div className="pageMeta">
                {status.loading ? "Cargando…" : `Mostrando ${visibleList.length}`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {showPushButton ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      await ensurePushSubscription();
                      alert("✅ Push activado");
                    } catch (e) {
                      console.error(e);
                      alert("❌ Error push: " + (e?.message || String(e)));
                    }
                  }}
                >
                  🔔 Activar Push
                </button>
              ) : null}

              <button
                className="btn"
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
                Crear partido
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
          {pushChecking ? "🔄 Revisando Push…" : pushEnabled ? "🔔 Push activo ✅" : "🔕 Push no activo"}
        </div>

          {/* TABS */}
          <div className="gpRow">
            <button
              className={`btn ${viewMode === "explore" ? "" : "ghost"}`}
              onClick={() => setViewMode("explore")}
            >
              Explorar
            </button>
            <button
              className={`btn ${viewMode === "mine" ? "" : "ghost"}`}
              disabled={!session}
              onClick={() => setViewMode("mine")}
            >
              Mis partidos
            </button>
          </div>

          {/* LIST */}
          <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
            {visibleList.map((m) => {
              const approved = approvedCounts[m.id] || 0;
              const occupied = Math.min(4, approved + (m.reserved_spots || 1));
              const left = 4 - occupied;

              const myStatus = myReqStatus[m.id]; // approved|pending|rejected|undefined
              const isCreator = session?.user?.id === m.created_by_user;

              return (
                <li key={m.id} style={{ marginBottom: 12 }}>
                  <div className="card">
                    <div className="gpCardTop">
                      <div>
                        <strong style={{ fontSize: 16 }}>{m.club_name}</strong>
                        <div className="meta">
                          {new Date(m.start_at).toLocaleString("es-ES")} · {m.duration_min} min · Nivel {m.level}
                        </div>
                        <div className="meta">
                          Ocupadas {occupied}/4 · Huecos {left}
                        </div>

                        {myStatus === "approved" ? <div className="gpBadge ok">✅ Estás dentro</div> : null}
                        {myStatus === "pending" ? <div className="gpBadge warn">⏳ Solicitud pendiente</div> : null}
                        {myStatus === "rejected" ? <div className="gpBadge bad">❌ Rechazado</div> : null}
                      </div>
                    </div>

                    <div className="gpActions">
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
                              await reload();
                              alert("Solicitud enviada ✅");
                            } catch (e) {
                              alert(e?.message || "No se pudo enviar la solicitud");
                            }
                          }}
                        >
                          Unirme
                        </button>
                      ) : null}

                      {session && myStatus === "pending" ? (
                        <button
                          className="btn ghost"
                          onClick={async () => {
                            try {
                              await cancelMyJoin(m.id);
                              await reload();
                              alert("Solicitud cancelada ✅");
                            } catch (e) {
                              alert(e?.message || "No se pudo cancelar");
                            }
                          }}
                        >
                          Cancelar solicitud
                        </button>
                      ) : null}

                      {session && myStatus === "rejected" ? (
                        <button
                          className="btn"
                          onClick={async () => {
                            try {
                              await cancelMyJoin(m.id);
                              await requestJoin(m.id);
                              await reload();
                              alert("Solicitud enviada ✅");
                            } catch (e) {
                              alert(e?.message || "No se pudo enviar");
                            }
                          }}
                        >
                          Solicitar de nuevo
                        </button>
                      ) : null}

                      {isCreator ? (
                        <button type="button" className="btn ghost" onClick={() => openRequests(m.id)}>
                          Solicitudes
                        </button>
                      ) : null}

                      {session && (isCreator || myStatus === "approved" || myStatus === "pending") ? (
                        <button className="btn ghost" onClick={() => openChat(m.id)}>
                          Chat
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {status.error ? <div style={{ marginTop: 10, color: "crimson" }}>{status.error}</div> : null}
        </div>
      </div>

      {/* CREATE MODAL */}
      {openCreate ? (
        <div className="gpModalOverlay" onClick={() => setOpenCreate(false)}>
          <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <h2 style={{ margin: 0, fontSize: 18 }}>Crear partido</h2>
              <button className="btn ghost" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpForm">
              <label className="gpLabel">Club</label>
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
                    <button
                      key={String(c.id)}
                      className="gpSuggestItem"
                      onClick={() => pickClub(c)}
                      type="button"
                    >
                      <strong>{c.name}</strong>
                      {c.city ? <span style={{ opacity: 0.7 }}> · {c.city}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Fecha</label>
                  <input
                    className="gpInput"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="gpLabel">Hora</label>
                  <input
                    className="gpInput"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Duración (min)</label>
                  <input
                    className="gpInput"
                    type="number"
                    value={form.durationMin}
                    onChange={(e) => setForm((p) => ({ ...p, durationMin: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="gpLabel">Nivel</label>
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

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Ya somos</label>
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
                  <label className="gpLabel">Precio / jugador (opcional)</label>
                  <input
                    className="gpInput"
                    value={form.pricePerPlayer}
                    onChange={(e) => setForm((p) => ({ ...p, pricePerPlayer: e.target.value }))}
                  />
                </div>
              </div>

              {saveError ? <div style={{ color: "crimson", marginTop: 8 }}>{saveError}</div> : null}

              <div className="gpRow" style={{ marginTop: 14 }}>
                <button className="btn" disabled={saving} onClick={handleCreate}>
                  {saving ? "Guardando…" : "Crear"}
                </button>
                <button className="btn ghost" onClick={() => setOpenCreate(false)}>
                  Cancelar
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                *Para evitar equivocaciones, el club debe seleccionarse desde la lista.
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
              <h2 style={{ margin: 0, fontSize: 18 }}>Solicitudes pendientes</h2>
              <button className="btn ghost" onClick={() => setRequestsOpenFor(null)}>
                Cerrar
              </button>
            </div>

            {pendingBusy ? (
              <div style={{ marginTop: 12, fontSize: 13 }}>Cargando…</div>
            ) : pending.length === 0 ? (
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
                No hay solicitudes pendientes.
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
                {pending.map((r) => (
                  <li key={r.id} style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>
                    <div style={{ fontSize: 13 }}>
                      Solicitud de: <strong>{profilesById[r.user_id]?.name || r.user_id}</strong>
                    </div>

                    <div className="gpActions" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => handleApprove(r.id)}>
                        Aprobar
                      </button>
                      <button className="btn ghost" onClick={() => handleReject(r.id)}>
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

      {/* CHAT MODAL */}
{chatOpenFor ? (
  <div className="gpModalOverlay" onClick={() => setChatOpenFor(null)}>
    <div className="gpModalCard" onClick={(e) => e.stopPropagation()}>
      <div className="gpModalHeader">
        <h2 style={{ margin: 0, fontSize: 18 }}>Chat del partido</h2>
        <button className="btn ghost" onClick={() => setChatOpenFor(null)}>
          Cerrar
        </button>
      </div>

      {chatLoading ? (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
          Cargando chat…
        </div>
      ) : null}

      <div className="gpChatBox">
        {chatItems.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 13 }}>Aún no hay mensajes.</div>
        ) : (
          chatItems.map((m) => {
            const mine = session?.user?.id && m.user_id === session.user.id;

            return (
              <div
                key={m.id}
                className="gpChatMsg"
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  opacity: m.__optimistic ? 0.7 : 1,
                  border: m.__error ? "1px solid crimson" : undefined,
                }}
              >
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {m.message}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    opacity: 0.6,
                    textAlign: mine ? "right" : "left",
                  }}
                >
                  {m.created_at ? new Date(m.created_at).toLocaleString("es-ES") : ""}
                  {m.__error ? " · Error" : ""}
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
        <button
          className="btn"
          onClick={handleSendChat}
          disabled={!chatText.trim() || chatSending}
        >
          {chatSending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  </div>
) : null}
    </div>
  );
}
