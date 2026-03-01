// src/services/gorilaSound.js
// Sonidos + timers (5 min antes y fin). Evita duplicados y no rompe nada.

// ─── RUTA ÚNICA del sonido gorila ───────────────────────────────────────────
const GORILA_SOUND_URL = "/sounds/gorila.mp3";
// ────────────────────────────────────────────────────────────────────────────

let audioEl = null;

// key -> { sig, t1, t2 }
const scheduled = new Map();

/* ---------------------------
   Persistencia anti-duplicado
--------------------------- */
function readSessionSigMap() {
  try {
    const raw = sessionStorage.getItem("gp_gorila_sigs");
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeSessionSigMap(obj) {
  try {
    sessionStorage.setItem("gp_gorila_sigs", JSON.stringify(obj || {}));
  } catch {}
}

/* ---------------------------
   Web Audio API
--------------------------- */
let audioCtx = null;
let audioBuffer = null;
let audioUnlocked = false;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function loadBuffer() {
  if (audioBuffer) return audioBuffer;
  const ctx = getAudioContext();
  try {
    const res = await fetch(GORILA_SOUND_URL);
    const arr = await res.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arr);
  } catch {
    audioBuffer = null;
  }
  return audioBuffer;
}

function getAudioElement() {
  if (audioEl) return audioEl;
  const a = new Audio(GORILA_SOUND_URL);
  a.preload = "auto";
  a.volume = 1;
  audioEl = a;
  return audioEl;
}

/**
 * Desbloquear audio en iOS/móvil — llamar desde un gesto del usuario.
 * App.jsx ya lo llama en pointerdown/keydown.
 */
export async function unlockGorilaAudio() {
  if (audioUnlocked) return true;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    await loadBuffer();

    // Desbloquear Audio element como fallback
    const a = getAudioElement();
    a.currentTime = 0;
    const p = a.play();
    if (p) {
      await p.catch(() => {});
      a.pause();
      a.currentTime = 0;
    }
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Reproducir sonido gorila N veces.
 * Intenta Web Audio API primero (más permisivo en móvil),
 * cae a Audio element si falla.
 */
export async function playGorila(times = 1, gapMs = 320) {
  const n = Math.max(1, Number(times) || 1);

  // Intentar con Web Audio API
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const buf = await loadBuffer();
    if (buf) {
      for (let i = 0; i < n; i++) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        await new Promise(r => setTimeout(r, gapMs + (buf.duration * 1000 || 0)));
      }
      return;
    }
  } catch {}

  // Fallback a Audio element
  for (let i = 0; i < n; i++) {
    try {
      const a = getAudioElement();
      a.currentTime = 0;
      await a.play();
    } catch {
      break;
    }
    await new Promise(r => setTimeout(r, gapMs));
  }
}

/* ---------------------------
   Timers para fin de partido/clase
--------------------------- */
function scheduleAt(ms, fn) {
  const delay = ms - Date.now();
  if (!Number.isFinite(delay)) return null;
  if (delay <= 0) return null;
  return setTimeout(fn, delay);
}

/**
 * Programa avisos de sonido:
 * - warnBeforeMs antes del fin: warn5MinTimes veces
 * - al acabar: endTimes veces
 */
export function scheduleEndWarningsForEvent({
  key,
  endMs,
  warnBeforeMs = 5 * 60 * 1000,
  warn5MinTimes = 2,
  endTimes = 4,
} = {}) {
  if (!key) return;
  if (!Number.isFinite(endMs)) return;

  const now = Date.now();
  if (endMs <= now) return;

  const sig = `${key}@${endMs}@${warn5MinTimes}@${endTimes}`;

  const prev = scheduled.get(key);
  if (prev?.sig === sig) return;

  const sigMap = readSessionSigMap();
  if (sigMap[key] === sig) {
    scheduled.set(key, { sig, t1: null, t2: null });
    return;
  }

  if (prev) {
    try {
      if (prev.t1) clearTimeout(prev.t1);
      if (prev.t2) clearTimeout(prev.t2);
    } catch {}
  }

  const warnMs = endMs - warnBeforeMs;

  const t1 = scheduleAt(warnMs, async () => {
    await playGorila(warn5MinTimes);
  });

  const t2 = scheduleAt(endMs, async () => {
    await playGorila(endTimes);
  });

  scheduled.set(key, { sig, t1, t2 });
  sigMap[key] = sig;
  writeSessionSigMap(sigMap);
}

/**
 * Cancela timers por predicado
 */
export function unscheduleEventWarnings(predicateFn) {
  if (typeof predicateFn !== "function") return;

  const sigMap = readSessionSigMap();

  for (const [key, entry] of scheduled.entries()) {
    try {
      if (!predicateFn(key)) continue;
      if (entry?.t1) clearTimeout(entry.t1);
      if (entry?.t2) clearTimeout(entry.t2);
      scheduled.delete(key);
    } catch {}
  }

  writeSessionSigMap(sigMap);
}

/**
 * COMPAT: clearGorilaTimers() -> limpia todo
 * clearGorilaTimers("class:") -> limpia clases
 * clearGorilaTimers("match:") -> limpia partidos
 */
export function clearGorilaTimers(prefix = "") {
  const p = String(prefix || "");
  unscheduleEventWarnings((key) => (p ? key.startsWith(p) : true));
}

/**
 * COMPAT: ClassesPage usa esto.
 * endAtIso: ISO de final, classId opcional
 */
export function scheduleGorilaForEnd(endAtIso, classId = "") {
  const endMs = new Date(String(endAtIso || "")).getTime();
  if (!Number.isFinite(endMs)) return;

  const key = classId ? `class:${String(classId)}` : "class:active";

  scheduleEndWarningsForEvent({
    key,
    endMs,
    warn5MinTimes: 2,
    endTimes: 4,
  });
}