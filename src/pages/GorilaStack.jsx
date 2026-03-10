import { useState, useEffect, useRef, useCallback } from "react";

const BLOCK_HEIGHT = 44;
const GAME_WIDTH = 300;
const INITIAL_SPEED = 2.2;
const SPEED_INCREMENT = 0.13;
const ITEMS = ["🦍", "🎾", "🏏", "🍌", "🦍", "🎾", "🏏", "🍌", "⚡", "🔥"];
const COLORS = [
  "linear-gradient(135deg,#74B800,#9BE800)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#3b82f6,#60a5fa)",
  "linear-gradient(135deg,#ef4444,#f87171)",
  "linear-gradient(135deg,#8b5cf6,#a78bfa)",
  "linear-gradient(135deg,#06b6d4,#22d3ee)",
  "linear-gradient(135deg,#74B800,#9BE800)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
];

function getHighScore() {
  try { return parseInt(localStorage.getItem("gorilastack_hs") || "0"); } catch { return 0; }
}
function setHighScore(s) {
  try { localStorage.setItem("gorilastack_hs", String(s)); } catch {}
}

export default function GorilaStack() {
  const [screen, setScreen] = useState("home");
  const [blocks, setBlocks] = useState([]);
  const [moving, setMoving] = useState(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScoreState] = useState(getHighScore);
  const [combo, setCombo] = useState(0);
  const [perfectFlash, setPerfectFlash] = useState(false);
  const [particles, setParticles] = useState([]);
  const [shake, setShake] = useState(false);
  const rafRef = useRef(null);
  const movingRef = useRef(null);
  const blocksRef = useRef([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const dirRef = useRef(1);
  const gameActiveRef = useRef(false);

  const spawnBlock = useCallback((width, color, item) => {
    const startX = dirRef.current > 0 ? -width : GAME_WIDTH;
    const newMoving = { x: startX, width, color, item, dir: dirRef.current };
    movingRef.current = newMoving;
    setMoving({ ...newMoving });
  }, []);

  const startGame = useCallback(() => {
    const firstWidth = GAME_WIDTH * 0.6;
    const firstX = (GAME_WIDTH - firstWidth) / 2;
    const firstBlock = { x: firstX, width: firstWidth, color: COLORS[0], item: "🦍", y: 0 };
    blocksRef.current = [firstBlock];
    scoreRef.current = 0;
    comboRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    dirRef.current = 1;
    gameActiveRef.current = true;
    setBlocks([firstBlock]);
    setScore(0);
    setCombo(0);
    setParticles([]);
    setScreen("playing");
    spawnBlock(firstWidth, COLORS[1], ITEMS[1]);
  }, [spawnBlock]);

  useEffect(() => {
    if (screen !== "playing") return;
    let lastTime = 0;
    const animate = (time) => {
      if (!gameActiveRef.current) return;
      const delta = Math.min((time - lastTime) / 16, 3);
      lastTime = time;
      if (movingRef.current) {
        const m = movingRef.current;
        let newX = m.x + m.dir * speedRef.current * delta;
        let newDir = m.dir;
        if (newX + m.width >= GAME_WIDTH + 10) { newDir = -1; newX = GAME_WIDTH - m.width; }
        if (newX <= -10) { newDir = 1; newX = 0; }
        const updated = { ...m, x: newX, dir: newDir };
        movingRef.current = updated;
        dirRef.current = newDir;
        setMoving({ ...updated });
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [screen]);

  const drop = useCallback(() => {
    if (!movingRef.current || !gameActiveRef.current) return;
    const m = movingRef.current;
    const stack = blocksRef.current;
    const top = stack[stack.length - 1];
    const leftEdge = Math.max(m.x, top.x);
    const rightEdge = Math.min(m.x + m.width, top.x + top.width);
    const overlap = rightEdge - leftEdge;
    if (overlap <= 0) {
      gameActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const newHs = Math.max(scoreRef.current, getHighScore());
      setHighScore(newHs);
      setHighScoreState(newHs);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setScreen("dead"), 600);
      return;
    }
    const isPerfect = Math.abs(overlap - top.width) < 6 && Math.abs(m.x - top.x) < 6;
    const newWidth = isPerfect ? top.width : overlap;
    const newX = isPerfect ? top.x : leftEdge;
    const newParticles = Array.from({ length: isPerfect ? 12 : 4 }, (_, i) => ({
      id: Date.now() + i, x: newX + newWidth / 2, y: stack.length,
      emoji: isPerfect ? ["✨", "⭐", "🔥", "💥"][i % 4] : ["💨"][0],
    }));
    setParticles(p => [...p.slice(-20), ...newParticles]);
    setTimeout(() => setParticles(p => p.filter(pt => !newParticles.find(np => np.id === pt.id))), 800);
    if (isPerfect) {
      setPerfectFlash(true);
      setTimeout(() => setPerfectFlash(false), 400);
      comboRef.current += 1;
      setCombo(comboRef.current);
    } else {
      comboRef.current = 0;
      setCombo(0);
    }
    const newBlock = { x: newX, width: newWidth, color: m.color, item: m.item, y: stack.length };
    blocksRef.current = [...stack, newBlock];
    setBlocks([...blocksRef.current]);
    scoreRef.current += 1 + (isPerfect ? 2 : 0) + Math.floor(comboRef.current / 3);
    setScore(scoreRef.current);
    speedRef.current = INITIAL_SPEED + scoreRef.current * SPEED_INCREMENT;
    const nextIdx = (blocksRef.current.length) % COLORS.length;
    const nextItem = ITEMS[blocksRef.current.length % ITEMS.length];
    dirRef.current = dirRef.current * -1;
    spawnBlock(newWidth, COLORS[nextIdx], nextItem);
  }, [spawnBlock]);

  useEffect(() => {
    if (screen !== "playing") return;
    const handler = (e) => {
      if (e.type === "keydown" && e.code !== "Space") return;
      e.preventDefault();
      drop();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, { passive: false });
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [screen, drop]);

  const visibleBlocks = blocks.slice(-10);
  const stackHeight = visibleBlocks.length;

  return (
    <div style={{
      minHeight: "100vh", background: "#050505", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: "'Arial Black', sans-serif",
      userSelect: "none", WebkitUserSelect: "none", overflow: "hidden", position: "relative",
    }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(116,184,0,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      {screen === "home" && (
        <div style={{ textAlign: "center", padding: "0 24px", animation: "fadeIn .5s ease" }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
          <div style={{ fontSize: 80, marginBottom: 8, animation: "bounce 1.5s ease infinite" }}>🦍</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#74B800", letterSpacing: -1, marginBottom: 4 }}>GORILA</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -1, marginBottom: 8 }}>STACK</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.5 }}>
            Apila gorilas, pelotas y palas.<br />¡Sin fin, sin piedad!
          </div>
          {highScore > 0 && (
            <div style={{ marginBottom: 24, padding: "10px 24px", borderRadius: 12, background: "rgba(116,184,0,0.1)", border: "1px solid rgba(116,184,0,0.2)", display: "inline-block" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 800 }}>RÉCORD PERSONAL</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#74B800" }}>{highScore}</div>
            </div>
          )}
          <button onClick={startGame} style={{
            padding: "16px 48px", borderRadius: 16, background: "linear-gradient(135deg,#74B800,#9BE800)",
            border: "none", color: "#000", fontSize: 18, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 8px 32px rgba(116,184,0,0.4)",
          }}>¡JUGAR! 🦍</button>
          <div style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Tap o Espacio para apilar</div>
        </div>
      )}

      {screen === "playing" && (
        <div onClick={drop} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
          <style>{`
            @keyframes perfect{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2)}}
            @keyframes particle{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-60px)}}
            @keyframes shakeAnim{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
          `}</style>
          <div style={{ position: "fixed", top: 60, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 24px", zIndex: 100 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 800 }}>PUNTOS</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score}</div>
            </div>
            {combo >= 2 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800 }}>COMBO</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>x{combo}</div>
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 800 }}>RÉCORD</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>{Math.max(score, highScore)}</div>
            </div>
          </div>
          {perfectFlash && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(116,184,0,0.15)", zIndex: 200, animation: "perfect .4s ease forwards", pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 32, fontWeight: 900, color: "#74B800" }}>¡PERFECTO! ✨</div>
            </div>
          )}
          <div style={{ position: "relative", width: GAME_WIDTH, marginTop: 120, animation: shake ? "shakeAnim .4s ease" : "none" }}>
            <div style={{ position: "relative", height: stackHeight * BLOCK_HEIGHT + BLOCK_HEIGHT * 2 }}>
              {visibleBlocks.map((b, i) => (
                <div key={i} style={{
                  position: "absolute", left: b.x, width: b.width, height: BLOCK_HEIGHT - 3,
                  bottom: i * BLOCK_HEIGHT, background: b.color, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}>{b.width > 40 && b.item}</div>
              ))}
              {moving && (
                <div style={{
                  position: "absolute", left: moving.x, width: moving.width, height: BLOCK_HEIGHT - 3,
                  bottom: stackHeight * BLOCK_HEIGHT, background: moving.color, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, boxShadow: "0 4px 20px rgba(116,184,0,0.3)",
                }}>{moving.width > 40 && moving.item}</div>
              )}
            </div>
            {particles.map(p => (
              <div key={p.id} style={{
                position: "absolute", left: p.x, bottom: p.y * BLOCK_HEIGHT + BLOCK_HEIGHT,
                fontSize: 18, pointerEvents: "none", animation: "particle .8s ease forwards",
              }}>{p.emoji}</div>
            ))}
          </div>
          <div style={{ position: "fixed", bottom: 40, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Tap para apilar</div>
        </div>
      )}

      {screen === "dead" && (
        <div style={{ textAlign: "center", padding: "0 24px", animation: "fadeIn .5s ease" }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
          <div style={{ fontSize: 64, marginBottom: 16 }}>😵</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 4 }}>¡Se cayó todo!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>El gorila llora en un rincón</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 32 }}>
            <div style={{ padding: "16px 24px", borderRadius: 14, background: "rgba(116,184,0,0.1)", border: "1px solid rgba(116,184,0,0.2)", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 800, marginBottom: 4 }}>PUNTOS</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#74B800" }}>{score}</div>
            </div>
            <div style={{ padding: "16px 24px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 800, marginBottom: 4 }}>RÉCORD</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>{highScore}</div>
            </div>
          </div>
          {score >= highScore && score > 0 && (
            <div style={{ marginBottom: 24, padding: "10px 24px", borderRadius: 12, background: "rgba(116,184,0,0.15)", border: "1px solid rgba(116,184,0,0.3)", fontSize: 14, fontWeight: 900, color: "#74B800" }}>
              🏆 ¡Nuevo récord personal!
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={startGame} style={{
              padding: "16px 48px", borderRadius: 16, background: "linear-gradient(135deg,#74B800,#9BE800)",
              border: "none", color: "#000", fontSize: 18, fontWeight: 900, cursor: "pointer",
              boxShadow: "0 8px 32px rgba(116,184,0,0.4)",
            }}>🔄 Otra vez</button>
            <button onClick={() => setScreen("home")} style={{
              padding: "12px 32px", borderRadius: 12, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Inicio</button>
          </div>
        </div>
      )}
    </div>
  );
}
