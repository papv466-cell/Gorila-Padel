// src/hooks/useMatches.js
import { useState, useEffect, useCallback } from "react";
import { fetchMatches } from "../services/matches";

export function useMatches(filters = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchMatches(filters);
      setMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[LOAD_MATCHES_ERROR]', e);
      setError(e?.message || 'Error cargando partidos');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  return { 
    matches, 
    loading, 
    error, 
    refresh: loadMatches 
  };
}