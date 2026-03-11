// src/services/sheets.js
import { supabase } from "./supabaseClient";

const CACHE_KEY = 'gp:clubs';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

export async function fetchClubsFromGoogleSheet() {
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;
      
      if (!isExpired && data && data.length > 0) {
        return data;
      } else {
      }
    } else {
    }
    const response = await fetch('/api/google-sheets');
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const clubs = parseSheetData(data);

    if (clubs.length > 0) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: clubs, timestamp: Date.now() })
      );
    }

    return clubs;

  } catch (error) {
    console.error('❌ Error al cargar clubs:', error);
    console.error('❌ Detalles del error:', error.message);
    console.error('❌ Stack:', error.stack);
    
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      console.warn('⚠️ Usando cache antiguo como fallback');
      const { data } = JSON.parse(cached);
      return data || [];
    }
    
    return [];
  }
}

function parseSheetData(data) {
  
  if (!data || !data.values || data.values.length < 2) {
    console.error('❌ Datos inválidos');
    return [];
  }

  const [headers, ...rows] = data.values;

  const clubs = rows
    .map((row) => {
      const club = {};
      headers.forEach((header, i) => {
        const normalizedHeader = header
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[áàâä]/g, 'a')
          .replace(/[éèêë]/g, 'e')
          .replace(/[íìîï]/g, 'i')
          .replace(/[óòôö]/g, 'o')
          .replace(/[úùûü]/g, 'u');
        
        club[normalizedHeader] = row[i] || '';
      });
      
      if (club.lat) club.lat = parseFloat(club.lat);
      if (club.lon) club.lon = parseFloat(club.lon);
      club.lng = club.lon;
      club.urlimagen = club.urlimagen || club.imagen || '';
      
      return club;
    })
    .filter(club => club.name && club.lat && club.lon);
  if (clubs.length > 0) {
  }
  return clubs;
}

export function clearClubsCache() {
  localStorage.removeItem(CACHE_KEY);
}

if (typeof window !== 'undefined') {
  window.clearClubsCache = clearClubsCache;
}

// Cargar clubs desde Supabase (reemplaza Google Sheets)
export async function fetchClubsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("active", true)
      .eq("status", "approved")
      .order("name");
    if (error) throw error;
    return (data || []).map(c => ({
      ...c,
      lng: c.lon,
      urlimagen: c.urlimagen || "",
    }));
  } catch (e) {
    console.error("Error cargando clubs desde Supabase:", e);
    return [];
  }
}
