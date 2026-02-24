// src/pages/TeacherProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import {
  ALL_SPECIALTY_CATEGORIES,
  getSpecialtyInfo,
  groupSpecialtiesByCategory,
} from "../constants/teacherSpecialties";

function isUuid(x = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x));
}
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
const LB = {
  fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6,
};

function SpecPill({ item, active, categoryId, onToggle }) {
  const isInc = categoryId === "inclusion";
  const color = item.color || "#74B800";
  return (
    <button type="button" onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 999, cursor: "pointer",
        fontSize: 12, fontWeight: 800, border: "none", transition: "all .15s",
        background: active ? (isInc ? `${color}22` : "rgba(116,184,0,0.18)") : "rgba(255,255,255,0.05)",
        color: active ? (isInc ? color : "#74B800") : "rgba(255,255,255,0.5)",
        outline: active
          ? `1.5px solid ${isInc ? color + "80" : "rgba(116,184,0,0.5)"}`
          : "1px solid rgba(255,255,255,0.08)",
      }}>
      <span style={{ fontSize: 14 }}>{item.emoji}</span>
      {item.label}
    </button>
  );
}

function SpecCategory({ cat, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const catSelected = selected.filter(k => cat.items.some(i => i.key === k));

  function toggle(key) {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  }

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: catSelected.length ? "#fff" : "rgba(255,255,255,0.6)" }}>
          {cat.label}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {catSelected.length > 0 && (
            <span style={{ fontSize: 11, color: "#74B800", background: "rgba(116,184,0,0.15)", padding: "2px 8px", borderRadius: 999, fontWeight: 900 }}>
              {catSelected.length} ✓
            </span>
          )}
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 900 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ paddingBottom: 14 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {cat.items.map(item => (
              <SpecPill key={item.key} item={item} categoryId={cat.id}
                active={selected.includes(item.key)} onToggle={() => toggle(item.key)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (id && !isUuid(id)) { toast.error("Profesor no válido"); navigate("/profesores", { replace: true }); }
  }, [id]);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [teacherRow, setTeacherRow] = useState(null); // fila de tabla teachers

  const [favBusy, setFavBusy] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [notifyMorning, setNotifyMorning] = useState(true);
  const [notifyAfternoon, setNotifyAfternoon] = useState(true);

  const isMe = useMemo(() => {
    const uid = session?.user?.id ? String(session.user.id) : "";
    return !!(uid && id && uid === String(id));
  }, [session?.user?.id, id]);

  // Editor
  const [editBio, setEditBio] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editPriceBase, setEditPriceBase] = useState("");
  const [editSpecialties, setEditSpecialties] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (!alive) return; setSession(data?.session ?? null); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (!alive) return; setSession(s ?? null); setAuthReady(true); });
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  async function loadAll() {
    if (!id) return;
    try {
      setLoading(true);

      // perfil público
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("id,name,handle,avatar_url")
        .eq("id", id).maybeSingle();
      if (e1) throw e1;

      // datos del profe (tabla teachers, misma id)
      const { data: tc, error: e2 } = await supabase
        .from("teachers")
        .select("id,is_active,bio,zone,price_base,specialties")
        .eq("id", id).maybeSingle();
      if (e2) throw e2;

      setProfile(prof || null);
      setTeacherRow(tc || null);
      setEditBio(String(tc?.bio || ""));
      setEditZone(String(tc?.zone || ""));
      setEditPriceBase(tc?.price_base == null ? "" : String(tc.price_base));
      setEditSpecialties(Array.isArray(tc?.specialties) ? tc.specialties : []);

      // favorito
      const uid = session?.user?.id ? String(session.user.id) : "";
      if (uid) {
        const { data: favRow } = await supabase
          .from("teacher_favorites")
          .select("user_id,notify_morning,notify_afternoon")
          .eq("user_id", uid).eq("teacher_id", id).maybeSingle();
        if (favRow?.user_id) {
          setIsFav(true);
          setNotifyMorning(favRow.notify_morning !== false);
          setNotifyAfternoon(favRow.notify_afternoon !== false);
        } else {
          setIsFav(false);
        }
      }
    } catch (e) { toast.error(e?.message || "No se pudo cargar el perfil"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!authReady) return; loadAll(); }, [authReady, id, session?.user?.id]);

  async function toggleFavorite() {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid) return navigate("/login");
    try {
      setFavBusy(true);
      if (!isFav) {
        const { error } = await supabase.from("teacher_favorites")
          .insert({ user_id: uid, teacher_id: id, notify_morning: true, notify_afternoon: true });
        if (error) throw error;
        setIsFav(true); setNotifyMorning(true); setNotifyAfternoon(true);
        toast.success("⭐ Añadido a favoritos");
      } else {
        const { error } = await supabase.from("teacher_favorites")
          .delete().eq("user_id", uid).eq("teacher_id", id);
        if (error) throw error;
        setIsFav(false); toast.success("Favorito eliminado");
      }
    } catch (e) { toast.error(e?.message || "Error"); }
    finally { setFavBusy(false); }
  }

  async function saveFavPrefs(m, t) {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid || !isFav) return;
    try {
      setFavBusy(true);
      const { error } = await supabase.from("teacher_favorites")
        .update({ notify_morning: !!m, notify_afternoon: !!t })
        .eq("user_id", uid).eq("teacher_id", id);
      if (error) throw error;
    } catch (e) { toast.error(e?.message); }
    finally { setFavBusy(false); }
  }

  async function saveTeacherPublic() {
    if (!isMe) return;
    try {
      setSavingProfile(true);
      const n = editPriceBase === "" ? null : Number(editPriceBase);
      // Actualizamos la tabla teachers directamente
      const { error } = await supabase.from("teachers").update({
        bio: String(editBio || "").trim() || null,
        zone: String(editZone || "").trim() || null,
        price_base: Number.isFinite(n) ? n : null,
        specialties: editSpecialties.length ? editSpecialties : null,
      }).eq("id", id);
      if (error) throw error;
      toast.success("Perfil actualizado ✅");
      await loadAll();
    } catch (e) { toast.error(e?.message || "No se pudo guardar"); }
    finally { setSavingProfile(false); }
  }

  const name = (profile?.name && String(profile.name).trim())
    || (profile?.handle && String(profile.handle).trim())
    || `Profe ${String(id || "").slice(0, 6)}…`;
  const avatar = profile?.avatar_url || "";
  const specialtiesByCategory = useMemo(
    () => groupSpecialtiesByCategory(teacherRow?.specialties || []),
    [teacherRow?.specialties]
  );

  if (loading) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
    </div>
  );

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        .tpS { background:#111; border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:18px; margin-bottom:10px; }
        .tpBtn { padding:9px 16px; border-radius:9px; font-weight:900; font-size:13px; cursor:pointer; border:none; }
        .tpPrimary { background:linear-gradient(135deg,#74B800,#9BE800); color:#000; }
        .tpGhost { background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15) !important; }
        .tpFav { background:rgba(255,215,0,0.15); color:#FFD700; border:1px solid rgba(255,215,0,0.35) !important; }
        .tpG2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:480px){.tpG2{grid-template-columns:1fr;}}
        .tpChip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.7); }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ padding: "0 16px", maxWidth: 680, margin: "0 auto" }}>

          {/* HEADER */}
          <div style={{ padding: "12px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="tpBtn tpGhost" style={{ fontSize: 12 }} onClick={() => navigate(-1)}>← Volver</button>
            {isMe && <span style={{ fontSize: 11, color: "#74B800", fontWeight: 800 }}>🦍 Tu perfil</span>}
          </div>

          {/* PERFIL PÚBLICO */}
          <div className="tpS">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              {avatar
                ? <img src={avatar} alt={name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(116,184,0,0.4)", flexShrink: 0 }} />
                : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(116,184,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#74B800", fontSize: 22, flexShrink: 0 }}>{initials(name)}</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{name}</div>
                {teacherRow?.zone && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>📍 {teacherRow.zone}</div>}
                {teacherRow?.bio
                  ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 8, lineHeight: 1.55 }}>{teacherRow.bio}</div>
                  : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, fontStyle: "italic" }}>Sin bio todavía.</div>
                }
                {teacherRow?.price_base != null && (
                  <div style={{ marginTop: 8 }}>
                    <span className="tpChip">💶 {teacherRow.price_base}€/clase</span>
                  </div>
                )}
              </div>
            </div>

            {/* Especialidades agrupadas */}
            {Object.keys(specialtiesByCategory).length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {Object.entries(specialtiesByCategory).map(([catId, cat]) => (
                  <div key={catId} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                      {cat.label}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {cat.items.map(item => (
                        <span key={item.key} className="tpChip"
                          style={catId === "inclusion" && item.color ? {
                            background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}40`
                          } : {}}>
                          {item.emoji} {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CTA alumno */}
            {!isMe && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className={`tpBtn ${isFav ? "tpFav" : "tpGhost"}`} onClick={toggleFavorite} disabled={favBusy}>
                    {favBusy ? "…" : isFav ? "⭐ En favoritos" : "☆ Añadir favorito"}
                  </button>
                  <button className="tpBtn tpPrimary" onClick={() => navigate(`/clases?teacher=${id}`)}>
                    Ver sus clases
                  </button>
                </div>
                {isFav && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Avisos cuando publique:</span>
                    {[
                      { label: "☀️ Mañana", val: notifyMorning, set: v => { setNotifyMorning(v); saveFavPrefs(v, notifyAfternoon); } },
                      { label: "🌙 Tarde", val: notifyAfternoon, set: v => { setNotifyAfternoon(v); saveFavPrefs(notifyMorning, v); } },
                    ].map(x => (
                      <button key={x.label} onClick={() => x.set(!x.val)} disabled={favBusy}
                        style={{ padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 800, border: "none",
                          background: x.val ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.06)",
                          color: x.val ? "#74B800" : "rgba(255,255,255,0.4)",
                          outline: x.val ? "1px solid rgba(116,184,0,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
                        {x.val ? "✅" : "○"} {x.label}
                      </button>
                    ))}
                  </div>
                )}
                {!isFav && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                    Añádelo a favoritos para recibir avisos cuando publique clases.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EDITOR — solo el profe */}
          {isMe && (
            <div className="tpS">
              <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15, marginBottom: 16 }}>✏️ Editar perfil público</div>

              <div style={{ marginBottom: 14 }}>
                <label style={LB}>Bio corta (visible a todos)</label>
                <textarea style={{ ...IS, minHeight: 72, resize: "vertical" }} value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Ej: Monitor FEP, 8 años de experiencia. Especialidad en técnica e iniciación infantil." />
              </div>

              <div className="tpG2" style={{ marginBottom: 20 }}>
                <div>
                  <label style={LB}>Zona / Club(s)</label>
                  <input style={IS} value={editZone} onChange={e => setEditZone(e.target.value)} placeholder="Ej: Málaga · Inacua · Vals" />
                </div>
                <div>
                  <label style={LB}>Precio base (€/clase)</label>
                  <input style={IS} type="number" value={editPriceBase} onChange={e => setEditPriceBase(e.target.value)} placeholder="Ej: 30" />
                </div>
              </div>

              {/* Especialidades en acordeón */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>🎯 Especialidades</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {editSpecialties.length > 0 && (
                      <span style={{ fontSize: 11, color: "#74B800", background: "rgba(116,184,0,0.15)", padding: "2px 9px", borderRadius: 999, fontWeight: 900 }}>
                        {editSpecialties.length} seleccionadas
                      </span>
                    )}
                    {editSpecialties.length > 0 && (
                      <button type="button" onClick={() => setEditSpecialties([])}
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}>
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "0 14px" }}>
                  {ALL_SPECIALTY_CATEGORIES.map(cat => (
                    <SpecCategory key={cat.id} cat={cat} selected={editSpecialties} onChange={setEditSpecialties} />
                  ))}
                </div>

                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
                  Abre cada sección y marca lo que aplica. Los alumnos podrán filtrar por estas especialidades.
                </div>
              </div>

              <button className="tpBtn tpPrimary" style={{ width: "100%", marginTop: 18 }} onClick={saveTeacherPublic} disabled={savingProfile}>
                {savingProfile ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          )}

          {/* NAV */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 24 }}>
            {!isMe && <button className="tpBtn tpGhost" style={{ fontSize: 12 }} onClick={() => navigate(`/clases?teacher=${id}`)}>🎾 Ver sus clases</button>}
            <button className="tpBtn tpGhost" style={{ fontSize: 12 }} onClick={() => navigate("/profesores")}>👨‍🏫 Lista de profes</button>
          </div>
        </div>
      </div>
    </div>
  );
}