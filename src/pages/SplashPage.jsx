import { useEffect, useState } from "react";

export default function SplashPage() {
  const [phase, setPhase] = useState("video"); // video | logo | done
  const [logoVisible, setLogoVisible] = useState(false);

  useEffect(() => {
    // Logo aparece tras 0.3s
    const t1 = setTimeout(() => setLogoVisible(true), 300);
    return () => clearTimeout(t1);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999999,
      background: "#000", overflow: "hidden",
    }}>
      {/* VIDEO DE FONDO */}
      <video
        src="/splash.mp4"
        autoPlay muted loop playsInline
        disablePictureInPicture
        preload="auto"
        ref={el => {
          if (el) {
            el.muted = true;
            el.play().catch(() => {});
          }
        }}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
        }}
      />

      {/* OVERLAY OSCURO */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)",
      }} />

      {/* CONTENIDO CENTRADO */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16, padding: 32,
        opacity: logoVisible ? 1 : 0,
        transform: logoVisible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* LOGO */}
        <div style={{
          position: "relative",
          animation: logoVisible ? "gorila-pulse 2s ease-in-out infinite" : "none",
        }}>
          <div style={{
            position: "absolute", inset: -12,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(116,184,0,0.3) 0%, transparent 70%)",
            animation: "gorila-glow 2s ease-in-out infinite",
          }} />
          <img
            src="/imglogog.png"
            alt="Gorila Pádel"
            style={{
              width: 110, height: 110,
              objectFit: "contain",
              borderRadius: 24,
              border: "2px solid rgba(116,184,0,0.6)",
              boxShadow: "0 0 40px rgba(116,184,0,0.4), 0 20px 60px rgba(0,0,0,0.6)",
              position: "relative",
            }}
          />
        </div>

        {/* TÍTULO */}
        <div style={{
          fontSize: 32, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.5px", textAlign: "center",
          textShadow: "0 2px 20px rgba(0,0,0,0.8)",
        }}>
          Gorila Pádel
        </div>

        {/* TAGLINE */}
        <div style={{
          fontSize: 14, color: "rgba(255,255,255,0.7)",
          textAlign: "center", lineHeight: 1.5,
          textShadow: "0 1px 10px rgba(0,0,0,0.8)",
          maxWidth: 260,
        }}>
          Únete · Crea partidos · Encuentra clubs
        </div>

        {/* BARRA DE CARGA */}
        <div style={{
          width: 180, height: 3, borderRadius: 999,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden", marginTop: 8,
        }}>
          <div style={{
            height: "100%", borderRadius: 999,
            background: "linear-gradient(90deg, #74B800, #9BE800)",
            animation: "gorila-load 1.8s ease-in-out infinite",
          }} />
        </div>

        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          Cargando…
        </div>
      </div>

      {/* ANIMACIONES */}
      <style>{`
        @keyframes gorila-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes gorila-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes gorila-load {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
