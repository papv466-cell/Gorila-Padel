// src/contexts/SportContext.jsx
import { createContext, useContext, useState } from "react";

const SportContext = createContext({});

export const SPORTS = {
  padel: {
    key: "padel",
    label: "Pádel",
    emoji: "🎾",
    color: "#2ECC71",
    players: 4,
    duration: 90,
    levels: ["iniciación", "medio", "avanzado", "competición"],
    description: "2 vs 2 en pista cerrada con paredes",
    sets: "Al mejor de 3 sets (6 juegos)",
    scoring: "Juegos, sets y partidos estándar",
  },
  tenis: {
    key: "tenis",
    label: "Tenis",
    emoji: "🎾",
    color: "#F39C12",
    players: 2,
    duration: 90,
    levels: ["iniciación", "medio", "avanzado", "competición"],
    description: "Individual o dobles en pista abierta",
    sets: "Al mejor de 3 o 5 sets",
    scoring: "15-30-40, juegos, sets y partidos",
    formats: ["singles", "dobles"],
  },
  pickleball: {
    key: "pickleball",
    label: "Pickleball",
    emoji: "🏓",
    color: "#3498DB",
    players: 4,
    duration: 60,
    levels: ["iniciación", "medio", "avanzado"],
    description: "2 vs 2 en pista pequeña con pala sólida",
    sets: "Al mejor de 3 juegos (11 puntos)",
    scoring: "Rally scoring — solo puntúa quien saca",
    formats: ["dobles", "singles"],
  },
};

export function SportProvider({ children }) {
  const [sport, setSport] = useState("padel");
  return (
    <SportContext.Provider value={{ sport, setSport, sportInfo: SPORTS[sport], SPORTS }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}
