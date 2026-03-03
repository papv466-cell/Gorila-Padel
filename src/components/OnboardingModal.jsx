// src/components/OnboardingModal.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const LEVELS = [
  { key:"iniciacion", label:"Iniciación", emoji:"🌱", desc:"Llevo poco tiempo jugando" },
  { key:"medio", label:"Intermedio", emoji:"🎾", desc:"Juego con regularidad" },
  { key:"avanzado", label:"Avanzado", emoji:"🔥", desc:"Compito y tengo buen nivel" },
];

const VIBES = [
  { key:"competitivo", label:"Competitivo", emoji:"🏆" },
  { key:"social", label:"Social", emoji:"🤝" },
  { key:"fitness", label:"Fitness", emoji:"💪" },
  { key:"divertido", label:"Divertido", emoji:"😄" },
];

export default function OnboardingModal({ session, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState("medio");
  const [vibe, setVibe] = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  async function requestNotifications() {
    try {
      const perm = await Notification.requestPermission();
      setNotifGranted(perm === "granted");
    } catch(e) {}
    setStep(4);
  }

  async function finish() {
    try {
      setSaving(true);
      await supabase.from("profiles").update({
        level,
        onboarding_done: true,
      }).eq("id", session.user.id);
      onClose();
    } catch(e) { console.error(e); onClose(); }
    finally { setSaving(false); }
  }

  const S = {
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:999999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
    modal: { width:"min(500px,100%)", background:"#111", borderRadius:24, border:"1px solid rgba(116,184,0,0.2)", padding:28, maxHeight:"90vh", overflowY:"auto" },
    progress: { display:"flex", gap:6, marginBottom:28 },
    dot: (active, done) => ({ flex:1, height:3, borderRadius:999, background: done?"#74B800":active?"rgba(116,184,0,0.5)":"rgba(255,255,255,0.1)", transition:"background .3s" }),
    title: { fontSize:22, fontWeight:900, color:"#fff", marginBottom:6 },
    sub: { fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:24, lineHeight:1.5 },
    btn: (c) => ({ padding:"13px", borderRadius:12, border:"none", cursor:"pointer", fontWeight:900, fontSize:14, width:"100%",
      background:c==="green"?"linear-gradient(135deg,#74B800,#9BE800)":c==="ghost"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)",
      color:c==="green"?"#000":"#fff" }),
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Progress */}
        <div style={S.progress}>
          {Array.from({length:totalSteps}).map((_,i)=>(
            <div key={i} style={S.dot(i+1===step, i+1<step)} />
          ))}
        </div>

        {/* STEP 1 — Bienvenida */}
        {step===1 && (
          <>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:64,marginBottom:12}}>🦍</div>
              <div style={{...S.title, textAlign:"center"}}>¡Bienvenido a <span style={{color:"#74B800"}}>Gorila Padel</span>!</div>
              <div style={{...S.sub, textAlign:"center"}}>La app para organizar partidos, reservar pistas y conectar con jugadores cerca de ti.</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                {emoji:"🏓", text:"Crea o únete a partidos en segundos"},
                {emoji:"📅", text:"Reserva pistas en tu club favorito"},
                {emoji:"🏆", text:"Sube en el ranking y gana badges"},
                {emoji:"📸", text:"Comparte momentos en Gorilandia"},
              ].map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.12)"}}>
                  <span style={{fontSize:22}}>{f.emoji}</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600}}>{f.text}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setStep(2)} style={S.btn("green")}>Empezar →</button>
          </>
        )}

        {/* STEP 2 — Nivel */}
        {step===2 && (
          <>
            <div style={S.title}>¿Cuál es tu nivel?</div>
            <div style={S.sub}>Esto nos ayuda a mostrarte partidos adecuados para ti.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
              {LEVELS.map(l=>(
                <div key={l.key} onClick={()=>setLevel(l.key)}
                  style={{padding:"14px 16px",borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:14,
                    background:level===l.key?"rgba(116,184,0,0.15)":"rgba(255,255,255,0.04)",
                    border:level===l.key?"2px solid #74B800":"2px solid rgba(255,255,255,0.08)"}}>
                  <span style={{fontSize:28}}>{l.emoji}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:900,color:level===l.key?"#74B800":"#fff"}}>{l.label}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l.desc}</div>
                  </div>
                  {level===l.key && <span style={{marginLeft:"auto",color:"#74B800",fontSize:18}}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep(3)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={()=>setStep(1)} style={{...S.btn("ghost"),width:"auto",padding:"13px 16px"}}>←</button>
            </div>
          </>
        )}

        {/* STEP 3 — Vibe */}
        {step===3 && (
          <>
            <div style={S.title}>¿Cómo juegas?</div>
            <div style={S.sub}>Elige tu estilo de juego para encontrar compañeros compatibles.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
              {VIBES.map(v=>(
                <div key={v.key} onClick={()=>setVibe(v.key===vibe?null:v.key)}
                  style={{padding:"18px 12px",borderRadius:14,cursor:"pointer",textAlign:"center",
                    background:vibe===v.key?"rgba(116,184,0,0.15)":"rgba(255,255,255,0.04)",
                    border:vibe===v.key?"2px solid #74B800":"2px solid rgba(255,255,255,0.08)"}}>
                  <div style={{fontSize:32,marginBottom:8}}>{v.emoji}</div>
                  <div style={{fontSize:13,fontWeight:900,color:vibe===v.key?"#74B800":"#fff"}}>{v.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep(4)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={()=>setStep(2)} style={{...S.btn("ghost"),width:"auto",padding:"13px 16px"}}>←</button>
            </div>
          </>
        )}

        {/* STEP 4 — Notificaciones + Fin */}
        {step===4 && (
          <>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:12}}>🔔</div>
              <div style={{...S.title,textAlign:"center"}}>Activa las notificaciones</div>
              <div style={{...S.sub,textAlign:"center"}}>Entérate cuando alguien te invite a un partido, una pista se libere, o alguien te valore.</div>
            </div>
            {!notifGranted ? (
              <button onClick={requestNotifications} style={{...S.btn("green"),marginBottom:10}}>🔔 Activar notificaciones</button>
            ) : (
              <div style={{padding:"12px",borderRadius:12,background:"rgba(116,184,0,0.1)",border:"1px solid rgba(116,184,0,0.3)",textAlign:"center",color:"#74B800",fontWeight:900,marginBottom:10}}>
                ✅ Notificaciones activadas
              </div>
            )}
            <button onClick={finish} disabled={saving}
              style={{...S.btn(notifGranted?"ghost":"green"),marginBottom:8}}>
              {saving?"Guardando…":notifGranted?"¡Empezar a jugar! 🦍":"Ahora no"}
            </button>
            {notifGranted && (
              <button onClick={finish} disabled={saving} style={S.btn("green")}>
                {saving?"Guardando…":"¡Empezar a jugar! 🦍"}
              </button>
            )}
          </>
        )}

      </div>
    </div>
  );
}
