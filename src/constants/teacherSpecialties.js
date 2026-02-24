// src/constants/teacherSpecialties.js
// ─────────────────────────────────────────────────────────────────────────────
// Especialidades de profesor — Gorila Pádel
// Cada especialidad tiene:
//   id        → clave única guardada en DB (teacher_public.specialties[])
//   label     → texto visible al usuario
//   emoji     → icono
//   category  → agrupación para filtros y UI
// ─────────────────────────────────────────────────────────────────────────────

export const SPECIALTY_CATEGORIES = [
  { key: "nivel",      label: "Nivel de juego",              emoji: "📊" },
  { key: "edad",       label: "Franja de edad",              emoji: "👶" },
  { key: "diversidad", label: "Diversidad funcional",        emoji: "♿" },
  { key: "tecnica",    label: "Técnica — golpes",            emoji: "🎾" },
  { key: "tactica",    label: "Táctica y posicionamiento",   emoji: "🧠" },
  { key: "fisico",     label: "Preparación física",          emoji: "💪" },
  { key: "formato",    label: "Formato de clase",            emoji: "👥" },
  { key: "modalidad",  label: "Modalidad",                   emoji: "🏆" },
];

export const SPECIALTIES = [

  // ── NIVEL DE JUEGO ──────────────────────────────────────────────────────────
  { id: "nivel_iniciacion",   label: "Iniciación (nivel 1–2)",         emoji: "🌱", category: "nivel" },
  { id: "nivel_basico",       label: "Básico (nivel 2–4)",             emoji: "📈", category: "nivel" },
  { id: "nivel_intermedio",   label: "Intermedio (nivel 4–6)",         emoji: "⚡", category: "nivel" },
  { id: "nivel_avanzado",     label: "Avanzado (nivel 6–8)",           emoji: "🔥", category: "nivel" },
  { id: "nivel_competicion",  label: "Competición / alto rendimiento", emoji: "🏆", category: "nivel" },

  // ── FRANJA DE EDAD ──────────────────────────────────────────────────────────
  { id: "edad_ninos",         label: "Niños (4–11 años)",              emoji: "🧒", category: "edad" },
  { id: "edad_adolescentes",  label: "Adolescentes (12–17 años)",      emoji: "🧑", category: "edad" },
  { id: "edad_jovenes",       label: "Jóvenes adultos (18–35 años)",   emoji: "👦", category: "edad" },
  { id: "edad_adultos",       label: "Adultos (35–60 años)",           emoji: "🧑‍💼", category: "edad" },
  { id: "edad_seniors",       label: "Seniors (+60 años)",             emoji: "👴", category: "edad" },
  { id: "edad_veteranos",     label: "Veteranos FEP (+45 competición)",emoji: "🎖️", category: "edad" },

  // ── DIVERSIDAD FUNCIONAL ────────────────────────────────────────────────────
  { id: "div_silla",          label: "Usuarios de silla de ruedas",    emoji: "♿", category: "diversidad" },
  { id: "div_invidente",      label: "Discapacidad visual / invidentes",emoji: "👁️", category: "diversidad" },
  { id: "div_hipoacusia",     label: "Hipoacusia / sordera",           emoji: "🦻", category: "diversidad" },
  { id: "div_down",           label: "Síndrome de Down",               emoji: "🤝", category: "diversidad" },
  { id: "div_tea",            label: "Trastorno del espectro autista (TEA)", emoji: "🧩", category: "diversidad" },
  { id: "div_tdah",           label: "TDAH",                           emoji: "🌀", category: "diversidad" },
  { id: "div_intelectual",    label: "Discapacidad intelectual",       emoji: "🌟", category: "diversidad" },
  { id: "div_amputacion",     label: "Amputación / miembro superior",  emoji: "🦾", category: "diversidad" },
  { id: "div_parkinson",      label: "Parkinson",                      emoji: "🧬", category: "diversidad" },
  { id: "div_paralisis",      label: "Parálisis cerebral",             emoji: "🫀", category: "diversidad" },
  { id: "div_lesion",         label: "Vuelta al deporte tras lesión",  emoji: "❤️‍🩹", category: "diversidad" },
  { id: "div_ritmo_lento",    label: "Ritmo suave / baja intensidad",  emoji: "🐢", category: "diversidad" },

  // ── TÉCNICA — GOLPES ────────────────────────────────────────────────────────
  { id: "tec_saque",          label: "Saque",                          emoji: "🎾", category: "tecnica" },
  { id: "tec_resto",          label: "Resto / devolución de saque",    emoji: "↩️", category: "tecnica" },
  { id: "tec_drive",          label: "Drive (golpe de derecha)",       emoji: "➡️", category: "tecnica" },
  { id: "tec_reves",          label: "Revés",                          emoji: "⬅️", category: "tecnica" },
  { id: "tec_volea",          label: "Volea",                          emoji: "🫳", category: "tecnica" },
  { id: "tec_volea_baja",     label: "Volea baja / bloqueo",           emoji: "⬇️", category: "tecnica" },
  { id: "tec_globo",          label: "Globo / Lob defensivo",          emoji: "🌐", category: "tecnica" },
  { id: "tec_globo_ofensivo", label: "Globo ofensivo (ataque)",        emoji: "🚀", category: "tecnica" },
  { id: "tec_bandeja",        label: "Bandeja",                        emoji: "🏓", category: "tecnica" },
  { id: "tec_vibora",         label: "Víbora",                         emoji: "🐍", category: "tecnica" },
  { id: "tec_smash",          label: "Smash / Remate",                 emoji: "💥", category: "tecnica" },
  { id: "tec_smash_x3",       label: "Remate ×3 / ×4",                emoji: "🔄", category: "tecnica" },
  { id: "tec_dejada",         label: "Dejada / Drop shot",             emoji: "🍂", category: "tecnica" },
  { id: "tec_chiquita",       label: "Chiquita",                       emoji: "🤏", category: "tecnica" },
  { id: "tec_salida_pared",   label: "Salida de pared (fondo y lateral)", emoji: "🧱", category: "tecnica" },
  { id: "tec_bajada_pared",   label: "Bajada de pared",                emoji: "📉", category: "tecnica" },
  { id: "tec_doble_pared",    label: "Doble pared",                    emoji: "🔀", category: "tecnica" },
  { id: "tec_contrapared",    label: "Contrapared",                    emoji: "🔙", category: "tecnica" },
  { id: "tec_rulo",           label: "Rulo (golpe a la reja)",         emoji: "🔁", category: "tecnica" },
  { id: "tec_liftado",        label: "Golpe con efecto liftado",       emoji: "🌀", category: "tecnica" },
  { id: "tec_cortado",        label: "Cortado / Slice",                emoji: "✂️", category: "tecnica" },

  // ── TÁCTICA Y POSICIONAMIENTO ────────────────────────────────────────────────
  { id: "tac_posicionamiento", label: "Posicionamiento en pista",      emoji: "📍", category: "tactica" },
  { id: "tac_movimiento",      label: "Movimiento y desplazamiento",   emoji: "🏃", category: "tactica" },
  { id: "tac_subida_red",      label: "Subida a la red",               emoji: "⬆️", category: "tactica" },
  { id: "tac_defensa_fondo",   label: "Defensa desde el fondo",        emoji: "🛡️", category: "tactica" },
  { id: "tac_ataque",          label: "Estrategia de ataque",          emoji: "⚔️", category: "tactica" },
  { id: "tac_pareja",          label: "Juego en pareja / comunicación",emoji: "🤝", category: "tactica" },
  { id: "tac_decision",        label: "Toma de decisiones bajo presión",emoji: "🎯", category: "tactica" },
  { id: "tac_ritmo",           label: "Control del ritmo de partido",  emoji: "⏱️", category: "tactica" },
  { id: "tac_variacion",       label: "Variación y sorpresa",          emoji: "🎭", category: "tactica" },
  { id: "tac_saque_estrategia",label: "Estrategia de saque y resto",   emoji: "♟️", category: "tactica" },
  { id: "tac_mental",          label: "Mentalidad competitiva",        emoji: "🧘", category: "tactica" },

  // ── PREPARACIÓN FÍSICA ───────────────────────────────────────────────────────
  { id: "fis_resistencia",    label: "Resistencia y cardio específico", emoji: "🫀", category: "fisico" },
  { id: "fis_velocidad",      label: "Velocidad y agilidad",           emoji: "⚡", category: "fisico" },
  { id: "fis_fuerza",         label: "Fuerza y potencia",              emoji: "💪", category: "fisico" },
  { id: "fis_flexibilidad",   label: "Flexibilidad y movilidad",       emoji: "🤸", category: "fisico" },
  { id: "fis_prevencion",     label: "Prevención de lesiones",         emoji: "🩹", category: "fisico" },
  { id: "fis_calentamiento",  label: "Calentamiento específico pádel", emoji: "🔥", category: "fisico" },

  // ── FORMATO DE CLASE ─────────────────────────────────────────────────────────
  { id: "fmt_individual",     label: "Individual (1:1)",               emoji: "👤", category: "formato" },
  { id: "fmt_pareja",         label: "Pareja (2 personas)",            emoji: "👫", category: "formato" },
  { id: "fmt_grupo_pequeno",  label: "Grupo pequeño (3–4 personas)",   emoji: "👥", category: "formato" },
  { id: "fmt_grupo",          label: "Clase grupal (5+ personas)",     emoji: "👨‍👩‍👧‍👦", category: "formato" },
  { id: "fmt_clinica",        label: "Clínica / Masterclass",          emoji: "🎓", category: "formato" },
  { id: "fmt_online",         label: "Online / análisis de vídeo",     emoji: "💻", category: "formato" },

  // ── MODALIDAD ────────────────────────────────────────────────────────────────
  { id: "mod_recreativo",     label: "Pádel recreativo / hobby",       emoji: "😎", category: "modalidad" },
  { id: "mod_competicion_fed",label: "Competición federada (FEP)",     emoji: "🏅", category: "modalidad" },
  { id: "mod_tecnificacion",  label: "Tecnificación / escuela de alto rendimiento", emoji: "🎯", category: "modalidad" },
  { id: "mod_rehabilitacion", label: "Pádel rehabilitador",            emoji: "🏥", category: "modalidad" },
  { id: "mod_inclusivo",      label: "Pádel inclusivo / adaptado",     emoji: "🌈", category: "modalidad" },
  { id: "mod_beach",          label: "Beach Padel",                    emoji: "🏖️", category: "modalidad" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Índice rápido id → objeto */
export const SPECIALTIES_BY_ID = Object.fromEntries(SPECIALTIES.map(s => [s.id, s]));

/** Agrupado por categoría (con items) */
export const SPECIALTIES_BY_CATEGORY = SPECIALTY_CATEGORIES.map(cat => ({
  ...cat,
  items: SPECIALTIES.filter(s => s.category === cat.key),
}));

/** Dado array de ids, devuelve objetos completos */
export function resolveSpecialties(ids = []) {
  return (ids || []).map(id => SPECIALTIES_BY_ID[id]).filter(Boolean);
}

/** Dado array de ids, devuelve true si incluye alguna especialidad de diversidad funcional */
export function hasInclusiveSpecialties(ids = []) {
  return (ids || []).some(id => String(id).startsWith("div_"));
}