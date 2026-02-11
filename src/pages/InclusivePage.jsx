// src/pages/InclusivePage.jsx
import { useNavigate } from "react-router-dom";
import "./InclusivePage.css";

export default function InclusivePage() {
  const navigate = useNavigate();

  const categories = [
    { icon: "♿", title: "Silla de ruedas", description: "Partidos adaptados con acceso garantizado" },
    { icon: "🦯", title: "Ceguera / baja visión", description: "Juega con sonido y apoyo de compañeros" },
    { icon: "🧩", title: "Síndrome de Down", description: "Parejas compatibles con apoyo" },
    { icon: "🧠", title: "Otra capacidad especial", description: "TEA, parálisis cerebral y más" },
    { icon: "🤝", title: "Sin capacidades espaciales (para mixtos)", description: "Todos bienvenidos, juega con quien quieras" },
    { icon: "✅", title: "Solo mixtos", description: "Partidos inclusivos para todos" },
  ];

  return (
    <div className="page pageWithHeader gpInclusivePage">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <h1 className="pageTitle">Partidos inclusivos</h1>
            <p className="pageMeta">
              Encuentra o crea partidos pensados para personas con discapacidad y también mixtos.
            </p>
          </div>

          <div className="gpInclusiveActions">
            <button className="btn" onClick={() => navigate("/partidos?create=1&type=inclusive")}>
              + Crear partido inclusivo
            </button>
            <button className="btn ghost" onClick={() => navigate("/partidos")}>
              Ir a Partidos
            </button>
          </div>

          <div className="gpInclusiveGrid">
            {categories.map((cat, idx) => (
              <div key={idx} className="gpInclusiveCard">
                <div className="gpInclusiveCardIcon">{cat.icon}</div>
                <div className="gpInclusiveCardTitle">{cat.title}</div>
                <div className="gpInclusiveCardDesc">{cat.description}</div>
                <button
                  className="btn ghost"
                  onClick={() => navigate(`/partidos?filter=${encodeURIComponent(cat.title)}`)}
                >
                  Ver partidos
                </button>
              </div>
            ))}
          </div>

          <div className="gpInclusiveBottom">
            <button className="btn ghost" onClick={() => navigate(-1)}>
              ← Inicio
            </button>
          </div>

          <div className="gpInclusiveNote">
            Mostrando: <strong>0 partido(s)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}