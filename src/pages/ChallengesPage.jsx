// src/pages/ChallengesPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

export default function ChallengesPage({ session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [profiles, setProfiles] = useState({});

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

      // Cargar perfiles
      const ids = new Set();
      for (const c of data || []) {
        [c.challenger_1, c.challenger_2, c.challenged_1, c.challenged_2].forEach(id => id && ids.add(id));
      }
      if (ids.size) {
        const { data: profs } = await supabase
          .from("profiles_public")
          .select("id, name, handle, avatar_url")
          .in("id", Array.from(ids));
        const map = {};
        for (const p of profs || []) map[p.id] = p;
        if (aliveRef.current) setProfiles(map);
      }
    } catch (e) {
      toast.error("Error cargando retos");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  async function searchPlayers(q, exclude = []) {
    if (q.trim().length < 3) return [];
    const { data } = await supabase
      .from("profiles_public")
      .select("id, name, handle, avatar_url")
      .or(`name.ilike.%${q}%,handle.ilike.%${q}%`)
      .limit(8);
    return (data || []).filter(p => p.id !== uid && !exclude.includes(p.id));
  }

  useEffect(() => {
    let t;
    if (partnerQuery.trim().length >= 3) {
      t = setTimeout(async () => {
        const r = await searchPlayers(partnerQuery, [selectedOpp1?.id, selectedOpp2?.id].filter(Boolean));
        if (aliveRef.current) setPartnerResults(r);
      }, 220);
    } else setPartnerResults([]);
    return () => clearTimeout(t);
  }, [partnerQuery]);

  useEffect(() => {
    let t;
    if (opp1Query.trim().length >= 3) {
      t = setTimeout(async () => {
        const r = await searchPlayers(opp1Query, [selectedPartner?.id, selectedOpp2?.id].filter(Boolean));
        if (aliveRef.current) setOpp1Results(r);
      }, 220);
    } else setOpp1Results([]);
    return () => clearTimeout(t);
  }, [opp1Query]);

  useEffect(() => {
    let t;
    if (opp2Query.trim().length >= 3) {
      t = setTimeout(async () => {
        const r = await searchPlayers(opp2Query, [selectedPartner?.id, selectedOpp1?.id].filter(Boolean));
        if (aliveRef.current) setOpp2Results(r);
      }, 220);
    } else setOpp2Results([]);
    return () => clearTimeout(t);
  }, [opp2Query]);

  async function handleCreate() {
    if (!selectedPartner) return toast.error("Elige a tu compañero");
    if (!selectedOpp1 || !selectedOpp2) return toast.error("Elige a los dos rivales");
    setSaving(true);
    try {
      const { error } = await supabase.from("challenges").insert({
        challenger_1: uid,
        challenger_2: selectedPartner.id,
        challenged_1: selectedOpp1.id,
        challenged_2: selectedOpp2.id,
        message: message.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      // Notificar al compañero
      await supabase.from("notifications").insert({
        user_id: selectedPartner.id,
        type: "challenge_partner",
        title: "⚔️ Te han propuesto un reto",
        body: `${profiles[uid]?.name || "Un jugador"} quiere retarte junto a ti. Acepta para completar el reto.`,
        data: { type: "challenge" },
      });

      toast.success("¡Reto enviado! Tu compañero debe aceptar primero.");
      setOpenCreate(false);
      setSelectedPartner(null); setSelectedOpp1(null); setSelectedOpp2(null);
      setPartnerQuery(""); setOpp1Query(""); setOpp2Query(""); setMessage("");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptPartner(challengeId) {
    try {
      await supabase.from("challenges").update({ challenger_2_accepted: true }).eq("id", challengeId);

      // Notificar a los retados
      const c = challenges.find(x => x.id === challengeId);
      if (c) {
        for (const toUserId of [c.challenged_1, c.challenged_2]) {
          await supabase.from("notifications").insert({
            user_id: toUserId,
            type: "challenge_received",
            title: "⚔️ ¡Os han retado!",
            body: `${profiles[c.challenger_1]?.name || "Una pareja"} y ${profiles[c.challenger_2]?.name || "su compañero"} os retan a un partido.`,
            data: { challengeId },
          });
        }
      }

      toast.success("¡Reto confirmado! Los rivales han sido notificados.");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  async function handleAcceptChallenge(challengeId) {
    try {
      const c = challenges.find(x => x.id === challengeId);
      if (!c) return;

      // Crear partido automáticamente
      const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: match, error: matchError } = await supabase.from("matches").insert({
        club_name: "Por definir",
        start_at: startAt,
        duration_min: 90,
        level: "medio",
        players_needed: 4,
        reserved_spots: 4,
        created_by_user: c.challenger_1,
        price_per_player: 0,
      }).select().single();

      if (matchError) throw matchError;

      // Añadir los 4 jugadores
      const players = [c.challenger_1, c.challenger_2, c.challenged_1, c.challenged_2];
      await supabase.from("match_players").insert(players.map(p => ({ match_id: match.id, player_uuid: p })));

      // Actualizar reto
      await supabase.from("challenges").update({ status: "accepted", match_id: match.id }).eq("id", challengeId);

      // Notificar a todos
      for (const toUserId of players) {
        await supabase.from("notifications").insert({
          user_id: toUserId,
          type: "challenge_accepted",
          title: "🎾 ¡Reto aceptado!",
          body: "El partido ha sido creado. Acordad fecha y club en el chat.",
          data: { matchId: match.id },
        });
      }

      toast.success("¡Reto aceptado! Partido creado.");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  async function handleReject(challengeId) {
    try {
      await supabase.from("challenges").update({ status: "rejected" }).eq("id", challengeId);
      toast.success("Reto rechazado");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  function PlayerChip({ id }) {
    const p = profiles[id];
    if (!p) return <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{String(id || "").slice(0, 8)}</span>;
    return (
      <span
        onClick={() => navigate(`/usuario/${id}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 800, color: "#fff" }}>
        {p.avatar_url ? <img src={p.avatar_url} style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} /> : "🦍"}
        {p.name || p.handle}
      </span>
    );
  }

  function statusBadge(c) {
    if (c.status === "accepted") return <span style={{ fontSize: 10, fontWeight: 900, color: "#74B800", background: "rgba(116,184,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>✅ Aceptado</span>;
    if (c.status === "rejected") return <span style={{ fontSize: 10, fontWeight: 900, color: "#ff6b6b", background: "rgba(220,38,38,0.15)", padding: "2px 8px", borderRadius: 999 }}>❌ Rechazado</span>;
    if (c.status === "expired") return <span style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 999 }}>⏰ Expirado</span>;
    if (c.challenger_2 === uid && !c.challenger_2_accepted) return <span style={{ fontSize: 10, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>⏳ Pendiente tu OK</span>;
    if (!c.challenger_2_accepted) return <span style={{ fontSize: 10, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>⏳ Compañero pendiente</span>;
    if ((c.challenged_1 === uid || c.challenged_2 === uid) && c.status === "pending") return <span style={{ fontSize: 10, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>⚔️ Te retan</span>;
    return <span style={{ fontSize: 10, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>⏳ Pendiente</span>;
  }

  const IS = { width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, boxSizing: "border-box" };

  function PlayerSearch({ query, setQuery, results, setResults, selected, setSelected, label, exclude }) {
    return (
      <div style={{ position: "relative" }}>
        <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>{label}</label>
        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(116,184,0,0.12)", border: "1px solid rgba(116,184,0,0.3)" }}>
            {selected.avatar_url ? <img src={selected.avatar_url} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> : <span>🦍</span>}
            <span style={{ flex: 1, color: "#fff", fontWeight: 800, fontSize: 13 }}>{selected.name || selected.handle}</span>
            <button onClick={() => { setSelected(null); setQuery(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ) : (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o @handle..." style={IS} />
            {results.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 99, background: "#1a1a1a", border: "1px solid rgba(116,184,0,0.25)", borderRadius: 10, overflow: "hidden" }}>
                {results.map(p => (
                  <div key={p.id} onMouseDown={() => { setSelected(p); setQuery(""); setResults([]); }}
                    style={{ padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(116,184,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {p.avatar_url ? <img src={p.avatar_url} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🦍</span>}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{p.name || p.handle}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{p.handle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">
          <div style={{ padding: "10px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                <span style={{ color: "#74B800" }}>⚔️ Retos</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Pareja contra pareja</div>
            </div>
            <button onClick={() => setOpenCreate(true)}
              style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer" }}>
              ⚔️ Nuevo reto
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
          ) : challenges.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>Sin retos todavía</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>Reta a una pareja y demuestra quién es el mejor</div>
              <button onClick={() => setOpenCreate(true)}
                style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                ⚔️ Crear primer reto
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {challenges.map(c => {
                const isChallenger = c.challenger_1 === uid || c.challenger_2 === uid;
                const isChallenged = c.challenged_1 === uid || c.challenged_2 === uid;
                const canAcceptPartner = c.challenger_2 === uid && !c.challenger_2_accepted && c.status === "pending";
                const canAcceptChallenge = isChallenged && c.challenger_2_accepted && c.status === "pending";

                return (
                  <div key={c.id} style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(116,184,0,0.2)", overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#000", borderBottom: "1px solid rgba(116,184,0,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.5)" }}>
                        {new Date(c.created_at).toLocaleDateString("es-ES")}
                      </span>
                      {statusBadge(c)}
                    </div>

                    <div style={{ padding: "12px 14px" }}>
                      {/* VS */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 10, fontWeight: 900, color: "#74B800", textTransform: "uppercase", marginBottom: 4 }}>Retadores</div>
                          <PlayerChip id={c.challenger_1} />
                          <PlayerChip id={c.challenger_2} />
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.3)" }}>VS</div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          <div style={{ fontSize: 10, fontWeight: 900, color: "#ff6b6b", textTransform: "uppercase", marginBottom: 4 }}>Retados</div>
                          <PlayerChip id={c.challenged_1} />
                          <PlayerChip id={c.challenged_2} />
                        </div>
                      </div>

                      {c.message && (
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 10, fontStyle: "italic" }}>
                          "{c.message}"
                        </div>
                      )}

                      {/* Acciones */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {canAcceptPartner && (
                          <button onClick={() => handleAcceptPartner(c.id)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                            ✅ Acepto ser tu compañero
                          </button>
                        )}
                        {canAcceptChallenge && (
                          <>
                            <button onClick={() => handleAcceptChallenge(c.id)}
                              style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                              ⚔️ Aceptar reto
                            </button>
                            <button onClick={() => handleReject(c.id)}
                              style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                              ❌
                            </button>
                          </>
                        )}
                        {c.status === "accepted" && c.match_id && (
                          <button onClick={() => navigate(`/partidos`)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(116,184,0,0.15)", color: "#74B800", fontWeight: 900, border: "1px solid rgba(116,184,0,0.3)", cursor: "pointer", fontSize: 13 }}>
                            🎾 Ver partido
                          </button>
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

      {/* MODAL CREAR RETO */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color: "#74B800", marginBottom: 20, fontSize: 18, fontWeight: 900 }}>⚔️ Nuevo Reto</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.2)", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Tu pareja debe aceptar antes de que el reto llegue a los rivales.
              </div>

              <PlayerSearch
                query={partnerQuery} setQuery={setPartnerQuery}
                results={partnerResults} setResults={setPartnerResults}
                selected={selectedPartner} setSelected={setSelectedPartner}
                label="🤝 Tu compañero"
              />

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

              <PlayerSearch
                query={opp1Query} setQuery={setOpp1Query}
                results={opp1Results} setResults={setOpp1Results}
                selected={selectedOpp1} setSelected={setSelectedOpp1}
                label="⚔️ Rival 1"
              />

              <PlayerSearch
                query={opp2Query} setQuery={setOpp2Query}
                results={opp2Results} setResults={setOpp2Results}
                selected={selectedOpp2} setSelected={setSelectedOpp2}
                label="⚔️ Rival 2"
              />

              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Mensaje (opcional)</label>
                <input value={message} onChange={e => setMessage(e.target.value)} placeholder="¿Os atrevéis? 😏" style={IS} maxLength={120} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleCreate} disabled={saving || !selectedPartner || !selectedOpp1 || !selectedOpp2}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: saving || !selectedPartner || !selectedOpp1 || !selectedOpp2 ? "rgba(116,184,0,0.3)" : "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 14 }}>
                  {saving ? "⏳ Enviando..." : "⚔️ Enviar reto"}
                </button>
                <button onClick={() => setOpenCreate(false)}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}