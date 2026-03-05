// src/pages/SuperAdminPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const SUPER_ADMIN_ID = "1e0db2e1-e959-41f0-bcaf-2bb46fd425da";

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [pendingClubs, setPendingClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session || data.session.user.id !== SUPER_ADMIN_ID) {
        navigate("/");
        return;
      }
      setSession(data.session);
      loadPendingClubs();
    });
  }, []);

  async function loadPendingClubs() {
    setLoading(true);
    const { data } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });
    setPendingClubs(data || []);
    setLoading(false);
  }

  async function approveClub(club) {
    setSaving(club.id);
    try {
      // 1. Aprobar club
      await supabase.from("clubs").update({ status: "approved", active: true, verified: true }).eq("id", club.id);

      // 2. Crear entrada en club_admins para el gestor
      if (club.owner_user_id) {
        await supabase.from("club_admins").upsert({
          user_id: club.owner_user_id,
          club_id: club.id,
          club_name: club.name,
          status: "approved",
        }, { onConflict: "user_id,club_id" });

        // 3. Notificar al gestor
        await supabase.from("notifications").insert({
          user_id: club.owner_user_id,
          type: "club_approved",
          title: "🎉 ¡Tu club ha sido aprobado!",
          body: `${club.name} ya está activo en Gorila Pádel. Entra al panel de administración para configurar tus pistas.`,
          data: { club_id: club.id },
        });
      }

      setPendingClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  }

  async function rejectClub(club) {
    const reason = window.prompt("Motivo del rechazo (opcional):");
    setSaving(club.id);
    try {
      await supabase.from("clubs").update({ status: "rejected", rejection_reason: reason || null }).eq("id", club.id);
      if (club.owner_user_id) {
        await supabase.from("notifications").insert({
          user_id: club.owner_user_id,
          type: "club_rejected",
          title: "❌ Solicitud de club no aprobada",
          body: reason ? `${club.name}: ${reason}` : `No hemos podido aprobar ${club.name}. Contáctanos para más info.`,
          data: { club_id: club.id },
        });
      }
      setPendingClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  }

  if (loading) return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "grid", placeItems: "center", color: "#74B800", fontSize: 18, fontWeight: 900 }}>
      Cargando…
    </div>
  );

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate("/")}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#74B800" }}>🔐 Super Admin</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Panel de aprobación de clubs</div>
          </div>
        </div>

        {/* Clubs pendientes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 14 }}>
            🏟️ Clubs pendientes
            <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 20, background: pendingClubs.length > 0 ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.08)", color: pendingClubs.length > 0 ? "#FFA500" : "rgba(255,255,255,0.4)", fontSize: 12 }}>
              {pendingClubs.length}
            </span>
          </div>

          {pendingClubs.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
              ✅ No hay clubs pendientes de aprobación
            </div>
          )}

          {pendingClubs.map(club => (
            <div key={club.id} style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{club.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>📍 {club.city} {club.address ? `· ${club.address}` : ""}</div>
                  {club.submitted_at && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      Enviado: {new Date(club.submitted_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(255,165,0,0.15)", color: "#FFA500", fontSize: 11, fontWeight: 800 }}>
                  ⏳ Pendiente
                </div>
              </div>

              {club.description && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10, padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  {club.description}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {club.opening_time && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>⏰ {club.opening_time}–{club.closing_time}</span>}
                {club.phone && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📞 {club.phone}</span>}
                {club.email && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>✉️ {club.email}</span>}
                {club.website && <a href={club.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#74B800" }}>🌐 Web</a>}
                {club.social_instagram && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📸 {club.social_instagram}</span>}
              </div>

              {club.courts_info?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PISTAS</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {club.courts_info.map((c, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(116,184,0,0.1)", color: "#74B800" }}>
                        {c.name} · {c.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {club.amenities && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                  ✅ {club.amenities.split(",").join(" · ")}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => approveClub(club)} disabled={saving === club.id}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 13,
                    background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", opacity: saving === club.id ? 0.6 : 1 }}>
                  {saving === club.id ? "⏳ Guardando…" : "✅ Aprobar"}
                </button>
                <button onClick={() => rejectClub(club)} disabled={saving === club.id}
                  style={{ padding: "11px 16px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 900, fontSize: 13,
                    background: "rgba(220,38,38,0.1)", color: "#ff6b6b", opacity: saving === club.id ? 0.6 : 1 }}>
                  ❌ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
