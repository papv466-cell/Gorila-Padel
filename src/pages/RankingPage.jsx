// src/pages/RankingPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

/* ─── Categorías de ranking ─── */
const TABS = [
  { key: "partidos",   label: "Partidos",   emoji: "🏓", col: "matches_played",  desc: "Total partidos jugados" },
  { key: "valoracion", label: "Valoración", emoji: "⭐", col: "avg_rating",       desc: "Media de valoraciones recibidas" },
  { key: "limpio",     label: "Tarjeta Limpia", emoji: "✅", col: "clean",        desc: "Más partidos sin tarjeta roja" },
];

const MEDALS = ["🥇","🥈","🥉"];

function GorilaBar({ value, max, color = "#74B800" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, #9BE800)`, borderRadius: 999, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

export default function RankingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("partidos");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [period, setPeriod] = useState("all"); // all | month | week

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      /* Traer perfiles con stats */
      const { data: profiles, error } = await supabase
        .from("profiles_public")
        .select("id, name, handle, avatar_url, matches_played, red_cards")
        .gt("matches_played", 0)
        .order("matches_played", { ascending: false })
        .limit(100);
      if (error) throw error;

      /* Traer ratings agregados */
      const { data: ratingRows } = await supabase
        .from("player_ratings")
        .select("to_user_id, rating");

      /* Calcular avg_rating por jugador */
      const ratingMap = {};
      for (const r of ratingRows || []) {
        if (!ratingMap[r.to_user_id]) ratingMap[r.to_user_id] = [];
        ratingMap[r.to_user_id].push(Number(r.rating));
      }

      const enriched = (profiles || []).map(p => {
        const ratings = ratingMap[p.id] || [];
        const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        const clean = (Number(p.matches_played) || 0) - (Number(p.red_cards) || 0) * 3;
        return {
          ...p,
          avg_rating: Math.round(avg * 10) / 10,
          rating_count: ratings.length,
          clean: Math.max(0, clean),
        };
      });

      setPlayers(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const sorted = useMemo(() => {
    const col = TABS.find(t => t.key === tab)?.col || "matches_played";
    return [...players]
      .sort((a, b) => (Number(b[col]) || 0) - (Number(a[col]) || 0))
      .slice(0, 50);
  }, [players, tab]);

  const myRank = useMemo(() => {
    if (!session?.user?.id) return null;
    const idx = sorted.findIndex(p => p.id === session.user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [sorted, session]);

  const maxVal = useMemo(() => {
    const col = TABS.find(t => t.key === tab)?.col || "matches_played";
    return sorted.length > 0 ? Number(sorted[0][col]) || 1 : 1;
  }, [sorted, tab]);

  const currentTab = TABS.find(t => t.key === tab);

  function formatVal(p) {
    if (tab === "partidos") return `${p.matches_played} partidos`;
    if (tab === "valoracion") return p.rating_count > 0 ? `${p.avg_rating} ⭐ (${p.rating_count})` : "Sin valoraciones";
    if (tab === "limpio") return `${p.matches_played}🏓 · ${p.red_cards || 0}🟥`;
    return "";
  }

  function getColVal(p) {
    return Number(p[currentTab?.col]) || 0;
  }

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        @keyframes gpPodiumIn {
          from { opacity:0; transform: translateY(30px) scale(0.92); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes gpRowIn {
          from { opacity:0; transform: translateX(-16px); }
          to   { opacity:1; transform: translateX(0); }
        }
        @keyframes gpShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gpRankTab { transition: all .18s; }
        .gpRankTab:hover { background: rgba(116,184,0,0.12) !important; }
        .gpRankRow { transition: background .15s; }
        .gpRankRow:hover { background: rgba(116,184,0,0.06) !important; }
        .gpAvatarRing { transition: transform .2s; }
        .gpAvatarRing:hover { transform: scale(1.06); }
        .gpGoldShimmer {
          background: linear-gradient(90deg, #FFD700 0%, #FFF3A0 40%, #FFD700 60%, #B8860B 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gpShimmer 2.5s linear infinite;
        }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ paddingBottom: 40 }}>

          {/* ── HEADER ── */}
          <div style={{ padding: "14px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                🏆 <span style={{ color: "#74B800" }}>Ranking</span> Gorila
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {loading ? "Cargando…" : `${sorted.length} jugadores`}
                {myRank ? ` · Tu posición: #${myRank}` : ""}
              </div>
            </div>
            {myRank && (
              <div style={{ textAlign: "center", background: "rgba(116,184,0,0.12)", border: "1px solid rgba(116,184,0,0.3)", borderRadius: 12, padding: "8px 14px" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(116,184,0,0.7)", textTransform: "uppercase", letterSpacing: 1 }}>Tu rank</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#74B800", lineHeight: 1.1 }}>#{myRank}</div>
              </div>
            )}
          </div>

          {/* ── TABS ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t.key} className="gpRankTab" onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: tab === t.key ? "1px solid #74B800" : "1px solid transparent", cursor: "pointer", fontSize: 11, fontWeight: 900, background: tab === t.key ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.06)", color: tab === t.key ? "#74B800" : "rgba(255,255,255,0.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: 40 }}>🦍</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>Cargando ranking…</div>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: 40 }}>🏆</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>Sin datos todavía</div>
            </div>
          ) : (
            <>
              {/* ── PODIO TOP 3 ── */}
              {top3.length >= 1 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "0 4px" }}>

                    {/* 2º puesto */}
                    {top3[1] && (
                      <div style={{ flex: 1, animation: "gpPodiumIn 0.5s ease 0.15s both", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div className="gpAvatarRing" style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #C0C0C0", overflow: "hidden", marginBottom: 6, cursor: "pointer" }} onClick={() => navigate(`/profile/${top3[1].id}`)}>
                          {top3[1].avatar_url ? <img src={top3[1].avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(192,192,192,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🦍</div>}
                        </div>
                        <div style={{ fontSize: 20 }}>🥈</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#fff", textAlign: "center", marginTop: 2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[1].name || top3[1].handle || "Jugador"}</div>
                        <div style={{ fontSize: 10, color: "#C0C0C0", fontWeight: 700 }}>{getColVal(top3[1])}{tab === "valoracion" ? "⭐" : tab === "partidos" ? "🏓" : ""}</div>
                        <div style={{ background: "linear-gradient(180deg, rgba(192,192,192,0.15), rgba(192,192,192,0.05))", border: "1px solid rgba(192,192,192,0.2)", borderRadius: "8px 8px 0 0", width: "100%", height: 60, marginTop: 6 }} />
                      </div>
                    )}

                    {/* 1º puesto */}
                    <div style={{ flex: 1.2, animation: "gpPodiumIn 0.5s ease 0s both", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,215,0,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>CAMPEÓN</div>
                      <div className="gpAvatarRing" style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #FFD700", overflow: "hidden", marginBottom: 6, cursor: "pointer", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }} onClick={() => navigate(`/profile/${top3[0].id}`)}>
                        {top3[0].avatar_url ? <img src={top3[0].avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(255,215,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🦍</div>}
                      </div>
                      <div style={{ fontSize: 28 }}>🥇</div>
                      <div className="gpGoldShimmer" style={{ fontSize: 13, fontWeight: 900, textAlign: "center", marginTop: 2, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[0].name || top3[0].handle || "Jugador"}</div>
                      <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 800 }}>{getColVal(top3[0])}{tab === "valoracion" ? "⭐" : tab === "partidos" ? "🏓" : ""}</div>
                      <div style={{ background: "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.04))", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "8px 8px 0 0", width: "100%", height: 80, marginTop: 6 }} />
                    </div>

                    {/* 3º puesto */}
                    {top3[2] && (
                      <div style={{ flex: 1, animation: "gpPodiumIn 0.5s ease 0.3s both", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div className="gpAvatarRing" style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #CD7F32", overflow: "hidden", marginBottom: 6, cursor: "pointer" }} onClick={() => navigate(`/profile/${top3[2].id}`)}>
                          {top3[2].avatar_url ? <img src={top3[2].avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(205,127,50,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🦍</div>}
                        </div>
                        <div style={{ fontSize: 18 }}>🥉</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#fff", textAlign: "center", marginTop: 2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[2].name || top3[2].handle || "Jugador"}</div>
                        <div style={{ fontSize: 10, color: "#CD7F32", fontWeight: 700 }}>{getColVal(top3[2])}{tab === "valoracion" ? "⭐" : tab === "partidos" ? "🏓" : ""}</div>
                        <div style={{ background: "linear-gradient(180deg, rgba(205,127,50,0.15), rgba(205,127,50,0.04))", border: "1px solid rgba(205,127,50,0.2)", borderRadius: "8px 8px 0 0", width: "100%", height: 44, marginTop: 6 }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── LISTA RESTO ── */}
              <div style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {rest.map((p, idx) => {
                  const rank = idx + 4;
                  const isMe = session?.user?.id === p.id;
                  const val = getColVal(p);
                  return (
                    <div key={p.id} className="gpRankRow"
                      onClick={() => navigate(`/profile/${p.id}`)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: idx < rest.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", background: isMe ? "rgba(116,184,0,0.07)" : "transparent", animation: `gpRowIn 0.3s ease ${(idx * 0.04).toFixed(2)}s both` }}>

                      {/* Rank */}
                      <div style={{ width: 28, textAlign: "center", fontSize: 12, fontWeight: 900, color: isMe ? "#74B800" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                        #{rank}
                      </div>

                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: isMe ? "2px solid #74B800" : "2px solid rgba(255,255,255,0.08)" }}>
                        {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🦍</div>}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isMe ? "#74B800" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name || p.handle || "Jugador"}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, color: "#74B800", background: "rgba(116,184,0,0.15)", padding: "1px 5px", borderRadius: 4 }}>TÚ</span>}
                        </div>
                        <GorilaBar value={val} max={maxVal} color={isMe ? "#74B800" : "#4a7a00"} />
                      </div>

                      {/* Valor */}
                      <div style={{ fontSize: 12, fontWeight: 900, color: isMe ? "#74B800" : "rgba(255,255,255,0.6)", flexShrink: 0, textAlign: "right" }}>
                        {tab === "partidos" && <><span style={{ color: "#fff" }}>{p.matches_played}</span> 🏓</>}
                        {tab === "valoracion" && (
                          p.rating_count > 0
                            ? <><span style={{ color: "#fff" }}>{p.avg_rating}</span> ⭐</>
                            : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>–</span>
                        )}
                        {tab === "limpio" && (
                          <span style={{ color: (p.red_cards || 0) === 0 ? "#74B800" : "rgba(255,255,255,0.6)" }}>
                            {p.matches_played}🏓 {(p.red_cards || 0) > 0 && <span style={{ color: "#ff6b6b" }}>{p.red_cards}🟥</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {rest.length === 0 && top3.length > 0 && (
                  <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                    Solo hay 3 jugadores — ¡sé el 4º!
                  </div>
                )}
              </div>

              {/* ── MI POSICIÓN (si no está visible) ── */}
              {session && myRank && myRank > 53 && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#74B800" }}>#{myRank}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Tu posición actual · ¡Juega más para subir!</div>
                </div>
              )}
            </>
          )}

          {/* ── FOOTER INFO ── */}
          <div style={{ marginTop: 20, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>📊 Cómo funciona el ranking</div>
              <div>🏓 <strong style={{ color: "#fff" }}>Partidos</strong> — total de partidos jugados</div>
              <div>⭐ <strong style={{ color: "#fff" }}>Valoración</strong> — media de estrellas recibidas de compañeros</div>
              <div>✅ <strong style={{ color: "#fff" }}>Tarjeta Limpia</strong> — partidos jugados con menos tarjetas rojas</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}