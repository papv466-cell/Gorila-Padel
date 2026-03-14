// src/components/AppTour.jsx — Tour interactivo primera vez
import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";

const STEPS = [
  {
    id: "welcome",
    title: "¡Bienvenido a Gorila Pádel! 🦍",
    body: "Te enseñamos todo en 30 segundos. Puedes saltar el tour cuando quieras.",
    target: null, // centrado
    position: "center",
  },
  {
    id: "home",
    title: "🏠 Inicio",
    body: "Aquí ves tus próximos partidos, novedades de la comunidad y accesos rápidos a todo.",
    target: "nav-home",
    position: "top",
  },
  {
    id: "matches",
    title: "🎾 Partidos",
    body: "Crea o únete a partidos cerca de ti. Filtra por nivel, fecha y tipo de juego.",
    target: "nav-matches",
    position: "top",
  },
  {
    id: "clubs",
    title: "🏟️ Clubs",
    body: "Encuentra clubs, reserva pistas y paga directamente desde la app. Puedes dividir el pago entre 4 jugadores.",
    target: "nav-clubs",
    position: "top",
  },
  {
    id: "inclusive",
    title: "♿ Pádel Inclusivo",
    body: "Partidos adaptados para todos. Cada reserva dona 10cts a asociaciones inclusivas.",
    target: "nav-inclusive",
    position: "top",
  },
  {
    id: "profile",
    title: "👤 Tu Perfil",
    body: "Gestiona tu perfil, ve tu historial de XP, logros y estadísticas de juego.",
    target: "nav-profile",
    position: "top",
  },
  {
    id: "create",
    title: "➕ Crear partido",
    body: "Pulsa aquí para crear un partido nuevo. Elige fecha, hora, nivel y número de jugadores.",
    target: "btn-create",
    position: "bottom",
  },
  {
    id: "notifications",
    title: "🔔 Notificaciones",
    body: "Aquí recibirás avisos de partidos, invitaciones y valoraciones.",
    target: "btn-notif",
    position: "bottom",
  },
  {
    id: "game",
    title: "🦍 Gorila Word",
    body: "¡Un juego diario exclusivo! Adivina la palabra de pádel. Compite con todos los usuarios.",
    target: "banner-game",
    position: "bottom",
  },
  {
    id: "done",
    title: "¡Ya lo sabes todo! 🎉",
    body: "Si tienes dudas en algún botón, mantenlo pulsado para ver su descripción. ¡A jugar!",
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
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.6, marginBottom:18 }}>
          {current.body}
        </div>

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
