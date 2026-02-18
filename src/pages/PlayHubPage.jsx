// src/pages/PlayHubPage.jsx
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import './PlayHubPage.css';

export default function PlayHubPage() {
  const navigate = useNavigate();
  const [userStats] = useState({
    matchesPlayed: 12,
    winRate: 68,
    hoursPlayed: 24
  });

  return (
    <div className="page gpHub gpHubPro">
      <div className="pageWrap">
        <div className="container">
          {/* Quick Stats */}
          <div className="gpHubStats">
            <div className="gpStatCard">
              <div className="gpStatValue">{userStats.matchesPlayed}</div>
              <div className="gpStatLabel">Partidos</div>
            </div>
            <div className="gpStatCard">
              <div className="gpStatValue">{userStats.winRate}%</div>
              <div className="gpStatLabel">Victorias</div>
            </div>
            <div className="gpStatCard">
              <div className="gpStatValue">{userStats.hoursPlayed}h</div>
              <div className="gpStatLabel">Jugadas</div>
            </div>
          </div>

          {/* Header */}
          <div className="gpHubHeader">
            <div className="gpHubKicker">🦍 modo salvaje</div>
            <h1 className="gpHubTitle">JUEGA</h1>
            <p className="gpHubSub">Elige una opción y a rugir.</p>
          </div>

          {/* Action Cards */}
          <div className="gpHubGrid">
            <button 
              className="gpHubCard" 
              onClick={() => navigate("/mapa?view=list")}
            >
              <div className="gpHubIcon">🗺️</div>
              <div className="gpHubCardTitle">Mapa</div>
              <div className="gpHubCardMeta">Clubs + favoritos + cerca de mí</div>
            </button>

            <button
              className="gpHubCard gpHubCardPrimary"
              onClick={() => navigate("/inclusivos")}
            >
              <div className="gpHubIcon">♿️</div>
              <div className="gpHubCardTitle">Juega Inclusivo</div>
              <div className="gpHubCardMeta">Para todos. Sin excusas.</div>
            </button>

            <button 
              className="gpHubCard gpHubCardPrimary" 
              onClick={() => navigate("/partidos")}
            >
              <div className="gpHubIcon">🎾</div>
              <div className="gpHubCardTitle">Partidos</div>
              <div className="gpHubCardMeta">Busca, únete o crea uno</div>
            </button>
          </div>

          {/* FAB Create Match */}
          <button 
            className="gpFabCreate" 
            onClick={() => navigate("/partidos?create=1")}
            title="Crear partido rápido"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}