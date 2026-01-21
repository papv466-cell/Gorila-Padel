// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  deleteMatch,
  fetchLatestChatTimes,
} from "../services/matches";
import { fetchProfilesByIds } from "../services/profilesPublic";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";

/* =========================
   Utils
========================= */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatChipLabel(dayISO) {
  const d = new Date(`${dayISO}T00:00:00`);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function getChatLastRead(matchId) {
  try {
    return Number(localStorage.getItem(`gp:chatLastRead:${matchId}`)) || 0;
  } catch {
    return 0;
  }
}

function setChatLastRead(matchId, ts) {
  try {
    localStorage.setItem(`gp:chatLastRead:${matchId}`, String(ts));
  } catch {}
}

/* =========================
   Config
========================= */
const SHEET_ID = "1d5wDnfeqedHMWF4hdBBoeAUf0KqwZrEOJ8k-6i8Fj0o";
const GID = 0;

/* =========================
   Component
========================= */
export default function MatchesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const todayISO = toDateInputValue(new Date());
  const openChatParam = searchParams.get("openChat") || "";
  const clubIdParam = searchParams.get("clubId") || "";
  const clubNameParam = searchParams.get("clubName") || "";
  const createParam = searchParams.get("create") === "1";
  const isClubFilter = !!clubIdParam || !!clubNameParam;

  /* ===== State ===== */
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [latestChatTsByMatch, setLatestChatTsByMatch] = useState({});
  
  // --- SOLICITUDES (para creador del partido) ---
  const [requestsOpenFor, setRequestsOpenFor] = useState(null); // matchId o null
  const [pending, setPending] = useState([]); // array de requests
  const [pendingBusy, setPendingBusy] = useState(false);
  const [profilesById, setProfilesById] = useState({});

  const [viewMode, setViewMode] = useState("explore"); // explore | mine
  const [selectedDay, setSelectedDay] = useState(todayISO);

  /* ===== Chat ===== */
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatItems, setChatItems] = useState([]);
  const [chatText, setChatText] = useState("");

  /* ===== Crear partido ===== */
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [form, setForm] = useState({
    clubName: "",
    clubId: "",
    date: todayISO,
    time: "19:00",
    durationMin: 90,
    level: "medio",
    alreadyPlayers: 1,
    pricePerPlayer: "", // ✅ nuevo (string para input)
  });

  /* ===== Clubs ===== */
  const [clubsSheet, setClubsSheet] = useState([]);
  const [clubQuery, setClubQuery] = useState("");
  const [showClubSuggest, setShowClubSuggest] = useState(false);

  /* =========================
     Session
  ========================= */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  function goLogin() {
    navigate("/login", { state: { from: location.pathname + location.search } });
  }

  /* =========================
     Load data
  ========================= */
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
      }

      setStatus({ loading: false, error: null });
    } catch (e) {
      setStatus({ loading: false, error: e?.message || "Error cargando partidos" });
    }
  }

  useEffect(() => {
    reload();
  }, [session]);

  /* =========================
     Lists
  ========================= */
  const filteredList = useMemo(() => {
    let list = items;
  
    // filtro por club si viene desde el mapa
    if (clubIdParam) list = list.filter((m) => m.club_id === clubIdParam);
    if (clubNameParam) list = list.filter((m) => m.club_name === clubNameParam);
  
    // ✅ SOLO filtramos por día si hay filtro de club
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

  /* =========================
     Chat
  ========================= */
  async function openChat(matchId) {
    if (!session) return goLogin();
    setChatOpenFor(matchId);
    const msgs = await fetchMatchMessages(matchId, { limit: 120 });
    setChatItems(msgs);

    const last = msgs[msgs.length - 1];
    if (last?.created_at) {
      setChatLastRead(matchId, new Date(last.created_at).getTime());
    }
  }

  async function handleSendChat() {
    await sendMatchMessage({ matchId: chatOpenFor, message: chatText });
    setChatText("");
    openChat(chatOpenFor);
  }

  async function openRequests(matchId) {
    if (!session) return goLogin();
  
    try {
      setPendingBusy(true);
      setRequestsOpenFor(matchId);
  
      const reqs = await fetchPendingRequests(matchId);
      setPending(reqs);
  
      // Cargamos perfiles para mostrar nombre/edad/nivel
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
      // ✅ IMPORTANTÍSIMO: aquí va el ID DE LA SOLICITUD (r.id), NO el user_id
      await approveRequest({ requestId });
  
      // refresca modal + lista principal
      await openRequests(requestsOpenFor);
      await reload();
    } catch (e) {
      // Si tu service no usa objeto, prueba: await approveRequest(requestId)
      alert(e?.message ?? "No se pudo aprobar");
    }
  }
  
  async function handleReject(requestId) {
    try {
      await rejectRequest({ requestId });
  
      await openRequests(requestsOpenFor);
      await reload();
    } catch (e) {
      // Si tu service no usa objeto, prueba: await rejectRequest(requestId)
      alert(e?.message ?? "No se pudo rechazar");
    }
  }
  

  /* =========================
     Render
  ========================= */
  return (
    <div className="page">
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

            <div style={{ display: "flex", gap: 8 }}>
              {import.meta.env.DEV && (
                <button className="btn ghost" onClick={ensurePushSubscription}>
                  🔔 Push (DEV)
                </button>
              )}

              <button
                className="btn"
                onClickCapture={() => {
                  alert("CLICK OK ✅");
                  if (session) setOpenCreate(true);
                  else goLogin();
                }}
              >
                Crear partido
              </button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className={`btn ${viewMode === "explore" ? "" : "ghost"}`} onClickCapture={() => setViewMode("explore")}>
              Explorar
            </button>
            <button
              className={`btn ${viewMode === "mine" ? "" : "ghost"}`}
              disabled={!session}
              onClickCapture={() => setViewMode("mine")}
            >
              Mis partidos
            </button>
              </div>

          {/* LIST */}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {visibleList.map((m) => {
              const approved = approvedCounts[m.id] || 0;
              const occupied = Math.min(4, approved + (m.reserved_spots || 1));
              const left = 4 - occupied;
              const myStatus = myReqStatus[m.id]; // "approved" | "pending" | "rejected" | undefined

              const isCreator = session?.user?.id === m.created_by_user;

              return (
                <li key={m.id} style={{ marginBottom: 12 }}>
                  <div className="card">
                    <strong>{m.club_name}</strong>
                    <div className="meta">
                      {new Date(m.start_at).toLocaleString("es-ES")} · {m.duration_min} min · Nivel {m.level}
                    </div>
                    <div className="meta">Ocupadas {occupied}/4 · Huecos {left}</div>

                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {!session && <button className="btn" onClick={goLogin}>Entrar</button>}

                      {session && !isCreator && !myStatus && left > 0 && (
                        <button
                        className="btn"
                        onClickCapture={async () => {
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
                      
                      
                      )}

                      {isCreator ? (
                        <button type="button" className="btn ghost" onClick={() => openRequests(m.id)}>
                          Solicitudes
                        </button>
                      ) : null}
                        {openCreate ? (
                          <div
                            onClick={() => setOpenCreate(false)}
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
                          >
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: "min(520px, 100%)",
                                background: "#fff",
                                borderRadius: 12,
                                padding: 14,
                                border: "1px solid rgba(0,0,0,0.12)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                <h2 style={{ margin: 0, fontSize: 16 }}>Crear partido</h2>
                                <button type="button" className="btn ghost" onClick={() => setOpenCreate(false)}>
                                  Cerrar
                                </button>
                              </div>

                              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                                (Esto es la ventana. Si la ves, el botón ya funciona.)
                              </div>
                            </div>
                          </div>
                        ) : null}

                      {session && (isCreator || myStatus) && (
                        <button className="btn ghost" onClickCapture={() => openChat(m.id)}>
                        Chat
                      </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* =========================
    MODAL SOLICITUDES (solo creador)
   ========================= */}
{requestsOpenFor ? (
  <div
    onClick={() => setRequestsOpenFor(null)}
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
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(560px, 100%)",
        background: "#fff",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Solicitudes pendientes</h2>
        <button type="button" className="btn ghost" onClick={() => setRequestsOpenFor(null)}>
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
  <li key={r.id} style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
    
    <div style={{ fontSize: 13 }}>
  Solicitud de:{" "}
  <strong>{profilesById[r.user_id]?.name || r.user_id}</strong>
</div>

    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
      <button
        type="button"
        className="btn"
        onClickCapture={() => handleApprove(r.id)}
      >
        Aprobar
      </button>

      <button
        type="button"
        className="btn ghost"
        onClick={() => handleReject(r.id)}
      >
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
      {chatOpenFor && (
        <div className="modal">
          <div className="modalCard">
            <h3>Chat del partido</h3>

            {openCreate ? (
  <div
    onClick={() => setOpenCreate(false)}
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
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(520px, 100%)",
        background: "#fff",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Crear partido</h2>
        <button type="button" className="btn ghost" onClick={() => setOpenCreate(false)}>
          Cerrar
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        (Ahora mismo esto es solo para confirmar que se abre. Luego metemos aquí tu formulario.)
      </div>
    </div>
  </div>
) : null}


            <div className="chatBox">
              {chatItems.map((m) => (
                <div key={m.id}>{m.message}</div>
              ))}
            </div>

            <textarea value={chatText} onChange={(e) => setChatText(e.target.value)} />
            <button className="btn" onClick={handleSendChat}>Enviar</button>
            <button className="btn ghost" onClick={() => setChatOpenFor(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
