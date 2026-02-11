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
          {/* Header */}
          <div className="pageHeader gpInclusiveHeader">
            <h1 className="pageTitle gpInclusiveTitle">Partidos inclusivos</h1>
            <p className="pageMeta gpInclusiveMeta">
              Encuentra o crea partidos pensados para personas con discapacidad y también mixtos.
            </p>
          </div>

          {/* ✅ Botón "Ir a Partidos" (se queda aquí) */}
          <div className="gpInclusiveActions">
            <button className="btn ghost" onClick={() => navigate("/partidos")}>
              Ir a Partidos
            </button>
          </div>

          {/* ✅ Botón "Crear" JUSTO debajo */}
          <div className="gpInclusiveCreateBelow">
            <button className="btn" onClick={() => navigate("/partidos?create=1&type=inclusive")}>
              + Crear partido inclusivo
            </button>
          </div>

          {/* Grid de categorías */}
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

          {/* Botón volver */}
          <div className="gpInclusiveBottom">
            <button className="btn ghost" onClick={() => navigate(-1)}>
              ← Inicio
            </button>
          </div>

          {/* Nota */}
          <div className="gpInclusiveNote">
            Mostrando: <strong>0 partido(s)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}