// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./InclusiveMatchesPage.css";
import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
  fetchClubsFromGoogleSheet,
} from "../services/inclusiveMatches";

const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas", emoji: "♿" },
  { key: "blind", label: "Ceguera / baja visión", emoji: "🦯" },
  { key: "down", label: "Síndrome de Down", emoji: "💙" },
  { key: "other", label: "Otra capacidad especial", emoji: "🌟" },
  { key: "none", label: "Mixtos / sin capacidades espaciales", emoji: "🤝" },
];

function fmtDate(esISO) {
  try {
    return new Date(esISO).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return esISO;
  }
}

export default function InclusiveMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState([]);

  const [selectedNeeds, setSelectedNeeds] = useState(() => new Set());
  const [mixAllowedOnly, setMixAllowedOnly] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [clubName, setClubName] = useState("");
  const [city, setCity] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationMin, setDurationMin] = useState(90);
  const [level, setLevel] = useState("Intermedio");
  const [notes, setNotes] = useState("");
  const [createNeeds, setCreateNeeds] = useState(() => new Set(["wheelchair"]));
  const [mixAllowed, setMixAllowed] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showClubSuggest, setShowClubSuggest] = useState(false);
  const [clubsSheet, setClubsSheet] = useState([]);

  const clubSuggestions = useMemo(() => {
    const q = clubName.trim().toLowerCase();
    if (q.length < 2) return [];
    return clubsSheet.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [clubName, clubsSheet]);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const list = await fetchInclusiveMatches({ limit: 300 });
      setMatches(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.message || "No pude cargar los partidos inclusivos");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const create = searchParams.get("create") === "1";
    if (create) setOpenCreate(true);
  }, [searchParams]);

  useEffect(() => {
    fetchClubsFromGoogleSheet().then(rows => setClubsSheet(Array.isArray(rows) ? rows : [])).catch(() => setClubsSheet([]));
    load();
    const unsub = subscribeInclusiveRealtime(() => load());
    return () => unsub?.();
  }, []);

  const filtered = useMemo(() => {
    let list = [...(matches || [])];
    const now = Date.now();
    list = list.filter((m) => {
      const t = new Date(m.start_at).getTime();
      return Number.isFinite(t) ? t >= now - 5 * 60 * 1000 : true;
    });

    if (selectedNeeds.size) {
      list = list.filter((m) => {
        const needs = new Set((m.needs || []).map(String));
        for (const k of selectedNeeds) if (needs.has(k)) return true;
        return false;
      });
    }

    if (mixAllowedOnly) list = list.filter((m) => !!m.mix_allowed);
    list.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    return list;
  }, [matches, selectedNeeds, mixAllowedOnly]);

  function toggleNeed(setter, currentSet, key) {
    const next = new Set(Array.from(currentSet));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  async function onCreate() {
    try {
      setCreating(true);
      setErr(null);

      if (!clubName.trim()) throw new Error("Escribe el nombre del club.");
      if (!startAt) throw new Error("Selecciona fecha y hora.");
      if (!createNeeds.size) throw new Error("Elige al menos una opción de accesibilidad.");

      await createInclusiveMatch({
        club_name: clubName.trim(),
        city: city.trim(),
        start_at: new Date(startAt).toISOString(),
        duration_min: Number(durationMin) || 90,
        level: level.trim() || "Intermedio",
        needs: Array.from(createNeeds),
        mix_allowed: !!mixAllowed,
        notes: notes.trim(),
      });

      setOpenCreate(false);
      setClubName("");
      setCity("");
      setStartAt("");
      setDurationMin(90);
      setLevel("Intermedio");
      setNotes("");
      setCreateNeeds(new Set(["wheelchair"]));
      setMixAllowed(true);

      await load();
    } catch (e) {
      setErr(e?.message || "No pude crear el partido");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page pageWithHeader gpMatchesPage">
      <div className="pageWrap">
        <div className="container">
          {/* HEADER */}
          <div className="pageHeader">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="pageTitle">Partidos inclusivos</h1>
                <div className="pageMeta">
                  Partidos para personas con discapacidad y mixtos
                </div>
              </div>
              <button 
                className="btn" 
                type="button" 
                onClick={() => setOpenCreate(true)}
                style={{ 
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                Crear partidos
              </button>
            </div>
          </div>

          {/* FILTROS */}
          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Filtrar</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {NEEDS.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className={`btn ghost ${selectedNeeds.has(n.key) ? "" : ""}`}
                  onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                  style={{
                    background: selectedNeeds.has(n.key) ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.08)",
                    border: selectedNeeds.has(n.key) ? "2px solid #74B800" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {n.emoji} {n.label}
                </button>
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSelectedNeeds(new Set());
                  setMixAllowedOnly(false);
                }}
              >
                🧼 Limpiar
              </button>
            </div>
            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Mostrando: {filtered.length} partido(s)
            </div>
          </div>

          {err ? <div className="authError" style={{ marginTop: 12 }}>{err}</div> : null}

          {/* LISTA */}
          <ul className="gpMatchesGrid" style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="card">
                <div style={{ fontWeight: 900 }}>No hay partidos inclusivos ahora mismo</div>
                <div style={{ opacity: 0.75, marginTop: 6 }}>
                  Crea uno nuevo para que la comunidad lo vea.
                </div>
              </div>
            ) : (
              filtered.map((m) => {
                return (
                  <li key={m.id} className="gpMatchCard">
                    {/* HEADER */}
                    <div className="gpMatchHeader">
                      <div className="gpClubName">{m.club_name || "Club"}</div>
                      <div className="gpClubMeta">
                        <span>📍 {m.city || "Ciudad"}</span>
                      </div>
                    </div>
              
                    {/* ROSTER CON 4 GORILAS */}
                    <div className="gpMatchRoster">
                      <div className="gpTeamSide left">
                        <div className="gpPlayerAvatar">
                          <span style={{ fontSize: '24px' }}>🦍</span>
                        </div>
                        <div className="gpPlayerAvatar">
                          <span style={{ fontSize: '24px' }}>🦍</span>
                        </div>
                      </div>
              
                      <img src="/images/vs-icon.png" alt="VS" className="gpVsIcon" />
              
                      <div className="gpTeamSide right">
                        <div className="gpPlayerAvatar">
                          <span style={{ fontSize: '24px' }}>🦍</span>
                        </div>
                        <div className="gpPlayerAvatar">
                          <span style={{ fontSize: '24px' }}>🦍</span>
                        </div>
                      </div>
                    </div>
              
                    {/* BADGES */}
                    <div className="gpBadges">
                      <div className={`gpBadge ${m.mix_allowed ? "verified" : ""}`}>
                        {m.mix_allowed ? "✅ Mixto permitido" : "Solo perfiles similares"}
                      </div>
                    </div>
              
                    {/* INFO CHIPS */}
                    <div className="gpMatchInfo">
                      <div className="gpInfoChip">🗓️ {fmtDate(m.start_at)}</div>
                      <div className="gpInfoChip">⏱️ {m.duration_min} min</div>
                      <div className="gpInfoChip">🎚️ {m.level}</div>
                    </div>
              
                    {m.notes && (
                      <>
                        <div className="gpDivider" />
                        <div className="gpMatchInfo">
                          <div className="gpInfoChip" style={{ width: '100%' }}>
                            📝 {m.notes}
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* MODAL CREAR */}
      {openCreate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={() => setOpenCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid rgba(116, 184, 0, 0.2)",
            }}
          >
            <h2 style={{ color: "#74B800", marginBottom: "20px", fontSize: "22px", fontWeight: 900 }}>
              Crear partido inclusivo
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                  Club
                </label>
                <input
                
                    value={clubName}
                    onChange={(e) => {
                      setClubName(e.target.value);
                      setShowClubSuggest(true);
                    }}
                    placeholder="Buscar club..."
                   style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {showClubSuggest && clubSuggestions.length > 0 && (
                  <div style={{background:'#2a2a2a', borderRadius:10, marginTop:8, maxHeight:200, overflowY:'auto', border:'1px solid rgba(255,255,255,0.1)'}}>
                    {clubSuggestions.map((c, idx) => (
                      <div key={c.id || idx} onClick={() => { setClubName(c.name); setShowClubSuggest(false); }}
                        style={{padding:12, cursor:'pointer', color:'#fff', fontSize:14, borderBottom: idx < clubSuggestions.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none'}}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Ciudad
                  </label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ciudad"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Nivel
                  </label>
                  <input
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    placeholder="Nivel"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Fecha y hora
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    min="30"
                    step="15"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                  Accesibilidad
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {NEEDS.map((n) => (
                    <button
                      key={n.key}
                      type="button"
                      onClick={() => toggleNeed(setCreateNeeds, createNeeds, n.key)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        background: createNeeds.has(n.key) ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.08)",
                        border: createNeeds.has(n.key) ? "2px solid #74B800" : "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {n.emoji} {n.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700 }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales..."
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    minHeight: "80px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={onCreate}
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "12px",
                    background: creating ? "rgba(116, 184, 0, 0.5)" : "linear-gradient(135deg, #74B800 0%, #9BE800 100%)",
                    color: "#000",
                    fontWeight: 900,
                    border: "none",
                    cursor: creating ? "not-allowed" : "pointer",
                    fontSize: "15px",
                  }}
                >
                  {creating ? "Creando..." : "Crear partido"}
                </button>

                <button
                  onClick={() => setOpenCreate(false)}
                  disabled={creating}
                  style={{
                    padding: "14px 20px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: creating ? "not-allowed" : "pointer",
                    fontSize: "15px",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}