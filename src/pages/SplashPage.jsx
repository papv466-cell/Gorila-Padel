export default function SplashPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#0b0f14",
        color: "#fff",
        zIndex: 999999,
        textAlign: "center",
        padding: 24,
      }}
      aria-label="Cargando Gorila Pádel"
    >
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <img
          src="/imglogog.png"
          alt="Gorila Pádel"
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            borderRadius: 22,
            background: "rgba(255,255,255,0.08)",
            padding: 16,
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
            display: "block",
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.2 }}>
          Gorila Pádel
        </div>
        <div style={{ fontSize: 13, opacity: 0.82 }}>
          Únete · crea partidos · encuentra clubs
                  . Engorilate .
        </div>
      </div>
    </div>
  );
}
