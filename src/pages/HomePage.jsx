// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { getFeed } from "../services/gorilandia";

function timeUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  if (diff < 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function localTimeStr(dateStr) {
  try { return new Date(dateStr).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function localDateStr(dateStr) {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === tomorrow.toDateString()) return "Mañana";
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  } catch { return ""; }
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

const LEVEL_COLORS = { iniciacion: "#74B800", medio: "#f59e0b", avanzado: "#ef4444", competicion: "#8b5cf6" };

// ── Banner Gorila Sin Límites ─────────────────────────────────────────────
function GorilaMovimientoBanner({ stats, onPress }) {
  const { weekCount = 0, totalCount = 0, playersCount = 0 } = stats || {};
  return (
    <div onClick={onPress} style={{ marginBottom: 24, borderRadius: 18, overflow: "hidden", cursor: "pointer", position: "relative", background: "linear-gradient(135deg,#0d1f00,#1a3d00)", border: "1px solid rgba(116,184,0,0.3)" }}>
      {/* Fondo decorativo */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 80% 50%, rgba(116,184,0,0.12), transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(116,184,0,0.05)", pointerEvents: "none" }} />

      <div style={{ padding: "18px 20px", position: "relative" }}>
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 28 }}>♿</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#9BE800", letterSpacing: 0.3 }}>GORILA SIN LÍMITES</div>
              <div style={{ fontSize: 10, color: "rgba(116,184,0,0.6)", fontWeight: 700 }}>Pádel, tenis y pickleball para todos</div>
            </div>
          </div>
          <div style={{ fontSize: 18, color: "rgba(116,184,0,0.5)" }}>→</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            { value: weekCount, label: "esta semana", icon: "📅" },
            { value: totalCount, label: "en total", icon: "🏅" },
            { value: playersCount, label: "jugadores", icon: "🦍" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "10px 6px", borderRadius: 12, background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.15)" }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#9BE800", lineHeight: 1 }}>
                {s.value > 0 ? s.value : "—"}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 2 }}>partidos {s.label}</div>
            </div>
          ))}
        </div>

        {weekCount > 0 && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(116,184,0,0.1)", border: "1px solid rgba(116,184,0,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#9BE800" }}>
              {weekCount} partido{weekCount !== 1 ? "s" : ""} inclusivo{weekCount !== 1 ? "s" : ""} esta semana · ¡únete al movimiento!
            </span>
          </div>
        )}
        {weekCount === 0 && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.15)", textAlign: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(116,184,0,0.7)", wordBreak: "break-word" }}>Sé el primero en crear un partido inclusivo esta semana 💪</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage({ session: sessionProp }) {
  const navigate = useNavigate();
  const session = sessionProp ?? null;

  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [gorilandiaFeed, setGorilandiaFeed] = useState([]);
  const [splitPending, setSplitPending] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inclusiveStats, setInclusiveStats] = useState({ weekCount: 0, totalCount: 0, playersCount: 0 });
  const [featuredProject, setFeaturedProject] = useState(null);
  const [totalImpact, setTotalImpact] = useState(0);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    if (session?.user) {
      loadAll(session.user);
    } else {
      setLoading(false);
      setProfile(null);
      setMatches([]);
      setGorilandiaFeed([]);
      setProducts([]);
    }
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll(user) {
    try {
      setLoading(true);
      const weekStart = getWeekStart();

      const [profRes, matchRes, feedRes, prodRes, incWeekRes, incTotalRes, incPlayersRes, splitRes] = await Promise.allSettled([
        supabase.from("profiles").select("name, handle, avatar_url, level").eq("id", user.id).maybeSingle(),
        supabase.from("matches").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(5),
        getFeed(),
        supabase.from("store_products").select("id,title,price,images,slug,compare_at_price").eq("is_active", true).order("created_at", { ascending: false }).limit(4),
        // Partidos inclusivos esta semana
        supabase.from("inclusive_matches").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
        // Partidos inclusivos totales
        supabase.from("inclusive_matches").select("*", { count: "exact", head: true }),
        // Jugadores únicos en inclusivos
        supabase.from("match_players").select("player_uuid, matches!inner(id)").eq("matches.sos_active", true).limit(1000),
        // Split pagos pendientes
        supabase.from("split_payment_requests").select("*, court_slots(date, start_time, price)").contains("player_ids", [user.id]).neq("initiator_id", user.id).eq("status", "pending"),
      ]);

      if (profRes.status === "fulfilled") setProfile(profRes.value.data);
      if (matchRes.status === "fulfilled") setMatches(matchRes.value.data || []);
      if (feedRes.status === "fulfilled") setGorilandiaFeed((Array.isArray(feedRes.value) ? feedRes.value : []).slice(0, 6));
      if (prodRes.status === "fulfilled") setProducts(prodRes.value.data || []);
      if (splitRes?.status === "fulfilled") setSplitPending(splitRes.value.data || []);

      // Proyecto destacado
      const { data: proj } = await supabase.from("projects").select("*").eq("active", true).eq("featured", true).limit(1).maybeSingle();
      if (proj) setFeaturedProject(proj);
      else {
        const { data: anyProj } = await supabase.from("projects").select("*").eq("active", true).limit(1).maybeSingle();
        if (anyProj) setFeaturedProject(anyProj);
      }

      // Stats inclusivos
      const weekCount   = incWeekRes.status === "fulfilled"    ? incWeekRes.value.count || 0 : 0;
      const totalCount  = incTotalRes.status === "fulfilled"   ? incTotalRes.value.count || 0 : 0;
      const playersCount = incPlayersRes.status === "fulfilled"
        ? new Set((incPlayersRes.value.data || []).map(r => r.player_uuid)).size
        : 0;

      setInclusiveStats({ weekCount, totalCount, playersCount });

    } finally { setLoading(false); }
  }

  const name = profile?.name || profile?.handle || "Gorila";
  const firstName = name.split(" ")[0];

  /* ── NO LOGUEADO ── */
  if (!session && !loading) return (
    <div className="page" style={{ background: "#0a0a0a", minHeight: "100vh", overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
      <style>{`
        @keyframes ghHeroIn { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ghPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        .ghCtaBtn { transition: all .2s; }
        .ghCtaBtn:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(116,184,0,0.4) !important; }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 60px", textAlign: "center" }}>
        <div style={{ paddingTop: 80, paddingBottom: 40, animation: "ghHeroIn .6s ease" }}>
          <img src="/imglogog.png" alt="GorilaGo!" style={{ width: 90, height: 90, borderRadius: 22, objectFit: "contain", background: "rgba(116,184,0,0.1)", padding: 12, border: "1px solid rgba(116,184,0,0.2)", marginBottom: 24, display: "block", margin: "0 auto 24px", animation: "ghPulse 3s ease infinite" }} />
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#fff", margin: "0 0 10px", letterSpacing: -1, lineHeight: 1.15 }}>
            MONKEY<br /><span style={{ color: "#2ECC71" }}>GORILA</span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.80)", margin: "0 0 6px", fontWeight: 700 }}>Jugando se ayuda — y se ve</p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>Cada partido que juegas ayuda a personas con capacidades especiales a practicar deporte</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, animation: "ghHeroIn .6s ease .2s both" }}>
          <button className="ghCtaBtn" onClick={() => navigate("/register")}
            style={{ padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#2ECC71,#27AE60)", color: "#0d4a25", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(46,204,113,0.3)" }}>
            🦍 Únete y empieza a ayudar
          </button>
          <button className="ghCtaBtn" onClick={() => navigate("/proyectos")}
            style={{ padding: "14px", borderRadius: 14, border: "1px solid rgba(230,126,34,0.30)", background: "rgba(230,126,34,0.08)", color: "#E67E22", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            🏗️ Ver proyectos activos →
          </button>
          <button className="ghCtaBtn" onClick={() => navigate("/login")}
            style={{ padding: "12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.50)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Ya tengo cuenta — Entrar
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animation: "ghHeroIn .6s ease .4s both" }}>
          {[
            { icon: "🏓", title: "Partidos", desc: "Crea o únete" },
            { icon: "🗺️", title: "Mapa", desc: "Clubs cerca" },
            { icon: "📚", title: "Clases", desc: "Mejora tu nivel" },
            { icon: "🛍️", title: "Tienda", desc: "Equipamiento" },
          ].map(f => (
            <div key={f.title} style={{ padding: "14px 12px", borderRadius: 12, background: "#111", border: "1px solid rgba(255,255,255,0.07)", textAlign: "left" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{f.title}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── LOGUEADO ── */
  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh", overflowX: "hidden", maxWidth: "100vw" }}>
      <style>{`
        @keyframes ghIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .ghSection { animation: ghIn .4s ease both; }
        .ghMatchCard { transition: transform .2s, box-shadow .2s; cursor: pointer; flex-shrink: 0; }
        .ghMatchCard:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.4) !important; }
        .ghQuickBtn { transition: all .15s; cursor: pointer; }
        .ghQuickBtn:hover { transform: translateY(-2px); background: rgba(116,184,0,0.15) !important; }
        .ghProductCard { transition: transform .2s; cursor: pointer; flex-shrink: 0; }
        .ghProductCard:hover { transform: translateY(-3px); }
        .ghGoriPost { transition: transform .15s; cursor: pointer; flex-shrink: 0; }
        .ghGoriPost:hover { transform: scale(1.03); }
        .ghScrollRow { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
        .ghScrollRow::-webkit-scrollbar { display: none; }
        .ghSection { max-width: 100%; overflow: hidden; }
        .ghMatchCard { flex-shrink: 0; }
        .ghSection { max-width: 100%; overflow: hidden; }
        .ghMatchCard { flex-shrink: 0; }
        .ghScrollRow::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 14px 80px", overflowX: "hidden", width: "100%", boxSizing: "border-box" }}>

        {/* Saludo */}
        <div className="ghSection" style={{ padding: "16px 0 20px", animationDelay: "0s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 2 }}>{greeting} 👋</div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: -0.5 }}>
                ¡Hola, <span style={{ color: "#74B800" }}>{firstName}</span>!
              </h1>
            </div>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" onClick={() => navigate("/perfil")}
                style={{ width: 46, height: 46, borderRadius: 999, objectFit: "cover", border: "2px solid rgba(116,184,0,0.4)", cursor: "pointer" }} />
            ) : (
              <div onClick={() => navigate("/perfil")}
                style={{ width: 46, height: 46, borderRadius: 999, background: "linear-gradient(135deg,#74B800,#9BE800)", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 900, color: "#000", cursor: "pointer" }}>
                {firstName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Bloque impacto en tiempo real */}
        {featuredProject && (
          <div className="ghSection" style={{ marginBottom: 20, animationDelay: ".04s" }}>
            <div onClick={() => navigate("/proyectos")} style={{ borderRadius: 16, background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", padding: 16, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#E67E22", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>🏗️ Proyecto activo</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{featuredProject.title}</div>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>→</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "#2ECC71", fontWeight: 700 }}>{(featuredProject.current_amount||0).toFixed(0)} € recaudados</span>
                <span style={{ color: "rgba(255,255,255,0.40)" }}>meta: {featuredProject.goal_amount} €</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.round(((featuredProject?.current_amount||0)/featuredProject?.goal_amount)*100))}%`, borderRadius: 999, background: "linear-gradient(90deg,#2ECC71,#27AE60)", transition: "width 0.6s ease" }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Cada reserva que haces aporta 0,10€ a este proyecto. <span style={{ color: "#E67E22", fontWeight: 700 }}>Jugando se ayuda.</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA principal */}
        <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".05s" }}>
          <button onClick={() => navigate("/juega")}
            style={{ width: "100%", padding: "18px 20px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 24px rgba(116,184,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>🦍</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>JUGAR HOY</div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginTop: 2 }}>Encuentra tu próximo partido</div>
              </div>
            </div>
            <span style={{ fontSize: 22 }}>→</span>
          </button>
        </div>

        {/* ── GORILA SIN LÍMITES ── */}
        <div className="ghSection" style={{ animationDelay: ".08s", overflow: "hidden" }}>
          <GorilaMovimientoBanner
            stats={inclusiveStats}
            onPress={() => navigate("/juntos")}
          />
        </div>

        {/* Impacto global */}
        <div className="ghSection" style={{ marginBottom: 20, animationDelay: ".09s" }}>
          <div onClick={() => navigate("/impacto-global")}
            style={{ borderRadius: 16, background: "rgba(26,39,68,0.60)", border: "1px solid rgba(255,255,255,0.10)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>🌍</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Impacto global</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Lo que hemos conseguido juntos jugando</div>
              </div>
            </div>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.30)" }}>→</span>
          </div>
        </div>

        {/* Partidos próximos */}
        {matches.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".1s", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🏓 Partidos próximos</div>
              <Link to="/juega" style={{ fontSize: 11, color: "#74B800", fontWeight: 800, textDecoration: "none" }}>Ver todos →</Link>
            </div>
            <div className="ghScrollRow">
              {matches.map(m => {
                const countdown = timeUntil(m.start_at);
                const levelColor = LEVEL_COLORS[m.level] || "#74B800";
                const spots = 4 - (m.reserved_spots || 0);
                return (
                  <div key={m.id} className="ghMatchCard"
                    onClick={() => navigate(`/partidos?openChat=${m.id}`)}
                    style={{ width: 200, background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ padding: "3px 8px", borderRadius: 6, background: `${levelColor}20`, color: levelColor, fontSize: 10, fontWeight: 900, textTransform: "capitalize" }}>{m.level}</div>
                      {countdown && <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>⏱ {countdown}</div>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 4, lineHeight: 1.2 }}>{m.club_name || "Club"}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
                      {localDateStr(m.start_at)} · {localTimeStr(m.start_at)}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[...Array(4)].map((_, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: 3, background: i < (m.reserved_spots || 0) ? "#74B800" : "rgba(255,255,255,0.15)" }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: spots > 0 ? "#74B800" : "#ef4444", fontWeight: 800 }}>
                        {spots > 0 ? `${spots} libre${spots !== 1 ? "s" : ""}` : "Completo"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Split pagos pendientes */}
        {splitPending.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 16, animationDelay: ".05s" }}>
            {splitPending.map((sp, i) => (
              <div key={i} onClick={() => navigate(`/reserva/pago?slotId=${sp.slot_id}&split=true`)}
                style={{ borderRadius: 14, background: "linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05))", border: "1px solid rgba(249,115,22,0.4)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 28 }}>💸</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#F97316" }}>Pago pendiente</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      Pista · {sp.court_slots?.date} {sp.court_slots?.start_time?.slice(0,5)} · {sp.price_per_player?.toFixed(2)}€
                    </div>
                  </div>
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.4)", fontSize: 12, fontWeight: 900, color: "#F97316" }}>
                  Pagar →
                </div>
              </div>
            ))}
          </div>
        )}

        {false && <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".12s" }}>
          <div onClick={() => navigate("/stack")} style={{
            borderRadius: 16, background: "linear-gradient(135deg,#0a1a00,#1a3500)",
            border: "1px solid rgba(116,184,0,0.25)", padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 36 }}>🦍</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#74B800" }}>GORILA WORD 🦍</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Adivina la palabra deportiva · Reto diario</div>
              </div>
            </div>
            <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(116,184,0,0.15)", border: "1px solid rgba(116,184,0,0.3)", fontSize: 13, fontWeight: 900, color: "#74B800" }}>
              ¡Jugar!
            </div>
          </div>
        </div>}
        {false && gorilandiaFeed.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".15s", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🎬 Gorilandia</div>
              <Link to="/gorilandia" style={{ fontSize: 11, color: "#74B800", fontWeight: 800, textDecoration: "none" }}>Ver todo →</Link>
            </div>
            <div className="ghScrollRow">
              {gorilandiaFeed.map((post, i) => {
const media = post.media_url || post.media_urls?.[0] || post.media?.[0];                const isVideo = post.type === "video";
                return (
                  <div key={post.id || i} className="ghGoriPost"
                    onClick={() => navigate("/gorilandia")}
                    style={{ width: 120, height: 120, borderRadius: 12, overflow: "hidden", background: "#111", border: "1px solid rgba(255,255,255,0.07)", position: "relative", flexShrink: 0 }}>
                    {media ? (
                      isVideo
                        ? <video src={media} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                        : <img src={media} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 32, opacity: 0.2 }}>🦍</div>
                    )}
                    {isVideo && (
                      <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", fontSize: 10 }}>▶</div>
                    )}
                    {post.author?.avatar_url && (
                      <img src={post.author.avatar_url} alt="" style={{ position: "absolute", bottom: 6, left: 6, width: 22, height: 22, borderRadius: 999, border: "1.5px solid #111", objectFit: "cover" }} />
                    )}
                  </div>
                );
              })}
              <div className="ghGoriPost" onClick={() => navigate("/gorilandia")}
                style={{ width: 120, height: 120, borderRadius: 12, background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>🦍</div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#74B800" }}>Ver todo</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {false && <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".2s" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 12 }}>⚡ Accesos rápidos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { icon: "🗺️", label: "Mapa",    path: "/mapa" },
              { icon: "📚", label: "Clases",  path: "/clases" },
              { icon: "🛍️", label: "Tienda",  path: "/tienda" },
              { icon: "🏆", label: "Ranking", path: "/leaderboard" },
            ].map(q => (
              <button key={q.label} className="ghQuickBtn"
                onClick={() => navigate(q.path)}
                style={{ padding: "14px 8px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 22 }}>{q.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{q.label}</span>
              </button>
            ))}
          </div>
        </div>}
        {false && <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".25s" }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#111", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
            onClick={() => navigate("/leaderboard")}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 2 }}>Tu posición</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Ver ranking completo</div>
            </div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>→</div>
          </div>
        </div>}
        {false && products.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🛍️ Novedades tienda</div>
              <Link to="/tienda" style={{ fontSize: 11, color: "#74B800", fontWeight: 800, textDecoration: "none" }}>Ver todo →</Link>
            </div>
            <div className="ghScrollRow">
              {products.map(p => {
                const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
                return (
                  <div key={p.id} className="ghProductCard"
                    onClick={() => navigate(`/tienda/producto/${p.slug || p.id}`)}
                    style={{ width: 140, background: "#111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ height: 140, background: "#1a1a1a", position: "relative", overflow: "hidden" }}>
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 36, opacity: 0.1 }}>🏓</div>}
                      {hasDiscount && (
                        <div style={{ position: "absolute", top: 6, left: 6, padding: "2px 6px", borderRadius: 5, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900 }}>
                          -{Math.round((1 - p.price / p.compare_at_price) * 100)}%
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#74B800" }}>€{p.price}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="ghSection" style={{ textAlign: "center", paddingTop: 8, animationDelay: ".35s" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>
            <span>verde + negro</span><span>•</span><span>gorilas everywhere</span><span>•</span><span>0 complicaciones</span>
          </div>
        </div>

      </div>
    </div>
  );
}