import { useEffect, useRef, useState } from "react";

export default function SplashPage() {
  const videoRef = useRef(null);
  const [logoIn, setLogoIn] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    setTimeout(() => setLogoIn(true), 200);

    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.volume = 0;

    // Intentar autoplay inmediato (Android/desktop)
    vid.play().then(() => {
      setVideoPlaying(true);
    }).catch(() => {
      // iOS — esperar cualquier interacción del usuario
    });

    // Listener global para iOS — cualquier toque arranca el video
    const tryPlay = () => {
      if (videoPlaying) return;
      vid.muted = true;
      vid.play().then(() => setVideoPlaying(true)).catch(() => {});
    };

    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    document.addEventListener("click", tryPlay, { once: true });

    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
    };
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:999999, background:"#000", overflow:"hidden" }}>
      {/* VIDEO — siempre presente, opacidad según si está reproduciendo */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        muted loop playsInline preload="auto"
        autoPlay
        x-webkit-airplay="deny"
        disablePictureInPicture
        style={{
          position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          opacity: 1,
        }}
      />

      {/* FONDO cuando no hay video */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(135deg, #050510 0%, #0a1a0a 100%)",
        opacity: videoPlaying ? 0 : 1,
        transition:"opacity 1s ease",
        pointerEvents:"none",
      }}/>

      {/* OVERLAY */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.85) 100%)",
        pointerEvents:"none",
      }}/>

      {/* CONTENIDO */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        gap:14, padding:32,
        opacity: logoIn ? 1 : 0,
        transform: logoIn ? "translateY(0)" : "translateY(24px)",
        transition:"all 0.9s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents:"none",
      }}>
        <div style={{ position:"relative" }}>
          <div style={{
            position:"absolute", inset:-16, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(116,184,0,0.25) 0%, transparent 70%)",
            animation:"glow 2.5s ease-in-out infinite",
          }}/>
          <img src="/imglogog.png" alt="GorilaGo!" style={{
            width:100, height:100, objectFit:"contain", borderRadius:22,
            border:"2px solid rgba(116,184,0,0.5)",
            boxShadow:"0 0 40px rgba(116,184,0,0.35), 0 20px 60px rgba(0,0,0,0.7)",
            position:"relative", animation:"pulse 2.5s ease-in-out infinite",
          }}/>
        </div>

        <div style={{ fontSize:30, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", textShadow:"0 2px 20px rgba(0,0,0,0.9)" }}>
          GorilaGo!
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", textAlign:"center", lineHeight:1.6, maxWidth:260, textShadow:"0 1px 10px rgba(0,0,0,0.9)" }}>
          La app que ayuda jugando
        </div>

        <div style={{ width:160, height:3, borderRadius:999, background:"rgba(255,255,255,0.1)", overflow:"hidden", marginTop:8 }}>
          <div style={{ height:"100%", borderRadius:999, background:"linear-gradient(90deg,#74B800,#9BE800)", animation:"load 1.8s ease-in-out infinite" }}/>
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:"0.12em", textTransform:"uppercase" }}>
          Cargando…
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes glow { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.12)} }
        @keyframes load { 0%{width:0%;margin-left:0%} 50%{width:65%;margin-left:17%} 100%{width:0%;margin-left:100%} }
      `}</style>
    </div>
  );
}
