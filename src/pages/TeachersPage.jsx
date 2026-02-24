// src/pages/TeachersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import {
  ALL_SPECIALTY_CATEGORIES,
  INCLUSION,
  getSpecialtyInfo,
  specialtiesToSearchText,
} from "../constants/teacherSpecialties";

function safeLower(x) { return String(x || "").toLowerCase(); }
function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map(p => p[0].toUpperCase()).join("");
}

const IS = {
  width: "100%", padding: "10px 12px", borderRadius: 9,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff", fontSize: 13, boxSizing: "border-box",
};

// Pills de inclusión destacadas (acceso rápido sin abrir el panel completo)
const QUICK_INCLUSION = [
  { key: "silla_ruedas",   label: "Silla de ruedas", emoji: "♿",  color: "#3B82F6" },
  { key: "baja_vision",    label: "Invidentes",       emoji: "🦯",  color: "#8B5CF6" },
  { key: "down",           label: "Síndrome de Down", emoji: "💙",  color: "#EC4899" },
  { key: "tea",            label: "TEA / Autismo",    emoji: "🧩",  color: "#F59E0B" },
  { key: "tdah",           label: "TDAH",             emoji: "⚡",  color: "#F97316" },
  { key: "lesion_retorno", label: "Vuelta tras lesión",emoji: "❤️‍🩹", color: "#EF4444" },
];

export default function TeachersPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [favMap, setFavMap] = useState({});
  const [busyFavId, setBusyFavId] = useState("");

  const [q, setQ] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [openFilterCat, setOpenFilterCat] = useState(null);
  const [onlyFav, setOnlyFav] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (!alive) return; setSession(data?.session ?? null); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (!alive) return; setSession(s ?? null); setAuthReady(true); });
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  async function loadAll() {
    try {
      setLoading(true);

      // 1) teachers activos con sus datos (bio, zone, price, specialties — todo en una tabla)
      const { data: teachers, error: eT } = await supabase
        .from("teachers")
        .select("id,is_active,bio,zone,price_base,specialties")
        .neq("is_active", false);
      if (eT) throw eT;

      const ids = (teachers || []).map(t => String(t.id)).filter(Boolean);
      if (!ids.length) { setRows([]); setFavMap({}); return; }

      // 2) profiles (nombre + avatar)
      const { data: profs, error: eP } = await supabase
        .from("profiles").select("id,name,handle,avatar_url").in("id", ids);
      if (eP) throw eP;

      const mapProf = {};
      for (const p of profs || []) mapProf[String(p.id)] = p;

      const mapTeacher = {};
      for (const t of teachers || []) mapTeacher[String(t.id)] = t;

      // 3) favoritos del usuario
      const uid = session?.user?.id ? String(session.user.id) : "";
      let nextFavMap = {};
      if (uid) {
        const { data: favRows } = await supabase
          .from("teacher_favorites")
          .select("teacher_id,notify_morning,notify_afternoon")
          .eq("user_id", uid);
        for (const f of favRows || []) {
          nextFavMap[String(f.teacher_id)] = {
            isFav: true,
            notify_morning: f.notify_morning !== false,
            notify_afternoon: f.notify_afternoon !== false,
          };
        }
      }
      setFavMap(nextFavMap);

      // 4) montar filas enriquecidas
      const enriched = ids.map(id => {
        const p = mapProf[id] || null;
        const t = mapTeacher[id] || null;
        const displayName = (p?.name && String(p.name).trim())
          || (p?.handle && String(p.handle).trim())
          || `Profe ${id.slice(0, 6)}…`;
        const specialties = Array.isArray(t?.specialties) ? t.specialties : [];
        return {
          teacher_id: id,
          name: displayName,
          avatar_url: p?.avatar_url || "",
          zone: t?.zone || "",
          price_base: t?.price_base ?? null,
          bio: t?.bio || "",
          specialties,
          // texto unificado para búsqueda libre
          searchText: safeLower(`${displayName} ${t?.zone || ""} ${t?.bio || ""} ${specialtiesToSearchText(specialties)}`),
        };
      }).sort((a, b) => safeLower(a.name).localeCompare(safeLower(b.name)));

      setRows(enriched);
    } catch (e) {
      toast.error(e?.message || "No se pudieron cargar los profesores");
      setRows([]); setFavMap({});
    } finally { setLoading(false); }
  }

  useEffect(() => { if (!authReady) return; loadAll(); }, [authReady, session?.user?.id]);

  const filtered = useMemo(() => {
    const qq = safeLower(q).trim();
    return rows.filter(r => {
      if (onlyFav && !favMap?.[r.teacher_id]?.isFav) return false;
      if (activeFilters.length > 0 && !activeFilters.every(fk => r.specialties.includes(fk))) return false;
      if (!qq) return true;
      return r.searchText.includes(qq);
    });
  }, [rows, q, onlyFav, favMap, activeFilters]);

  function toggleFilter(key) {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function clearAll() { setQ(""); setOnlyFav(false); setActiveFilters([]); }

  async function toggleFav(teacherId) {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid) return navigate("/login");
    try {
      setBusyFavId(teacherId);
      const isFav = !!favMap?.[teacherId]?.isFav;
      if (!isFav) {
        const { error } = await supabase.from("teacher_favorites")
          .insert({ user_id: uid, teacher_id: teacherId, notify_morning: true, notify_afternoon: true });
        if (error) throw error;
        setFavMap(p => ({ ...p, [teacherId]: { isFav: true, notify_morning: true, notify_afternoon: true } }));
        toast.success("⭐ Añadido a favoritos");
      } else {
        const { error } = await supabase.from("teacher_favorites")
          .delete().eq("user_id", uid).eq("teacher_id", teacherId);
        if (error) throw error;
        setFavMap(p => { const next = { ...p }; delete next[teacherId]; return next; });
        toast.success("Favorito eliminado");
      }
    } catch (e) { toast.error(e?.message || "Error"); }
    finally { setBusyFavId(""); }
  }

  const totalFilters = activeFilters.length + (onlyFav ? 1 : 0);
  const hasFilters = totalFilters > 0 || !!q;

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        .tCard { background:#111; border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:14px; margin-bottom:8px; transition:border-color .2s; }
        .tCard:hover { border-color:rgba(116,184,0,0.3); }
        .tChip { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.65); }
        .tBtn { padding:8px 14px; border-radius:9px; font-weight:900; font-size:12px; cursor:pointer; border:none; }
        .tPrimary { background:linear-gradient(135deg,#74B800,#9BE800); color:#000; }
        .tGhost { background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15) !important; }
        .tFav { background:rgba(255,215,0,0.15); color:#FFD700; border:1px solid rgba(255,215,0,0.3) !important; }
        .tFiltPill { display:inline-flex; align-items:center; gap:4px; padding:5px 11px; border-radius:999px; cursor:pointer; font-size:12px; font-weight:800; border:none; transition:all .15s; }
        .tFiltCatH { display:flex; justify-content:space-between; align-items:center; padding:10px 0; cursor:pointer; border-top:1px solid rgba(255,255,255,0.05); }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ padding: "0 16px", maxWidth: 720, margin: "0 auto" }}>

          {/* HEADER */}
          <div style={{ padding: "12px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>👨‍🏫 Profesores</h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {loading ? "Cargando…" : `${filtered.length} profe${filtered.length !== 1 ? "s" : ""} disponibles`}
              </div>
            </div>
            <button className="tBtn tGhost" onClick={() => setFilterPanelOpen(f => !f)}
              style={{ position: "relative" }}>
              🔍 Filtros
              {totalFilters > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#74B800", color: "#000", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>
                  {totalFilters}
                </span>
              )}
            </button>
          </div>

          {/* PANEL FILTROS */}
          {filterPanelOpen && (
            <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 16, marginBottom: 10 }}>

              {/* Búsqueda libre */}
              <div style={{ marginBottom: 14 }}>
                <input style={IS} value={q} onChange={e => setQ(e.target.value)}
                  placeholder="🔍  Busca por nombre, zona, golpe, técnica, nivel…" />
              </div>

              {/* Inclusión — acceso rápido */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                  ♿ Inclusión / Diversidad funcional
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {QUICK_INCLUSION.map(f => {
                    const active = activeFilters.includes(f.key);
                    return (
                      <button key={f.key} className="tFiltPill" onClick={() => toggleFilter(f.key)}
                        style={{
                          background: active ? `${f.color}22` : "rgba(255,255,255,0.05)",
                          color: active ? f.color : "rgba(255,255,255,0.6)",
                          outline: active ? `1.5px solid ${f.color}60` : "1px solid rgba(255,255,255,0.08)",
                        }}>
                        {f.emoji} {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solo favoritos */}
              <div style={{ marginBottom: 14 }}>
                <button className="tFiltPill" onClick={() => setOnlyFav(v => !v)}
                  style={{
                    background: onlyFav ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                    color: onlyFav ? "#FFD700" : "rgba(255,255,255,0.6)",
                    outline: onlyFav ? "1.5px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  ⭐ Solo favoritos
                </button>
              </div>

              {/* Todas las categorías en acordeón */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "0 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", padding: "10px 0 4px", letterSpacing: ".05em" }}>
                  Filtrar por especialidad
                </div>
                {ALL_SPECIALTY_CATEGORIES.map(cat => {
                  const catActive = activeFilters.filter(k => cat.items.some(i => i.key === k));
                  const isOpen = openFilterCat === cat.id;
                  return (
                    <div key={cat.id}>
                      <div className="tFiltCatH" onClick={() => setOpenFilterCat(isOpen ? null : cat.id)}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: catActive.length ? "#fff" : "rgba(255,255,255,0.55)" }}>
                          {cat.label}
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {catActive.length > 0 && (
                            <span style={{ fontSize: 10, color: "#74B800", background: "rgba(116,184,0,0.15)", padding: "1px 7px", borderRadius: 999, fontWeight: 900 }}>{catActive.length}</span>
                          )}
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ paddingBottom: 12 }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {cat.items.map(item => {
                              const active = activeFilters.includes(item.key);
                              const isInc = cat.id === "inclusion";
                              const color = item.color || "#74B800";
                              return (
                                <button key={item.key} className="tFiltPill" onClick={() => toggleFilter(item.key)}
                                  style={{
                                    background: active ? (isInc ? `${color}22` : "rgba(116,184,0,0.18)") : "rgba(255,255,255,0.04)",
                                    color: active ? (isInc ? color : "#74B800") : "rgba(255,255,255,0.55)",
                                    outline: active ? `1.5px solid ${isInc ? color + "60" : "rgba(116,184,0,0.4)"}` : "1px solid rgba(255,255,255,0.07)",
                                  }}>
                                  <span style={{ fontSize: 13 }}>{item.emoji}</span>
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Chips de filtros activos */}
              {activeFilters.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", alignSelf: "center" }}>Activos:</span>
                  {activeFilters.map(k => {
                    const info = getSpecialtyInfo(k);
                    return (
                      <button key={k} onClick={() => toggleFilter(k)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "rgba(116,184,0,0.15)", color: "#74B800", border: "1px solid rgba(116,184,0,0.3)", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
                        {info.emoji} {info.label} ✕
                      </button>
                    );
                  })}
                </div>
              )}

              {hasFilters && (
                <button className="tBtn tGhost" style={{ fontSize: 11 }} onClick={clearAll}>✕ Limpiar todo</button>
              )}
            </div>
          )}

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: "#111", borderRadius: 14, padding: 28, textAlign: "center", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 36 }}>🦍</div>
              <div style={{ fontWeight: 900, color: "#fff", marginTop: 8 }}>Ningún profe con estos filtros</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Prueba a quitar algún filtro</div>
              <button className="tBtn tGhost" style={{ marginTop: 12 }} onClick={clearAll}>Limpiar filtros</button>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filtered.map(r => {
                const isFav = !!favMap?.[r.teacher_id]?.isFav;
                const inclusionSpecs = r.specialties.map(k => getSpecialtyInfo(k)).filter(s => s.category === "inclusion");
                const otherSpecs = r.specialties.map(k => getSpecialtyInfo(k)).filter(s => s.category !== "inclusion").slice(0, 5);
                const remaining = r.specialties.length - inclusionSpecs.length - Math.min(otherSpecs.length, 5);

                return (
                  <li key={r.teacher_id} className="tCard">
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* AVATAR */}
                      <div onClick={() => navigate(`/profesores/${r.teacher_id}`)} style={{ cursor: "pointer", flexShrink: 0 }}>
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt={r.name} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(116,184,0,0.3)" }} />
                          : <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(116,184,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#74B800", fontSize: 16 }}>{initials(r.name)}</div>
                        }
                      </div>

                      {/* INFO */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                          <div onClick={() => navigate(`/profesores/${r.teacher_id}`)} style={{ cursor: "pointer", flex: 1 }}>
                            <div style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                              {r.zone ? `📍 ${r.zone}` : ""}
                              {r.price_base != null ? `${r.zone ? "  ·  " : ""}💶 ${r.price_base}€` : ""}
                            </div>
                          </div>
                          <button className={`tBtn ${isFav ? "tFav" : "tGhost"}`}
                            onClick={() => toggleFav(r.teacher_id)} disabled={busyFavId === r.teacher_id}
                            style={{ flexShrink: 0, fontSize: 16, padding: "5px 10px" }}>
                            {busyFavId === r.teacher_id ? "…" : isFav ? "⭐" : "☆"}
                          </button>
                        </div>

                        {r.bio && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6, lineHeight: 1.45 }}>{r.bio}</div>}

                        {/* Inclusión destacada */}
                        {inclusionSpecs.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                            {inclusionSpecs.map(s => (
                              <span key={s.key} style={{
                                display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800,
                                padding: "2px 8px", borderRadius: 999,
                                background: `${s.color || "#3B82F6"}20`, color: s.color || "#3B82F6",
                                border: `1px solid ${s.color || "#3B82F6"}40`,
                              }}>
                                {s.emoji} {s.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Otras especialidades */}
                        {otherSpecs.length > 0 && (
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 5 }}>
                            {otherSpecs.map(s => (
                              <span key={s.key} className="tChip">{s.emoji} {s.label}</span>
                            ))}
                            {remaining > 0 && (
                              <span className="tChip" style={{ color: "rgba(116,184,0,0.8)" }}>+{remaining} más</span>
                            )}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          <button className="tBtn tPrimary" onClick={() => navigate(`/profesores/${r.teacher_id}`)}>Ver perfil</button>
                          <button className="tBtn tGhost" onClick={() => navigate(`/clases?teacher=${r.teacher_id}`)}>Ver clases</button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8, paddingBottom: 20 }}>
            Marca ⭐ para recibir avisos cuando tu profe publique clases.
          </div>
        </div>
      </div>
    </div>
  );
}