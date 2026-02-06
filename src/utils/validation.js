// src/utils/validation.js

/**
 * Limpia y valida strings para evitar inyecciones
 */
 export function sanitizeString(str, maxLength = 255) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
  }
  
  /**
   * Valida que un nivel sea válido
   */
  export function validateLevel(level) {
    const validLevels = ['Principiante', 'Intermedio', 'Avanzado'];
    return validLevels.includes(level) ? level : 'Intermedio';
  }
  
  /**
   * Valida duración (entre 30 y 180 minutos)
   */
  export function validateDuration(duration) {
    const num = parseInt(duration);
    if (isNaN(num)) return 60;
    return Math.max(30, Math.min(180, num));
  }
  
  /**
   * Valida número de jugadores (entre 2 y 8)
   */
  export function validatePlayers(players) {
    const num = parseInt(players);
    if (isNaN(num)) return 4;
    return Math.max(2, Math.min(8, num));
  }
  
  /**
   * Valida email
   */
  export function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  /**
   * Valida teléfono español
   */
  export function isValidPhone(phone) {
    const cleaned = phone.replace(/\s/g, '');
    const regex = /^(\+34|0034|34)?[6789]\d{8}$/;
    return regex.test(cleaned);
  }