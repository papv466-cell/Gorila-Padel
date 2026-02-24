// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import "./InclusiveMatchesPage.css";
import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
} from "../services/inclusiveMatches";
import { fetchClubsFromGoogleSheet } from "../services/sheets";

/* ─── Constantes ─── */
const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas",       emoji: "♿", color: "#3B82F6" },
  { key: "blind",      label: "Ceguera / baja visión", emoji: "🦯", color: "#8B5CF6" },
  { key: "down",       label: "Síndrome de Down",      emoji: "💙", color: "#EC4899" },
  { key: "other",      label: "Otra diversidad",       emoji: "🌟", color: "#F59E0B" },
  { key: "none",       label: "Sin diversidad",        emoji: "🤝", color: "#74B800" },
];

const EXPERIENCES = [
  { key: "exp_blind",  label: "Partido Ciego",  emoji: "👁️", desc: "Vendados con un invidente" },
  { key: "exp_wheels", label: "Sobre Ruedas",   emoji: "🦽", desc: "4 sillas, vívelo tú" },
  { key: "exp_weight", label: "Partido Pesado", emoji: "🏋️", desc: "Chalecos de peso" },
  { key: "exp_slow",   label: "Partido Lento",  emoji: "👴", desc: "Movilidad reducida" },
];
const EXP_KEYS = new Set(EXPERIENCES.map(e => e.key));

function getNeedInfo(key) {
  return NEEDS.find(n => n.key === key) || EXPERIENCES.find(e => e.key === key) || { key, label: key, emoji: "🎾", color: "#74B800" };
}

/* ─── Utils ─── */
function fmtDate(iso) {
  try {
    const s = String(iso || "");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}`;
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch { return String(iso || ""); }
}

const IS = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", fontSize: 13, boxSizing: "border-box",
};

export default function InclusiveMatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  /* ─── Auth ─── */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  function goLogin() { navigate("/login", { replace: true, state: { from: location.pathname + location.search } }); }

  /* ─── Data ─── */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState([]);
  const [clubsSheet, setClubsSheet] = useState([]);

  /* ─── Filtros ─── */
  const [tab, setTab] = useState("all"); // "all" | "exp"
  const [selectedNeeds, setSelectedNeeds] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ─── Crear ─── */
  const [openCreate, setOpenCreate] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubId, setClubId] = useState("");
  const [city, setCity] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationMin, setDurationMin] = useState(90);
  const [level, setLevel] = useState("intermedio");
  const [notes, setNotes] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [pricePerPlayer, setPricePerPlayer] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [createNeeds, setCreateNeeds] = useState(() => new Set(["wheelchair"]));
  const [mixAllowed, setMixAllowed] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);
  const [showClubSuggest, setShowClubSuggest] = useState(false);

  const clubSuggestions = useMemo(() => {
    const q = clubName.trim().toLowerCase();
    if (q.length < 2) return [];
    return clubsSheet.filter(c => String(c.name || "").toLowerCase().includes(q)).slice(0, 10);
  }, [clubName, clubsSheet]);

  async function load() {
    try {
      setLoading(true); setErr(null);
      const list = await fetchInclusiveMatches({ limit: 300 });
      if (aliveRef.current) setMatches(Array.isArray(list) ? list : []);
    } catch (e) {
      if (aliveRef.current) { setErr(e?.message || "Error cargando partidos"); setMatches([]); }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("create") === "1") setOpenCreate(true);
  }, [searchParams]);

  useEffect(() => {
    fetchClubsFromGoogleSheet().then(r => setClubsSheet(Array.isArray(r) ? r : [])).catch(() => setClubsSheet([]));
    load();
    const unsub = subscribeInclusiveRealtime(() => load());
    return () => unsub?.();
  }, []);

  /* ─── Filtrado ─── */
  const filtered = useMemo(() => {
    const now = Date.now();
    let list = (matches || []).filter(m => {
      const t = new Date(m.start_at).getTime();
      return Number.isFinite(t) ? t >= now - 5 * 60 * 1000 : true;
    });
    if (tab === "exp") list = list.filter(m => (m.needs || []).some(n => EXP_KEYS.has(n)));
    if (tab === "all") list = list.filter(m => !(m.needs || []).every(n => EXP_KEYS.has(n)));
    if (selectedNeeds.size) {
      list = list.filter(m => {
        const needs = new Set((m.needs || []).map(String));
        for (const k of selectedNeeds) if (needs.has(k)) return true;
        return false;
      });
    }
    return list.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  }, [matches, selectedNeeds, tab]);

  function toggleNeed(setter, currentSet, key) {
    const next = new Set(Array.from(currentSet));
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  async function onCreate() {
    try {
      setCreating(true); setCreateErr(null);
      if (!clubName.trim()) throw new Error("Elige un club.");
      if (!startAt) throw new Error("Selecciona fecha y hora.");
      if (!createNeeds.size) throw new Error("Elige al menos un tipo.");
      await createInclusiveMatch({
        club_id: clubId || null,
        club_name: clubName.trim(),
        city: city.trim(),
        start_at: new Date(startAt).toISOString(),
        duration_min: Number(durationMin) || 90,
        level: level.trim() || "intermedio",
        max_players: Number(maxPlayers) || 4,
        price_per_player: pricePerPlayer ? Number(pricePerPlayer) : null,
        needs: Array.from(createNeeds),
        mix_allowed: !!mixAllowed,
        notes: notes.trim(),
        accessibility_notes: accessibilityNotes.trim(),
        user_id: session?.user?.id,
      });
      setOpenCreate(false);
      setClubName(""); setClubId(""); setCity(""); setStartAt("");
      setDurationMin(90); setLevel("intermedio"); setNotes(""); setAccessibilityNotes("");
      setPricePerPlayer(""); setMaxPlayers(4);
      setCreateNeeds(new Set(["wheelchair"])); setMixAllowed(true);
      toast.success("Partido creado ✅");
      await load();
    } catch (e) {
      setCreateErr(e?.message || "No pude crear el partido");
    } finally {
      setCreating(false);
    }
  }

  /* ─── RENDER ─── */
  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        .gslChip { font-size: 9px !important; padding: 1px 6px !important; line-height: 1.4 !important; display:inline-flex; align-items:center; background:rgba(255,255,255,0.07); border-radius:999px; color:rgba(255,255,255,0.7); }
        .gslCard { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; transition: border-color .2s; }
        .gslCard:hover { border-color: rgba(116,184,0,0.35); }
        .gslNeedBadge { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:800; padding:2px 7px; border-radius:999px; }
      `}</style>

      <div className="pageWrap">
        <div className="container">

          {/* ── HEADER ── */}
          <div style={{ padding: "10px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                🦍 Gorila <span style={{ color: "#74B800" }}>Sin Límites</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                {loading ? "Cargando…" : `${filtered.length} partido(s) disponibles`}
              </div>
            </div>
            <button
              onClick={() => { if (!session) { goLogin(); return; } setOpenCreate(true); }}
              style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
            >➕ Crear</button>
          </div>

          {/* ── TABS ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[
              { key: "all", label: "♿ Diversidad funcional" },
              { key: "exp", label: "⚡ Experiencias" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 11,
                  background: tab === t.key ? "#74B800" : "rgba(255,255,255,0.08)",
                  color: tab === t.key ? "#000" : "rgba(255,255,255,0.7)" }}>
                {t.label}
              </button>
            ))}
            <button onClick={() => setFiltersOpen(f => !f)}
              style={{ padding: "8px 12px", borderRadius: 10, border: selectedNeeds.size > 0 ? "1px solid #74B800" : "1px solid transparent", cursor: "pointer", fontWeight: 900, fontSize: 11,
                background: selectedNeeds.size > 0 ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.08)",
                color: selectedNeeds.size > 0 ? "#74B800" : "rgba(255,255,255,0.7)" }}>
              🔍{selectedNeeds.size > 0 ? ` (${selectedNeeds.size})` : ""}
            </button>
          </div>

          {/* ── DESCRIPCIÓN DE PESTAÑA ── */}
          {tab === "all" && (
            <div style={{ background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
              Partidos semanales para personas con diversidad funcional. Encuentra compañeros de tu nivel y juega con las adaptaciones que necesitas.
            </div>
          )}
          {tab === "exp" && (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>EXPERIENCIAS GORILA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {EXPERIENCES.map(e => (
                  <div key={e.key} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontSize: 18 }}>{e.emoji}</span>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#fff", marginTop: 3 }}>{e.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FILTROS ── */}
          {filtersOpen && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.5)" }}>FILTRAR POR DIVERSIDAD</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {NEEDS.map(n => (
                  <button key={n.key} onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                    style={{ padding: "4px 10px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 800,
                      background: selectedNeeds.has(n.key) ? `${n.color}30` : "rgba(255,255,255,0.08)",
                      border: selectedNeeds.has(n.key) ? `1px solid ${n.color}` : "1px solid rgba(255,255,255,0.12)",
                      color: "#fff" }}>
                    {n.emoji} {n.label}
                  </button>
                ))}
              </div>
              {selectedNeeds.size > 0 && (
                <button onClick={() => setSelectedNeeds(new Set())}
                  style={{ padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, background: "rgba(220,38,38,0.2)", color: "#ff6b6b", alignSelf: "flex-start" }}>
                  ✕ Limpiar
                </button>
              )}
            </div>
          )}

          {err && <div style={{ background: "rgba(220,38,38,0.2)", padding: 10, borderRadius: 8, color: "#ff6b6b", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{err}</div>}

          {/* ── LISTA ── */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.5)" }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 12, padding: 28, textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 40 }}>🦍</div>
                <div style={{ fontWeight: 900, color: "#fff", marginTop: 8 }}>No hay partidos ahora mismo</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
                  {tab === "all" ? "Sé el primero en organizar un partido inclusivo" : "No hay experiencias programadas"}
                </div>
                <button onClick={() => { if (!session) { goLogin(); return; } setOpenCreate(true); }}
                  style={{ marginTop: 14, padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 12 }}>
                  ➕ Crear partido
                </button>
              </div>
            ) : filtered.map(m => {
              const isExp = (m.needs || []).some(n => EXP_KEYS.has(n));
              const realNeeds = (m.needs || []).filter(n => !EXP_KEYS.has(n));
              const expNeeds = (m.needs || []).filter(n => EXP_KEYS.has(n));
              const isCreator = !!(session?.user?.id && String(m.created_by_user || m.user_id) === String(session.user.id));

              return (
                <li key={m.id} className="gslCard">
                  {/* HEADER */}
                  <div style={{ padding: "7px 10px", background: "#000", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {m.club_name || "Club"}{m.city ? ` · ${m.city}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 6 }}>
                      {isExp && <span style={{ fontSize: 10, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "1px 6px", borderRadius: 999 }}>⚡ EXP</span>}
                      {isCreator && <span style={{ fontSize: 10, fontWeight: 900, color: "#FFD700" }}>👑</span>}
                    </div>
                  </div>

                  {/* ROSTER */}
                  <div className="gpMatchRoster">
                    <div className="gpTeamSide left">
                      {[0, 1].map(i => (
                        <div key={i} style={{ width: 36, height: 52, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 28 }}>🦍</span>
                        </div>
                      ))}
                    </div>
                    <img src="/images/vs-icon.png" alt="VS" className="gpVsIcon" />
                    <div className="gpTeamSide right">
                      {[0, 1].map(i => (
                        <div key={i} style={{ width: 36, height: 52, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 28 }}>🦍</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* NEEDS BADGES */}
                  <div style={{ padding: "5px 8px", background: "rgba(0,0,0,0.3)", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    {realNeeds.map(k => {
                      const n = getNeedInfo(k);
                      return (
                        <span key={k} className="gslNeedBadge" style={{ background: `${n.color}20`, border: `1px solid ${n.color}60`, color: "#fff" }}>
                          {n.emoji} {n.label}
                        </span>
                      );
                    })}
                    {expNeeds.map(k => {
                      const n = getNeedInfo(k);
                      return (
                        <span key={k} className="gslNeedBadge" style={{ background: "rgba(255,165,0,0.15)", border: "1px solid rgba(255,165,0,0.4)", color: "#fff" }}>
                          {n.emoji} {n.label}
                        </span>
                      );
                    })}
                    {m.mix_allowed && (
                      <span className="gslNeedBadge" style={{ background: "rgba(116,184,0,0.15)", border: "1px solid rgba(116,184,0,0.35)", color: "#fff" }}>
                        🤝 Mixto
                      </span>
                    )}
                  </div>

                  {/* INFO CHIPS */}
                  <div style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="gslChip">🗓️ {fmtDate(m.start_at)}</span>
                    <span className="gslChip">⏱️ {m.duration_min}min</span>
                    <span className="gslChip">🎚️ {String(m.level || "").toUpperCase()}</span>
                    {m.price_per_player ? <span className="gslChip">💶 {m.price_per_player}€</span> : null}
                    {m.max_players ? <span className="gslChip">👥 máx {m.max_players}</span> : null}
                  </div>

                  {/* NOTAS ACCESIBILIDAD */}
                  {m.accessibility_notes ? (
                    <div style={{ padding: "4px 10px", background: "rgba(59,130,246,0.08)", borderTop: "1px solid rgba(59,130,246,0.15)", fontSize: 10, color: "rgba(147,197,253,0.9)", display: "flex", gap: 4, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>♿</span>
                      <span>{m.accessibility_notes}</span>
                    </div>
                  ) : null}

                  {/* NOTAS */}
                  {m.notes ? (
                    <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>
                      {m.notes}
                    </div>
                  ) : null}

                  {/* BOTÓN */}
                  <div style={{ padding: "6px 8px", background: "#111", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {!session ? (
                      <button onClick={goLogin}
                        style={{ width: "100%", padding: "8px", borderRadius: 8, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 12 }}>
                        PARTICIPAR
                      </button>
                    ) : isCreator ? (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "4px 0" }}>Tu partido</div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase.from("inclusive_match_requests").insert({
                              match_id: m.id,
                              user_id: session.user.id,
                              status: "pending",
                            });
                            if (error) throw error;
                            toast.success("Solicitud enviada 🦍");
                          } catch (e) {
                            toast.error(e?.message || "Error al solicitar");
                          }
                        }}
                        style={{ width: "100%", padding: "8px", borderRadius: 8, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 12 }}>
                        PARTICIPAR
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ══════════════════════════════
          MODAL: CREAR PARTIDO
      ══════════════════════════════ */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color: "#74B800", marginBottom: 20, fontSize: 20, fontWeight: 900 }}>🦍 Crear partido Sin Límites</h2>

            {createErr && <div style={{ background: "rgba(220,38,38,0.2)", padding: 10, borderRadius: 8, color: "#ff6b6b", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{createErr}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* CLUB */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Club *</label>
                <input value={clubName} onChange={e => { setClubName(e.target.value); setShowClubSuggest(true); }} placeholder="Buscar club..." style={IS} />
                {showClubSuggest && clubSuggestions.length > 0 && (
                  <div style={{ background: "#2a2a2a", borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {clubSuggestions.map((c, idx) => (
                      <div key={c.id || idx} onClick={() => { setClubName(c.name); setClubId(String(c.id || "")); setShowClubSuggest(false); }}
                        style={{ padding: 10, cursor: "pointer", color: "#fff", fontSize: 13, borderBottom: idx < clubSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CIUDAD + NIVEL */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Ciudad</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Málaga..." style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Nivel</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={IS}>
                    <option value="iniciacion" style={{ background: "#1a1a1a" }}>Iniciación</option>
                    <option value="intermedio" style={{ background: "#1a1a1a" }}>Intermedio</option>
                    <option value="alto" style={{ background: "#1a1a1a" }}>Alto</option>
                  </select>
                </div>
              </div>

              {/* FECHA + DURACIÓN */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Fecha y hora *</label>
                  <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Duración (min)</label>
                  <input type="number" min="30" step="15" value={durationMin} onChange={e => setDurationMin(e.target.value)} style={IS} />
                </div>
              </div>

              {/* JUGADORES + PRECIO */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Máx jugadores</label>
                  <input type="number" min="2" max="8" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Precio/jugador €</label>
                  <input type="number" min="0" step="0.5" value={pricePerPlayer} onChange={e => setPricePerPlayer(e.target.value)} placeholder="0" style={IS} />
                </div>
              </div>

              {/* TIPO DE DIVERSIDAD */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700 }}>Tipo de partido *</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {NEEDS.map(n => (
                    <button key={n.key} type="button" onClick={() => toggleNeed(setCreateNeeds, createNeeds, n.key)}
                      style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 800,
                        background: createNeeds.has(n.key) ? `${n.color}25` : "rgba(255,255,255,0.08)",
                        border: createNeeds.has(n.key) ? `1px solid ${n.color}` : "1px solid rgba(255,255,255,0.15)",
                        color: "#fff" }}>
                      {n.emoji} {n.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>O añade una experiencia Gorila:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {EXPERIENCES.map(e => (
                    <button key={e.key} type="button" onClick={() => toggleNeed(setCreateNeeds, createNeeds, e.key)}
                      style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 800,
                        background: createNeeds.has(e.key) ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.08)",
                        border: createNeeds.has(e.key) ? "1px solid #FFA500" : "1px solid rgba(255,255,255,0.15)",
                        color: "#fff" }}>
                      {e.emoji} {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* MIXTO */}
              <button type="button" onClick={() => setMixAllowed(v => !v)}
                style={{ padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 800, textAlign: "left",
                  background: mixAllowed ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.08)",
                  border: mixAllowed ? "1px solid #74B800" : "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
                {mixAllowed ? "✅ Abierto a todos — con o sin diversidad funcional" : "Solo personas con diversidad funcional"}
              </button>

              {/* ACCESIBILIDAD */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Accesibilidad de la pista ♿</label>
                <input value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)}
                  placeholder="Ej: Rampa de acceso, vestuario adaptado, marcadores en braille…" style={IS} />
              </div>

              {/* NOTAS */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Notas adicionales</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Info extra para los participantes…"
                  style={{ ...IS, minHeight: 65, resize: "vertical" }} />
              </div>

              {/* BOTONES */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={onCreate} disabled={creating}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: creating ? "rgba(116,184,0,0.4)" : "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: creating ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {creating ? "⏳ Creando..." : "🦍 Crear partido"}
                </button>
                <button onClick={() => setOpenCreate(false)} disabled={creating}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14 }}>
                  ❌
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}