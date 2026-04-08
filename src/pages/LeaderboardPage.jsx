// src/pages/LeaderboardPage.jsx
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import { getLevelFromXp } from "../services/xp";

const TABS = [
  { id: "xp",      label: "⚡ XP",        sub: "Esta semana" },
  { id: "partidos", label: "🎾 Partidos",  sub: "Esta semana" },
  { id: "racha",   label: "🔥 Racha",      sub: "Días seguidos" },
  { id: "global",  label: "🏆 Global",     sub: "Todo el tiempo" },
];

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=dom, 1=lun...
  const diff = (day === 0 ? -6 : 1 - day); // lunes de esta semana
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday.toISOString(), to: sunday.toISOString() };
}

function Avatar({ url, name, size = 40 }) {
  const initials = (name || "?").trim().split(" ").slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(var(--sport-color-rgb, 46,204,113),0.15)", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 900, color: "var(--sport-color)", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function MedalIcon({ pos }) {
  if (pos === 1) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (pos === 2) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (pos === 3) return <span style={{ fontSize: 22 }}>🥉</span>;
  return <span style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.3)", width: 22, textAlign: "center" }}>{pos}</span>;
}

export default function LeaderboardPage({ session }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("xp");
  const [clubFilter, setClubFilter] = useState("todos");
  const [clubs, setClubs] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => { loadClubs(); }, []);
  useEffect(() => { load(); }, [tab, clubFilter]);

  async function loadClubs() {
    // Clubs con más partidos esta semana
    const { from, to } = getWeekRange();
    const { data: rows } = await supabase
      .from("matches")
      .select("club_name")
      .gte("start_at", from)
      .lte("start_at", to)
      .not("club_name", "is", null);
    const counts = {};
    (rows || []).forEach(r => { if (r.club_name) counts[r.club_name] = (counts[r.club_name] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
    setClubs(sorted);
  }

  async function load() {
    setLoading(true);
    try {
      let rows = [];
      const { from, to } = getWeekRange();

      if (tab === "xp") {
        // XP ganado esta semana por usuario
        let q = supabase
          .from("xp_events")
          .select("user_id, xp")
          .gte("created_at", from)
          .lte("created_at", to);
        const { data: xpRows } = await q;

        // Agrupar por usuario
        const byUser = {};
        (xpRows || []).forEach(r => { byUser[r.user_id] = (byUser[r.user_id] || 0) + r.xp; });
        const topIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 50);

        if (topIds.length === 0) { setData([]); setLoading(false); return; }

        const ids = topIds.map(([id]) => id);
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, name, handle, avatar_url")
          .in("id", ids);

        // Si hay filtro de club — filtrar por jugadores que jugaron en ese club esta semana
        let validIds = new Set(ids);
        if (clubFilter !== "todos") {
          const { data: matchRows } = await supabase
            .from("match_players")
            .select("player_uuid, matches!inner(club_name, start_at)")
            .eq("matches.club_name", clubFilter)
            .gte("matches.start_at", from)
            .lte("matches.start_at", to);
          validIds = new Set((matchRows || []).map(r => r.player_uuid));
        }

        const profMap = {};
        (profiles || []).forEach(p => { profMap[p.id] = p; });

        rows = topIds
          .filter(([id]) => validIds.has(id))
          .map(([id, xp], i) => ({ id, xp, ...profMap[id] }))
          .filter(r => r.name || r.handle);

      } else if (tab === "partidos") {
        // Partidos jugados esta semana
        let q = supabase
          .from("match_players")
          .select("player_uuid, matches!inner(club_name, start_at)")
          .gte("matches.start_at", from)
          .lte("matches.start_at", to);
        if (clubFilter !== "todos") q = q.eq("matches.club_name", clubFilter);
        const { data: mpRows } = await q;

        const byUser = {};
        (mpRows || []).forEach(r => { byUser[r.player_uuid] = (byUser[r.player_uuid] || 0) + 1; });
        const topIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 50);
        if (topIds.length === 0) { setData([]); setLoading(false); return; }

        const ids = topIds.map(([id]) => id);
        const { data: profiles } = await supabase.from("profiles_public").select("id, name, handle, avatar_url").in("id", ids);
        const profMap = {};
        (profiles || []).forEach(p => { profMap[p.id] = p; });
        rows = topIds.map(([id, partidos]) => ({ id, partidos, ...profMap[id] })).filter(r => r.name || r.handle);

      } else if (tab === "racha") {
        // Racha actual — directo de profiles
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, streak_days, streak_last_date")
          .gt("streak_days", 0)
          .order("streak_days", { ascending: false })
          .limit(50);

        if (!profRows?.length) { setData([]); setLoading(false); return; }
        const ids = profRows.map(r => r.id);
        const { data: profiles } = await supabase.from("profiles_public").select("id, name, handle, avatar_url").in("id", ids);
        const profMap = {};
        (profiles || []).forEach(p => { profMap[p.id] = p; });

        // Filtrar por club si aplica
        let validIds = new Set(ids);
        if (clubFilter !== "todos") {
          const { data: matchRows } = await supabase
            .from("match_players")
            .select("player_uuid, matches!inner(club_name, start_at)")
            .eq("matches.club_name", clubFilter)
            .gte("matches.start_at", from)
            .lte("matches.start_at", to);
          validIds = new Set((matchRows || []).map(r => r.player_uuid));
        }

        rows = profRows
          .filter(r => validIds.has(r.id))
          .map(r => ({ ...r, ...profMap[r.id] }))
          .filter(r => r.name || r.handle);

      } else if (tab === "global") {
        // XP total de todos los tiempos
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, xp, streak_days")
          .gt("xp", 0)
          .order("xp", { ascending: false })
          .limit(50);

        if (!profRows?.length) { setData([]); setLoading(false); return; }
        const ids = profRows.map(r => r.id);
        const { data: profiles } = await supabase.from("profiles_public").select("id, name, handle, avatar_url").in("id", ids);
        const profMap = {};
        (profiles || []).forEach(p => { profMap[p.id] = p; });

        let validIds = new Set(ids);
        if (clubFilter !== "todos") {
          const { data: matchRows } = await supabase
            .from("match_players")
            .select("player_uuid, matches!inner(club_name)")
            .eq("matches.club_name", clubFilter);
          validIds = new Set((matchRows || []).map(r => r.player_uuid));
        }

        rows = profRows
          .filter(r => validIds.has(r.id))
          .map(r => ({ ...r, ...profMap[r.id] }))
          .filter(r => r.name || r.handle);
      }

      setData(rows);

      // Mi posición
      if (session?.user?.id) {
        const idx = rows.findIndex(r => r.id === session.user.id);
        setMyRank(idx >= 0 ? idx + 1 : null);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getMetric(row) {
    if (tab === "xp") return { value: row.xp, label: "XP", color: "var(--sport-color)" };
    if (tab === "partidos") return { value: row.partidos, label: row.partidos === 1 ? "partido" : "partidos", color: "var(--sport-color)" };
    if (tab === "racha") return { value: row.streak_days, label: row.streak_days === 1 ? "día" : "días", color: "#F97316" };
    if (tab === "global") {
      const lvl = getLevelFromXp(row.xp || 0);
      return { value: row.xp, label: `XP · Nv.${lvl.level}`, color: "var(--sport-color)" };
    }
  }

  const isTop3Style = (i) => i < 3 ? {
    background: i === 0 ? "rgba(255,215,0,0.06)" : i === 1 ? "rgba(192,192,192,0.05)" : "rgba(205,127,50,0.05)",
    border: i === 0 ? "1px solid rgba(255,215,0,0.2)" : i === 1 ? "1px solid rgba(192,192,192,0.15)" : "1px solid rgba(205,127,50,0.15)",
  } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" };

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <div className="pageWrap">
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px" }}>

          {/* HEADER */}
          <div style={{ padding: "16px 0 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>🏆 Ranking</h1>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Semana del {new Date(getWeekRange().from).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
              </div>
            </div>
            <button onClick={() => navigate("/jugadores")} style={{ padding: "8px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
              🔍 Buscar jugadores
            </button>
          </div>

          {/* FILTRO CLUB */}
          <div style={{ overflowX: "auto", display: "flex", gap: 6, paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
            {["todos", ...clubs].map(c => (
              <button key={c} onClick={() => setClubFilter(c)} style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 800,
                background: clubFilter === c ? "var(--sport-color)" : "rgba(255,255,255,0.07)",
                color: clubFilter === c ? "#000" : "rgba(255,255,255,0.6)",
              }}>
                {c === "todos" ? "🌍 Todos" : c}
              </button>
            ))}
          </div>

          {/* TABS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 4px", borderRadius: 12, border: "none", cursor: "pointer",
                background: tab === t.id ? "rgba(var(--sport-color-rgb, 46,204,113),0.15)" : "rgba(255,255,255,0.04)",
                borderBottom: tab === t.id ? "2px solid var(--sport-color)" : "2px solid transparent",
                color: tab === t.id ? "var(--sport-color)" : "rgba(255,255,255,0.4)",
              }}>
                <div style={{ fontSize: 16 }}>{t.label.split(" ")[0]}</div>
                <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2 }}>{t.label.split(" ").slice(1).join(" ")}</div>
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{t.sub}</div>
              </button>
            ))}
          </div>

          {/* MI POSICIÓN */}
          {myRank && !loading && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(var(--sport-color-rgb, 46,204,113),0.08)", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "var(--sport-color)" }}>Tu posición: #{myRank}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {myRank === 1 ? "¡Eres el número 1! 🏆" : `${myRank - 1} posición${myRank - 1 > 1 ? "es" : ""} por encima de ti`}
                </div>
              </div>
            </div>
          )}

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando ranking…</div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🦍</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Aún no hay datos</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {clubFilter !== "todos" ? "Nadie ha jugado en este club esta semana" : "Juega partidos para aparecer aquí"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.map((row, i) => {
                const metric = getMetric(row);
                const isMe = row.id === session?.user?.id;
                return (
                  <div
                    key={row.id}
                    onClick={() => navigate(`/usuario/${row.id}`)}
                    style={{
                      ...isTop3Style(i),
                      borderRadius: 14, padding: "12px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer",
                      outline: isMe ? "2px solid rgba(var(--sport-color-rgb, 46,204,113),0.5)" : "none",
                      transition: "opacity .15s",
                    }}
                  >
                    {/* Posición */}
                    <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                      <MedalIcon pos={i + 1} />
                    </div>

                    {/* Avatar */}
                    <Avatar url={row.avatar_url} name={row.name || row.handle} size={42} />

                    {/* Nombre */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isMe ? "var(--sport-color)" : "#fff", display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name || row.handle || "Jugador"}
                        {isMe && <span style={{ fontSize: 10, background: "rgba(var(--sport-color-rgb, 46,204,113),0.2)", color: "var(--sport-color)", padding: "1px 6px", borderRadius: 999, fontWeight: 800, flexShrink: 0 }}>TÚ</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                        @{row.handle || "—"}
                      </div>
                    </div>

                    {/* Métrica */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: metric.color }}>{metric.value}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{metric.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>
  );
}