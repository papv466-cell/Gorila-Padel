import { useNavigate } from "react-router-dom";

export default function InclusivePage() {
  const navigate = useNavigate();

  return (
    <div className="page gpInclusive">
      <div className="pageWrap">
        <div className="container gpInclusiveInner">
          <div className="gpInclusiveHero">
            <div className="gpInclusiveBadge">♿️🦯🧩</div>
            <h1 className="gpInclusiveTitle">Juega Inclusivo</h1>
            <p className="gpInclusiveSub">
              Aquí se juega con todo el mundo: síndrome de Down, ciegos, silla de ruedas,
              mixto y combinaciones.
            </p>
          </div>

          <div className="gpInclusiveCards">
            <div className="gpMiniCard">
              <div className="gpMiniCardTitle">🧩 Down</div>
              <div className="gpMiniCardMeta">Parejas compatibles + guía rápida</div>
            </div>
            <div className="gpMiniCard">
              <div className="gpMiniCardTitle">🦯 Ciegos</div>
              <div className="gpMiniCardMeta">Empareja con vidente y juega</div>
            </div>
            <div className="gpMiniCard">
              <div className="gpMiniCardTitle">♿️ Silla</div>
              <div className="gpMiniCardMeta">Filtros y partidos adaptados</div>
            </div>
          </div>

          <div className="gpInclusiveBottom">
            <button className="btn" onClick={() => alert("Siguiente: crear flujo Inclusivo (lo hacemos en una fase dedicada)")}>
              Empezar
            </button>
            <button className="btn ghost" onClick={() => navigate("/juega")}>
              ← Volver a Juega
            </button>
          </div>

          <div style={{ marginTop: 14, opacity: 0.6, fontSize: 12 }}>
            *Esto es un “modo base” bonito. En la fase Inclusivo lo conectamos con filtros + emparejamientos reales.
          </div>
        </div>
      </div>
    </div>
  );
}
