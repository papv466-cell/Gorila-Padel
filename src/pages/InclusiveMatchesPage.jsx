// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useSport } from "../contexts/SportContext";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
} from "../services/inclusiveMatches";
import { fetchClubsFromSupabase } from "../services/sheets";

/* ─── Tipos de diversidad ─── */
const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas",       emoji: "♿", color: "#3B82F6" },
  { key: "blind",      label: "Ceguera / baja visión", emoji: "🦯", color: "#8B5CF6" },
  { key: "down",       label: "Síndrome de Down",      emoji: "💙", color: "#EC4899" },
  { key: "other",      label: "Otra capacidad especial",emoji: "🌟", color: "#F59E0B" },
  { key: "none",       label: "Sin diversidad",        emoji: "🤝", color: "#2ECC71" },
];

const EXPERIENCES = [
  { key: "exp_blind",  label: "Partido Ciego",  emoji: "👁️", desc: "Juegas vendado junto a una persona invidente" },
  { key: "exp_wheels", label: "Sobre Ruedas",   emoji: "🦽", desc: "Todos en silla de ruedas — vívelo tú" },
  { key: "exp_weight", label: "Partido Pesado", emoji: "🏋️", desc: "Chalecos de peso para igualar" },
  { key: "exp_slow",   label: "Partido Lento",  emoji: "👴", desc: "Ritmo adaptado a movilidad reducida" },
];
const EXP_KEYS = new Set(EXPERIENCES.map(e => e.key));

function getNeedInfo(key) {
  return NEEDS.find(n => n.key === key) || EXPERIENCES.find(e => e.key === key) || { key, label: key, emoji: "🎾", color: "#2ECC71" };
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const timeStr = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return `Hoy a las ${timeStr}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Mañana a las ${timeStr}`;
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) + ` a las ${timeStr}`;
  } catch { return String(iso || ""); }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const IS = {
  width: "100%", padding: "14px 16px", borderRadius: 12,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", fontSize: 16, boxSizing: "border-box", minHeight: 52,
};

export default function InclusiveMatchesPage({ session: sessionProp }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  /* ─── Auth ─── */
  const { session: sessionCtx } = useSession();
  const { sport, sportInfo } = useSport();
  const session = sessionCtx || sessionProp || null;

  function goLogin() { navigate("/login", { replace: true, state: { from: location.pathname + location.search } }); }

  /* ─── Data ─── */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState([]);
  const [clubsSheet, setClubsSheet] = useState([]);
  const [myReqStatus, setMyReqStatus] = useState({});

  const sportColor = sportInfo?.color || "#2ECC71";
  const sportColorBg = sportInfo?.colorBg || "rgba(46,204,113,0.08)";
  const sportColorBorder = sportInfo?.colorBorder || "rgba(46,204,113,0.25)";

  useEffect(() => {
    if (session?.user?.id) loadMyRequests();
  }, [session?.user?.id]);

  async function loadMyRequests() {
    const { data } = await supabase.from("inclusive_match_requests").select("match_id, status").eq("user_id", session.user.id);
    if (data) {
      const map = {};
      data.forEach(r => { map[r.match_id] = r.status; });
      setMyReqStatus(map);
    }
  }

  /* ─── Filtros ─── */
  const [tab, setTab] = useState("all");
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
    return clubsSheet.filter(c => String(c.name || "").toLowerCase().includes(q)).slice(0, 8);
  }, [clubName, clubsSheet]);

  useEffect(() => { load(); }, [sport]);

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
    fetchClubsFromSupabase().then(r => setClubsSheet(Array.isArray(r) ? r : [])).catch(() => setClubsSheet([]));
    load();
    const unsub = subscribeInclusiveRealtime(() => load());
    return () => unsub?.();
  }, []);

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
      if (!createNeeds.size) throw new Error("Elige al menos un tipo de partido.");
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
        created_by_user: session?.user?.id,
      });
      setOpenCreate(false);
      setClubName(""); setClubId(""); setCity(""); setStartAt("");
      setDurationMin(90); setLevel("intermedio"); setNotes(""); setAccessibilityNotes("");
      setPricePerPlayer(""); setMaxPlayers(4);
      setCreateNeeds(new Set(["wheelchair"])); setMixAllowed(true);
      toast.success("¡Partido creado! 🦍");
      await load();
    } catch (e) {
      setCreateErr(e?.message || "No pude crear el partido");
    } finally {
      setCreating(false);
    }
  }

  const uid = session?.user?.id || "";

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <style>{`
        .juntos-card { background: #111827; border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; overflow: hidden; transition: border-color 0.2s, transform 0.15s; }
        .juntos-card:hover { border-color: ${sportColor}55; transform: translateY(-1px); }
        .juntos-need-badge { display:inline-flex; align-items:center; gap:5px; font-size:13px; font-weight:700; padding:6px 12px; border-radius:999px; }
        .juntos-chip { font-size:13px; padding:6px 12px; display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.07); border-radius:999px; color:rgba(255,255,255,0.80); font-weight:600; }
        .juntos-btn-icon { width:52px; height:52px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06); transition:background 0.15s; }
        .juntos-btn-icon:hover { background:rgba(255,255,255,0.12); }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* ── HERO HEADER ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.2 }}>
                {sportInfo?.emoji || "♿"} <span style={{ color: sportColor }}>Juntos</span>
              </h1>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginTop: 6, lineHeight: 1.6 }}>
                Deporte inclusivo en {sportInfo?.label || "pádel"}.<br/>
                Jugamos todos — con y sin capacidades especiales.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
                {loading ? "Cargando…" : `${filtered.length} partido${filtered.length !== 1 ? "s" : ""} disponible${filtered.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            <button
              onClick={() => { if (!session) { goLogin(); return; } setOpenCreate(true); }}
              style={{ minHeight: 52, padding: "14px 20px", borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", fontSize: 15, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              + Crear
            </button>
          </div>
        </div>

        {/* ── BANNER INCLUSIVO ── */}
        <div style={{ padding: "14px 18px", borderRadius: 16, background: sportColorBg, border: `1px solid ${sportColorBorder}`, marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 32, flexShrink: 0 }}>🤝</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: sportColor, marginBottom: 3 }}>Espacio seguro e inclusivo</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.60)", lineHeight: 1.6 }}>
              Aquí todos somos iguales. Adaptamos el juego a cada persona. Respeto y apoyo ante todo.
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "all", label: "♿ Con capacidades especiales" },
            { key: "exp", label: "⚡ Experiencias" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, minHeight: 48, padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
                background: tab === t.key ? sportColor : "rgba(255,255,255,0.07)",
                color: tab === t.key ? "#000" : "rgba(255,255,255,0.70)",
                transition: "all 0.2s" }}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setFiltersOpen(f => !f)}
            style={{ minHeight: 48, padding: "10px 14px", borderRadius: 12, border: selectedNeeds.size > 0 ? `1px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontWeight: 800, fontSize: 14,
              background: selectedNeeds.size > 0 ? sportColorBg : "rgba(255,255,255,0.07)",
              color: selectedNeeds.size > 0 ? sportColor : "rgba(255,255,255,0.70)" }}>
            🔍{selectedNeeds.size > 0 ? ` ${selectedNeeds.size}` : ""}
          </button>
        </div>

        {/* ── DESCRIPCIÓN TAB ── */}
        {tab === "all" && (
          <div style={{ background: sportColorBg, border: `1px solid ${sportColorBorder}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "rgba(255,255,255,0.70)", lineHeight: 1.6 }}>
            Partidos para personas con capacidades especiales. Encuentra compañeros de tu nivel y juega con las adaptaciones que necesitas. Todos son bienvenidos.
          </div>
        )}
        {tab === "exp" && (
          <div style={{ background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.20)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#FFA500", marginBottom: 12 }}>⚡ EXPERIENCIAS GORILA — Vívelo en tu piel</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {EXPERIENCES.map(e => (
                <div key={e.key} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{e.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{e.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>{e.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FILTROS ── */}
        {filtersOpen && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>FILTRAR POR TIPO</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {NEEDS.map(n => (
                <button key={n.key} onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                  style={{ minHeight: 44, padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 14, fontWeight: 700,
                    background: selectedNeeds.has(n.key) ? `${n.color}25` : "rgba(255,255,255,0.07)",
                    border: selectedNeeds.has(n.key) ? `1px solid ${n.color}` : "1px solid rgba(255,255,255,0.12)",
                    color: "#fff" }}>
                  {n.emoji} {n.label}
                </button>
              ))}
            </div>
            {selectedNeeds.size > 0 && (
              <button onClick={() => setSelectedNeeds(new Set())}
                style={{ marginTop: 10, minHeight: 44, padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "rgba(220,38,38,0.15)", color: "#ff6b6b" }}>
                ✕ Quitar filtros
              </button>
            )}
          </div>
        )}

        {err && (
          <div style={{ background: "rgba(220,38,38,0.15)", padding: "14px 16px", borderRadius: 12, color: "#ff6b6b", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{err}</div>
        )}

        {/* ── LISTA DE PARTIDOS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.40)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>♿</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Cargando partidos…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: "#111827", borderRadius: 20, padding: "36px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🤝</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No hay partidos ahora mismo</div>
              <div style={{ color: "rgba(255,255,255,0.50)", fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
                {tab === "all" ? "¡Sé el primero en organizar un partido inclusivo!" : "No hay experiencias programadas todavía"}
              </div>
              <button onClick={() => { if (!session) { goLogin(); return; } setOpenCreate(true); }}
                style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
                + Crear el primer partido
              </button>
            </div>
          ) : filtered.map(m => {
            const isExp = (m.needs || []).some(n => EXP_KEYS.has(n));
            const realNeeds = (m.needs || []).filter(n => !EXP_KEYS.has(n));
            const expNeeds = (m.needs || []).filter(n => EXP_KEYS.has(n));
            const _createdBy = String(m.created_by_user || m.user_id || "").toLowerCase().trim();
            const isCreator = !!(uid && _createdBy && _createdBy === uid.toLowerCase().trim());
            const reqStatus = myReqStatus?.[m.id];

            return (
              <div key={m.id} className="juntos-card">

                {/* CABECERA */}
                <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.40)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {m.club_name || "Club"}{m.city ? ` · ${m.city}` : ""}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", marginTop: 3 }}>
                      {fmtDate(m.start_at)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 10, alignItems: "center" }}>
                    {isExp && <span style={{ fontSize: 11, fontWeight: 900, color: "#FFA500", background: "rgba(255,165,0,0.15)", padding: "4px 10px", borderRadius: 999 }}>⚡ EXP</span>}
                    {isCreator && <span style={{ fontSize: 12, fontWeight: 900, color: "#FFD700", background: "rgba(255,215,0,0.12)", padding: "4px 10px", borderRadius: 999 }}>👑 Creador</span>}
                    {!isCreator && reqStatus === "approved" && <span style={{ fontSize: 12, fontWeight: 900, color: "#2ECC71", background: "rgba(46,204,113,0.12)", padding: "4px 10px", borderRadius: 999 }}>✅ Dentro</span>}
                    {!isCreator && reqStatus === "pending" && <span style={{ fontSize: 12, fontWeight: 900, color: "#F59E0B", background: "rgba(245,158,11,0.12)", padding: "4px 10px", borderRadius: 999 }}>⏳ Pendiente</span>}
                  </div>
                </div>

                {/* TIPOS DE DIVERSIDAD */}
                {(realNeeds.length > 0 || expNeeds.length > 0 || m.mix_allowed) && (
                  <div style={{ padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "rgba(0,0,0,0.20)" }}>
                    {realNeeds.map(k => {
                      const n = getNeedInfo(k);
                      return (
                        <span key={k} className="juntos-need-badge" style={{ background: `${n.color}18`, border: `1px solid ${n.color}50`, color: "#fff" }}>
                          {n.emoji} {n.label}
                        </span>
                      );
                    })}
                    {expNeeds.map(k => {
                      const n = getNeedInfo(k);
                      return (
                        <span key={k} className="juntos-need-badge" style={{ background: "rgba(255,165,0,0.12)", border: "1px solid rgba(255,165,0,0.35)", color: "#fff" }}>
                          {n.emoji} {n.label}
                        </span>
                      );
                    })}
                    {m.mix_allowed && (
                      <span className="juntos-need-badge" style={{ background: `${sportColor}12`, border: `1px solid ${sportColor}40`, color: "#fff" }}>
                        🤝 Abierto a todos
                      </span>
                    )}
                  </div>
                )}

                {/* INFO */}
                <div style={{ padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="juntos-chip">⏱️ {m.duration_min}min</span>
                  <span className="juntos-chip">🎚️ {String(m.level || "").charAt(0).toUpperCase() + String(m.level || "").slice(1)}</span>
                  {m.price_per_player ? <span className="juntos-chip">💶 {m.price_per_player}€/jugador</span> : <span className="juntos-chip" style={{ color: "#2ECC71" }}>Gratis</span>}
                  {m.max_players ? <span className="juntos-chip">👥 Máx {m.max_players} jugadores</span> : null}
                </div>

                {/* ACCESIBILIDAD DE PISTA */}
                {m.accessibility_notes && (
                  <div style={{ padding: "10px 16px", background: "rgba(59,130,246,0.07)", borderTop: "1px solid rgba(59,130,246,0.15)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>♿</span>
                    <span style={{ fontSize: 14, color: "rgba(147,197,253,0.90)", lineHeight: 1.6 }}>{m.accessibility_notes}</span>
                  </div>
                )}

                {/* NOTAS */}
                {m.notes && (
                  <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 14, color: "rgba(255,255,255,0.50)", lineHeight: 1.6, fontStyle: "italic" }}>
                    💬 {m.notes}
                  </div>
                )}

                {/* ACCIONES */}
                <div style={{ padding: "14px 16px", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, flexWrap: "wrap" }}>

                  {/* Sin sesión */}
                  {!session && (
                    <button onClick={goLogin}
                      style={{ flex: 1, minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
                      ♿ Participar
                    </button>
                  )}

                  {/* Creador */}
                  {session && isCreator && (
                    <>
                      <button className="juntos-btn-icon" title="Ver solicitudes"
                        onClick={() => toast.success("Solicitudes próximamente")}>📥</button>
                      <button className="juntos-btn-icon" title="Chat del partido"
                        onClick={() => toast.success("Chat próximamente")}>💬</button>
                      <button className="juntos-btn-icon" title="Compartir"
                        onClick={() => {
                          if (navigator.share) navigator.share({ title: `Partido inclusivo en ${m.club_name}`, url: window.location.href });
                          else { navigator.clipboard.writeText(window.location.href); toast.success("Enlace copiado"); }
                        }}>📤</button>
                      <div style={{ flex: 1 }} />
                      <button onClick={async () => {
                        if (!window.confirm("¿Eliminar este partido?")) return;
                        await supabase.from("inclusive_matches").delete().eq("id", m.id);
                        toast.success("Partido eliminado");
                        setMatches(prev => prev.filter(x => x.id !== m.id));
                      }}
                        style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.25)", color: "#ff6b6b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        🗑️ Eliminar
                      </button>
                    </>
                  )}

                  {/* Ya dentro */}
                  {session && !isCreator && reqStatus === "approved" && (
                    <div style={{ flex: 1, minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#2ECC71", gap: 8 }}>
                      ✅ Ya estás dentro del partido
                    </div>
                  )}

                  {/* Pendiente */}
                  {session && !isCreator && reqStatus === "pending" && (
                    <div style={{ flex: 1, minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#F59E0B", gap: 8, textAlign: "center", lineHeight: 1.4 }}>
                      ⏳ Solicitud enviada — espera confirmación del organizador
                    </div>
                  )}

                  {/* Participar */}
                  {session && !isCreator && !reqStatus && (
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase.from("inclusive_match_requests").insert({
                            match_id: m.id,
                            user_id: session.user.id,
                            status: "pending",
                          });
                          if (error) throw error;
                          try {
                            const { data: profile } = await supabase.from("profiles").select("name, handle").eq("id", session.user.id).single();
                            const userName = profile?.name || profile?.handle || "Alguien";
                            await supabase.from("notifications").insert({
                              user_id: m.created_by_user,
                              type: "inclusive_request",
                              title: "♿ Nueva solicitud",
                              body: `${userName} quiere unirse a tu partido en ${m.club_name || "tu pista"}.`,
                              data: { match_id: m.id },
                            });
                          } catch {}
                          toast.success("¡Solicitud enviada! Te avisaremos 🦍");
                          setMyReqStatus(prev => ({ ...prev, [m.id]: "pending" }));
                        } catch (e) {
                          toast.error(e?.message || "Error al solicitar");
                        }
                      }}
                      style={{ flex: 1, minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      ♿ Quiero participar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ MODAL CREAR ══ */}
      {openCreate && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setOpenCreate(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.90)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 10000, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0f172a", borderRadius: "24px 24px 0 0", padding: "24px 20px", maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${sportColorBorder}`, paddingBottom: "max(24px,env(safe-area-inset-bottom))" }}>

            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />

            <h2 style={{ color: sportColor, marginBottom: 6, fontSize: 22, fontWeight: 900 }}>
              {sportInfo?.emoji || "♿"} Crear partido Juntos
            </h2>
            <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Organiza un partido inclusivo de {sportInfo?.label || "pádel"}. Todos son bienvenidos.
            </p>

            {createErr && (
              <div style={{ background: "rgba(220,38,38,0.15)", padding: "12px 16px", borderRadius: 12, color: "#ff6b6b", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                ⚠️ {createErr}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* CLUB */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>📍 Club *</label>
                <input value={clubName} onChange={e => { setClubName(e.target.value); setShowClubSuggest(true); }}
                  placeholder="Buscar club..." style={IS} />
                {showClubSuggest && clubSuggestions.length > 0 && (
                  <div style={{ background: "#1e293b", borderRadius: 12, marginTop: 6, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.10)" }}>
                    {clubSuggestions.map((c, idx) => (
                      <div key={c.id || idx}
                        onClick={async () => {
                          setClubName(c.name); setShowClubSuggest(false);
                          let realId = String(c.id || "");
                          try { const { data } = await supabase.from("clubs").select("id").ilike("name", c.name).limit(1).single(); if (data?.id) realId = data.id; } catch {}
                          setClubId(realId);
                        }}
                        style={{ padding: "12px 16px", cursor: "pointer", color: "#fff", fontSize: 15, borderBottom: idx < clubSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FECHA Y HORA */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>📅 Fecha y hora *</label>
                <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} style={IS} />
              </div>

              {/* NIVEL Y DURACIÓN */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>🎚️ Nivel</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={IS}>
                    <option value="iniciacion" style={{ background: "#1e293b" }}>Iniciación</option>
                    <option value="intermedio" style={{ background: "#1e293b" }}>Intermedio</option>
                    <option value="alto" style={{ background: "#1e293b" }}>Alto</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>⏱️ Duración</label>
                  <select value={durationMin} onChange={e => setDurationMin(e.target.value)} style={IS}>
                    <option value={60} style={{ background: "#1e293b" }}>60 minutos</option>
                    <option value={90} style={{ background: "#1e293b" }}>90 minutos</option>
                    <option value={120} style={{ background: "#1e293b" }}>2 horas</option>
                  </select>
                </div>
              </div>

              {/* TIPO DE PARTIDO */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>♿ Tipo de partido *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {NEEDS.map(n => (
                    <button key={n.key} type="button" onClick={() => toggleNeed(setCreateNeeds, createNeeds, n.key)}
                      style={{ minHeight: 48, padding: "8px 14px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700,
                        background: createNeeds.has(n.key) ? `${n.color}20` : "rgba(255,255,255,0.07)",
                        border: createNeeds.has(n.key) ? `2px solid ${n.color}` : "1px solid rgba(255,255,255,0.12)",
                        color: "#fff", transition: "all 0.15s" }}>
                      {n.emoji} {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* EXPERIENCIAS */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>⚡ Experiencias (opcional)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EXPERIENCES.map(e => (
                    <button key={e.key} type="button" onClick={() => toggleNeed(setCreateNeeds, createNeeds, e.key)}
                      style={{ minHeight: 48, padding: "8px 14px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700,
                        background: createNeeds.has(e.key) ? "rgba(255,165,0,0.18)" : "rgba(255,255,255,0.07)",
                        border: createNeeds.has(e.key) ? "2px solid #FFA500" : "1px solid rgba(255,255,255,0.12)",
                        color: "#fff", transition: "all 0.15s" }}>
                      {e.emoji} {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ABIERTO A TODOS */}
              <button type="button" onClick={() => setMixAllowed(v => !v)}
                style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, cursor: "pointer", fontSize: 15, fontWeight: 800, textAlign: "left", transition: "all 0.15s",
                  background: mixAllowed ? `${sportColor}18` : "rgba(255,255,255,0.07)",
                  border: mixAllowed ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                {mixAllowed ? `✅ Abierto a todos — con y sin capacidades especiales` : `Solo personas con capacidades especiales`}
              </button>

              {/* ACCESIBILIDAD */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>♿ Adaptaciones de la pista</label>
                <input value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)}
                  placeholder="Ej: Rampa de acceso, vestuario adaptado, marcadores en braille…" style={IS} />
              </div>

              {/* PRECIO */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>💶 Precio por jugador (€)</label>
                <input type="number" min="0" step="0.5" value={pricePerPlayer} onChange={e => setPricePerPlayer(e.target.value)}
                  placeholder="0 — gratis" style={IS} />
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginTop: 6 }}>
                  Deja en 0 si el partido es gratuito. Se añade comisión de 0,30€ por GorilaGo!
                </div>
              </div>

              {/* NOTAS */}
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700 }}>💬 Notas para los participantes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Info extra, qué traer, cómo llegar…"
                  style={{ ...IS, minHeight: 80, resize: "vertical" }} />
              </div>

              {/* BOTONES */}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button onClick={onCreate} disabled={creating}
                  style={{ flex: 1, minHeight: 56, borderRadius: 16, background: creating ? "rgba(116,184,0,0.30)" : `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: creating ? "not-allowed" : "pointer", fontSize: 17 }}>
                  {creating ? "⏳ Creando…" : "🤝 Crear partido"}
                </button>
                <button onClick={() => setOpenCreate(false)} disabled={creating}
                  style={{ minHeight: 56, padding: "14px 20px", borderRadius: 16, background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 15 }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
