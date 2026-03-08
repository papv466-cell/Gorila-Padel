// src/pages/PullsPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import MatchPaymentModal from "../components/MatchPaymentModal";

const LEVEL_COLORS = { iniciacion: "#74B800", medio: "#f59e0b", alto: "#ef4444", competicion: "#8b5cf6" };
const IS = { width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, boxSizing: "border-box" };

function toDateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatWhen(iso) {
  try {
    const s = String(iso || "");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}`;
    return s;
  } catch { return String(iso || ""); }
}
function combineDateTimeToISO(dateStr, timeStr) {
  const [y,mo,d] = String(dateStr||"").split("-").map(Number);
  const [hh,mm] = String(timeStr||"19:00").split(":").map(Number);
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;
}

export default function PullsPage({ session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const [pulls, setPulls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("all"); // all | mine
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [joiners, setJoiners] = useState({}); // pullId -> []
  const [favorites, setFavorites] = useState(new Set());
  const [payModalPull, setPayModalPull] = useState(null);
  const [profiles, setProfiles] = useState({});

  const todayISO = toDateInputValue(new Date());
  const uid = session?.user?.id;

  const [form, setForm] = useState({
    title: "", description: "", clubName: "", location: "",
    date: todayISO, time: "19:00", durationMin: 90,
    level: "medio", totalSpots: 8, pricePerSpot: "",
  });

  async function load() {
    try {
      const { data: pullsData } = await supabase
        .from("pulls")
        .select("*")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (!aliveRef.current) return;
      setPulls(pullsData || []);

      // Cargar joiners
      const ids = (pullsData || []).map(p => p.id);
      if (ids.length) {
        const { data: joinersData } = await supabase
          .from("pull_joiners")
          .select("pull_id, user_id, status, mood")
          .in("pull_id", ids)
          .eq("status", "approved");

        const map = {};
        for (const j of joinersData || []) {
          if (!map[j.pull_id]) map[j.pull_id] = [];
          map[j.pull_id].push(j);
        }
        if (aliveRef.current) setJoiners(map);

        // Cargar perfiles de creadores y joiners
        const creatorIds = (pullsData || []).map(p => p.created_by_user).filter(Boolean);
        const joinerIds = (joinersData || []).map(j => j.user_id).filter(Boolean);
        const allIds = Array.from(new Set([...creatorIds, ...joinerIds]));
        if (allIds.length) {
          const { data: profs } = await supabase
            .from("profiles_public")
            .select("id, name, handle, avatar_url")
            .in("id", allIds);
          const profMap = {};
          for (const p of profs || []) profMap[p.id] = p;
          if (aliveRef.current) setProfiles(profMap);
        }
      }

      // Cargar favoritos
      if (uid) {
        const { data: favsData } = await supabase
          .from("pull_favorites")
          .select("pull_id")
          .eq("user_id", uid);
        if (aliveRef.current) setFavorites(new Set((favsData || []).map(f => f.pull_id)));
      }
    } catch (e) {
      toast.error("Error cargando pulls");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  async function handleCreate() {
    if (!uid) return navigate("/login");
    if (!form.title.trim()) return setSaveError("Pon un título al pull");
    setSaving(true); setSaveError(null);
    try {
      const { error } = await supabase.from("pulls").insert({
        created_by_user: uid,
        title: form.title.trim(),
        description: form.description.trim() || null,
        club_name: form.clubName.trim() || null,
        location: form.location.trim() || null,
        start_at: combineDateTimeToISO(form.date, form.time),
        duration_min: Number(form.durationMin) || 90,
        level: form.level,
        total_spots: Number(form.totalSpots) || 8,
        price_per_spot: parseFloat(form.pricePerSpot) || 0,
        status: "open",
      });
      if (error) throw error;

      // Notificar a favoritos
      const { data: favUsers } = await supabase
        .from("pull_favorites")
        .select("user_id")
        .neq("user_id", uid);

      for (const f of favUsers || []) {
        await supabase.from("notifications").insert({
          user_id: f.user_id,
          type: "pull_created",
          title: "🎯 Nuevo Pull creado",
          body: `${profiles[uid]?.name || "Alguien"} ha creado un pull: ${form.title}`,
          data: { type: "pull" },
        });
      }

      toast.success("Pull creado ✅");
      setOpenCreate(false);
      setForm({ title: "", description: "", clubName: "", location: "", date: todayISO, time: "19:00", durationMin: 90, level: "medio", totalSpots: 8, pricePerSpot: "" });
      await load();
    } catch (e) {
      setSaveError(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(pull) {
    if (!uid) return navigate("/login");
    if (pull.price_per_spot > 0) {
      // Abrir modal de pago adaptado
      setPayModalPull(pull);
      return;
    }
    // Unirse gratis
    try {
      const { error } = await supabase.from("pull_joiners").insert({
        pull_id: pull.id,
        user_id: uid,
        status: "approved",
        paid: true,
        mood: "fun",
      });
      if (error) throw error;

      // Actualizar filled_spots
      await supabase.from("pulls").update({ filled_spots: pull.filled_spots + 1 }).eq("id", pull.id);

      // Si se llena, marcar como full
      if (pull.filled_spots + 1 >= pull.total_spots) {
        await supabase.from("pulls").update({ status: "full" }).eq("id", pull.id);
      }

      // Notificar al creador
      await supabase.from("notifications").insert({
        user_id: pull.created_by_user,
        type: "pull_joined",
        title: "🎯 Nuevo participante",
        body: `${profiles[uid]?.name || "Alguien"} se ha unido a tu pull "${pull.title}"`,
        data: { pullId: pull.id },
      });

      toast.success("¡Te has unido al pull! 🎯");
      await load();
    } catch (e) {
      toast.error(e.message || "Error al unirse");
    }
  }

  async function handleLeave(pull) {
    if (!confirm("¿Salir del pull?")) return;
    try {
      await supabase.from("pull_joiners").update({ status: "cancelled" }).eq("pull_id", pull.id).eq("user_id", uid);
      await supabase.from("pulls").update({ filled_spots: Math.max(0, pull.filled_spots - 1), status: "open" }).eq("id", pull.id);
      toast.success("Has salido del pull");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  async function toggleFavorite(pullId) {
    if (!uid) return navigate("/login");
    if (favorites.has(pullId)) {
      await supabase.from("pull_favorites").delete().eq("user_id", uid).eq("pull_id", pullId);
      setFavorites(prev => { const n = new Set(prev); n.delete(pullId); return n; });
    } else {
      await supabase.from("pull_favorites").insert({ user_id: uid, pull_id: pullId });
      setFavorites(prev => new Set([...prev, pullId]));
      toast.success("Pull guardado en favoritos ⭐");
    }
  }

  async function handleDelete(pull) {
    if (!confirm("¿Eliminar este pull?")) return;
    try {
      await supabase.from("pulls").delete().eq("id", pull.id);
      toast.success("Pull eliminado");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  async function handleInvite(pull) {
    // Por ahora share nativo
    if (navigator.share) {
      navigator.share({ title: pull.title, text: `¡Únete a mi pull de pádel: ${pull.title}!`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace copiado");
    }
  }

  const visiblePulls = viewMode === "mine"
    ? pulls.filter(p => p.created_by_user === uid || (joiners[p.id] || []).some(j => j.user_id === uid))
    : pulls;

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">

          {/* HEADER */}
          <div style={{ padding: "10px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                <span style={{ color: "#74B800" }}>🎯 Pulls</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Quedadas abiertas de pádel</div>
            </div>
            <button onClick={() => setOpenCreate(true)}
              style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer" }}>
              ➕ Crear pull
            </button>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 14, width: "fit-content" }}>
            {["all", "mine"].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: "7px 16px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 900, background: viewMode === mode ? "#74B800" : "transparent", color: viewMode === mode ? "#000" : "rgba(255,255,255,0.7)" }}>
                {mode === "all" ? "Todos" : "Los míos"}
              </button>
            ))}
          </div>

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
          ) : visiblePulls.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>No hay pulls</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>Crea uno y llena las plazas</div>
              <button onClick={() => setOpenCreate(true)}
                style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                ➕ Crear pull
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visiblePulls.map(pull => {
                const pullJoiners = joiners[pull.id] || [];
                const isMine = pull.created_by_user === uid;
                const isJoined = pullJoiners.some(j => j.user_id === uid);
                const isFav = favorites.has(pull.id);
                const levelColor = LEVEL_COLORS[pull.level] || "#74B800";
                const spotsLeft = pull.total_spots - pull.filled_spots;
                const isFull = pull.status === "full" || spotsLeft <= 0;
                const creator = profiles[pull.created_by_user];

                return (
                  <div key={pull.id} style={{ background: "#111", borderRadius: 14, border: `1px solid ${isFull ? "rgba(255,165,0,0.3)" : "rgba(116,184,0,0.2)"}`, overflow: "hidden" }}>
                    {/* HEAD */}
                    <div style={{ padding: "10px 14px", background: "#000", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {creator?.avatar_url
                          ? <img src={creator.avatar_url} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 18 }}>🦍</span>}
                        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                          onClick={() => navigate(`/usuario/${pull.created_by_user}`)}>
                          {creator?.name || creator?.handle || "Gorila"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isMine && <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 900 }}>👑 Tuyo</span>}
                        {isFull && <span style={{ fontSize: 10, color: "#FFA500", fontWeight: 900, background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>🔒 Completo</span>}
                        {isJoined && !isMine && <span style={{ fontSize: 10, color: "#74B800", fontWeight: 900 }}>✅ Apuntado</span>}
                      </div>
                    </div>

                    {/* BODY */}
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{pull.title}</div>
                      {pull.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{pull.description}</div>}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>🗓️ {formatWhen(pull.start_at)}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>⏱️ {pull.duration_min}min</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${levelColor}20`, color: levelColor, fontWeight: 800 }}>🎚️ {pull.level}</span>
                        {pull.club_name && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>📍 {pull.club_name}</span>}
                        {pull.price_per_spot > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(116,184,0,0.12)", color: "#74B800", fontWeight: 800 }}>💶 {pull.price_per_spot}€</span>}
                      </div>

                      {/* Plazas */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Plazas</span>
                          <span style={{ fontSize: 11, fontWeight: 900, color: isFull ? "#FFA500" : "#74B800" }}>
                            {pull.filled_spots}/{pull.total_spots}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 999, background: isFull ? "#FFA500" : "linear-gradient(90deg,#74B800,#9BE800)", width: `${Math.min(100, (pull.filled_spots / pull.total_spots) * 100)}%`, transition: "width .3s" }} />
                        </div>
                        {/* Avatares de joiners */}
                        {pullJoiners.length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                            {pullJoiners.slice(0, 8).map(j => {
                              const p = profiles[j.user_id];
                              return p?.avatar_url
                                ? <img key={j.user_id} src={p.avatar_url} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #111" }} />
                                : <div key={j.user_id} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(116,184,0,0.2)", display: "grid", placeItems: "center", fontSize: 10, border: "1.5px solid #111" }}>🦍</div>;
                            })}
                            {pullJoiners.length > 8 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", alignSelf: "center" }}>+{pullJoiners.length - 8}</span>}
                          </div>
                        )}
                      </div>

                      {/* ACCIONES */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {!isMine && !isJoined && !isFull && (
                          <button onClick={() => handleJoin(pull)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                            🎯 Apuntarme
                          </button>
                        )}
                        {!isMine && isJoined && (
                          <button onClick={() => handleLeave(pull)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                            Salir
                          </button>
                        )}
                        {!isMine && isFull && !isJoined && (
                          <div style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(255,165,0,0.1)", color: "#FFA500", fontWeight: 900, border: "1px solid rgba(255,165,0,0.2)", fontSize: 13, textAlign: "center" }}>
                            🔒 Completo
                          </div>
                        )}
                        <button onClick={() => toggleFavorite(pull.id)}
                          style={{ width: 36, height: 36, borderRadius: 10, background: isFav ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.08)", border: isFav ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}
                          title={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}>
                          {isFav ? "⭐" : "☆"}
                        </button>
                        <button onClick={() => handleInvite(pull)}
                          style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}
                          title="Invitar">
                          📣
                        </button>
                        {isMine && (
                          <button onClick={() => handleDelete(pull)}
                            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center", color: "#ff6b6b" }}
                            title="Eliminar">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color: "#74B800", marginBottom: 20, fontSize: 18, fontWeight: 900 }}>🎯 Crear Pull</h2>
            {saveError && <div style={{ background: "rgba(220,38,38,0.2)", padding: 10, borderRadius: 8, color: "#ff6b6b", marginBottom: 12, fontSize: 12, fontWeight: 700 }}>{saveError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Título *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Pull matutino nivel medio" style={IS} />
              </div>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Descripción</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Cuéntanos más sobre el pull..." style={IS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Club</label>
                  <input value={form.clubName} onChange={e => setForm({ ...form, clubName: e.target.value })} placeholder="Nombre del club" style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Ubicación</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ciudad o dirección" style={IS} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Fecha</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Hora</label>
                  <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={IS} />
                </div>
              </div>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Nivel</label>
                <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} style={IS}>
                  <option value="iniciacion" style={{ background: "#1a1a1a" }}>Iniciación</option>
                  <option value="medio" style={{ background: "#1a1a1a" }}>Medio</option>
                  <option value="alto" style={{ background: "#1a1a1a" }}>Alto</option>
                  <option value="competicion" style={{ background: "#1a1a1a" }}>Competición</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Duración (min)</label>
                  <input type="number" value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })} min="30" max="240" step="30" style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Plazas</label>
                  <input type="number" value={form.totalSpots} onChange={e => setForm({ ...form, totalSpots: e.target.value })} min="2" max="50" style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Precio/plaza €</label>
                  <input type="number" value={form.pricePerSpot} onChange={e => setForm({ ...form, pricePerSpot: e.target.value })} min="0" step="0.5" placeholder="0" style={IS} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleCreate} disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: saving ? "rgba(116,184,0,0.4)" : "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {saving ? "⏳ Creando..." : "✅ Crear Pull"}
                </button>
                <button onClick={() => setOpenCreate(false)} disabled={saving}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14 }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGO */}
      {payModalPull && (
        <MatchPaymentModal
          match={{
            ...payModalPull,
            id: payModalPull.id,
            club_name: payModalPull.club_name || payModalPull.title,
            price_per_player: payModalPull.price_per_spot,
            club_id: payModalPull.club_id || "pull",
          }}
          session={session}
          onClose={() => setPayModalPull(null)}
          onJoined={async () => {
            setPayModalPull(null);
            await load();
          }}
        />
      )}
    </div>
  );
}