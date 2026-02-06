// src/services/sheets.js

const CACHE_KEY = 'gp:clubs';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene clubs desde Google Sheets
 */
export async function fetchClubsFromGoogleSheet() {
  console.log('🌐 Cargando clubs desde servidor...');
  
  try {
    // Intentar obtener del cache primero
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      console.log('📦 Encontré cache, verificando validez...');
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;
      
      if (!isExpired && data && data.length > 0) {
        console.log('✅ Usando cache válido:', data.length, 'clubs');
        return data;
      } else {
        console.log('⏰ Cache expirado o vacío, obteniendo datos frescos...');
      }
    } else {
      console.log('📭 No hay cache, obteniendo datos frescos...');
    }

    // Obtener datos frescos del servidor
    console.log('🔄 Llamando a /api/google-sheets...');
    const response = await fetch('/api/google-sheets');
    
    console.log('📡 Respuesta recibida:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 Datos recibidos:', data);

    // Parsear los datos
    console.log('🔄 Parseando datos...');
    const clubs = parseSheetData(data);
    console.log('✅ Clubs parseados:', clubs.length);

    // Guardar en cache
    if (clubs.length > 0) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: clubs, timestamp: Date.now() })
      );
      console.log('💾 Cache guardado exitosamente');
    }

    return clubs;

  } catch (error) {
    console.error('❌ Error al cargar clubs:', error);
    console.error('❌ Detalles del error:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // Intentar usar cache viejo si hay error
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      console.warn('⚠️ Usando cache antiguo como fallback');
      const { data } = JSON.parse(cached);
      return data || [];
    }
    
    return [];
  }
}

/**
 * Parsea los datos de Google Sheets al formato de la app
 */
function parseSheetData(data) {
  console.log('🔍 Parseando datos de Google Sheets...');
  
  if (!data) {
    console.error('❌ No hay data');
    return [];
  }
  
  if (!data.values) {
    console.error('❌ data.values es undefined');
    return [];
  }
  
  if (data.values.length < 2) {
    console.error('❌ No hay suficientes filas:', data.values.length);
    return [];
  }

  const [headers, ...rows] = data.values;
  console.log('📋 Headers:', headers);
  console.log('📊 Número de filas:', rows.length);

  const clubs = rows
    .map((row, index) => {
      const club = {};
      headers.forEach((header, i) => {
        club[header] = row[i] || '';
      });
      
      // Convertir lat/lon a números
      if (club.lat) club.lat = parseFloat(club.lat);
      if (club.lon) club.lon = parseFloat(club.lon);
      // Añadir alias para compatibilidad
      club.lng = club.lon;
      
      return club;
    })
    .filter(club => {
      const isValid = club.name && club.lat && club.lon;
      if (!isValid) {
        console.warn('⚠️ Club sin datos completos:', club);
      }
      return isValid;
    });

  console.log('✅ Clubs válidos:', clubs.length);
  if (clubs.length > 0) {
    console.log('📋 Primer club:', clubs[0]);
  }
  return clubs;
}

/**
 * Limpia el cache de clubs
 */
export function clearClubsCache() {
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ Cache de clubs eliminado');
}

// Exponer función globalmente para debugging
if (typeof window !== 'undefined') {
  window.clearClubsCache = clearClubsCache;
}