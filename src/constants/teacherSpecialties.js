// src/constants/teacherSpecialties.js

export const CERT_LEVELS = [
  { key: "monitor_fep",     label: "Monitor FEP (Nivel 1)",            emoji: "📋" },
  { key: "entrenador_fep",  label: "Entrenador FEP (Nivel 2)",         emoji: "🎓" },
  { key: "alto_rend_fep",   label: "Alto Rendimiento FEP (Nivel 3)",   emoji: "🏆" },
  { key: "fip_0",           label: "FIP Level 0",                      emoji: "🌐" },
  { key: "fip_1",           label: "FIP Level 1",                      emoji: "🌐" },
  { key: "fip_2",           label: "FIP Level 2+",                     emoji: "🌐" },
  { key: "sin_cert",        label: "Sin certificación (ex-jugador…)",  emoji: "🎾" },
];

export const AUDIENCE = [
  { key: "ninos_5_8",       label: "Niños 5–8 años",                   emoji: "🧒" },
  { key: "ninos_9_12",      label: "Niños 9–12 años",                  emoji: "👦" },
  { key: "adolescentes",    label: "Adolescentes 13–17",               emoji: "🧑" },
  { key: "adultos",         label: "Adultos 18–49",                    emoji: "🧑" },
  { key: "senior_50",       label: "Senior 50–65",                     emoji: "🧓" },
  { key: "senior_65plus",   label: "Senior 65+",                       emoji: "👴" },
  { key: "mujeres",         label: "Especializado en mujeres",         emoji: "👩" },
  { key: "alto_rendimiento",label: "Alto rendimiento / competición",   emoji: "🏅" },
];

export const PLAY_LEVELS = [
  { key: "iniciacion",      label: "Iniciación (0–1 año)",             emoji: "🌱" },
  { key: "basico",          label: "Básico (1–2 años)",                emoji: "📗" },
  { key: "intermedio",      label: "Intermedio",                       emoji: "📘" },
  { key: "avanzado",        label: "Avanzado",                         emoji: "📙" },
  { key: "competicion",     label: "Competición / Torneos",            emoji: "🏆" },
  { key: "profesional",     label: "Profesional / Elite",              emoji: "⭐" },
];

export const TECHNIQUE_SHOTS = [
  { key: "saque",           label: "Saque",                            emoji: "🎯" },
  { key: "drive",           label: "Drive (golpe de derecha)",         emoji: "➡️" },
  { key: "reves",           label: "Revés",                            emoji: "⬅️" },
  { key: "volea_der",       label: "Volea de derecha",                 emoji: "⚡" },
  { key: "volea_rev",       label: "Volea de revés",                   emoji: "⚡" },
  { key: "bandeja",         label: "Bandeja",                          emoji: "🎾" },
  { key: "vibora",          label: "Víbora",                           emoji: "🐍" },
  { key: "remate",          label: "Remate / Smash",                   emoji: "💥" },
  { key: "remate_x3",       label: "Remate por tres",                  emoji: "3️⃣" },
  { key: "remate_x4",       label: "Remate por cuatro",                emoji: "4️⃣" },
  { key: "globo",           label: "Globo (lob)",                      emoji: "🌐" },
  { key: "dejada",          label: "Dejada (drop shot)",               emoji: "🎭" },
  { key: "chiquita",        label: "Chiquita",                         emoji: "🔽" },
  { key: "gancho",          label: "Gancho",                           emoji: "🪝" },
  { key: "contrapared",     label: "Contrapared",                      emoji: "🧱" },
  { key: "salida_pared",    label: "Salida de pared",                  emoji: "↩️" },
  { key: "rulo",            label: "Rulo / Rueda",                     emoji: "🔄" },
  { key: "por_detras",      label: "Por detrás / Entre las piernas",   emoji: "🤸" },
];

export const TACTICS = [
  { key: "posicionamiento",  label: "Posicionamiento en pista",         emoji: "📍" },
  { key: "desplazamientos",  label: "Desplazamientos y movilidad",      emoji: "🏃" },
  { key: "subida_red",       label: "Subida a la red",                  emoji: "🆙" },
  { key: "juego_fondo",      label: "Juego desde el fondo",             emoji: "🔙" },
  { key: "defensa",          label: "Defensa (salidas de pared)",       emoji: "🛡️" },
  { key: "ataque",           label: "Construcción del ataque",          emoji: "⚔️" },
  { key: "transicion",       label: "Transición defensa-ataque",        emoji: "↔️" },
  { key: "juego_pared",      label: "Juego con las paredes",            emoji: "🏗️" },
  { key: "estrategia_pareja",label: "Estrategia en pareja",             emoji: "🤝" },
  { key: "lectura_juego",    label: "Lectura del juego / anticipación", emoji: "👁️" },
  { key: "cambio_ritmo",     label: "Cambio de ritmo y efecto",         emoji: "🎵" },
  { key: "tactica_torneos",  label: "Táctica en torneos",               emoji: "🏆" },
  { key: "saque_resto",      label: "Táctica de saque y resto",         emoji: "🔄" },
];

export const PHYSICAL = [
  { key: "fuerza",           label: "Fuerza y potencia",                emoji: "💪" },
  { key: "velocidad",        label: "Velocidad y explosividad",         emoji: "⚡" },
  { key: "resistencia",      label: "Resistencia / fondo físico",       emoji: "🫀" },
  { key: "agilidad",         label: "Agilidad y coordinación",          emoji: "🤸" },
  { key: "flexibilidad",     label: "Flexibilidad y movilidad",         emoji: "🧘" },
  { key: "prevencion",       label: "Prevención de lesiones",           emoji: "🩺" },
  { key: "rehabilitacion",   label: "Rehabilitación deportiva",         emoji: "🔧" },
  { key: "psicologia",       label: "Psicología deportiva",             emoji: "🧠" },
];

export const INCLUSION = [
  { key: "silla_ruedas",     label: "Silla de ruedas (pádel adaptado)", emoji: "♿",  color: "#3B82F6" },
  { key: "baja_vision",      label: "Ceguera / baja visión",            emoji: "🦯",  color: "#8B5CF6" },
  { key: "sordera",          label: "Sordera / baja audición",          emoji: "🦻",  color: "#6366F1" },
  { key: "down",             label: "Síndrome de Down",                 emoji: "💙",  color: "#EC4899" },
  { key: "tea",              label: "TEA (autismo)",                    emoji: "🧩",  color: "#F59E0B" },
  { key: "tdah",             label: "TDAH",                             emoji: "⚡",  color: "#F97316" },
  { key: "disc_intelectual", label: "Discapacidad intelectual",         emoji: "🌟",  color: "#10B981" },
  { key: "movilidad_red",    label: "Movilidad reducida (sin silla)",   emoji: "🚶",  color: "#64748B" },
  { key: "lesion_retorno",   label: "Vuelta tras lesión",               emoji: "❤️",  color: "#EF4444" },
  { key: "ritmo_suave",      label: "Ritmo suave / baja intensidad",    emoji: "🐢",  color: "#84CC16" },
  { key: "mixto_inclusivo",  label: "Clases mixtas (con/sin diversidad)",emoji: "🤝", color: "#74B800" },
];

export const CLASS_FORMATS = [
  { key: "individual",       label: "Individual (1:1)",                 emoji: "👤" },
  { key: "parejas",          label: "Para 2 alumnos",                   emoji: "👥" },
  { key: "grupo_3_4",        label: "Grupo pequeño 3-4",                emoji: "👨‍👩‍👦" },
  { key: "grupo_5plus",      label: "Grupo grande 5+",                  emoji: "👨‍👩‍👧‍👦" },
  { key: "clinica",          label: "Clínica / Taller intensivo",       emoji: "🎪" },
  { key: "campus",           label: "Campus / Tecnificación",           emoji: "🏕️" },
  { key: "online",           label: "Online / Videoanálisis",           emoji: "💻" },
];

export const METHODOLOGY = [
  { key: "tecnica_pura",     label: "Técnica pura",                     emoji: "🔬" },
  { key: "tactica_pura",     label: "Táctica y estrategia",             emoji: "🗺️" },
  { key: "fisico_padel",     label: "Físico integrado con pádel",       emoji: "🏋️" },
  { key: "match_play",       label: "Juego real (match play)",          emoji: "🎮" },
  { key: "basket_feed",      label: "Canasto / Basket feed",            emoji: "🧺" },
  { key: "multiball",        label: "Multibola",                        emoji: "🎯" },
  { key: "videoanalisis",    label: "Videoanálisis",                    emoji: "🎬" },
  { key: "biomecanica",      label: "Biomecánica del gesto",            emoji: "⚙️" },
];

export const ALL_SPECIALTY_CATEGORIES = [
  { id: "cert",        label: "🎓 Certificación oficial",           items: CERT_LEVELS },
  { id: "audience",    label: "👥 Público objetivo",                items: AUDIENCE },
  { id: "level",       label: "📊 Nivel de juego",                  items: PLAY_LEVELS },
  { id: "shots",       label: "🎾 Técnica — Golpes específicos",     items: TECHNIQUE_SHOTS },
  { id: "tactics",     label: "♟️ Táctica y posicionamiento",        items: TACTICS },
  { id: "physical",    label: "💪 Preparación física",               items: PHYSICAL },
  { id: "inclusion",   label: "♿ Inclusión / Diversidad funcional",  items: INCLUSION },
  { id: "formats",     label: "📋 Formato de clase",                 items: CLASS_FORMATS },
  { id: "methodology", label: "🔧 Metodología",                      items: METHODOLOGY },
];

export function getSpecialtyInfo(key) {
  for (const cat of ALL_SPECIALTY_CATEGORIES) {
    const found = cat.items.find(i => i.key === key);
    if (found) return { ...found, category: cat.id, categoryLabel: cat.label };
  }
  return { key, label: key, emoji: "🎾", category: "unknown", categoryLabel: "Otro" };
}

export function groupSpecialtiesByCategory(keys = []) {
  const result = {};
  for (const key of keys) {
    const info = getSpecialtyInfo(key);
    if (!result[info.category]) result[info.category] = { label: info.categoryLabel, items: [] };
    result[info.category].items.push(info);
  }
  return result;
}

export function specialtiesToSearchText(keys = []) {
  return keys.map(k => {
    const info = getSpecialtyInfo(k);
    return info.label + " " + info.categoryLabel;
  }).join(" ").toLowerCase();
}
