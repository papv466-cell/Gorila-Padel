// src/utils/dates.js

/**
 * Convierte Date a formato YYYY-MM-DD
 */
 export function toISODate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
  
  /**
   * Convierte Date a formato HH:MM
   */
  export function toISOTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[1].slice(0, 5);
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
   * Combina fecha (YYYY-MM-DD) y hora (HH:MM) en ISO string
   */
  export function combineDateTime(date, time) {
    if (!date || !time) return null;
    return `${date}T${time}:00`;
  }
  
  /**
   * Formatea fecha para mostrar al usuario
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