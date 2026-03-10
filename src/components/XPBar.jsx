// src/components/XPBar.jsx
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { getLevelFromXp, ACHIEVEMENTS, XP_LEVELS } from "../services/xp";

// ── Mini versión para Navbar ──────────────────────────────────────────
export function XPBadge({ userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles")
      .select("xp, streak_days, streak_last_date")
      .eq("id", userId).single()
      .then(({ data }) => { if (data) setData(data); });
  }, [userId]);

  if (!data) return null;

  const { level, label } = getLevelFromXp(data.xp || 0);
  const streak = data.streak_days || 0;

  // Racha activa = jugó ayer o hoy
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const streakActive = data.streak_last_date === today || data.streak_last_date === yesterday;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontSize: 11, fontWeight: 900,
        background: "rgba(116,184,0,0.15)",
        color: "#74B800",
        border: "1px solid rgba(116,184,0,0.3)",
        borderRadius: 8, padding: "2px 7px",
      }}>
        Nv.{level}
      </span>
      {streak > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 900,
          color: streakActive ? "#F97316" : "rgba(255,255,255,0.3)",
        }}>
          🔥{streak}
        </span>
      )}
    </div>
  );
}

// ── Versión completa para ProfilePage ────────────────────────────────
export default function XPBar({ userId }) {
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [recentXp, setRecentXp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("stats"); // stats | achievements | history

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    const [profileRes, achRes, xpRes] = await Promise.all([
      supabase.from("profiles").select("xp, streak_days, streak_last_date").eq("id", userId).single(),
      supabase.from("user_achievements").select("achievement_key, unlocked_at").eq("user_id", userId),
      supabase.from("xp_events").select("xp, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    setStats(profileRes.data);
    setAchievements(achRes.data || []);
    setRecentXp(xpRes.data || []);
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 20, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Cargando stats…</div>;
  if (!stats) return null;

  const xp = stats.xp || 0;
  const levelInfo = getLevelFromXp(xp);
  const streak = stats.streak_days || 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const streakActive = stats.streak_last_date === today || stats.streak_last_date === yesterday;

  const unlockedKeys = new Set(achievements.map(a => a.achievement_key));

  const REASON_LABELS = {
    match_played:     "Partido jugado",
    match_won:        "Victoria",
    match_created:    "Partido creado",
    inclusive_played: "Partido inclusivo",
    streak_7:         "Racha 7 días",
    streak_30:        "Racha 30 días",
    rating_given:     "Valoración enviada",
    gorilandia_post:  "Post en Gorilandia",
  };

  return (
    <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>

      {/* HEADER — nivel y XP */}
      <div style={{ padding: "16px 16px 12px", background: "rgba(116,184,0,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#74B800" }}>Nivel {levelInfo.level}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{levelInfo.label}</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {xp} XP total{levelInfo.next ? ` · faltan ${levelInfo.next.minXp - xp} para nivel ${levelInfo.level + 1}` : " · Nivel máximo"}
            </div>
          </div>
          {/* Racha */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>{streakActive ? "🔥" : "💤"}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: streakActive ? "#F97316" : "rgba(255,255,255,0.3)" }}>
              {streak} {streak === 1 ? "día" : "días"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>racha</div>
          </div>
        </div>

        {/* Barra de progreso */}
        {levelInfo.next && (
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              background: "linear-gradient(90deg,#74B800,#9BE800)",
              width: `${levelInfo.progress}%`,
              transition: "width 1s ease",
            }} />
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { id: "stats", label: "📊 Stats" },
          { id: "achievements", label: `🏅 Logros (${achievements.length})` },
          { id: "history", label: "⚡ Historial" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 4px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
            background: tab === t.id ? "rgba(116,184,0,0.1)" : "transparent",
            color: tab === t.id ? "#74B800" : "rgba(255,255,255,0.4)",
            borderBottom: tab === t.id ? "2px solid #74B800" : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {/* TAB: STATS */}
      {tab === "stats" && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "XP Total", value: xp, icon: "⚡" },
              { label: "Nivel", value: levelInfo.label, icon: "🎖️" },
              { label: "Racha actual", value: `${streak} días`, icon: "🔥" },
              { label: "Logros", value: `${achievements.length} / ${ACHIEVEMENTS.length}`, icon: "🏅" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Próximo nivel */}
          {levelInfo.next && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.15)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                Próximo nivel: <span style={{ color: "#74B800", fontWeight: 900 }}>{levelInfo.next.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                Necesitas {levelInfo.next.minXp - xp} XP más · Juega {Math.ceil((levelInfo.next.minXp - xp) / 20)} partidos
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: LOGROS */}
      {tab === "achievements" && (
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ACHIEVEMENTS.map(a => {
            const unlocked = unlockedKeys.has(a.key);
            const unlockedData = achievements.find(u => u.achievement_key === a.key);
            return (
              <div key={a.key} style={{
                padding: 12, borderRadius: 12,
                background: unlocked ? "rgba(116,184,0,0.08)" : "rgba(255,255,255,0.03)",
                border: unlocked ? "1px solid rgba(116,184,0,0.25)" : "1px solid rgba(255,255,255,0.05)",
                opacity: unlocked ? 1 : 0.45,
              }}>
                <div style={{ fontSize: 24, marginBottom: 4, filter: unlocked ? "none" : "grayscale(1)" }}>{a.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: unlocked ? "#fff" : "rgba(255,255,255,0.5)" }}>{a.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2, lineHeight: 1.3 }}>{a.desc}</div>
                {a.xp > 0 && (
                  <div style={{ fontSize: 10, color: "#74B800", fontWeight: 800, marginTop: 4 }}>+{a.xp} XP</div>
                )}
                {unlocked && unlockedData && (
                  <div style={{ fontSize: 9, color: "rgba(116,184,0,0.6)", marginTop: 3 }}>
                    {new Date(unlockedData.unlocked_at).toLocaleDateString("es-ES")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: HISTORIAL XP */}
      {tab === "history" && (
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Esta semana", value: recentXp.filter(e => new Date(e.created_at) > new Date(Date.now()-7*86400000)).reduce((s,e)=>s+e.xp,0) },
              { label: "Este mes", value: recentXp.filter(e => new Date(e.created_at) > new Date(Date.now()-30*86400000)).reduce((s,e)=>s+e.xp,0) },
              { label: "Eventos", value: recentXp.length },
            ].map(s => (
              <div key={s.label} style={{ flex:1, background:"rgba(116,184,0,0.06)", border:"1px solid rgba(116,184,0,0.12)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:900, color:"#74B800" }}>+{s.value}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {recentXp.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              <div style={{fontSize:40, marginBottom:8}}>⚡</div>
              Juega tu primer partido para empezar a ganar XP
            </div>
          ) : (
            recentXp.map((e, i) => {
              const info = REASON_LABELS[e.reason] || { label: e.reason, icon: "⚡" };
              const isAchievement = e.reason?.startsWith("achievement_");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 8px", marginBottom: 4, borderRadius: 10,
                  background: isAchievement ? "rgba(116,184,0,0.06)" : "rgba(255,255,255,0.02)",
                  border: isAchievement ? "1px solid rgba(116,184,0,0.15)" : "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>{info.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{info.label}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                        {new Date(e.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#74B800", whiteSpace:"nowrap" }}>+{e.xp} XP</span>
                </div>
              );
            })
          )}
          {recentXp.length >= 20 && (
            <button onClick={async () => {
              const { supabase } = await import("../services/supabaseClient");
              const { data } = await supabase.from("xp_events").select("xp, reason, created_at")
                .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
              if (data) setRecentXp(data);
            }} style={{ width:"100%", padding:"10px", marginTop:8, borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", fontWeight:700 }}>
              Ver más historial
            </button>
          )}
        </div>
      )}
    </div>
  );
}