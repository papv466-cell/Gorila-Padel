// src/services/gorilaSound.js
// Sonidos + timers (5 min antes y fin). Evita duplicados y no rompe nada.

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
   Audio
--------------------------- */
function getAudio() {
  if (audioEl) return audioEl;

  // ✅ Ruta final: public/sounds/gorila.mp3 -> /sounds/gorila.mp3
  const a = new Audio("/sounds/gorila.mp3");
  a.preload = "auto";
  a.volume = 1;

  audioEl = a;
  return audioEl;
}

// Para iOS / móviles (necesitan gesto)
export async function unlockGorilaAudio() {
  try {
    const a = getAudio();
    a.currentTime = 0;
    await a.play();
    a.pause();
    a.currentTime = 0;
    return true;
  } catch {
    return false;
  }
}

export async function playGorila(times = 1, gapMs = 320) {
  const n = Math.max(1, Number(times) || 1);

  for (let i = 0; i < n; i++) {
    try {
      const a = getAudio();
      a.currentTime = 0;
      // eslint-disable-next-line no-await-in-loop
      await a.play();
    } catch {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, gapMs));
  }
}

/* ---------------------------
   Timers
--------------------------- */
function scheduleAt(ms, fn) {
  const delay = ms - Date.now();
  if (!Number.isFinite(delay)) return null;
  if (delay <= 0) return null;
  return setTimeout(fn, delay);
}

/**
 * Programa:
 * - 5 min antes: warn5MinTimes (default 2)
 * - fin: endTimes (default 4)
 *
 * key: string única del evento (ej: "match:<id>", "class:<id>")
 * endMs: timestamp final en ms
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
    // ya programado en esta sesión (evita duplicados al re-montar)
    scheduled.set(key, { sig, t1: null, t2: null });
    return;
  }

  // limpia anterior si era distinto
  if (prev) {
    try {
      if (prev.t1) clearTimeout(prev.t1);
      if (prev.t2) clearTimeout(prev.t2);
    } catch {}
  }

  const warnMs = endMs - warnBeforeMs;

  const t1 = scheduleAt(warnMs, async () => {
    await playGorila(warn5MinTimes); // 2
  });

  const t2 = scheduleAt(endMs, async () => {
    await playGorila(endTimes); // 4
  });

  scheduled.set(key, { sig, t1, t2 });
  sigMap[key] = sig;
  writeSessionSigMap(sigMap);
}

/**
 * Quita timers por predicado
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

      // Pro: dejamos la firma para evitar duplicados si vuelves a montar
      // (si quieres reprogramar en la misma sesión, habría que borrar sigMap[key])
    } catch {}
  }

  writeSessionSigMap(sigMap);
}

/**
 * ✅ COMPAT: ClassesPage está usando esto.
 * - clearGorilaTimers() -> limpia todo
 * - clearGorilaTimers("class:") -> limpia clases
 * - clearGorilaTimers("match:") -> limpia partidos
 */
export function clearGorilaTimers(prefix = "") {
  const p = String(prefix || "");
  unscheduleEventWarnings((key) => (p ? key.startsWith(p) : true));
}

/**
 * ✅ COMPAT: ClassesPage está usando esto.
 * Tu ClassesPage llama: scheduleGorilaForEnd(end_at)
 *
 * - endAtIso: ISO de final (ej "2026-02-02T10:00:00.000Z")
 * - classId opcional para usar key única (mejor)
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
