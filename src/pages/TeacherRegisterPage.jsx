// src/pages/TeacherRegisterPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const SPORTS = [
  { key: "padel",      label: "Pádel",       emoji: "🎾" },
  { key: "tenis",      label: "Tenis",       emoji: "🎾" },
  { key: "pickleball", label: "Pickleball",  emoji: "🏓" },
];

const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const IS = {
  width: "100%", minHeight: 52, padding: "14px 16px", borderRadius: 12,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", fontSize: 16, boxSizing: "border-box",
};

export default function TeacherRegisterPage() {
  const navigate = useNavigate();
  const { sportInfo } = useSport();
  const { session } = useSession();
  const sportColor = sportInfo?.color || "#2ECC71";

  const [form, setForm] = useState({
    name: "", bio: "", city: "", price_per_hour: "",
  });
  const [selectedSports, setSelectedSports] = useState(new Set(["padel"]));
  const [selectedSpecs, setSelectedSpecs] = useState(new Set());
  const [availability, setAvailability] = useState([
    { day: 0, start: "09:00", end: "13:00" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function toggleSet(setter, set, key) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  function addAvailability() {
    setAvailability(prev => [...prev, { day: 0, start: "09:00", end: "13:00" }]);
  }

  function removeAvailability(i) {
    setAvailability(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!session) { navigate("/login"); return; }
    if (!form.name.trim()) { setError("Escribe tu nombre"); return; }
    if (selectedSports.size === 0) { setError("Elige al menos un deporte"); return; }
    setSaving(true); setError(null);
    try {
      const { data: teacher, error: tErr } = await supabase.from("teachers").insert({
        user_id: session.user.id,
        name: form.name.trim(),
        bio: form.bio.trim(),
        city: form.city.trim(),
        price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
        sports: Array.from(selectedSports),
        specialties: Array.from(selectedSpecs),
        active: true,
        verified: false,
      }).select().single();
      if (tErr) throw tErr;

      // Guardar disponibilidad
      if (availability.length > 0 && teacher?.id) {
        const avRows = availability.map(av => ({
          teacher_id: teacher.id,
          day_of_week: av.day,
          start_time: av.start,
          end_time: av.end,
          recurring: true,
        }));
        await supabase.from("teacher_availability").insert(avRows);
      }
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff" }}>
      <div style={{ textAlign: "center", padding: 32, maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: sportColor, marginBottom: 12 }}>¡Perfil creado!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginBottom: 24, lineHeight: 1.7 }}>
          Tu perfil ya está visible. El equipo de GorilaGo! lo verificará pronto.
        </div>
        <button onClick={() => navigate("/aprende")}
          style={{ width: "100%", minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
          Ver profesores
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "90px 16px 80px" }}>

        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>📚 Registro de profesor</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.6 }}>
          Crea tu perfil y llega a miles de alumnos en GorilaGo! Incluye tus especialidades para personas con capacidades especiales.
        </p>

        {error && <div style={{ background: "rgba(220,38,38,0.15)", padding: "12px 16px", borderRadius: 12, color: "#ff6b6b", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>⚠️ {error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Nombre */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>👤 Tu nombre *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre completo" style={IS} />
          </div>

          {/* Ciudad */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>📍 Ciudad</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Ej: Málaga" style={IS} />
          </div>

          {/* Bio */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>📝 Sobre ti</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
              placeholder="Tu experiencia, certificaciones, metodología…"
              style={{ ...IS, minHeight: 100, resize: "vertical" }} />
          </div>

          {/* Precio */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>💶 Precio por hora (€)</label>
            <input type="number" min="0" step="5" value={form.price_per_hour} onChange={e => setForm({...form, price_per_hour: e.target.value})} placeholder="Ej: 40" style={IS} />
          </div>

          {/* Deportes */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🎾 Deportes que enseñas *</label>
            <div style={{ display: "flex", gap: 10 }}>
              {SPORTS.map(s => (
                <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSports, selectedSports, s.key)}
                  style={{ flex: 1, minHeight: 60, borderRadius: 14, border: selectedSports.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSports.has(s.key) ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 22 }}>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>♿ Especialidades (capacidades especiales)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SPECIALTIES.map(s => (
                <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSpecs, selectedSpecs, s.key)}
                  style={{ minHeight: 52, padding: "12px 16px", borderRadius: 12, border: selectedSpecs.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSpecs.has(s.key) ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{s.emoji}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {selectedSpecs.has(s.key) && <span style={{ color: sportColor }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Disponibilidad */}
          <div>
            <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>📅 Tu disponibilidad semanal</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {availability.map((av, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <select value={av.day} onChange={e => setAvailability(prev => prev.map((x, idx) => idx === i ? {...x, day: parseInt(e.target.value)} : x))} style={IS}>
                    {DAYS.map((d, di) => <option key={di} value={di} style={{background:"#1e293b"}}>{d}</option>)}
                  </select>
                  <select value={av.start} onChange={e => setAvailability(prev => prev.map((x, idx) => idx === i ? {...x, start: e.target.value} : x))} style={IS}>
                    {["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map(t => <option key={t} value={t} style={{background:"#1e293b"}}>{t}</option>)}
                  </select>
                  <select value={av.end} onChange={e => setAvailability(prev => prev.map((x, idx) => idx === i ? {...x, end: e.target.value} : x))} style={IS}>
                    {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"].map(t => <option key={t} value={t} style={{background:"#1e293b"}}>{t}</option>)}
                  </select>
                  <button onClick={() => removeAvailability(i)}
                    style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#ff6b6b", fontSize: 18, cursor: "pointer" }}>🗑️</button>
                </div>
              ))}
              <button onClick={addAvailability}
                style={{ minHeight: 48, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: `1px dashed ${sportColor}50`, color: sportColor, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                + Añadir franja horaria
              </button>
            </div>
          </div>

          {/* Botón */}
          <button onClick={handleSubmit} disabled={saving}
            style={{ width: "100%", minHeight: 60, borderRadius: 16, background: saving ? "rgba(255,255,255,0.10)" : `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 18 }}>
            {saving ? "⏳ Guardando…" : "✅ Crear mi perfil de profesor"}
          </button>
        </div>
      </div>
    </div>
  );
}
