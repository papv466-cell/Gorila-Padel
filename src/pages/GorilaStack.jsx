// src/pages/GorilaStack.jsx — Gorila Runner 🦍
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const W = 390, H = 520;
const GROUND = H - 80;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const INITIAL_SPEED = 4;

function getHighScore() { try { return parseInt(localStorage.getItem("gorila_runner_hs")||"0"); } catch { return 0; } }
function setHighScore(s) { try { localStorage.setItem("gorila_runner_hs", String(s)); } catch {} }

export default function GorilaStack() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [screen, setScreen] = useState("home"); // home | playing | dead
  const [score, setScore] = useState(0);
  const [hs, setHs] = useState(getHighScore);
  const [topScores, setTopScores] = useState([]);
  const [playerName, setPlayerName] = useState("");

  // Cargar ranking global
  async function loadRanking() {
    try {
      const { data } = await supabase.from("gorila_runner_scores")
        .select("name, score").order("score", { ascending: false }).limit(10);
      setTopScores(data || []);
    } catch {}
  }

  useEffect(() => {
    loadRanking();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) {
        supabase.from("profiles").select("name,handle").eq("id", data.session.user.id).single()
          .then(({ data: p }) => { if (p) setPlayerName(p.name || p.handle || "Gorila"); });
      }
    });
  }, []);

  async function saveScore(s) {
    const name = playerName || "Gorila";
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user?.id) {
        await supabase.from("gorila_runner_scores").upsert({
          user_id: session.session.user.id, name, score: s
        }, { onConflict: "user_id" });
        loadRanking();
      }
    } catch {}
  }

  function initState() {
    return {
      gorila: { x: 80, y: GROUND, vy: 0, onGround: true, jumping: false, frame: 0, frameTimer: 0 },
      obstacles: [],
      clouds: [
        { x: 100, y: 60, w: 80, speed: 0.3 },
        { x: 280, y: 40, w: 60, speed: 0.2 },
        { x: 350, y: 80, w: 50, speed: 0.25 },
      ],
      score: 0,
      speed: INITIAL_SPEED,
      frame: 0,
      nextObstacle: 90,
      combo: 0,
      comboTimer: 0,
      particles: [],
      shake: 0,
      distance: 0,
      level: 1,
    };
  }

  function startGame() {
    setScreen("playing");
    setScore(0);
    stateRef.current = initState();
    requestAnimationFrame(loop);
  }

  function jump() {
    const s = stateRef.current;
    if (!s) return;
    if (s.gorila.onGround) {
      s.gorila.vy = JUMP_FORCE;
      s.gorila.onGround = false;
      s.gorila.jumping = true;
    } else if (!s.doubleJumped) {
      // Doble salto
      s.gorila.vy = JUMP_FORCE * 0.8;
      s.doubleJumped = true;
      addParticles(s, s.gorila.x + 20, s.gorila.y + 20, "#74B800", 6);
    }
  }

  function addParticles(s, x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      s.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        alpha: 1, color, r: Math.random() * 4 + 2,
        life: 30 + Math.random() * 20,
      });
    }
  }

  function spawnObstacle(s) {
    const types = ["net", "ball", "player", "net_tall"];
    // Más variedad según nivel
    const available = s.level >= 3 ? types : types.slice(0, 3);
    const type = available[Math.floor(Math.random() * available.length)];
    const configs = {
      net:      { w: 18, h: 40, color: "#74B800", emoji: "🥅" },
      net_tall: { w: 18, h: 65, color: "#9BE800", emoji: "🥅" },
      ball:     { w: 24, h: 24, color: "#fff", emoji: "🎾", rolling: true },
      player:   { w: 32, h: 55, color: "#f97316", emoji: "🧑" },
    };
    const cfg = configs[type];
    s.obstacles.push({
      x: W + 20, y: GROUND - cfg.h + (cfg.rolling ? cfg.h/2 : 0),
      w: cfg.w, h: cfg.h, type, ...cfg,
      angle: 0,
    });
  }

  function loop() {
    const s = stateRef.current;
    if (!s) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    s.frame++;
    s.distance += s.speed;

    // Aumentar velocidad y nivel
    s.speed = INITIAL_SPEED + Math.floor(s.score / 10) * 0.4;
    s.level = 1 + Math.floor(s.score / 20);
    if (s.speed > 14) s.speed = 14;

    // Gorila física
    const g = s.gorila;
    g.vy += GRAVITY;
    g.y += g.vy;
    if (g.y >= GROUND) {
      g.y = GROUND; g.vy = 0; g.onGround = true; g.jumping = false;
      s.doubleJumped = false;
    }
    g.frameTimer++;
    if (g.frameTimer > 6) { g.frame = (g.frame + 1) % 4; g.frameTimer = 0; }

    // Nubes
    for (const c of s.clouds) { c.x -= c.speed; if (c.x + c.w < 0) c.x = W + 50; }

    // Obstáculos
    s.nextObstacle--;
    if (s.nextObstacle <= 0) {
      spawnObstacle(s);
      const gap = Math.max(45, 90 - s.level * 5);
      s.nextObstacle = gap + Math.random() * 40;
    }

    let passed = false;
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const o = s.obstacles[i];
      o.x -= s.speed;
      if (o.rolling) o.angle += s.speed * 0.1;

      // Pasó el gorila → punto
      if (!o.scored && o.x + o.w < g.x) {
        o.scored = true;
        s.score++;
        s.combo++;
        s.comboTimer = 60;
        passed = true;
        addParticles(s, g.x + 20, g.y - 10, "#74B800", 5);
        setScore(s.score);
        if (s.score > getHighScore()) { setHighScore(s.score); setHs(s.score); }
      }

      // Colisión AABB (con margen de gracia)
      const margin = 8;
      if (
        g.x + 35 - margin > o.x + margin &&
        g.x + margin < o.x + o.w - margin &&
        g.y + 10 > o.y - o.h + margin &&
        g.y + 50 < o.y + margin + (o.rolling ? o.h : 0) + margin
      ) {
        // MUERTO
        s.shake = 20;
        addParticles(s, g.x + 20, g.y + 20, "#ff4444", 20);
        stateRef.current = null;
        // Dar tiempo al shake antes de mostrar game over
        setTimeout(() => {
          saveScore(s.score);
          setScore(s.score);
          setScreen("dead");
        }, 400);
        rafRef.current = requestAnimationFrame(() => drawFrame(ctx, s));
        return;
      }

      if (o.x + o.w < -20) s.obstacles.splice(i, 1);
    }

    // Combo timer
    if (s.comboTimer > 0) s.comboTimer--;
    else s.combo = 0;

    // Partículas
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15;
      p.life--; p.alpha = p.life / 50;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Shake
    if (s.shake > 0) s.shake--;

    drawFrame(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function drawFrame(ctx, s) {
    const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 0.8 : 0;
    const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 0.4 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Fondo degradado cielo
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a0a1a");
    sky.addColorStop(1, "#0d1a0d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Estrellas (fondo)
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + s.frame * 0.2) % W);
      const sy = (i * 53) % (GROUND - 20);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Nubes
    for (const c of s.clouds) {
      ctx.fillStyle = "rgba(116,184,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w/2, 15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + 20, c.y - 8, c.w/3, 12, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Suelo
    ctx.fillStyle = "#1a2a0a";
    ctx.fillRect(0, GROUND + 50, W, H - GROUND - 50);
    ctx.fillStyle = "#74B800";
    ctx.fillRect(0, GROUND + 48, W, 4);

    // Línea de fondo deslizante (pista pádel)
    ctx.strokeStyle = "rgba(116,184,0,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([30, 20]);
    ctx.lineDashOffset = -(s.distance % 50);
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 25);
    ctx.lineTo(W, GROUND + 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // Obstáculos
    for (const o of s.obstacles) {
      ctx.save();
      if (o.rolling) {
        ctx.translate(o.x + o.w/2, o.y);
        ctx.rotate(o.angle);
        ctx.font = `${o.w}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(o.emoji, 0, o.w/2);
      } else {
        // Cuerpo
        const grad = ctx.createLinearGradient(o.x, o.y - o.h, o.x + o.w, o.y);
        grad.addColorStop(0, o.color);
        grad.addColorStop(1, o.color + "88");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(o.x, o.y - o.h, o.w, o.h, 4);
        ctx.fill();
        // Emoji encima
        ctx.font = "16px serif";
        ctx.textAlign = "center";
        ctx.fillText(o.emoji, o.x + o.w/2, o.y - o.h - 4);
      }
      ctx.restore();
    }

    // GORILA
    const g = s.gorila;
    const bounce = g.onGround ? Math.sin(s.frame * 0.3) * 2 : 0;
    ctx.save();
    ctx.translate(g.x + 25, g.y + bounce);
    // Cuerpo gorila
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, 22, 0, 0, Math.PI*2);
    ctx.fill();
    // Pecho
    ctx.fillStyle = "#4a3020";
    ctx.beginPath();
    ctx.ellipse(0, 12, 11, 14, 0, 0, Math.PI*2);
    ctx.fill();
    // Cabeza
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.ellipse(0, -12, 14, 13, 0, 0, Math.PI*2);
    ctx.fill();
    // Cara
    ctx.fillStyle = "#8B6040";
    ctx.beginPath();
    ctx.ellipse(0, -10, 9, 8, 0, 0, Math.PI*2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(-5, -13, 3, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -13, 3, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(-5, -13, 1.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -13, 1.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
    // Raqueta
    ctx.strokeStyle = "#74B800";
    ctx.lineWidth = 3;
    const armAngle = g.onGround ? Math.sin(s.frame * 0.3) * 0.3 : -0.8;
    ctx.save();
    ctx.rotate(armAngle);
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(30, -10); ctx.stroke();
    ctx.fillStyle = "#74B800";
    ctx.beginPath(); ctx.ellipse(33, -13, 8, 6, -0.5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Piernas animadas
    if (g.onGround) {
      const legPhase = s.frame * 0.4;
      ctx.fillStyle = "#2a1a0a";
      ctx.beginPath(); ctx.ellipse(-7, 30 + Math.sin(legPhase) * 4, 5, 8, Math.sin(legPhase)*0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, 30 + Math.cos(legPhase) * 4, 5, 8, Math.cos(legPhase)*0.3, 0, Math.PI*2); ctx.fill();
    } else {
      // En el aire — piernas recogidas
      ctx.fillStyle = "#2a1a0a";
      ctx.beginPath(); ctx.ellipse(-7, 25, 5, 8, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, 25, 5, 8, 0.4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Partículas
    for (const p of s.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // HUD — Score
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath(); ctx.roundRect(W/2 - 50, 14, 100, 34, 10); ctx.fill();
    ctx.fillStyle = "#74B800";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(s.score, W/2, 37);

    // Nivel
    ctx.fillStyle = "rgba(116,184,0,0.8)";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(`NIVEL ${s.level}`, W/2, 56);

    // Combo
    if (s.combo >= 3 && s.comboTimer > 0) {
      ctx.save();
      ctx.globalAlpha = s.comboTimer / 60;
      ctx.fillStyle = "#F97316";
      ctx.font = `bold ${18 + s.combo}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(`x${s.combo} COMBO! 🔥`, W/2, H/2 - 60);
      ctx.restore();
    }

    // Velocidad (barra)
    const speedPct = (s.speed - INITIAL_SPEED) / (14 - INITIAL_SPEED);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.roundRect(12, 14, 80, 8, 4); ctx.fill();
    ctx.fillStyle = `hsl(${90 - speedPct*90}, 100%, 50%)`;
    ctx.beginPath(); ctx.roundRect(12, 14, 80 * speedPct, 8, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui"; ctx.textAlign = "left";
    ctx.fillText("VELOCIDAD", 12, 32);

    ctx.restore();
  }

  // Input
  useEffect(() => {
    const onKey = (e) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (screen === "playing") jump(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const handleTap = () => {
    if (screen === "home") startGame();
    else if (screen === "playing") jump();
    else if (screen === "dead") startGame();
  };

  const S = {
    wrap: { position:"fixed", inset:0, background:"#0a0a0a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", userSelect:"none", touchAction:"none" },
    canvas: { borderRadius:16, border:"1px solid rgba(116,184,0,0.2)", maxWidth:"100%", cursor:"pointer" },
    btn: { padding:"14px 32px", borderRadius:14, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, fontSize:16, border:"none", cursor:"pointer", marginTop:8 },
    ghost: { padding:"10px 24px", borderRadius:14, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, fontSize:13, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" },
  };

  return (
    <div style={S.wrap} onPointerDown={handleTap}>
      {/* Canvas siempre visible */}
      <canvas ref={canvasRef} width={W} height={H} style={S.canvas} />

      {/* PANTALLA HOME */}
      {screen === "home" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(2px)",borderRadius:16,gap:8,padding:20}}>
          <div style={{fontSize:64,marginBottom:4}}>🦍</div>
          <div style={{fontSize:28,fontWeight:900,color:"#74B800"}}>Gorila Runner</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:8}}>Salta sobre redes, pelotas y rivales</div>
          {hs > 0 && <div style={{fontSize:13,color:"rgba(116,184,0,0.8)",fontWeight:800}}>🏆 Tu récord: {hs}</div>}
          <button style={S.btn} onPointerDown={e=>{e.stopPropagation();startGame();}}>▶ JUGAR</button>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:4}}>Tap / Space para saltar · Doble tap = doble salto</div>

          {/* Ranking */}
          {topScores.length > 0 && (
            <div style={{marginTop:16,width:"100%",maxWidth:300,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:900,color:"#74B800",marginBottom:8,textAlign:"center"}}>🏆 TOP 10 GLOBAL</div>
              {topScores.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12}}>
                  <span style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.6)"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {s.name}</span>
                  <span style={{fontWeight:900,color:"#74B800"}}>{s.score}</span>
                </div>
              ))}
            </div>
          )}
          <button style={{...S.ghost,marginTop:8}} onPointerDown={e=>{e.stopPropagation();navigate(-1);}}>← Volver</button>
        </div>
      )}

      {/* GAME OVER */}
      {screen === "dead" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",backdropFilter:"blur(4px)",gap:6,padding:20}}>
          <div style={{fontSize:48}}>💥</div>
          <div style={{fontSize:24,fontWeight:900,color:"#ff4444"}}>¡GAME OVER!</div>
          <div style={{fontSize:36,fontWeight:900,color:"#fff",marginTop:4}}>{score}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>puntos</div>
          {score >= hs && score > 0 && <div style={{fontSize:14,color:"#74B800",fontWeight:900,marginTop:4}}>🏆 ¡Nuevo récord!</div>}
          <button style={S.btn} onPointerDown={e=>{e.stopPropagation();startGame();}}>🔄 REINTENTAR</button>

          {topScores.length > 0 && (
            <div style={{marginTop:12,width:"100%",maxWidth:280,background:"rgba(116,184,0,0.06)",border:"1px solid rgba(116,184,0,0.15)",borderRadius:12,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:900,color:"#74B800",marginBottom:6,textAlign:"center"}}>🏆 TOP 10</div>
              {topScores.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:11}}>
                  <span style={{color:"rgba(255,255,255,0.6)"}}>{i+1}. {s.name}</span>
                  <span style={{fontWeight:900,color:"#74B800"}}>{s.score}</span>
                </div>
              ))}
            </div>
          )}
          <button style={{...S.ghost,marginTop:4}} onPointerDown={e=>{e.stopPropagation();navigate(-1);}}>← Volver</button>
        </div>
      )}
    </div>
  );
}
