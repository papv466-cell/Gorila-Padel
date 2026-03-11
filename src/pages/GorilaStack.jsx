// src/pages/GorilaStack.jsx — Gorila Timing 🦍🎾
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const W = 390, H = 620;
const BAR_Y = H - 120;
const ZONE_CENTER = W / 2;

export default function GorilaStack() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [hs, setHs] = useState(() => { try { return parseInt(localStorage.getItem("gorila_timing_hs")||"0"); } catch { return 0; } });
  const [topScores, setTopScores] = useState([]);
  const [playerName, setPlayerName] = useState("Gorila");
  const [lastHit, setLastHit] = useState(null); // "PERFECTO" | "BIEN" | "FALLO"

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
        .select("name,score").order("score",{ascending:false}).limit(10);
      setTopScores(data||[]);
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
    try { localStorage.setItem("gorila_timing_hs", String(s)); } catch {}
    setHs(s);
  }

  function initState() {
    return {
      // Barra oscilante
      bar: { x: W/2, vx: 4, direction: 1 },
      // Zona verde (zona perfecta)
      zone: { x: W/2, width: 120 },
      // Zona ok (zona bien)
      okZone: { width: 200 },
      score: 0,
      combo: 0,
      lives: 3,
      frame: 0,
      speed: 4,
      level: 1,
      particles: [],
      shake: 0,
      hitEffect: null, // { text, color, alpha, y }
      ballY: 80,
      ballVisible: true,
      pulse: 0,
      bg: 0, // color de fondo oscila
      lastHitTime: 0,
      waiting: false, // esperando tap
      tapReady: true,
    };
  }

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const s = initState();
    stateRef.current = s;
    setScore(0); setCombo(0); setLives(3); setLastHit(null);
    setScreen("playing");
  }, []);

  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function loop() {
      const s = stateRef.current;
      if (!s) return;
      const ctx = canvas.getContext("2d");
      s.frame++;
      s.pulse = (s.pulse + 0.05) % (Math.PI * 2);
      s.bg = (s.bg + 0.5) % 360;

      // Velocidad aumenta con score
      s.speed = 4 + s.score * 0.15;
      if (s.speed > 18) s.speed = 18;

      // Zona verde se hace más pequeña
      const minZone = 40;
      s.zone.width = Math.max(minZone, 120 - s.score * 1.5);
      s.okZone.width = s.zone.width * 1.8;

      // Mover barra
      s.bar.x += s.bar.vx * s.speed / 4;
      if (s.bar.x >= W - 20) { s.bar.x = W - 20; s.bar.vx = -Math.abs(s.bar.vx); }
      if (s.bar.x <= 20) { s.bar.x = 20; s.bar.vx = Math.abs(s.bar.vx); }

      // Pelota animación
      s.ballY = 80 + Math.sin(s.pulse * 2) * 8;

      // Hit effect fade
      if (s.hitEffect) {
        s.hitEffect.alpha -= 0.025;
        s.hitEffect.y -= 1.5;
        if (s.hitEffect.alpha <= 0) s.hitEffect = null;
      }

      // Partículas
      for (let i = s.particles.length-1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.15;
        p.life--; p.alpha = p.life / 40;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      if (s.shake > 0) s.shake--;

      drawFrame(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [screen]);

  function addParticles(s, x, y, color, n=12) {
    for (let i=0; i<n; i++) {
      s.particles.push({
        x, y, vx:(Math.random()-0.5)*10, vy:(Math.random()-0.5)*10-3,
        alpha:1, color, r:Math.random()*5+2, life:35+Math.random()*20
      });
    }
  }

  function handleTap() {
    if (screen === "home") { startGame(); return; }
    if (screen === "dead") { startGame(); return; }
    if (screen !== "playing") return;

    const s = stateRef.current;
    if (!s || !s.tapReady) return;
    s.tapReady = false;
    setTimeout(() => { if (stateRef.current) stateRef.current.tapReady = true; }, 150);

    const barX = s.bar.x;
    const zoneLeft = ZONE_CENTER - s.zone.width/2;
    const zoneRight = ZONE_CENTER + s.zone.width/2;
    const okLeft = ZONE_CENTER - s.okZone.width/2;
    const okRight = ZONE_CENTER + s.okZone.width/2;

    const isPerfect = barX >= zoneLeft && barX <= zoneRight;
    const isOk = barX >= okLeft && barX <= okRight;

    if (isPerfect) {
      // PERFECTO
      s.score++;
      s.combo++;
      s.shake = 8;
      s.hitEffect = { text: s.combo >= 5 ? `x${s.combo} 🔥 PERFECTO!` : "✨ PERFECTO!", color: "#FFD700", alpha: 1, y: BAR_Y - 60 };
      addParticles(s, ZONE_CENTER, BAR_Y - 20, "#FFD700", 18);
      addParticles(s, barX, BAR_Y - 20, "#74B800", 10);
      setScore(s.score); setCombo(s.combo);
      setLastHit("PERFECTO");
      if (s.score > hs) saveHs(s.score);
      // Invertir dirección para más dinamismo
      if (s.combo % 3 === 0) s.bar.vx *= -1.1;
    } else if (isOk) {
      // BIEN
      s.score++;
      s.combo = Math.max(0, s.combo - 1);
      s.hitEffect = { text: "👍 BIEN", color: "#74B800", alpha: 1, y: BAR_Y - 60 };
      addParticles(s, barX, BAR_Y - 20, "#74B800", 6);
      setScore(s.score); setCombo(s.combo);
      setLastHit("BIEN");
      if (s.score > hs) saveHs(s.score);
    } else {
      // FALLO
      s.combo = 0;
      s.lives--;
      s.shake = 20;
      s.hitEffect = { text: "💥 FALLO", color: "#ff4444", alpha: 1, y: BAR_Y - 60 };
      addParticles(s, barX, BAR_Y - 20, "#ff4444", 15);
      setCombo(0); setLives(s.lives);
      setLastHit("FALLO");

      if (s.lives <= 0) {
        const finalScore = s.score;
        stateRef.current = null;
        setTimeout(() => {
          saveScore(finalScore);
          setScore(finalScore);
          setScreen("dead");
        }, 500);
      }
    }
  }

  function drawFrame(ctx, s) {
    const sx = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.5 : 0;
    const sy = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.3 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Fondo dinámico
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#050510");
    bg.addColorStop(1, "#0a150a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Líneas de fondo animadas
    ctx.strokeStyle = "rgba(116,184,0,0.04)";
    ctx.lineWidth = 1;
    for (let i=0; i<8; i++) {
      const x = (i * W/7 + s.frame * 0.3) % W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // PELOTA animada arriba
    const ballGlow = 0.5 + Math.sin(s.pulse) * 0.3;
    ctx.save();
    ctx.shadowColor = "#74B800";
    ctx.shadowBlur = 20 * ballGlow;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(W/2, s.ballY, 18, 0, Math.PI*2); ctx.fill();
    // Costuras
    ctx.strokeStyle = "rgba(116,184,0,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W/2, s.ballY, 12, 0.3, Math.PI-0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, s.ballY, 12, Math.PI+0.3, -0.3); ctx.stroke();
    ctx.restore();

    // Flecha indicadora
    ctx.fillStyle = `rgba(116,184,0,${0.3 + Math.sin(s.pulse*3)*0.2})`;
    ctx.beginPath();
    ctx.moveTo(W/2, s.ballY + 30);
    ctx.lineTo(W/2 - 10, s.ballY + 45);
    ctx.lineTo(W/2 + 10, s.ballY + 45);
    ctx.closePath(); ctx.fill();

    // ZONA OK (azul/verde claro)
    const okLeft = ZONE_CENTER - s.okZone.width/2;
    ctx.fillStyle = "rgba(116,184,0,0.08)";
    ctx.beginPath(); ctx.roundRect(okLeft, BAR_Y - 40, s.okZone.width, 80, 12); ctx.fill();
    ctx.strokeStyle = "rgba(116,184,0,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(okLeft, BAR_Y - 40, s.okZone.width, 80, 12); ctx.stroke();

    // ZONA PERFECTA (verde brillante)
    const zoneLeft = ZONE_CENTER - s.zone.width/2;
    const zoneGlow = 0.4 + Math.sin(s.pulse * 2) * 0.2;
    ctx.save();
    ctx.shadowColor = "#74B800";
    ctx.shadowBlur = 15;
    ctx.fillStyle = `rgba(116,184,0,${zoneGlow})`;
    ctx.beginPath(); ctx.roundRect(zoneLeft, BAR_Y - 40, s.zone.width, 80, 10); ctx.fill();
    ctx.strokeStyle = "#74B800";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(zoneLeft, BAR_Y - 40, s.zone.width, 80, 10); ctx.stroke();
    ctx.restore();

    // Label PERFECTO en zona
    ctx.fillStyle = "rgba(116,184,0,0.9)";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PERFECTO", ZONE_CENTER, BAR_Y - 48);

    // BARRA (raqueta)
    const barGrad = ctx.createLinearGradient(s.bar.x - 8, 0, s.bar.x + 8, 0);
    barGrad.addColorStop(0, "rgba(116,184,0,0)");
    barGrad.addColorStop(0.5, "#9BE800");
    barGrad.addColorStop(1, "rgba(116,184,0,0)");
    ctx.save();
    ctx.shadowColor = "#74B800";
    ctx.shadowBlur = 20;
    ctx.fillStyle = barGrad;
    ctx.beginPath(); ctx.roundRect(s.bar.x - 8, BAR_Y - 50, 16, 100, 8); ctx.fill();
    // Borde brillante
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(s.bar.x - 8, BAR_Y - 50, 16, 100, 8); ctx.stroke();
    ctx.restore();

    // Gorila encima de la barra
    const gx = s.bar.x, gy = BAR_Y - 75;
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

    // HIT EFFECT
    if (s.hitEffect && s.hitEffect.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = s.hitEffect.alpha;
      ctx.fillStyle = s.hitEffect.color;
      ctx.font = "bold 26px system-ui";
      ctx.textAlign = "center";
      ctx.shadowColor = s.hitEffect.color;
      ctx.shadowBlur = 15;
      ctx.fillText(s.hitEffect.text, W/2, s.hitEffect.y);
      ctx.restore();
    }

    // HUD — Score
    ctx.save();
    ctx.shadowColor = "#74B800"; ctx.shadowBlur = 15;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(s.score, W/2, 55);
    ctx.restore();

    // Combo
    if (s.combo >= 2) {
      ctx.fillStyle = "#F97316";
      ctx.font = `bold ${14 + Math.min(s.combo, 10)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(`🔥 x${s.combo} COMBO`, W/2, 80);
    }

    // Vidas
    ctx.font = "20px system-ui";
    ctx.textAlign = "left";
    for (let i=0; i<3; i++) {
      ctx.globalAlpha = i < s.lives ? 1 : 0.2;
      ctx.fillText("❤️", 14 + i*28, 30);
    }
    ctx.globalAlpha = 1;

    // Velocidad
    const speedPct = (s.speed - 4) / 14;
    if (speedPct > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath(); ctx.roundRect(W-90, 14, 76, 8, 4); ctx.fill();
      ctx.fillStyle = `hsl(${90-speedPct*90},100%,50%)`;
      ctx.beginPath(); ctx.roundRect(W-90, 14, 76*speedPct, 8, 4); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px system-ui"; ctx.textAlign = "right";
      ctx.fillText("VELOCIDAD", W-14, 32);
    }

    // Instrucción al inicio
    if (s.score === 0 && s.frame < 120) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (120-s.frame)/30);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("¡TAP cuando la barra esté en verde!", W/2, H/2 + 20);
      ctx.restore();
    }

    ctx.restore();
  }

  const S = {
    wrap: { position:"fixed", inset:0, background:"#050510", display:"flex", alignItems:"center", justifyContent:"center", userSelect:"none", touchAction:"manipulation" },
    canvas: { borderRadius:0, maxWidth:"100%", maxHeight:"100vh", cursor:"pointer", display:"block" },
    btn: { padding:"14px 36px", borderRadius:14, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, fontSize:17, border:"none", cursor:"pointer" },
    ghost: { padding:"10px 24px", borderRadius:14, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, fontSize:13, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" },
  };

  return (
    <div style={S.wrap} onClick={handleTap} onTouchEnd={e=>{e.preventDefault();handleTap();}}>
      <canvas ref={canvasRef} width={W} height={H} style={S.canvas} />

      {/* HOME */}
      {screen === "home" && (
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",gap:12,padding:24}}>
          <div style={{fontSize:60}}>🦍🎾</div>
          <div style={{fontSize:30,fontWeight:900,color:"#74B800"}}>Gorila Timing</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",maxWidth:280,lineHeight:1.6}}>
            Toca cuando la barra esté en la zona verde.<br/>
            <span style={{color:"#FFD700"}}>Zona brillante = PERFECTO ✨</span><br/>
            Tienes 3 vidas. ¡Llega lo más lejos posible!
          </div>
          {hs > 0 && <div style={{fontSize:15,color:"#74B800",fontWeight:900}}>🏆 Tu récord: {hs}</div>}
          <button style={S.btn} onClick={startGame}>▶ JUGAR</button>
          {topScores.length > 0 && (
            <div style={{width:"100%",maxWidth:300,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"12px 16px"}}>
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

      {/* DEAD */}
      {screen === "dead" && (
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.93)",gap:10,padding:24}}>
          <div style={{fontSize:48}}>💥</div>
          <div style={{fontSize:24,fontWeight:900,color:"#ff4444"}}>¡GAME OVER!</div>
          <div style={{fontSize:48,fontWeight:900,color:"#fff"}}>{score}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>golpes perfectos</div>
          {score >= hs && score > 0 && <div style={{fontSize:15,color:"#74B800",fontWeight:900}}>🏆 ¡Nuevo récord!</div>}
          <button style={S.btn} onClick={startGame}>🔄 REINTENTAR</button>
          {topScores.length > 0 && (
            <div style={{width:"100%",maxWidth:280,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"10px 14px"}}>
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
