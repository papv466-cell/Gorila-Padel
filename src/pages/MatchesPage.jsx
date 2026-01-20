import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProfilesByIds } from "../services/profilesPublic";
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
  fetchLastMessageAtForMatchIds,
  approveRequest,
  rejectRequest,
  deleteMatch,
} from "../services/matches";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { supabase } from "../services/supabaseClient";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";

function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getChatLastRead(matchId) {
  try {
    const v = localStorage.getItem(`gp:chatLastRead:${matchId}`);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function setChatLastRead(matchId, ts) {
  try {
    localStorage.setItem(`gp:chatLastRead:${matchId}`, String(ts));
  } catch {}
}

function formatChipLabel(dayISO) {
  const d = new Date(`${dayISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayISO;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

// mismos que MapPage
const SHEET_ID = "1d5wDnfeqedHMWF4hdBBoeAUf0KqwZrEOJ8k-6i8Fj0o";
const GID = 0;

export default function MatchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const todayISO = toDateInputValue(new Date());

  const clubIdParam = searchParams.get("clubId") || "";
  const clubNameParam = searchParams.get("clubName") || "";
  const createParam = searchParams.get("create") || "";
  const refreshParam = searchParams.get("refresh") || "";

  const cameFromMapCreate = createParam === "1" && !!clubIdParam && !!clubNameParam;
  const isClubFilter = !!clubIdParam || !!clubNameParam;

  const [selectedDay, setSelectedDay] = useState(() => toDateInputValue(new Date()));

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  // --- CHAT ---
  const [chatOpenFor, setChatOpenFor] = useState(null); // matchId o null
  const [chatItems, setChatItems] = useState([]); // mensajes
  const [chatStatus, setChatStatus] = useState({ loading: false, error: null });
  const [chatText, setChatText] = useState("");
  const [lastMsgAtByMatch, setLastMsgAtByMatch] = useState({});

  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [joinBusyId, setJoinBusyId] = useState(null);

  const [requestsOpenFor, setRequestsOpenFor] = useState(null);
  const [pending, setPending] = useState([]);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [profilesById, setProfilesById] = useState({});

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clubName: "",
    clubId: "",
    date: toDateInputValue(new Date()),
    time: "19:00",
    durationMin: 90,
    level: "medio",
    alreadyPlayers: 1,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Scroll al partido nuevo
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const scrolledForIdRef = useRef(null);

  // --- Clubs (autocomplete) ---
  const [clubsSheet, setClubsSheet] = useState([]);
  const [clubsStatus, setClubsStatus] = useState({ loading: false, error: null });
  const [clubQuery, setClubQuery] = useState("");
  const [showClubSuggest, setShowClubSuggest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClubs() {
      try {
        setClubsStatus({ loading: true, error: null });
        const data = await fetchClubsFromGoogleSheet({ sheetId: SHEET_ID, gid: GID });
        if (cancelled) return;

        const clean = (Array.isArray(data) ? data : [])
          .filter((c) => c?.id != null && c?.name)
          .map((c) => ({
            id: String(c.id),
            name: String(c.name),
            city: String(c.city ?? ""),
          }));

        setClubsSheet(clean);
        setClubsStatus({ loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setClubsSheet([]);
        setClubsStatus({ loading: false, error: e?.message ?? "No se pudieron cargar clubs" });
      }
    }

    loadClubs();
    return () => {
      cancelled = true;
    };
  }, []);

  const clubSuggestions = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    if (!q) return [];
    return clubsSheet
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clubQuery, clubsSheet]);

  function pickClub(c) {
    setForm((f) => ({
      ...f,
      clubName: c.name,
      clubId: c.id,
    }));
    setClubQuery(c.name);
    setShowClubSuggest(false);
  }

  function goLogin() {
    const returnTo = location.pathname + location.search;
    navigate("/login", { state: { from: returnTo } });
  }

  async function openChat(matchId) {
    if (!session) return goLogin();

    setChatOpenFor(matchId);
    setChatText("");
    setChatStatus({ loading: true, error: null });

    try {
      const msgs = await fetchMatchMessages(matchId, { limit: 120 });
      setChatItems(msgs);
      setChatStatus({ loading: false, error: null });
      
      // ✅ marcar como leído al abrir (después de cargar)
      setChatLastRead(matchId, Date.now());

      setTimeout(() => {
        const el = document.getElementById("chatBottom");
        el?.scrollIntoView?.({ behavior: "smooth" });
      }, 30);
    } catch (e) {
      setChatItems([]);
      setChatStatus({ loading: false, error: e?.message ?? "Error cargando chat" });
    }
  }

  async function refreshChat() {
    if (!chatOpenFor) return;
    setChatStatus({ loading: true, error: null });
    try {
      const msgs = await fetchMatchMessages(chatOpenFor, { limit: 120 });
      setChatItems(msgs);
      setChatLastRead(chatOpenFor, Date.now());
      setChatStatus({ loading: false, error: null });
    } catch (e) {
      setChatStatus({ loading: false, error: e?.message ?? "Error refrescando chat" });
    }
  }

  async function handleSendChat() {
    if (!chatOpenFor) return;
    try {
      await sendMatchMessage({ matchId: chatOpenFor, message: chatText });
      setChatText("");
      await refreshChat();

      setTimeout(() => {
        const el = document.getElementById("chatBottom");
        el?.scrollIntoView?.({ behavior: "smooth" });
      }, 30);
    } catch (e) {
      alert(e?.message ?? "No se pudo enviar");
    }
  }

  async function reload() {
    try {
      setStatus({ loading: true, error: null });

      const data = await fetchMatches({ limit: 500 });
      setItems(data);

      const ids = data.map((m) => m.id);

      if (ids.length > 0) {
        try {
          const last = await fetchLastMessageAtForMatchIds(ids);
          setLastMsgAtByMatch(last);
        } catch {
          setLastMsgAtByMatch({});
        }
      } else {
        setLastMsgAtByMatch({});
      }      

      if (session && ids.length > 0) {
        const mine = await fetchMyRequestsForMatchIds(ids);
        setMyReqStatus(mine);

        const ac = await fetchApprovedCounts(ids);
        setApprovedCounts(ac);
      } else {
        setMyReqStatus({});
        setApprovedCounts({});
      }

      setStatus({ loading: false, error: null });
    } catch (e) {
      setStatus({ loading: false, error: e?.message ?? "Error cargando partidos" });
    }
  }

  async function handleDeleteMatch(matchId) {
    if (!session) return goLogin();

    const ok = window.confirm("¿Eliminar este partido? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      await deleteMatch(matchId);
      await reload();
    } catch (e) {
      alert(e?.message ?? "No se pudo eliminar el partido");
    }
  }

  // Sesión
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Cargar partidos
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, refreshParam]);

  // Lista filtrada por club (si aplica)
  const list = useMemo(() => {
    if (!clubIdParam && !clubNameParam) return items;

    const byId = clubIdParam ? items.filter((m) => String(m.club_id ?? "") === String(clubIdParam)) : [];
    const byName = clubNameParam ? items.filter((m) => String(m.club_name ?? "") === String(clubNameParam)) : [];

    const map = new Map();
    for (const m of [...byId, ...byName]) map.set(m.id, m);
    return Array.from(map.values());
  }, [items, clubIdParam, clubNameParam]);

  // Días disponibles (solo con filtro)
  const availableDays = useMemo(() => {
    if (!isClubFilter) return [];

    const set = new Set();
    for (const m of list) {
      const d = new Date(m.start_at);
      if (!Number.isNaN(d.getTime())) set.add(toDateInputValue(d));
    }
    return Array.from(set).sort();
  }, [list, isClubFilter]);

  // Lista por día seleccionado (solo con filtro)
  const listForSelectedDay = useMemo(() => {
    if (!isClubFilter) return list;
    if (!selectedDay) return list;

    return list.filter((m) => {
      const d = new Date(m.start_at);
      if (Number.isNaN(d.getTime())) return false;
      return toDateInputValue(d) === selectedDay;
    });
  }, [list, isClubFilter, selectedDay]);

  // create=1 -> abre modal o login
  useEffect(() => {
    if (!cameFromMapCreate) return;
    if (!authChecked) return;

    if (!session) {
      goLogin();
      return;
    }

    setForm((f) => ({
      ...f,
      clubId: clubIdParam,
      clubName: clubNameParam,
      date: selectedDay || f.date,
    }));

    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameFromMapCreate, authChecked, session, clubIdParam, clubNameParam]);

  async function handleCreate() {
    setSaveError(null);

    const clubName = String((cameFromMapCreate ? clubNameParam : form.clubName) ?? "").trim();
    const clubId =
      String((cameFromMapCreate ? clubIdParam : form.clubId) ?? "").trim() ||
      clubName.toLowerCase().replace(/\s+/g, "-");

    const date = String(form.date ?? "").trim();
    const time = String(form.time ?? "").trim();

    if (!clubName) return setSaveError("Falta club.");
    if (!date || !time) return setSaveError("Elige fecha y hora.");

    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return setSaveError("Fecha/hora inválida.");

    try {
      setSaving(true);

      const created = await createMatch({
        clubId,
        clubName,
        startAtISO: start.toISOString(),
        durationMin: Number(form.durationMin) || 90,
        level: form.level,
        alreadyPlayers: Number(form.alreadyPlayers) || 1,
      });

      setOpen(false);

      const createdDay = toDateInputValue(new Date(created.start_at));
      setSelectedDay(createdDay);
      setForm((f) => ({ ...f, date: createdDay }));

      setLastCreatedId(created.id);

      await reload();

      if (cameFromMapCreate) {
        const refresh = Date.now();
        navigate(
          `/partidos?clubId=${encodeURIComponent(clubId)}&clubName=${encodeURIComponent(clubName)}&refresh=${refresh}`,
          { replace: true }
        );
      }
    } catch (e) {
      setSaveError(e?.message ?? "Error creando partido");
    } finally {
      setSaving(false);
    }
  }

  // Scroll al creado (una vez)
  useEffect(() => {
    if (!lastCreatedId) return;
    if (scrolledForIdRef.current === lastCreatedId) return;

    const t = setTimeout(() => {
      const el = document.getElementById(`match-${lastCreatedId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolledForIdRef.current = lastCreatedId;
      }
    }, 50);

    return () => clearTimeout(t);
  }, [lastCreatedId, listForSelectedDay]);

  async function handleRequestJoin(matchId) {
    if (!session) return goLogin();

    try {
      setJoinBusyId(matchId);
      await requestJoin(matchId);
      await reload();
      alert("Solicitud enviada. El creador del partido debe aprobarte.");
    } catch (e) {
      alert(e?.message ?? "No se pudo enviar la solicitud");
    } finally {
      setJoinBusyId(null);
    }
  }

  async function handleCancelMyJoin(matchId) {
    if (!session) return goLogin();

    try {
      await cancelMyJoin(matchId);

      setMyReqStatus((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });

      await reload();
      alert("Has salido del partido.");
    } catch (e) {
      alert(e?.message ?? "No se pudo salir del partido");
    }
  }

  async function openRequests(matchId) {
    if (!session) return goLogin();

    try {
      setPendingBusy(true);
      setRequestsOpenFor(matchId);

      const reqs = await fetchPendingRequests(matchId);
      setPending(reqs);

      const ids = reqs.map((r) => r.user_id);
      const profs = await fetchProfilesByIds(ids);
      setProfilesById((prev) => ({ ...prev, ...profs }));
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

  function clearClubFilter() {
    setLastCreatedId(null);
    scrolledForIdRef.current = null;
    setSelectedDay(toDateInputValue(new Date()));
    navigate("/partidos", { replace: true });
  }

  return (
    <div className="page">
          <button
      type="button"
      onClick={async () => {
        try {
          const { ensurePushSubscription } = await import("../services/push");
          await ensurePushSubscription();
          alert("✅ Push activado y guardado en Supabase");
        } catch (e) {
          console.error("❌ PUSH ERROR:", e);
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

      <header className="topbar">
        <h1 className="title">Partidos</h1>

        <p className="subtitle">
          {status.loading ? "Cargando…" : status.error ? `Error: ${status.error}` : `Partidos: ${listForSelectedDay.length}`}
        </p>

        {isClubFilter ? (
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 999, background: "#fff" }}>
              Club: <strong>{clubNameParam || clubIdParam}</strong>
            </div>

            <button type="button" className="btn ghost" onClick={clearClubFilter}>
              Ver todos
            </button>
          </div>
        ) : null}

        {isClubFilter ? (
          <div className="dayPicker">
            <div className="dayPickerTop">
              <div className="dayPickerMeta">
                Día seleccionado: <strong>{selectedDay}</strong>
              </div>

              <label style={{ fontSize: 12 }}>
                Cambiar día
                <input
                  className="dayPickerInput"
                  type="date"
                  value={selectedDay}
                  min={todayISO}
                  onChange={(e) => {
                    const next = e.target.value;
                    const safe = next < todayISO ? todayISO : next;
                    setSelectedDay(safe);
                    setForm((f) => ({ ...f, date: safe }));
                  }}
                />
              </label>
            </div>

            {availableDays.length > 0 ? (
              <div className="dayChips">
                {availableDays.slice(0, 10).map((day) => {
                  const active = day === selectedDay;
                  const isPast = day < todayISO;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPast}
                      className={`dayChip ${active ? "dayChipActive" : ""}`}
                      onClick={() => {
                        if (isPast) return;
                        setSelectedDay(day);
                        setForm((f) => ({ ...f, date: day }));
                      }}
                      style={isPast ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                    >
                      {formatChipLabel(day)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Aún no hay días con partidos.</div>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!session) return goLogin();
              setClubQuery(form.clubName || "");
              setShowClubSuggest(false);
              setForm((f) => ({ ...f, date: selectedDay || f.date }));
              setOpen(true);
            }}
          >
            Crear partido
          </button>
        </div>
      </header>

      <div style={{ padding: 16 }}>
        {listForSelectedDay.length === 0 && !status.loading && !status.error ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
            No hay partidos todavía.
          </div>
        ) : null}

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {listForSelectedDay.map((m) => {
            const reserved = Number(m.reserved_spots ?? 1);
            const approved = Number(approvedCounts[m.id] ?? 0);
            const occupied = Math.min(4, reserved + approved);
            const left = Math.max(0, 4 - occupied);
            const lastRead = getChatLastRead(m.id);
            const lastMsgAtISO = lastMsgAtByMatch[m.id];
            const lastMsgAtMs = lastMsgAtISO ? new Date(lastMsgAtISO).getTime() : 0;
            const hasNewChat = lastMsgAtMs > lastRead;

            const startMs = new Date(m.start_at).getTime();
            const nowMs = Date.now();
            const isLocked24h = Number.isFinite(startMs) ? startMs - nowMs <= 24 * 60 * 60 * 1000 : false;

            const myStatus = myReqStatus[m.id];
            const isCreator = session?.user?.id && m.created_by_user === session.user.id;
            const canShowLeave = !!session && !isCreator && (myStatus === "approved" || myStatus === "pending");
            const isNew = lastCreatedId === m.id;

            return (
              <li
                key={m.id}
                id={`match-${m.id}`}
                style={{
                  marginBottom: 10,
                  outline: isNew ? "2px solid rgba(17, 24, 39, 0.25)" : "none",
                  borderRadius: 10,
                }}
              >
                <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
                  <strong>{m.club_name}</strong>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                    {new Date(m.start_at).toLocaleString("es-ES")} · {m.duration_min} min · Nivel: {m.level}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                    Ocupadas: {occupied}/4 · Huecos: {left}
                  </div>

                  {session ? (
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      {isCreator
                        ? "👑 Eres la creadora"
                        : myStatus === "approved"
                        ? "✅ Estás dentro"
                        : myStatus === "pending"
                        ? "⏳ Solicitud pendiente"
                        : myStatus === "rejected"
                        ? "❌ Solicitud rechazada"
                        : "—"}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {left <= 0 ? (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>Completo</span>
                    ) : !session ? (
                      <button type="button" className="btn" onClick={goLogin}>
                        Entrar para unirme
                      </button>
                    ) : isCreator ? (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>Partido creado por ti</span>
                    ) : myStatus ? (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        {myStatus === "pending" ? "Solicitud enviada" : myStatus === "approved" ? "Dentro" : "Rechazado"}
                      </span>
                    ) : (
                      <button type="button" className="btn" onClick={() => handleRequestJoin(m.id)} disabled={joinBusyId === m.id}>
                        {joinBusyId === m.id ? "Enviando…" : "Unirme"}
                      </button>
                    )}

                    {/* ✅ Chat: creadora o pending/approved */}
                    {session && (isCreator || myStatus === "approved" || myStatus === "pending") ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => openChat(m.id)}
                        style={{ position: "relative" }}
                      >
                        Chat
                        {hasNewChat ? (
                          <span
                            style={{
                              marginLeft: 8,
                              display: "inline-block",
                              minWidth: 18,
                              height: 18,
                              lineHeight: "18px",
                              borderRadius: 999,
                              padding: "0 6px",
                              fontSize: 11,
                              fontWeight: 800,
                              background: "#111827",
                              color: "#fff",
                            }}
                            title="Tienes mensajes nuevos"
                          >
                            ●
                          </span>
                        ) : null}
                      </button>
                    ) : null}

                    {canShowLeave ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => handleCancelMyJoin(m.id)}
                        disabled={isLocked24h}
                        title={isLocked24h ? "Bloqueado: faltan menos de 24h" : "Salir del partido"}
                      >
                        {isLocked24h ? "Bloqueado (24h)" : "Salir del partido"}
                      </button>
                    ) : null}

                    {isCreator ? (
                      <>
                        <button type="button" className="btn ghost" onClick={() => openRequests(m.id)}>
                          Solicitudes
                        </button>

                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => handleDeleteMatch(m.id)}
                          style={{ borderColor: "rgba(220, 38, 38, 0.35)" }}
                        >
                          Eliminar
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* MODAL Crear partido */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => setOpen(false)}
        >
          <div style={{ width: "min(520px, 100%)", background: "#fff", borderRadius: 10, padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Crear partido</h2>

            {cameFromMapCreate ? (
              <div style={{ marginTop: 8, padding: 10, border: "1px solid #eee", borderRadius: 8, fontSize: 13 }}>
                <strong>{clubNameParam}</strong>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Club seleccionado desde el mapa</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {/* ✅ AUTOCOMPLETE */}
                <label style={{ fontSize: 12, position: "relative" }}>
                  Club (nombre)
                  <input
                    value={clubQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setClubQuery(v);
                      setForm((f) => ({ ...f, clubName: v, clubId: "" }));
                      setShowClubSuggest(true);
                    }}
                    onFocus={() => setShowClubSuggest(true)}
                    onBlur={() => setTimeout(() => setShowClubSuggest(false), 120)}
                    placeholder={clubsStatus.loading ? "Cargando clubs…" : "Empieza a escribir (ej: Inacua)"}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                    }}
                  />

                  {showClubSuggest && clubSuggestions.length > 0 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        border: "1px solid #ddd",
                        borderRadius: 10,
                        background: "#fff",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.10)",
                        overflow: "hidden",
                        zIndex: 9999,
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
                            padding: "10px 12px",
                            border: 0,
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                          {c.city ? <div style={{ fontSize: 12, opacity: 0.7 }}>{c.city}</div> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {clubsStatus.error ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: "crimson" }}>{clubsStatus.error}</div>
                  ) : null}
                </label>

                <label style={{ fontSize: 12 }}>
                  Club ID (opcional)
                  <input
                    value={form.clubId}
                    onChange={(e) => setForm((f) => ({ ...f, clubId: e.target.value }))}
                    style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: 12 }}>
                  Fecha
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                  />
                </label>

                <label style={{ fontSize: 12 }}>
                  Hora
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: 12 }}>
                  Duración (min)
                  <select
                    value={form.durationMin}
                    onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                    style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                  >
                    <option value={60}>60</option>
                    <option value={90}>90</option>
                    <option value={120}>120</option>
                  </select>
                </label>

                <label style={{ fontSize: 12 }}>
                  Nivel
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                  >
                    <option value="iniciacion">Iniciación</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </label>
              </div>

              <label style={{ fontSize: 12 }}>
                Ya somos…
                <select
                  value={form.alreadyPlayers}
                  onChange={(e) => setForm((f) => ({ ...f, alreadyPlayers: Number(e.target.value) }))}
                  style={{ width: "100%", marginTop: 4, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value={1}>1 (me falta 3)</option>
                  <option value={2}>2 (me falta 2)</option>
                  <option value={3}>3 (me falta 1)</option>
                </select>
              </label>

              {saveError ? <div style={{ fontSize: 12, color: "crimson" }}>{saveError}</div> : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" className="btn" onClick={handleCreate} disabled={saving}>
                  {saving ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL Solicitudes */}
      {requestsOpenFor ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => setRequestsOpenFor(null)}
        >
          <div style={{ width: "min(520px, 100%)", background: "#fff", borderRadius: 10, padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Solicitudes pendientes</h2>

            {pendingBusy ? (
              <div style={{ marginTop: 12, fontSize: 12 }}>Cargando…</div>
            ) : pending.length === 0 ? (
              <div style={{ marginTop: 12, fontSize: 12 }}>No hay solicitudes pendientes.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
                {pending.map((r) => (
                  <li key={r.id} style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}>
                    {(() => {
                      const p = profilesById[r.user_id];
                      if (!p) return <div style={{ fontSize: 12, opacity: 0.8 }}>Usuario: {r.user_id}</div>;

                      const sexLabel = p.sex === "M" ? "Hombre" : p.sex === "F" ? "Mujer" : "Otro";
                      const levelLabel = p.level === "iniciacion" ? "Iniciación" : p.level === "medio" ? "Medio" : "Alto";
                      const handLabel = p.hand === "derecha" ? "Derecha" : "Izquierda";

                      return (
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>
                            {p.age} años · {sexLabel} · Nivel: {levelLabel} · Mano: {handLabel}
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button type="button" className="btn" onClick={() => handleApprove(r.id)}>
                        Aprobar
                      </button>
                      <button type="button" className="btn ghost" onClick={() => handleReject(r.id)}>
                        Rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setRequestsOpenFor(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ MODAL CHAT (UNA SOLA VEZ, FUERA DE LISTAS) */}
      {chatOpenFor ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => {
            setChatLastRead(chatOpenFor, Date.now());
            setChatOpenFor(null);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 12,
              padding: 14,
              display: "grid",
              gap: 10,
              maxHeight: "80vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Chat del partido</h2>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn ghost" onClick={refreshChat} disabled={chatStatus.loading}>
                  {chatStatus.loading ? "Cargando…" : "Refrescar"}
                </button>
                <button type="button" className="btn ghost" onClick={() => setChatOpenFor(null)}>
                  Cerrar
                </button>
              </div>
            </div>

            {chatStatus.error ? <div style={{ fontSize: 12, color: "crimson" }}>{chatStatus.error}</div> : null}

            <div
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 10,
                padding: 10,
                overflow: "auto",
                background: "#fff",
                minHeight: 260,
              }}
            >
              {chatItems.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>Aún no hay mensajes.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {chatItems.map((msg) => {
                    const mine = session?.user?.id === msg.user_id;
                    return (
                      <div key={msg.id} style={{ display: "grid", justifyItems: mine ? "end" : "start" }}>
                        <div
                          style={{
                            maxWidth: "85%",
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.10)",
                            background: mine ? "rgba(17,24,39,0.04)" : "#fff",
                            whiteSpace: "pre-wrap",
                            fontSize: 13,
                          }}
                        >
                          {msg.message}
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                            {new Date(msg.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div id="chatBottom" />
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <textarea
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Escribe algo…"
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.14)",
                  font: "inherit",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn" onClick={handleSendChat} disabled={!chatText.trim()}>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
