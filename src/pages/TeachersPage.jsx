// src/pages/TeachersPage.jsx
import { useState, useEffect } from "react";
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

export default function TeachersPage() {
  const navigate = useNavigate();
  const { sport, sportInfo } = useSport();
  const { session } = useSession();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");

  const sportColor = sportInfo?.color || "#2ECC71";

  useEffect(() => { loadTeachers(); }, [sport]);

  async function loadTeachers() {
    setLoading(true);
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("active", true)
      .eq("verified", true)
      .contains("sports", [sport]);
    setTeachers(data || []);
    setLoading(false);
  }

  const filtered = (teachers || []).filter(t => {
    const matchSearch = !search || 
      String(t.name || "").toLowerCase().includes(search.toLowerCase()) ||
      String(t.city || "").toLowerCase().includes(search.toLowerCase());
    const matchSpec = !filterSpecialty || (t.specialties || []).includes(filterSpecialty);
    return matchSearch && matchSpec;
  });

  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>
            📚 <span style={{ color: sportColor }}>Aprende</span> {sportInfo?.label}
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>
            Profesores especializados en {sportInfo?.label}. Muchos con experiencia en personas con capacidades especiales.
          </p>
        </div>

        {/* Buscador */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o ciudad…"
          style={{ width: "100%", minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.07)", border: `1px solid ${sportColor}40`, color: "#fff", fontSize: 16, marginBottom: 16, boxSizing: "border-box" }}
        />

        {/* Filtro especialidades */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <button onClick={() => setFilterSpecialty("")}
            style={{ minHeight: 44, padding: "8px 16px", borderRadius: 999, border: !filterSpecialty ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.12)", background: !filterSpecialty ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Todos
          </button>
          {SPECIALTIES.map(s => (
            <button key={s.key} onClick={() => setFilterSpecialty(filterSpecialty === s.key ? "" : s.key)}
              style={{ minHeight: 44, padding: "8px 14px", borderRadius: 999, border: filterSpecialty === s.key ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)", background: filterSpecialty === s.key ? `${sportColor}20` : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {/* Lista profesores */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.40)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Cargando profesores…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#111827", borderRadius: 20, padding: "36px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>No hay profesores todavía</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.50)", marginBottom: 20 }}>¿Eres profesor? ¡Regístrate y llega a más alumnos!</div>
            <button onClick={() => navigate("/profesores/registro")}
              style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 16 }}>
              Registrarme como profesor
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.map(t => (
              <div key={t.id} onClick={() => navigate(`/profesores/${t.id}`)}
                style={{ background: "#111827", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", transition: "border-color 0.2s, transform 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = sportColor + "55"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.transform = "none"; }}>

                <div style={{ padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {/* Avatar */}
                  <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", flexShrink: 0, background: `${sportColor}20`, border: `1px solid ${sportColor}40`, display: "grid", placeItems: "center" }}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 28 }}>🎾</span>}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{t.name || "Profesor"}</div>
                        {t.city && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>📍 {t.city}</div>}
                      </div>
                      {t.verified && <span style={{ fontSize: 11, fontWeight: 900, color: sportColor, background: `${sportColor}18`, padding: "4px 10px", borderRadius: 999 }}>✓ Verificado</span>}
                    </div>

                    {t.bio && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", lineHeight: 1.5, marginBottom: 10 }}>{t.bio.slice(0, 100)}{t.bio.length > 100 ? "…" : ""}</div>}

                    {/* Especialidades */}
                    {(t.specialties || []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {(t.specialties || []).slice(0, 4).map(s => {
                          const spec = SPECIALTIES.find(x => x.key === s);
                          return spec ? (
                            <span key={s} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                              {spec.emoji} {spec.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: sportColor }}>
                        {t.price_per_hour ? `${t.price_per_hour}€/hora` : "Precio a consultar"}
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", fontWeight: 700 }}>
                        Ver perfil →
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA para profesores */}
        <div style={{ marginTop: 32, padding: "20px 24px", borderRadius: 18, background: `${sportColor}08`, border: `1px solid ${sportColor}25`, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>¿Eres profesor de {sportInfo?.label}?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>Regístrate y llega a miles de alumnos en GorilaGo!</div>
          <button onClick={() => navigate("/profesores/registro")}
            style={{ minHeight: 52, padding: "14px 28px", borderRadius: 14, background: `linear-gradient(135deg,${sportColor},${sportInfo?.colorDark || "#27AE60"})`, color: "#000", fontWeight: 900, border: "none", cursor: "pointer", fontSize: 15 }}>
            Registrarme como profesor
          </button>
        </div>

      </div>
    </div>
  );
}
