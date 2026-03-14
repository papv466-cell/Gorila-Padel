// src/pages/GorilaStack.jsx — Gorila Inclusivo: El Gran Slam 🦍♿🎾
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const W = 390, H = 620;
const LANES = [80, 195, 310]; // 3 carriles X
const GORILA_Y = H - 100;
const BALL_SPEED_BASE = 3;

export default function GorilaStack() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hs, setHs] = useState(() => { try { return parseInt(localStorage.getItem("gorila_slam_hs")||"0"); } catch { return 0; } });
  const [topScores, setTopScores] = useState([]);
  const [playerName, setPlayerName] = useState("Gorila");
  const [levelUp, setLevelUp] = useState(false);

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
    try { localStorage.setItem("gorila_slam_hs", String(s)); } catch {}
    setHs(s);
  }

  function initState() {
    return {
      lane: 1, // 0=izq, 1=centro, 2=der
      targetLane: 1,
      gorilaX: LANES[1],
      score: 0,
      level: 1,
      frame: 0,
      speed: BALL_SPEED_BASE,
      balls: [],
      obstacles: [],
      particles: [],
      shake: 0,
      nextBall: 40,
      nextObstacle: 120,
      lives: 3,
      combo: 0,
      comboTimer: 0,
      celebrating: 0,
      armAngle: 0,
      wheelAngle: 0,
      hitEffect: null,
      swipeStartX: null,
      levelScore: 0, // puntos en el nivel actual
    };
  }

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stateRef.current = initState();
    setScore(0); setLevel(1); setLevelUp(false);
    setScreen("playing");
  }, []);

  // Swipe / tap handling
  const handlePointerDown = useCallback((e) => {
    if (screen !== "playing") return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    if (stateRef.current) stateRef.current.swipeStartX = x;
  }, [screen]);

  const handlePointerUp = useCallback((e) => {
    const s = stateRef.current;
    if (!s) return;
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = s.swipeStartX !== null ? x - s.swipeStartX : 0;

    if (Math.abs(dx) > 30) {
      // Swipe — cambiar carril
      if (dx > 0 && s.lane < 2) s.targetLane = s.lane + 1;
      if (dx < 0 && s.lane > 0) s.targetLane = s.lane - 1;
    } else {
      // Tap — golpear pelota en el carril actual
      tryHit(s);
    }
    s.swipeStartX = null;
  }, [screen]);

  function tryHit(s) {
    // Buscar pelota en el carril actual que esté cerca del gorila
    const hitZone = 80;
    for (let i = s.balls.length-1; i >= 0; i--) {
      const b = s.balls[i];
      if (b.lane === s.lane && b.y > GORILA_Y - hitZone && b.y < GORILA_Y + 20 && !b.hit) {
        b.hit = true;
        const pts = b.type === "gold" ? 3 : b.type === "inclusive" ? 2 : 1;
        s.score += pts * (s.combo >= 3 ? 2 : 1);
        s.levelScore += pts;
        s.combo++;
        s.comboTimer = 90;
        s.celebrating = 30;
        s.shake = b.type === "gold" ? 10 : 5;
        addParticles(s, LANES[s.lane], GORILA_Y - 20,
          b.type === "gold" ? "#FFD700" : b.type === "inclusive" ? "#74B800" : "#fff", 12);
        s.hitEffect = {
          text: b.type === "gold" ? "⚡ +3!" : b.type === "inclusive" ? "♿ +2!" : `+${pts}${s.combo>=3?" 🔥":""}`,
          color: b.type === "gold" ? "#FFD700" : "#74B800",
          alpha: 1, y: GORILA_Y - 60, x: LANES[s.lane]
        };
        setScore(s.score);
        if (s.score > hs) saveHs(s.score);

        // Level up cada 15 puntos
        if (s.levelScore >= 15) {
          s.level++;
          s.levelScore = 0;
          s.speed = BALL_SPEED_BASE + (s.level-1) * 0.6;
          s.celebrating = 90;
          setLevel(s.level);
          setLevelUp(true);
          setTimeout(() => setLevelUp(false), 1500);
          addParticles(s, W/2, H/2, "#74B800", 30);
        }
        return;
      }
    }
    // Tap en vacío — pequeña penalización visual
    s.hitEffect = { text: "miss", color: "rgba(255,100,100,0.7)", alpha: 1, y: GORILA_Y - 40, x: LANES[s.lane] };
  }

  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function loop() {
      const s = stateRef.current;
      if (!s) return;
      const ctx = canvas.getContext("2d");
      s.frame++;

      // Mover gorila hacia carril target
      const targetX = LANES[s.targetLane];
      s.gorilaX += (targetX - s.gorilaX) * 0.2;
      if (Math.abs(s.gorilaX - targetX) < 2) {
        s.gorilaX = targetX;
        s.lane = s.targetLane;
      }

      // Animar rueda
      s.wheelAngle += 0.1;

      // Combo timer
      if (s.comboTimer > 0) s.comboTimer--;
      else if (s.comboTimer === 0) s.combo = 0;

      // Celebración
      if (s.celebrating > 0) s.celebrating--;

      // Spawn pelotas
      s.nextBall--;
      if (s.nextBall <= 0) {
        const lane = Math.floor(Math.random() * 3);
        const types = ["normal", "normal", "normal", "gold", "inclusive"];
        const type = types[Math.floor(Math.random() * types.length)];
        s.balls.push({ lane, x: LANES[lane], y: -20, type, speed: s.speed + Math.random()*0.5 });
        s.nextBall = Math.max(25, 55 - s.level * 3);
        // A veces 2 pelotas a la vez en niveles altos
        if (s.level >= 3 && Math.random() < 0.3) {
          const lane2 = (lane + 1 + Math.floor(Math.random()*2)) % 3;
          s.balls.push({ lane: lane2, x: LANES[lane2], y: -20, type: "normal", speed: s.speed });
          s.nextBall += 10;
        }
      }

      // Spawn obstáculos
      s.nextObstacle--;
      if (s.nextObstacle <= 0 && s.level >= 2) {
        const lane = Math.floor(Math.random() * 3);
        const types = ["net", "puddle", "player"];
        s.obstacles.push({ lane, x: LANES[lane], y: -30, type: types[Math.floor(Math.random()*types.length)], speed: s.speed * 0.7 });
        s.nextObstacle = Math.max(60, 130 - s.level * 8);
      }

      // Mover pelotas
      for (let i = s.balls.length-1; i >= 0; i--) {
        const b = s.balls[i];
        b.y += b.speed;
        if (b.hit && b.y > H + 50) { s.balls.splice(i, 1); continue; }
        if (b.y > H + 20) {
          if (!b.hit) {
            // Pelota perdida — perder vida si era en el carril del gorila
            if (b.lane === s.lane) {
              s.lives--;
              s.combo = 0;
              s.shake = 15;
              addParticles(s, LANES[b.lane], GORILA_Y, "#ff4444", 8);
              setScore(s.score);
              if (s.lives <= 0) {
                const finalScore = s.score;
                stateRef.current = null;
                setTimeout(() => { saveScore(finalScore); setScore(finalScore); setScreen("dead"); }, 400);
                drawFrame(ctx, s);
                return;
              }
            }
          }
          s.balls.splice(i, 1);
        }
      }

      // Mover obstáculos
      for (let i = s.obstacles.length-1; i >= 0; i--) {
        const o = s.obstacles[i];
        o.y += o.speed;
        // Colisión con gorila
        if (o.lane === s.lane && o.y > GORILA_Y - 40 && o.y < GORILA_Y + 40) {
          s.lives--;
          s.combo = 0;
          s.shake = 20;
          addParticles(s, s.gorilaX, GORILA_Y, "#ff4444", 15);
          s.obstacles.splice(i, 1);
          if (s.lives <= 0) {
            const finalScore = s.score;
            stateRef.current = null;
            setTimeout(() => { saveScore(finalScore); setScore(finalScore); setScreen("dead"); }, 400);
            drawFrame(ctx, s);
            return;
          }
          continue;
        }
        if (o.y > H + 30) s.obstacles.splice(i, 1);
      }

      // Partículas
      for (let i = s.particles.length-1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.15;
        p.life--; p.alpha = p.life/40;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      // Hit effect
      if (s.hitEffect) { s.hitEffect.alpha -= 0.03; s.hitEffect.y -= 1.5; if (s.hitEffect.alpha <= 0) s.hitEffect = null; }
      if (s.shake > 0) s.shake--;

      drawFrame(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [screen]);

  function addParticles(s, x, y, color, n=8) {
    for (let i=0; i<n; i++) {
      s.particles.push({ x, y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8-2, alpha:1, color, r:Math.random()*5+2, life:30+Math.random()*20 });
    }
  }

  function drawFrame(ctx, s) {
    const sx = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.5 : 0;
    const sy = s.shake > 0 ? (Math.random()-0.5)*s.shake*0.3 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Fondo pista pádel
    ctx.fillStyle = "#0a1505";
    ctx.fillRect(0, 0, W, H);

    // Pista verde
    ctx.fillStyle = "#0d2008";
    ctx.fillRect(40, 0, W-80, H);

    // Líneas de carril
    ctx.strokeStyle = "rgba(116,184,0,0.2)";
    ctx.lineWidth = 2;
    ctx.setLineDash([20,15]);
    ctx.lineDashOffset = -(s.frame * 4) % 35;
    ctx.beginPath(); ctx.moveTo(137, 0); ctx.lineTo(137, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(253, 0); ctx.lineTo(253, H); ctx.stroke();
    ctx.setLineDash([]);

    // Línea de red horizontal (decorativa)
    ctx.strokeStyle = "rgba(116,184,0,0.15)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(40, H*0.35); ctx.lineTo(W-40, H*0.35); ctx.stroke();

    // Paredes laterales pista
    ctx.fillStyle = "rgba(116,184,0,0.1)";
    ctx.fillRect(0, 0, 40, H);
    ctx.fillRect(W-40, 0, 40, H);
    ctx.strokeStyle = "rgba(116,184,0,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 0, W-80, H);

    // Obstáculos
    for (const o of s.obstacles) {
      ctx.save();
      ctx.font = "30px serif";
      ctx.textAlign = "center";
      if (o.type === "net") ctx.fillText("🥅", o.x, o.y);
      else if (o.type === "puddle") ctx.fillText("💧", o.x, o.y);
      else ctx.fillText("🧑", o.x, o.y);
      ctx.restore();
    }

    // Pelotas
    for (const b of s.balls) {
      if (b.hit) {
        // Pelota golpeada — vuela hacia arriba
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.font = "20px serif";
        ctx.textAlign = "center";
        ctx.fillText("🎾", b.x, b.y - 10);
        ctx.restore();
        continue;
      }
      ctx.save();
      if (b.type === "gold") {
        ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 15;
        ctx.font = "28px serif"; ctx.textAlign = "center";
        ctx.fillText("⭐", b.x, b.y);
      } else if (b.type === "inclusive") {
        ctx.shadowColor = "#74B800"; ctx.shadowBlur = 12;
        ctx.font = "26px serif"; ctx.textAlign = "center";
        ctx.fillText("♿", b.x, b.y);
      } else {
        ctx.shadowColor = "rgba(255,255,255,0.3)"; ctx.shadowBlur = 8;
        ctx.font = "24px serif"; ctx.textAlign = "center";
        ctx.fillText("🎾", b.x, b.y);
      }
      ctx.restore();
    }

    // GORILA EN SILLA DE RUEDAS
    const gx = s.gorilaX, gy = GORILA_Y;
    const celebrating = s.celebrating > 0;

    ctx.save();
    ctx.translate(gx, gy);

    // Silla de ruedas
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    // Rueda grande
    ctx.beginPath(); ctx.arc(5, 15, 22, 0, Math.PI*2); ctx.stroke();
    // Rueda pequeña delantera
    ctx.beginPath(); ctx.arc(-20, 20, 8, 0, Math.PI*2); ctx.stroke();
    // Asiento
    ctx.fillStyle = "#444";
    ctx.fillRect(-18, -5, 36, 8);
    // Respaldo
    ctx.fillRect(-18, -25, 6, 20);
    // Radio rueda girando
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1.5;
    for (let i=0; i<4; i++) {
      const a = s.wheelAngle + (i * Math.PI/2);
      ctx.beginPath();
      ctx.moveTo(5 + Math.cos(a)*5, 15 + Math.sin(a)*5);
      ctx.lineTo(5 + Math.cos(a)*20, 15 + Math.sin(a)*20);
      ctx.stroke();
    }

    // Cuerpo gorila
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath(); ctx.ellipse(0, -20, 14, 16, 0, 0, Math.PI*2); ctx.fill();
    // Pecho
    ctx.fillStyle = "#4a3020";
    ctx.beginPath(); ctx.ellipse(0, -18, 9, 10, 0, 0, Math.PI*2); ctx.fill();
    // Cabeza
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath(); ctx.ellipse(0, -38, 12, 11, 0, 0, Math.PI*2); ctx.fill();
    // Cara
    ctx.fillStyle = "#8B6040";
    ctx.beginPath(); ctx.ellipse(0, -36, 8, 7, 0, 0, Math.PI*2); ctx.fill();
    // Ojos
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(-4, -39, 2.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -39, 2.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(-4, -39, 1.2, 1.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -39, 1.2, 1.2, 0, 0, Math.PI*2); ctx.fill();

    // Brazos — celebrando o normal
    ctx.strokeStyle = "#2a1a0a"; ctx.lineWidth = 5;
    if (celebrating) {
      // Brazos arriba celebrando
      ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-22, -42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(22, -42); ctx.stroke();
      // Manos
      ctx.fillStyle = "#8B6040";
      ctx.beginPath(); ctx.arc(-22, -43, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -43, 5, 0, Math.PI*2); ctx.fill();
    } else {
      // Brazo con raqueta
      ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(24, -32); ctx.stroke();
      ctx.strokeStyle = "#74B800"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(24, -32); ctx.lineTo(34, -40); ctx.stroke();
      ctx.fillStyle = "rgba(116,184,0,0.3)";
      ctx.beginPath(); ctx.ellipse(37, -43, 7, 5, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#74B800"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(37, -43, 7, 5, -0.4, 0, Math.PI*2); ctx.stroke();
      // Brazo izquierdo
      ctx.strokeStyle = "#2a1a0a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-18, -28); ctx.stroke();
    }
    ctx.restore();

    // Partículas
    for (const p of s.particles) {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Hit effect
    if (s.hitEffect && s.hitEffect.alpha > 0) {
      ctx.save(); ctx.globalAlpha = s.hitEffect.alpha;
      ctx.fillStyle = s.hitEffect.color;
      ctx.font = "bold 24px system-ui"; ctx.textAlign = "center";
      ctx.shadowColor = s.hitEffect.color; ctx.shadowBlur = 10;
      ctx.fillText(s.hitEffect.text, s.hitEffect.x, s.hitEffect.y);
      ctx.restore();
    }

    // HUD
    // Score
    ctx.save();
    ctx.shadowColor = "#74B800"; ctx.shadowBlur = 10;
    ctx.fillStyle = "#fff"; ctx.font = "bold 44px system-ui"; ctx.textAlign = "center";
    ctx.fillText(s.score, W/2, 52);
    ctx.restore();

    // Nivel
    ctx.fillStyle = "rgba(116,184,0,0.9)";
    ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${s.level}`, W/2, 70);

    // Vidas
    ctx.font = "18px serif"; ctx.textAlign = "left";
    for (let i=0; i<3; i++) {
      ctx.globalAlpha = i < s.lives ? 1 : 0.2;
      ctx.fillText("❤️", 12 + i*26, 30);
    }
    ctx.globalAlpha = 1;

    // Combo
    if (s.combo >= 3) {
      ctx.fillStyle = "#F97316";
      ctx.font = `bold ${14+Math.min(s.combo,8)}px system-ui`;
      ctx.textAlign = "right";
      ctx.fillText(`🔥 x${s.combo}`, W-14, 30);
    }

    // Leyenda abajo
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px system-ui"; ctx.textAlign = "center";
    ctx.fillText("← desliza → para moverse · tap para golpear", W/2, H-8);

    ctx.restore();
  }

  const S = {
    wrap: { position:"fixed", inset:0, background:"#0a1505", display:"flex", alignItems:"center", justifyContent:"center", userSelect:"none", touchAction:"none" },
    canvas: { maxWidth:"100%", maxHeight:"100vh", display:"block" },
    btn: { padding:"14px 36px", borderRadius:14, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, fontSize:17, border:"none", cursor:"pointer" },
    ghost: { padding:"10px 24px", borderRadius:14, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, fontSize:13, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" },
  };

  return (
    <div style={S.wrap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
    >
      <canvas ref={canvasRef} width={W} height={H} style={S.canvas} />

      {/* LEVEL UP */}
      {levelUp && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{fontSize:32,fontWeight:900,color:"#74B800",textShadow:"0 0 30px #74B800",animation:"levelup 1.5s ease-out forwards"}}>
            🎉 ¡NIVEL {level}!
          </div>
        </div>
      )}

      {/* HOME */}
      {screen === "home" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.92)",gap:12,padding:24}}>
          <div style={{fontSize:56}}>🦍♿🎾</div>
          <div style={{fontSize:28,fontWeight:900,color:"#74B800",textAlign:"center"}}>El Gran Slam</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",maxWidth:280,lineHeight:1.7}}>
            Desliza para cambiar de carril<br/>
            Toca para golpear la pelota<br/>
            <span style={{color:"#FFD700"}}>⭐ Pelotas doradas = 3 puntos</span><br/>
            <span style={{color:"#74B800"}}>♿ Inclusivo = 2 puntos + combo</span>
          </div>
          {hs > 0 && <div style={{fontSize:15,color:"#74B800",fontWeight:900}}>🏆 Tu récord: {hs}</div>}
          <button style={S.btn} onClick={e=>{e.stopPropagation();startGame();}}>▶ JUGAR</button>
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
          <button style={S.ghost} onClick={e=>{e.stopPropagation();navigate(-1);}}>← Volver</button>
        </div>
      )}

      {/* DEAD */}
      {screen === "dead" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.93)",gap:10,padding:24}}>
          <div style={{fontSize:48}}>💥</div>
          <div style={{fontSize:24,fontWeight:900,color:"#ff4444"}}>¡GAME OVER!</div>
          <div style={{fontSize:48,fontWeight:900,color:"#fff"}}>{score}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>puntos · nivel {level}</div>
          {score >= hs && score > 0 && <div style={{fontSize:15,color:"#74B800",fontWeight:900}}>🏆 ¡Nuevo récord!</div>}
          <button style={S.btn} onClick={e=>{e.stopPropagation();startGame();}}>🔄 REINTENTAR</button>
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
          <button style={S.ghost} onClick={e=>{e.stopPropagation();navigate(-1);}}>← Volver</button>
        </div>
      )}

      <style>{`
        @keyframes levelup { 0%{opacity:0;transform:scale(0.5)} 20%{opacity:1;transform:scale(1.2)} 80%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1)} }
      `}</style>
    </div>
  );
}
