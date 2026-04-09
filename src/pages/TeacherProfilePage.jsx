// src/pages/TeacherProfilePage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const SPECIALTIES = [
  { key: "wheelchair", label: "Silla de ruedas", emoji: "♿" },
  { key: "blind",      label: "Ceguera / baja visión", emoji: "🦯" },
  { key: "down",       label: "Síndrome de Down", emoji: "💙" },
  { key: "autism",     label: "Autismo", emoji: "🌟" },
  { key: "senior",     label: "Mayores", emoji: "👴" },
  { key: "kids",       label: "Niños", emoji: "👦" },
  { key: "beginner",   label: "Iniciación", emoji: "🌱" },
];

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getNextDays(n = 14) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function TeacherProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sportInfo } = useSport();
  const { session } = useSession();

  const [teacher, setTeacher] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStep, setBookingStep] = useState(null); // null | "confirm" | "paying"
  const [paymentOption, setPaymentOption] = useState("fee_only"); // fee_only | full
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const sportColor = sportInfo?.color || "#2ECC71";
  const days = getNextDays(14);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    const [{ data: t }, { data: av }, { data: bk }, { data: rv }] = await Promise.all([
      supabase.from("teachers").select("*").eq("id", id).single(),
      supabase.from("teacher_availability").select("*").eq("teacher_id", id),
      supabase.from("class_bookings").select("date, start_time, end_time, status").eq("teacher_id", id).neq("status", "cancelled"),
      supabase.from("teacher_reviews").select("*, profiles(name, avatar_url)").eq("teacher_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setTeacher(t);
    setAvailability(av || []);
    setBookings(bk || []);
    setReviews(rv || []);
    setLoading(false);
  }

  function getSlotsForDate(date) {
    const dow = (date.getDay() + 6) % 7; // 0=lunes
    const dateStr = date.toISOString().slice(0, 10);
    const slots = [];
    for (const av of availability) {
      if (av.recurring && av.day_of_week === dow) {
        let start = parseInt(av.start_time.slice(0, 2));
        const end = parseInt(av.end_time.slice(0, 2));
        while (start < end) {
          const startStr = `${String(start).padStart(2,"0")}:00`;
          const endStr = `${String(start+1).padStart(2,"0")}:00`;
          const isBooked = bookings.some(b => b.date === dateStr && b.start_time?.slice(0,5) === startStr);
          if (!isBooked) slots.push({ start: startStr, end: endStr });
          start++;
        }
      }
      if (!av.recurring && av.specific_date === dateStr) {
        let start = parseInt(av.start_time.slice(0, 2));
        const end = parseInt(av.end_time.slice(0, 2));
        while (start < end) {
          const startStr = `${String(start).padStart(2,"0")}:00`;
          const endStr = `${String(start+1).padStart(2,"0")}:00`;
          const isBooked = bookings.some(b => b.date === dateStr && b.start_time?.slice(0,5) === startStr);
          if (!isBooked) slots.push({ start: startStr, end: endStr });
          start++;
        }
      }
    }
    return slots;
  }

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  async function submitReview() {
    if (!session) { navigate("/login"); return; }
    setSavingReview(true);
    try {
      await supabase.from("teacher_reviews").insert({
        teacher_id: teacher.id,
        student_id: session.user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewDone(true);
      setShowReviewModal(false);
      setReviewComment("");
      setReviewRating(5);
      await loadData();
    } catch (e) { alert(e.message); }
    finally { setSavingReview(false); }
  }

  async function confirmBooking() {
    if (!session) { navigate("/login"); return; }
    setSaving(true);
    try {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const price = paymentOption === "full" ? teacher.price_per_hour : 0;
      const { error } = await supabase.from("class_bookings").insert({
        teacher_id: teacher.id,
        student_id: session.user.id,
        date: dateStr,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        sport: sportInfo?.key || "padel",
        price,
        payment_status: paymentOption,
        notes: notes.trim(),
        status: "confirmed",
      });
      if (error) throw error;
      setBookingStep("success");
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

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
        <button onClick={() => navigate("/aprende")} style={{ marginTop: 16, minHeight: 52, padding: "14px 24px", borderRadius: 14, background: sportColor, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
          Volver
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Perfil header */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 28 }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, overflow: "hidden", flexShrink: 0, background: `${sportColor}20`, border: `2px solid ${sportColor}40`, display: "grid", placeItems: "center" }}>
            {teacher.avatar_url
              ? <img src={teacher.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 40 }}>🎾</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{teacher.name}</h1>
              {teacher.verified && <span style={{ fontSize: 12, fontWeight: 900, color: sportColor, background: `${sportColor}18`, padding: "4px 10px", borderRadius: 999 }}>✓ Verificado</span>}
            </div>
            {teacher.city && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>📍 {teacher.city}</div>}
            <div style={{ fontSize: 20, fontWeight: 900, color: sportColor }}>
              {teacher.price_per_hour ? `${teacher.price_per_hour}€/hora` : "Precio a consultar"}
            </div>
            {avgRating && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: 18, color: s <= Math.round(avgRating) ? "#F59E0B" : "rgba(255,255,255,0.20)" }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>{avgRating}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>({reviews.length} valoraciones)</span>
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

        {/* Especialidades */}
        {(teacher.specialties || []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>♿ Especialidades</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(teacher.specialties || []).map(s => {
                const spec = SPECIALTIES.find(x => x.key === s);
                return spec ? (
                  <span key={s} style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, background: `${sportColor}15`, border: `1px solid ${sportColor}40`, color: "#fff" }}>
                    {spec.emoji} {spec.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Deportes */}
        {(teacher.sports || []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>🎾 Deportes</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(teacher.sports || []).map(s => (
                <span key={s} style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", textTransform: "capitalize" }}>
                  {s === "padel" ? "🎾 Pádel" : s === "tenis" ? "🎾 Tenis" : "🏓 Pickleball"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Botón valorar */}
        {session && (
          <button onClick={() => setShowReviewModal(true)}
            style={{ width: "100%", minHeight: 52, borderRadius: 14, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.30)", color: "#F59E0B", fontWeight: 900, fontSize: 15, cursor: "pointer", marginBottom: 24 }}>
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
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{r.profiles?.name || "Usuario"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(s => (
                        <span key={s} style={{ fontSize: 16, color: s <= r.rating ? "#F59E0B" : "rgba(255,255,255,0.20)" }}>★</span>
                      ))}
                    </div>
                  </div>
                  {r.comment && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{r.comment}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendario */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>📅 Elige un día</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {days.map((d, i) => {
              const slots = getSlotsForDate(d);
              const isSelected = selectedDate?.toDateString() === d.toDateString();
              const hasSlots = slots.length > 0;
              return (
                <button key={i} onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                  disabled={!hasSlots}
                  style={{ flexShrink: 0, width: 60, minHeight: 72, borderRadius: 14, border: isSelected ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: isSelected ? `${sportColor}20` : hasSlots ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", cursor: hasSlots ? "pointer" : "not-allowed", opacity: hasSlots ? 1 : 0.35, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{DAYS[(d.getDay() + 6) % 7]}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isSelected ? sportColor : "#fff" }}>{d.getDate()}</div>
                  {hasSlots && <div style={{ fontSize: 9, fontWeight: 700, color: sportColor }}>{slots.length}h</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots del día seleccionado */}
        {selectedDate && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>⏰ Horas disponibles</div>
            {getSlotsForDate(selectedDate).length === 0 ? (
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", padding: "16px 0" }}>No hay horas disponibles este día</div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {getSlotsForDate(selectedDate).map((slot, i) => (
                  <button key={i} onClick={() => { setSelectedSlot(slot); setBookingStep("confirm"); }}
                    style={{ minHeight: 56, padding: "12px 20px", borderRadius: 14, border: selectedSlot?.start === slot.start ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.12)", background: selectedSlot?.start === slot.start ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                    {slot.start} – {slot.end}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal reserva */}
        {bookingStep === "confirm" && selectedSlot && (
          <div onClick={() => setBookingStep(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.90)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f172a", borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: "max(24px,env(safe-area-inset-bottom))", border: `1px solid ${sportColor}30` }}>

              <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>📅 Confirmar clase</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
                {teacher.name} · {selectedDate?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {selectedSlot.start} – {selectedSlot.end}
              </div>

              {/* Opciones de pago */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>💶 ¿Cómo quieres pagar?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => setPaymentOption("fee_only")}
                    style={{ minHeight: 60, padding: "14px 18px", borderRadius: 14, border: paymentOption === "fee_only" ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: paymentOption === "fee_only" ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🔒</span>
                    <div>
                      <div style={{ fontWeight: 900 }}>Solo comisión GorilaGo! — 0,30€</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>Pagas el resto al profesor en mano o luego</div>
                    </div>
                    {paymentOption === "fee_only" && <span style={{ marginLeft: "auto", color: sportColor, fontSize: 20 }}>✓</span>}
                  </button>
                  {teacher.price_per_hour && (
                    <button onClick={() => setPaymentOption("full")}
                      style={{ minHeight: 60, padding: "14px 18px", borderRadius: 14, border: paymentOption === "full" ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: paymentOption === "full" ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 22 }}>💳</span>
                      <div>
                        <div style={{ fontWeight: 900 }}>Pagar todo ahora — {teacher.price_per_hour}€ + 0,30€</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>Clase totalmente pagada por adelantado</div>
                      </div>
                      {paymentOption === "full" && <span style={{ marginLeft: "auto", color: sportColor, fontSize: 20 }}>✓</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* Notas */}
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

        {/* Éxito */}
        {bookingStep === "success" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 50000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#0f172a", borderRadius: 24, padding: 32, maxWidth: 400, width: "90%", textAlign: "center", border: `1px solid ${sportColor}30` }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: sportColor, marginBottom: 8 }}>¡Clase reservada!</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginBottom: 24, lineHeight: 1.6 }}>
                {teacher.name} recibirá tu solicitud. Te avisaremos cuando la confirme.
              </div>
              <button onClick={() => { setBookingStep(null); setSelectedSlot(null); }}
                style={{ width: "100%", minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
                Perfecto
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal valorar */}
      {showReviewModal && (
        <div onClick={() => setShowReviewModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.90)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f172a", borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: "max(24px,env(safe-area-inset-bottom))", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>⭐ Valorar a {teacher.name}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", marginBottom: 20 }}>Tu opinión ayuda a otros alumnos</div>

            {/* Estrellas */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewRating(s)}
                  style={{ fontSize: 40, background: "none", border: "none", cursor: "pointer", color: s <= reviewRating ? "#F59E0B" : "rgba(255,255,255,0.20)", transition: "color 0.15s, transform 0.1s", transform: s <= reviewRating ? "scale(1.1)" : "scale(1)" }}>
                  ★
                </button>
              ))}
            </div>

            {/* Comentario */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 15, fontWeight: 700, display: "block", marginBottom: 8, color: "rgba(255,255,255,0.80)" }}>💬 Comentario (opcional)</label>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                placeholder="Cuéntanos tu experiencia con este profesor…"
                style={{ width: "100%", minHeight: 90, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={submitReview} disabled={savingReview}
                style={{ width: "100%", minHeight: 56, borderRadius: 16, background: savingReview ? "rgba(245,158,11,0.20)" : "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", fontWeight: 900, border: "none", cursor: savingReview ? "not-allowed" : "pointer", fontSize: 17 }}>
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
