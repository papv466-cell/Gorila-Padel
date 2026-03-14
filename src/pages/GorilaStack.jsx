// src/pages/GorilaStack.jsx — Gorila Word 🦍 Wordle de Pádel
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const WORDS = [
  // Técnica de pádel
  "SMASH","VOLEA","GLOBO","BANDA","PISTA","SAQUE","FONDO","PARED","DRIVE","PUNTO",
  "FALTA","GOLPE","MARCO","RUEDA","SILLA","RAMPA","MIXTO","JUEGO","MATCH","RESTO",
  "REVÉS","TUBOS","MALLA","FONDO","VIDRO","SALTO","GANCH","APOYO","BLOQUE","QUITE",
  // Jugadores famosos 5 letras exactas
  "GALAN","TAPIA","BELEN","MARTA","PABLO","NEGRO","MAURI","LEBRE","STUPA","CAPRA",
  // Términos generales pádel
  "PISTA","TURNO","JUEGO","TENIS","PELOT","MATCH","TIROS","BOLAS","REDES","PAREJ",
  // Inclusivo
  "SILLA","RAMPA","MIXTO","APOYO","RUEDA",
].filter((w,i,a) => w.length === 5 && a.indexOf(w) === i);

// Palabra del día basada en la fecha
function getTodayWord() {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth()+1) * 100 + now.getDate();
  return WORDS[seed % WORDS.length];
}

function getTodayKey() {
  const now = new Date();
  return `gorila_word_${now.getFullYear()}_${now.getMonth()+1}_${now.getDate()}`;
}

const KEYBOARD = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];

const MAX_ATTEMPTS = 5;

export default function GorilaStack() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState("home");
  const [word] = useState(getTodayWord);
  const [guesses, setGuesses] = useState([]); // [{letters:[{char,state}]}]
  const [current, setCurrent] = useState("");
  const [gameState, setGameState] = useState("playing"); // playing | won | lost
  const [shake, setShake] = useState(false);
  const [streak, setStreak] = useState(() => { try { return parseInt(localStorage.getItem("gorila_word_streak")||"0"); } catch { return 0; } });
  const [shareText, setShareText] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [usedLetters, setUsedLetters] = useState({}); // letra → state

  // Cargar partida guardada del día
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getTodayKey());
      if (saved) {
        const data = JSON.parse(saved);
        setGuesses(data.guesses || []);
        setGameState(data.gameState || "playing");
        setUsedLetters(data.usedLetters || {});
        if (data.gameState !== "playing") setScreen("result");
        else setScreen("game");
      }
    } catch {}
  }, []);

  function saveState(newGuesses, newGameState, newUsedLetters) {
    try {
      localStorage.setItem(getTodayKey(), JSON.stringify({
        guesses: newGuesses, gameState: newGameState, usedLetters: newUsedLetters
      }));
    } catch {}
  }

  function evaluateGuess(guess) {
    const result = [];
    const wordArr = word.split("");
    const guessArr = guess.split("");
    const used = [...wordArr];

    // Primero correctas
    guessArr.forEach((c, i) => {
      if (c === wordArr[i]) {
        result[i] = { char: c, state: "correct" };
        used[i] = null;
      } else {
        result[i] = { char: c, state: "absent" };
      }
    });

    // Luego presentes
    guessArr.forEach((c, i) => {
      if (result[i].state === "correct") return;
      const idx = used.indexOf(c);
      if (idx !== -1) {
        result[i] = { char: c, state: "present" };
        used[idx] = null;
      }
    });

    return result;
  }

  function submitGuess() {
    if (current.length !== 5) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    if (gameState !== "playing") return;

    const result = evaluateGuess(current);
    const newGuesses = [...guesses, { letters: result }];

    // Actualizar letras usadas
    const newUsed = { ...usedLetters };
    result.forEach(({ char, state }) => {
      const prev = newUsed[char];
      if (!prev || (prev === "absent" && state !== "absent") || (prev === "present" && state === "correct")) {
        newUsed[char] = state;
      }
    });

    const won = result.every(r => r.state === "correct");
    const lost = !won && newGuesses.length >= MAX_ATTEMPTS;
    const newGameState = won ? "won" : lost ? "lost" : "playing";

    setGuesses(newGuesses);
    setCurrent("");
    setUsedLetters(newUsed);
    setGameState(newGameState);
    saveState(newGuesses, newGameState, newUsed);

    if (won) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      try { localStorage.setItem("gorila_word_streak", String(newStreak)); } catch {}
      const emojis = newGuesses.map(g => g.letters.map(l => l.state==="correct"?"🟩":l.state==="present"?"🟨":"⬛").join("")).join("\n");
      const txt = `🦍 Gorila Word — ${new Date().toLocaleDateString("es")}\n${emojis}\n\n¡Lo conseguí en ${newGuesses.length}/${MAX_ATTEMPTS} intentos!\nJuega en gorilapadel.com`;
      setShareText(txt);
      setTimeout(() => { setShowShare(true); setScreen("result"); }, 800);
    } else if (lost) {
      try { localStorage.setItem("gorila_word_streak", "0"); } catch {}
      setStreak(0);
      const emojis = newGuesses.map(g => g.letters.map(l => l.state==="correct"?"🟩":l.state==="present"?"🟨":"⬛").join("")).join("\n");
      const txt = `🦍 Gorila Word — ${new Date().toLocaleDateString("es")}\n${emojis}\n\nLa palabra era: ${word}\nJuega en gorilapadel.com`;
      setShareText(txt);
      setTimeout(() => { setShowShare(true); setScreen("result"); }, 800);
    }
  }

  const handleKey = useCallback((key) => {
    if (gameState !== "playing") return;
    if (key === "ENTER") { submitGuess(); return; }
    if (key === "⌫" || key === "BACKSPACE") { setCurrent(c => c.slice(0,-1)); return; }
    if (/^[A-ZÑ]$/.test(key) && current.length < 5) setCurrent(c => c + key);
  }, [current, gameState, guesses]);

  useEffect(() => {
    const onKey = (e) => {
      if (screen !== "game") return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("⌫");
      else if (/^[A-ZÑ]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, screen]);

  const stateColor = (state) => {
    if (state === "correct") return "#538d4e";
    if (state === "present") return "#b59f3b";
    if (state === "absent") return "#3a3a3c";
    return "rgba(255,255,255,0.08)";
  };

  const keyColor = (k) => {
    const s = usedLetters[k];
    if (s === "correct") return "#538d4e";
    if (s === "present") return "#b59f3b";
    if (s === "absent") return "#3a3a3c";
    return "rgba(255,255,255,0.15)";
  };

  const S = {
    wrap: { position:"fixed", inset:0, background:"#121213", display:"flex", flexDirection:"column", alignItems:"center", overflow:"hidden" },
    header: { width:"100%", maxWidth:500, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)" },
    grid: { display:"flex", flexDirection:"column", gap:6, padding:"20px 0 10px", flex:1, justifyContent:"center" },
    row: (isShaking) => ({ display:"flex", gap:6, animation: isShaking ? "shake 0.5s ease" : "none" }),
    cell: (state, filled) => ({
      width:58, height:58, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:22, fontWeight:900, color:"#fff", border: state ? "none" : filled ? "2px solid rgba(255,255,255,0.5)" : "2px solid rgba(255,255,255,0.15)",
      background: stateColor(state),
      transition:"background 0.3s",
    }),
    keyboard: { width:"100%", maxWidth:500, padding:"0 8px 16px" },
    keyRow: { display:"flex", gap:4, justifyContent:"center", marginBottom:4, flexWrap:"nowrap", width:"100%" },
    key: (k) => ({
      padding: k==="ENTER"?"0 4px":"0", width: k==="ENTER"||k==="⌫" ? 48 : 32, height:46,
      borderRadius:6, border:"none", cursor:"pointer", fontWeight:900,
      fontSize: k==="ENTER" ? 11 : 16, color:"#fff",
      background: keyColor(k),
      display:"flex", alignItems:"center", justifyContent:"center",
    }),
    btn: { padding:"13px 32px", borderRadius:14, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, fontSize:16, border:"none", cursor:"pointer" },
    ghost: { padding:"10px 24px", borderRadius:14, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, fontSize:13, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" },
  };

  return (
    <div style={S.wrap}>
      {/* HOME */}
      {screen === "home" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#121213",gap:14,padding:24}}>
          <div style={{fontSize:56}}>🦍</div>
          <div style={{fontSize:30,fontWeight:900,color:"#74B800"}}>Gorila Word</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",maxWidth:280,lineHeight:1.7}}>
            Adivina la palabra de pádel en <strong style={{color:"#fff"}}>{MAX_ATTEMPTS} intentos</strong>.<br/>
            🟩 Letra correcta · 🟨 Está pero mal sitio · ⬛ No está<br/>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>Una palabra nueva cada día para todos</span>
          </div>
          {streak > 0 && <div style={{fontSize:14,color:"#74B800",fontWeight:900}}>🔥 Racha: {streak} días</div>}
          <button style={S.btn} onClick={() => setScreen("game")}>▶ JUGAR HOY</button>
          <button style={S.ghost} onClick={() => navigate(-1)}>← Volver</button>
        </div>
      )}

      {/* GAME */}
      {screen === "game" && (
        <>
          {/* Header */}
          <div style={S.header}>
            <button onClick={() => navigate(-1)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:20}}>←</button>
            <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>🦍 Gorila Word</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{guesses.length}/{MAX_ATTEMPTS}</div>
          </div>

          {/* Grid */}
          <div style={S.grid}>
            {Array.from({length: MAX_ATTEMPTS}).map((_, ri) => {
              const guess = guesses[ri];
              const isCurrentRow = ri === guesses.length && gameState === "playing";
              const isShaking = isCurrentRow && shake;
              return (
                <div key={ri} style={S.row(isShaking)}>
                  {Array.from({length:5}).map((_, ci) => {
                    const letter = guess ? guess.letters[ci] : null;
                    const char = letter ? letter.char : (isCurrentRow ? current[ci] : "");
                    const state = letter ? letter.state : null;
                    return (
                      <div key={ci} style={S.cell(state, !!char)}>
                        {char}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Teclado */}
          <div style={S.keyboard}>
            {KEYBOARD.map((row, ri) => (
              <div key={ri} style={S.keyRow}>
                {row.map(k => (
                  <button key={k} style={S.key(k)} onClick={() => handleKey(k)}>{k}</button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* RESULT */}
      {screen === "result" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#121213",gap:12,padding:24}}>
          <div style={{fontSize:48}}>{gameState==="won"?"🏆":"💥"}</div>
          <div style={{fontSize:24,fontWeight:900,color:gameState==="won"?"#74B800":"#ff4444"}}>
            {gameState==="won" ? `¡Lo conseguiste en ${guesses.length}!` : "¡Mañana será!"}
          </div>
          {gameState==="lost" && (
            <div style={{fontSize:16,color:"rgba(255,255,255,0.6)"}}>La palabra era: <strong style={{color:"#fff"}}>{word}</strong></div>
          )}
          {gameState==="won" && streak > 0 && (
            <div style={{fontSize:14,color:"#F97316",fontWeight:900}}>🔥 Racha de {streak} días</div>
          )}

          {/* Grid resultado */}
          <div style={{display:"flex",flexDirection:"column",gap:4,margin:"8px 0"}}>
            {guesses.map((g,i) => (
              <div key={i} style={{display:"flex",gap:4}}>
                {g.letters.map((l,j) => (
                  <div key={j} style={{width:44,height:44,borderRadius:4,background:stateColor(l.state),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff"}}>
                    {l.char}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {showShare && (
            <button style={S.btn} onClick={() => {
              if (navigator.share) navigator.share({ text: shareText });
              else { navigator.clipboard?.writeText(shareText); alert("¡Copiado al portapapeles!"); }
            }}>
              📤 Compartir resultado
            </button>
          )}

          <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>
            Nueva palabra mañana a las 00:00
          </div>
          <button style={S.ghost} onClick={() => navigate(-1)}>← Volver</button>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </div>
  );
}
