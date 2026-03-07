// src/pages/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import PlayerStats from "../components/PlayerStats";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import XPBar from "../components/XPBar";

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map((p) => p[0].toUpperCase()).join("");
}

const ALL_BADGES = [
  { key: "first_match",     label: "Primer Saque",   emoji: "🎾", desc: "Jugaste tu primer partido",          check: s => s.matches_played >= 1 },
  { key: "five_matches",    label: "En Racha",        emoji: "🔥", desc: "Has jugado 5 partidos",             check: s => s.matches_played >= 5 },
  { key: "ten_matches",     label: "Veterano",        emoji: "🦍", desc: "Has jugado 10 partidos",            check: s => s.matches_played >= 10 },
  { key: "twenty_matches",  label: "Gorila Pro",      emoji: "👑", desc: "Has jugado 20 partidos",            check: s => s.matches_played >= 20 },
  { key: "fifty_matches",   label: "Leyenda Gorila",  emoji: "🏆", desc: "Has jugado 50 partidos",            check: s => s.matches_played >= 50 },
  { key: "hundred_matches", label: "100 Partidos",    emoji: "💯", desc: "100 partidos jugados",              check: s => s.matches_played >= 100 },
  { key: "clean_sheet",     label: "Tarjeta Limpia",  emoji: "✅", desc: "0 tarjetas rojas con 3+ partidos",  check: s => s.matches_played >= 3 && s.red_cards === 0 },
  { key: "fair_play_king",  label: "Fair Play",       emoji: "🤝", desc: "0 tarjetas rojas con 20+ partidos", check: s => s.matches_played >= 20 && s.red_cards === 0 },
  { key: "top_rated",       label: "Top Valorado",    emoji: "⭐", desc: "Valoracion media >= 4.5",           check: s => s.avg_rating >= 4.5 && s.rating_count >= 3 },
  { key: "perfect_score",   label: "Perfecto",        emoji: "💎", desc: "Valoracion media 5.0",             check: s => s.avg_rating >= 5.0 && s.rating_count >= 5 },
  { key: "social",          label: "Sociable",        emoji: "😄", desc: "Recibiste 10 valoraciones",         check: s => s.rating_count >= 10 },
  { key: "influencer",      label: "Influencer",      emoji: "📣", desc: "Recibiste 25 valoraciones",         check: s => s.rating_count >= 25 },
  { key: "organizer",       label: "Organizador",     emoji: "📋", desc: "Creaste 5 partidos",               check: s => s.created_count >= 5 },
  { key: "super_organizer", label: "Super Org.",      emoji: "🗓️", desc: "Creaste 20 partidos",              check: s => s.created_count >= 20 },
  { key: "sos_hero",        label: "Heroe SOS",       emoji: "🆘", desc: "Respondiste a un SOS",             check: s => s.sos_count >= 1 },
  { key: "sos_legend",      label: "Leyenda SOS",     emoji: "🚨", desc: "Respondiste a 5 SOS",              check: s => s.sos_count >= 5 },
  { key: "explorer",        label: "Explorador",      emoji: "🗺️", desc: "Jugaste en 3 clubs distintos",     check: s => s.clubs_count >= 3 },
  { key: "globetrotter",    label: "Trotamundos",     emoji: "✈️", desc: "Jugaste en 10 clubs distintos",    check: s => s.clubs_count >= 10 },
  { key: "booker",          label: "Reservon",        emoji: "📅", desc: "Hiciste tu primera reserva",       check: s => s.bookings_count >= 1 },
  { key: "regular",         label: "Regular",         emoji: "🏠", desc: "10 reservas en el mismo club",     check: s => s.same_club_bookings >= 10 },
];

function computeBadges(stats) {
  return ALL_BADGES.map(b => ({ ...b, earned: b.check(stats) }));
}

export default function ProfilePage({ session: sessionProp }) {
  const navigate = useNavigate();
  const toast = useToast();
  const favRef = useRef(null);
  const statsRef = useRef(null);
  const session = sessionProp ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({ name: "", handle: "", sex: "X", level: "medio", handedness: "right", birthdate: "", avatar_url: "", sos_enabled: false, sos_radius_km: 50, notify_morning: false, notify_afternoon: false, followed_clubs: [] });
  const [stats, setStats] = useState({ matches_played: 0, red_cards: 0, avg_rating: 0, rating_count: 0 });
  const [ratings, setRatings] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [clubsSheet, setClubsSheet] = useState([]);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [clubSearchQ, setClubSearchQ] = useState("");
  const [favorites, setFavorites] = useState([]);

  const defaultAvatarUrl = useMemo(() => {
    if (form.sex === "F") return "/avatars/gorila-f.png";
    if (form.sex === "M") return "/avatars/gorila-m.png";
    return "/avatars/gorila-o.png";
  }, [form.sex]);

  const shownAvatar = (form.avatar_url || "").trim() || defaultAvatarUrl;
  const badges = useMemo(() => computeBadges(stats), [stats]);
  const earnedBadges = badges.filter(b => b.earned);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadExtraStats(session.user.id);
  }, [session?.user?.id]);

  async function loadExtraStats(userId) {
    try {
      const { data: clubMatches } = await supabase.from("match_players").select("matches(club_id)").eq("player_uuid", userId);
      const uniqueClubs = new Set((clubMatches || []).map(r => r.matches?.club_id).filter(Boolean));
      const { data: bookings } = await supabase.from("court_bookings").select("club_id").eq("user_id", userId);
      const clubBookingCounts = {};
      (bookings || []).forEach(b => { clubBookingCounts[b.club_id] = (clubBookingCounts[b.club_id] || 0) + 1; });
      const maxSameClub = Math.max(...Object.values(clubBookingCounts), 0);
      const { data: created } = await supabase.from("matches").select("id", { count: "exact" }).eq("created_by_user", userId);
      setStats(prev => ({ ...prev, clubs_count: uniqueClubs.size, bookings_count: (bookings || []).length, same_club_bookings: maxSameClub, created_count: (created || []).length, sos_count: 0 }));
    } catch (e) { console.error(e); }
  }

  async function loadStats(uid) {
    try {
      const { data: pub } = await supabase.from("profiles_public").select("red_cards, matches_played").eq("id", uid).maybeSingle();
      const { data: ratingRows } = await supabase.from("player_ratings").select("rating, vibe, from_user_id, created_at").eq("to_user_id", uid).order("created_at", { ascending: false }).limit(20);
      const rows = Array.isArray(ratingRows) ? ratingRows : [];
      const avg = rows.length ? rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length : 0;
      setStats(prev => ({ ...prev, matches_played: Number(pub?.matches_played) || 0, red_cards: Number(pub?.red_cards) || 0, avg_rating: avg, rating_count: rows.length }));
      setRatings(rows);
    } catch (e) { console.error("loadStats error:", e); }
  }

  async function loadFavorites(uid) {
    if (!uid) { setFavorites([]); return; }
    try {
      setFavLoading(true);
      const { data: favs, error: e1 } = await supabase.from("teacher_favorites").select("teacher_id, notify_morning, notify_afternoon, created_at").eq("user_id", uid).order("created_at", { ascending: false });
      if (e1) throw e1;
      const favRows = Array.isArray(favs) ? favs : [];
      if (!favRows.length) { setFavorites([]); return; }
      const ids = favRows.map(f => String(f.teacher_id)).filter(Boolean);
      const { data: profs } = await supabase.from("profiles").select("id,name,handle,avatar_url").in("id", ids);
      const { data: pubs } = await supabase.from("teacher_public").select("teacher_id,zone,price_base").in("teacher_id", ids);
      const mapProf = {}; for (const p of profs || []) mapProf[String(p.id)] = p;
      const mapPub = {}; for (const t of pubs || []) mapPub[String(t.teacher_id)] = t;
      setFavorites(favRows.map(f => { const tid = String(f.teacher_id); return { teacher_id: tid, notify_morning: f.notify_morning !== false, notify_afternoon: f.notify_afternoon !== false, created_at: f.created_at, prof: mapProf[tid] || null, pub: mapPub[tid] || null }; }));
    } catch (e) { toast?.error?.(e?.message || "No se pudieron cargar favoritos"); setFavorites([]); }
    finally { setFavLoading(false); }
  }

  async function setFavPrefs(teacherId, nextMorning, nextAfternoon) {
    if (!session?.user?.id) return;
    try {
      setFavLoading(true);
      const { error } = await supabase.from("teacher_favorites").update({ notify_morning: !!nextMorning, notify_afternoon: !!nextAfternoon }).eq("user_id", session.user.id).eq("teacher_id", teacherId);
      if (error) throw error;
      setFavorites(prev => prev.map(x => x.teacher_id === teacherId ? { ...x, notify_morning: !!nextMorning, notify_afternoon: !!nextAfternoon } : x));
    } catch (e) { toast?.error?.(e?.message || "Error"); } finally { setFavLoading(false); }
  }

  async function removeFavorite(teacherId) {
    if (!session?.user?.id) return;
    if (!confirm("Quitar este profesor de favoritos?")) return;
    try {
      setFavLoading(true);
      const { error } = await supabase.from("teacher_favorites").delete().eq("user_id", session.user.id).eq("teacher_id", teacherId);
      if (error) throw error;
      setFavorites(prev => prev.filter(x => x.teacher_id !== teacherId));
      toast?.success?.("Favorito eliminado");
    } catch (e) { toast?.error?.(e?.message || "No se pudo eliminar"); } finally { setFavLoading(false); }
  }

  useEffect(() => {
    if (!session?.user) { navigate("/login", { replace: true }); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const { data: prof, error } = await supabase.from("profiles").select("name,handle,sex,level,handedness,birthdate,avatar_url,sos_enabled,sos_radius_km,notify_morning,notify_afternoon,followed_clubs").eq("id", session.user.id).maybeSingle();
        if (error) throw error;
        const handle = prof?.handle ?? "";
        const name = (prof?.name ?? "").trim() || handle;
        if (!alive) return;
        setForm({ name, handle, sex: prof?.sex ?? "X", level: prof?.level ?? "medio", handedness: prof?.handedness ?? "right", birthdate: prof?.birthdate ?? "", avatar_url: prof?.avatar_url ?? "", sos_enabled: prof?.sos_enabled ?? false, sos_radius_km: prof?.sos_radius_km ?? 50, notify_morning: prof?.notify_morning ?? false, notify_afternoon: prof?.notify_afternoon ?? false, followed_clubs: prof?.followed_clubs ?? [] });
        await Promise.all([loadFavorites(session.user.id), loadStats(session.user.id)]);
        fetchClubsFromGoogleSheet().then(r => setClubsSheet(Array.isArray(r) ? r : [])).catch(() => {});
        supabase.from("club_admins").select("id").eq("user_id", session.user.id).eq("status", "approved").maybeSingle().then(({ data }) => { if (alive) setIsClubAdmin(!!data); });
      } catch (e) { if (alive) setErr(e?.message || "No se pudo cargar el perfil"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(payloadOverride = null) {
    if (!session?.user) return;
    setErr(null);
    const cleanHandle = String(form.handle || "").trim().replace(/\s+/g, " ").replace(/^\@+/, "");
    const cleanName = String(form.name || "").trim().replace(/\s+/g, " ");
    if (!cleanHandle && !cleanName) { setErr("Debes poner al menos un nombre o apodo."); return; }
    const finalHandle = cleanHandle || cleanName.toLowerCase().replace(/\s+/g, "");
    const finalName = cleanName || cleanHandle;
    const cleanBirthdate = form.birthdate && String(form.birthdate).trim() ? String(form.birthdate).trim() : null;
    const payload = { id: session.user.id, name: finalName, handle: finalHandle, sex: form.sex, level: form.level, handedness: form.handedness, birthdate: cleanBirthdate, avatar_url: (form.avatar_url || "").trim() || defaultAvatarUrl, sos_enabled: form.sos_enabled ?? false, sos_radius_km: form.sos_radius_km ?? 50, notify_morning: form.notify_morning ?? false, notify_afternoon: form.notify_afternoon ?? false, followed_clubs: form.followed_clubs ?? [], ...(payloadOverride || {}) };
    try {
      setSaving(true);
      const { error: err1 } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (err1) throw err1;
      const { error: err2 } = await supabase.from("profiles_public").upsert({ id: session.user.id, name: payload.name, handle: payload.handle, avatar_url: payload.avatar_url }, { onConflict: "id" });
      if (err2) throw err2;
      setForm(p => ({ ...p, name: finalName, handle: finalHandle, birthdate: cleanBirthdate, avatar_url: payload.avatar_url }));
      toast?.success?.("Perfil guardado");
    } catch (e) { const msg = e?.message || "No se pudo guardar"; setErr(msg); toast?.error?.(msg); }
    finally { setSaving(false); }
  }

  function useDefaultGorilla() {
    setForm(p => ({ ...p, avatar_url: defaultAvatarUrl }));
    toast?.info?.("Avatar gorila aplicado. Dale a Guardar.");
  }

  async function uploadAvatarFile(file) {
    if (!session?.user?.id || !file) return;
    if (!file.type?.startsWith("image/")) { toast?.error?.("Sube una imagen (JPG/PNG/WebP)."); return; }
    if (file.size > 5 * 1024 * 1024) { toast?.error?.("Maximo 5MB."); return; }
    try {
      setUploading(true); setErr(null);
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("No se pudo obtener la URL publica.");
      setForm(p => ({ ...p, avatar_url: publicUrl }));
      await save({ name: String(form.name || "").trim() || String(form.handle || "").trim(), handle: String(form.handle || "").trim().replace(/^\@+/, ""), sex: form.sex, level: form.level, handedness: form.handedness, birthdate: form.birthdate || null, avatar_url: publicUrl });
      toast?.success?.("Foto subida");
    } catch (e) { const msg = e?.message || "Error subiendo la foto"; setErr(msg); toast?.error?.(msg); }
    finally { setUploading(false); }
  }

  if (!session) return null;

  if (loading) return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <div className="pageWrap"><div className="container" style={{ color: "rgba(255,255,255,0.5)", padding: 40, textAlign: "center" }}>Cargando perfil...</div></div>
    </div>
  );

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        .pfSection { background: #111; border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 18px; margin-bottom: 12px; }
        .pfLabel { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: .04em; display: block; margin-bottom: 5px; }
        .pfInput { width: 100%; padding: 10px 12px; border-radius: 9px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; box-sizing: border-box; }
        .pfInput:focus { outline: none; border-color: #74B800; }
        .pfGrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media(max-width:480px) { .pfGrid2 { grid-template-columns: 1fr; } }
        .pfBtn { padding: 11px 18px; border-radius: 10px; font-weight: 900; font-size: 13px; cursor: pointer; border: none; }
        .pfBtnPrimary { background: linear-gradient(135deg,#74B800,#9BE800); color: #000; }
        .pfBtnGhost { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15) !important; }
        .statBox { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.07); }
        .badgePill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ padding: "0 16px", maxWidth: 680, margin: "0 auto" }}>

          <div style={{ padding: "14px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>Mi Perfil</h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{session?.user?.email}</div>
            </div>
            <button className="pfBtn pfBtnGhost" onClick={() => statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Mis stats
            </button>
          </div>

          {/* XP BAR - nivel, racha y logros */}
          <XPBar userId={session?.user?.id} />

          <div className="pfSection">
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={shownAvatar} alt="Avatar" style={{ width: 76, height: 76, borderRadius: 20, objectFit: "cover", border: "2px solid rgba(116,184,0,0.4)", background: "rgba(255,255,255,0.05)" }} />
                {stats.red_cards >= 3 && <div style={{ position: "absolute", top: -6, right: -6, fontSize: 16 }}>🟥</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: "#fff" }}>{String(form.name || "").trim() || String(form.handle || "").trim() || "—"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>@{form.handle || "—"} · {form.level}</div>
                {earnedBadges.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {earnedBadges.slice(0, 3).map(b => <span key={b.key} title={b.desc} style={{ fontSize: 16 }}>{b.emoji}</span>)}
                    {earnedBadges.length > 3 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", alignSelf: "center" }}>+{earnedBadges.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <label className="pfBtn pfBtnGhost" style={{ cursor: uploading ? "not-allowed" : "pointer", fontSize: 12 }}>
                {uploading ? "Subiendo..." : "Subir foto"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; uploadAvatarFile(f); }} />
              </label>
              <button className="pfBtn pfBtnGhost" style={{ fontSize: 12 }} onClick={useDefaultGorilla} disabled={uploading}>Usar gorila</button>
            </div>

            <div className="pfGrid2">
              <div><label className="pfLabel">Nombre (visible)</label><input className="pfInput" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Juan Perez" /></div>
              <div><label className="pfLabel">Apodo</label><input className="pfInput" value={form.handle} onChange={e => setForm(p => ({ ...p, handle: e.target.value }))} placeholder="Ej: juanp" /></div>
              <div>
                <label className="pfLabel">Sexo</label>
                <select className="pfInput" value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}>
                  <option value="F" style={{ background: "#1a1a1a" }}>Mujer</option>
                  <option value="M" style={{ background: "#1a1a1a" }}>Hombre</option>
                  <option value="X" style={{ background: "#1a1a1a" }}>Otro</option>
                </select>
              </div>
              <div>
                <label className="pfLabel">Mano</label>
                <select className="pfInput" value={form.handedness} onChange={e => setForm(p => ({ ...p, handedness: e.target.value }))}>
                  <option value="right" style={{ background: "#1a1a1a" }}>Derecha</option>
                  <option value="left" style={{ background: "#1a1a1a" }}>Izquierda</option>
                  <option value="both" style={{ background: "#1a1a1a" }}>Ambas</option>
                </select>
              </div>
              <div>
                <label className="pfLabel">Nivel</label>
                <select className="pfInput" value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}>
                  <option value="iniciacion" style={{ background: "#1a1a1a" }}>Iniciacion</option>
                  <option value="medio" style={{ background: "#1a1a1a" }}>Medio</option>
                  <option value="alto" style={{ background: "#1a1a1a" }}>Alto</option>
                </select>
              </div>
              <div><label className="pfLabel">Cumpleanos (opcional)</label><input className="pfInput" type="date" value={form.birthdate || ""} onChange={e => setForm(p => ({ ...p, birthdate: e.target.value }))} /></div>
              <div className="pfField">
                <label className="pfLabel">SOS - Avisos de partidos</label>
                <div onClick={() => setForm(p => ({ ...p, sos_enabled: !p.sos_enabled }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: form.sos_enabled ? "1px solid rgba(116,184,0,0.4)" : "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
                  <div style={{ width: 44, height: 24, borderRadius: 999, background: form.sos_enabled ? "#74B800" : "rgba(255,255,255,0.15)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: form.sos_enabled ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{form.sos_enabled ? "Activado" : "Desactivado"}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Recibe avisos cuando falta 1 jugador</div>
                  </div>
                </div>
              </div>
              {form.sos_enabled && (
                <div className="pfField">
                  <label className="pfLabel">Radio SOS: <span style={{ color: "#74B800", fontWeight: 900 }}>{form.sos_radius_km} km</span></label>
                  <input type="range" min={5} max={200} step={5} value={form.sos_radius_km || 50} onChange={e => setForm(p => ({ ...p, sos_radius_km: Number(e.target.value) }))} style={{ width: "100%", accentColor: "#74B800", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}><span>5 km</span><span>50 km</span><span>100 km</span><span>200 km</span></div>
                </div>
              )}
              <div className="pfField">
                <label className="pfLabel">Notificaciones de partidos</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: "notify_morning", label: "Manana", sub: "Antes de las 14h" }, { key: "notify_afternoon", label: "Tarde", sub: "Despues de las 14h" }].map(({ key, label, sub }) => (
                    <div key={key} onClick={() => setForm(p => ({ ...p, [key]: !p[key] }))} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: form[key] ? "rgba(116,184,0,0.12)" : "rgba(255,255,255,0.04)", border: form[key] ? "1px solid rgba(116,184,0,0.4)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: form[key] ? "#74B800" : "#fff" }}>{label}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pfField">
                <label className="pfLabel">Clubs que sigues</label>
                <input placeholder="Buscar club..." value={clubSearchQ} onChange={e => setClubSearchQ(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
                {(form.followed_clubs || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {(form.followed_clubs || []).map(c => (
                      <div key={c} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(116,184,0,0.15)", border: "1px solid rgba(116,184,0,0.3)", color: "#74B800", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {c}<span onClick={() => setForm(p => ({ ...p, followed_clubs: (p.followed_clubs || []).filter(x => x !== c) }))} style={{ cursor: "pointer", opacity: 0.6, fontSize: 11 }}>x</span>
                      </div>
                    ))}
                  </div>
                )}
                {clubSearchQ.length >= 2 && (
                  <div style={{ background: "#1a1a1a", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", maxHeight: 180, overflowY: "auto" }}>
                    {clubsSheet.filter(c => c.name && c.name.toLowerCase().includes(clubSearchQ.toLowerCase()) && !(form.followed_clubs || []).includes(c.name)).slice(0, 8).map(c => (
                      <div key={c.id || c.name} onClick={() => { setForm(p => ({ ...p, followed_clubs: [...(p.followed_clubs || []), c.name] })); setClubSearchQ(""); }} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "#fff" }}>
                        {c.name} {c.city ? <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>· {c.city}</span> : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {err && <div style={{ marginTop: 10, color: "#ff6b6b", fontWeight: 700, fontSize: 13 }}>{err}</div>}

            {isClubAdmin && (
              <div style={{ marginTop: 14 }}>
                <button onClick={() => navigate("/club-admin")} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "linear-gradient(135deg,#1a2a00,#2a4000)", border: "1px solid rgba(116,184,0,0.4)", color: "#74B800", fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Panel de administracion del club
                </button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button onClick={() => navigate("/registrar-club")} style={{ width: "100%", padding: "10px", borderRadius: 12, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.25)", color: "rgba(116,184,0,0.8)", fontWeight: 900, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Tienes un club? Registralo gratis
              </button>
            </div>
            {session?.user?.id === "1e0db2e1-e959-41f0-bcaf-2bb46fd425da" && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => navigate("/super-admin")} style={{ width: "100%", padding: "10px", borderRadius: 12, background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,0,0,0.25)", color: "rgba(255,100,100,0.9)", fontWeight: 900, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Super Admin
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="pfBtn pfBtnPrimary" onClick={() => save()} disabled={saving || uploading}>{saving ? "Guardando..." : "Guardar"}</button>
              <button className="pfBtn pfBtnGhost" onClick={() => navigate(-1)} disabled={saving || uploading}>Volver</button>
            </div>
          </div>

          <div ref={statsRef} className="pfSection">
            <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15, marginBottom: 14 }}>Mis Stats Gorila</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              <div className="statBox"><div style={{ fontSize: 22, fontWeight: 900, color: "#74B800" }}>{stats.matches_played}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Partidos</div></div>
              <div className="statBox"><div style={{ fontSize: 22, fontWeight: 900, color: stats.avg_rating >= 4 ? "#74B800" : "#fff" }}>{stats.rating_count > 0 ? stats.avg_rating.toFixed(1) : "—"}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Valoracion</div></div>
              <div className="statBox"><div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.6)" }}>{stats.rating_count}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Resenas</div></div>
              <div className="statBox" style={{ borderColor: stats.red_cards > 0 ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.07)" }}><div style={{ fontSize: 22, fontWeight: 900, color: stats.red_cards > 0 ? "#ff6b6b" : "#74B800" }}>{stats.red_cards > 0 ? "🟥".repeat(Math.min(stats.red_cards, 3)) : "✅"}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>T. Rojas</div></div>
            </div>
            <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 10 }}>Badges</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {badges.map(b => (
                <div key={b.key} title={b.desc} className="badgePill" style={{ background: b.earned ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.04)", border: b.earned ? "1px solid rgba(116,184,0,0.4)" : "1px solid rgba(255,255,255,0.08)", color: b.earned ? "#fff" : "rgba(255,255,255,0.3)", filter: b.earned ? "none" : "grayscale(1)" }}>
                  <span style={{ fontSize: 16 }}>{b.emoji}</span><span style={{ fontSize: 11 }}>{b.label}</span>
                </div>
              ))}
            </div>
            {stats.red_cards >= 3 && <div style={{ marginTop: 14, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#ff6b6b" }}>Tienes {stats.red_cards} tarjeta{stats.red_cards > 1 ? "s" : ""} roja{stats.red_cards > 1 ? "s" : ""} por no presentarte a partidos.</div>}
          </div>

          <div className="pfSection">
            <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15, marginBottom: 14 }}>Estadisticas avanzadas</div>
            <PlayerStats userId={session?.user?.id} />
          </div>

          {ratings.length > 0 && (
            <div className="pfSection">
              <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15, marginBottom: 12 }}>Valoraciones recibidas <span style={{ fontWeight: 400, fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>Media: {stats.avg_rating.toFixed(1)} / 5</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ratings.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", gap: 2 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 12, color: Number(r.rating) >= s ? "#FFD700" : "rgba(255,255,255,0.2)" }}>★</span>)}</div>
                    {r.vibe && <span style={{ fontSize: 16 }}>{r.vibe}</span>}
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={favRef} className="pfSection">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15 }}>Mis profes favoritos {favorites.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 6 }}>({favorites.length})</span>}</div>
              <button className="pfBtn pfBtnGhost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => loadFavorites(session?.user?.id)} disabled={favLoading}>{favLoading ? "..." : "Actualizar"}</button>
            </div>
            {favLoading ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando...</div>
            : favorites.length === 0 ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Aun no tienes favoritos.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favorites.map(f => {
                  const teacherName = (f.prof?.name && String(f.prof.name).trim()) || (f.prof?.handle && String(f.prof.handle).trim()) || `Profe ${String(f.teacher_id).slice(0, 6)}...`;
                  const avatar = f.prof?.avatar_url || "";
                  const zone = f.pub?.zone || "—";
                  const price = f.pub?.price_base != null ? `${f.pub.price_base}€` : "—";
                  return (
                    <div key={f.teacher_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {avatar ? <img src={avatar} alt={teacherName} style={{ width: 42, height: 42, borderRadius: 999, objectFit: "cover" }} />
                        : <div style={{ width: 42, height: 42, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(116,184,0,0.15)", color: "#74B800", fontSize: 14 }}>{initials(teacherName)}</div>}
                        <div>
                          <div style={{ fontWeight: 900, color: "#fff", fontSize: 13 }}>{teacherName}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{zone} · {price}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}><input type="checkbox" checked={!!f.notify_morning} onChange={() => setFavPrefs(f.teacher_id, !f.notify_morning, f.notify_afternoon)} disabled={favLoading} />Manana</label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}><input type="checkbox" checked={!!f.notify_afternoon} onChange={() => setFavPrefs(f.teacher_id, f.notify_morning, !f.notify_afternoon)} disabled={favLoading} />Tarde</label>
                        <button className="pfBtn pfBtnGhost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => navigate(`/profesores/${f.teacher_id}`)}>Ver</button>
                        <button className="pfBtn pfBtnGhost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => removeFavorite(f.teacher_id)} disabled={favLoading}>Quitar</button>
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