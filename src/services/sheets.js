// src/services/sheets.js

/**
 * Obtiene clubs desde Google Sheets
 * Ahora usa un endpoint seguro en vez de llamar directamente
 */

 const CACHE_KEY = 'gp:clubs';
 const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 horas
 /**
 * Obtiene clubs desde Google Sheets
 * Ahora usa un endpoint seguro en vez de llamar directamente
 */
 export async function fetchClubsFromGoogleSheet() {
   // Primero intentar cargar desde cache
   try {
     const cached = localStorage.getItem(CACHE_KEY);
     
     if (cached) {
       const { data, timestamp } = JSON.parse(cached);
       
       // Si el cache no ha expirado, usarlo
       if (Date.now() - timestamp < CACHE_TTL) {
         console.log('📦 Clubs cargados desde cache');
         return parseSheetData(data);
       }
     }
   } catch (e) {
     console.warn('Error leyendo cache:', e);
   }
 
   // Si no hay cache válido, llamar al endpoint seguro
   try {
     console.log('🌐 Cargando clubs desde servidor...');
     
     // CAMBIO CRÍTICO: Ahora llama a TU endpoint, no a Google directamente
     const response = await fetch('/api/google-sheets');
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }
     
     const data = await response.json();
     
     // Guardar en cache
     try {
       localStorage.setItem(CACHE_KEY, JSON.stringify({
         data,
         timestamp: Date.now()
       }));
     } catch (e) {
       console.warn('Error guardando cache:', e);
     }
     
     return parseSheetData(data);
     
   } catch (e) {
     console.error('[FETCH_CLUBS_ERROR]', e);
     throw new Error('No se pudieron cargar los clubs');
   }
 }
 
 /**
  * Convierte datos de Google Sheets a formato usable
  */
 function parseSheetData(sheetData) {
   const rows = sheetData?.values || [];
   
   if (rows.length === 0) return [];
   
   // Primera fila son los headers
   const headers = rows[0];
   const clubs = [];
   
   // Resto de filas son los datos
   for (let i = 1; i < rows.length; i++) {
     const row = rows[i];
     
     // Saltar filas vacías
     if (!row || row.length === 0) continue;
     
     const club = {};
     
     headers.forEach((header, idx) => {
       club[header.toLowerCase().trim()] = row[idx] || '';
     });
     
     // Validar que tenga al menos nombre y coordenadas
     if (club.name && club.lat && club.lng) {
       clubs.push({
         id: club.id || `club-${i}`,
         name: club.name,
         city: club.city || '',
         lat: parseFloat(club.lat),
         lng: parseFloat(club.lng),
       });
     }
   }
   
   return clubs;
 }
 
 /**
  * Limpia el cache (útil para testing)
  */
 export function clearClubsCache() {
   try {
     localStorage.removeItem(CACHE_KEY);
     console.log('✅ Cache de clubs limpiado');
   } catch (e) {
     console.warn('Error limpiando cache:', e);
   }
 }