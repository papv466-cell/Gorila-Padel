// src/pages/ProjectsPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useSession } from "../contexts/SessionContext";

export default function ProjectsPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposal, setShowProposal] = useState(false);
  const [proposal, setProposal] = useState({ title: "", description: "", impact: "", budget_estimate: "", contact_email: "" });
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);
  const [donatingProject, setDonatingProject] = useState(null);
  const [donationAmount, setDonationAmount] = useState("1");
  const [savingDonation, setSavingDonation] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").eq("active", true).order("featured", { ascending: false }).order("created_at");
    setProjects(data || []);
    setLoading(false);
  }

  async function submitProposal() {
    if (!proposal.title.trim() || !proposal.description.trim()) return;
    setSavingProposal(true);
    try {
      await supabase.from("project_proposals").insert({
        ...proposal,
        budget_estimate: proposal.budget_estimate ? parseFloat(proposal.budget_estimate) : null,
        user_id: session?.user?.id || null,
      });
      setProposalSent(true);
      setShowProposal(false);
      setProposal({ title: "", description: "", impact: "", budget_estimate: "", contact_email: "" });
    } catch (e) { alert(e.message); }
    finally { setSavingProposal(false); }
  }

  async function submitDonation() {
    const amount = parseFloat(donationAmount);
    if (!amount || amount < 0.5) return;
    setSavingDonation(true);
    try {
      await supabase.from("projects").update({
        current_amount: (donatingProject.current_amount || 0) + amount,
        updated_at: new Date().toISOString()
      }).eq("id", donatingProject.id);
      setProjects(prev => prev.map(p => p.id === donatingProject.id
        ? { ...p, current_amount: (p.current_amount || 0) + amount }
        : p
      ));
      setDonatingProject(null);
      setDonationAmount("1");
    } catch (e) { alert(e.message); }
    finally { setSavingDonation(false); }
  }

  function pct(current, goal) {
    return Math.min(100, Math.round((current / goal) * 100));
  }

  const s = { background: "#050505", minHeight: "100vh", color: "rgba(255,255,255,0.92)" };

  if (loading) return (
    <div style={{ ...s, display: "grid", placeItems: "center", fontSize: 18, color: "#2ECC71" }}>
      Cargando proyectos…
    </div>
  );

  return (
    <div style={s}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "100px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(46,204,113,0.12)", border: "1px solid rgba(46,204,113,0.25)", fontSize: 13, fontWeight: 700, color: "#2ECC71", marginBottom: 14 }}>
            🏗️ Proyectos activos
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
            Jugando se ayuda —<br />y se ve
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Cada reserva, cada partido, cada cerveza que donas va directamente a hacer realidad estos proyectos. Ves el progreso en tiempo real.
          </div>
        </div>

        {/* Propuesta enviada */}
        {proposalSent && (
          <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(46,204,113,0.10)", border: "1px solid rgba(46,204,113,0.25)", color: "#2ECC71", fontSize: 15, fontWeight: 700, marginBottom: 24 }}>
            ✅ ¡Propuesta enviada! La revisaremos pronto.
          </div>
        )}

        {/* Proyectos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          {projects.map(p => {
            const progress = pct(p.current_amount, p.goal_amount);
            return (
              <div key={p.id} style={{ background: "rgba(255,255,255,0.05)", border: p.featured ? "1px solid rgba(46,204,113,0.35)" : "1px solid rgba(255,255,255,0.10)", borderRadius: 20, overflow: "hidden" }}>
                {p.featured && (
                  <div style={{ background: "linear-gradient(135deg,#2ECC71,#27AE60)", padding: "6px 16px", fontSize: 12, fontWeight: 700, color: "#0d4a25" }}>
                    ⭐ Proyecto destacado
                  </div>
                )}
                <div style={{ padding: 20 }}>
                  {/* Categoría */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#2ECC71", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {p.category}
                  </div>

                  {/* Título */}
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>

                  {/* Descripción */}
                  <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 20 }}>{p.description}</div>

                  {/* Progreso */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#2ECC71" }}>
                        {(p.current_amount || 0).toFixed(0)} €
                      </div>
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)" }}>
                        de {p.goal_amount.toFixed(0)} € · {progress}%
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: progress >= 100 ? "#27AE60" : "linear-gradient(90deg,#2ECC71,#27AE60)", transition: "width 0.6s ease" }} />
                    </div>
                  </div>

                  {/* Botón donar */}
                  <button
                    onClick={() => { setDonatingProject(p); setDonationAmount("1"); }}
                    style={{ width: "100%", minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    💛 Donar a este proyecto
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Proponer proyecto */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>💡 ¿Tienes una idea?</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 20 }}>
            Si conoces un proyecto que ayudaría a personas con discapacidad a practicar deporte, cuéntanoslo. Lo revisamos y si encaja, lo lanzamos juntos.
          </div>
          <button
            onClick={() => setShowProposal(true)}
            style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "#1A2744", color: "#fff", fontWeight: 700, fontSize: 16, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}>
            ✏️ Proponer un proyecto
          </button>
        </div>

        {/* Modal donación */}
        {donatingProject && (
          <div onClick={() => setDonatingProject(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#111827", borderRadius: "20px 20px 0 0", padding: 24, paddingBottom: "max(24px,env(safe-area-inset-bottom))" }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>💛 Donar al proyecto</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", marginBottom: 20 }}>{donatingProject.title}</div>

              {/* Cantidades rápidas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                {["0.50", "1", "2", "5"].map(v => (
                  <button key={v} onClick={() => setDonationAmount(v)}
                    style={{ minHeight: 52, borderRadius: 12, border: donationAmount === v ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.15)", background: donationAmount === v ? "rgba(230,126,34,0.15)" : "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                    {v} €
                  </button>
                ))}
              </div>

              {/* Importe libre */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>O elige otro importe:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number" min="0.50" step="0.50" value={donationAmount}
                    onChange={e => setDonationAmount(e.target.value)}
                    style={{ flex: 1, minHeight: 52, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 16 }} />
                  <span style={{ color: "rgba(255,255,255,0.60)", fontSize: 16 }}>€</span>
                </div>
              </div>

              {/* Desglose transparente */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10, color: "rgba(255,255,255,0.80)" }}>Tu donación va a:</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.60)" }}>🦍 MonkeyGorila (plataforma)</span>
                  <span style={{ fontWeight: 700 }}>0,10 €</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.60)" }}>🏗️ {donatingProject.title}</span>
                  <span style={{ fontWeight: 700, color: "#E67E22" }}>{Math.max(0, parseFloat(donationAmount || 0) - 0.10).toFixed(2)} €</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={submitDonation} disabled={savingDonation || parseFloat(donationAmount || 0) < 0.5}
                  style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: savingDonation || parseFloat(donationAmount || 0) < 0.5 ? 0.5 : 1 }}>
                  {savingDonation ? "Procesando…" : `Donar ${parseFloat(donationAmount || 0).toFixed(2)} €`}
                </button>
                <button onClick={() => setDonatingProject(null)}
                  style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal propuesta */}
        {showProposal && (
          <div onClick={() => setShowProposal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#111827", borderRadius: "20px 20px 0 0", padding: 24, paddingBottom: "max(24px,env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>💡 Proponer un proyecto</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 20, lineHeight: 1.6 }}>
                Cuéntanos tu idea para ayudar a personas con discapacidad a practicar deporte. Todos los proyectos son revisados por el equipo de MonkeyGorila.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  ["title", "Nombre del proyecto *", "text"],
                  ["description", "Descripción — ¿qué quieres conseguir? *", "text"],
                  ["impact", "Impacto esperado — ¿a cuántas personas ayudaría?", "text"],
                  ["budget_estimate", "Presupuesto estimado (€)", "number"],
                  ["contact_email", "Tu email de contacto", "email"],
                ].map(([field, placeholder, type]) => (
                  field === "description" || field === "impact"
                    ? <textarea key={field} placeholder={placeholder} value={proposal[field]}
                        onChange={e => setProposal(p => ({ ...p, [field]: e.target.value }))}
                        rows={3}
                        style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, resize: "vertical", fontFamily: "inherit" }} />
                    : <input key={field} type={type} placeholder={placeholder} value={proposal[field]}
                        onChange={e => setProposal(p => ({ ...p, [field]: e.target.value }))}
                        style={{ minHeight: 52, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15 }} />
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button onClick={submitProposal} disabled={savingProposal || !proposal.title.trim() || !proposal.description.trim()}
                    style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#2ECC71", color: "#0d4a25", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: savingProposal || !proposal.title.trim() ? 0.5 : 1 }}>
                    {savingProposal ? "Enviando…" : "✅ Enviar propuesta"}
                  </button>
                  <button onClick={() => setShowProposal(false)}
                    style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
