// src/pages/TeacherRegisterPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const SPECIALTIES = [
  { key: "wheelchair", label: "Silla de ruedas",       emoji: "♿" },
  { key: "blind",      label: "Ceguera / baja visión", emoji: "🦯" },
  { key: "down",       label: "Síndrome de Down",      emoji: "💙" },
  { key: "autism",     label: "Autismo",               emoji: "🌟" },
  { key: "senior",     label: "Mayores",               emoji: "👴" },
  { key: "kids",       label: "Niños",                 emoji: "👦" },
  { key: "beginner",   label: "Iniciación",            emoji: "🌱" },
];

const SPORTS = [
  { key: "padel",      label: "Pádel",      emoji: "🎾" },
  { key: "tenis",      label: "Tenis",      emoji: "🎾" },
  { key: "pickleball", label: "Pickleball", emoji: "🏓" },
];

const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

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

  const [step, setStep] = useState(1); // 1=info, 2=especialidades, 3=calendario
  const [form, setForm] = useState({ name: "", bio: "", city: "", price_per_hour: "" });
  const [selectedSports, setSelectedSports] = useState(new Set(["padel"]));
  const [selectedSpecs, setSelectedSpecs] = useState(new Set());
  
  // Calendario: { "lunes": ["09:00","10:00","11:00"], ... }
  const [schedule, setSchedule] = useState({});
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function toggleSet(setter, set, key) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  function toggleHour(dayIdx, hour) {
    const dayKey = String(dayIdx);
    const current = schedule[dayKey] || [];
    const next = current.includes(hour)
      ? current.filter(h => h !== hour)
      : [...current, hour].sort();
    setSchedule(prev => ({ ...prev, [dayKey]: next }));
  }

  async function handleSubmit() {
    if (!session) { navigate("/login"); return; }
    if (!form.name.trim()) { setError("Escribe tu nombre"); return; }
    setSaving(true); setError(null);
    try {
      // Insertar profesor
      const { data: teacher, error: tErr } = await supabase
        .from("teachers")
        .insert({
          user_id: session.user.id,
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          city: form.city.trim() || null,
          price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
          sports: Array.from(selectedSports),
          specialties: Array.from(selectedSpecs),
          is_active: true,
          active: true,
          verified: false,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      // Guardar disponibilidad del calendario
      const avRows = [];
      for (const [dayIdx, hours] of Object.entries(schedule)) {
        for (const hour of hours) {
          const startH = parseInt(hour.split(":")[0]);
          avRows.push({
            teacher_id: teacher.id,
            day_of_week: parseInt(dayIdx),
            start_time: hour,
            end_time: `${String(startH + 1).padStart(2,"0")}:00`,
            recurring: true,
          });
        }
      }
      if (avRows.length > 0) {
        await supabase.from("teacher_availability").insert(avRows);
      }

      setDone(true);
    } catch (e) {
      setError(e.message);
      console.error(e);
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

        {/* Progress steps */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= step ? sportColor : "rgba(255,255,255,0.12)", transition: "background 0.3s" }} />
          ))}
        </div>

        {error && <div style={{ background: "rgba(220,38,38,0.15)", padding: "12px 16px", borderRadius: 12, color: "#ff6b6b", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>⚠️ {error}</div>}

        {/* PASO 1 — Info básica */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>👤 Tu información</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0 }}>Cuéntanos quién eres y qué enseñas</p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Tu nombre *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre completo" style={IS} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Ciudad</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Ej: Málaga" style={IS} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Sobre ti</label>
              <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
                placeholder="Tu experiencia, certificaciones, metodología…"
                style={{ ...IS, minHeight: 100, resize: "vertical" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>💶 Precio por hora (€)</label>
              <input type="number" min="0" step="5" value={form.price_per_hour} onChange={e => setForm({...form, price_per_hour: e.target.value})} placeholder="Ej: 40" style={IS} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🎾 Deportes que enseñas</label>
              <div style={{ display: "flex", gap: 10 }}>
                {SPORTS.map(s => (
                  <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSports, selectedSports, s.key)}
                    style={{ flex: 1, minHeight: 64, borderRadius: 14, border: selectedSports.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSports.has(s.key) ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => { if (!form.name.trim()) { setError("Escribe tu nombre"); return; } setError(null); setStep(2); }}
              style={{ width: "100%", minHeight: 56, borderRadius: 16, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 17 }}>
              Siguiente →
            </button>
          </div>
        )}

        {/* PASO 2 — Especialidades */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>♿ Especialidades</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>
                Selecciona con qué tipo de alumnos tienes experiencia. Esto te hará destacar para personas con capacidades especiales.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SPECIALTIES.map(s => (
                <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSpecs, selectedSpecs, s.key)}
                  style={{ minHeight: 60, padding: "14px 18px", borderRadius: 14, border: selectedSpecs.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSpecs.has(s.key) ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 26 }}>{s.emoji}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {selectedSpecs.has(s.key) && <span style={{ color: sportColor, fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(1)}
                style={{ minHeight: 52, padding: "14px 20px", borderRadius: 14, background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 15 }}>
                ← Atrás
              </button>
              <button onClick={() => setStep(3)}
                style={{ flex: 1, minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 — Calendario disponibilidad */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>📅 Tu disponibilidad</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>
                Pulsa las horas en las que estás disponible cada día. Los alumnos podrán reservar en esos huecos.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, padding: "6px 4px", textAlign: "center", minWidth: 44 }}>Hora</th>
                    {DAYS.map((d, i) => (
                      <th key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", fontWeight: 900, padding: "6px 4px", textAlign: "center", minWidth: 44 }}>{d.slice(0,3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.slice(0, -1).map((hour, hi) => (
                    <tr key={hour}>
                      <td style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{hour}</td>
                      {DAYS.map((_, di) => {
                        const isOn = (schedule[String(di)] || []).includes(hour);
                        return (
                          <td key={di} style={{ padding: "3px 4px", textAlign: "center" }}>
                            <button onClick={() => toggleHour(di, hour)}
                              style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", background: isOn ? sportColor : "rgba(255,255,255,0.07)", transition: "background 0.15s", fontSize: isOn ? 14 : 0 }}>
                              {isOn ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", textAlign: "center" }}>
              Puedes actualizar tu disponibilidad más tarde desde tu perfil
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(2)}
                style={{ minHeight: 52, padding: "14px 20px", borderRadius: 14, background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 15 }}>
                ← Atrás
              </button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex: 1, minHeight: 56, borderRadius: 14, background: saving ? "rgba(255,255,255,0.10)" : `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: saving ? "rgba(255,255,255,0.35)" : "#000", fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 17 }}>
                {saving ? "⏳ Creando perfil…" : "✅ Crear mi perfil"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
