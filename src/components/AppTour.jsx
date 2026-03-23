// src/components/AppTour.jsx — Tour interactivo primera vez
import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";

const STEPS = [
  {
    id: "welcome",
    title: "Bienvenido a MonkeyGorila 🦍",
    body: "La app donde jugar al pádel ayuda a personas con discapacidad a practicar deporte. Jugando se ayuda — y se ve.",
    target: null,
    position: "center",
  },
  {
    id: "proyecto1",
    title: "🏗️ Pistas adaptadas en Madrid",
    body: "Estamos construyendo 2 pistas de pádel completamente accesibles para sillas de ruedas. Cada reserva que hagas aporta directamente a este proyecto.",
    target: null,
    position: "center",
    project: true,
    progress: 0,
    goal: 5000,
    emoji: "♿",
  },
  {
    id: "proyecto2",
    title: "🎓 Becas para jugadores con discapacidad",
    body: "Cubrimos cuotas de club y clases para jugadores con discapacidad durante un año entero. Con tus donaciones post-partido hacemos esto posible.",
    target: null,
    position: "center",
    project: true,
    progress: 0,
    goal: 3000,
    emoji: "🎾",
  },
  {
    id: "proyecto3",
    title: "🏆 Torneo inclusivo nacional",
    body: "El primer torneo nacional de pádel inclusivo con categorías para todos los niveles y discapacidades. ¿Nos ayudas a organizarlo?",
    target: null,
    position: "center",
    project: true,
    progress: 0,
    goal: 8000,
    emoji: "🏅",
  },
  {
    id: "how",
    title: "💛 ¿Cómo ayudas jugando?",
    body: "Cada reserva incluye 0,10€ para MonkeyGorila + 0,10€ al proyecto activo + 0,10€ a la asociación del club. Puedes ampliar tu donación cuando quieras.",
    target: null,
    position: "center",
  },
  {
    id: "juntos",
    title: "♿ Partidos Juntos",
    body: "Partidos adaptados para todos. Aquí encontrarás partidos inclusivos donde juegan juntos personas con y sin discapacidad.",
    target: "nav-juntos",
    position: "top",
  },
  {
    id: "notifications",
    title: "🔔 Notificaciones",
    body: "Te avisamos cuando alguien se une a tu partido, te valora o hay novedades en los proyectos que apoyas.",
    target: "btn-notif",
    position: "bottom",
  },
  {
    id: "done",
    title: "¡Ya eres parte de MonkeyGorila! 🎉",
    body: "Cada partido que juegues ayuda a alguien a practicar deporte. Ve a Proyectos para ver el impacto en tiempo real.",
    target: null,
    position: "center",
  },
];

export default function AppTour({ session, onClose }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const current = STEPS[step];

  useEffect(() => {
    if (current.target) {
      const el = document.getElementById(current.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  async function finish() {
    try {
      if (session?.user?.id) {
        await supabase.from("profiles").update({ tour_done: true }).eq("id", session.user.id);
      }
    } catch {}
    onClose();
  }

  const isLast = step === STEPS.length - 1;
  const isCenter = current.position === "center" || !targetRect;

  // Posición del tooltip
  let tooltipStyle = {
    position: "fixed",
    zIndex: 1000001,
    width: "min(320px, 90vw)",
    background: "#1a1a2e",
    border: "2px solid #74B800",
    borderRadius: 18,
    padding: "20px 22px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
  };

  if (isCenter) {
    tooltipStyle = {
      ...tooltipStyle,
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else if (current.position === "top" && targetRect) {
    tooltipStyle = {
      ...tooltipStyle,
      bottom: window.innerHeight - targetRect.top + 12,
      left: "50%",
      transform: "translateX(-50%)",
    };
  } else if (targetRect) {
    tooltipStyle = {
      ...tooltipStyle,
      top: targetRect.bottom + 12,
      left: "50%",
      transform: "translateX(-50%)",
    };
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000000, pointerEvents:"none" }}>
      {/* Overlay oscuro con hueco en el target */}
      <div style={{
        position:"absolute", inset:0,
        background: "rgba(0,0,0,0.75)",
        pointerEvents:"auto",
      }} onClick={() => !isLast ? setStep(s=>s+1) : finish()} />

      {/* Highlight del target */}
      {targetRect && (
        <div style={{
          position:"fixed",
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          borderRadius: 12,
          border: "3px solid #74B800",
          boxShadow: "0 0 0 4px rgba(116,184,0,0.3), 0 0 30px rgba(116,184,0,0.4)",
          pointerEvents:"none",
          animation: "tour-pulse 1.5s ease-in-out infinite",
          zIndex: 1000001,
        }}/>
      )}

      {/* Tooltip */}
      <div style={{...tooltipStyle, pointerEvents:"auto"}}>
        {/* Progreso */}
        <div style={{ display:"flex", gap:4, marginBottom:14 }}>
          {STEPS.map((_,i) => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:999,
              background: i <= step ? "#74B800" : "rgba(255,255,255,0.1)",
              transition:"background 0.3s",
            }}/>
          ))}
        </div>

        <div style={{ fontSize:18, fontWeight:900, color:"#fff", marginBottom:8 }}>
          {current.title}
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.6, marginBottom: current.project ? 12 : 18 }}>
          {current.body}
        </div>
        {current.project && (
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
              <span style={{ color:"rgba(255,255,255,0.40)" }}>Recaudado</span>
              <span style={{ color:"#2ECC71", fontWeight:700 }}>{current.progress} € / {current.goal} €</span>
            </div>
            <div style={{ height:6, borderRadius:999, background:"rgba(255,255,255,0.10)" }}>
              <div style={{ height:"100%", width:`${Math.round((current.progress/current.goal)*100)}%`, borderRadius:999, background:"linear-gradient(90deg,#2ECC71,#27AE60)" }} />
            </div>
            <div style={{ marginTop:8, textAlign:"right" }}>
              <a href="/proyectos" style={{ fontSize:11, color:"#E67E22", textDecoration:"none", fontWeight:700 }}>Ver todos los proyectos →</a>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {isLast ? (
            <button onClick={finish} style={{
              flex:1, padding:"12px", borderRadius:12,
              background:"linear-gradient(135deg,#74B800,#9BE800)",
              border:"none", color:"#000", fontWeight:900, fontSize:15, cursor:"pointer",
            }}>
              ¡A jugar! 🦍
            </button>
          ) : (
            <>
              <button onClick={() => setStep(s=>s+1)} style={{
                flex:1, padding:"12px", borderRadius:12,
                background:"linear-gradient(135deg,#74B800,#9BE800)",
                border:"none", color:"#000", fontWeight:900, fontSize:14, cursor:"pointer",
              }}>
                Siguiente →
              </button>
              <button onClick={finish} style={{
                padding:"12px 16px", borderRadius:12,
                background:"rgba(255,255,255,0.08)",
                border:"1px solid rgba(255,255,255,0.15)",
                color:"rgba(255,255,255,0.5)", fontWeight:700, fontSize:12, cursor:"pointer",
              }}>
                Saltar
              </button>
            </>
          )}
        </div>

        {step > 0 && (
          <div style={{ textAlign:"center", marginTop:10 }}>
            <button onClick={() => setStep(s=>s-1)} style={{
              background:"none", border:"none", color:"rgba(255,255,255,0.3)",
              fontSize:12, cursor:"pointer",
            }}>← Anterior</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%,100% { box-shadow: 0 0 0 4px rgba(116,184,0,0.3), 0 0 20px rgba(116,184,0,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(116,184,0,0.15), 0 0 40px rgba(116,184,0,0.5); }
        }
      `}</style>
    </div>
  );
}
