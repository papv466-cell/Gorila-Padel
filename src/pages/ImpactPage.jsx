// src/pages/ImpactPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { useSession } from "../contexts/SessionContext";

export default function ImpactPage() {
  const { session } = useSession();
  const [donations, setDonations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    const [{ data: don }, { data: proj }] = await Promise.all([
      supabase.from("donations").select("*, projects(title, category)").eq("user_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("projects").select("id, title, category, current_amount, goal_amount").eq("active", true),
    ]);
    setDonations(don || []);
    setProjects(proj || []);
    setLoading(false);
  }

  const totalDonated = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const totalReservas = donations.filter(d => d.source === "reserva").length;
  const totalPostPartido = donations.filter(d => d.source === "post_partido").length;

  // Agrupar por proyecto
  const byProject = donations.reduce((acc, d) => {
    const key = d.project_id || "sin_proyecto";
    const title = d.projects?.title || "Proyecto general";
    if (!acc[key]) acc[key] = { title, total: 0, count: 0 };
    acc[key].total += d.amount || 0;
    acc[key].count += 1;
    return acc;
  }, {});

  const s = { background: "#050505", minHeight: "100vh", color: "rgba(255,255,255,0.92)" };

  if (loading) return (
    <div style={{ ...s, display: "grid", placeItems: "center", fontSize: 18, color: "#2ECC71" }}>
      Cargando tu impacto…
    </div>
  );

  return (
    <div style={s}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "100px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2ECC71", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tu impacto
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
            Jugando se ayuda —<br/>y se ve
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Cada vez que juegas, reservas o donas, ayudas a que más personas con discapacidad puedan practicar deporte.
          </div>
        </div>

        {/* Métricas principales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#2ECC71", marginBottom: 4 }}>
              {totalDonated.toFixed(2)} €
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Total donado</div>
          </div>
          <div style={{ background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#E67E22", marginBottom: 4 }}>
              {donations.length}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Donaciones</div>
          </div>
          <div style={{ background: "rgba(26,39,68,0.60)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {totalReservas}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Reservas jugadas</div>
          </div>
          <div style={{ background: "rgba(26,39,68,0.60)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {totalPostPartido}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Cervezas donadas</div>
          </div>
        </div>

        {/* Por proyecto */}
        {Object.keys(byProject).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🏗️ A dónde ha ido</div>
            {Object.entries(byProject).map(([key, val]) => (
              <div key={key} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{val.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{val.count} donación{val.count !== 1 ? "es" : ""}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#E67E22" }}>{val.total.toFixed(2)} €</div>
              </div>
            ))}
          </div>
        )}

        {/* Proyectos activos */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📊 Proyectos en marcha</div>
          {projects.map(p => {
            const pct = Math.min(100, Math.round((p.current_amount / p.goal_amount) * 100));
            return (
              <div key={p.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{p.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "#2ECC71", fontWeight: 700 }}>{(p.current_amount||0).toFixed(0)} €</span>
                  <span style={{ color: "rgba(255,255,255,0.40)" }}>de {p.goal_amount} € · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "linear-gradient(90deg,#2ECC71,#27AE60)", transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Sin donaciones */}
        {donations.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦍</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Aún no has donado</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", marginBottom: 20, lineHeight: 1.6 }}>
              Cada reserva que hagas incluirá automáticamente 0,30€ de impacto. También puedes donar desde los proyectos.
            </div>
            <a href="/proyectos" style={{ display: "inline-block", padding: "14px 24px", borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Ver proyectos →
            </a>
          </div>
        )}

        {/* Historial */}
        {donations.length > 0 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📋 Historial</div>
            {donations.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{d.projects?.title || "Proyecto general"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
                    {d.source === "reserva" ? "🎾 Reserva" : d.source === "post_partido" ? "🍺 Cerveza" : "💛 Donación"} · {new Date(d.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E67E22" }}>{(d.amount||0).toFixed(2)} €</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
