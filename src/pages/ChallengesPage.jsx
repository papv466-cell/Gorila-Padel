// src/pages/ChallengesPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

const IS = { width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, boxSizing: "border-box" };

const STATUS_LABELS = {
  pending: { label: "⏳ Pendiente", color: "#f59e0b" },
  accepted: { label: "✅ Aceptado", color: "var(--sport-color)" },
  rejected: { label: "❌ Rechazado", color: "#ef4444" },
  expired: { label: "💨 Expirado", color: "rgba(255,255,255,0.3)" },
  completed: { label: "🏆 Completado", color: "#8b5cf6" },
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Ahora";
  if (m < 60) return `Hace ${m}m`;
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${d}d`;
}

function PlayerChip({ userId, profiles, navigate, label }) {
  const p = profiles[userId];
  const name = p?.name || p?.handle || "?";
  return (
    <div onClick={() => navigate(`/usuario/${userId}`)}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8, background: "rgba(255,255,255,0.06)", cursor: "pointer" }}>
      {p?.avatar_url
        ? <img src={p.avatar_url} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
        : <span style={{ fontSize: 16 }}>🦍</span>}
      <div>
        {label && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, lineHeight: 1 }}>{label}</div>}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{name}</div>
      </div>
    </div>
  );
}

function SearchInput({ label, query, setQuery, results, onSelect, selected, placeholder }) {
  return (
    <div>
      <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>{label}</label>
      {selected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(var(--sport-color-rgb, 46,204,113),0.12)", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.3)" }}>
          {selected.avatar_url ? <img src={selected.avatar_url} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} /> : <span>🦍</span>}
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", flex: 1 }}>{selected.name || selected.handle}</span>
          <button onClick={() => onSelect(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      ) : (
        <>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder || "Busca por nombre o @handle…"} style={IS} />
          {results.length > 0 && (
            <div style={{ marginTop: 4, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
              {results.map(p => (
                <button key={p.id} onClick={() => { onSelect(p); setQuery(""); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", cursor: "pointer", textAlign: "left" }}>
                  {p.avatar_url ? <img src={p.avatar_url} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> : <span>🦍</span>}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name || p.handle}</div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>@{p.handle}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ChallengesPage({ session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all"); // all | mine | incoming
  const [openCreate, setOpenCreate] = useState(false);
  const [profiles, setProfiles] = useState({});

  // Chat
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Form nuevo reto
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerResults, setPartnerResults] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [opp1Query, setOpp1Query] = useState("");
  const [opp1Results, setOpp1Results] = useState([]);
  const [selectedOpp1, setSelectedOpp1] = useState(null);
  const [opp2Query, setOpp2Query] = useState("");
  const [opp2Results, setOpp2Results] = useState([]);
  const [selectedOpp2, setSelectedOpp2] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const uid = session?.user?.id;

  async function load() {
    if (!uid) return;
    try {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .or(`challenger_1.eq.${uid},challenger_2.eq.${uid},challenged_1.eq.${uid},challenged_2.eq.${uid}`)
        .order("created_at", { ascending: false });
      if (!aliveRef.current) return;
      setChallenges(data || []);

      const ids = new Set();
      for (const c of data || []) {
        [c.challenger_1, c.challenger_2, c.challenged_1, c.challenged_2].forEach(id => id && ids.add(id));
      }
      if (ids.size) {
        const { data: profs } = await supabase.from("profiles_public").select("id, name, handle, avatar_url").in("id", Array.from(ids));
        const map = {};
        for (const p of profs || []) map[p.id] = p;
        if (aliveRef.current) setProfiles(map);
      }
    } catch { toast.error("Error cargando retos"); }
    finally { if (aliveRef.current) setLoading(false); }
  }

  useEffect(() => { load(); }, [uid]);

  // Realtime chat
  useEffect(() => {
    if (!chatOpenFor) return;
    const ch = supabase.channel(`challenge-chat-${chatOpenFor}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenge_messages", filter: `challenge_id=eq.${chatOpenFor}` },
        () => loadChat(chatOpenFor))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [chatOpenFor]);

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadChat(challengeId) {
    setChatLoading(true);
    try {
      const { data } = await supabase.from("challenge_messages").select("*").eq("challenge_id", challengeId).order("created_at", { ascending: true });
      if (aliveRef.current) setChatMessages(data || []);
    } catch {} finally { if (aliveRef.current) setChatLoading(false); }
  }

  async function sendChat() {
    if (!chatText.trim() || !chatOpenFor || !uid) return;
    const msg = chatText.trim();
    setChatText("");
    try {
      await supabase.from("challenge_messages").insert({ challenge_id: chatOpenFor, user_id: uid, message: msg });
      await loadChat(chatOpenFor);
    } catch { toast.error("Error al enviar"); }
  }

  // Búsquedas
  function usePlayerSearch(query, excludeIds = []) {
    const [results, setResults] = useState([]);
    useEffect(() => {
      if (query.trim().length < 3) { setResults([]); return; }
      const t = setTimeout(async () => {
        const { data } = await supabase.from("profiles_public").select("id, name, handle, avatar_url")
          .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
          .not("id", "in", `(${[uid, ...excludeIds].filter(Boolean).join(",")})`)
          .limit(5);
        setResults(data || []);
      }, 220);
      return () => clearTimeout(t);
    }, [query]);
    return results;
  }

  const partnerResultsLive = usePlayerSearch(partnerQuery, [selectedOpp1?.id, selectedOpp2?.id]);
  const opp1ResultsLive = usePlayerSearch(opp1Query, [selectedPartner?.id, selectedOpp2?.id]);
  const opp2ResultsLive = usePlayerSearch(opp2Query, [selectedPartner?.id, selectedOpp1?.id]);

  async function handleCreate() {
    if (!uid) return navigate("/login");
    if (!selectedPartner) return toast.error("Selecciona tu compañero");
    if (!selectedOpp1 || !selectedOpp2) return toast.error("Selecciona los dos rivales");
    setSaving(true);
    try {
      const { data: challenge, error } = await supabase.from("challenges").insert({
        challenger_1: uid,
        challenger_2: selectedPartner.id,
        challenged_1: selectedOpp1.id,
        challenged_2: selectedOpp2.id,
        message: message.trim() || null,
        status: "pending",
        challenger_2_accepted: false,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      }).select().single();
      if (error) throw error;

      // Notificar al compañero
      await supabase.from("notifications").insert({
        user_id: selectedPartner.id, type: "challenge_partner",
        title: "⚔️ Te necesitan en un reto",
        body: `${profiles[uid]?.name || "Alguien"} quiere retarte junto a ${selectedOpp1.name || selectedOpp1.handle} y ${selectedOpp2.name || selectedOpp2.handle}. ¡Acepta el reto!`,
        data: { challengeId: challenge.id },
      });

      toast.success("¡Reto enviado! Tu compañero debe aceptar primero.");
      setOpenCreate(false);
      setSelectedPartner(null); setSelectedOpp1(null); setSelectedOpp2(null); setMessage("");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  async function handlePartnerAccept(challenge) {
    try {
      await supabase.from("challenges").update({ challenger_2_accepted: true }).eq("id", challenge.id);

      // Notificar a los rivales
      for (const rivalId of [challenge.challenged_1, challenge.challenged_2]) {
        await supabase.from("notifications").insert({
          user_id: rivalId, type: "challenge_received",
          title: "⚔️ ¡Te han retado!",
          body: `${profiles[challenge.challenger_1]?.name || "Alguien"} y su compañero os retan. ¿Aceptáis?`,
          data: { challengeId: challenge.id },
        });
      }

      toast.success("¡Reto confirmado! Los rivales han sido notificados.");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  async function handleChallengedAccept(challenge) {
    try {
      // Verificar si el otro rival ya aceptó
      const { data: currentChallenge } = await supabase.from("challenges").select("*").eq("id", challenge.id).single();
      const otherRivalId = currentChallenge.challenged_1 === uid ? currentChallenge.challenged_2 : currentChallenge.challenged_1;
      const otherAccepted = currentChallenge[`challenged_${currentChallenge.challenged_1 === uid ? "2" : "1"}_accepted`];

      if (otherAccepted) {
        // Ambos aceptaron — crear partido
        await supabase.from("challenges").update({ status: "accepted" }).eq("id", challenge.id);
        await supabase.from("notifications").insert([
          { user_id: challenge.challenger_1, type: "challenge_accepted", title: "⚔️ ¡Reto aceptado!", body: "Ambos rivales aceptaron el reto. Acordad fecha en el chat.", data: { challengeId: challenge.id } },
          { user_id: challenge.challenger_2, type: "challenge_accepted", title: "⚔️ ¡Reto aceptado!", body: "Ambos rivales aceptaron el reto. Acordad fecha en el chat.", data: { challengeId: challenge.id } },
        ]);
        toast.success("¡Reto aceptado! Usad el chat para acordar la fecha.");
      } else {
        // Marcar tu aceptación
        const field = challenge.challenged_1 === uid ? "challenged_1_accepted" : "challenged_2_accepted";
        await supabase.from("challenges").update({ [field]: true }).eq("id", challenge.id);
        await supabase.from("notifications").insert({
          user_id: otherRivalId, type: "challenge_partner_accepted",
          title: "⚔️ Tu compañero aceptó el reto",
          body: `${profiles[uid]?.name || "Alguien"} aceptó. ¡Falta tu confirmación!`,
          data: { challengeId: challenge.id },
        });
        toast.success("¡Aceptado! Esperando a tu compañero de equipo.");
      }
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  async function handleReject(challenge) {
    if (!confirm("¿Rechazar este reto?")) return;
    try {
      await supabase.from("challenges").update({ status: "rejected" }).eq("id", challenge.id);
      // Notificar al retador
      await supabase.from("notifications").insert({
        user_id: challenge.challenger_1, type: "challenge_rejected",
        title: "❌ Reto rechazado",
        body: `${profiles[uid]?.name || "Alguien"} ha rechazado vuestro reto.`,
        data: { challengeId: challenge.id },
      });
      toast.success("Reto rechazado");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  async function handleDelete(challenge) {
    if (!confirm("¿Cancelar este reto?")) return;
    try {
      await supabase.from("challenges").delete().eq("id", challenge.id);
      toast.success("Reto cancelado");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  const visibleChallenges = challenges.filter(c => {
    if (tab === "mine") return c.challenger_1 === uid || c.challenger_2 === uid;
    if (tab === "incoming") return c.challenged_1 === uid || c.challenged_2 === uid;
    return true;
  });

  const chatChallenge = challenges.find(c => c.id === chatOpenFor);
  const incomingCount = challenges.filter(c => (c.challenged_1 === uid || c.challenged_2 === uid) && c.status === "pending").length;

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">

          {/* HEADER */}
          <div style={{ padding: "10px 0 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                <span style={{ color: "var(--sport-color)" }}>⚔️ Retos</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Pareja vs pareja</div>
            </div>
            <button onClick={() => setOpenCreate(true)}
              style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer" }}>
              ⚔️ Retar
            </button>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            {[
              { key: "all", label: "Todos" },
              { key: "mine", label: "Mis retos" },
              { key: "incoming", label: `Recibidos${incomingCount > 0 ? ` (${incomingCount})` : ""}` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "8px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 900, background: tab === t.key ? "var(--sport-color)" : "transparent", color: tab === t.key ? "#000" : "rgba(255,255,255,0.7)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚔️</div>Cargando…
            </div>
          ) : visibleChallenges.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>No hay retos</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, marginBottom: 16 }}>¿Te atreves a retar a otra pareja?</div>
              <button onClick={() => setOpenCreate(true)}
                style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                ⚔️ Crear reto
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleChallenges.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.pending;
                const isChallenger = c.challenger_1 === uid || c.challenger_2 === uid;
                const isChallenged = c.challenged_1 === uid || c.challenged_2 === uid;
                const isCreator = c.challenger_1 === uid;
                const isPartner = c.challenger_2 === uid;
                const needsPartnerAccept = isPartner && !c.challenger_2_accepted && c.status === "pending";
                const needsChallengedAccept = isChallenged && c.status === "pending" && c.challenger_2_accepted;
                const canChat = c.status === "accepted" || c.status === "completed";
                const canDelete = isCreator && c.status === "pending";

                return (
                  <div key={c.id} style={{ background: "#111", borderRadius: 14, border: `1px solid ${st.color}30`, overflow: "hidden" }}>
                    {/* HEAD */}
                    <div style={{ padding: "10px 14px", background: "#000", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{timeAgo(c.created_at)}</span>
                    </div>

                    <div style={{ padding: "12px 14px" }}>
                      {/* Equipos */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 10, color: "var(--sport-color)", fontWeight: 900, marginBottom: 2 }}>RETADORES</div>
                          <PlayerChip userId={c.challenger_1} profiles={profiles} navigate={navigate} label="Creador" />
                          {c.challenger_2 && <PlayerChip userId={c.challenger_2} profiles={profiles} navigate={navigate} label={c.challenger_2_accepted ? "✅ Aceptó" : "⏳ Pendiente"} />}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>VS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 900, marginBottom: 2 }}>RIVALES</div>
                          {c.challenged_1 && <PlayerChip userId={c.challenged_1} profiles={profiles} navigate={navigate} />}
                          {c.challenged_2 && <PlayerChip userId={c.challenged_2} profiles={profiles} navigate={navigate} />}
                        </div>
                      </div>

                      {c.message && (
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 12, fontStyle: "italic" }}>
                          💬 "{c.message}"
                        </div>
                      )}

                      {/* ACCIONES */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {needsPartnerAccept && (
                          <>
                            <button onClick={() => handlePartnerAccept(c)}
                              style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                              ✅ Confirmar compañero
                            </button>
                            <button onClick={() => handleReject(c)}
                              style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                              ❌
                            </button>
                          </>
                        )}
                        {needsChallengedAccept && (
                          <>
                            <button onClick={() => handleChallengedAccept(c)}
                              style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                              ⚔️ Aceptar reto
                            </button>
                            <button onClick={() => handleReject(c)}
                              style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                              ❌ Rechazar
                            </button>
                          </>
                        )}
                        {canChat && (
                          <button onClick={() => { setChatOpenFor(c.id); loadChat(c.id); }}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(var(--sport-color-rgb, 46,204,113),0.12)", color: "var(--sport-color)", fontWeight: 900, border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.3)", cursor: "pointer", fontSize: 13 }}>
                            💬 Chat del reto
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(c)}
                            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center", color: "#ff6b6b" }}>
                            🗑️
                          </button>
                        )}
                        {c.status === "pending" && isChallenger && !needsPartnerAccept && (
                          <div style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 700, fontSize: 12, textAlign: "center", border: "1px solid rgba(245,158,11,0.2)" }}>
                            ⏳ Esperando respuesta de rivales
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHAT */}
      {chatOpenFor && chatChallenge && (
        <div onClick={() => setChatOpenFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 30000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f0f0f", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 900, color: "#fff", fontSize: 15 }}>⚔️ Chat del reto</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {profiles[chatChallenge.challenger_1]?.name || "?"} & {profiles[chatChallenge.challenger_2]?.name || "?"} vs {profiles[chatChallenge.challenged_1]?.name || "?"} & {profiles[chatChallenge.challenged_2]?.name || "?"}
                </div>
              </div>
              <button onClick={() => setChatOpenFor(null)} style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>✕</button>
            </div>
            <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {chatLoading
                ? <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 20 }}>Cargando…</div>
                : chatMessages.length === 0
                  ? <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.4)" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                      <div style={{ fontSize: 13 }}>Acordad aquí la fecha y el club</div>
                    </div>
                  : chatMessages.map((msg, idx) => {
                      const isMe = msg.user_id === uid;
                      const prof = profiles[msg.user_id];
                      const pname = prof?.name || prof?.handle || "Gorila";
                      const showName = !isMe && (idx === 0 || chatMessages[idx-1]?.user_id !== msg.user_id);
                      return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6 }}>
                          {!isMe && (
                            <div style={{ width: 26, height: 26, borderRadius: 999, overflow: "hidden", background: "rgba(var(--sport-color-rgb, 46,204,113),0.2)", flexShrink: 0, display: "grid", placeItems: "center", visibility: showName ? "visible" : "hidden" }}>
                              {prof?.avatar_url ? <img src={prof.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 12, fontWeight: 900, color: "var(--sport-color)" }}>{pname[0]?.toUpperCase()}</span>}
                            </div>
                          )}
                          <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 2 }}>
                            {showName && <div style={{ fontSize: 10, color: "var(--sport-color)", fontWeight: 800, paddingLeft: 4 }}>{pname}</div>}
                            <div style={{ padding: "8px 12px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMe ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))" : "rgba(255,255,255,0.09)", color: isMe ? "#000" : "#fff", fontSize: 13, lineHeight: 1.4, overflowWrap: "anywhere", fontWeight: isMe ? 700 : 400 }}>
                              {msg.message}
                            </div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{timeAgo(msg.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
              }
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: "10px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <input value={chatText} onChange={e => setChatText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Acordad fecha, club, hora…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none" }} />
              <button onClick={sendChat} disabled={!chatText.trim()}
                style={{ width: 38, height: 38, borderRadius: 999, background: chatText.trim() ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))" : "rgba(255,255,255,0.08)", border: "none", color: chatText.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: chatText.trim() ? "pointer" : "default", fontSize: 18, display: "grid", placeItems: "center", fontWeight: 900 }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR RETO */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)" }}>
            <h2 style={{ color: "var(--sport-color)", marginBottom: 6, fontSize: 18, fontWeight: 900 }}>⚔️ Nuevo Reto</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Tu pareja vs otra pareja</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "12px", borderRadius: 12, background: "rgba(var(--sport-color-rgb, 46,204,113),0.06)", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.15)" }}>
                <div style={{ fontSize: 11, color: "var(--sport-color)", fontWeight: 900, marginBottom: 10 }}>TU EQUIPO</div>
                <SearchInput
                  label="Tu compañero *"
                  query={partnerQuery} setQuery={setPartnerQuery}
                  results={partnerResultsLive} onSelect={setSelectedPartner} selected={selectedPartner}
                  placeholder="Busca tu compañero…"
                />
              </div>

              <div style={{ padding: "12px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 900, marginBottom: 10 }}>EQUIPO RIVAL</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <SearchInput
                    label="Rival 1 *"
                    query={opp1Query} setQuery={setOpp1Query}
                    results={opp1ResultsLive} onSelect={setSelectedOpp1} selected={selectedOpp1}
                    placeholder="Busca al primer rival…"
                  />
                  <SearchInput
                    label="Rival 2 *"
                    query={opp2Query} setQuery={setOpp2Query}
                    results={opp2ResultsLive} onSelect={setSelectedOpp2} selected={selectedOpp2}
                    placeholder="Busca al segundo rival…"
                  />
                </div>
              </div>

              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Mensaje (opcional)</label>
                <input value={message} onChange={e => setMessage(e.target.value)} placeholder="¿Os atrevéis? 😏" style={IS} />
              </div>

              <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                ℹ️ Tu compañero debe aceptar primero, luego se notifica a los rivales. El reto expira en 48h si no se acepta.
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleCreate} disabled={saving || !selectedPartner || !selectedOpp1 || !selectedOpp2}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: saving || !selectedPartner || !selectedOpp1 || !selectedOpp2 ? "rgba(var(--sport-color-rgb, 46,204,113),0.3)" : "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {saving ? "⏳ Enviando…" : "⚔️ Enviar reto"}
                </button>
                <button onClick={() => setOpenCreate(false)}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14 }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}