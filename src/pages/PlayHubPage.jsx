import { useNavigate } from "react-router-dom";

export default function PlayHubPage() {
  const navigate = useNavigate();

  return (
    <div className="page gpHub">
      <div className="pageWrap">
        <div className="container">
          <div className="gpHubHeader">
            <div className="gpHubKicker">🦍 modo salvaje</div>
            <h1 className="gpHubTitle">JUEGA</h1>
            <p className="gpHubSub">Elige una opción y a rugir.</p>
          </div>

          <div className="gpHubGrid">
            <button className="gpHubCard" onClick={() => navigate("/mapa?view=list")}>
              <div className="gpHubIcon">🗺️</div>
              <div className="gpHubCardTitle">Mapa</div>
              <div className="gpHubCardMeta">Clubs + favoritos + cerca de mí</div>
            </button>

            <button className="gpHubCard gpHubCardPrimary" onClick={() => navigate("/inclusivo")}>
              <div className="gpHubIcon">♿️</div>
              <div className="gpHubCardTitle">Juega Inclusivo</div>
              <div className="gpHubCardMeta">Para todos. Sin excusas.</div>
            </button>

            <button className="gpHubCard" onClick={() => navigate("/partidos")}>
              <div className="gpHubIcon">🎾</div>
              <div className="gpHubCardTitle">Partidos</div>
              <div className="gpHubCardMeta">Busca, únete o crea uno</div>
            </button>
          </div>

          <div className="gpHubBottom">
            <button className="btn ghost" onClick={() => navigate("/")}>← Inicio</button>
          </div>
        </div>
      </div>
    </div>
  );
}
