// src/contexts/SportContext.jsx
import { createContext, useContext, useState } from "react";

const SportContext = createContext({});

export const SPORTS = {
  padel: {
    key: "padel",
    label: "Pádel",
    emoji: "🎾",
    color: "#2ECC71",
    colorDark: "#1a6b3a",
    colorBg: "rgba(46,204,113,0.08)",
    colorBorder: "rgba(46,204,113,0.25)",
    players: 4,
    duration: 90,
    description: "2 vs 2 en pista cerrada con paredes",
    scoring: "15-30-40, sets y partidos. Tie-break a 7.",
    formats: ["dobles"],
  },
  tenis: {
    key: "tenis",
    label: "Tenis",
    emoji: "🎾",
    color: "#F39C12",
    colorDark: "#7a4e06",
    colorBg: "rgba(243,156,18,0.08)",
    colorBorder: "rgba(243,156,18,0.25)",
    players: 2,
    duration: 90,
    description: "Individual o dobles en pista abierta",
    scoring: "15-30-40, juegos y sets. Tie-break a 7.",
    formats: ["singles", "dobles"],
  },
  pickleball: {
    key: "pickleball",
    label: "Pickleball",
    emoji: "🏓",
    color: "#3498DB",
    colorDark: "#1a4a6b",
    colorBg: "rgba(52,152,219,0.08)",
    colorBorder: "rgba(52,152,219,0.25)",
    players: 4,
    duration: 60,
    description: "2 vs 2 en pista pequeña con pala sólida",
    scoring: "Rally scoring. Al mejor de 3 juegos a 11 puntos.",
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
