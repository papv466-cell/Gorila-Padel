// src/pages/ProjectsPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
import { useSession } from "../contexts/SessionContext";

const CATEGORY_CONFIG = {
  infraestructura: { icon: "🏗️", color: "#E67E22" },
  becas:           { icon: "🎓", color: "#3498DB" },
  eventos:         { icon: "🏆", color: "#9B59B6" },
  inclusivo:       { icon: "♿", color: "#2ECC71" },
};

export default function ProjectsPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [totalDonated, setTotalDonated] = useState(0);
  const [totalDonors, setTotalDonors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showProposal, setShowProposal] = useState(false);
  const [proposal, setProposal] = useState({ title: "", description: "", impact: "", budget_estimate: "", contact_email: "" });
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);
  const [donatingProject, setDonatingProject] = useState(null);
  const [donationAmount, setDonationAmount] = useState("2");
  const [savingDonation, setSavingDonation] = useState(false);
  const [donationSent, setDonationSent] = useState(false);
  const [donationClientSecret, setDonationClientSecret] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: proj }, { count: donors }] = await Promise.all([
      supabase.from("projects").select("*").eq("active", true).order("featured", { ascending: false }).order("created_at"),
      supabase.from("donations").select("*", { count: "exact", head: true }),
    ]);
    setProjects(proj || []);
    setTotalDonated((proj || []).reduce((s, p) => s + (p.current_amount || 0), 0));
    setTotalDonors(donors || 0);
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
      // Crear PaymentIntent en Stripe
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-donation-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ projectId: donatingProject.id, amount, userId: session?.user?.id }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al procesar donación");
      setDonationClientSecret(data.clientSecret);
      setDonationSent(true);
      setTimeout(() => {
        setDonatingProject(null);
        setDonationAmount("2");
        setDonationSent(false);
      }, 2000);
    } catch (e) { alert(e.message); }
    finally { setSavingDonation(false); }
  }

  function pct(current, goal) {
    return Math.min(100, Math.round(((current || 0) / goal) * 100));
  }

  const s = { background: "#050505", minHeight: "100vh", color: "rgba(255,255,255,0.92)" };

  if (loading) return (
    <div style={{ ...s, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
        <div style={{ fontSize: 16, color: "#2ECC71", fontWeight: 700 }}>Cargando proyectos…</div>
      </div>
    </div>
  );

  return (
    <div style={s}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "90px 16px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40, padding: "0 8px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🦍</div>
          <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>
            Jugando se ayuda<br/><span style={{ color: "#2ECC71" }}>— y se ve</span>
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.60)", lineHeight: 1.7 }}>
            Cada partido, cada reserva, cada cerveza que donas va directamente a hacer realidad estos proyectos.
          </div>
        </div>

        {/* Stats globales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 36 }}>
          {[
            { value: totalDonated.toFixed(0) + " €", label: "recaudados", color: "#2ECC71" },
            { value: totalDonors, label: "donaciones", color: "#E67E22" },
            { value: projects.length, label: "proyectos", color: "#3498DB" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Propuesta enviada */}
        {proposalSent && (
          <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(46,204,113,0.10)", border: "1px solid rgba(46,204,113,0.25)", color: "#2ECC71", fontSize: 15, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
            ✅ ¡Propuesta enviada! La revisaremos pronto.
          </div>
        )}

        {/* Proyectos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 36 }}>
          {projects.map(p => {
            const progress = pct(p.current_amount, p.goal_amount);
            const cat = CATEGORY_CONFIG[p.category] || CATEGORY_CONFIG.inclusivo;
            return (
              <div key={p.id} style={{ borderRadius: 22, overflow: "hidden", border: p.featured ? `1px solid ${cat.color}55` : "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                
                {/* Banner destacado */}
                {p.featured && (
                  <div style={{ background: `linear-gradient(135deg,${cat.color},${cat.color}99)`, padding: "8px 20px", fontSize: 12, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                    ⭐ Proyecto destacado — recibe donaciones de cada reserva
                  </div>
                )}

                <div style={{ padding: 22 }}>
                  {/* Categoría + icono */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color}18`, border: `1px solid ${cat.color}40`, display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>
                      {cat.icon}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: cat.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {p.category}
                    </div>
                  </div>

                  {/* Título */}
                  <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>{p.title}</div>

                  {/* Descripción */}
                  <div style={{ fontSize: 15, color: "rgba(255,255,255,0.60)", lineHeight: 1.7, marginBottom: 22 }}>{p.description}</div>

                  {/* Progreso visual */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#2ECC71", lineHeight: 1 }}>
                          {(p.current_amount || 0).toFixed(0)} €
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>recaudados</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.70)" }}>{progress}%</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>de {p.goal_amount.toFixed(0)} €</div>
                      </div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: progress >= 100 ? "#27AE60" : `linear-gradient(90deg,#2ECC71,${cat.color})`, transition: "width 0.8s ease" }} />
                    </div>
                    {progress >= 100 && (
                      <div style={{ marginTop: 8, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#2ECC71" }}>
                        🎉 ¡Meta alcanzada! Gracias a todos los que jugaron.
                      </div>
                    )}
                  </div>

                  {/* Botón donar */}
                  <button
                    onClick={() => { setDonatingProject(p); setDonationAmount("2"); }}
                    style={{ width: "100%", minHeight: 52, borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "filter 0.15s" }}>
                    Donar a este proyecto
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cómo funciona */}
        <div style={{ background: "rgba(46,204,113,0.05)", border: "1px solid rgba(46,204,113,0.15)", borderRadius: 20, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, color: "#2ECC71" }}>💛 ¿Cómo ayudas jugando?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "🎾", text: "Cada reserva de pista incluye 0,30€ de impacto automático" },
              { icon: "🍺", text: "Al terminar un partido puedes donar una cerveza — 2€ directos al proyecto" },
              { icon: "💳", text: "Puedes donar cualquier cantidad directamente desde aquí" },
              { icon: "📊", text: "Ves el progreso en tiempo real — cada euro cuenta" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.70)", lineHeight: 1.6 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Proponer proyecto */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>💡 ¿Tienes una idea?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 20 }}>
            Si conoces un proyecto que ayudaría a personas con capacidades especiales a practicar deporte, cuéntanoslo. Lo revisamos y si encaja, lo lanzamos juntos.
          </div>
          <button onClick={() => setShowProposal(true)}
            style={{ minHeight: 52, padding: "14px 24px", borderRadius: 14, background: "#1A2744", color: "#fff", fontWeight: 700, fontSize: 15, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", width: "100%" }}>
            ✏️ Proponer un proyecto
          </button>
        </div>

        {/* Modal donación */}
        {donatingProject && (
          <div onClick={() => !savingDonation && setDonatingProject(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f1117", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "24px 24px 0 0", padding: 24, paddingBottom: "max(24px,env(safe-area-inset-bottom))" }}>
              
              {donationSent ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#2ECC71", marginBottom: 8 }}>¡Gracias!</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}>Tu donación está ayudando a alguien a jugar.</div>
                </div>
              ) : (
                <>
                  <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
                  <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>💛 Donar al proyecto</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", marginBottom: 24 }}>{donatingProject.title}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                    {["1", "2", "5", "10"].map(v => (
                      <button key={v} onClick={() => setDonationAmount(v)}
                        style={{ minHeight: 56, borderRadius: 14, border: donationAmount === v ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.12)", background: donationAmount === v ? "rgba(230,126,34,0.15)" : "rgba(255,255,255,0.04)", color: donationAmount === v ? "#E67E22" : "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
                        {v} €
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>O introduce otro importe:</div>
                    <input type="number" min="0.50" step="0.50" value={donationAmount}
                      onChange={e => setDonationAmount(e.target.value)}
                      style={{ width: "100%", minHeight: 52, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 16 }} />
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.70)" }}>Tu donación se reparte:</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                      <span style={{ color: "rgba(255,255,255,0.55)" }}>🦍 GorilaGo!</span>
                      <span style={{ fontWeight: 700 }}>0,10 €</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                      <span style={{ color: "rgba(255,255,255,0.55)" }}>🏗️ {donatingProject.title}</span>
                      <span style={{ fontWeight: 700, color: "#E67E22" }}>{Math.max(0, parseFloat(donationAmount || 0) - 0.10).toFixed(2)} €</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={submitDonation} disabled={savingDonation || parseFloat(donationAmount || 0) < 0.5}
                      style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", opacity: savingDonation || parseFloat(donationAmount || 0) < 0.5 ? 0.5 : 1 }}>
                      {savingDonation ? "Procesando…" : `Donar ${parseFloat(donationAmount || 0).toFixed(2)} €`}
                    </button>
                    <button onClick={() => setDonatingProject(null)}
                      style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                      Ahora no
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal propuesta */}
        {showProposal && (
          <div onClick={() => setShowProposal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 50000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#0f1117", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "24px 24px 0 0", padding: 24, paddingBottom: "max(24px,env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>💡 Proponer un proyecto</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.6 }}>
                Cuéntanos tu idea para ayudar a personas con capacidades especiales a practicar deporte. Revisamos todas las propuestas.
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
                    style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#2ECC71", color: "#0d4a25", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", opacity: savingProposal || !proposal.title.trim() ? 0.5 : 1 }}>
                    {savingProposal ? "Enviando…" : "✅ Enviar propuesta"}
                  </button>
                  <button onClick={() => setShowProposal(false)}
                    style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
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
