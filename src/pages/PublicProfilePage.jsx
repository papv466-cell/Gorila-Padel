// src/pages/PublicProfilePage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import './PublicProfilePage.css';

export default function PublicProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeMatches, setActiveMatches] = useState([]);
  const [showMatches, setShowMatches] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  async function loadUserProfile() {
    try {
      setLoading(true);

      // Obtener perfil del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setUser(profile);

      // Obtener estadísticas
      const { count: matchesCreated } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user', userId);

      const { count: matchesPlayed } = await supabase
        .from('match_players')
        .select('*', { count: 'exact', head: true })
        .eq('player_uuid', userId);

      setStats({
        matchesCreated: matchesCreated || 0,
        matchesPlayed: matchesPlayed || 0,
        rating: 4.5, // TODO: Calcular rating real
        totalRatings: 12, // TODO: Contar ratings reales
      });

      // Obtener partidos activos (creados por él, con plazas libres, futuro)
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          *,
          match_players(player_uuid)
        `)
        .eq('created_by_user', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      // Filtrar solo los que tengan plazas libres
      const matchesWithSlots = matches?.filter(m => {
        const currentPlayers = m.match_players?.length || 0;
        return currentPlayers < 4;
      }) || [];

      setActiveMatches(matchesWithSlots);

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page pageWithHeader">
        <div className="pageWrap" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: 900 }}>Cargando perfil...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page pageWithHeader">
        <div className="pageWrap" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Usuario no encontrado</div>
          <button className="btn" onClick={() => navigate(-1)}>
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap publicProfilePage">
        {/* Header con botón volver */}
        <button className="btn ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
          ← Volver
        </button>

        {/* Tarjeta de perfil */}
        <div className="profileCard">
          <div className="profileAvatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || user.email} />
            ) : (
              <div className="profileAvatarPlaceholder">
                {(user.full_name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
          </div>

          <h1 className="profileName">{user.full_name || user.email}</h1>
          
          {user.bio && (
            <p className="profileBio">{user.bio}</p>
          )}

          {/* Stats */}
          {stats && (
            <div className="profileStats">
              <div className="profileStat">
                <div className="profileStatValue">{stats.matchesCreated}</div>
                <div className="profileStatLabel">Partidos creados</div>
              </div>
              <div className="profileStat">
                <div className="profileStatValue">{stats.matchesPlayed}</div>
                <div className="profileStatLabel">Partidos jugados</div>
              </div>
              <div className="profileStat">
                <div className="profileStatValue">
                  ⭐ {stats.rating.toFixed(1)}
                </div>
                <div className="profileStatLabel">{stats.totalRatings} valoraciones</div>
              </div>
            </div>
          )}

          {/* Botón ver partidos activos */}
          {activeMatches.length > 0 && (
            <button 
                className="btn" 
                onClick={() => setShowMatches(!showMatches)}
                style={{ marginTop: 24, width: '100%' }}
            >
                {showMatches ? 'Ocultar partidos' : `Partidos creados por ${user.full_name || user.email?.split('@')[0]}`}
                {!showMatches && ` (${activeMatches.length})`}
            </button>
            )}
        </div>

        {/* Lista de partidos activos */}
        {showMatches && activeMatches.length > 0 && (
          <div className="activeMatchesSection">
            <h2 style={{ fontSize: 20, fontWeight: 950, marginBottom: 16 }}>
              Partidos activos
            </h2>
            <div className="matchesGrid">
              {activeMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }) {
  const navigate = useNavigate();
  const currentPlayers = match.match_players?.length || 0;
  const slotsLeft = 4 - currentPlayers;

  return (
    <div 
      className="matchCardPublic"
      onClick={() => navigate(`/partidos?openChat=${match.id}`)}
    >
      <div className="matchCardHeader">
        <h3 className="matchCardTitle">{match.club_name}</h3>
        <div className="matchCardSlots">
          {slotsLeft} {slotsLeft === 1 ? 'plaza' : 'plazas'} libre{slotsLeft !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="matchCardInfo">
        <div className="matchCardInfoItem">
          📅 {new Date(match.start_time).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </div>
        <div className="matchCardInfoItem">
          ⏰ {new Date(match.start_time).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        {match.level && (
          <div className="matchCardInfoItem">
            🎾 Nivel: {match.level}
          </div>
        )}
      </div>

      {/* Jugadores */}
      <div className="matchCardPlayers">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`matchCardPlayer ${i < currentPlayers ? 'filled' : 'empty'}`}
          >
            🦍
          </div>
        ))}
      </div>
    </div>
  );
}