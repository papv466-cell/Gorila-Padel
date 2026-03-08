// src/pages/JuegazPlusPage.jsx
import { useNavigate } from "react-router-dom";

export default function JuegazPlusPage({ session }) {
  const navigate = useNavigate();

  const sections = [
    {
      to: "/ligas",
      icon: "🥇",
      title: "Ligas",
      desc: "Compite en ligas locales y sube en el ranking",
      color: "#f59e0b",
    },
    {
      to: "/retos",
      icon: "⚔️",
      title: "Retos",
      desc: "Reta a una pareja y demuestra quién es mejor",
      color: "#ef4444",
    },
    {
      to: "/pulls",
      icon: "🎯",
      title: "Pulls",
      desc: "Quedadas abiertas — apúntate y llena las plazas",
      color: "#74B800",
    },
    {
      to: "/entrenamientos",
      icon: "💪",
      title: "Entrenamientos",
      desc: "Sesiones de entrenamiento con grupos reducidos",
      color: "#8b5cf6",
      soon: false,
    },
  ];

  return (
    <div className="page pageWithHeader" style={{ paddingBottom: 80 }}>
      <div className="pageWrap">
        <div className="container">
          <div style={{ padding: "16px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#fff" }}>
              🥇 <span style={{ color: "#74B800" }}>Juega+</span>
            </h1>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              Ligas, retos, pulls y entrenamientos
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sections.map(s => (
              <div key={s.to}
                onClick={() => !s.soon && navigate(s.to)}
                style={{
                  background: "#111",
                  borderRadius: 16,
                  border: `1px solid ${s.color}30`,
                  padding: "18px 20px",
                  cursor: s.soon ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: s.soon ? 0.5 : 1,
                  transition: "all .15s",
                }}
                onMouseEnter={e => { if (!s.soon) e.currentTarget.style.background = "#1a1a1a"; }}
                onMouseLeave={e => e.currentTarget.style.background = "#111"}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `${s.color}15`,
                  border: `1px solid ${s.color}30`,
                  display: "grid", placeItems: "center",
                  fontSize: 26, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{s.title}</span>
                    {s.soon && <span style={{ fontSize: 10, fontWeight: 900, color: s.color, background: `${s.color}15`, padding: "2px 8px", borderRadius: 999 }}>Próximamente</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{s.desc}</div>
                </div>
                {!s.soon && <div style={{ color: s.color, fontSize: 22 }}>›</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}