// src/utils/rateLimit.js

/**
 * Rate limiter simple en memoria
 * Evita que un usuario haga spam de acciones
 */

 const rateLimits = new Map();

 /**
  * Limita la cantidad de llamadas que se pueden hacer
  * @param {string} key - Identificador único (ej: "chat:userId")
  * @param {number} maxCalls - Máximo de llamadas permitidas
  * @param {number} windowMs - Ventana de tiempo en milisegundos
  * @throws {Error} Si se excede el límite
  */
 export function rateLimit(key, maxCalls = 5, windowMs = 60000) {
   const now = Date.now();
   const record = rateLimits.get(key) || { 
     count: 0, 
     resetAt: now + windowMs 
   };
   
   // Si pasó el tiempo, resetear contador
   if (now > record.resetAt) {
     record.count = 0;
     record.resetAt = now + windowMs;
   }
   
   // Si excede el límite, lanzar error
   if (record.count >= maxCalls) {
     const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
     throw new Error(
       `Demasiados intentos. Espera ${waitSeconds} segundos.`
     );
   }
   
   // Incrementar contador
   record.count++;
   rateLimits.set(key, record);
 }
 
 /**
  * Limpia registros antiguos (llamar cada 5 minutos)
  */
 export function cleanupRateLimits() {
   const now = Date.now();
   for (const [key, record] of rateLimits.entries()) {
     if (now > record.resetAt) {
       rateLimits.delete(key);
     }
   }
 }
 
 // Auto-limpieza cada 5 minutos
 if (typeof window !== 'undefined') {
   setInterval(cleanupRateLimits, 5 * 60 * 1000);
 }