// src/pages/TrainingsPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import MatchPaymentModal from "../components/MatchPaymentModal";
import { useToast } from "../components/ToastProvider";

const LEVEL_COLORS = { iniciacion: "var(--sport-color)", medio: "#f59e0b", alto: "#ef4444", competicion: "#8b5cf6" };
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
function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Ahora";
  if (m < 60) return `Hace ${m}m`;
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${d}d`;
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
  const [trainingPayModal, setTrainingPayModal] = useState(null);
  const [pendingHand, setPendingHand] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [waitlist, setWaitlist] = useState(new Set());
  const [profiles, setProfiles] = useState({});
  const [notifyTrainings, setNotifyTrainings] = useState(false);
  const [filterLevel, setFilterLevel] = useState("");
  const [joinModalFor, setJoinModalFor] = useState(null);

  // Chat
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Invitar
  const [inviteOpenFor, setInviteOpenFor] = useState(null);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSelected, setInviteSelected] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);

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
        .from("trainings").select("*")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (!aliveRef.current) return;
      setTrainings(trainingsData || []);

      const ids = (trainingsData || []).map(t => t.id);
      if (ids.length) {
        const { data: joinersData } = await supabase
          .from("training_joiners").select("training_id, user_id, hand, status")
          .in("training_id", ids).eq("status", "approved");

        const map = {};
        for (const j of joinersData || []) {
          if (!map[j.training_id]) map[j.training_id] = [];
          map[j.training_id].push(j);
        }
        if (aliveRef.current) setJoiners(map);

        if (uid) {
          const { data: wlData } = await supabase
            .from("activity_waitlist").select("activity_id")
            .eq("user_id", uid).eq("activity_type", "training").in("activity_id", ids);
          if (aliveRef.current) setWaitlist(new Set((wlData || []).map(w => w.activity_id)));
        }

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
        const { data: prefData } = await supabase.from("profiles").select("notify_trainings").eq("id", uid).maybeSingle();
        if (aliveRef.current) setNotifyTrainings(prefData?.notify_trainings || false);
      }
    } catch { toast.error("Error cargando entrenamientos"); }
    finally { if (aliveRef.current) setLoading(false); }
  }

  useEffect(() => { load(); }, [uid]);

  // Realtime chat
  useEffect(() => {
    if (!chatOpenFor) return;
    const ch = supabase.channel(`training-chat-${chatOpenFor}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "training_messages", filter: `training_id=eq.${chatOpenFor}` },
        () => loadChat(chatOpenFor))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [chatOpenFor]);

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadChat(trainingId) {
    setChatLoading(true);
    try {
      const { data } = await supabase.from("training_messages").select("*").eq("training_id", trainingId).order("created_at", { ascending: true });
      if (aliveRef.current) setChatMessages(data || []);
    } catch {} finally { if (aliveRef.current) setChatLoading(false); }
  }

  async function sendChat() {
    if (!chatText.trim() || !chatOpenFor || !uid) return;
    const msg = chatText.trim();
    setChatText("");
    try {
      await supabase.from("training_messages").insert({ training_id: chatOpenFor, user_id: uid, message: msg });
      await loadChat(chatOpenFor);
    } catch { toast.error("Error al enviar"); }
  }

  // Búsqueda invitados
  useEffect(() => {
    if (inviteQuery.trim().length < 3) { setInviteResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles_public").select("id, name, handle, avatar_url")
        .or(`name.ilike.%${inviteQuery}%,handle.ilike.%${inviteQuery}%`).neq("id", uid).limit(8);
      if (aliveRef.current) setInviteResults(data || []);
    }, 220);
    return () => clearTimeout(t);
  }, [inviteQuery]);

  async function sendInvites(training) {
    if (!inviteSelected.length) return;
    setInviteBusy(true);
    try {
      for (const toUserId of inviteSelected) {
        await supabase.from("notifications").insert({
          user_id: toUserId, type: "training_invite",
          title: "💪 Te han invitado a un Entrenamiento",
          body: `${profiles[uid]?.name || "Alguien"} te invita a "${training.title}" el ${formatWhen(training.start_at)}`,
          data: { trainingId: training.id },
        });
      }
      toast.success(`Invitaciones enviadas a ${inviteSelected.length} jugador${inviteSelected.length > 1 ? "es" : ""} ✅`);
      setInviteOpenFor(null); setInviteQuery(""); setInviteResults([]); setInviteSelected([]);
    } catch { toast.error("Error enviando invitaciones"); }
    finally { setInviteBusy(false); }
  }

  async function handleCreate() {
    if (!uid) return navigate("/login");
    if (!form.title.trim()) return setSaveError("Pon un título al entrenamiento");
    const totalSpots = Number(form.totalSpots) || 8;
    const halfSpots = Math.floor(totalSpots / 2);
    setSaving(true); setSaveError(null);
    try {
      const { data: newTraining, error } = await supabase.from("trainings").insert({
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
      }).select().single();
      if (error) throw error;

      // Notificar a usuarios con notify_trainings=true
      const { data: notifyUsers } = await supabase.from("profiles")
        .select("id").eq("notify_trainings", true).neq("id", uid);
      for (const u of notifyUsers || []) {
        await supabase.from("notifications").insert({
          user_id: u.id, type: "training_created",
          title: "💪 Nuevo Entrenamiento disponible",
          body: `${profiles[uid]?.name || "Alguien"} ha creado: "${form.title}" · ${form.level} · ${formatWhen(combineDateTimeToISO(form.date, form.time))}`,
          data: { trainingId: newTraining.id },
        });
      }

      toast.success("Entrenamiento creado ✅");
      setOpenCreate(false);
      setForm({ title: "", description: "", clubName: "", location: "", date: todayISO, time: "19:00", durationMin: 90, level: "medio", totalSpots: 8, pricePerSpot: "" });
      await load();
    } catch (e) { setSaveError(e.message || "Error"); }
    finally { setSaving(false); }
  }

  async function joinAfterPayment(training, hand) {
    try {
      const { error } = await supabase.from("training_joiners").insert({
        training_id: training.id, user_id: uid, hand,
        status: "approved", paid: training.price_per_spot > 0 ? false : true,
      });
      if (error) throw error;
      const update = hand === "right" ? { filled_right: training.filled_right + 1 } : { filled_left: training.filled_left + 1 };
      const totalFilled = training.filled_right + training.filled_left + 1;
      if (totalFilled >= training.total_spots) update.status = "full";
      await supabase.from("trainings").update(update).eq("id", training.id);
      await supabase.from("notifications").insert({
        user_id: training.created_by_user, type: "training_joined",
        title: "💪 Nuevo participante",
        body: "Alguien se apuntó a tu entrenamiento",
        data: { trainingId: training.id },
      });
      setTrainingPayModal(null); setPendingHand(null);
      await load();
    } catch(e) { alert(e.message); }
  }

  async function handleJoin(training, hand) {
    if (!uid) return navigate("/login");
    setPendingHand(hand);
    setTrainingPayModal(training);
    return;
    try {
      const { error } = await supabase.from("training_joiners").insert({
        training_id: training.id, user_id: uid, hand,
        status: "approved", paid: training.price_per_spot > 0 ? false : true,
      });
      if (error) throw error;

      const update = hand === "right"
        ? { filled_right: training.filled_right + 1 }
        : { filled_left: training.filled_left + 1 };
      const totalFilled = training.filled_right + training.filled_left + 1;
      if (totalFilled >= training.total_spots) update.status = "full";
      await supabase.from("trainings").update(update).eq("id", training.id);

      await supabase.from("notifications").insert({
        user_id: training.created_by_user, type: "training_joined",
        title: "💪 Nuevo participante",
        body: `${profiles[uid]?.name || "Alguien"} se apuntó a "${training.title}" (${hand === "right" ? "Derecha" : "Revés"})`,
        data: { trainingId: training.id },
      });

      if (totalFilled >= training.total_spots) {
        for (const j of (joiners[training.id] || [])) {
          if (j.user_id !== uid) {
            await supabase.from("notifications").insert({
              user_id: j.user_id, type: "training_full",
              title: "🔒 Entrenamiento completo",
              body: `"${training.title}" ya tiene todas las plazas. ¡Nos vemos!`,
              data: { trainingId: training.id },
            });
          }
        }
        // Notificar waitlist
        const { data: wlUsers } = await supabase.from("activity_waitlist")
          .select("user_id").eq("activity_type", "training").eq("activity_id", training.id);
        for (const w of wlUsers || []) {
          await supabase.from("notifications").insert({
            user_id: w.user_id, type: "training_waitlist_full",
            title: "😔 Entrenamiento completo",
            body: `"${training.title}" se ha llenado. Estás en lista de espera.`,
            data: { trainingId: training.id },
          });
        }
      }

      toast.success(`¡Apuntado con ${hand === "right" ? "Derecha" : "Revés"}! 💪`);
      setJoinModalFor(null);
      await load();
    } catch (e) { toast.error(e.message || "Error al apuntarse"); }
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

      // Avisar al primero de la waitlist
      const { data: wlFirst } = await supabase.from("activity_waitlist")
        .select("user_id").eq("activity_type", "training").eq("activity_id", training.id)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (wlFirst) {
        await supabase.from("notifications").insert({
          user_id: wlFirst.user_id, type: "training_waitlist_spot",
          title: "💪 ¡Hay una plaza libre!",
          body: `Se liberó una plaza en "${training.title}". ¡Date prisa!`,
          data: { trainingId: training.id },
        });
      }

      toast.success("Has salido del entrenamiento");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  async function handleWaitlist(training) {
    if (!uid) return navigate("/login");
    if (waitlist.has(training.id)) {
      await supabase.from("activity_waitlist").delete().eq("user_id", uid).eq("activity_type", "training").eq("activity_id", training.id);
      setWaitlist(prev => { const n = new Set(prev); n.delete(training.id); return n; });
      toast.success("Saliste de la lista de espera");
    } else {
      await supabase.from("activity_waitlist").insert({ user_id: uid, activity_type: "training", activity_id: training.id });
      setWaitlist(prev => new Set([...prev, training.id]));
      toast.success("Apuntado a lista de espera ⏳");
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

  async function toggleNotify() {
    if (!uid) return navigate("/login");
    const newVal = !notifyTrainings;
    await supabase.from("profiles").update({ notify_trainings: newVal }).eq("id", uid);
    setNotifyTrainings(newVal);
    toast.success(newVal ? "🔔 Recibirás avisos de nuevos entrenamientos" : "🔕 Notificaciones desactivadas");
  }

  async function handleDelete(training) {
    if (!confirm("¿Eliminar este entrenamiento? Se avisará a todos los apuntados.")) return;
    try {
      for (const j of (joiners[training.id] || [])) {
        await supabase.from("notifications").insert({
          user_id: j.user_id, type: "training_cancelled",
          title: "❌ Entrenamiento cancelado",
          body: `El entrenamiento "${training.title}" del ${formatWhen(training.start_at)} ha sido cancelado.`,
          data: { trainingId: training.id },
        });
      }
      await supabase.from("trainings").delete().eq("id", training.id);
      toast.success("Entrenamiento eliminado");
      await load();
    } catch (e) { toast.error(e.message || "Error"); }
  }

  const visibleTrainings = (viewMode === "mine"
    ? trainings.filter(t => t.created_by_user === uid || (joiners[t.id] || []).some(j => j.user_id === uid))
    : trainings
  ).filter(t => !filterLevel || t.level === filterLevel);

  const chatTraining = trainings.find(t => t.id === chatOpenFor);
  const inviteTraining = trainings.find(t => t.id === inviteOpenFor);

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">

          {/* HEADER */}
          <div style={{ padding: "10px 0 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                <span style={{ color: "var(--sport-color)" }}>💪 Entrenamientos</span>
              </h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Sesiones con manos equilibradas</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {uid && (
                <button onClick={toggleNotify}
                  title={notifyTrainings ? "Desactivar avisos" : "Activar avisos de nuevos entrenamientos"}
                  style={{ width: 36, height: 36, borderRadius: 10, background: notifyTrainings ? "rgba(var(--sport-color-rgb, 46,204,113),0.2)" : "rgba(255,255,255,0.08)", border: notifyTrainings ? "1px solid var(--sport-color)" : "1px solid transparent", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>
                  {notifyTrainings ? "🔔" : "🔕"}
                </button>
              )}
              <button onClick={() => setOpenCreate(true)}
                style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", fontSize: 13, cursor: "pointer" }}>
                ➕ Crear
              </button>
            </div>
          </div>

          {/* TABS + FILTROS */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
              {["all", "mine"].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 900, background: viewMode === mode ? "var(--sport-color)" : "transparent", color: viewMode === mode ? "#000" : "rgba(255,255,255,0.7)" }}>
                  {mode === "all" ? "Todos" : "Los míos"}
                </button>
              ))}
            </div>
            {["", "iniciacion", "medio", "alto", "competicion"].map(lvl => (
              <button key={lvl} onClick={() => setFilterLevel(lvl)}
                style={{ padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, background: filterLevel === lvl ? (LEVEL_COLORS[lvl] || "var(--sport-color)") : "rgba(255,255,255,0.08)", color: filterLevel === lvl ? "#000" : "rgba(255,255,255,0.7)" }}>
                {lvl === "" ? "Todos" : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </button>
            ))}
          </div>

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💪</div>Cargando…
            </div>
          ) : visibleTrainings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💪</div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 16 }}>No hay entrenamientos</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, marginBottom: 16 }}>
                Activa 🔔 para que te avisemos cuando se cree uno
              </div>
              <button onClick={() => setOpenCreate(true)}
                style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
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
                const isWL = waitlist.has(training.id);
                const levelColor = LEVEL_COLORS[training.level] || "var(--sport-color)";
                const isFull = training.status === "full";
                const creator = profiles[training.created_by_user];
                const canChat = isMine || isJoined;
                const rightFull = training.filled_right >= training.right_spots;
                const leftFull = training.filled_left >= training.left_spots;

                return (
                  <div key={training.id} style={{ background: "#111", borderRadius: 14, border: `1px solid ${isFull ? "rgba(255,165,0,0.3)" : "rgba(var(--sport-color-rgb, 46,204,113),0.2)"}`, overflow: "hidden" }}>
                    {/* HEAD */}
                    <div style={{ padding: "10px 14px", background: "#000", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate(`/usuario/${training.created_by_user}`)}>
                        {creator?.avatar_url
                          ? <img src={creator.avatar_url} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 18 }}>🦍</span>}
                        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>{creator?.name || creator?.handle || "Gorila"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isMine && <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 900 }}>👑 Tuyo</span>}
                        {isFull && <span style={{ fontSize: 10, color: "#FFA500", fontWeight: 900, background: "rgba(255,165,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>🔒 Completo</span>}
                        {isJoined && !isMine && <span style={{ fontSize: 10, color: "var(--sport-color)", fontWeight: 900 }}>✅ {myJoin.hand === "right" ? "Derecha" : "Revés"}</span>}
                        {isWL && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 900 }}>⏳ En espera</span>}
                      </div>
                    </div>

                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{training.title}</div>
                      {training.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{training.description}</div>}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>🗓️ {formatWhen(training.start_at)}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>⏱️ {training.duration_min}min</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${levelColor}20`, color: levelColor, fontWeight: 800 }}>🎚️ {training.level}</span>
                        {training.club_name && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>📍 {training.club_name}</span>}
                        {training.price_per_spot > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(var(--sport-color-rgb, 46,204,113),0.12)", color: "var(--sport-color)", fontWeight: 800 }}>💶 {training.price_per_spot}€/plaza</span>}
                      </div>

                      {/* Manos */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {[
                          { key: "right", label: "Derecha 🎾", filled: training.filled_right, total: training.right_spots, color: "var(--sport-color)", full: rightFull },
                          { key: "left", label: "Revés 🔄", filled: training.filled_left, total: training.left_spots, color: "#8b5cf6", full: leftFull },
                        ].map(hand => (
                          <div key={hand.key} style={{ padding: "8px 10px", borderRadius: 10, background: hand.full ? "rgba(255,165,0,0.05)" : "rgba(255,255,255,0.04)", border: `1px solid ${hand.full ? "rgba(255,165,0,0.2)" : hand.color + "20"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: hand.full ? "#FFA500" : hand.color }}>{hand.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 900, color: hand.full ? "#FFA500" : "rgba(255,255,255,0.6)" }}>{hand.filled}/{hand.total}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                              <div style={{ height: "100%", borderRadius: 999, background: hand.full ? "#FFA500" : hand.color, width: `${Math.min(100, (hand.filled / hand.total) * 100)}%`, transition: "width .3s" }} />
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
                              ? <img key={j.user_id} src={p.avatar_url} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #111", outline: `1.5px solid ${j.hand === "right" ? "var(--sport-color)" : "#8b5cf6"}` }} />
                              : <div key={j.user_id} style={{ width: 22, height: 22, borderRadius: "50%", background: j.hand === "right" ? "rgba(var(--sport-color-rgb, 46,204,113),0.2)" : "rgba(139,92,246,0.2)", display: "grid", placeItems: "center", fontSize: 10, border: "1.5px solid #111" }}>🦍</div>;
                          })}
                          {trainingJoiners.length > 10 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", alignSelf: "center" }}>+{trainingJoiners.length - 10}</span>}
                        </div>
                      )}

                      {/* ACCIONES */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {!isMine && !isJoined && !isFull && (
                          <button onClick={() => setJoinModalFor(training)}
                            style={{ flex: 1, minWidth: 80, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 13 }}>
                            💪 Apuntarme
                          </button>
                        )}
                        {!isMine && isJoined && (
                          <button onClick={() => handleLeave(training)}
                            style={{ flex: 1, minWidth: 80, padding: "9px", borderRadius: 10, background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontWeight: 900, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 13 }}>
                            Salir
                          </button>
                        )}
                        {!isMine && isFull && !isJoined && (
                          <button onClick={() => handleWaitlist(training)}
                            style={{ flex: 1, minWidth: 80, padding: "9px", borderRadius: 10, background: isWL ? "rgba(245,158,11,0.15)" : "rgba(255,165,0,0.1)", color: "#FFA500", fontWeight: 900, border: "1px solid rgba(255,165,0,0.3)", cursor: "pointer", fontSize: 13 }}>
                            {isWL ? "⏳ En espera" : "⏳ Lista espera"}
                          </button>
                        )}
                        {canChat && (
                          <button onClick={() => { setChatOpenFor(training.id); loadChat(training.id); }}
                            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}
                            title="Chat del grupo">💬</button>
                        )}
                        <button onClick={() => toggleFavorite(training.id)}
                          style={{ width: 36, height: 36, borderRadius: 10, background: isFav ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.08)", border: isFav ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>
                          {isFav ? "⭐" : "☆"}
                        </button>
                        <button onClick={() => { setInviteOpenFor(training.id); setInviteQuery(""); setInviteResults([]); setInviteSelected([]); }}
                          style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}
                          title="Invitar jugadores">📣</button>
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 360, width: "100%", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)" }}>
            <h2 style={{ color: "var(--sport-color)", marginBottom: 8, fontSize: 18, fontWeight: 900 }}>💪 ¿Con qué mano juegas?</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{joinModalFor.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "right", label: "🎾 Derecha", desc: `${joinModalFor.filled_right}/${joinModalFor.right_spots} plazas ocupadas`, color: "var(--sport-color)", full: joinModalFor.filled_right >= joinModalFor.right_spots },
                { key: "left", label: "🔄 Revés", desc: `${joinModalFor.filled_left}/${joinModalFor.left_spots} plazas ocupadas`, color: "#8b5cf6", full: joinModalFor.filled_left >= joinModalFor.left_spots },
              ].map(hand => (
                <button key={hand.key} onClick={() => !hand.full && handleJoin(joinModalFor, hand.key)} disabled={hand.full}
                  style={{ padding: "16px", borderRadius: 14, background: hand.full ? "rgba(255,255,255,0.04)" : `${hand.color}15`, border: `1px solid ${hand.full ? "rgba(255,255,255,0.08)" : hand.color + "40"}`, cursor: hand.full ? "not-allowed" : "pointer", textAlign: "left", opacity: hand.full ? 0.5 : 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: hand.full ? "rgba(255,255,255,0.4)" : "#fff" }}>{hand.label}{hand.full ? " — Completo" : ""}</div>
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

      {/* MODAL CHAT */}
      {chatOpenFor && chatTraining && (
        <div onClick={() => setChatOpenFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 30000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f0f0f", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 900, color: "#fff", fontSize: 15 }}>💬 {chatTraining.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{(joiners[chatOpenFor] || []).length} participantes · solo apuntados</div>
              </div>
              <button onClick={() => setChatOpenFor(null)} style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>✕</button>
            </div>
            <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {chatLoading
                ? <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 20 }}>Cargando…</div>
                : chatMessages.length === 0
                  ? <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.4)" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                      <div style={{ fontSize: 13 }}>Sé el primero en escribir</div>
                    </div>
                  : chatMessages.map((msg, idx) => {
                      const isMe = msg.user_id === uid;
                      const prof = profiles[msg.user_id];
                      const pname = prof?.name || prof?.handle || "Gorila";
                      const showName = !isMe && (idx === 0 || chatMessages[idx-1]?.user_id !== msg.user_id);
                      return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6 }}>
                          {!isMe && (
                            <div style={{ width: 26, height: 26, borderRadius: 999, overflow: "hidden", background: "rgba(var(--sport-color-rgb, 46,204,113),0.2)", flexShrink: 0, display: "grid", placeItems: "center", visibility: showName ? "visible" : "hidden" }}>
                              {prof?.avatar_url ? <img src={prof.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 12, fontWeight: 900, color: "var(--sport-color)" }}>{pname[0]?.toUpperCase()}</span>}
                            </div>
                          )}
                          <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 2 }}>
                            {showName && <div style={{ fontSize: 10, color: "var(--sport-color)", fontWeight: 800, paddingLeft: 4 }}>{pname}</div>}
                            <div style={{ padding: "8px 12px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMe ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))" : "rgba(255,255,255,0.09)", color: isMe ? "#000" : "#fff", fontSize: 13, lineHeight: 1.4, overflowWrap: "anywhere", fontWeight: isMe ? 700 : 400 }}>
                              {msg.message}
                            </div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{timeAgo(msg.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
              }
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: "10px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <input value={chatText} onChange={e => setChatText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Escribe un mensaje…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none" }} />
              <button onClick={sendChat} disabled={!chatText.trim()}
                style={{ width: 38, height: 38, borderRadius: 999, background: chatText.trim() ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))" : "rgba(255,255,255,0.08)", border: "none", color: chatText.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: chatText.trim() ? "pointer" : "default", fontSize: 18, display: "grid", placeItems: "center", fontWeight: 900 }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INVITAR */}
      {inviteOpenFor && inviteTraining && (
        <div onClick={() => setInviteOpenFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 29000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(560px,100%)", background: "#111", borderRadius: 18, border: "1px solid rgba(255,255,255,0.14)", padding: 16, maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, color: "var(--sport-color)", fontSize: 16 }}>📣 Invitar jugadores</div>
              <button onClick={() => setInviteOpenFor(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 10px", cursor: "pointer", fontWeight: 900 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>"{inviteTraining.title}" · {formatWhen(inviteTraining.start_at)}</div>
            <input value={inviteQuery} onChange={e => setInviteQuery(e.target.value)} placeholder="Busca por nombre o @handle…" style={{ ...IS, marginBottom: 10 }} autoFocus />
            {inviteSelected.length > 0 && (
              <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {inviteSelected.map(id => (
                  <button key={id} onClick={() => setInviteSelected(prev => prev.filter(x => x !== id))}
                    style={{ padding: "3px 8px", borderRadius: 8, background: "rgba(var(--sport-color-rgb, 46,204,113),0.2)", border: "1px solid var(--sport-color)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
                    {profiles[id]?.name || id.slice(0, 8)} ✕
                  </button>
                ))}
              </div>
            )}
            {inviteQuery.trim().length < 3
              ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, padding: "10px 0" }}>Escribe al menos 3 letras para buscar.</div>
              : inviteResults.length === 0
                ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, padding: "10px 0" }}>Sin resultados.</div>
                : inviteResults.map(p => {
                    const pid = String(p.id);
                    const sel = inviteSelected.includes(pid);
                    return (
                      <button key={pid} onClick={() => setInviteSelected(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid].slice(0, 10))}
                        style={{ width: "100%", textAlign: "left", marginBottom: 6, padding: 10, borderRadius: 10, border: `1px solid ${sel ? "var(--sport-color)" : "rgba(255,255,255,0.1)"}`, background: sel ? "rgba(var(--sport-color-rgb, 46,204,113),0.18)" : "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        {p.avatar_url ? <img src={p.avatar_url} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🦍</span>}
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{sel ? "✅ " : ""}{p.name || p.handle}</div>
                          <div style={{ opacity: 0.5, fontSize: 11 }}>@{p.handle}</div>
                        </div>
                      </button>
                    );
                  })
            }
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => sendInvites(inviteTraining)} disabled={inviteBusy || inviteSelected.length === 0}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: inviteBusy || inviteSelected.length === 0 ? "rgba(var(--sport-color-rgb, 46,204,113),0.3)" : "var(--sport-color)", color: "#000", fontWeight: 900, border: "none", cursor: inviteBusy || inviteSelected.length === 0 ? "not-allowed" : "pointer", fontSize: 13 }}>
                {inviteBusy ? "Enviando…" : `📣 Invitar${inviteSelected.length ? ` (${inviteSelected.length})` : ""}`}
              </button>
              <button onClick={() => { setInviteQuery(""); setInviteResults([]); setInviteSelected([]); }}
                style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 12 }}>Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)" }}>
            <h2 style={{ color: "var(--sport-color)", marginBottom: 20, fontSize: 18, fontWeight: 900 }}>💪 Crear Entrenamiento</h2>
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
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(var(--sport-color-rgb, 46,204,113),0.06)", border: "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.15)", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  🎾 <strong style={{ color: "var(--sport-color)" }}>{Math.floor(Number(form.totalSpots) / 2)}</strong> plazas derecha · 🔄 <strong style={{ color: "#8b5cf6" }}>{Number(form.totalSpots) - Math.floor(Number(form.totalSpots) / 2)}</strong> plazas revés
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleCreate} disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: saving ? "rgba(var(--sport-color-rgb, 46,204,113),0.4)" : "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                  {saving ? "⏳ Creando..." : "✅ Crear Entrenamiento"}
                </button>
                <button onClick={() => setOpenCreate(false)}
                  style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14 }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    {trainingPayModal && (
      <MatchPaymentModal
        match={{
          ...trainingPayModal,
          id: trainingPayModal.id,
          club_name: trainingPayModal.clubName || trainingPayModal.club_name || trainingPayModal.location,
          start_at: trainingPayModal.date ? `${trainingPayModal.date}T${trainingPayModal.time||"19:00"}:00` : null,
          level: trainingPayModal.level,
          price_per_player: trainingPayModal.price_per_spot || 0,
          _sport: "padel",
          _table: "trainings",
        }}
        session={{ user: { id: uid } }}
        isCreatorAuth={false}
        onClose={() => { setTrainingPayModal(null); setPendingHand(null); }}
        onJoined={async () => { await joinAfterPayment(trainingPayModal, pendingHand); }}
      />
    )}
  );
}