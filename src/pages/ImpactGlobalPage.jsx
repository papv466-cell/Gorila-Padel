// src/pages/ImpactGlobalPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

export default function ImpactGlobalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalDonated: 0,
    totalDonations: 0,
    totalPlayers: 0,
    totalReservas: 0,
    totalCervezas: 0,
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [
      { data: proj },
      { count: totalDonations },
      { count: totalReservas },
      { count: totalCervezas },
      { count: totalPlayers },
    ] = await Promise.all([
      supabase.from("projects").select("*").eq("active", true).order("featured", { ascending: false }),
      supabase.from("donations").select("*", { count: "exact", head: true }),
      supabase.from("donations").select("*", { count: "exact", head: true }).eq("source", "reserva"),
      supabase.from("donations").select("*", { count: "exact", head: true }).eq("source", "post_partido"),
      supabase.from("donations").select("user_id", { count: "exact", head: true }),
    ]);

    const totalDonated = (proj || []).reduce((s, p) => s + (p.current_amount || 0), 0);
    setProjects(proj || []);
    setStats({
      totalDonated,
      totalDonations: totalDonations || 0,
      totalPlayers: totalPlayers || 0,
      totalReservas: totalReservas || 0,
      totalCervezas: totalCervezas || 0,
    });
    setLoading(false);
  }

  function pct(current, goal) {
    return Math.min(100, Math.round(((current || 0) / goal) * 100));
  }

  const s = { background: "#050505", minHeight: "100vh", color: "rgba(255,255,255,0.92)" };

  if (loading) return (
    <div style={{ ...s, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
        <div style={{ fontSize: 16, color: "#2ECC71", fontWeight: 700 }}>Cargando impacto global…</div>
      </div>
    </div>
  );

  return (
    <div style={s}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🌍</div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.2, marginBottom: 12 }}>
            El impacto de<br/><span style={{ color: "#2ECC71" }}>toda la comunidad</span>
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Cada persona que juega en MonkeyGorila contribuye a hacer el deporte más inclusivo. Aquí ves el resultado en tiempo real.
          </div>
        </div>

        {/* Número grande — total donado */}
        <div style={{ textAlign: "center", marginBottom: 36, padding: "32px 20px", background: "rgba(46,204,113,0.06)", border: "1px solid rgba(46,204,113,0.20)", borderRadius: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#2ECC71", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Total recaudado para proyectos inclusivos
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#2ECC71", lineHeight: 1, marginBottom: 8 }}>
            {stats.totalDonated.toFixed(2)} €
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
            entre toda la comunidad MonkeyGorila
          </div>
        </div>

        {/* Stats en grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 36 }}>
          {[
            { value: stats.totalDonations, label: "donaciones totales", icon: "💛", color: "#E67E22" },
            { value: stats.totalPlayers, label: "jugadores que han donado", icon: "🦍", color: "#2ECC71" },
            { value: stats.totalReservas, label: "reservas con impacto", icon: "🎾", color: "#3498DB" },
            { value: stats.totalCervezas, label: "cervezas donadas", icon: "🍺", color: "#F39C12" },
          ].map((item, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: item.color, marginBottom: 4 }}>{item.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, lineHeight: 1.4 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Proyectos con progreso */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>🏗️ Proyectos en marcha</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {projects.map(p => {
              const progress = pct(p.current_amount, p.goal_amount);
              return (
                <div key={p.id} style={{ background: "rgba(255,255,255,0.04)", border: p.featured ? "1px solid rgba(46,204,113,0.30)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 20 }}>
                  {p.featured && (
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#2ECC71", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      ⭐ Proyecto activo — recibe donaciones automáticas
                    </div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 16, lineHeight: 1.6 }}>{p.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#2ECC71" }}>{(p.current_amount || 0).toFixed(0)} €</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>recaudados</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{progress}%</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>de {p.goal_amount} €</div>
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "linear-gradient(90deg,#2ECC71,#27AE60)", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", borderRadius: 20, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>💛 Tú también puedes ayudar</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 20, lineHeight: 1.6 }}>
            Cada reserva que haces contribuye automáticamente. También puedes donar directamente a cualquier proyecto.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/proyectos")}
              style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer" }}>
              🏗️ Ver proyectos y donar
            </button>
            <button onClick={() => navigate("/juega")}
              style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 15, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
              🎾 Jugar y ayudar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
