// src/components/XPToast.jsx
// Toast especial para celebrar XP ganado y logros desbloqueados
// Uso: import { showXPToast } from './XPToast'
//      showXPToast({ xp: 20, reason: 'match_played', newAchievements: [...] })

import toast from "react-hot-toast";

const REASON_LABELS = {
  match_played:    "¡Partido jugado!",
  match_won:       "¡Victoria!",
  match_created:   "Partido creado",
  inclusive_played:"¡Partido inclusivo!",
  streak_7:        "¡Racha de 7 días!",
  streak_30:       "¡Racha de 30 días!",
  rating_given:    "Valoración enviada",
  gorilandia_post: "Post en Gorilandia",
};

export function showXPToast({ xpGained, newAchievements = [] }) {
  // Toast de XP
  if (xpGained > 0) {
    toast.custom(
      (t) => (
        <div
          onClick={() => toast.dismiss(t.id)}
          style={{
            background: "linear-gradient(135deg,#74B800,#9BE800)",
            color: "#000",
            borderRadius: 14,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "Outfit, sans-serif",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(116,184,0,0.4)",
            animation: t.visible ? "slideIn .3s ease" : "slideOut .2s ease",
          }}
        >
          <span style={{ fontSize: 28 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>+{xpGained} XP</div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>Sigue jugando para subir de nivel</div>
          </div>
        </div>
      ),
      { duration: 3000, position: "top-center" }
    );
  }

  // Toast por cada logro desbloqueado (con delay)
  newAchievements.forEach((achievement, i) => {
    setTimeout(() => {
      toast.custom(
        (t) => (
          <div
            onClick={() => toast.dismiss(t.id)}
            style={{
              background: "#111",
              border: "1px solid rgba(116,184,0,0.4)",
              borderRadius: 14,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "Outfit, sans-serif",
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              minWidth: 280,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(116,184,0,0.15)",
              border: "2px solid rgba(116,184,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
            }}>
              {achievement.emoji}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#74B800", textTransform: "uppercase", letterSpacing: ".05em" }}>
                🏅 Logro desbloqueado
              </div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#fff", marginTop: 2 }}>
                {achievement.label}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                {achievement.desc}
                {achievement.xp > 0 && <span style={{ color: "#74B800", fontWeight: 800 }}> +{achievement.xp} XP</span>}
              </div>
            </div>
          </div>
        ),
        { duration: 5000, position: "top-center" }
      );
    }, (i + 1) * 800);
  });
}