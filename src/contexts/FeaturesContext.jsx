// src/contexts/FeaturesContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

const FeaturesContext = createContext({});

export function FeaturesProvider({ children }) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    const { data } = await supabase.from("app_features").select("key, enabled");
    if (data) {
      const map = {};
      data.forEach(f => { map[f.key] = f.enabled; });
      setFeatures(map);
    }
    setLoading(false);
  }

  function isEnabled(key) {
    if (loading) return true; // mientras carga, mostrar todo
    return features[key] !== false;
  }

  return (
    <FeaturesContext.Provider value={{ features, isEnabled, loadFeatures }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
