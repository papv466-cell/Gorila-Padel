// src/components/PlayerStats.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const VIBE_LABELS = {
  fair_play: { label: 'Fair Play', icon: '🤝', color: '#74B800' },
  buen_nivel: { label: 'Buen nivel', icon: '🎾', color: '#3b82f6' },
  comunicativo: { label: 'Comunicativo', icon: '💬', color: '#f59e0b' },
  puntual: { label: 'Puntual', icon: '⏰', color: '#8b5cf6' },
  divertido: { label: 'Divertido', icon: '😄', color: '#ec4899' },
};

const LEVEL_COLORS = {
  iniciacion: '#74B800', medio: '#f59e0b', avanzado: '#ef4444', competicion: '#8b5cf6'
};

function StatBar({ value, max, color = '#74B800' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width .6s ease' }} />
    </div>
  );
}

function StarRating({ value, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= Math.round(value) ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>★</span>
      ))}
    </div>
  );
}

export default function PlayerStats({ userId, compact = false }) {
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [vibes, setVibes] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    if (userId) loadStats();
  }, [userId]);

  async function loadStats() {
    try {
      setLoading(true);
      const [pubRes, ratingsRes, createdRes, joinedRes] = await Promise.allSettled([
        supabase.from('profiles_public').select('matches_played, red_cards').eq('id', userId).maybeSingle(),
        supabase.from('player_ratings').select('rating, vibe, created_at, match_id').eq('to_user_id', userId).order('created_at', { ascending: false }),
        supabase.from('matches').select('id, club_name, start_at, level').eq('created_by_user', userId).order('start_at', { ascending: false }).limit(20),
        supabase.from('join_requests').select('match_id, matches(id, club_name, start_at, level)').eq('user_id', userId).eq('status', 'approved').order('created_at', { ascending: false }).limit(20),
      ]);

      const pub = pubRes.status === 'fulfilled' ? pubRes.value.data : null;
      const ratingRows = ratingsRes.status === 'fulfilled' ? ratingsRes.value.data || [] : [];
      const created = createdRes.status === 'fulfilled' ? createdRes.value.data || [] : [];
      const joined = joinedRes.status === 'fulfilled' ? joinedRes.value.data || [] : [];

      const avg = ratingRows.length ? ratingRows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratingRows.length : 0;

      const vibeCounts = {};
      ratingRows.forEach(r => { if (r.vibe) vibeCounts[r.vibe] = (vibeCounts[r.vibe] || 0) + 1; });
      setVibes(vibeCounts);

      const now = new Date();
      const monthlyRatings = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('es-ES', { month: 'short' });
        const monthRows = ratingRows.filter(r => {
          const rd = new Date(r.created_at);
          return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
        });
        const monthAvg = monthRows.length ? monthRows.reduce((s, r) => s + r.rating, 0) / monthRows.length : null;
        monthlyRatings.push({ label, avg: monthAvg, count: monthRows.length });
      }

      const allMatches = [
        ...created.map(m => ({ ...m, role: 'creador' })),
        ...joined.map(j => ({ ...j.matches, role: 'jugador' })).filter(m => m?.id),
      ].sort((a, b) => new Date(b.start_at) - new Date(a.start_at)).slice(0, 15);

      setStats({ matches_played: Number(pub?.matches_played) || 0, red_cards: Number(pub?.red_cards) || 0, avg_rating: avg, rating_count: ratingRows.length, created_count: created.length, monthly_ratings: monthlyRatings });
      setRatings(ratingRows.slice(0, 8));
      setMatchHistory(allMatches);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>⏳ Cargando estadísticas...</div>;
  if (!stats) return null;

  const topVibe = Object.entries(vibes).sort((a, b) => b[1] - a[1])[0];
  const maxVibe = Math.max(...Object.values(vibes), 1);

  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { value: stats.matches_played, label: 'Partidos', color: '#74B800' },
          { value: stats.avg_rating > 0 ? `⭐ ${stats.avg_rating.toFixed(1)}` : '—', label: 'Valoración', color: '#f59e0b' },
          { value: stats.red_cards, label: 'Tarjetas 🟥', color: stats.red_cards > 0 ? '#ef4444' : '#74B800' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <style>{`.psTab{transition:all .15s;cursor:pointer;border:none;}`}</style>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
        {[{ key: 'stats', label: '📊 Stats' }, { key: 'historial', label: `🏓 Historial (${matchHistory.length})` }, { key: 'vibes', label: `✨ Vibes (${stats.rating_count})` }].map(t => (
          <button key={t.key} className="psTab" onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: tab === t.key ? 'rgba(116,184,0,0.15)' : 'transparent', color: tab === t.key ? '#74B800' : 'rgba(255,255,255,0.4)', border: tab === t.key ? '1px solid rgba(116,184,0,0.2)' : '1px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {[
              { value: stats.matches_played, label: 'Partidos jugados', icon: '🏓', color: '#74B800' },
              { value: stats.created_count, label: 'Partidos creados', icon: '➕', color: '#3b82f6' },
              { value: stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : '—', label: 'Valoración media', icon: '⭐', color: '#f59e0b', sub: <StarRating value={stats.avg_rating} /> },
              { value: stats.red_cards, label: 'Tarjetas rojas', icon: '🟥', color: stats.red_cards > 0 ? '#ef4444' : '#74B800' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '14px 12px', borderRadius: 12, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.label}</div>
                {s.sub && <div style={{ marginTop: 4 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
          {stats.monthly_ratings.some(m => m.avg !== null) && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Valoración por mes</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {stats.monthly_ratings.map((m, i) => {
                  const h = m.avg ? (m.avg / 5) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: '#74B800', fontWeight: 800 }}>{m.avg ? m.avg.toFixed(1) : ''}</div>
                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 40, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: `${h}%`, background: m.avg >= 4 ? '#74B800' : m.avg >= 3 ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0', transition: 'height .5s ease', minHeight: m.avg ? 3 : 0 }} />
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {topVibe && VIBE_LABELS[topVibe[0]] && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: `${VIBE_LABELS[topVibe[0]].color}10`, border: `1px solid ${VIBE_LABELS[topVibe[0]].color}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>{VIBE_LABELS[topVibe[0]].icon}</div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Vibe más frecuente</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{VIBE_LABELS[topVibe[0]].label}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matchHistory.length === 0
            ? <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏓</div>Sin historial</div>
            : matchHistory.map((m, i) => {
                const lc = LEVEL_COLORS[m.level] || '#74B800';
                const isPast = new Date(m.start_at) < new Date();
                return (
                  <div key={m.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: isPast ? 'rgba(255,255,255,0.2)' : '#74B800', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.club_name || 'Club'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{new Date(m.start_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <div style={{ padding: '2px 7px', borderRadius: 5, background: `${lc}20`, color: lc, fontSize: 9, fontWeight: 900 }}>{m.level}</div>
                      <div style={{ padding: '2px 7px', borderRadius: 5, background: m.role === 'creador' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.06)', color: m.role === 'creador' ? '#FFD700' : 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900 }}>{m.role === 'creador' ? '👑' : '🏓'}</div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {tab === 'vibes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.keys(vibes).length === 0
            ? <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>Sin vibes aún</div>
            : Object.entries(vibes).sort((a, b) => b[1] - a[1]).map(([vibe, count]) => {
                const info = VIBE_LABELS[vibe] || { label: vibe, icon: '✨', color: '#74B800' };
                return (
                  <div key={vibe} style={{ padding: '10px 14px', borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{info.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{info.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 900, color: info.color }}>{count}x</span>
                    </div>
                    <StatBar value={count} max={maxVibe} color={info.color} />
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}
