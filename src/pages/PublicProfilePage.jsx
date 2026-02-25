// src/pages/PublicProfilePage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const LEVEL_LABELS = { iniciacion: 'Iniciación', medio: 'Medio', avanzado: 'Avanzado', competicion: 'Competición' };
const LEVEL_COLORS = { iniciacion: '#74B800', medio: '#f59e0b', avanzado: '#ef4444', competicion: '#8b5cf6' };
const HAND_LABELS = { right: 'Diestro', left: 'Zurdo' };
const SEX_LABELS = { M: '♂ Masculino', F: '♀ Femenino', X: '⚧ Mixto' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d} días`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeMatches, setActiveMatches] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [tab, setTab] = useState('info'); // info | partidos | valoraciones
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUserProfile(); }, [userId]);

  async function loadUserProfile() {
    try {
      setLoading(true);

      const [profRes, createdRes, playedRes, matchesRes, ratingsRes] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('created_by_user', userId),
        supabase.from('join_requests').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'approved'),
        supabase.from('matches').select('*, join_requests(user_id)').eq('created_by_user', userId).gte('start_at', new Date().toISOString()).order('start_at').limit(5),
        supabase.from('player_ratings').select('*, rater:profiles!player_ratings_rater_id_fkey(name, handle, avatar_url)').eq('rated_user_id', userId).order('created_at', { ascending: false }).limit(10),
      ]);

      if (profRes.status === 'fulfilled') setUser(profRes.value.data);

      const created = createdRes.status === 'fulfilled' ? createdRes.value.count || 0 : 0;
      const played = playedRes.status === 'fulfilled' ? playedRes.value.count || 0 : 0;
      const ratingsList = ratingsRes.status === 'fulfilled' ? ratingsRes.value.data || [] : [];
      const avgRating = ratingsList.length > 0
        ? ratingsList.reduce((s, r) => s + (r.rating || 0), 0) / ratingsList.length
        : null;

      setStats({ created, played, avgRating, totalRatings: ratingsList.length });
      setRatings(ratingsList);

      if (matchesRes.status === 'fulfilled') {
        const matches = matchesRes.value.data || [];
        setActiveMatches(matches.filter(m => (m.join_requests?.length || 0) < 4));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 36 }}>⏳</div>
          <div style={{ marginTop: 10, fontWeight: 800 }}>Cargando perfil...</div>
        </div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48 }}>❌</div>
        <div style={{ fontWeight: 900, color: '#fff', marginTop: 12 }}>Usuario no encontrado</div>
        <button onClick={() => navigate(-1)} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#74B800', color: '#000', fontWeight: 900, cursor: 'pointer' }}>← Volver</button>
      </div>
    </div>
  );

  const displayName = user.name || user.handle || user.email?.split('@')[0] || '?';
  const levelColor = LEVEL_COLORS[user.level] || '#74B800';
  const levelLabel = LEVEL_LABELS[user.level] || user.level;

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @keyframes ppFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .ppTab { transition: all .15s; cursor: pointer; border: none; }
        .ppTab:hover { opacity: 1 !important; }
        .ppMatchCard { transition: transform .2s, border-color .15s; cursor: pointer; }
        .ppMatchCard:hover { transform: translateY(-3px); border-color: rgba(116,184,0,0.3) !important; }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 14px 60px', animation: 'ppFadeUp .4s ease' }}>

        {/* Back */}
        <div style={{ padding: '12px 0 16px' }}>
          <button onClick={() => navigate(-1)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            ← Volver
          </button>
        </div>

        {/* ── HERO CARD ── */}
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
          {/* Banner */}
          <div style={{ height: 80, background: `linear-gradient(135deg, ${levelColor}20, transparent)`, borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${levelColor}15, transparent 60%)` }} />
          </div>

          <div style={{ padding: '0 20px 24px' }}>
            {/* Avatar + nombre */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: -36, marginBottom: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 999, overflow: 'hidden', border: `3px solid ${levelColor}`, background: '#1a1a1a', flexShrink: 0, boxShadow: `0 0 20px ${levelColor}40` }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 900, background: `linear-gradient(135deg, ${levelColor}, ${levelColor}99)`, color: '#000' }}>{displayName[0].toUpperCase()}</div>}
              </div>
              <div style={{ paddingBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>{displayName}</h1>
                {user.handle && user.name && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>@{user.handle}</div>
                )}
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {user.level && (
                <div style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: `${levelColor}20`, color: levelColor, border: `1px solid ${levelColor}40` }}>
                  🎾 {levelLabel}
                </div>
              )}
              {user.handedness && (
                <div style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  🖐 {HAND_LABELS[user.handedness] || user.handedness}
                </div>
              )}
              {user.sex && user.sex !== 'X' && (
                <div style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {SEX_LABELS[user.sex]}
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { value: stats?.created || 0, label: 'Creados' },
                { value: stats?.played || 0, label: 'Jugados' },
                { value: stats?.avgRating ? `⭐ ${stats.avgRating.toFixed(1)}` : '—', label: `${stats?.totalRatings || 0} valoraciones` },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#74B800', marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#111', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { key: 'info', label: '👤 Info' },
            { key: 'partidos', label: `🏓 Partidos ${activeMatches.length > 0 ? `(${activeMatches.length})` : ''}` },
            { key: 'valoraciones', label: `⭐ Valoraciones ${ratings.length > 0 ? `(${ratings.length})` : ''}` },
          ].map(t => (
            <button key={t.key} className="ppTab"
              onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '9px 8px', borderRadius: 9, fontSize: 12, fontWeight: 800, background: tab === t.key ? 'rgba(116,184,0,0.15)' : 'transparent', color: tab === t.key ? '#74B800' : 'rgba(255,255,255,0.45)', border: tab === t.key ? '1px solid rgba(116,184,0,0.25)' : '1px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB INFO ── */}
        {tab === 'info' && (
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            {user.bio ? (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>{user.bio}</p>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                Sin bio
              </div>
            )}
            {user.birthdate && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 8 }}>
                <span>🎂</span>
                <span>{new Date(user.birthdate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        )}

        {/* ── TAB PARTIDOS ── */}
        {tab === 'partidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏓</div>
                Sin partidos activos
              </div>
            ) : activeMatches.map(match => {
              const spots = 4 - (match.join_requests?.length || 0);
              const lc = LEVEL_COLORS[match.level] || '#74B800';
              return (
                <div key={match.id} className="ppMatchCard"
                  onClick={() => navigate(`/partidos?openChat=${match.id}`)}
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{match.club_name || 'Club'}</div>
                    <div style={{ padding: '3px 8px', borderRadius: 6, background: `${lc}20`, color: lc, fontSize: 10, fontWeight: 900 }}>
                      {LEVEL_LABELS[match.level] || match.level}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                    📅 {new Date(match.start_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    ⏰ {new Date(match.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[...Array(4)].map((_, i) => {
                        const filled = i < (match.join_requests?.length || 0);
                        return (
                          <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="18" height="18">
                            <rect x="29" y="42" width="6" height="14" rx="3" fill={filled ? '#111' : 'rgba(255,255,255,0.15)'}/>
                            <ellipse cx="32" cy="28" rx="13" ry="16" fill={filled ? '#74B800' : 'rgba(255,255,255,0.15)'} stroke={filled ? '#111' : 'rgba(255,255,255,0.1)'} strokeWidth="2"/>
                            <circle cx="28" cy="24" r="2" fill={filled ? '#9BE800' : 'rgba(255,255,255,0.1)'}/>
                            <circle cx="36" cy="24" r="2" fill={filled ? '#9BE800' : 'rgba(255,255,255,0.1)'}/>
                            <circle cx="32" cy="30" r="2" fill={filled ? '#9BE800' : 'rgba(255,255,255,0.1)'}/>
                          </svg>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: spots > 0 ? '#74B800' : '#ef4444' }}>
                      {spots > 0 ? `${spots} plaza${spots !== 1 ? 's' : ''} libre${spots !== 1 ? 's' : ''}` : 'Completo'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB VALORACIONES ── */}
        {tab === 'valoraciones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ratings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⭐</div>
                Sin valoraciones aún
              </div>
            ) : ratings.map((r, i) => {
              const raterName = r.rater?.name || r.rater?.handle || 'Gorila';
              return (
                <div key={r.id || i} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, display: 'flex', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, overflow: 'hidden', background: '#1a1a1a', flexShrink: 0 }}>
                    {r.rater?.avatar_url
                      ? <img src={r.rater.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900, background: 'rgba(116,184,0,0.2)', color: '#74B800' }}>{raterName[0].toUpperCase()}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{raterName}</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[...Array(5)].map((_, s) => (
                          <span key={s} style={{ fontSize: 12, color: s < r.rating ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>★</span>
                        ))}
                      </div>
                    </div>
                    {r.comment && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{r.comment}</div>}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4, fontWeight: 700 }}>{timeAgo(r.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}