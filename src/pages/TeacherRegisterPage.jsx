// src/pages/TeacherRegisterPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const SPECIALTIES = [
  // Capacidades especiales
  { key: "wheelchair",  label: "Silla de ruedas",        emoji: "♿", cat: "inclusivo" },
  { key: "blind",       label: "Ceguera / baja visión",  emoji: "🦯", cat: "inclusivo" },
  { key: "down",        label: "Síndrome de Down",       emoji: "💙", cat: "inclusivo" },
  { key: "autism",      label: "Autismo",                emoji: "🌟", cat: "inclusivo" },
  { key: "deaf",        label: "Sordera",                emoji: "🦻", cat: "inclusivo" },
  { key: "cognitive",   label: "Diversidad cognitiva",   emoji: "🧠", cat: "inclusivo" },
  { key: "motor",       label: "Diversidad motora",      emoji: "🦽", cat: "inclusivo" },
  { key: "senior",      label: "Mayores +60",            emoji: "👴", cat: "inclusivo" },
  { key: "kids",        label: "Niños",                  emoji: "👦", cat: "inclusivo" },
  // Técnicas
  { key: "beginner",    label: "Iniciación",             emoji: "🌱", cat: "tecnico" },
  { key: "intermediate",label: "Nivel intermedio",       emoji: "🎾", cat: "tecnico" },
  { key: "advanced",    label: "Nivel avanzado",         emoji: "⚡", cat: "tecnico" },
  { key: "competicion", label: "Competición",            emoji: "🏆", cat: "tecnico" },
  { key: "reves",       label: "Revés",                  emoji: "↩️", cat: "tecnico" },
  { key: "volea",       label: "Volea",                  emoji: "🏓", cat: "tecnico" },
  { key: "saque",       label: "Saque / banda",          emoji: "💥", cat: "tecnico" },
  { key: "smash",       label: "Smash / remate",         emoji: "👊", cat: "tecnico" },
  { key: "globo",       label: "Globo / lob",            emoji: "🎈", cat: "tecnico" },
  { key: "bandeja",     label: "Bandeja",                emoji: "🍽️", cat: "tecnico" },
  { key: "vibora",      label: "Víbora",                 emoji: "🐍", cat: "tecnico" },
  { key: "tactica",     label: "Táctica y estrategia",   emoji: "♟️", cat: "tecnico" },
  { key: "fisico",      label: "Preparación física",     emoji: "💪", cat: "tecnico" },
  { key: "mental",      label: "Preparación mental",     emoji: "🧘", cat: "tecnico" },
  { key: "dobles",      label: "Juego en dobles",        emoji: "👥", cat: "tecnico" },
  { key: "singles",     label: "Juego individual",       emoji: "👤", cat: "tecnico" },
];

const SPORTS = [
  { key: "padel",      label: "Pádel",      emoji: "🎾" },
  { key: "tenis",      label: "Tenis",      emoji: "🎾" },
  { key: "pickleball", label: "Pickleball", emoji: "🏓" },
];

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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", bio: "", city: "", price_per_hour: "", phone: "", email: "" });
  const [selectedSports, setSelectedSports] = useState(new Set(["padel"]));
  const [selectedSpecs, setSelectedSpecs] = useState(new Set());
  const [dniFile, setDniFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function toggleSet(setter, set, key) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  async function uploadFile(file, path) {
    const { data, error } = await supabase.storage.from("teacher-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("teacher-docs").getPublicUrl(path);
    return publicUrl;
  }

  async function handleSubmit() {
    if (!session) { navigate("/login"); return; }
    if (!dniFile) { setError("El DNI es obligatorio"); return; }
    setSaving(true); setError(null);
    try {
      const uid = session.user.id;
      const dniUrl = await uploadFile(dniFile, `${uid}/dni-${Date.now()}.${dniFile.name.split(".").pop()}`);
      let certUrl = null;
      if (certFile) certUrl = await uploadFile(certFile, `${uid}/cert-${Date.now()}.${certFile.name.split(".").pop()}`);

      const { data: teacher, error: tErr } = await supabase.from("teachers").insert({
        user_id: uid,
        name: form.name.trim(),
        bio: form.bio.trim() || null,
        city: form.city.trim() || null,
        price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
        sports: Array.from(selectedSports),
        specialties: Array.from(selectedSpecs),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        dni_url: dniUrl,
        cert_url: certUrl,
        is_active: true,
        active: true,
        verified: false,
        verification_status: "pending",
      }).select().single();
      if (tErr) throw tErr;
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff" }}>
      <div style={{ textAlign: "center", padding: 32, maxWidth: 420 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: sportColor, marginBottom: 12 }}>¡Solicitud enviada!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginBottom: 8, lineHeight: 1.7 }}>
          Tu perfil está pendiente de verificación. El equipo de GorilaGo! revisará tu documentación y te avisará pronto.
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginBottom: 24 }}>
          Una vez verificado aparecerás en el listado de profesores.
        </div>
        <button onClick={() => navigate("/aprende")}
          style={{ width: "100%", minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
          Ver profesores
        </button>
      </div>
    </div>
  );

  const stepTitles = ["Tu información", "Especialidades", "Verificación"];

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Progress */}
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          {stepTitles.map((t, i) => (
            <div key={i} style={{ fontSize: 12, fontWeight: 700, color: i+1 <= step ? sportColor : "rgba(255,255,255,0.30)" }}>{t}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= step ? sportColor : "rgba(255,255,255,0.12)", transition: "background 0.3s" }} />
          ))}
        </div>

        {error && <div style={{ background: "rgba(220,38,38,0.15)", padding: "12px 16px", borderRadius: 12, color: "#ff6b6b", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>⚠️ {error}</div>}

        {/* PASO 1 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>👤 Tu información</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0 }}>Cuéntanos quién eres y qué enseñas</p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Nombre completo *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre" style={IS} />
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
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🎾 Deportes que enseñas *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {SPORTS.map(s => (
                  <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSports, selectedSports, s.key)}
                    style={{ flex: 1, minHeight: 64, borderRadius: 14, border: selectedSports.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSports.has(s.key) ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>{s.emoji}</span><span>{s.label}</span>
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
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>🎓 Especialidades</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>
                Selecciona todas tus especialidades — técnicas e inclusivas. Puedes elegir todas las que quieras.
              </p>
            </div>

            {/* Capacidades especiales */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                ♿ Capacidades especiales
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SPECIALTIES.filter(s => s.cat === "inclusivo").map(s => (
                  <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSpecs, selectedSpecs, s.key)}
                    style={{ minHeight: 56, padding: "12px 16px", borderRadius: 14, border: selectedSpecs.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSpecs.has(s.key) ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{s.emoji}</span>
                    <span style={{ flex: 1 }}>{s.label}</span>
                    {selectedSpecs.has(s.key) && <span style={{ color: sportColor, fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Técnicas */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                🎾 Especialidades técnicas
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SPECIALTIES.filter(s => s.cat === "tecnico").map(s => (
                  <button key={s.key} type="button" onClick={() => toggleSet(setSelectedSpecs, selectedSpecs, s.key)}
                    style={{ minHeight: 48, padding: "10px 16px", borderRadius: 12, border: selectedSpecs.has(s.key) ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: selectedSpecs.has(s.key) ? `${sportColor}15` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{s.emoji}</span><span>{s.label}</span>
                    {selectedSpecs.has(s.key) && <span style={{ color: sportColor }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(1)} style={{ minHeight: 52, padding: "14px 20px", borderRadius: 14, background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 15 }}>← Atrás</button>
              <button onClick={() => { setError(null); setStep(3); }} style={{ flex: 1, minHeight: 52, borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>Siguiente →</button>
            </div>
          </div>
        )}

        {/* PASO 3 — Verificación */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>🔐 Verificación</h1>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>
                Para garantizar la seguridad de los alumnos, necesitamos verificar tu identidad. Tus datos están protegidos y son privados.
              </p>
            </div>

            {/* Contacto */}
            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>📱 Teléfono *</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+34 600 000 000" style={IS} type="tel" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>📧 Email de contacto *</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="tu@email.com" style={IS} type="email" />
            </div>

            {/* DNI */}
            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>🪪 DNI o pasaporte *</label>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 10, lineHeight: 1.5 }}>
                Obligatorio. Solo visible para el equipo de GorilaGo! y nunca compartido con alumnos.
              </div>
              <label style={{ display: "block", minHeight: 64, padding: "16px 20px", borderRadius: 14, background: dniFile ? `${sportColor}15` : "rgba(255,255,255,0.06)", border: dniFile ? `2px solid ${sportColor}` : "2px dashed rgba(255,255,255,0.20)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 28 }}>{dniFile ? "✅" : "📄"}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{dniFile ? dniFile.name : "Adjuntar DNI o pasaporte"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>PDF, JPG, PNG — máx 10MB</div>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDniFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
            </div>

            {/* Certificado */}
            <div>
              <label style={{ display: "block", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                🏅 Certificado de entrenador <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.40)" }}>(opcional)</span>
              </label>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 10, lineHeight: 1.5 }}>
                Titulación federativa, certificado de monitor deportivo, o cualquier acreditación como entrenador de pádel, tenis o pickleball.
              </div>
              <label style={{ display: "block", minHeight: 64, padding: "16px 20px", borderRadius: 14, background: certFile ? `${sportColor}15` : "rgba(255,255,255,0.06)", border: certFile ? `2px solid ${sportColor}` : "2px dashed rgba(255,255,255,0.20)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 28 }}>{certFile ? "✅" : "🏅"}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{certFile ? certFile.name : "Adjuntar certificado (opcional)"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>PDF, JPG, PNG — máx 10MB</div>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
            </div>

            {/* Info privacidad */}
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
              🔒 Tu documentación se almacena de forma segura y cifrada. Solo el equipo de GorilaGo! la revisa para verificar tu identidad. Nunca se comparte con alumnos ni terceros.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ minHeight: 52, padding: "14px 20px", borderRadius: 14, background: "rgba(255,255,255,0.07)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 15 }}>← Atrás</button>
              <button onClick={handleSubmit} disabled={saving || !dniFile || !form.phone.trim() || !form.email.trim()}
                style={{ flex: 1, minHeight: 56, borderRadius: 14,
                  background: (saving || !dniFile || !form.phone.trim() || !form.email.trim()) ? "rgba(255,255,255,0.10)" : `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`,
                  color: (saving || !dniFile || !form.phone.trim() || !form.email.trim()) ? "rgba(255,255,255,0.35)" : "#000",
                  fontWeight: 900, border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 16 }}>
                {saving ? "⏳ Enviando…" : "✅ Enviar solicitud"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
