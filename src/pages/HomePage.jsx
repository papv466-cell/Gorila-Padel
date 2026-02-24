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
  if (h > 48) return `${Math.floor(h/24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function localTimeStr(dateStr) {
  try {
    return new Date(dateStr).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
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

const LEVEL_COLORS = { iniciacion: "#74B800", medio: "#f59e0b", avanzado: "#ef4444", competicion: "#8b5cf6" };

export default function HomePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [gorilandiaFeed, setGorilandiaFeed] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      if (data?.session?.user) loadAll(data.session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s?.user) loadAll(s.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadAll(user) {
    try {
      setLoading(true);
      const [profRes, matchRes, rankRes, feedRes, prodRes] = await Promise.allSettled([
        supabase.from("profiles").select("name, handle, avatar_url, level").eq("id", user.id).maybeSingle(),
        supabase.from("matches").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(5),
        supabase.from("player_ratings").select("*").eq("rated_user_id", user.id).limit(1),
        getFeed(),
        supabase.from("store_products").select("id,title,price,images,slug,compare_at_price").eq("active", true).order("created_at", { ascending: false }).limit(4),
      ]);
      if (profRes.status === "fulfilled") setProfile(profRes.value.data);
      if (matchRes.status === "fulfilled") setMatches(matchRes.value.data || []);
      if (feedRes.status === "fulfilled") setGorilandiaFeed((Array.isArray(feedRes.value) ? feedRes.value : []).slice(0, 6));
      if (prodRes.status === "fulfilled") setProducts(prodRes.value.data || []);
    } finally { setLoading(false); }
  }

  const name = profile?.name || profile?.handle || "Gorila";
  const firstName = name.split(" ")[0];

  /* ── NO LOGUEADO ── */
  if (!session && !loading) return (
    <div className="page" style={{ background: "#0a0a0a", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @keyframes ghHeroIn { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ghPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        .ghCtaBtn { transition: all .2s; }
        .ghCtaBtn:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(116,184,0,0.4) !important; }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 60px", textAlign: "center" }}>
        {/* Hero */}
        <div style={{ paddingTop: 80, paddingBottom: 40, animation: "ghHeroIn .6s ease" }}>
          <img src="/imglogog.png" alt="Gorila Pádel" style={{ width: 90, height: 90, borderRadius: 22, objectFit: "contain", background: "rgba(116,184,0,0.1)", padding: 12, border: "1px solid rgba(116,184,0,0.2)", marginBottom: 24, display: "block", margin: "0 auto 24px", animation: "ghPulse 3s ease infinite" }} />
          <h1 style={{ fontSize: 38, fontWeight: 900, color: "#fff", margin: "0 0 10px", letterSpacing: -1, lineHeight: 1.1 }}>
            GORILA<br /><span style={{ color: "#74B800" }}>PÁDEL</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", margin: "0 0 8px" }}>Rápido. Fácil. Salvaje.</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Partidos · Clubs · Clases · Tienda</p>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, animation: "ghHeroIn .6s ease .2s both" }}>
          <button className="ghCtaBtn" onClick={() => navigate("/login")}
            style={{ padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(116,184,0,0.3)" }}>
            🦍 Únete gratis
          </button>
          <button className="ghCtaBtn" onClick={() => navigate("/partidos")}
            style={{ padding: "14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Ver partidos disponibles →
          </button>
        </div>

        {/* Features */}
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
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        @keyframes ghIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ghShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .ghSection { animation: ghIn .4s ease both; }
        .ghMatchCard { transition: transform .2s, box-shadow .2s; cursor: pointer; flex-shrink: 0; }
        .ghMatchCard:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.4) !important; }
        .ghQuickBtn { transition: all .15s; cursor: pointer; }
        .ghQuickBtn:hover { transform: translateY(-2px); background: rgba(116,184,0,0.15) !important; }
        .ghProductCard { transition: transform .2s; cursor: pointer; flex-shrink: 0; }
        .ghProductCard:hover { transform: translateY(-3px); }
        .ghGoriPost { transition: transform .15s; cursor: pointer; flex-shrink: 0; }
        .ghGoriPost:hover { transform: scale(1.03); }
        .ghScrollRow { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .ghScrollRow::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 14px 80px" }}>

        {/* ── SALUDO ── */}
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

        {/* ── CTA PRINCIPAL ── */}
        <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".05s" }}>
          <button onClick={() => navigate("/partidos")}
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

        {/* ── PRÓXIMOS PARTIDOS ── */}
        {matches.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".1s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🏓 Partidos próximos</div>
              <Link to="/partidos" style={{ fontSize: 11, color: "#74B800", fontWeight: 800, textDecoration: "none" }}>Ver todos →</Link>
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

        {/* ── GORILANDIA ── */}
        {gorilandiaFeed.length > 0 && (
          <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🎬 Gorilandia</div>
              <Link to="/gorilandia" style={{ fontSize: 11, color: "#74B800", fontWeight: 800, textDecoration: "none" }}>Ver todo →</Link>
            </div>
            <div className="ghScrollRow">
              {gorilandiaFeed.map((post, i) => {
                const media = post.media_urls?.[0] || post.media?.[0];
                const isVideo = post.type === "video";
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
              {/* Card "Ver más" */}
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

        {/* ── ACCESOS RÁPIDOS ── */}
        <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".2s" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 12 }}>⚡ Accesos rápidos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { icon: "🗺️", label: "Mapa", path: "/mapa" },
              { icon: "📚", label: "Clases", path: "/clases" },
              { icon: "🛍️", label: "Tienda", path: "/tienda" },
              { icon: "🏆", label: "Ranking", path: "/ranking" },
            ].map(q => (
              <button key={q.label} className="ghQuickBtn"
                onClick={() => navigate(q.path)}
                style={{ padding: "14px 8px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 22 }}>{q.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── RANKING PERSONAL ── */}
        <div className="ghSection" style={{ marginBottom: 24, animationDelay: ".25s" }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#111", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
            onClick={() => navigate("/ranking")}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 2 }}>Tu posición</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Ver ranking completo</div>
            </div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}>→</div>
          </div>
        </div>

        {/* ── NOVEDADES TIENDA ── */}
        {products.length > 0 && (
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

        {/* ── FOOTER ── */}
        <div className="ghSection" style={{ textAlign: "center", paddingTop: 8, animationDelay: ".35s" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>
            <span>verde + negro</span><span>•</span><span>gorilas everywhere</span><span>•</span><span>0 complicaciones</span>
          </div>
        </div>

      </div>
    </div>
  );
}
