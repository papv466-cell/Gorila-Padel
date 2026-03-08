// src/pages/TrainingsPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

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

export default function TrainingsPage({ session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [joiners, setJoiners] = useState({});
  const [favorites, setFavorites] = useState(new Set());
  const [profiles, setProfiles] = useState({});
  const [joinModalFor, setJoinModalFor] = useState(null); // training to join, shows hand selector

  const todayISO = toDateInputValue(new Date());
  const uid = session?.user?.id;

  const [form, setForm] = useState({
    title: "", description: "", clubName: "", location: "",
    date: todayISO, time: "19:00", durationMin: 90,
    level: "medio", totalSpots: 8, pricePerSpot: "",
  });

  async function load() {
    try {
      const { data: trainingsData } = await supabase
        .from("trainings")
        .select("*")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (!aliveRef.current) return;
      setTrainings(trainingsData || []);

      const ids = (trainingsData || []).map(t => t.id);
      if (ids.length) {
        const { data: joinersData } = await supabase
          .from("training_joiners")
          .select("training_id, user_id, hand, status")
          .in("training_id", ids)
          .eq("status", "approved");

        const map = {};
        for (const j of joinersData || []) {
          if (!map[j.training_id]) map[j.training_id] = [];
          map[j.training_id].push(j);
        }
        if (aliveRef.current) setJoiners(map);

        const creatorIds = (trainingsData || []).map(t => t.created_by_user).filter(Boolean);
        const joinerIds = (joinersData || []).map(j => j.user_id).filter(Boolean);
        const allIds = Array.from(new Set([...creatorIds, ...joinerIds]));
        if (allIds.length) {
          const { data: profs } = await supabase.from("profiles_public").select("id, name, handle, avatar_url").in("id", allIds);
          const profMap = {};
          for (const p of profs || []) profMap[p.id] = p;
          if (aliveRef.current) setProfiles(profMap);
        }
      }

      if (uid) {
        const { data: favsData } = await supabase.from("training_favorites").select("training_id").eq("user_id", uid);
        if (aliveRef.current) setFavorites(new Set((favsData || []).map(f => f.training_id)));
      }
    } catch (e) {
      toast.error("Error cargando entrenamientos");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid]);

  async function handleCreate() {
    if (!uid) return navigate("/login");
    if (!form.title.trim()) return setSaveError("Pon un título al entrenamiento");
    const totalSpots = Number(form.totalSpots) || 8;
    const halfSpots = Math.floor(totalSpots / 2);
    setSaving(true); setSaveError(null);
    try {
      const { error } = await supabase.from("trainings").insert({
        created_by_user: uid,
        title: form.title.trim(),
        description: form.description.trim() || null,
        club_name: form.clubName.trim() || null,
        location: form.location.trim() || null,
        start_at: combineDateTimeToISO(form.date, form.time),
        duration_min: Number(form.durationMin) || 90,
        level: form.level,
        total_spots: totalSpots,
        right_spots: halfSpots,
        left_spots: totalSpots - halfSpots,
        price_per_spot: parseFloat(form.pricePerSpot) || 0,
        status: "open",
      });
      if (error) throw error;

      toast.success("Entrenamiento creado ✅");
      setOpenCreate(false);
      setForm({ title: "", description: "", clubName: "", location: "", date: todayISO, time: "19:00", durationMin: 90, level: "medio", totalSpots: 8, pricePerSpot: "" });
      await load();
    } catch (e) {
      setSaveError(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(training, hand) {
    if (!uid) return navigate("/login");
    try {
      const { error } = await supabase.from("training_joiners").insert({
        training_id: training.id,
        user_id: uid,
        hand,
        status: "approved",
        paid: training.price_per_spot > 0 ? false : true,
      });
      if (error) throw error;

      // Actualizar contadores
      const update = hand === "right"
        ? { filled_right: training.filled_right + 1 }
        : { filled_left: training.filled_left + 1 };

      const totalFilled = training.filled_right + training.filled_left + 1;
      if (totalFilled >= training.total_spots) update.status = "full";

      await supabase.from("trainings").update(update).eq("id", training.id);

      // Notificar al creador
      await supabase.from("notifications").insert({
        user_id: training.created_by_user,
        type: "training_joined",
        title: "💪 Nuevo participante",
        body: `${profiles[uid]?.name || "Alguien"} se ha apuntado a "${training.title}" (${hand === "right" ? "Derecha" : "Revés"})`,
        data: { trainingId: training.id },
      });

      toast.success(`¡Apuntado con ${hand === "right" ? "Derecha" : "Revés"}! 💪`);
      setJoinModalFor(null);
      await load();
    } catch (e) {
      toast.error(e.message || "Error al apuntarse");
    }
  }

  async function handleLeave(training) {
    if (!confirm("¿Salir del entrenamiento?")) return;
    try {
      const joiner = (joiners[training.id] || []).find(j => j.user_id === uid);
      if (!joiner) return;

      await supabase.from("training_joiners").update({ status: "cancelled" }).eq("training_id", training.id).eq("user_id", uid);

      const update = joiner.hand === "right"
        ? { filled_right: Math.max(0, training.filled_right - 1), status: "open" }
        : { filled_left: Math.max(0, training.filled_left - 1), status: "open" };

      await supabase.from("trainings").update(update).eq("id", training.id);
      toast.success("Has salido del entrenamiento");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  async function toggleFavorite(trainingId) {
    if (!uid) return navigate("/login");
    if (favorites.has(trainingId)) {
      await supabase.from("training_favorites").delete().eq("user_id", uid).eq("training_id", trainingId);
      setFavorites(prev => { const n = new Set(prev); n.delete(trainingId); return n; });
    } else {
      await supabase.from("training_favorites").insert({ user_id: uid, training_id: trainingId });
      setFavorites(prev => new Set([...prev, trainingId]));
      toast.success("Guardado en favoritos ⭐");
    }
  }

  async function handleDelete(training) {
    if (!confirm("¿Eliminar este entrenamiento?")) return;
    try {
      await supabase.from("trainings").delete().eq("id", training.id);
      toast.success("Entrenamiento eliminado");
      await load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  }

  const visibleTrainings = viewMode === "mine"
    ? trainings.filter(t => t.created_by_user === uid || (joiners[t.id] || []).some(j => j.user_id === uid))
    : trainings;

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">

          <div style={{ padding: "10px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                <span style={{ color: "#74B800" }}>💪 Entrenamientos</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Sesiones con manos equilibradas</div>
            </div>
            <button onClick={() => setOpenCreate(true)}
              style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer" }}>
              ➕ Crear
            </button>
          </div>

          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 14, width: "fit-content" }}>
            {["all", "mine"].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: "7px 16px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 900, background: viewMode === mode ? "#74B800" : "transparent", color: viewMode === mode ? "#000" : "rgba(255,255,255,0.7)" }}>
                {mode === "all" ? "Todos" : "Los míos"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
          ) : visibleTrainings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💪</div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>No hay entrenamientos</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>Crea uno y organiza tu sesión</div>
              <button onClick={() => setOpenCreate(true)}
                style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                ➕ Crear entrenamiento
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleTrainings.map(training => {
                const trainingJoiners = joiners[training.id] || [];
                const isMine = training.created_by_user === uid;
                const myJoin = trainingJoiners.find(j => j.user_id === uid);
                const isJoined = !!myJoin;
                const isFav = favorites.has(training.id);
                const levelColor = LEVEL_COLORS[training.level] || "#74B800";
                const isFull = training.status === "full";
                const rightLeft = training.filled_right + training.filled_left;
                const creator = profiles[training.created_by_user];

                return (
                  <div key={training.id} style={{ background: "#111", borderRadius: 14, border: `1px solid ${isFull ? "rgba(255,165,0,0.3)" : "rgba(116,184,0,0.2)"}`, overflow: "hidden" }}>
                    {/* HEAD */}
                    <div style={{ padding: "10px 14px", background: "#000", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {creator?.avatar_url
                          ? <img src={creator.avatar_url} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 18 }}>🦍</span>}
                        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                          onClick={() => navigate(`/usuario/${training.created_by_user}`)}>
                          {creator?.name || creator?.handle || "Gorila"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isMine && <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 900 }}>👑 Tuyo</span>}
                        {isFull && <span style={{ fontSize: 10, color: "#FFA500", fontWeight: 900, background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>🔒 Completo</span>}
                        {isJoined && !isMine && <span style={{ fontSize: 10, color: "#74B800", fontWeight: 900 }}>✅ {myJoin.hand === "right" ? "Derecha" : "Revés"}</span>}
                      </div>
                    </div>

                    {/* BODY */}
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{training.title}</div>
                      {training.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{training.description}</div>}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>🗓️ {formatWhen(training.start_at)}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>⏱️ {training.duration_min}min</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${levelColor}20`, color: levelColor, fontWeight: 800 }}>🎚️ {training.level}</span>
                        {training.club_name && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>📍 {training.club_name}</span>}
                        {training.price_per_spot > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(116,184,0,0.12)", color: "#74B800", fontWeight: 800 }}>💶 {training.price_per_spot}€</span>}
                      </div>

                      {/* Manos */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {[
                          { key: "right", label: "Derecha 🎾", filled: training.filled_right, total: training.right_spots, color: "#74B800" },
                          { key: "left", label: "Revés 🔄", filled: training.filled_left, total: training.left_spots, color: "#8b5cf6" },
                        ].map(hand => (
                          <div key={hand.key} style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${hand.color}20` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: hand.color }}>{hand.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 900, color: hand.filled >= hand.total ? "#FFA500" : "rgba(255,255,255,0.6)" }}>
                                {hand.filled}/{hand.total}
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                              <div style={{ height: "100%", borderRadius: 999, background: hand.color, width: `${Math.min(100, (hand.filled / hand.total) * 100)}%`, transition: "width .3s" }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Avatares */}
                      {trainingJoiners.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                          {trainingJoiners.slice(0, 10).map(j => {
                            const p = profiles[j.user_id];
                            return p?.avatar_url
                              ? <img key={j.user_id} src={p.avatar_url} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #111", outline: `1.5px solid ${j.hand === "right" ? "#74B800" : "#8b5cf6"}` }} />
                              : <div key={j.user_id} style={{ width: 22, height: 22, borderRadius: "50%", background: j.hand === "right" ? "rgba(116,184,0,0.2)" : "rgba(139,92,246,0.2)", display: "grid", placeItems: "center", fontSize: 10, border: "1.5px solid #111" }}>🦍</div>;
                          })}
                        </div>
                      )}

                      {/* ACCIONES */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {!isMine && !isJoined && !isFull && (
                          <button onClick={() => setJoinModalFor(training)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                            💪 Apuntarme
                          </button>
                        )}
                        {!isMine && isJoined && (
                          <button onClick={() => handleLeave(training)}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                            Salir
                          </button>
                        )}
                        {!isMine && isFull && !isJoined && (
                          <div style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(255,165,0,0.1)", color: "#FFA500", fontWeight: 900, fontSize: 13, textAlign: "center", border: "1px solid rgba(255,165,0,0.2)" }}>
                            🔒 Completo
                          </div>
                        )}
                        <button onClick={() => toggleFavorite(training.id)}
                          style={{ width: 36, height: 36, borderRadius: 10, background: isFav ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.08)", border: isFav ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>
                          {isFav ? "⭐" : "☆"}
                        </button>
                        {isMine && (
                          <button onClick={() => handleDelete(training)}
                            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center", color: "#ff6b6b" }}>
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

      {/* MODAL ELEGIR MANO */}
      {joinModalFor && (
        <div onClick={() => setJoinModalFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 360, width: "100%", border: "1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color: "#74B800", marginBottom: 8, fontSize: 18, fontWeight: 900 }}>💪 ¿Con qué mano juegas?</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{joinModalFor.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "right", label: "🎾 Derecha", desc: `${joinModalFor.filled_right}/${joinModalFor.right_spots} plazas ocupadas`, color: "#74B800", full: joinModalFor.filled_right >= joinModalFor.right_spots },
                { key: "left", label: "🔄 Revés", desc: `${joinModalFor.filled_left}/${joinModalFor.left_spots} plazas ocupadas`, color: "#8b5cf6", full: joinModalFor.filled_left >= joinModalFor.left_spots },
              ].map(hand => (
                <button key={hand.key} onClick={() => !hand.full && handleJoin(joinModalFor, hand.key)} disabled={hand.full}
                  style={{ padding: "16px", borderRadius: 14, background: hand.full ? "rgba(255,255,255,0.04)" : `${hand.color}15`, border: `1px solid ${hand.full ? "rgba(255,255,255,0.08)" : hand.color + "40"}`, cursor: hand.full ? "not-allowed" : "pointer", textAlign: "left", opacity: hand.full ? 0.5 : 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: hand.full ? "rgba(255,255,255,0.4)" : "#fff" }}>{hand.label} {hand.full ? "— Completo" : ""}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{hand.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setJoinModalFor(null)} style={{ width: "100%", marginTop: 14, padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREAR */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color: "#74B800", marginBottom: 20, fontSize: 18, fontWeight: 900 }}>💪 Crear Entrenamiento</h2>
            {saveError && <div style={{ background: "rgba(220,38,38,0.2)", padding: 10, borderRadius: 8, color: "#ff6b6b", marginBottom: 12, fontSize: 12, fontWeight: 700 }}>{saveError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Título *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Entrenamiento técnica nivel medio" style={IS} />
              </div>
              <div>
                <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Descripción</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalles del entrenamiento..." style={IS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Club</label>
                  <input value={form.clubName} onChange={e => setForm({ ...form, clubName: e.target.value })} placeholder="Nombre del club" style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Ubicación</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ciudad" style={IS} />
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
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Plazas totales</label>
                  <input type="number" value={form.totalSpots} onChange={e => setForm({ ...form, totalSpots: e.target.value })} min="2" max="50" style={IS} />
                </div>
                <div>
                  <label style={{ color: "#fff", display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Precio/plaza €</label>
                  <input type="number" value={form.pricePerSpot} onChange={e => setForm({ ...form, pricePerSpot: e.target.value })} min="0" step="0.5" placeholder="0" style={IS} />
                </div>
              </div>

              {form.totalSpots && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.15)", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  🎾 <strong style={{ color: "#74B800" }}>{Math.floor(Number(form.totalSpots) / 2)}</strong> plazas derecha · 🔄 <strong style={{ color: "#8b5cf6" }}>{Number(form.totalSpots) - Math.floor(Number(form.totalSpots) / 2)}</strong> plazas revés
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleCreate} disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: saving ? "rgba(116,184,0,0.4)" : "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {saving ? "⏳ Creando..." : "✅ Crear Entrenamiento"}
                </button>
                <button onClick={() => setOpenCreate(false)} disabled={saving}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14 }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}