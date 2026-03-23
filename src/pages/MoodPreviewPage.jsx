// src/pages/MoodPreviewPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MoodPreviewPage() {
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const moods = [
    { key: "win",  emoji: "🔥", label: "Vengo a ganar",       desc: "Sin piedad" },
    { key: "fun",  emoji: "😎", label: "A pasarlo bien",      desc: "El resultado da igual" },
    { key: "beer", emoji: "🍺", label: "Lo importante es la cerveza post-partido", desc: "Prioridades claras" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 99999 }}>
      <div style={{ width: "min(640px,100%)", background: "#111", borderRadius: "24px 24px 0 0", border: "1px solid rgba(116,184,0,0.2)", padding: 24, paddingBottom: "max(32px,env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🦍</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>¿Con qué Gorila Mood vienes?</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Pagarás €5.00 (incluye comisión de servicio)</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {moods.map(m => (
            <button key={m.key} onClick={() => setSelected(m.key)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14,
                background: selected === m.key ? "rgba(116,184,0,0.12)" : "rgba(255,255,255,0.06)",
                border: selected === m.key ? "1px solid #74B800" : "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer", textAlign: "left", width: "100%" }}>
              <span style={{ fontSize: 30, flexShrink: 0 }}>{m.emoji}</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>{m.label}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{m.desc}</div>
              </div>
            </button>
          ))}

          <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 14, background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>🏗️</span>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#E67E22" }}>Mientras juegas, ayudas</div>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 10 }}>
              0,10€ de tu reserva va a MonkeyGorila · 0,10€ al proyecto inclusivo activo · 0,10€ a la asociación del club
            </div>
            <a href="/proyectos" style={{ fontSize: 12, fontWeight: 700, color: "#E67E22", textDecoration: "none" }}>
              Ver proyectos activos →
            </a>
          </div>
        </div>

        <button onClick={() => navigate(-1)} style={{ width: "100%", marginTop: 14, padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
