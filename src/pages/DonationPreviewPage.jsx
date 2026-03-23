// src/pages/DonationPreviewPage.jsx
import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function DonationPreviewPage() {
  const [donationAmount, setDonationAmount] = useState("2");
  const [donationProject, setDonationProject] = useState("1");
  const [donationSent, setDonationSent] = useState(false);

  const activeProjects = [
    { id: "1", title: "Pistas adaptadas en Madrid" },
    { id: "2", title: "Becas para jugadores con discapacidad" },
    { id: "3", title: "Torneo inclusivo nacional" },
  ];

  const S = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { width: "min(640px,100%)", background: "#111", borderRadius: "24px 24px 0 0", border: "1px solid rgba(116,184,0,0.2)", padding: 24, paddingBottom: "max(32px,env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" },
  };

  if (donationSent) return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff", textAlign: "center", padding: 24 }}>
      <div>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#E67E22", marginBottom: 8 }}>¡Gracias!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", marginBottom: 24 }}>Tu donación de {donationAmount}€ está ayudando a alguien a jugar.</div>
        <button onClick={() => { setDonationSent(false); setDonationAmount("2"); }}
          style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
          Ver de nuevo
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: 48, marginBottom: 8, textAlign: "center" }}>🍺</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6, textAlign: "center" }}>Dona una cerveza</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.6, textAlign: "center" }}>
          Con el precio de una cerveza ayudas a que más personas con discapacidad puedan jugar.
        </div>

        {/* Cantidades */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {["1", "2", "5", "10"].map(v => (
            <button key={v} onClick={() => setDonationAmount(v)}
              style={{ minHeight: 52, borderRadius: 12,
                border: donationAmount === v ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.15)",
                background: donationAmount === v ? "rgba(230,126,34,0.15)" : "rgba(255,255,255,0.05)",
                color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {v} €
            </button>
          ))}
        </div>

        {/* Proyectos */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Tu donación va a:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeProjects.map(p => (
              <button key={p.id} onClick={() => setDonationProject(p.id)}
                style={{ padding: "12px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                  border: donationProject === p.id ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.10)",
                  background: donationProject === p.id ? "rgba(230,126,34,0.10)" : "rgba(255,255,255,0.04)",
                  color: "#fff", fontWeight: 600, fontSize: 14 }}>
                🏗️ {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Desglose transparente */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: "rgba(255,255,255,0.80)" }}>Tu donación se reparte así:</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>🦍 MonkeyGorila (plataforma)</span>
            <span style={{ fontWeight: 700 }}>0,10 €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>🏗️ Proyecto elegido</span>
            <span style={{ fontWeight: 700, color: "#E67E22" }}>
              {Math.max(0, parseFloat(donationAmount || 0) - 0.10).toFixed(2)} €
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.80)", fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 700, color: "#fff" }}>{parseFloat(donationAmount || 0).toFixed(2)} €</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setDonationSent(true)}
            style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
            🍺 Donar {parseFloat(donationAmount || 0).toFixed(2)} €
          </button>
          <button onClick={() => window.history.back()}
            style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Ahora no
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.30)", textAlign: "center" }}>
          Esta es una preview — los pagos reales se activarán pronto con Stripe
        </div>
      </div>
    </div>
  );
}
