// src/pages/TeacherProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

function isUuid(x = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x));
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

function fmtList(arr) {
  const list = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
  return list.length ? list.join(" · ") : "—";
}

const MODALITIES = [
  "Iniciación",
  "Técnica",
  "Competición",
  "Infantil",
  "Senior",
  "Rehabilitación",
  "Adaptada / Inclusiva",
];

const ADAPTATIONS = [
  "♿ Movilidad reducida (silla de ruedas)",
  "👁️ Discapacidad visual",
  "🧠 Neurodiversidad (TEA / TDAH)",
  "🧩 Discapacidad intelectual",
  "🤝 Síndrome de Down",
  "❤️‍🩹 Rehabilitación / vuelta tras lesión",
  "⏱️ Ritmo suave / baja intensidad",
];

const FORMATS = [
  "👤 Clase 1:1 (individual)",
  "👥 Clase para 2 personas",
];

export default function TeacherProfilePage() {
  const { id } = useParams(); // teacher_id
  const navigate = useNavigate();
  const toast = useToast();

  // Guard UUID
  useEffect(() => {
    if (!id) return;
    if (!isUuid(id)) {
      toast.error("Profesor no válido");
      navigate("/clases", { replace: true });
    }
  }, [id, navigate, toast]);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pub, setPub] = useState(null);

  // Favoritos
  const [favBusy, setFavBusy] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [notifyMorning, setNotifyMorning] = useState(true);
  const [notifyAfternoon, setNotifyAfternoon] = useState(true);

  // Editor (solo si soy ese profe)
  const isMe = useMemo(() => {
    const uid = session?.user?.id ? String(session.user.id) : "";
    return uid && id && uid === String(id);
  }, [session?.user?.id, id]);

  // Editor fields
  const [editBio, setEditBio] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editPriceBase, setEditPriceBase] = useState("");
  const [editTypes, setEditTypes] = useState("");
  const [editModalities, setEditModalities] = useState([]);
  const [editAdaptations, setEditAdaptations] = useState([]);
  const [editFormats, setEditFormats] = useState([]);

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
    if (!id) return;

    try {
      setLoading(true);

      // 1) profile
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (e1) throw e1;

      // 2) teacher_public
      const { data: tp, error: e2 } = await supabase
        .from("teacher_public")
        .select("teacher_id, bio, zone, price_base, class_types, modalities, adaptations, formats, updated_at")
        .eq("teacher_id", id)
        .maybeSingle();
      if (e2) throw e2;

      setProfile(prof || null);
      setPub(tp || null);

      // Prefill editor
      setEditBio(String(tp?.bio || ""));
      setEditZone(String(tp?.zone || ""));
      setEditPriceBase(tp?.price_base == null ? "" : String(tp.price_base));
      setEditTypes(Array.isArray(tp?.class_types) ? tp.class_types.join(", ") : "");

      setEditModalities(Array.isArray(tp?.modalities) ? tp.modalities : []);
      setEditAdaptations(Array.isArray(tp?.adaptations) ? tp.adaptations : []);
      setEditFormats(Array.isArray(tp?.formats) ? tp.formats : []);

      // 3) favorito del usuario
      const uid = session?.user?.id ? String(session.user.id) : "";
      if (uid) {
        const { data: favRow, error: e3 } = await supabase
          .from("teacher_favorites")
          .select("user_id, teacher_id, notify_morning, notify_afternoon, created_at")
          .eq("user_id", uid)
          .eq("teacher_id", id)
          .maybeSingle();
        if (e3) throw e3;

        if (favRow?.user_id) {
          setIsFav(true);
          setNotifyMorning(favRow.notify_morning !== false);
          setNotifyAfternoon(favRow.notify_afternoon !== false);
        } else {
          setIsFav(false);
          setNotifyMorning(true);
          setNotifyAfternoon(true);
        }
      }
    } catch (e) {
      console.error("TeacherProfile loadAll error:", e);
      toast.error(e?.message || "No se pudo cargar el perfil del profesor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, id, session?.user?.id]);

  async function toggleFavorite() {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid) return navigate("/login");

    try {
      setFavBusy(true);

      if (!isFav) {
        const { error } = await supabase.from("teacher_favorites").insert({
          user_id: uid,
          teacher_id: id,
          notify_morning: true,
          notify_afternoon: true,
        });
        if (error) throw error;

        setIsFav(true);
        setNotifyMorning(true);
        setNotifyAfternoon(true);
        toast.success("⭐ Añadido a favoritos");
      } else {
        const { error } = await supabase
          .from("teacher_favorites")
          .delete()
          .eq("user_id", uid)
          .eq("teacher_id", id);
        if (error) throw error;

        setIsFav(false);
        toast.success("Favorito eliminado");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo actualizar favorito");
    } finally {
      setFavBusy(false);
    }
  }

  async function saveFavPrefs(nextMorning, nextAfternoon) {
    const uid = session?.user?.id ? String(session.user.id) : "";
    if (!uid) return navigate("/login");
    if (!isFav) return;

    try {
      setFavBusy(true);

      const { error } = await supabase
        .from("teacher_favorites")
        .update({
          notify_morning: !!nextMorning,
          notify_afternoon: !!nextAfternoon,
        })
        .eq("user_id", uid)
        .eq("teacher_id", id);

      if (error) throw error;
    } catch (e) {
      toast.error(e?.message || "No se pudieron guardar las preferencias");
    } finally {
      setFavBusy(false);
    }
  }

  function toggleInArray(arr, value) {
    const v = String(value);
    const set = new Set((arr || []).map(String));
    if (set.has(v)) set.delete(v);
    else set.add(v);
    return Array.from(set);
  }

  async function saveTeacherPublic() {
    if (!isMe) return;

    try {
      setFavBusy(true);

      const typesArr = String(editTypes || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const n = editPriceBase === "" ? null : Number(editPriceBase);
      const priceBase = Number.isFinite(n) ? n : null;

      const payload = {
        teacher_id: id,
        bio: String(editBio || "").trim() || null,
        zone: String(editZone || "").trim() || null,
        price_base: priceBase,
        class_types: typesArr.length ? typesArr : null,

        modalities: (editModalities || []).length ? editModalities : null,
        adaptations: (editAdaptations || []).length ? editAdaptations : null,
        formats: (editFormats || []).length ? editFormats : null,
      };

      const { error } = await supabase.from("teacher_public").upsert(payload, {
        onConflict: "teacher_id",
      });
      if (error) throw error;

      toast.success("Perfil actualizado ✅");
      await loadAll();
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el perfil");
    } finally {
      setFavBusy(false);
    }
  }

  // Nombre robusto: name -> handle -> fallback
  const name =
    (profile?.name && String(profile.name).trim()) ||
    (profile?.handle && String(profile.handle).trim()) ||
    `Profe ${String(id || "").slice(0, 6)}…`;

  const avatar = profile?.avatar_url || "";
  const zone = pub?.zone || "—";
  const priceBase = pub?.price_base != null ? `${pub.price_base}€` : "—";
  const types = fmtList(pub?.class_types);
  const modalities = fmtList(pub?.modalities);
  const adaptations = fmtList(pub?.adaptations);
  const formats = fmtList(pub?.formats);

  function onToggleMorning() {
    const next = !notifyMorning;
    setNotifyMorning(next);
    saveFavPrefs(next, notifyAfternoon);
  }

  function onToggleAfternoon() {
    const next = !notifyAfternoon;
    setNotifyAfternoon(next);
    saveFavPrefs(notifyMorning, next);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div className="container">
            <div style={{ opacity: 0.8 }}>Cargando perfil…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
              ← Volver
            </button>

            <div style={{ textAlign: "right" }}>
              <div className="pageTitle" style={{ margin: 0 }}>Perfil del profesor</div>
              <div className="pageMeta" style={{ opacity: 0.75 }}>{zone !== "—" ? `📍 ${zone}` : ""}</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, borderRadius: 18 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {avatar ? (
                  <img src={avatar} alt={name} style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(0,0,0,0.06)", fontSize: 22 }}>
                    {initials(name)}
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 1000, fontSize: 20 }}>{name}</div>
                  <div style={{ marginTop: 6, opacity: 0.85, fontSize: 14 }}>
                    {pub?.bio ? pub.bio : "Sin bio todavía. (El profe puede completar su perfil)"}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13, opacity: 0.95 }}>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontWeight: 800 }}>
                      💶 Base: {priceBase}
                    </span>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontWeight: 800 }}>
                      🎯 Tipos: {types}
                    </span>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontWeight: 800 }}>
                      🧭 Modalidad: {modalities}
                    </span>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontWeight: 800 }}>
                      👥 Formatos: {formats}
                    </span>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontWeight: 800 }}>
                      ♿ Inclusión: {adaptations}
                    </span>
                  </div>
                </div>
              </div>

              {!isMe ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                  <button
                    type="button"
                    className={isFav ? "btn" : "btn ghost"}
                    onClick={toggleFavorite}
                    disabled={favBusy}
                    style={{ minWidth: 200, borderRadius: 14 }}
                  >
                    {favBusy ? "Guardando…" : isFav ? "⭐ En favoritos" : "☆ Añadir a favoritos"}
                  </button>

                  {isFav ? (
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
                        <input type="checkbox" checked={!!notifyMorning} onChange={onToggleMorning} disabled={favBusy} />
                        Mañana (06–14)
                      </label>

                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
                        <input type="checkbox" checked={!!notifyAfternoon} onChange={onToggleAfternoon} disabled={favBusy} />
                        Tarde (14–22)
                      </label>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.65, textAlign: "right" }}>
                      Añádelo a favoritos para recibir avisos cuando publique clases.
                    </div>
                  )}
                </div>
              ) : (
                <div className="gpBadge ok">🦍 Este perfil es tuyo</div>
              )}
            </div>
          </div>

          {/* Editor pro */}
          {isMe ? (
            <div className="card" style={{ marginTop: 14, borderRadius: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Editar perfil público</div>

              <div style={{ marginTop: 12 }}>
                <label className="gpLabel">Bio (corta)</label>
                <textarea
                  className="gpInput"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  style={{ resize: "vertical" }}
                  placeholder="Ej: técnica, iniciación, alto nivel…"
                />
              </div>

              <div className="gpGrid2" style={{ marginTop: 12 }}>
                <div>
                  <label className="gpLabel">Zona (puedes poner varias: “Málaga · Teatinos / Inacua / Vals”)</label>
                  <input className="gpInput" value={editZone} onChange={(e) => setEditZone(e.target.value)} placeholder="Ej: Málaga · Teatinos / Inacua / Vals" />
                </div>

                <div>
                  <label className="gpLabel">Precio base</label>
                  <input className="gpInput" type="number" value={editPriceBase} onChange={(e) => setEditPriceBase(e.target.value)} placeholder="Ej: 30" />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="gpLabel">Tipos de clase (coma)</label>
                  <input className="gpInput" value={editTypes} onChange={(e) => setEditTypes(e.target.value)} placeholder="Ej: iniciación, técnica, alto nivel" />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="gpLabel" style={{ marginBottom: 8 }}>Modalidad</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {MODALITIES.map((m) => {
                    const active = (editModalities || []).includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        className={active ? "btn" : "btn ghost"}
                        style={{ borderRadius: 999 }}
                        onClick={() => setEditModalities((p) => toggleInArray(p, m))}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="gpLabel" style={{ marginBottom: 8 }}>Formatos</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {FORMATS.map((f) => {
                    const active = (editFormats || []).includes(f);
                    return (
                      <label key={f} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => setEditFormats((p) => toggleInArray(p, f))}
                        />
                        {f}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="gpLabel" style={{ marginBottom: 8 }}>Inclusión / Adaptaciones</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {ADAPTATIONS.map((a) => {
                    const active = (editAdaptations || []).includes(a);
                    return (
                      <label key={a} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => setEditAdaptations((p) => toggleInArray(p, a))}
                        />
                        {a}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="gpRow" style={{ marginTop: 14 }}>
                <button type="button" className="btn" onClick={saveTeacherPublic} disabled={favBusy}>
                  {favBusy ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn ghost" onClick={() => navigate(`/clases?teacher=${id}`)}>
              Ver sus clases
            </button>
            <button type="button" className="btn ghost" onClick={() => navigate("/profesores")}>
              Ver lista de profes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
