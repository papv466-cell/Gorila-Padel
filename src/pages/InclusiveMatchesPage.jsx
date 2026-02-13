// src/pages/InclusiveMatchesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./InclusiveMatchesPage.css";
import {
  fetchInclusiveMatches,
  createInclusiveMatch,
  subscribeInclusiveRealtime,
} from "../services/inclusiveMatches";

// ✅ Imágenes (ajusta nombres si cambian)
import imgWheelchair from "../assets/inclusive/wheelchair.png";
import imgBlind from "../assets/inclusive/blind.png";
import imgDown from "../assets/inclusive/down.png";
import imgOther from "../assets/inclusive/other.png";
import imgNone from "../assets/inclusive/none.png";

const NEEDS = [
  { key: "wheelchair", label: "Silla de ruedas", emoji: "♿", img: imgWheelchair },
  { key: "blind", label: "Ceguera / baja visión", emoji: "👁️", img: imgBlind },
  { key: "down", label: "Síndrome de Down", emoji: "🧩", img: imgDown },
  { key: "other", label: "Otra capacidad especial", emoji: "🤝", img: imgOther },
  { key: "none", label: "Mixtos (sin capacidades espaciales)", emoji: "🙂", img: imgNone },
];

function fmtDate(esISO) {
  try {
    return new Date(esISO).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return esISO;
  }
}

function needMeta(key) {
  return NEEDS.find((n) => n.key === key) || { key, label: key, emoji: "✅", img: null };
}

export default function InclusiveMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState([]);

  // filtros (pero ya no ocupan pantalla: van en modal)
  const [selectedNeeds, setSelectedNeeds] = useState(() => new Set());
  const [mixAllowedOnly, setMixAllowedOnly] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);

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

  const activeFilterCount = selectedNeeds.size + (mixAllowedOnly ? 1 : 0);

  return (
    <div className="gpPage">
      <div className="gpWrap">
        <div className="container">
          {/* HEADER (2x2): titulo | Ir a Partidos  /  texto | Crear */}
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

            {/* ✅ mini barra pro */}
            <div className="gpIncMiniBar">
              <button className="btn ghost" type="button" onClick={() => setOpenFilters(true)}>
                Filtrar{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>

              <div className="gpIncCount">
                {loading ? "Cargando…" : `Mostrando: ${filtered.length} partido(s)`}
              </div>

              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setSelectedNeeds(new Set());
                  setMixAllowedOnly(false);
                }}
              >
                Limpiar
              </button>
            </div>
          </div>

          {err ? <div className="authError" style={{ marginTop: 12 }}>{err}</div> : null}

          {/* LISTA PRO */}
          <div className="gpIncList">
            {loading ? (
              <div style={{ opacity: 0.7 }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="gpIncMatchCard">
                <div style={{ fontWeight: 950, fontSize: 15 }}>No hay partidos que encajen ahora mismo</div>
                <div style={{ opacity: 0.75, marginTop: 6, lineHeight: 1.3 }}>
                  Crea uno nuevo y lo verá la comunidad. Si quieres, abre “Filtrar” para ampliar resultados.
                </div>
              </div>
            ) : (
              filtered.map((m) => {
                const needsKeys = (m.needs || []).map(String);
                return (
                  <div key={m.id} className="gpIncMatchCard">
                    <div className="gpIncMatchTop">
                      <div style={{ minWidth: 0 }}>
                        <div className="gpIncMatchTitle">
                          {m.club_name || "Club sin nombre"}
                          {m.city ? <span style={{ opacity: 0.7, fontWeight: 900 }}> · {m.city}</span> : null}
                        </div>

                        <div className="gpIncMatchSub">
                          <span className="gpIncWhen">{fmtDate(m.start_at)}</span>
                          <span>{m.duration_min} min</span>
                          <span>Nivel: {m.level || "—"}</span>
                        </div>
                      </div>

                      <span className={`gpIncPill ${m.mix_allowed ? "ok" : "warn"}`}>
                        {m.mix_allowed ? "Mixto permitido" : "Solo perfiles similares"}
                      </span>
                    </div>

                    {/* ✅ NEEDS EN CUADRADITOS con gorilas */}
                    <div className="gpIncNeedsGrid">
                      {needsKeys.map((k) => {
                        const meta = needMeta(k);
                        return (
                          <div key={k} className="gpIncNeedTile" title={meta.label}>
                            {meta.img ? (
                              <img className="gpIncNeedImg" src={meta.img} alt={meta.label} />
                            ) : (
                              <div className="gpIncNeedImg" style={{
                                display: "grid",
                                placeItems: "center",
                                fontSize: 20,
                                background: "rgba(255,255,255,0.08)"
                              }}>
                                {meta.emoji || "✅"}
                              </div>
                            )}
                            <div className="gpIncNeedLabel">{meta.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    {m.notes ? (
                      <div className="gpIncNotes">
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

      {/* ===== MODAL FILTROS (chips aquí dentro) ===== */}
      {openFilters ? (
        <div className="gpModalOverlay" onMouseDown={() => setOpenFilters(false)}>
          <div className="gpModalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div className="gpIncModalTitle">Filtrar partidos</div>
              <button className="btn ghost" type="button" onClick={() => setOpenFilters(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpIncFilterHint">
              Elige accesibilidad y/o “solo mixtos”. Esto no ensucia la página principal.
            </div>

            <div className="gpActions" style={{ marginTop: 12 }}>
              {NEEDS.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className={`gpChipBtn ${selectedNeeds.has(n.key) ? "isOn" : ""}`}
                  onClick={() => toggleNeed(setSelectedNeeds, selectedNeeds, n.key)}
                >
                  <span className="gpChipText">{n.label} {n.emoji}</span>
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

            <div className="gpActions" style={{ marginTop: 14 }}>
              <button className="btn" type="button" onClick={() => setOpenFilters(false)}>
                Ver resultados
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== MODAL CREAR (lo dejo tal cual lo tienes) ===== */}
      {openCreate ? (
        <div className="gpModalOverlay" onMouseDown={() => setOpenCreate(false)}>
          <div className="gpModalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear partido inclusivo</div>
              <button className="btn ghost" type="button" onClick={() => setOpenCreate(false)}>
                Cerrar
              </button>
            </div>

            <div className="gpForm">
              <label className="gpLabel">Club (nombre)</label>
              <input
                className="gpInput"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Ej: Inacua, Vals Sport..."
              />

              <div className="gpGrid2">
                <div>
                  <label className="gpLabel">Ciudad</label>
                  <input
                    className="gpInput"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej: Málaga"
                  />
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
                    <span className="gpChipText">{n.label} {n.emoji}</span>
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