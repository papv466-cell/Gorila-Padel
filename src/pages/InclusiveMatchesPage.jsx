// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./InclusiveMatchesPage.css";

import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
} from "../services/inclusiveMatches";

import { fetchClubsFromGoogleSheet } from "../services/sheets";

const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas ♿" },
  { key: "blind", label: "Ceguera / baja visión 👁️" },
  { key: "down", label: "Síndrome de Down 🧩" },
  { key: "other", label: "Otra capacidad especial 🤝" },
  { key: "none", label: "Sin capacidades espaciales (para mixtos) 🙂" },
];

function fmtDate(esISO) {
  try {
    return new Date(esISO).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return esISO;
  }
}

function normText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function InclusiveMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState([]);

  // ✅ Clubs (para autocomplete)
  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);

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

  // ✅ estados autocomplete
  const [clubSuggestOpen, setClubSuggestOpen] = useState(false);
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);

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

  async function loadClubs() {
    try {
      setClubsLoading(true);
      const rows = await fetchClubsFromGoogleSheet();
      setClubs(Array.isArray(rows) ? rows : []);
    } catch {
      setClubs([]);
    } finally {
      setClubsLoading(false);
    }
  }

  // ✅ carga clubs una vez (solo para autocomplete)
  useEffect(() => {
    loadClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const clubSuggestions = useMemo(() => {
    const q = normText(clubName);
    if (!q || q.length < 2) return [];
    return (clubs || [])
      .filter((c) => normText(c?.name).includes(q))
      .slice(0, 8)
      .map((c) => ({
        name: c.name,
        city: c.city || "",
      }));
  }, [clubName, clubs]);

  const citySuggestions = useMemo(() => {
    const q = normText(city);
    if (!q || q.length < 2) return [];

    // ciudades únicas de clubs (y fallback de partidos)
    const set = new Map();

    for (const c of clubs || []) {
      const cc = String(c?.city || "").trim();
      if (!cc) continue;
      const key = normText(cc);
      if (!set.has(key)) set.set(key, cc);
    }
    for (const m of matches || []) {
      const cc = String(m?.city || "").trim();
      if (!cc) continue;
      const key = normText(cc);
      if (!set.has(key)) set.set(key, cc);
    }

    return Array.from(set.values())
      .filter((x) => normText(x).includes(q))
      .slice(0, 10);
  }, [city, clubs, matches]);

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

      const club = clubName.trim();
      if (!club) throw new Error("Escribe el nombre del club (aunque sea aproximado).");
      if (!startAt) throw new Error("Selecciona fecha y hora.");
      if (!createNeeds.size) throw new Error("Elige al menos una opción de accesibilidad.");

      // ⚠️ Aviso si la fecha se queda en pasado por error humano
      const dt = new Date(startAt);
      if (!Number.isFinite(dt.getTime())) throw new Error("Fecha inválida.");
      if (dt.getTime() < Date.now() - 5 * 60 * 1000) {
        throw new Error("La fecha/hora parece estar en el pasado. Cámbiala para que aparezca en la lista.");
      }

      await createInclusiveMatch({
        club_name: club,
        city: city.trim(),
        start_at: dt.toISOString(),
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
      // ✅ error real, sin “misterios”
      const msg =
        e?.message ||
        (typeof e === "string" ? e : "") ||
        "No pude crear el partido";
      console.error("Inclusive create error:", e);
      setErr(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="gpPage">
      <div className="gpWrap">
        <div className="container">
          {/* HEADER 2x2 */}
          <div className="pageHeader gpIncHeader">
            <div className="gpIncGrid">
              <h1 className="pageTitle gpIncTitle">Partidos inclusivos</h1>

              <button
                className="btn ghost gpIncBtnRight"
                type="button"
                onClick={() => navigate("/partidos")}
              >
                Ir a Partidos
              </button>

              <div className="pageMeta gpIncMeta">
                Encuentra o crea partidos pensados para personas con discapacidad y también mixtos.
              </div>

              <button
                className="btn gpIncBtnCreate"
                type="button"
                onClick={() => setOpenCreate(true)}
              >
                + Crear partido inclusivo
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Filtrar</div>

            <div className="gpActions">
              {NEEDS.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className={`gpChipBtn ${selectedNeeds.has(n.key) ? "isOn" : ""}`}
                  onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                >
                  <span className="gpChipText">{n.label}</span>
                </button>
              ))}

              <button
                type="button"
                className={`gpChipBtn ${mixAllowedOnly ? "isOn" : ""}`}
                onClick={() => setMixAllowedOnly((v) => !v)}
                title="Solo partidos donde se aceptan mezclas"
              >
                <span className="gpChipText">Solo mixtos ✅</span>
              </button>

              <button
                type="button"
                className="gpChipBtn"
                onClick={() => {
                  setSelectedNeeds(new Set());
                  setMixAllowedOnly(false);
                }}
              >
                <span className="gpChipText">Limpiar filtros</span>
              </button>
            </div>

            <div className="gpBadge ok">Mostrando: {filtered.length} partido(s)</div>
          </div>

          {err ? <div className="authError" style={{ marginTop: 12 }}>{err}</div> : null}

          {/* lista */}
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
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
                  <div key={m.id} className="card">
                    <div className="gpCardTop">
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>
                          {m.club_name || "Club sin nombre"}
                          {m.city ? <span style={{ opacity: 0.65, fontWeight: 800 }}> · {m.city}</span> : null}
                        </div>
                        <div className="meta">
                          {fmtDate(m.start_at)} · {m.duration_min} min · Nivel {m.level}
                        </div>
                      </div>

                      <div className={`gpBadge ${m.mix_allowed ? "ok" : "warn"}`}>
                        {m.mix_allowed ? "Mixto permitido" : "Solo perfiles similares"}
                      </div>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {needs.map((k) => {
                        const label = NEEDS.find((x) => x.key === k)?.label || k;
                        return <span key={k} className="gpBadge">{label}</span>;
                      })}
                    </div>

                    {m.notes ? (
                      <div style={{ marginTop: 10, opacity: 0.85 }}>
                        <strong>Notas:</strong> {m.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* modal crear */}
      {openCreate ? (
        <div className="gpModalOverlay" onMouseDown={() => { setOpenCreate(false); setClubSuggestOpen(false); setCitySuggestOpen(false); }}>
          <div className="gpModalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear partido inclusivo</div>
              <button className="btn ghost" type="button" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpForm">
              <label className="gpLabel">Club (nombre)</label>

              <div className="gpAutoWrap">
                <input
                  className="gpInput"
                  value={clubName}
                  onChange={(e) => {
                    setClubName(e.target.value);
                    setClubSuggestOpen(true);
                  }}
                  onFocus={() => setClubSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setClubSuggestOpen(false), 160)}
                  placeholder={clubsLoading ? "Cargando clubs…" : "Ej: Inacua, Vals Sport..."}
                />

                {clubSuggestOpen && clubSuggestions.length > 0 ? (
                  <div className="gpAutoList">
                    {clubSuggestions.map((s, idx) => (
                      <button
                        key={`${s.name}-${idx}`}
                        type="button"
                        className="gpAutoItem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setClubName(s.name);
                          if (s.city) setCity(s.city);
                          setClubSuggestOpen(false);
                        }}
                      >
                        <div className="gpAutoTop">
                          <span>{s.name}</span>
                          <span style={{ opacity: 0.7 }}>{s.city || ""}</span>
                        </div>
                        <div className="gpAutoSub">Usar este club</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Ciudad</label>
                  <div className="gpAutoWrap">
                    <input
                      className="gpInput"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setCitySuggestOpen(true);
                      }}
                      onFocus={() => setCitySuggestOpen(true)}
                      onBlur={() => setTimeout(() => setCitySuggestOpen(false), 160)}
                      placeholder="Ej: Málaga"
                    />

                    {citySuggestOpen && citySuggestions.length > 0 ? (
                      <div className="gpAutoList">
                        {citySuggestions.map((c, idx) => (
                          <button
                            key={`${c}-${idx}`}
                            type="button"
                            className="gpAutoItem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCity(c);
                              setCitySuggestOpen(false);
                            }}
                          >
                            <div className="gpAutoTop">
                              <span>{c}</span>
                              <span style={{ opacity: 0.7 }}>Ciudad</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="gpLabel">Nivel</label>
                  <input
                    className="gpInput"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    placeholder="Ej: Iniciación / Intermedio"
                  />
                </div>
              </div>

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Fecha y hora</label>
                  <input
                    className="gpInput"
                    type="datetime-local"
                    step={900}
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="gpLabel">Duración (min)</label>
                  <input
                    className="gpInput"
                    type="number"
                    min="30"
                    step="15"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                  />
                </div>
              </div>

              <label className="gpLabel">Accesibilidad / perfiles</label>
              <div className="gpActions">
                {NEEDS.map((n) => (
                  <button
                    key={n.key}
                    type="button"
                    className={`gpChipBtn ${createNeeds.has(n.key) ? "isOn" : ""}`}
                    onClick={() => toggleNeed(setCreateNeeds, createNeeds, n.key)}
                  >
                    <span className="gpChipText">{n.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`gpChipBtn ${mixAllowed ? "isOn" : ""}`}
                  onClick={() => setMixAllowed((v) => !v)}
                >
                  <span className="gpChipText">
                    {mixAllowed ? "Mixtos permitidos ✅" : "Solo perfiles similares"}
                  </span>
                </button>

                <span style={{ opacity: 0.75, fontSize: 13 }}>
                  “Mixto” permite: silla de ruedas + mixtos, ciego + vidente, etc.
                </span>
              </div>

              <label className="gpLabel">Notas (opcional)</label>
              <textarea
                className="gpTextarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: ambiente tranquilo, ayudamos con guía, etc."
              />

              <div className="gpActions">
                <button className="btn" type="button" onClick={onCreate} disabled={creating}>
                  {creating ? "Creando…" : "Crear partido"}
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