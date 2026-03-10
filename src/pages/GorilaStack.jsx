// src/pages/GorilaStack.jsx — Gorila Pong 🦍🎾
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const W = 390, H = 580;
const PADDLE_W = 14, PADDLE_H = 80;
const BALL_R = 10;
const PLAYER_X = 30;
const WALL_X = W - 20;

export default function GorilaStack() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [score, setScore] = useState(0);
  const [hs, setHs] = useState(() => { try { return parseInt(localStorage.getItem("gorila_pong_hs")||"0"); } catch { return 0; } });
  const [topScores, setTopScores] = useState([]);
  const [playerName, setPlayerName] = useState("Gorila");

  useEffect(() => {
    loadRanking();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) {
        supabase.from("profiles").select("name,handle").eq("id", data.session.user.id).single()
          .then(({ data: p }) => { if (p) setPlayerName(p.name || p.handle || "Gorila"); });
      }
    });
  }, []);

  async function loadRanking() {
    try {
      const { data } = await supabase.from("gorila_runner_scores")
        .select("name,score").order("score", { ascending: false }).limit(10);
      setTopScores(data || []);
    } catch {}
  }

  async function saveScore(s) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.user?.id) {
        await supabase.from("gorila_runner_scores").upsert(
          { user_id: sess.session.user.id, name: playerName, score: s },
          { onConflict: "user_id" }
        );
        loadRanking();
      }
    } catch {}
  }

  function saveHs(s) {
    try { localStorage.setItem("gorila_pong_hs", String(s)); } catch {}
    setHs(s);
  }

  function initState() {
    return {
      paddle: { y: H/2 - PADDLE_H/2, vy: 0, targetY: H/2 - PADDLE_H/2 },
      ball: { x: PLAYER_X + PADDLE_W + 20, y: H/2, vx: 5, vy: (Math.random()-0.5)*4 },
      score: 0,
      hits: 0,
      particles: [],
      shake: 0,
      frame: 0,
      speed: 1,
      trail: [],
      smashEffect: 0,
      lastHitY: 0,
      wallBounces: 0,
    };
  }

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stateRef.current = initState();
    setScore(0);
    setScreen("playing");
  }, []);

  // Touch/mouse control
  const handlePointerMove = useCallback((e) => {
    if (screen !== "playing" || !stateRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const y = (clientY - rect.top) * (H / rect.height);
    stateRef.current.paddle.targetY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H/2));
  }, [screen]);

  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function loop() {
      const s = stateRef.current;
      if (!s) return;
      const ctx = canvas.getContext("2d");
      s.frame++;

      // Paddle sigue el dedo suavemente
      s.paddle.y += (s.paddle.targetY - s.paddle.y) * 0.25;

      // Velocidad aumenta con hits
      s.speed = 1 + s.hits * 0.08;
      if (s.speed > 3.5) s.speed = 3.5;

      // Mover pelota
      s.ball.x += s.ball.vx * s.speed;
      s.ball.y += s.ball.vy * s.speed;

      // Trail
      s.trail.push({ x: s.ball.x, y: s.ball.y, alpha: 1 });
      if (s.trail.length > 12) s.trail.shift();
      for (const t of s.trail) t.alpha -= 0.08;

      // Rebote techo/suelo
      if (s.ball.y - BALL_R < 0) { s.ball.y = BALL_R; s.ball.vy = Math.abs(s.ball.vy); addParticles(s, s.ball.x, 0, "#74B800", 4); }
      if (s.ball.y + BALL_R > H) { s.ball.y = H - BALL_R; s.ball.vy = -Math.abs(s.ball.vy); addParticles(s, s.ball.x, H, "#74B800", 4); }

      // Rebote pared derecha
      if (s.ball.x + BALL_R >= WALL_X) {
        s.ball.x = WALL_X - BALL_R;
        s.ball.vx = -Math.abs(s.ball.vx);
        s.wallBounces++;
        s.shake = 6;
        addParticles(s, WALL_X, s.ball.y, "#9BE800", 8);
      }

      // Colisión con pala
      const px = PLAYER_X, py = s.paddle.y;
      if (
        s.ball.x - BALL_R < px + PADDLE_W &&
        s.ball.x + BALL_R > px &&
        s.ball.y + BALL_R > py &&
        s.ball.y - BALL_R < py + PADDLE_H &&
        s.ball.vx < 0
      ) {
        s.hits++;
        s.score = s.hits;
        setScore(s.hits);
        if (s.hits > hs) { saveHs(s.hits); }

        // Ángulo según dónde golpea en la pala
        const hitPos = (s.ball.y - py) / PADDLE_H; // 0=top 1=bottom
        const angle = (hitPos - 0.5) * 2.2; // -1.1 a 1.1 rad
        const baseSpeed = 5 + s.hits * 0.3;
        s.ball.vx = Math.abs(baseSpeed * Math.cos(angle * 0.6));
        s.ball.vy = baseSpeed * Math.sin(angle * 0.6);
        s.ball.x = px + PADDLE_W + BALL_R + 2;

        // Smash si golpea en el centro
        const isSmash = hitPos > 0.3 && hitPos < 0.7;
        if (isSmash) {
          s.smashEffect = 30;
          addParticles(s, s.ball.x, s.ball.y, "#FFD700", 15);
        } else {
          addParticles(s, s.ball.x, s.ball.y, "#74B800", 8);
        }
        s.shake = isSmash ? 12 : 6;
        s.lastHitY = s.ball.y;
      }

      // FALLO — pelota sale por la izquierda
      if (s.ball.x + BALL_R < 0) {
        addParticles(s, 0, s.ball.y, "#ff4444", 20);
        s.shake = 25;
        const finalScore = s.score;
        stateRef.current = null;
        setTimeout(() => {
          saveScore(finalScore);
          setScore(finalScore);
          setScreen("dead");
        }, 600);
        drawFrame(ctx, s);
        return;
      }

      // Partículas
      for (let i = s.particles.length-1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12;
        p.life--; p.alpha = p.life / 40;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      if (s.shake > 0) s.shake--;
      if (s.smashEffect > 0) s.smashEffect--;

      drawFrame(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [screen]);

  function addParticles(s, x, y, color, n=8) {
    for (let i=0; i<n; i++) {
      s.particles.push({ x, y, vx:(Math.random()-0.5)*7, vy:(Math.random()-0.5)*7-1, alpha:1, color, r:Math.random()*4+2, life:30+Math.random()*20 });
    }
  }

  function drawFrame(ctx, s) {
    const sx = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.6 : 0;
    const sy = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.3 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Fondo
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, W, H);

    // Grid de pista (perspectiva)
    ctx.strokeStyle = "rgba(116,184,0,0.06)";
    ctx.lineWidth = 1;
    for (let x=0; x<W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Línea central
    ctx.setLineDash([10,8]);
    ctx.strokeStyle = "rgba(116,184,0,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.setLineDash([]);

    // Pared derecha
    const wallGlow = s.wallBounces > 0 ? Math.min(s.wallBounces * 10, 80) : 20;
    ctx.fillStyle = `rgba(116,184,0,0.${Math.floor(wallGlow/10)})`;
    ctx.fillRect(WALL_X, 0, W - WALL_X, H);
    ctx.fillStyle = "#74B800";
    ctx.fillRect(WALL_X, 0, 4, H);

    // Trail de la pelota
    for (let i=0; i<s.trail.length; i++) {
      const t = s.trail[i];
      const r = BALL_R * (i/s.trail.length) * 0.8;
      ctx.save();
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = s.smashEffect > 0 ? "#FFD700" : "#74B800";
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Pelota
    const ballColor = s.smashEffect > 0 ? "#FFD700" : "#fff";
    ctx.save();
    if (s.smashEffect > 0) {
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = ballColor;
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI*2); ctx.fill();
    // Costuras
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R*0.6, 0.3, Math.PI-0.3); ctx.stroke();
    ctx.restore();

    // PALA — Gorila con raqueta
    const px = PLAYER_X, py = s.paddle.y;
    // Mango raqueta
    ctx.fillStyle = "#8B4513";
    ctx.beginPath(); ctx.roundRect(px-2, py + PADDLE_H*0.3, 6, PADDLE_H*0.5, 3); ctx.fill();
    // Marco raqueta
    ctx.strokeStyle = "#74B800";
    ctx.lineWidth = 4;
    ctx.fillStyle = "rgba(116,184,0,0.15)";
    ctx.beginPath(); ctx.roundRect(px, py, PADDLE_W, PADDLE_H, 6); ctx.fill(); ctx.stroke();
    // Cuerdas horizontales
    ctx.strokeStyle = "rgba(116,184,0,0.5)";
    ctx.lineWidth = 1;
    for (let i=1; i<5; i++) {
      const cy = py + (PADDLE_H/5)*i;
      ctx.beginPath(); ctx.moveTo(px+2, cy); ctx.lineTo(px+PADDLE_W-2, cy); ctx.stroke();
    }
    // Cuerdas verticales
    ctx.beginPath(); ctx.moveTo(px+PADDLE_W/2, py+2); ctx.lineTo(px+PADDLE_W/2, py+PADDLE_H-2); ctx.stroke();

    // Gorila pequeño encima de la pala
    const gx = px + PADDLE_W/2, gy = py - 28;
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath(); ctx.ellipse(gx, gy, 14, 16, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#8B6040";
    ctx.beginPath(); ctx.ellipse(gx, gy+2, 9, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(gx-4, gy-4, 3, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx+4, gy-4, 3, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(gx-4, gy-4, 1.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx+4, gy-4, 1.5, 1.5, 0, 0, Math.PI*2); ctx.fill();

    // Partículas
    for (const p of s.particles) {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // HUD
    // Score grande
    ctx.save();
    ctx.shadowColor = "#74B800"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#74B800";
    ctx.font = "bold 48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(s.score, W/2, 60);
    ctx.restore();

    // Velocidad
    const speedPct = (s.speed - 1) / 2.5;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath(); ctx.roundRect(W-100, 10, 88, 20, 6); ctx.fill();
    ctx.fillStyle = `hsl(${90-speedPct*90},100%,50%)`;
    ctx.beginPath(); ctx.roundRect(W-100, 10, 88*speedPct, 20, 6); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 9px system-ui"; ctx.textAlign = "center";
    ctx.fillText("VELOCIDAD", W-56, 24);

    // Hits info
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "11px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`${s.hits} golpes`, 10, 25);

    // SMASH
    if (s.smashEffect > 0) {
      ctx.save();
      ctx.globalAlpha = s.smashEffect / 30;
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("⚡ SMASH!", W/2, H/2);
      ctx.restore();
    }

    ctx.restore();
  }

  const S = {
    wrap: { position:"fixed", inset:0, background:"#050510", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", userSelect:"none" },
    canvas: { borderRadius:16, border:"1px solid rgba(116,184,0,0.2)", maxWidth:"100%", maxHeight:"100vh", touchAction:"none", cursor:"none" },
    btn: { padding:"14px 32px", borderRadius:14, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, fontSize:16, border:"none", cursor:"pointer" },
    ghost: { padding:"10px 24px", borderRadius:14, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, fontSize:13, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" },
  };

  return (
    <div style={S.wrap}>
      <canvas
        ref={canvasRef} width={W} height={H} style={S.canvas}
        onMouseMove={handlePointerMove}
        onTouchMove={e=>{e.preventDefault();handlePointerMove(e);}}
        onTouchStart={e=>{e.preventDefault();handlePointerMove(e); if(screen==="home")startGame(); if(screen==="dead")startGame();}}
        onClick={()=>{ if(screen==="home")startGame(); if(screen==="dead")startGame(); }}
      />

      {/* HOME */}
      {screen === "home" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.88)",gap:10,padding:20}}>
          <div style={{fontSize:56}}>🦍🎾</div>
          <div style={{fontSize:28,fontWeight:900,color:"#74B800"}}>Gorila Pong</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",maxWidth:280}}>Mueve la raqueta con el dedo. Devuelve la pelota. 1 fallo = fin.</div>
          {hs > 0 && <div style={{fontSize:14,color:"#74B800",fontWeight:900}}>🏆 Tu récord: {hs} golpes</div>}
          <button style={S.btn} onClick={startGame}>▶ JUGAR</button>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Golpea en el centro = ⚡ SMASH</div>
          {topScores.length > 0 && (
            <div style={{marginTop:8,width:"100%",maxWidth:300,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:900,color:"#74B800",marginBottom:8,textAlign:"center"}}>🏆 TOP 10 GLOBAL</div>
              {topScores.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12}}>
                  <span style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.6)"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {s.name}</span>
                  <span style={{fontWeight:900,color:"#74B800"}}>{s.score}</span>
                </div>
              ))}
            </div>
          )}
          <button style={S.ghost} onClick={()=>navigate(-1)}>← Volver</button>
        </div>
      )}

      {/* GAME OVER */}
      {screen === "dead" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.92)",gap:8,padding:20}}>
          <div style={{fontSize:48}}>💥</div>
          <div style={{fontSize:24,fontWeight:900,color:"#ff4444"}}>¡FALLASTE!</div>
          <div style={{fontSize:44,fontWeight:900,color:"#fff"}}>{score}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>golpes</div>
          {score > 0 && score >= hs && <div style={{fontSize:14,color:"#74B800",fontWeight:900}}>🏆 ¡Nuevo récord!</div>}
          <button style={S.btn} onClick={startGame}>🔄 REINTENTAR</button>
          {topScores.length > 0 && (
            <div style={{marginTop:8,width:"100%",maxWidth:280,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:900,color:"#74B800",marginBottom:6,textAlign:"center"}}>🏆 TOP 10</div>
              {topScores.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:11}}>
                  <span style={{color:"rgba(255,255,255,0.6)"}}>{i+1}. {s.name}</span>
                  <span style={{fontWeight:900,color:"#74B800"}}>{s.score}</span>
                </div>
              ))}
            </div>
          )}
          <button style={S.ghost} onClick={()=>navigate(-1)}>← Volver</button>
        </div>
      )}
    </div>
  );
}
