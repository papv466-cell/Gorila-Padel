// src/pages/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map((p) => p[0].toUpperCase()).join("");
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const favRef = useRef(null);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({
    name: "",
    handle: "",
    sex: "X",
    level: "medio",
    handedness: "right",
    birthdate: "",
    avatar_url: "",
  });

  const defaultAvatarUrl = useMemo(() => {
    if (form.sex === "F") return "/avatars/gorila-f.png";
    if (form.sex === "M") return "/avatars/gorila-m.png";
    return "/avatars/gorila-o.png";
  }, [form.sex]);

  const shownAvatar = (form.avatar_url || "").trim() || defaultAvatarUrl;

  const [favLoading, setFavLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);

  async function loadFavorites(uid) {
    if (!uid) {
      setFavorites([]);
      return;
    }

    try {
      setFavLoading(true);

      const { data: favs, error: e1 } = await supabase
        .from("teacher_favorites")
        .select("teacher_id, notify_morning, notify_afternoon, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (e1) throw e1;

      const favRows = Array.isArray(favs) ? favs : [];
      if (!favRows.length) {
        setFavorites([]);
        return;
      }

      const ids = favRows.map((f) => String(f.teacher_id)).filter(Boolean);

      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url")
        .in("id", ids);

      if (e2) throw e2;

      const { data: pubs, error: e3 } = await supabase
        .from("teacher_public")
        .select("teacher_id, zone, price_base")
        .in("teacher_id", ids);

      if (e3) throw e3;

      const mapProf = {};
      for (const p of profs || []) mapProf[String(p.id)] = p;

      const mapPub = {};
      for (const t of pubs || []) mapPub[String(t.teacher_id)] = t;

      const enriched = favRows.map((f) => {
        const tid = String(f.teacher_id);
        return {
          teacher_id: tid,
          notify_morning: f.notify_morning !== false,
          notify_afternoon: f.notify_afternoon !== false,
          created_at: f.created_at,
          prof: mapProf[tid] || null,
          pub: mapPub[tid] || null,
        };
      });

      setFavorites(enriched);
    } catch (e) {
      console.error("loadFavorites error:", e);
      toast?.error?.(e?.message || "No se pudieron cargar favoritos");
      setFavorites([]);
    } finally {
      setFavLoading(false);
    }
  }

  async function setFavPrefs(teacherId, nextMorning, nextAfternoon) {
    if (!session?.user?.id) return;

    try {
      setFavLoading(true);

      const { error } = await supabase
        .from("teacher_favorites")
        .update({
          notify_morning: !!nextMorning,
          notify_afternoon: !!nextAfternoon,
        })
        .eq("user_id", session.user.id)
        .eq("teacher_id", teacherId);

      if (error) throw error;

      setFavorites((prev) =>
        prev.map((x) =>
          x.teacher_id === teacherId
            ? { ...x, notify_morning: !!nextMorning, notify_afternoon: !!nextAfternoon }
            : x
        )
      );
    } catch (e) {
      toast?.error?.(e?.message || "No se pudieron guardar preferencias");
    } finally {
      setFavLoading(false);
    }
  }

  async function removeFavorite(teacherId) {
    if (!session?.user?.id) return;

    const ok = confirm("¿Quitar este profesor de favoritos?");
    if (!ok) return;

    try {
      setFavLoading(true);

      const { error } = await supabase
        .from("teacher_favorites")
        .delete()
        .eq("user_id", session.user.id)
        .eq("teacher_id", teacherId);

      if (error) throw error;

      setFavorites((prev) => prev.filter((x) => x.teacher_id !== teacherId));
      toast?.success?.("Favorito eliminado");
    } catch (e) {
      toast?.error?.(e?.message || "No se pudo eliminar");
    } finally {
      setFavLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = data?.session ?? null;
      setSession(s);

      if (!s?.user) {
        navigate("/login", { replace: true });
        return;
      }

      (async () => {
        try {
          setLoading(true);
          setErr(null);

          const { data: prof, error } = await supabase
            .from("profiles")
            .select("name, handle, sex, level, handedness, birthdate, avatar_url")
            .eq("id", s.user.id)
            .maybeSingle();

          if (error) throw error;

          const handle = prof?.handle ?? "";
          const name = (prof?.name ?? "").trim() || handle;

          setForm({
            name,
            handle,
            sex: prof?.sex ?? "X",
            level: prof?.level ?? "medio",
            handedness: prof?.handedness ?? "right",
            birthdate: prof?.birthdate ?? "",
            avatar_url: prof?.avatar_url ?? "",
          });

          await loadFavorites(s.user.id);
        } catch (e) {
          setErr(e?.message || "No se pudo cargar el perfil");
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => {
      alive = false;
    };
  }, [navigate, toast]);

  async function save(payloadOverride = null) {
    if (!session?.user) {
      console.log("❌ No hay sesión");
      return;
    }
  
    setErr(null);
  
    const cleanHandle = String(form.handle || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^\@+/, "");
  
    const cleanName = String(form.name || "")
      .trim()
      .replace(/\s+/g, " ");
  
    console.log("📝 Guardando:", { cleanName, cleanHandle, birthdate: form.birthdate });
  
    if (!cleanHandle && !cleanName) {
      setErr("Debes poner al menos un nombre o apodo.");
      console.log("❌ Faltan nombre y handle");
      return;
    }
  
    const finalHandle = cleanHandle || cleanName.toLowerCase().replace(/\s+/g, "");
    const finalName = cleanName || cleanHandle;
  
    // ⭐ Limpiar fecha de nacimiento
    const cleanBirthdate = form.birthdate && String(form.birthdate).trim() 
      ? String(form.birthdate).trim() 
      : null;
  
    const payload = {
      id: session.user.id,
      name: finalName,
      handle: finalHandle,
      sex: form.sex,
      level: form.level,
      handedness: form.handedness,
      birthdate: cleanBirthdate, // ⭐ Usar fecha limpia
      avatar_url: (form.avatar_url || "").trim() || defaultAvatarUrl,
      ...(payloadOverride || {})
    };
  
    console.log("📦 Payload completo:", payload);
  
    try {
      setSaving(true);
  
      console.log("1️⃣ Actualizando profiles...");
      const { data: data1, error: err1 } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: 'id' });
  
      console.log("✅ profiles response:", { data: data1, error: err1 });
      if (err1) throw err1;
  
      console.log("2️⃣ Actualizando profiles_public...");
      const { data: data2, error: err2 } = await supabase
        .from("profiles_public")
        .upsert({
          id: session.user.id,
          name: payload.name,
          handle: payload.handle,
          avatar_url: payload.avatar_url,
        }, { onConflict: 'id' });
  
      console.log("✅ profiles_public response:", { data: data2, error: err2 });
      if (err2) throw err2;
  
      setForm((p) => ({
        ...p,
        name: finalName,
        handle: finalHandle,
        birthdate: cleanBirthdate,
        avatar_url: payload.avatar_url
      }));
  
      console.log("🎉 Guardado exitoso!");
      toast?.success?.("Perfil guardado ✅");
    } catch (e) {
      console.error("❌ Error al guardar:", e);
      const msg = e?.message || "No se pudo guardar";
      setErr(msg);
      toast?.error?.(msg);
    } finally {
      setSaving(false);
    }
  }
  function useDefaultGorilla() {
    setForm((p) => ({ ...p, avatar_url: defaultAvatarUrl }));
    toast?.info?.("Avatar gorila aplicado. Dale a Guardar.");
  }

  async function uploadAvatarFile(file) {
    if (!session?.user?.id) return;
    if (!file) return;

    const isImage = file.type?.startsWith("image/");
    if (!isImage) {
      toast?.error?.("Sube una imagen (JPG/PNG/WebP).");
      return;
    }

    const maxMb = 5;
    if (file.size > maxMb * 1024 * 1024) {
      toast?.error?.(`Máximo ${maxMb}MB.`);
      return;
    }

    try {
      setUploading(true);
      setErr(null);

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${session.user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = pub?.publicUrl;

      if (!publicUrl) throw new Error("No se pudo obtener la URL pública.");

      setForm((p) => ({ ...p, avatar_url: publicUrl }));

      await save({
        name: String(form.name || "").trim().replace(/\s+/g, " ") || String(form.handle || "").trim(),
        handle: String(form.handle || "").trim().replace(/\s+/g, " ").replace(/^\@+/, ""),
        sex: form.sex,
        level: form.level,
        handedness: form.handedness,
        birthdate: form.birthdate || null,
        avatar_url: publicUrl,
      });

      toast?.success?.("Foto subida ✅");
    } catch (e) {
      const msg = e?.message || "Error subiendo la foto";
      setErr(msg);
      toast?.error?.(msg);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="pageWrap">
          <div className="container">Cargando perfil…</div>
        </div>
      </div>
    );
  }

  const favCountLabel = favLoading ? "(…)" : favorites.length ? `(${favorites.length})` : "";

    return (
      <div className="page pageWithHeader">
        <div className="pageWrap">
          <div className="container" style={{ padding: '0 16px' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 950, marginBottom: 4 }}>Perfil</h1>
                <div style={{ fontSize: 14, opacity: 0.75 }}>Tu información de Gorila Pádel</div>
              </div>
  
              <button
                type="button"
                className="btn ghost"
                onClick={() => favRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                ⭐ Mis favoritos {favCountLabel}
              </button>
            </div>

          <div className="card" style={{ maxWidth: 720, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <img
                src={shownAvatar}
                alt="Avatar"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 18,
                  objectFit: "cover",
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(0,0,0,0.04)",
                }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {String(form.name || "").trim() || String(form.handle || "").trim() || "—"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{session?.user?.email}</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <label className="btn ghost" style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
                    {uploading ? "Subiendo…" : "📸 Subir foto"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        uploadAvatarFile(f);
                      }}
                    />
                  </label>

                  <button type="button" className="btn ghost" onClick={useDefaultGorilla} disabled={uploading}>
                    🦍 Usar gorila
                  </button>
                </div>
              </div>
            </div>

            <div className="gpGrid2" style={{ marginTop: 14 }}>
              <div>
                <label className="gpLabel">Nombre (visible)</label>
                <input
                  className="gpInput"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="gpLabel">Apodo</label>
                <input
                  className="gpInput"
                  value={form.handle}
                  onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))}
                  placeholder="Ej: juanp"
                />
              </div>

              <div>
                <label className="gpLabel">Sexo</label>
                <select className="gpInput" value={form.sex} onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value }))}>
                  <option value="F">Mujer</option>
                  <option value="M">Hombre</option>
                  <option value="X">Otro</option>
                </select>
              </div>

              <div>
                <label className="gpLabel">Mano</label>
                <select className="gpInput" value={form.handedness} onChange={(e) => setForm((p) => ({ ...p, handedness: e.target.value }))}>
                  <option value="right">Derecha</option>
                  <option value="left">Izquierda</option>
                  <option value="both">Ambas</option>
                </select>
              </div>

              <div>
                <label className="gpLabel">Nivel</label>
                <select className="gpInput" value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}>
                  <option value="iniciacion">Iniciación</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>

              <div>
                <label className="gpLabel">Cumpleaños (opcional)</label>
                <input 
                  className="gpInput" 
                  type="date" 
                  value={form.birthdate || ""} 
                  onChange={(e) => setForm((p) => ({ ...p, birthdate: e.target.value }))}
                  placeholder=""
                />
              </div>
            </div>

            {err ? <div style={{ marginTop: 10, color: "crimson", fontWeight: 700 }}>{err}</div> : null}

            <div className="gpRow" style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => save()} disabled={saving || uploading}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button className="btn ghost" onClick={() => navigate(-1)} disabled={saving || uploading}>
                Volver
              </button>
            </div>
          </div>

          <div ref={favRef} className="card" style={{ maxWidth: 720, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>⭐ Mis profes favoritos</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Gestiona avisos por franja.</div>
              </div>

              <button className="btn ghost" onClick={() => loadFavorites(session?.user?.id)} disabled={favLoading}>
                {favLoading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>

            {favLoading ? (
              <div style={{ marginTop: 12, opacity: 0.75 }}>Cargando favoritos…</div>
            ) : favorites.length === 0 ? (
              <div style={{ marginTop: 12, opacity: 0.75 }}>
                Aún no tienes favoritos.
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {favorites.map((f) => {
                  const teacherName =
                    (f.prof?.name && String(f.prof.name).trim()) ||
                    (f.prof?.handle && String(f.prof.handle).trim()) ||
                    `Profe ${String(f.teacher_id).slice(0, 6)}…`;

                  const avatar = f.prof?.avatar_url || "";
                  const zone = f.pub?.zone || "—";
                  const price = f.pub?.price_base != null ? `${f.pub.price_base}€` : "—";

                  return (
                    <div key={f.teacher_id} className="card" style={{ margin: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {avatar ? (
                            <img src={avatar} alt={teacherName} style={{ width: 46, height: 46, borderRadius: 999, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(0,0,0,0.06)" }}>
                              {initials(teacherName)}
                            </div>
                          )}

                          <div>
                            <div style={{ fontWeight: 950 }}>{teacherName}</div>
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                              📍 {zone} · 💶 {price}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={!!f.notify_morning}
                              onChange={() => setFavPrefs(f.teacher_id, !f.notify_morning, f.notify_afternoon)}
                              disabled={favLoading}
                            />
                            Mañana
                          </label>

                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={!!f.notify_afternoon}
                              onChange={() => setFavPrefs(f.teacher_id, f.notify_morning, !f.notify_afternoon)}
                              disabled={favLoading}
                            />
                            Tarde
                          </label>

                          <button className="btn ghost" onClick={() => navigate(`/profesores/${f.teacher_id}`)}>
                            Ver
                          </button>

                          <button className="btn ghost" onClick={() => removeFavorite(f.teacher_id)} disabled={favLoading}>
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
