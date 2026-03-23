// src/components/PostMatchModal.jsx
import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { processMatchXp } from "../services/xp";
import { showXPToast } from "./XPToast";

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

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCircularImage(ctx, img, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

async function generarImagenStory({ sets, match, players, gorilasinlimitesIds = [] }) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, W, H);

  const gradTop = ctx.createRadialGradient(540, 0, 0, 540, 0, 900);
  gradTop.addColorStop(0, "rgba(116,184,0,0.25)");
  gradTop.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, W, H);

  const gradBot = ctx.createLinearGradient(0, 1400, 0, H);
  gradBot.addColorStop(0, "rgba(0,0,0,0)");
  gradBot.addColorStop(1, "rgba(116,184,0,0.12)");
  ctx.fillStyle = gradBot;
  ctx.fillRect(0, 1400, W, H - 1400);

  ctx.strokeStyle = "rgba(116,184,0,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 80) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
  for (let i = 0; i < H; i += 80) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

  ctx.textAlign = "center";
  ctx.fillStyle = "#74B800";
  ctx.font = "bold 64px Arial";
  ctx.fillText("GORILA PÁDEL", W / 2, 140);
  ctx.font = "80px Arial";
  ctx.fillText("🦍", W / 2, 240);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "38px Arial";
  ctx.fillText(match?.club_name || "Pádel", W / 2, 320);
  const fecha = match?.start_at ? new Date(match.start_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "";
  ctx.font = "32px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(fecha, W / 2, 368);

  const sepGrad = ctx.createLinearGradient(100, 0, W - 100, 0);
  sepGrad.addColorStop(0, "rgba(116,184,0,0)");
  sepGrad.addColorStop(0.5, "rgba(116,184,0,0.6)");
  sepGrad.addColorStop(1, "rgba(116,184,0,0)");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, 400); ctx.lineTo(W - 100, 400); ctx.stroke();

  const setsValidos = sets.filter(s => s.a !== "" || s.b !== "");
  const totalA = setsValidos.filter(s => parseInt(s.a || 0) > parseInt(s.b || 0)).length;
  const totalB = setsValidos.filter(s => parseInt(s.b || 0) > parseInt(s.a || 0)).length;

  ctx.save();
  drawRoundedRect(ctx, 80, 430, W - 160, 280, 28);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = "rgba(116,184,0,0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "left";
  ctx.fillText("PAREJA A", 140, 480);
  ctx.textAlign = "right";
  ctx.fillText("PAREJA B", W - 140, 480);

  ctx.textAlign = "center";
  const winA = totalA > totalB, winB = totalB > totalA;
  ctx.font = "bold 160px Arial";
  ctx.fillStyle = winA ? "#74B800" : "rgba(255,255,255,0.4)";
  ctx.fillText(String(totalA), 260, 640);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "bold 80px Arial";
  ctx.fillText("–", W / 2, 620);
  ctx.font = "bold 160px Arial";
  ctx.fillStyle = winB ? "#74B800" : "rgba(255,255,255,0.4)";
  ctx.fillText(String(totalB), W - 260, 640);

  if (setsValidos.length > 0) {
    ctx.font = "28px Arial";
    const setStr = setsValidos.map((s, i) => `Set ${i + 1}: ${s.a}-${s.b}`).join("   ");
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(setStr, W / 2, 690);
  }

  if (winA || winB) {
    ctx.save();
    drawRoundedRect(ctx, W / 2 - 200, 730, 400, 60, 14);
    const winGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
    winGrad.addColorStop(0, "rgba(116,184,0,0.3)");
    winGrad.addColorStop(1, "rgba(155,232,0,0.3)");
    ctx.fillStyle = winGrad;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#9BE800";
    ctx.font = "bold 32px Arial";
    ctx.fillText(winA ? "🏆 Victoria Pareja A" : "🏆 Victoria Pareja B", W / 2, 769);
  }

  const playerList = (players || []).slice(0, 4);
  const avatarY = 870;
  const spacing = 220;
  const startX = W / 2 - ((playerList.length - 1) * spacing) / 2;

  for (let i = 0; i < playerList.length; i++) {
    const p = playerList[i];
    const px = startX + i * spacing;
    const pid = p.player_uuid || p.id;
    const hasGSL = gorilasinlimitesIds.includes(String(pid));
    const avatarUrl = p.avatar_url || p.profiles_public?.avatar_url;

    if (avatarUrl) {
      const img = await loadImage(avatarUrl);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, avatarY, hasGSL ? 58 : 56, 0, Math.PI * 2);
        if (hasGSL) {
          const gslGrad = ctx.createLinearGradient(px - 58, avatarY - 58, px + 58, avatarY + 58);
          gslGrad.addColorStop(0, "#74B800");
          gslGrad.addColorStop(1, "#9BE800");
          ctx.strokeStyle = gslGrad;
          ctx.lineWidth = 5;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 2;
        }
        ctx.stroke();
        ctx.restore();
        drawCircularImage(ctx, img, px, avatarY, 52);
      }
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, avatarY, 52, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(116,184,0,0.15)";
      ctx.fill();
      ctx.restore();
      ctx.font = "52px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🦍", px, avatarY + 18);
    }

    if (hasGSL) {
      ctx.save();
      drawRoundedRect(ctx, px - 44, avatarY + 56, 88, 28, 8);
      const badgeGrad = ctx.createLinearGradient(px - 44, 0, px + 44, 0);
      badgeGrad.addColorStop(0, "#74B800");
      badgeGrad.addColorStop(1, "#9BE800");
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#000";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.fillText("SIN LÍMITES", px, avatarY + 75);
    }

    const nombre = p.name || p.profiles_public?.name || p.handle || "Jugador";
    ctx.fillStyle = hasGSL ? "#9BE800" : "rgba(255,255,255,0.8)";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText(nombre.split(" ")[0], px, avatarY + 110 + (hasGSL ? 10 : 0));
  }

  ctx.save();
  drawRoundedRect(ctx, W / 2 - 120, 1020, 240, 50, 12);
  ctx.fillStyle = "rgba(116,184,0,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(116,184,0,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#74B800";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`🎚️ Nivel ${(match?.level || "").toUpperCase()}`, W / 2, 1053);

  ctx.strokeStyle = sepGrad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 1100); ctx.lineTo(W - 100, 1100); ctx.stroke();

  ctx.fillStyle = "rgba(116,184,0,0.7)";
  ctx.font = "bold 34px Arial";
  ctx.fillText("#GorilaoPadel", W / 2, 1820);
  ctx.font = "28px Arial";
  ctx.fillStyle = "rgba(116,184,0,0.45)";
  ctx.fillText("#PadelInclusivoSinLimites  #GorilasinLimites", W / 2, 1868);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "24px Arial";
  ctx.fillText("gorilapadel.com", W / 2, 1916);

  return canvas;
}

export default function PostMatchModal({ match, players, session, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clubRating, setClubRating] = useState(0);
  const [clubComment, setClubComment] = useState('');
  const [clubRatingSent, setClubRatingSent] = useState(false);
  const [sets, setSets] = useState([{ a: "", b: "" }, { a: "", b: "" }]);
  const [winner, setWinner] = useState(null);
  const [ratings, setRatings] = useState({});
  const [mood, setMood] = useState(null);
  const [saving, setSaving] = useState(false);
  const [donationStep, setDonationStep] = useState(false);
  const [donationAmount, setDonationAmount] = useState("2");
  const [donationProject, setDonationProject] = useState(null);
  const [activeProjects, setActiveProjects] = useState([]);
  const [donationSent, setDonationSent] = useState(false);
  const [sendingDonation, setSendingDonation] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  // ✅ FIX: ref para evitar doble ejecución de saveAll()
  const saveInProgress = useRef(false);

  const otherPlayers = (players || []).filter(p => p.player_uuid !== session?.user?.id);

  function calcWinner() {
    let wA = 0, wB = 0;
    sets.forEach(s => {
      const a = parseInt(s.a || 0), b = parseInt(s.b || 0);
      if (a > b) wA++; else if (b > a) wB++;
    });
    return wA > wB ? "a" : wB > wA ? "b" : null;
  }

  const handleGenerarYCompartir = useCallback(async () => {
    setSharing(true);
    try {
      const playerIds = (players || []).map(p => p.player_uuid || p.id).filter(Boolean);
      let gorilasinlimitesIds = [];
      if (playerIds.length > 0) {
        const { data } = await supabase.from("profiles").select("id").eq("gorila_sin_limites", true).in("id", playerIds);
        gorilasinlimitesIds = (data || []).map(r => String(r.id));
      }
      const canvas = await generarImagenStory({ sets, match, players, gorilasinlimitesIds });
      canvas.toBlob(async (blob) => {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        const file = new File([blob], "gorila-resultado.png", { type: "image/png" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: "Mi partido en MonkeyGorila 🦍", text: `¡Resultado! 🦍 #GorilaoPadel` }); } catch {}
        } else {
          const a = document.createElement("a");
          a.href = url; a.download = "gorila-resultado.png"; a.click();
        }
        setSharing(false);
      }, "image/png");
    } catch (e) { console.error(e); setSharing(false); }
  }, [sets, match, players]);

  async function saveAll() {
    // ✅ FIX: evitar doble ejecución (el botón "Publicar foto" y "Terminar" comparten esta función)
    if (saveInProgress.current) return;
    saveInProgress.current = true;

    try {
      setSaving(true);
      const setsFormatted = sets.filter(s => s.a !== "" || s.b !== "").map(s => ({ a: parseInt(s.a) || 0, b: parseInt(s.b) || 0 }));
      const finalWinner = winner || calcWinner();
      await supabase.from("match_results").upsert({ match_id: match.id, sets: setsFormatted, winner_side: finalWinner, submitted_by: session.user.id }, { onConflict: "match_id" });
      for (const [userId, r] of Object.entries(ratings)) {
        if (!r.rating) continue;
        await supabase.from("player_ratings").upsert({ match_id: match.id, from_user_id: session.user.id, to_user_id: userId, rating: r.rating, vibe: r.vibe || null }, { onConflict: "match_id,from_user_id,to_user_id" });
      }
      if (mood) await supabase.from("match_moods").upsert({ match_id: match.id, user_id: session.user.id, mood }, { onConflict: "match_id,user_id" });
      await supabase.from("match_post_done").upsert({ match_id: match.id, user_id: session.user.id }, { onConflict: "match_id,user_id" });

      // ✅ XP + logros
      const finalWinner2 = winner || calcWinner();
      const won = finalWinner2 === "a"; // simplificación: pareja A = el usuario
      const { newAchievements } = await processMatchXp({
        userId: session.user.id,
        matchId: match.id,
        won,
        isInclusive: !!match.is_inclusive,
        isCreator: match.created_by_user === session.user.id,
        matchStartAt: match.start_at,
      });
      showXPToast({ xpGained: won ? 35 : 20, newAchievements });

      setStep(4);
    } catch (e) { alert(e.message); }
    finally {
      setSaving(false);
      saveInProgress.current = false;
    }
  }

  function addSet() { if (sets.length < 3) setSets([...sets, { a: "", b: "" }]); }

  const S = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    modal: { width: "min(640px,100%)", background: "#111", borderRadius: "24px 24px 0 0", border: "1px solid rgba(116,184,0,0.2)", padding: 24, paddingBottom: "max(32px,env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" },
    title: { fontSize: 20, fontWeight: 900, color: "#74B800", marginBottom: 4 },
    sub: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 },
    btn: (c) => ({ padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 14, width: "100%", background: c === "green" ? "linear-gradient(135deg,#74B800,#9BE800)" : "rgba(255,255,255,0.08)", color: c === "green" ? "#000" : "#fff" }),
    input: { width: 60, padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, fontWeight: 900, textAlign: "center", outline: "none" },
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {step === 1 && (
          <>
            <div style={S.title}>🏓 ¿Cómo quedó el partido?</div>
            <div style={S.sub}>{match.club_name} · {String(match.start_at || "").slice(11, 16)}</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}><span>PAREJA A</span><span>PAREJA B</span></div>
              {sets.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 10 }}>
                  <input style={S.input} type="number" min="0" max="7" value={s.a} onChange={e => setSets(prev => prev.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                  <span style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", fontWeight: 900 }}>–</span>
                  <input style={S.input} type="number" min="0" max="7" value={s.b} onChange={e => setSets(prev => prev.map((x, j) => j === i ? { ...x, b: e.target.value } : x))} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Set {i + 1}</span>
                </div>
              ))}
              {sets.length < 3 && <button onClick={addSet} style={{ ...S.btn("ghost"), fontSize: 12, padding: "8px", marginTop: 4 }}>+ Añadir set</button>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(2)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={() => setStep(2)} style={{ ...S.btn("ghost"), width: "auto", padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Saltar</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={S.title}>⭐ Valora a tus compañeros</div>
            <div style={S.sub}>Solo ellos verán tu valoración</div>
            {otherPlayers.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20 }}>No hay jugadores para valorar</div>}
            {otherPlayers.map(p => (
              <div key={p.player_uuid} style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  {p.avatar_url ? <img src={p.avatar_url} style={{ width: 36, height: 36, borderRadius: 999, objectFit: "cover" }} alt="" /> : <div style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(116,184,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🦍</div>}
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{p.name || p.handle || "Jugador"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} onClick={() => setRatings(prev => ({ ...prev, [p.player_uuid]: { ...prev[p.player_uuid], rating: star } }))}
                      style={{ fontSize: 28, cursor: "pointer", opacity: ratings[p.player_uuid]?.rating >= star ? 1 : 0.2, transition: "opacity .15s" }}>⭐</span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  {VIBES.map(v => {
                    const sel = ratings[p.player_uuid]?.vibe === v.key;
                    return <button key={v.key} onClick={() => setRatings(prev => ({ ...prev, [p.player_uuid]: { ...prev[p.player_uuid], vibe: sel ? null : v.key } }))}
                      style={{ padding: "5px 10px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, background: sel ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.06)", color: sel ? "#74B800" : "rgba(255,255,255,0.5)" }}>{v.icon} {v.label}</button>;
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(3)} style={S.btn("green")}>Siguiente →</button>
              <button onClick={() => setStep(1)} style={{ ...S.btn("ghost"), width: "auto", padding: "13px 16px" }}>← Atrás</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={S.title}>🦍 ¿Cómo te fue?</div>
            <div style={S.sub}>Tu Gorila Mood del partido</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
              {MOODS.map(m => (
                <button key={m.key} onClick={() => setMood(m.key)}
                  style={{ padding: "14px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center", minWidth: 60, background: mood === m.key ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.05)", border: mood === m.key ? "1px solid #74B800" : "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 28 }}>{m.emoji}</div>
                  <div style={{ fontSize: 10, color: mood === m.key ? "#74B800" : "rgba(255,255,255,0.4)", fontWeight: 800, marginTop: 4 }}>{m.label}</div>
                </button>
              ))}
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.15)", marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 4 }}>¿Foto del partido?</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Publícala en Gorilandia con el resultado</div>
              {/* ✅ FIX: saveAll() ya no se llama aquí — solo navega, saveAll() se llama con el botón Terminar */}
              <button onClick={() => { navigate(`/gorilandia?newpost=1&matchId=${match.id}`); }} style={{ ...S.btn("green"), fontSize: 12, padding: "10px" }}>📸 Publicar foto en Gorilandia</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveAll} disabled={saving} style={S.btn("green")}>{saving ? "Guardando…" : "✅ Terminar"}</button>
              <button onClick={() => setStep(2)} style={{ ...S.btn("ghost"), width: "auto", padding: "13px 16px" }}>← Atrás</button>
            </div>
          </>
        )}

        {step === 4 && !donationStep && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>🦍</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>¡Buen partido!</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>Tus valoraciones han sido enviadas</div>
            {previewUrl && (
              <div style={{ marginBottom: 16 }}>
                <img src={previewUrl} alt="Story preview" style={{ width: "100%", maxWidth: 280, borderRadius: 16, border: "2px solid rgba(116,184,0,0.3)" }} />
              </div>
            )}
            <div style={{ padding: 16, borderRadius: 14, background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.15)", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 4 }}>📲 Comparte tu resultado</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Imagen para Instagram Stories con resultado y jugadores 🦍</div>
              <button onClick={handleGenerarYCompartir} disabled={sharing} style={{ ...S.btn("green"), fontSize: 13, marginBottom: 8, opacity: sharing ? 0.7 : 1 }}>
                {sharing ? "⏳ Generando imagen…" : "📸 Generar y compartir"}
              </button>
            </div>
            {match?.club_id && !clubRatingSent ? (
              <button onClick={()=>setStep(5)} style={{...S.btn("green"), marginBottom:8}}>⭐ Valorar el club</button>
            ) : null}
            {!donationSent && (
              <button
                onClick={async () => {
                  const { data } = await supabase.from("projects").select("id,title").eq("active", true).limit(3);
                  setActiveProjects(data || []);
                  if (data?.length > 0) setDonationProject(data[0].id);
                  setDonationStep(true);
                }}
                style={{ ...S.btn("green"), marginBottom: 8, background: "#E67E22", color: "#fff" }}>
                🍺 Dona una cerveza — 2€
              </button>
            )}
            <button onClick={onClose} style={S.btn("ghost")}>Cerrar</button>
          </div>
        )}

        {step === 4 && donationStep && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🍺</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Dona una cerveza</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.6 }}>
              Con el precio de una cerveza ayudas a que más personas con discapacidad puedan jugar.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {["1", "2", "5", "10"].map(v => (
                <button key={v} onClick={() => setDonationAmount(v)}
                  style={{ minHeight: 52, borderRadius: 12,
                    border: donationAmount === v ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.15)",
                    background: donationAmount === v ? "rgba(230,126,34,0.15)" : "rgba(255,255,255,0.05)",
                    color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  {v} €
                </button>
              ))}
            </div>
            {activeProjects.length > 0 && (
              <div style={{ marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Tu donación va a:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeProjects.map(p => (
                    <button key={p.id} onClick={() => setDonationProject(p.id)}
                      style={{ padding: "12px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                        border: donationProject === p.id ? "2px solid #E67E22" : "1px solid rgba(255,255,255,0.10)",
                        background: donationProject === p.id ? "rgba(230,126,34,0.10)" : "rgba(255,255,255,0.04)",
                        color: "#fff", fontWeight: 600, fontSize: 14 }}>
                      🏗️ {p.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, textAlign: "left", fontSize: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "rgba(255,255,255,0.80)" }}>Tu donación se reparte:</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>🦍 MonkeyGorila</span>
                <span style={{ fontWeight: 700 }}>0,10 €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>🏗️ Proyecto elegido</span>
                <span style={{ fontWeight: 700, color: "#E67E22" }}>
                  {(Math.max(0, parseFloat(donationAmount || 0) - 0.10)).toFixed(2)} €
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={async () => {
                  if (!donationProject) return;
                  setSendingDonation(true);
                  try {
                    const amount = parseFloat(donationAmount || 2);
                    const { data: proj } = await supabase.from("projects").select("current_amount").eq("id", donationProject).single();
                    await supabase.from("projects").update({
                      current_amount: (proj?.current_amount || 0) + amount,
                      updated_at: new Date().toISOString()
                    }).eq("id", donationProject);
                    setDonationSent(true);
                    setDonationStep(false);
                  } catch(e) { console.error(e); }
                  finally { setSendingDonation(false); }
                }}
                disabled={sendingDonation || !donationProject}
                style={{ flex: 1, minHeight: 52, borderRadius: 14, background: "#E67E22", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: sendingDonation ? 0.6 : 1 }}>
                {sendingDonation ? "Enviando…" : `🍺 Donar ${parseFloat(donationAmount || 0).toFixed(2)} €`}
              </button>
              <button onClick={() => setDonationStep(false)}
                style={{ minHeight: 52, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Ahora no
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏟️</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>¿Qué tal el club?</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{match?.club_name || "Valora la instalación"}</div>

            {/* Estrellas */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {[1,2,3,4,5].map(star => (
                <span key={star} onClick={() => setClubRating(star)}
                  style={{ fontSize: 40, cursor: "pointer", opacity: clubRating >= star ? 1 : 0.2, transition: "all .15s", transform: clubRating >= star ? "scale(1.15)" : "scale(1)" }}>
                  ⭐
                </span>
              ))}
            </div>

            {/* Aspectos rápidos */}
            {clubRating > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>¿QUÉ DESTACARÍAS?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {["🎾 Buenas pistas","🚿 Vestuarios limpios","🅿️ Fácil aparcar","☕ Buen bar","👋 Personal amable","💡 Buena iluminación"].map(tag => {
                    const sel = clubComment.includes(tag);
                    return (
                      <button key={tag} onClick={() => setClubComment(prev => sel ? prev.replace(tag, '').trim() : (prev + ' ' + tag).trim())}
                        style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                          background: sel ? "rgba(116,184,0,0.2)" : "rgba(255,255,255,0.06)",
                          color: sel ? "#74B800" : "rgba(255,255,255,0.6)",
                          outline: sel ? "1px solid rgba(116,184,0,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comentario libre */}
            {clubRating > 0 && (
              <textarea placeholder="Comentario opcional…" value={clubComment.replace(/🎾.*?(?=\s|$)/g,'').trim()}
                onChange={e => setClubComment(prev => {
                  const tags = prev.match(/[🎾🚿🅿️☕👋💡][^🎾🚿🅿️☕👋💡]*/g) || [];
                  return tags.join(' ') + ' ' + e.target.value;
                })}
                rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            )}

            <div style={{ display: "flex", gap: 8 }}>
              {clubRating > 0 && (
                <button onClick={async () => {
                  try {
                    await supabase.from('club_ratings').insert({
                      user_id: session.user.id,
                      club_id: match.club_id,
                      rating: clubRating,
                      comment: clubComment.trim() || null,
                    });
                    setClubRatingSent(true);
                    setStep(4);
                  } catch(e) { console.error(e); setStep(4); }
                }} style={{ ...S.btn("green"), flex: 1 }}>
                  ✅ Enviar valoración
                </button>
              )}
              <button onClick={() => { setStep(4); }} style={S.btn("ghost")}>
                {clubRating > 0 ? 'Omitir' : 'No ahora'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}