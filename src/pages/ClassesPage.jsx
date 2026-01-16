import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ClassesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clubName = useMemo(() => searchParams.get("clubName") || "Club", [searchParams]);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">Clases</h1>
        <p className="subtitle">Club: {clubName}</p>

        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
            Volver
          </button>
        </div>
      </header>

      <div style={{ padding: 16 }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
          Aquí iremos metiendo clases (MVP). De momento es una pantalla segura para que el botón “Clases aquí” funcione.
        </div>
      </div>
    </div>
  );
}
