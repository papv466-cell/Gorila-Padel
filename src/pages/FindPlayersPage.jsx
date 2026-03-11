// src/pages/FindPlayersPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { getLevelFromXp } from "../services/xp";

const LEVELS = [
  { key: "todos",       label: "Todos los niveles", color: "#74B800" },
  { key: "iniciacion",  label: "Iniciación",         color: "#74B800" },
  { key: "medio",       label: "Medio",               color: "#f59e0b" },
  { key: "avanzado",    label: "Avanzado",            color: "#ef4444" },
  { key: "competicion", label: "Competición",         color: "#8b5cf6" },
];

const DISTANCES = [
  { key: 5,   label: "5 km"   },
  { key: 10,  label: "10 km"  },
  { key: 25,  label: "25 km"  },
  { key: 50,  label: "50 km"  },
  { key: 999, label: "Sin límite" },
];

// Fórmula Haversine — distancia en km entre dos coords
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Avatar({ url, name, size = 44 }) {
  const initials = (name || "?").trim().split(" ").slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(116,184,0,0.15)", border: "1px solid rgba(116,184,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 900, color: "#74B800", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function FindPlayersPage({ session }) {
  const navigate = useNavigate();
  const [levelFilter, setLevelFilter]     = useState("todos");
  const [distFilter, setDistFilter]       = useState(25);
  const [searchText, setSearchText]       = useState("");
  const [myLocation, setMyLocation]       = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | ok | denied
  const [players, setPlayers]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [gorila, setGorila]               = useState(false); // filtro Gorila Sin Límites
  const searchTimeout                     = useRef(null);

  // Al montar — intentar obtener ubicación
  useEffect(() => {
    requestLocation();
  }, []);

  // Re-buscar cuando cambian filtros
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => search(), 400);
    return () => clearTimeout(searchTimeout.current);
  }, [levelFilter, distFilter, searchText, gorila, myLocation]);

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("ok");
      },
      () => {
        // Si deniega, usar last_lat/last_lng del perfil propio
        loadMyProfileLocation();
      },
      { timeout: 6000 }
    );
  }

  async function loadMyProfileLocation() {
    if (!session?.user?.id) { setLocationStatus("denied"); return; }
    const { data } = await supabase
      .from("profiles")
      .select("last_lat, last_lng")
      .eq("id", session.user.id)
      .single();
    if (data?.last_lat) {
      setMyLocation({ lat: data.last_lat, lng: data.last_lng });
      setLocationStatus("ok");
    } else {
      setLocationStatus("denied");
    }
  }

  async function search() {
    setLoading(true);
    try {
      let q = supabase
        .from("profiles")
        .select("id, name, handle, avatar_url, level, last_lat, last_lng, xp, streak_days, gorila_sin_limites, sos_enabled")
        .neq("id", session?.user?.id || "")
        .limit(200);

      if (levelFilter !== "todos") q = q.eq("level", levelFilter);
      if (gorila) q = q.eq("gorila_sin_limites", true);
      if (searchText.trim()) {
        q = q.or(`name.ilike.%${searchText.trim()}%,handle.ilike.%${searchText.trim()}%`);
      }

      const { data } = await q;
      let results = data || [];

      // Filtrar y ordenar por distancia si tenemos ubicación
      if (myLocation && distFilter < 999) {
        results = results
          .filter(p => p.last_lat && p.last_lng)
          .map(p => ({
            ...p,
            distKm: haversine(myLocation.lat, myLocation.lng, p.last_lat, p.last_lng),
          }))
          .filter(p => p.distKm <= distFilter)
          .sort((a, b) => a.distKm - b.distKm);
      } else if (myLocation) {
        results = results.map(p => ({
          ...p,
          distKm: p.last_lat ? haversine(myLocation.lat, myLocation.lng, p.last_lat, p.last_lng) : null,
        })).sort((a, b) => (a.distKm ?? 9999) - (b.distKm ?? 9999));
      }

      setPlayers(results.slice(0, 50));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const levelColor = LEVELS.find(l => l.key === levelFilter)?.color || "#74B800";

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 14px 80px" }}>

        {/* HEADER */}
        <div style={{ padding: "16px 0 12px" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>🔍 Buscar jugadores</h1>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            Encuentra compañeros cerca de ti
          </div>
        </div>

        {/* BUSCADOR */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Buscar por nombre o @handle..."
            style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#111", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
          />
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        </div>

        {/* FILTRO NIVEL */}
        <div style={{ overflowX: "auto", display: "flex", gap: 6, paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevelFilter(l.key)} style={{
              flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 800,
              background: levelFilter === l.key ? l.color : "rgba(255,255,255,0.07)",
              color: levelFilter === l.key ? "#000" : "rgba(255,255,255,0.6)",
            }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* FILTRO DISTANCIA */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          {DISTANCES.map(d => (
            <button key={d.key} onClick={() => setDistFilter(d.key)} style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
              fontSize: 12, fontWeight: 800,
              background: distFilter === d.key ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.05)",
              color: distFilter === d.key ? "#74B800" : "rgba(255,255,255,0.5)",
              border: distFilter === d.key ? "1px solid rgba(116,184,0,0.4)" : "1px solid transparent",
            }}>
              📍 {d.label}
            </button>
          ))}
        </div>

        {/* FILTRO GORILA SIN LÍMITES */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setGorila(!gorila)} style={{
            padding: "7px 14px", borderRadius: 999, cursor: "pointer",
            fontSize: 12, fontWeight: 800,
            background: gorila ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.05)",
            color: gorila ? "#9BE800" : "rgba(255,255,255,0.5)",
            border: gorila ? "1px solid rgba(116,184,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
          }}>
            🦍 Solo Gorila Sin Límites
          </button>
        </div>

        {/* ESTADO UBICACIÓN */}
        {locationStatus === "loading" && (
          <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", gap: 8 }}>
            <span>📍</span> Obteniendo tu ubicación...
          </div>
        )}
        {locationStatus === "denied" && (
          <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", fontSize: 12, color: "rgba(249,115,22,0.8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📍 Sin ubicación — mostrando todos los jugadores</span>
            <button onClick={requestLocation} style={{ fontSize: 11, fontWeight: 800, color: "#F97316", background: "none", border: "none", cursor: "pointer" }}>Activar</button>
          </div>
        )}

        {/* RESULTADOS */}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {loading ? "Buscando..." : `${players.length} jugador${players.length !== 1 ? "es" : ""} encontrado${players.length !== 1 ? "s" : ""}`}
        </div>

        {!loading && players.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🦍</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Sin resultados</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Prueba a ampliar el radio o cambiar el nivel</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map(player => {
            const lvl = getLevelFromXp(player.xp || 0);
            const lc = LEVELS.find(l => l.key === player.level)?.color || "#74B800";
            const levelLabel = LEVELS.find(l => l.key === player.level)?.label || player.level;
            const isMe = player.id === session?.user?.id;

            return (
              <div
                key={player.id}
                onClick={() => navigate(`/usuario/${player.id}`)}
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "border-color .15s" }}
              >
                {/* Avatar */}
                <div style={{ position: "relative" }}>
                  <Avatar url={player.avatar_url} name={player.name || player.handle} size={48} />
                  {/* Indicador nivel XP */}
                  <div style={{ position: "absolute", bottom: -2, right: -2, fontSize: 12, lineHeight: 1 }}>
                    {lvl.level >= 7 ? "🦍" : lvl.level >= 5 ? "💪" : lvl.level >= 3 ? "🎾" : "🌱"}
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {player.name || player.handle || "Jugador"}
                    </div>
                    {player.gorila_sin_limites && <span style={{ fontSize: 12 }}>♿</span>}
                    {player.streak_days >= 7 && <span style={{ fontSize: 12 }}>🔥</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {player.level && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: lc, background: `${lc}15`, padding: "2px 7px", borderRadius: 999 }}>
                        {levelLabel}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
                      Nv.{lvl.level} · {lvl.label}
                    </span>
                    {player.xp > 0 && (
                      <span style={{ fontSize: 10, color: "#74B800", fontWeight: 800 }}>{player.xp} XP</span>
                    )}
                  </div>
                </div>

                {/* Distancia */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {player.distKm != null ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 900, color: player.distKm < 5 ? "#74B800" : player.distKm < 15 ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>
                        {player.distKm < 1 ? "<1" : Math.round(player.distKm)} km
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>de distancia</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 18, color: "rgba(255,255,255,0.15)" }}>→</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}