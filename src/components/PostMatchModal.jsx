// src/components/PostMatchModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const VIBES = [
  { key: "fair_play", label: "Fair Play", icon: "🤝" },
  { key: "buen_nivel", label: "Buen nivel", icon: "🎾" },
  { key: "comunicativo", label: "Comunicativo", icon: "💬" },
  { key: "puntual", label: "Puntual", icon: "⏰" },
  { key: "divertido", label: "Divertido", icon: "😄" },
];

const MOODS = [
  { key: "fire", emoji: "🔥", label: "¡Fuego!" },
  { key: "happy", emoji: "😄", label: "Bien" },
  { key: "neutral", emoji: "😐", label: "Regular" },
  { key: "tired", emoji: "😤", label: "Difícil" },
  { key: "bad", emoji: "😞", label: "Mal rollo" },
];

export default function PostMatchModal({ match, players, session, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=resultado, 2=valorar jugadores, 3=mood, 4=gracias
  const [sets, setSets] = useState([{ a: "", b: "" }, { a: "", b: "" }]);
  const [winner, setWinner] = useState(null); // 'a' | 'b'
  const [ratings, setRatings] = useState({}); // {userId: {rating, vibe}}
  const [mood, setMood] = useState(null);
  const [saving, setSaving] = useState(false);

  const otherPlayers = (players || []).filter(p => p.player_uuid !== session?.user?.id);
  const canvasRef = useRef(null);

  const generarYCompartir = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');

      // Fondo negro
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 1080, 1920);

      // Gradiente verde en la parte superior
      const grad = ctx.createLinearGradient(0, 0, 1080, 600);
      grad.addColorStop(0, 'rgba(116,184,0,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 600);

      // Logo texto
      ctx.fillStyle = '#74B800';
      ctx.font = 'bold 52px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Gorila Pádel 🦍', 540, 140);

      // Club y fecha
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '36px Arial';
      ctx.fillText(match?.club_name || 'Pádel', 540, 210);

      const fecha = match?.start_at ? new Date(match.start_at).toLocaleDateString('es-ES', {day:'numeric',month:'long'}) : '';
      ctx.fillText(fecha, 540, 260);

      // Marcador
      const setsValidos = sets.filter(s => s.a !== '' || s.b !== '');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 120px Arial';
      const marcador = setsValidos.map(s => `${s.a}-${s.b}`).join('  ');
      ctx.fillText(marcador || '?-?', 540, 480);

      // Ganador
      const ganador = winner || calcWinner();
      if (ganador) {
        ctx.fillStyle = '#74B800';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(ganador === 'a' ? '🏆 ¡Victoria!' : '💪 Buen partido', 540, 580);
      }

      // Línea separadora
      ctx.strokeStyle = 'rgba(116,184,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 640);
      ctx.lineTo(980, 640);
      ctx.stroke();

      // Jugadores
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '34px Arial';
      ctx.fillText('👥 ' + (players||[]).map(p=>p.profiles_public?.name||p.handle||'Jugador').join(' · '), 540, 720);

      // Nivel
      ctx.fillStyle = 'rgba(116,184,0,0.8)';
      ctx.font = 'bold 32px Arial';
      ctx.fillText(`Nivel: ${match?.level || ''}`, 540, 790);

      // Hashtags
      ctx.fillStyle = 'rgba(116,184,0,0.6)';
      ctx.font = '30px Arial';
      ctx.fillText('#GorilaoPadel #PadelInclusivoSinLimites', 540, 1800);
      ctx.fillText('gorilapadel.com', 540, 1860);

      // Descargar o compartir
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'gorila-resultado.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Mi partido en Gorila Pádel',
            text: `Resultado: ${marcador} 🦍`,
          });
        } else {
          // Fallback: descargar
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'gorila-resultado.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');

    } catch(e) {
      console.error('Error generando imagen:', e);
    }
  }, [sets, winner, match, players]);

  function addSet() { if (sets.length < 3) setSets([...sets, { a: "", b: "" }]); }

  function calcWinner() {
    let winsA = 0, winsB = 0;
    sets.forEach(s => {
      const a = parseInt(s.a || 0), b = parseInt(s.b || 0);
      if (a > b) winsA++; else if (b > a) winsB++;
    });
    return winsA > winsB ? "a" : winsB > winsA ? "b" : null;
  }

  async function saveAll() {
    try {
      setSaving(true);
      // 1. Guardar resultado
      const setsFormatted = sets.filter(s => s.a !== "" || s.b !== "").map(s => ({ a: parseInt(s.a)||0, b: parseInt(s.b)||0 }));
      const finalWinner = winner || calcWinner();
      await supabase.from("match_results").upsert({
        match_id: match.id,
        sets: setsFormatted,
        winner_side: finalWinner,
        submitted_by: session.user.id,
      }, { onConflict: "match_id" });

      // 2. Guardar valoraciones
      for (const [userId, r] of Object.entries(ratings)) {
        if (!r.rating) continue;
        await supabase.from("player_ratings").upsert({
          match_id: match.id,
          from_user_id: session.user.id,
          to_user_id: userId,
          rating: r.rating,
          vibe: r.vibe || null,
        }, { onConflict: "match_id,from_user_id,to_user_id" });
      }

      // 3. Guardar mood
      if (mood) {
        await supabase.from("match_moods").upsert({
          match_id: match.id,
          user_id: session.user.id,
          mood,
        }, { onConflict: "match_id,user_id" });
      }

      // 4. Marcar como completado para este usuario
      await supabase.from("match_post_done").upsert({
        match_id: match.id,
        user_id: session.user.id,
      }, { onConflict: "match_id,user_id" });

      setStep(4);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const S = {
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:99999, display:"flex", alignItems:"flex-end", justifyContent:"center" },
    modal: { width:"min(640px,100%)", background:"#111", borderRadius:"24px 24px 0 0", border:"1px solid rgba(116,184,0,0.2)", padding:24, paddingBottom:"max(32px,env(safe-area-inset-bottom))", maxHeight:"90vh", overflowY:"auto" },
    title: { fontSize:20, fontWeight:900, color:"#74B800", marginBottom:4 },
    sub: { fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:20 },
    btn: (c) => ({ padding:"13px", borderRadius:12, border:"none", cursor:"pointer", fontWeight:900, fontSize:14, width:"100%", background: c==="green"?"linear-gradient(135deg,#74B800,#9BE800)":c==="ghost"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)", color: c==="green"?"#000":"#fff" }),
    input: { width:60, padding:"10px 6px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:22, fontWeight:900, textAlign:"center", outline:"none" },
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* STEP 1 — Resultado */}
        {step === 1 && (
          <>
            <div style={S.title}>🏓 ¿Cómo quedó el partido?</div>
            <div style={S.sub}>{match.club_name} · {String(match.start_at||"").slice(11,16)}</div>

            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.4)",marginBottom:8}}>
                <span>PAREJA A</span><span>PAREJA B</span>
              </div>
              {sets.map((s, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:10}}>
                  <input style={S.input} type="number" min="0" max="7" value={s.a}
                    onChange={e=>setSets(prev=>prev.map((x,j)=>j===i?{...x,a:e.target.value}:x))} />
                  <span style={{fontSize:18,color:"rgba(255,255,255,0.3)",fontWeight:900}}>–</span>
                  <input style={S.input} type="number" min="0" max="7" value={s.b}
                    onChange={e=>setSets(prev=>prev.map((x,j)=>j===i?{...x,b:e.target.value}:x))} />
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Set {i+1}</span>
                </div>
              ))}
              {sets.length < 3 && (
                <button onClick={addSet} style={{...S.btn("ghost"), fontSize:12, padding:"8px", marginTop:4}}>+ Añadir set</button>
              )}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <button onClick={()=>setStep(2)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={()=>setStep(2)} style={{...S.btn("ghost"), width:"auto", padding:"13px 16px", fontSize:12, color:"rgba(255,255,255,0.4)"}}>Saltar</button>
            </div>
          </>
        )}

        {/* STEP 2 — Valorar jugadores */}
        {step === 2 && (
          <>
            <div style={S.title}>⭐ Valora a tus compañeros</div>
            <div style={S.sub}>Solo ellos verán tu valoración</div>
            {otherPlayers.length === 0 && <div style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:20}}>No hay jugadores para valorar</div>}
            {otherPlayers.map(p => (
              <div key={p.player_uuid} style={{marginBottom:16,padding:14,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} style={{width:36,height:36,borderRadius:999,objectFit:"cover"}} alt=""/>
                    : <div style={{width:36,height:36,borderRadius:999,background:"rgba(116,184,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🦍</div>
                  }
                  <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{p.name || p.handle || "Jugador"}</div>
                </div>
                {/* Estrellas */}
                <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
                  {[1,2,3,4,5].map(star=>(
                    <span key={star} onClick={()=>setRatings(prev=>({...prev,[p.player_uuid]:{...prev[p.player_uuid],rating:star}}))}
                      style={{fontSize:28,cursor:"pointer",opacity:ratings[p.player_uuid]?.rating>=star?1:0.2,transition:"opacity .15s"}}>⭐</span>
                  ))}
                </div>
                {/* Vibes */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
                  {VIBES.map(v=>{
                    const sel = ratings[p.player_uuid]?.vibe === v.key;
                    return (
                      <button key={v.key} onClick={()=>setRatings(prev=>({...prev,[p.player_uuid]:{...prev[p.player_uuid],vibe:sel?null:v.key}}))}
                        style={{padding:"5px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:800,
                          background:sel?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.06)",
                          color:sel?"#74B800":"rgba(255,255,255,0.5)"}}>
                        {v.icon} {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep(3)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={()=>setStep(1)} style={{...S.btn("ghost"),width:"auto",padding:"13px 16px"}}>← Atrás</button>
            </div>
          </>
        )}

        {/* STEP 3 — Mood + foto */}
        {step === 3 && (
          <>
            <div style={S.title}>🦍 ¿Cómo te fue?</div>
            <div style={S.sub}>Tu Gorila Mood del partido</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24,flexWrap:"wrap"}}>
              {MOODS.map(m=>(
                <button key={m.key} onClick={()=>setMood(m.key)}
                  style={{padding:"14px 12px",borderRadius:14,border:"none",cursor:"pointer",textAlign:"center",minWidth:60,
                    background:mood===m.key?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.05)",
                    border:mood===m.key?"1px solid #74B800":"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{fontSize:28}}>{m.emoji}</div>
                  <div style={{fontSize:10,color:mood===m.key?"#74B800":"rgba(255,255,255,0.4)",fontWeight:800,marginTop:4}}>{m.label}</div>
                </button>
              ))}
            </div>

            {/* Foto a Gorilandia */}
            <div style={{padding:14,borderRadius:12,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",marginBottom:16,textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:6}}>📸</div>
              <div style={{fontSize:13,fontWeight:900,color:"#fff",marginBottom:4}}>¿Foto del partido?</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:10}}>Publícala en Gorilandia con el resultado y etiqueta a tus compañeros</div>
              <button onClick={()=>{ saveAll(); navigate(`/gorilandia?newpost=1&matchId=${match.id}`); }}
                style={{...S.btn("green"),fontSize:12,padding:"10px"}}>📸 Publicar foto en Gorilandia</button>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={saveAll} disabled={saving} style={S.btn("green")}>
                {saving?"Guardando…":"✅ Terminar"}
              </button>
              <button onClick={()=>setStep(2)} style={{...S.btn("ghost"),width:"auto",padding:"13px 16px"}}>← Atrás</button>
            </div>
          </>
        )}

        {/* STEP 4 — Gracias + Compartir */}
        {step === 4 && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:60,marginBottom:12}}>🦍</div>
            <div style={{fontSize:22,fontWeight:900,color:"#74B800",marginBottom:8}}>¡Buen partido!</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:24}}>Tus valoraciones han sido enviadas</div>

            {/* Compartir resultado */}
            <div style={{padding:16,borderRadius:14,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:900,color:"#fff",marginBottom:4}}>📲 Comparte tu resultado</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:12}}>Genera una imagen para Instagram Stories</div>
              <canvas ref={canvasRef} style={{display:"none"}} />
              <button onClick={generarYCompartir} style={{...S.btn("green"),fontSize:13,marginBottom:8}}>
                📸 Generar imagen para compartir
              </button>
            </div>

            <button onClick={onClose} style={S.btn("green")}>Cerrar</button>
          </div>
        )}

      </div>
    </div>
  );
}
