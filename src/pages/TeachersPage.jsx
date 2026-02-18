// src/pages/TeachersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

function safeLower(x) {
  return String(x || "").toLowerCase();
}

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map((p) => p[0].toUpperCase()).join("");
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean).map((x) => String(x).trim()))).filter(Boolean);
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // profesores enriquecidos

  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);

  // Filtros pro
  const [onlyInclusive, setOnlyInclusive] = useState(false);
  const [onlyOneToOne, setOnlyOneToOne] = useState(false);
  const [onlyTwoPeople, setOnlyTwoPeople] = useState(false);

  // favoritos
  const [favMap, setFavMap] = useState({}); // teacher_id -> {isFav, notify_morning, notify_afternoon}
  const [busyFavId, setBusyFavId] = useState("");

  // -------- Session ----------
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s ?? null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function loadAll() {
    try {
      setLoading(true);

      // 1) teachers activos
      const { data: teachers, error: eT } = await supabase
        .from("teachers")
        .select("id, is_active")
        .neq("is_active", false);

      if (eT) throw eT;

      const ids = (teachers || []).map((t) => String(t.id)).filter(Boolean);

      if (!ids.length) {
        setRows([]);
        setFavMap({});
        return;
      }

      // 2) profiles
      const { data: profs, error: eP } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url")
        .in("id", ids);

      if (eP) throw eP;

      // 3) teacher_public (incluye lo nuevo)
      const { data: pubs, error: ePub } = await supabase
        .from("teacher_public")
        .select("teacher_id, zone, price_base, bio, class_types, modalities, adaptations, formats, updated_at")
        .in("teacher_id", ids);

      if (ePub) throw ePub;

      const mapProf = {};
      for (const p of profs || []) mapProf[String(p.id)] = p;

      const mapPub = {};
      for (const t of pubs || []) mapPub[String(t.teacher_id)] = t;

      // 4) favoritos del usuario
      const uid = session?.user?.id ? String(session.user.id) : "";
      let favs = [];
      if (uid) {
        const { data: favRows, error: eF } = await supabase
          .from("teacher_favorites")
          .select("teacher_id, notify_morning, notify_afternoon, created_at")
          .eq("user_id", uid);

        if (eF) throw eF;
        favs = Array.isArray(favRows) ? favRows : [];
      }

      const nextFavMap = {};
      for (const f of favs || []) {
        const tid = String(f.teacher_id);
        nextFavMap[tid] = {
          isFav: true,
          notify_morning: f.notify_morning !== false,
          notify_afternoon: f.notify_afternoon !== false,
        };
      }
      setFavMap(nextFavMap);

      // 5) juntar todo
      const enriched = ids
        .map((id) => {
          const p = mapProf[id] || null;
          const pub = mapPub[id] || null;

          const displayName =
            (p?.name && String(p.name).trim()) ||
            (p?.handle && String(p.handle).trim()) ||
            `Profe ${id.slice(0, 6)}…`;

          return {
            teacher_id: id,
            name: displayName,
            avatar_url: p?.avatar_url || "",

            zone: pub?.zone || "",
            price_base: pub?.price_base ?? null,
            bio: pub?.bio || "",
            class_types: Array.isArray(pub?.class_types) ? pub.class_types : [],

            modalities: Array.isArray(pub?.modalities) ? pub.modalities : [],
            adaptations: Array.isArray(pub?.adaptations) ? pub.adaptations : [],
            formats: Array.isArray(pub?.formats) ? pub.formats : [],

            updated_at: pub?.updated_at || null,
          };
        })
        .sort((a, b) => safeLower(a.name).localeCompare(safeLower(b.name)));

      setRows(enriched);
    } catch (e) {
      console.error("TeachersPage loadAll error:", e);
      toast.error(e?.message || "No se pudieron cargar los profesores");
      setRows([]);
      setFavMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session?.user?.id]);

  // ✅ Sugerencias “inteligentes” (datalist)
  const suggestions = useMemo(() => {
    const zones = uniq(rows.map((r) => r.zone).filter(Boolean));
    const types = uniq(rows.flatMap((r) => r.class_types || []));
    const modalities = uniq(rows.flatMap((r) => r.modalities || []));
    const adaptations = uniq(rows.flatMap((r) => r.adaptations || []));
    const formats = uniq(rows.flatMap((r) => r.formats || []));

    // cosas “tipo etiqueta” para que el usuario entienda qué buscar
    const tagged = [
      ...zones.map((z) => `Zona: ${z}`),
      ...types.map((t) => `Tipo: ${t}`),
      ...modalities.map((m) => `Modalidad: ${m}`),
      ...adaptations.map((a) => `Inclusión: ${a}`),
      ...formats.map((f) => `Formato: ${f}`),
    ];

    return uniq(tagged).sort((a, b) => safeLower(a).localeCompare(safeLower(b))).slice(0, 80);
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = safeLower(q).trim();

    return (rows || []).filter((r) => {
      if (onlyFav && !favMap?.[r.teacher_id]?.isFav) return false;

      if (onlyInclusive) {
        // inclusivo si tiene Adaptada/Incl. o adaptations con algo
        const hasInc =
          (r.modalities || []).some((x) => safeLower(x).includes("inclus")) ||
          (r.modalities || []).some((x) => safeLower(x).includes("adapt")) ||
          (r.adaptations || []).length > 0;
        if (!hasInc) return false;
      }

      if (onlyOneToOne) {
        if (!(r.formats || []).some((x) => safeLower(x).includes("1:1"))) return false;
      }

      if (onlyTwoPeople) {
        if (!(r.formats || []).some((x) => safeLower(x).includes("2"))) return false;
      }

      if (!qq) return true;

      // Si el usuario selecciona una sugerencia tipo “Zona: X”, lo tratamos bonito
      const normalized = qq
        .replace(/^zona:\s*/i, "")
        .replace(/^tipo:\s*/i, "")
        .replace(/^modalidad:\s*/i, "")
        .replace(/^inclusión:\s*/i, "")
        .replace(/^formato:\s*/i, "");

      const hay = [
        r.name,
        r.zone,
        r.bio,
        (r.class_types || []).join(" "),
        (r.modalities || []).join(" "),
        (r.adaptations || []).join(" "),
        (r.formats || []).join(" "),
      ]
        .filter(Boolean)
        .join(" · ");

      return safeLower(hay).includes(normalized);
    });
  }, [rows, q, onlyFav, favMap, onlyInclusive, onlyOneToOne, onlyTwoPeople]);

  async function toggleFav(teacherId) {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid) return navigate("/login");

    try {
      setBusyFavId(teacherId);

      const isFav = !!favMap?.[teacherId]?.isFav;

      if (!isFav) {
        const { error } = await supabase.from("teacher_favorites").insert({
          user_id: uid,
          teacher_id: teacherId,
          notify_morning: true,
          notify_afternoon: true,
        });
        if (error) throw error;

        setFavMap((p) => ({
          ...p,
          [teacherId]: { isFav: true, notify_morning: true, notify_afternoon: true },
        }));
        toast.success("⭐ Añadido a favoritos");
      } else {
        const { error } = await supabase
          .from("teacher_favorites")
          .delete()
          .eq("user_id", uid)
          .eq("teacher_id", teacherId);
        if (error) throw error;

        setFavMap((p) => {
          const next = { ...p };
          delete next[teacherId];
          return next;
        });
        toast.success("Favorito eliminado");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo actualizar favorito");
    } finally {
      setBusyFavId("");
    }
  }

  function clearFilters() {
    setQ("");
    setOnlyFav(false);
    setOnlyInclusive(false);
    setOnlyOneToOne(false);
    setOnlyTwoPeople(false);
  }

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Profesores</h1>
              <div className="pageMeta">Busca por zona, tipo, modalidad, inclusión… y marca favoritos</div>
            </div>
          </div>

          {/* Controles */}
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950, fontSize: 15 }}>Buscador</div>
              <button className="btn ghost" onClick={clearFilters} disabled={loading}>
                Limpiar
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="gpLabel">Buscar (sugerencias al escribir)</label>
              <input
                className="gpInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                list="teacher-search-suggest"
                placeholder='Ej: "Zona: Teatinos", "Técnica", "Inclusión: silla", "Formato: 2 personas"...'
              />
              <datalist id="teacher-search-suggest">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="gpGrid2" style={{ gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                  <input type="checkbox" checked={!!onlyFav} onChange={(e) => setOnlyFav(!!e.target.checked)} />
                  Solo favoritos
                </label>

                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                  <input type="checkbox" checked={!!onlyInclusive} onChange={(e) => setOnlyInclusive(!!e.target.checked)} />
                  Inclusión / Adaptada
                </label>

                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                  <input type="checkbox" checked={!!onlyOneToOne} onChange={(e) => setOnlyOneToOne(!!e.target.checked)} />
                  1:1
                </label>

                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
                  <input type="checkbox" checked={!!onlyTwoPeople} onChange={(e) => setOnlyTwoPeople(!!e.target.checked)} />
                  Para 2 personas
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn ghost" onClick={loadAll} disabled={loading}>
                  {loading ? "Cargando…" : "Actualizar"}
                </button>
              </div>
            </div>
          </div>

          {/* Lista */}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <div style={{ opacity: 0.75 }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No hay profes para mostrar con estos filtros.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {filtered.map((r) => {
                  const isFav = !!favMap?.[r.teacher_id]?.isFav;
                  const avatar = r.avatar_url || "";

                  const zone = r.zone ? `📍 ${r.zone}` : "📍 —";
                  const price = r.price_base != null ? `💶 Base: ${r.price_base}€` : "💶 Base: —";

                  const modalities = (r.modalities || []).length ? `🧭 ${(r.modalities || []).join(" · ")}` : "";
                  const types = (r.class_types || []).length ? `🎯 ${(r.class_types || []).join(" · ")}` : "🎯 —";
                  const formats = (r.formats || []).length ? `👥 ${(r.formats || []).join(" · ")}` : "";
                  const inclus = (r.adaptations || []).length ? `♿ ${(r.adaptations || []).join(" · ")}` : "";

                  return (
                    <li key={r.teacher_id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div
                          onClick={() => navigate(`/profesores/${r.teacher_id}`)}
                          style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer", minWidth: 260, flex: 1 }}
                          title="Ver perfil"
                        >
                          {avatar ? (
                            <img src={avatar} alt={r.name} style={{ width: 54, height: 54, borderRadius: 999, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(0,0,0,0.06)" }}>
                              {initials(r.name)}
                            </div>
                          )}

                          <div>
                            <div style={{ fontWeight: 950, fontSize: 16 }}>{r.name}</div>
                            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                              {zone} · {price}
                            </div>

                            <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 13, opacity: 0.85 }}>
                              {modalities ? <div>{modalities}</div> : null}
                              <div>{types}</div>
                              {formats ? <div>{formats}</div> : null}
                              {inclus ? <div>{inclus}</div> : null}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className={isFav ? "btn" : "btn ghost"}
                            onClick={() => toggleFav(r.teacher_id)}
                            disabled={busyFavId === r.teacher_id}
                            style={{ borderRadius: 14, minWidth: 170 }}
                          >
                            {busyFavId === r.teacher_id ? "Guardando…" : isFav ? "⭐ En favoritos" : "☆ Añadir favorito"}
                          </button>

                          <button type="button" className="btn ghost" onClick={() => navigate(`/clases?teacher=${r.teacher_id}`)}>
                            Ver clases
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Tip: si quieres avisos por franja (mañana/tarde), entra en el profe y ajusta los checks.
          </div>
        </div>
      </div>
    </div>
  );
}
