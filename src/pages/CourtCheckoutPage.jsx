// src/pages/CourtCheckoutPage.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "../services/supabaseClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function PayForm({ slotData, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (confirmError) { setError(confirmError.message); setLoading(false); return; }
    if (paymentIntent?.status === "succeeded") onSuccess(paymentIntent);
    setLoading(false);
  }

  return (
    <form onSubmit={handlePay}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <div style={{marginTop:10,padding:10,borderRadius:8,background:"rgba(239,68,68,0.15)",color:"#ff6b6b",fontSize:12}}>{error}</div>}
      <button type="submit" disabled={!stripe||loading}
        style={{marginTop:16,width:"100%",padding:14,borderRadius:12,background:loading?"rgba(116,184,0,0.4)":"linear-gradient(135deg,#74B800,#9BE800)",color:"#000",fontWeight:900,border:"none",cursor:loading?"not-allowed":"pointer",fontSize:14}}>
        {loading?"Procesando…":`Pagar ${slotData?.price||0}€`}
      </button>
      <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,0.3)"}}>🔒 Pago seguro con Stripe</div>
    </form>
  );
}

export default function CourtCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get("slotId");
  const matchId = searchParams.get("matchId");
  const [session, setSession] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [slotData, setSlotData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data})=>setSession(data?.session??null));
  }, []);

  useEffect(() => {
    if (session?.user?.id && slotId) createIntent();
  }, [session, slotId]);

  async function createIntent() {
    try {
      setLoading(true);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-court-payment`,
        { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`},
          body: JSON.stringify({ slotId, userId: session.user.id, matchId }) }
      );
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Error al crear pago"); return; }
      setClientSecret(data.clientSecret);
      setSlotData(data.slotData);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleSuccess(pi) {
    setSuccess(true);
    setTimeout(() => navigate("/partidos"), 3000);
  }

  const appearance = { theme:"night", variables:{ colorPrimary:"#74B800", colorBackground:"#111", colorText:"#ffffff", colorDanger:"#ef4444", fontFamily:"system-ui", borderRadius:"10px" } };

  return (
    <div style={{background:"#0a0a0a",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:440,background:"#111",borderRadius:20,border:"1px solid rgba(116,184,0,0.2)",padding:24}}>
        <button onClick={()=>navigate(-1)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:13,marginBottom:16,padding:0}}>← Volver</button>
        <h2 style={{color:"#74B800",fontWeight:900,fontSize:20,margin:"0 0 4px"}}>💳 Pagar reserva</h2>

        {slotData && (
          <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(116,184,0,0.08)",border:"1px solid rgba(116,184,0,0.15)",marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:900,color:"#fff"}}>{slotData.courtName}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3}}>📅 {slotData.date} · 🕐 {slotData.startTime}–{slotData.endTime}</div>
            <div style={{fontSize:20,fontWeight:900,color:"#74B800",marginTop:6}}>{slotData.price}€</div>
          </div>
        )}

        {success ? (
          <div style={{textAlign:"center",padding:20}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:18,fontWeight:900,color:"#74B800"}}>¡Pago completado!</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:6}}>Redirigiendo…</div>
          </div>
        ) : loading ? (
          <div style={{textAlign:"center",padding:30,color:"rgba(255,255,255,0.4)"}}>⏳ Preparando pago…</div>
        ) : error ? (
          <div style={{padding:14,borderRadius:10,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#ff6b6b",fontSize:13}}>{error}</div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <PayForm slotData={slotData} onSuccess={handleSuccess} />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}
