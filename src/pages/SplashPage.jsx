import { useEffect, useState, useRef } from "react";

export default function SplashPage() {
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [logoIn, setLogoIn] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;

    // Intentar autoplay (Android/desktop)
    vid.play().then(() => {
      setVideoReady(true);
      setTimeout(() => setLogoIn(true), 300);
    }).catch(() => {
      // iOS necesita gesto — mostrar pantalla de tap
      setNeedsTap(true);
      setTimeout(() => setLogoIn(true), 200);
    });
  }, []);

  async function handleTap() {
    if (!needsTap) return;
    const vid = videoRef.current;
    if (vid) {
      vid.muted = true;
      try { await vid.play(); setVideoReady(true); } catch {}
    }
    setNeedsTap(false);
  }

  return (
    <div
      onClick={handleTap}
      onTouchEnd={e => { e.preventDefault(); handleTap(); }}
      style={{ position:"fixed", inset:0, zIndex:999999, background:"#000", overflow:"hidden" }}
    >
      {/* VIDEO SIEMPRE PRESENTE */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        muted loop playsInline preload="auto"
        style={{
          position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          opacity: videoReady ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      />

      {/* FONDO FALLBACK cuando no hay video */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(135deg, #0a0f0a 0%, #0d1a0d 50%, #050510 100%)",
        opacity: videoReady ? 0 : 1,
        transition:"opacity 0.8s ease",
      }}/>

      {/* OVERLAY */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.88) 100%)",
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
      }}>
        {/* LOGO */}
        <div style={{ position:"relative" }}>
          <div style={{
            position:"absolute", inset:-16, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(116,184,0,0.25) 0%, transparent 70%)",
            animation:"glow 2.5s ease-in-out infinite",
          }}/>
          <img src="/imglogog.png" alt="Gorila Pádel" style={{
            width:100, height:100, objectFit:"contain", borderRadius:22,
            border:"2px solid rgba(116,184,0,0.5)",
            boxShadow:"0 0 40px rgba(116,184,0,0.35), 0 20px 60px rgba(0,0,0,0.7)",
            position:"relative", animation:"pulse 2.5s ease-in-out infinite",
          }}/>
        </div>

        <div style={{ fontSize:30, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", textShadow:"0 2px 20px rgba(0,0,0,0.9)" }}>
          Gorila Pádel
        </div>

        <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", textAlign:"center", lineHeight:1.6, maxWidth:260, textShadow:"0 1px 10px rgba(0,0,0,0.9)" }}>
          Únete · Crea partidos · Encuentra clubs
        </div>

        {/* TAP TO START en iOS */}
        {needsTap ? (
          <div style={{
            marginTop:12, padding:"14px 36px", borderRadius:999,
            border:"2px solid rgba(116,184,0,0.8)",
            color:"#74B800", fontWeight:900, fontSize:16,
            animation:"tap-pulse 1.4s ease-in-out infinite",
            textShadow:"0 0 20px rgba(116,184,0,0.5)",
          }}>
            Toca para entrar 🦍
          </div>
        ) : (
          <div style={{ marginTop:8, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            <div style={{ width:160, height:3, borderRadius:999, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:999, background:"linear-gradient(90deg,#74B800,#9BE800)", animation:"load 1.8s ease-in-out infinite" }}/>
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:"0.12em", textTransform:"uppercase" }}>
              Cargando…
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes glow { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.12)} }
        @keyframes tap-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.96)} }
        @keyframes load { 0%{width:0%;margin-left:0%} 50%{width:65%;margin-left:17%} 100%{width:0%;margin-left:100%} }
      `}</style>
    </div>
  );
}
