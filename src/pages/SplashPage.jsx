import { useEffect, useState, useRef } from "react";

export default function SplashPage() {
  const videoRef = useRef(null);
  const [tapped, setTapped] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  async function handleTap() {
    if (tapped) return;
    setTapped(true);
    if (videoRef.current) {
      videoRef.current.muted = true;
      try { await videoRef.current.play(); } catch {}
    }
    setTimeout(() => setLogoVisible(true), 200);
  }

  useEffect(() => {
    // Intentar autoplay sin gesto (funciona en Android/desktop)
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().then(() => {
      setTapped(true);
      setTimeout(() => setLogoVisible(true), 200);
    }).catch(() => {
      // iOS necesita tap — no hacer nada, esperamos el tap
    });
  }, []);

  return (
    <div
      onClick={handleTap}
      onTouchStart={handleTap}
      style={{ position:"fixed", inset:0, zIndex:999999, background:"#000", overflow:"hidden", cursor:"pointer" }}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        muted loop playsInline
        preload="auto"
        disablePictureInPicture
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
      />

      {/* OVERLAY */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)",
      }}/>

      {/* TAP TO START — solo si no ha hecho tap */}
      {!tapped && (
        <div style={{
          position:"absolute", inset:0,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:20,
        }}>
          <img src="/imglogog.png" alt="Gorila Pádel"
            style={{ width:100, height:100, objectFit:"contain", borderRadius:22,
              border:"2px solid rgba(116,184,0,0.6)",
              boxShadow:"0 0 40px rgba(116,184,0,0.4)" }} />
          <div style={{ fontSize:28, fontWeight:900, color:"#fff" }}>Gorila Pádel</div>
          <div style={{
            marginTop:8, padding:"14px 32px", borderRadius:999,
            border:"2px solid rgba(116,184,0,0.8)",
            color:"#74B800", fontWeight:900, fontSize:16,
            animation:"tap-pulse 1.5s ease-in-out infinite",
          }}>
            Toca para empezar
          </div>
        </div>
      )}

      {/* LOGO ANIMADO — tras tap */}
      {tapped && (
        <div style={{
          position:"absolute", inset:0,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16, padding:32,
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? "translateY(0)" : "translateY(20px)",
          transition:"all 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <div style={{ position:"relative" }}>
            <div style={{
              position:"absolute", inset:-12, borderRadius:"50%",
              background:"radial-gradient(circle, rgba(116,184,0,0.3) 0%, transparent 70%)",
              animation:"gorila-glow 2s ease-in-out infinite",
            }}/>
            <img src="/imglogog.png" alt="Gorila Pádel"
              style={{ width:110, height:110, objectFit:"contain", borderRadius:24,
                border:"2px solid rgba(116,184,0,0.6)",
                boxShadow:"0 0 40px rgba(116,184,0,0.4), 0 20px 60px rgba(0,0,0,0.6)",
                position:"relative", animation:"gorila-pulse 2s ease-in-out infinite" }} />
          </div>
          <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:"-0.5px", textShadow:"0 2px 20px rgba(0,0,0,0.8)" }}>
            Gorila Pádel
          </div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.7)", textAlign:"center", lineHeight:1.5, maxWidth:260, textShadow:"0 1px 10px rgba(0,0,0,0.8)" }}>
            Únete · Crea partidos · Encuentra clubs
          </div>
          <div style={{ width:180, height:3, borderRadius:999, background:"rgba(255,255,255,0.1)", overflow:"hidden", marginTop:8 }}>
            <div style={{ height:"100%", borderRadius:999, background:"linear-gradient(90deg,#74B800,#9BE800)", animation:"gorila-load 1.8s ease-in-out infinite" }}/>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
            Cargando…
          </div>
        </div>
      )}

      <style>{`
        @keyframes tap-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.97)} }
        @keyframes gorila-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes gorila-glow { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes gorila-load { 0%{width:0%;margin-left:0%} 50%{width:70%;margin-left:15%} 100%{width:0%;margin-left:100%} }
      `}</style>
    </div>
  );
}
