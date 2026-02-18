import { useNavigate } from "react-router-dom";

export default function LearnHubPage() {
  const navigate = useNavigate();

  return (
    <div className="page gpHub">
      <div className="pageWrap">
        <div className="container">
          <div className="gpHubHeader">
            <div className="gpHubKicker">🍌 modo mejora</div>
            <h1 className="gpHubTitle">APRENDE</h1>
            <p className="gpHubSub">Menos charla. Más nivel.</p>
          </div>

          <div className="gpHubGrid">
            <button className="gpHubCard gpHubCardPrimary" onClick={() => navigate("/clases")}>
              <div className="gpHubIcon">🎓</div>
              <div className="gpHubCardTitle">Clases</div>
              <div className="gpHubCardMeta">Apúntate hoy mismo</div>
            </button>

            <button className="gpHubCard" onClick={() => alert("Pronto: Preferencias de juego 😏")}>
              <div className="gpHubIcon">🧠</div>
              <div className="gpHubCardTitle">Preferencias</div>
              <div className="gpHubCardMeta">Mano, lado, estilo…</div>
            </button>

            <button className="gpHubCard" onClick={() => alert("Pronto: Tips y trucos 🍌")}>
              <div className="gpHubIcon">📌</div>
              <div className="gpHubCardTitle">Tips</div>
              <div className="gpHubCardMeta">Técnica y atajos</div>
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
