// src/components/MatchPaymentModal.jsx
// Modal completo: mood → pago Stripe → confirmación
// Todos los partidos pagan (mínimo 0,50€ comisión de servicio)
import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "../services/supabaseClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
const LEVEL_COLORS = { iniciacion: "#74B800", medio: "#f59e0b", avanzado: "#ef4444", competicion: "#8b5cf6" };

// ── Formulario Stripe interno ────────────────────────────────────────────────
function PayForm({ totalCents, pricePerPlayerCents, matchData, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const total = (totalCents / 100).toFixed(2);
  const price = (pricePerPlayerCents / 100).toFixed(2);
  const fee = ((totalCents - pricePerPlayerCents) / 100).toFixed(2);
  const isFree = matchData.isFree;
  const isPrivate = matchData.isPrivateCourt;

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) { setError(submitError.message); setLoading(false); return; }
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/partidos` },
      redirect: "if_required",
    });
    if (confirmError) { setError(confirmError.message); setLoading(false); return; }
    if (paymentIntent?.status === "succeeded") { onSuccess(paymentIntent); return; }
    setLoading(false);
  }

  return (
    <div>
      {/* Desglose precio */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Resumen
        </div>

        {/* Línea coste pista — solo si no es gratuito */}
        {!isFree && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Coste pista</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>€{price}</span>
          </div>
        )}

        {/* Línea comisión */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            Comisión servicio
            <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
              {matchData.feeLabel || (isPrivate
                ? `Gorila (0,40€) · ${matchData.foundationName || "Asociación"} (0,10€)`
                : isFree
                  ? `Gorila (0,30€) · Club (0,10€) · ${matchData.foundationName || "Asociación"} (0,10€)`
                  : `Gorila (0,10€) · Club (0,10€) · ${matchData.foundationName || "Asociación"} (0,10€)`
              )}
            </span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>€{fee}</span>
        </div>

        {/* Badge fundación */}
        {matchData.foundationName && (
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.2)", fontSize: 11, color: "#9BE800", display: "flex", gap: 6, alignItems: "center" }}>
            <span>🤝</span>
            <span>0,10€ van a <strong>{matchData.foundationName}</strong></span>
          </div>
        )}

        {/* Nota pista privada */}
        {isPrivate && (
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", gap: 6, alignItems: "center" }}>
            <span>🔒</span>
            <span>Pista privada — comisión sin parte de club</span>
          </div>
        )}

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#74B800" }}>€{total}</span>
        </div>
      </div>

      {/* Stripe Elements — soporta Google Pay, Apple Pay, Bizum automáticamente */}
      <PaymentElement options={{
        layout: { type: "tabs", defaultCollapsed: false },
        wallets: { applePay: "auto", googlePay: "auto" },
      }} />

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 13, fontWeight: 800 }}>
          ⚠️ {error}
        </div>
      )}

      <button onClick={handlePay} disabled={!stripe || loading} style={{
        width: "100%", marginTop: 14, padding: "15px", borderRadius: 12, border: "none",
        background: loading ? "rgba(116,184,0,0.4)" : "linear-gradient(135deg,#74B800,#9BE800)",
        color: "#000", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
      }}>
        {loading ? "⏳ Procesando..." : `💳 Pagar €${total} y unirme`}
      </button>

      <div style={{ marginTop: 8, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
        🔒 Pago seguro con Stripe · Acepta Google Pay, Apple Pay y Bizum
      </div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export default function MatchPaymentModal({ match, session, onClose, onJoined, isCreatorAuth = false }) {
  const [step, setStep] = useState("paying");
  const [mood, setMood] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lanzar autorización automáticamente al abrir
  useEffect(() => {
    if (isCreatorAuth) handleCreatorAuth();
    else { setLoading(false); setStep("paying"); }
  }, []);

  const isPrivateCourt = String(match.club_id || "").startsWith("private:");
  const pricePerPlayer = parseFloat(match.price_per_player || 0);
  const serviceFeeCents = isPrivateCourt || pricePerPlayer === 0 ? 50 : 30;
  const totalPreview = (pricePerPlayer + serviceFeeCents / 100).toFixed(2);
  const levelColor = LEVEL_COLORS[match.level] || "#74B800";

  async function handleCreatorAuth() {
  setStep("paying");
  setLoading(true);
  setError(null);
  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const token = currentSession?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-match-authorization`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ matchId: match.id, userId: session.user.id, paymentMethodId: null }),
      }
    );
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Error al crear autorización");
    setClientSecret(data.clientSecret);
    setPaymentData(data);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}

  async function handleMoodSelect(selectedMood) {
    setMood(selectedMood);
    setStep("paying");
    setLoading(true);
    setError(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-match-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ matchId: match.id, userId: session.user.id }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al crear el pago");
      setClientSecret(data.clientSecret);
      setPaymentData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaySuccess() {
    setStep("success");
    setTimeout(() => { onJoined?.(); onClose?.(); }, 2000);
  }

  const matchDate = match.start_at
    ? new Date(match.start_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    : "";
  const matchTime = match.start_at
    ? new Date(match.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 40000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#1a1a1a", borderRadius: 20, padding: "24px 20px 32px", border: "1px solid rgba(116,184,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 999, margin: "0 auto 20px" }} />

        {/* Info partido */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 14px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${levelColor}20`, border: `1px solid ${levelColor}40`, display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>🎾</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{match.club_name || "Pista privada"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {matchDate} · {matchTime} · <span style={{ color: levelColor }}>{match.level}</span>
              {isPrivateCourt && <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.3)" }}>· 🔒 Privada</span>}
            </div>
          </div>
        </div>

{step === "auth" && (
  <>
    <div style={{ textAlign: "center", marginBottom: 20 }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>Reserva tu plaza</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, lineHeight: 1.5 }}>
        Se retendrán <strong style={{ color: "#74B800" }}>€{pricePerPlayer.toFixed(2)}</strong> en tu tarjeta.<br/>
        El cobro se hará efectivo 24h antes del partido.
      </div>
    </div>
    {error && (
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
        ⚠️ {error}
      </div>
    )}
    <button onClick={handleCreatorAuth} style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
      🔒 Añadir tarjeta y reservar
    </button>
    <button onClick={onClose} style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
      Cancelar
    </button>
  </>
)}

        {/* ── STEP: MOOD ── */}
        {step === "mood" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🦍</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>¿Con qué Gorila Mood vienes?</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                Pagarás €{totalPreview} (incluye comisión de servicio)
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

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
            <button onClick={onClose} style={{ width: "100%", marginTop: 14, padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
          </>
        )}

        {/* ── STEP: PAYING ── */}
        {step === "paying" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <button onClick={() => setStep("mood")} style={{ background: "none", border: "none", color: "#74B800", fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>💳 Pago seguro</div>
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32 }}>⏳</div>
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Preparando pago...</div>
              </div>
            )}

            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
                ⚠️ {error}
                <button onClick={() => handleMoodSelect(mood)} style={{ display: "block", marginTop: 8, fontSize: 12, color: "#ef4444", background: "none", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 900 }}>
                  🔄 Reintentar
                </button>
              </div>
            )}

            {clientSecret && stripePromise && !loading && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#74B800",
                      colorBackground: "#1a1a1a",
                      colorText: "#ffffff",
                      colorDanger: "#ef4444",
                      fontFamily: "system-ui, sans-serif",
                      borderRadius: "10px",
                    },
                  },

                }}
              >
                <PayForm
                  totalCents={paymentData?.totalCents || paymentData?.amountCents || 0}
                  pricePerPlayerCents={paymentData?.pricePerPlayerCents || 0}
                  matchData={paymentData?.matchData || { isFree: false, isPrivateCourt: false, feeLabel: '', foundationName: null }}
                  onSuccess={handlePaySuccess}
                />
              </Elements>
            )}
          </>
        )}

        {/* ── STEP: SUCCESS ── */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🦍</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>¡Pago confirmado!</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              Ya estás dentro del partido en {match.club_name || "pista privada"}
            </div>
            {paymentData?.matchData?.foundationName && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(116,184,0,0.1)", border: "1px solid rgba(116,184,0,0.25)", fontSize: 13, color: "#9BE800" }}>
                🤝 0,10€ donados a <strong>{paymentData.matchData.foundationName}</strong>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}