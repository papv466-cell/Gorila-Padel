// src/services/xp.js
import { supabase } from "./supabaseClient";

// ─── DEFINICIÓN DE XP ───────────────────────────────────────────────
export const XP_RULES = {
  match_played:       20,   // jugar cualquier partido
  match_won:          15,   // ganar un partido
  match_created:      10,   // crear un partido
  inclusive_played:   30,   // partido inclusivo (Gorila Sin Límites)
  streak_7:           50,   // racha de 7 días
  streak_30:         200,   // racha de 30 días
  first_match:        50,   // primer partido ever
  rating_given:        5,   // valorar a un compañero
  gorilandia_post:     5,   // publicar en Gorilandia
};

// ─── DEFINICIÓN DE LOGROS ────────────────────────────────────────────
export const ACHIEVEMENTS = [
  // Partidos jugados
  { key: "first_match",        label: "Primer partido",         emoji: "🎾", desc: "Jugaste tu primer partido",                xp: 50  },
  { key: "matches_10",         label: "10 partidos",            emoji: "🦍", desc: "Jugaste 10 partidos",                      xp: 100 },
  { key: "matches_50",         label: "50 partidos",            emoji: "💪", desc: "Jugaste 50 partidos",                      xp: 300 },
  { key: "matches_100",        label: "Centenario",             emoji: "💯", desc: "100 partidos jugados",                     xp: 500 },
  // Victorias
  { key: "first_win",          label: "Primera victoria",       emoji: "🏆", desc: "Ganaste tu primer partido",                xp: 30  },
  { key: "wins_10",            label: "10 victorias",           emoji: "🥇", desc: "10 victorias acumuladas",                  xp: 150 },
  { key: "wins_streak_5",      label: "Racha de 5 victorias",   emoji: "🔥", desc: "5 victorias consecutivas",                 xp: 200 },
  // Rachas de actividad
  { key: "streak_7",           label: "Semana activa",          emoji: "📅", desc: "7 días seguidos jugando",                  xp: 50  },
  { key: "streak_30",          label: "Mes activo",             emoji: "🗓️", desc: "30 días seguidos jugando",                 xp: 200 },
  // Gorila Sin Límites
  { key: "inclusive_1",        label: "Gorila Inclusivo",       emoji: "♿", desc: "Jugaste tu primer partido inclusivo",      xp: 50  },
  { key: "inclusive_10",       label: "Campeón Inclusivo",      emoji: "🏅", desc: "10 partidos inclusivos jugados",           xp: 200 },
  // Social
  { key: "creator_5",          label: "Organizador",            emoji: "📋", desc: "Creaste 5 partidos",                       xp: 75  },
  { key: "rated_10",           label: "Buen compañero",         emoji: "⭐", desc: "Valoraste a 10 compañeros",                xp: 50  },
  // Madrugador
  { key: "early_bird",         label: "Madrugador",             emoji: "🌅", desc: "Jugaste un partido antes de las 9:00",     xp: 30  },
  // Nivel
  { key: "level_gorila",       label: "Gorila de verdad",       emoji: "🦍", desc: "Alcanzaste 1000 XP",                      xp: 0   },
];

// ─── NIVELES ─────────────────────────────────────────────────────────
export const XP_LEVELS = [
  { level: 1, label: "Novato",        minXp: 0    },
  { level: 2, label: "Aficionado",    minXp: 100  },
  { level: 3, label: "Jugador",       minXp: 300  },
  { level: 4, label: "Competidor",    minXp: 600  },
  { level: 5, label: "Veterano",      minXp: 1000 },
  { level: 6, label: "Élite",         minXp: 1500 },
  { level: 7, label: "Gorila",        minXp: 2500 },
  { level: 8, label: "Gorila Élite",  minXp: 4000 },
  { level: 9, label: "Leyenda",       minXp: 6000 },
];

export function getLevelFromXp(xp) {
  let current = XP_LEVELS[0];
  for (const lvl of XP_LEVELS) {
    if (xp >= lvl.minXp) current = lvl;
    else break;
  }
  const nextIdx = XP_LEVELS.indexOf(current) + 1;
  const next = XP_LEVELS[nextIdx] || null;
  const progress = next
    ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100)
    : 100;
  return { ...current, next, progress, xp };
}

// ─── AÑADIR XP ───────────────────────────────────────────────────────
export async function addXp(userId, amount, reason, refId = null) {
  // 1) Insertar evento
  await supabase.from("xp_events").insert({
    user_id: userId,
    xp: amount,
    reason,
    ref_id: refId,
  });

  // 2) Sumar al perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", userId)
    .single();

  const newXp = (profile?.xp || 0) + amount;
  await supabase.from("profiles").update({ xp: newXp }).eq("id", userId);

  return newXp;
}

// ─── DESBLOQUEAR LOGRO ───────────────────────────────────────────────
export async function unlockAchievement(userId, achievementKey) {
  const achievement = ACHIEVEMENTS.find(a => a.key === achievementKey);
  if (!achievement) return null;

  const { error } = await supabase.from("user_achievements").insert({
    user_id: userId,
    achievement_key: achievementKey,
  });

  // Si ya existe (UNIQUE constraint) no hacer nada
  if (error?.code === "23505") return null;
  if (error) return null;

  // Dar XP por el logro
  if (achievement.xp > 0) {
    await addXp(userId, achievement.xp, `achievement_${achievementKey}`);
  }

  return achievement;
}

// ─── ACTUALIZAR RACHA ────────────────────────────────────────────────
export async function updateStreak(userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_days, streak_last_date")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const today = new Date().toISOString().split("T")[0];
  const last = profile.streak_last_date;

  if (last === today) return; // ya se contó hoy

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const isConsecutive = last === yesterday;

  const newStreak = isConsecutive ? (profile.streak_days || 0) + 1 : 1;

  await supabase.from("profiles").update({
    streak_days: newStreak,
    streak_last_date: today,
  }).eq("id", userId);

  // Logros de racha
  if (newStreak === 7) {
    await unlockAchievement(userId, "streak_7");
    await addXp(userId, XP_RULES.streak_7, "streak_7");
  }
  if (newStreak === 30) {
    await unlockAchievement(userId, "streak_30");
    await addXp(userId, XP_RULES.streak_30, "streak_30");
  }

  return newStreak;
}

// ─── PROCESAR PARTIDO JUGADO ─────────────────────────────────────────
// Llamar desde PostMatchModal después de guardar
export async function processMatchXp({ userId, matchId, won, isInclusive, isCreator, matchStartAt }) {
  const newAchievements = [];

  // XP base por jugar
  await addXp(userId, XP_RULES.match_played, "match_played", matchId);

  // XP por ganar
  if (won) await addXp(userId, XP_RULES.match_won, "match_won", matchId);

  // XP extra por partido inclusivo
  if (isInclusive) await addXp(userId, XP_RULES.inclusive_played, "inclusive_played", matchId);

  // XP por crear
  if (isCreator) await addXp(userId, XP_RULES.match_created, "match_created", matchId);

  // Actualizar racha
  await updateStreak(userId);

  // Contar partidos totales para logros
  const { count: totalMatches } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("player_uuid", userId);

  if (totalMatches === 1) {
    const a = await unlockAchievement(userId, "first_match");
    if (a) newAchievements.push(a);
  }
  if (totalMatches === 10) {
    const a = await unlockAchievement(userId, "matches_10");
    if (a) newAchievements.push(a);
  }
  if (totalMatches === 50) {
    const a = await unlockAchievement(userId, "matches_50");
    if (a) newAchievements.push(a);
  }
  if (totalMatches === 100) {
    const a = await unlockAchievement(userId, "matches_100");
    if (a) newAchievements.push(a);
  }

  // Logro primera victoria
  if (won) {
    const { count: totalWins } = await supabase
      .from("match_results")
      .select("*", { count: "exact", head: true })
      .eq("submitted_by", userId);
    if (totalWins === 1) {
      const a = await unlockAchievement(userId, "first_win");
      if (a) newAchievements.push(a);
    }
  }

  // Logro madrugador
  if (matchStartAt) {
    const hour = new Date(matchStartAt).getHours();
    if (hour < 9) {
      const a = await unlockAchievement(userId, "early_bird");
      if (a) newAchievements.push(a);
    }
  }

  // Logros inclusivos
  if (isInclusive) {
    const { count: inclCount } = await supabase
      .from("inclusive_matches")
      .select("*", { count: "exact", head: true })
      .contains("players", [userId]);
    if (inclCount === 1) {
      const a = await unlockAchievement(userId, "inclusive_1");
      if (a) newAchievements.push(a);
    }
    if (inclCount === 10) {
      const a = await unlockAchievement(userId, "inclusive_10");
      if (a) newAchievements.push(a);
    }
  }

  // Logro nivel gorila (1000 XP)
  const { data: updatedProfile } = await supabase
    .from("profiles").select("xp").eq("id", userId).single();
  if ((updatedProfile?.xp || 0) >= 1000) {
    const a = await unlockAchievement(userId, "level_gorila");
    if (a) newAchievements.push(a);
  }

  return { newAchievements };
}

// ─── CARGAR STATS DE UN USUARIO ──────────────────────────────────────
export async function loadUserStats(userId) {
  const [profileRes, achievementsRes, xpEventsRes] = await Promise.all([
    supabase.from("profiles").select("xp, streak_days, streak_last_date").eq("id", userId).single(),
    supabase.from("user_achievements").select("achievement_key, unlocked_at").eq("user_id", userId),
    supabase.from("xp_events").select("xp, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);

  const profile = profileRes.data || {};
  const xp = profile.xp || 0;
  const levelInfo = getLevelFromXp(xp);

  return {
    xp,
    levelInfo,
    streak_days: profile.streak_days || 0,
    streak_last_date: profile.streak_last_date,
    achievements: achievementsRes.data || [],
    recentXpEvents: xpEventsRes.data || [],
  };
}