// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./InclusiveMatchesPage.css";
import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
} from "../services/inclusiveMatches";

const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas", img: "/inclusive/wheelchair.png" },
  { key: "blind", label: "Ceguera / baja visión", img: "/inclusive/blind.png" },
  { key: "down", label: "Síndrome de Down", img: "/inclusive/down.png" },
  { key: "other", label: "Otra capacidad especial", img: "/inclusive/other.png" },
  { key: "none", label: "Mixtos / sin capacidades espaciales", img: "/inclusive/mixed.png" },
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

  // filtros
  const [selectedNeeds, setSelectedNeeds] = useState(() => new Set());
  const [mixAllowedOnly, setMixAllowedOnly] = useState(false);

  // crear
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

  // query params: ?create=1  y ?filter=...
  useEffect(() => {
    const create = searchParams.get("create") === "1";
    const filter = (searchParams.get("filter") || "").trim();

    if (create) setOpenCreate(true);

    if (filter) {
      const map = {
        "Silla de ruedas": "wheelchair",
        "Ceguera / baja visión": "blind",
        "Síndrome de Down": "down",
        "Otra capacidad especial": "other",
        "Sin capacidades espaciales (para mixtos)": "none",
        "Solo mixtos": "__mixonly__",
      };

      const k = map[filter];

      if (k === "__mixonly__") {
        setMixAllowedOnly(true);
        setSelectedNeeds(new Set());
      } else if (k) {
        setMixAllowedOnly(false);
        setSelectedNeeds(new Set([k]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeInclusiveRealtime(() => load());
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = [...(matches || [])];

    // solo futuros (tolerancia 5 min)
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

      if (!clubName.trim()) throw new Error("Escribe el nombre del club (aunque sea aproximado).");
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
          <div className="pageHeader gpIncHeader">
            <div className="gpIncGrid">
              <h1 className="pageTitle">Partidos inclusivos</h1>

              <button className="btn ghost gpIncBtnRight" type="button" onClick={() => navigate("/partidos")}>
                Ir a Partidos
              </button>

              <div className="pageMeta gpIncMeta">
                Encuentra o crea partidos pensados para personas con discapacidad y también mixtos.
              </div>

              <button className="btn gpIncBtnCreate" type="button" onClick={() => setOpenCreate(true)}>
                Crear partidos
              </button>
            </div>
          </div>

          {/* FILTROS BONITOS EN CUADRADITOS */}
          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Filtrar</div>

            <div className="gpIncNeedGrid">
              {NEEDS.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className={`gpIncNeedTile ${selectedNeeds.has(n.key) ? "isOn" : ""}`}
                  onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                >
                  <img src={n.img} alt={n.label} className="gpIncNeedImg" />
                  <div className="gpIncNeedLabel">{n.label}</div>
                </button>
              ))}

              <button
                type="button"
                className={`gpIncNeedTile ${mixAllowedOnly ? "isOn" : ""}`}
                onClick={() => setMixAllowedOnly((v) => !v)}
                title="Solo partidos donde se aceptan mezclas"
              >
                <div className="gpIncNeedEmoji">✅</div>
                <div className="gpIncNeedLabel">Solo mixtos</div>
              </button>

              <button
                type="button"
                className="gpIncNeedTile"
                onClick={() => {
                  setSelectedNeeds(new Set());
                  setMixAllowedOnly(false);
                }}
              >
                <div className="gpIncNeedEmoji">🧼</div>
                <div className="gpIncNeedLabel">Limpiar</div>
              </button>
            </div>

            <div className="gpBadge ok" style={{ marginTop: 10 }}>
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
                <div style={{ fontWeight: 900 }}>No hay partidos que encajen ahora mismo</div>
                <div style={{ opacity: 0.75, marginTop: 6 }}>
                  Prueba a quitar filtros o crea uno nuevo para que la comunidad empiece a moverse.
                </div>
              </div>
            ) : (
              filtered.map((m) => {
                const needs = (m.needs || []).map(String);
                
                return (
                  <li key={m.id} className="gpMatchCard">
                    {/* HEADER */}
                    <div className="gpMatchHeader">
                      <div className="gpClubName">{m.club_name || "Club sin nombre"}</div>
                      <div className="gpClubMeta">
                        <span>📍 {m.city || "Ciudad"}</span>
                      </div>
                    </div>
              
                    {/* ROSTER CON VS */}
                    <div className="gpMatchRoster">
                      {/* EQUIPO IZQUIERDO */}
                      <div className="gpTeamSide left">
                        {needs.slice(0, 2).map((k, idx) => {
                          const n = NEEDS.find((x) => x.key === k);
                          return (
                            <div key={idx} className="gpPlayerAvatar">
                              {n?.img ? (
                                <img src={n.img} alt={n.label} />
                              ) : (
                                <span style={{ fontSize: '48px' }}>♿</span>
                              )}
                            </div>
                          );
                        })}
                        {needs.length < 2 && (
                          <div className="gpPlayerAvatar">
                            <span style={{ fontSize: '48px' }}>🦍</span>
                          </div>
                        )}
                      </div>
              
                      {/* VS ICON */}
                      <img src="/images/vs-icon.png" alt="VS" className="gpVsIcon" />
              
                      {/* EQUIPO DERECHO */}
                      <div className="gpTeamSide right">
                        {needs.slice(2, 4).map((k, idx) => {
                          const n = NEEDS.find((x) => x.key === k);
                          return (
                            <div key={idx} className="gpPlayerAvatar">
                              {n?.img ? (
                                <img src={n.img} alt={n.label} />
                              ) : (
                                <span style={{ fontSize: '48px' }}>♿</span>
                              )}
                            </div>
                          );
                        })}
                        {needs.length < 4 && (
                          <div className="gpPlayerAvatar">
                            <span style={{ fontSize: '48px' }}>🦍</span>
                          </div>
                        )}
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
        <div className="gpModalOverlay" onMouseDown={() => setOpenCreate(false)}>
          <div className="gpModalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear partido</div>
              <button className="btn ghost" type="button" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpForm">
              <label className="gpLabel">Club (nombre)</label>
              <input className="gpInput" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="Ej: Inacua, Vals Sport..." />

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Ciudad</label>
                  <input className="gpInput" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Málaga" />
                </div>
                <div>
                  <label className="gpLabel">Nivel</label>
                  <input className="gpInput" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ej: Iniciación / Intermedio" />
                </div>
              </div>

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Fecha y hora</label>
                  <input className="gpInput" type="datetime-local" step={900} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div>
                  <label className="gpLabel">Duración (min)</label>
                  <input className="gpInput" type="number" min="30" step="15" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
                </div>
              </div>

              <label className="gpLabel">Accesibilidad / perfiles</label>
              <div className="gpIncNeedGrid" style={{ marginTop: 6 }}>
                {NEEDS.map((n) => (
                  <button
                    key={n.key}
                    type="button"
                    className={`gpIncNeedTile ${createNeeds.has(n.key) ? "isOn" : ""}`}
                    onClick={() => toggleNeed(setCreateNeeds, createNeeds, n.key)}
                  >
                    <img src={n.img} alt={n.label} className="gpIncNeedImg" />
                    <div className="gpIncNeedLabel">{n.label}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className={`gpChipBtn ${mixAllowed ? "isOn" : ""}`} onClick={() => setMixAllowed((v) => !v)}>
                  <span className="gpChipText">{mixAllowed ? "Mixtos permitidos ✅" : "Solo perfiles similares"}</span>
                </button>

                <span style={{ opacity: 0.75, fontSize: 13 }}>
                  "Mixto" permite: silla de ruedas + mixtos, ciego + vidente, etc.
                </span>
              </div>

              <label className="gpLabel">Notas (opcional)</label>
              <textarea className="gpTextarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: ambiente tranquilo, ayudamos con guía, etc." />

              <div className="gpActions">
                <button className="btn" type="button" onClick={onCreate} disabled={creating}>
                  {creating ? "Creando..." : "Crear partido"}
                </button>

                <button className="btn ghost" type="button" onClick={() => setOpenCreate(false)}>
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