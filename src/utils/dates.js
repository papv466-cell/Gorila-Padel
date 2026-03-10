// src/utils/dates.js

/**
 * Convierte Date a formato YYYY-MM-DD en hora LOCAL (no UTC)
 */
export function toISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convierte Date a formato HH:MM en hora LOCAL (no UTC)
 */
export function toISOTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Parsea string a Date de forma segura
 */
export function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Combina fecha (YYYY-MM-DD) y hora (HH:MM) en ISO string LOCAL
 * No añade zona horaria — se interpreta como hora local del navegador
 */
export function combineDateTime(date, time) {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

/**
 * Formatea fecha para mostrar al usuario en español
 */
export function formatDate(date, options = {}) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    ...options
  });
}

/**
 * Verifica si una fecha es futura
 */
export function isFutureDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() > Date.now();
}
