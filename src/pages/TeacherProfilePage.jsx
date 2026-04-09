// src/pages/TeacherProfilePage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const SPECIALTIES = [
  { key: "wheelchair", label: "Silla de ruedas",       emoji: "♿", cat: "inclusivo" },
  { key: "blind",      label: "Ceguera / baja visión", emoji: "🦯", cat: "inclusivo" },
  { key: "down",       label: "Síndrome de Down",      emoji: "💙", cat: "inclusivo" },
  { key: "autism",     label: "Autismo",               emoji: "🌟", cat: "inclusivo" },
  { key: "senior",     label: "Mayores",               emoji: "👴", cat: "inclusivo" },
  { key: "kids",       label: "Niños",                 emoji: "👦", cat: "tecnico" },
  { key: "beginner",   label: "Iniciación",            emoji: "🌱", cat: "tecnico" },
  { key: "reves",      label: "Revés",                 emoji: "🎾", cat: "tecnico" },
  { key: "volea",      label: "Volea",                 emoji: "🏓", cat: "tecnico" },
  { key: "saque",      label: "Saque",                 emoji: "💥", cat: "tecnico" },
  { key: "competicion",label: "Competición",           emoji: "🏆", cat: "tecnico" },
  { key: "fisico",     label: "Preparación física",    emoji: "💪", cat: "tecnico" },
];

const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"];

function getNextDays(n = 21) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtDay(d) {
  const days = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  return { dow: days[d.getDay()], day: d.getDate(), month: d.getMonth()+1 };
}

export default function TeacherProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sportInfo } = useSport();
  const { session } = useSession();

  const [teacher, setTeacher] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStep, setBookingStep] = useState(null);
  const [paymentOption, setPaymentOption] = useState("fee_only");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const sportColor = sportInfo?.color || "#2ECC71";
  const days = getNextDays(21);
  const isOwner = session?.user?.id && teacher?.user_id === session.user.id;

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    const [{ data: t }, { data: av }, { data: bk }, { data: rv }] = await Promise.all([
      supabase.from("teachers").select("*").eq("id", id).single(),
      supabase.from("teacher_availability").select("*").eq("teacher_id", id).eq("is_available", true).gte("date", new Date().toISOString().slice(0,10)),
      supabase.from("class_bookings").select("date,start_time,end_time,status").eq("teacher_id", id).neq("status","cancelled"),
      supabase.from("teacher_reviews").select("*, profiles(name,avatar_url)").eq("teacher_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setTeacher(t);
    setAvailability(av || []);
    setBookings(bk || []);
    setReviews(rv || []);
    setLoading(false);
  }

  // Para el dueño: toggle disponibilidad en fecha+hora
  async function toggleAvailability(date, hour) {
    if (!isOwner) return;
    const ds = dateStr(date);
    const endH = `${pad(parseInt(hour.split(":")[0])+1)}:00`;
    const existing = availability.find(a => a.date === ds && a.start_time.slice(0,5) === hour);
    if (existing) {
      await supabase.from("teacher_availability").delete().eq("id", existing.id);
      setAvailability(prev => prev.filter(a => a.id !== existing.id));
    } else {
      const { data } = await supabase.from("teacher_availability").insert({
        teacher_id: teacher.id, date: ds, start_time: hour, end_time: endH, is_available: true,
      }).select().single();
      if (data) setAvailability(prev => [...prev, data]);
    }
  }

  function getSlotsForDate(date) {
    const ds = dateStr(date);
    return availability.filter(a => a.date === ds).filter(a => {
      return !bookings.some(b => b.date === ds && b.start_time?.slice(0,5) === a.start_time?.slice(0,5));
    }).sort((a,b) => a.start_time > b.start_time ? 1 : -1);
  }

  function hasAnySlot(date) {
    return getSlotsForDate(date).length > 0;
  }

  async function confirmBooking() {
    if (!session) { navigate("/login"); return; }
    setSaving(true);
    try {
      const ds = dateStr(selectedDate);
      const { error } = await supabase.from("class_bookings").insert({
        teacher_id: teacher.id,
        student_id: session.user.id,
        date: ds,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        sport: sportInfo?.key || "padel",
        price: paymentOption === "full" ? teacher.price_per_hour : 0,
        payment_status: paymentOption,
        notes: notes.trim(),
        status: "confirmed",
      });
      if (error) throw error;
      setBookingStep("success");
      await loadData();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function submitReview() {
    if (!session) return;
    setSavingReview(true);
    try {
      await supabase.from("teacher_reviews").insert({
        teacher_id: teacher.id, student_id: session.user.id,
        rating: reviewRating, comment: reviewComment.trim(),
      });
      setShowReviewModal(false);
      setReviewComment(""); setReviewRating(5);
      await loadData();
    } catch (e) { alert(e.message); }
    finally { setSavingReview(false); }
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const inclusiveSpecs = SPECIALTIES.filter(s => s.cat === "inclusivo" && (teacher?.specialties || []).includes(s.key));
  const techSpecs = SPECIALTIES.filter(s => s.cat === "tecnico" && (teacher?.specialties || []).includes(s.key));

  if (loading) return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.50)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
        <div style={{ fontSize: 16 }}>Cargando perfil…</div>
      </div>
    </div>
  );

  if (!teacher) return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, color: "#ff6b6b" }}>Profesor no encontrado</div>
        <button onClick={() => navigate("/aprende")} style={{ marginTop: 16, minHeight: 52, padding: "14px 24px", borderRadius: 14, background: sportColor, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>Volver</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Aviso dueño */}
        {isOwner && (
          <div style={{ padding: "12px 16px", borderRadius: 14, background: `${sportColor}15`, border: `1px solid ${sportColor}40`, fontSize: 14, fontWeight: 700, color: sportColor, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            ✏️ Estás viendo tu perfil — pulsa las horas del calendario para añadir o quitar disponibilidad
          </div>
        )}

        {/* Header perfil */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, overflow: "hidden", flexShrink: 0, background: `${sportColor}20`, border: `2px solid ${sportColor}40`, display: "grid", placeItems: "center" }}>
            {teacher.avatar_url ? <img src={teacher.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 40 }}>🎾</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{teacher.name}</h1>
              {teacher.verified && <span style={{ fontSize: 12, fontWeight: 900, color: sportColor, background: `${sportColor}18`, padding: "4px 10px", borderRadius: 999 }}>✓ Verificado</span>}
            </div>
            {teacher.city && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>📍 {teacher.city}</div>}
            <div style={{ fontSize: 20, fontWeight: 900, color: sportColor, marginBottom: 6 }}>
              {teacher.price_per_hour ? `${teacher.price_per_hour}€/hora` : "Precio a consultar"}
            </div>
            {avgRating && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 18, color: s <= Math.round(avgRating) ? "#F59E0B" : "rgba(255,255,255,0.20)" }}>★</span>)}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>{avgRating}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>({reviews.length})</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {teacher.bio && (
          <div style={{ background: "#111827", borderRadius: 16, padding: "16px 20px", marginBottom: 20, fontSize: 15, color: "rgba(255,255,255,0.70)", lineHeight: 1.7 }}>
            {teacher.bio}
          </div>
        )}

        {/* Especialidades inclusivas */}
        {inclusiveSpecs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.70)" }}>♿ Experiencia con capacidades especiales</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {inclusiveSpecs.map(s => (
                <span key={s.key} style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", color: "#fff" }}>
                  {s.emoji} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Especialidades técnicas */}
        {techSpecs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.70)" }}>🎾 Especialidades técnicas</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {techSpecs.map(s => (
                <span key={s.key} style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, background: `${sportColor}12`, border: `1px solid ${sportColor}40`, color: "#fff" }}>
                  {s.emoji} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deportes */}
        {(teacher.sports || []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, color: "rgba(255,255,255,0.70)" }}>🎾 Deportes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(teacher.sports || []).map(s => (
                <span key={s} style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                  {s === "padel" ? "🎾 Pádel" : s === "tenis" ? "🎾 Tenis" : "🏓 Pickleball"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CALENDARIO */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
            📅 {isOwner ? "Mi disponibilidad — pulsa para editar" : "Horas disponibles"}
          </div>
          {isOwner && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>Verde = disponible · Vacío = no disponible</div>}

          {/* Selector de semana */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
            {days.map((d, i) => {
              const { dow, day } = fmtDay(d);
              const hasSlots = hasAnySlot(d);
              const isSelected = selectedDate && dateStr(selectedDate) === dateStr(d);
              return (
                <button key={i} onClick={() => setSelectedDate(d)}
                  style={{ flexShrink: 0, width: 56, minHeight: 70, borderRadius: 14, border: isSelected ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: isSelected ? `${sportColor}20` : "rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.50)" }}>{dow}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isSelected ? sportColor : "#fff" }}>{day}</div>
                  {hasSlots && <div style={{ width: 6, height: 6, borderRadius: 999, background: sportColor }} />}
                </button>
              );
            })}
          </div>

          {/* Horas del día seleccionado */}
          {selectedDate && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.60)", marginBottom: 12 }}>
                {selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {HOURS.map(hour => {
                  const ds = dateStr(selectedDate);
                  const avSlot = availability.find(a => a.date === ds && a.start_time?.slice(0,5) === hour);
                  const isBooked = bookings.some(b => b.date === ds && b.start_time?.slice(0,5) === hour);
                  const isAvail = !!avSlot && !isBooked;

                  if (!isOwner && !isAvail) return null;

                  return (
                    <button key={hour}
                      onClick={() => {
                        if (isOwner) { toggleAvailability(selectedDate, hour); return; }
                        if (isAvail && !isBooked) { setSelectedSlot(avSlot); setBookingStep("confirm"); }
                      }}
                      disabled={isBooked}
                      style={{ minHeight: 52, padding: "10px 18px", borderRadius: 12, cursor: isBooked ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 800,
                        background: isBooked ? "rgba(255,255,255,0.04)" : isAvail ? `${sportColor}20` : isOwner ? "rgba(255,255,255,0.05)" : "transparent",
                        border: isBooked ? "1px solid rgba(255,255,255,0.06)" : isAvail ? `2px solid ${sportColor}` : isOwner ? "1px dashed rgba(255,255,255,0.20)" : "none",
                        color: isBooked ? "rgba(255,255,255,0.25)" : isAvail ? "#fff" : "rgba(255,255,255,0.35)",
                        display: isOwner || isAvail ? "flex" : "none", alignItems: "center", gap: 6,
                      }}>
                      {isBooked ? "🔒" : isAvail ? "✓" : isOwner ? "+" : ""} {hour}
                    </button>
                  );
                })}
              </div>
              {!isOwner && getSlotsForDate(selectedDate).length === 0 && (
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", padding: "16px 0" }}>No hay horas libres este día</div>
              )}
            </div>
          )}
        </div>

        {/* Botón valorar */}
        {session && !isOwner && (
          <button onClick={() => setShowReviewModal(true)}
            style={{ width: "100%", minHeight: 52, borderRadius: 14, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontWeight: 900, fontSize: 15, cursor: "pointer", marginBottom: 24 }}>
            ⭐ Valorar a este profesor
          </button>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>⭐ Valoraciones</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: "#111827", borderRadius: 16, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 999, background: `${sportColor}20`, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, color: sportColor }}>
                        {r.profiles?.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{r.profiles?.name || "Usuario"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 16, color: s <= r.rating ? "#F59E0B" : "rgba(255,255,255,0.20)" }}>★</span>)}
                    </div>
                  </div>
                  {r.comment && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{r.comment}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal reserva */}
      {bookingStep === "confirm" && selectedSlot && (
        <div onClick={() => setBookingStep(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.90)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f172a", borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: "max(24px,env(safe-area-inset-bottom))", border: `1px solid ${sportColor}30` }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>📅 Reservar clase</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
              {teacher.name} · {selectedDate?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {selectedSlot.start_time?.slice(0,5)} – {selectedSlot.end_time?.slice(0,5)}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>💶 ¿Cómo quieres pagar?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => setPaymentOption("fee_only")}
                  style={{ minHeight: 60, padding: "14px 18px", borderRadius: 14, border: paymentOption === "fee_only" ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: paymentOption === "fee_only" ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🔒</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>Solo comisión GorilaGo! — 0,30€</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>Pagas al profesor en mano o luego</div>
                  </div>
                  {paymentOption === "fee_only" && <span style={{ color: sportColor, fontSize: 20 }}>✓</span>}
                </button>
                {teacher.price_per_hour && (
                  <button onClick={() => setPaymentOption("full")}
                    style={{ minHeight: 60, padding: "14px 18px", borderRadius: 14, border: paymentOption === "full" ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: paymentOption === "full" ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>💳</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900 }}>Pagar todo ahora — {teacher.price_per_hour}€ + 0,30€</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>Clase pagada por adelantado</div>
                    </div>
                    {paymentOption === "full" && <span style={{ color: sportColor, fontSize: 20 }}>✓</span>}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.70)", display: "block", marginBottom: 8 }}>💬 Notas para el profesor (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Tu nivel, objetivos, necesidades especiales…"
                style={{ width: "100%", minHeight: 80, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={confirmBooking} disabled={saving}
                style={{ width: "100%", minHeight: 56, borderRadius: 16, background: saving ? "rgba(255,255,255,0.10)" : `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 17 }}>
                {saving ? "⏳ Reservando…" : "✅ Confirmar reserva"}
              </button>
              <button onClick={() => setBookingStep(null)}
                style={{ width: "100%", minHeight: 52, borderRadius: 16, background: "transparent", color: "rgba(255,255,255,0.55)", fontWeight: 700, border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontSize: 15 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal éxito */}
      {bookingStep === "success" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 50000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, maxWidth: 400, width: "90%", textAlign: "center", border: `1px solid ${sportColor}30` }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: sportColor, marginBottom: 8 }}>¡Clase reservada!</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginBottom: 24, lineHeight: 1.6 }}>
              {teacher.name} recibirá tu solicitud y te confirmará la clase.
            </div>
            <button onClick={() => { setBookingStep(null); setSelectedSlot(null); }}
              style={{ width: "100%", minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
              Perfecto
            </button>
          </div>
        </div>
      )}

      {/* Modal valorar */}
      {showReviewModal && (
        <div onClick={() => setShowReviewModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.90)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f172a", borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: "max(24px,env(safe-area-inset-bottom))", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>⭐ Valorar a {teacher.name}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewRating(s)}
                  style={{ fontSize: 44, background: "none", border: "none", cursor: "pointer", color: s <= reviewRating ? "#F59E0B" : "rgba(255,255,255,0.15)", transition: "all 0.15s", transform: s <= reviewRating ? "scale(1.15)" : "scale(1)" }}>★</button>
              ))}
            </div>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
              placeholder="Cuéntanos tu experiencia…"
              style={{ width: "100%", minHeight: 90, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={submitReview} disabled={savingReview}
                style={{ width: "100%", minHeight: 56, borderRadius: 16, background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 17 }}>
                {savingReview ? "⏳ Enviando…" : "⭐ Enviar valoración"}
              </button>
              <button onClick={() => setShowReviewModal(false)}
                style={{ width: "100%", minHeight: 52, borderRadius: 16, background: "transparent", color: "rgba(255,255,255,0.55)", fontWeight: 700, border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontSize: 15 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
