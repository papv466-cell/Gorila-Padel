import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page gpHome">
      <div className="pageWrap">
        <div className="container gpHomeInner">
          <div className="gpHomeHero">
            <div className="gpHomeBadge">🦍🍌</div>
            <h1 className="gpHomeTitle">GORILA PÁDEL</h1>
            <p className="gpHomeSub">
              Rápido. Fácil. Salvaje.
              <span className="gpHomeSub2"> Elige lo tuyo y a la pista.</span>
            </p>
          </div>

          <div className="gpHomeActions">
            <button className="gpBigCta gpBigCtaPlay" onClick={() => navigate("/juega")}>
              <div className="gpBigCtaEmoji">🦍</div>
              <div className="gpBigCtaText">
                <div className="gpBigCtaTitle">JUEGA!</div>
                <div className="gpBigCtaMeta">Partidos, mapa y modo inclusivo</div>
              </div>
              <div className="gpBigCtaArrow">→</div>
            </button>

            <button className="gpBigCta gpBigCtaLearn" onClick={() => navigate("/aprende")}>
              <div className="gpBigCtaEmoji">🍌</div>
              <div className="gpBigCtaText">
                <div className="gpBigCtaTitle">APRENDE!</div>
                <div className="gpBigCtaMeta">Clases y mejora tu nivel</div>
              </div>
              <div className="gpBigCtaArrow">→</div>
            </button>
          </div>

          <div className="gpHomeFooter">
            <span className="gpHomeFooterTag">verde + negro</span>
            <span className="gpHomeFooterDot">•</span>
            <span className="gpHomeFooterTag">gorilas everywhere</span>
            <span className="gpHomeFooterDot">•</span>
            <span className="gpHomeFooterTag">0 complicaciones</span>
          </div>
        </div>
      </div>
    </div>
  );
}
