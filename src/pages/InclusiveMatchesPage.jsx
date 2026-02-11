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

export default function InclusiveMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ✅ CLAVE (si no, rompe y queda negro)

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

      if (!clubName.trim())
        throw new Error("Escribe el nombre del club (aunque sea aproximado).");
      if (!startAt) throw new Error("Selecciona fecha y hora.");
      if (!createNeeds.size)
        throw new Error("Elige al menos una opción de accesibilidad.");

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
    <div className="gpPage">
      <div className="gpWrap">
        <div className="container">
          {/* ✅ HEADER como tu pantallazo: textos paralelos arriba + botones debajo */}
          <div className="pageHeader gpIncHeader">
            <div className="gpIncHeaderTop">
              <h1 className="pageTitle gpIncTitle">Partidos inclusivos</h1>
              <div className="pageMeta gpIncMeta">
                Encuentra o crea partidos pensados para personas con discapacidad y también mixtos.
              </div>
            </div>

            <div className="gpIncHeaderActions">
              <button className="btn" type="button" onClick={() => setOpenCreate(true)}>
                + Crear partido inclusivo
              </button>

              <button className="btn ghost" type="button" onClick={() => navigate("/partidos")}>
                Ir a Partidos
              </button>
            </div>
          </div>

          {/* ... TODO lo demás de tu página sigue igual (filtros, lista, modal) ... */}
        </div>
      </div>

      {/* ... tu modal crear se queda tal cual ... */}
    </div>
  );
}