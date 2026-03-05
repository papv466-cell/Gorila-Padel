// src/pages/GorilandiaPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getFeed, createPost, uploadMedia } from '../services/gorilandia';
import GorilandiaPost from '../components/GorilandiaPost';
import GorilandiaUpload from '../components/GorilandiaUpload';
import { useSearchParams } from 'react-router-dom';

export default function GorilandiaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [postMatchData, setPostMatchData] = useState(null);
  const [postMatchPlayers, setPostMatchPlayers] = useState([]);
  const [searchParams] = useSearchParams();
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('posts');
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    const newpost = searchParams.get('newpost');
    const matchId = searchParams.get('matchId');
    if (newpost === '1' && matchId) {
      // Cargar datos del partido para prerellenar
      supabase.from('matches').select('id, club_name, start_at, duration_min').eq('id', matchId).maybeSingle()
        .then(({data: match}) => {
          if (!match) return;
          // Cargar resultado si existe
          supabase.from('match_results').select('sets, winner_side').eq('match_id', matchId).maybeSingle()
            .then(({data: result}) => {
              const resultStr = result?.sets ? result.sets.map(s=>`${s.a}-${s.b}`).join(' / ') : '';
              setPostMatchData({...match, result: resultStr});
            });
          // Cargar jugadores
          supabase.from('match_players').select('player_uuid').eq('match_id', matchId)
            .then(({data: players}) => {
              setPostMatchPlayers((players||[]).map(p=>({
                player_uuid: p.player_uuid,
                name: null,
                handle: null,
                avatar_url: null,
              })));
            });
          setShowUpload(true);
        });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => { if(_event==='TOKEN_REFRESHED') return; setSession(prev => prev?.user?.id === s?.user?.id && prev?.user?.id ? prev : s); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const newpost = searchParams.get('newpost');
    const matchId = searchParams.get('matchId');
    if (newpost === '1' && matchId) {
      // Cargar datos del partido para prerellenar
      supabase.from('matches').select('id, club_name, start_at, duration_min').eq('id', matchId).maybeSingle()
        .then(({data: match}) => {
          if (!match) return;
          // Cargar resultado si existe
          supabase.from('match_results').select('sets, winner_side').eq('match_id', matchId).maybeSingle()
            .then(({data: result}) => {
              const resultStr = result?.sets ? result.sets.map(s=>`${s.a}-${s.b}`).join(' / ') : '';
              setPostMatchData({...match, result: resultStr});
            });
          // Cargar jugadores
          supabase.from('match_players').select('player_uuid').eq('match_id', matchId)
            .then(({data: players}) => {
              setPostMatchPlayers((players||[]).map(p=>({
                player_uuid: p.player_uuid,
                name: null,
                handle: null,
                avatar_url: null,
              })));
            });
          setShowUpload(true);
        });
    }
  }, []);

  useEffect(() => { loadFeed(); loadActivity(); }, []);

  async function loadActivity() {
    try {
      setActivityLoading(true);
      // Últimos partidos jugados por cualquier jugador
      const {data: recentMatches} = await supabase
        .from('match_players')
        .select('match_id, player_uuid, matches(id, club_name, start_at, level, duration_min)')
        .order('created_at', {ascending: false})
        .limit(40);

      // Últimos resultados
      const {data: recentResults} = await supabase
        .from('match_results')
        .select('match_id, sets, winner_side, created_at, matches(club_name, start_at)')
        .order('created_at', {ascending: false})
        .limit(20);

      // Combinar y ordenar por fecha
      const items = [];

      for (const r of recentMatches||[]) {
        if (!r.matches) continue;
        items.push({
          type: 'match_played',
          id: `mp_${r.match_id}_${r.player_uuid}`,
          player: null,
          match: r.matches,
          created_at: r.matches.start_at,
        });
      }

      for (const r of recentResults||[]) {
        if (!r.matches) continue;
        items.push({
          type: 'match_result',
          id: `mr_${r.match_id}`,
          match: r.matches,
          sets: r.sets,
          winner_side: r.winner_side,
          created_at: r.created_at,
        });
      }

      // Ordenar por fecha desc y deduplicar
      items.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setActivity(items.slice(0, 30));
    } catch(e) { console.error(e); }
    finally { setActivityLoading(false); }
  }

  async function loadFeed() {
    try {
      setLoading(true);
      const data = await getFeed();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error cargando feed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost(postData) {
    try {
      setUploading(true);
      const uploadedUrls = [];
      for (const file of postData.files) {
        const url = await uploadMedia(file, postData.type);
        uploadedUrls.push(url);
      }
      await createPost(postData.type || 'photo', uploadedUrls, postData.caption);
      setShowUpload(false);
      await loadFeed();
    } catch (e) {
      console.error('Error creando post:', e);
      alert('Error: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }} className="page pageWithHeader">
      <style>{`
        .glPage { max-width: 480px; margin: 0 auto; padding: 0 0 80px; }
        .glHeader { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px 8px; }
        .glTitle { font-size: 22px; font-weight: 900; color: #fff; }
        .glTitle span { color: #74B800; }
        .glPublicar { padding: 9px 16px; border-radius: 10px; background: linear-gradient(135deg,#74B800,#9BE800); color: #000; font-weight: 900; border: none; cursor: pointer; font-size: 13px; }
        .glDivider { height: 1px; background: rgba(255,255,255,0.07); margin: 0; }
      `}</style>

      <div className="glPage">
        {/* HEADER */}
        <div className="glHeader">
          <div className="glTitle">🦍 Gorila<span>landia</span></div>
          <button className="glPublicar" onClick={() => { if (!session) { navigate('/login'); return; } setShowUpload(true); }}>
            ➕ Publicar
          </button>
        </div>
        <div className="glDivider" />

        {/* TABS */}
        <div style={{display:'flex',gap:0,padding:'0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          {[{key:'posts',label:'📸 Posts'},{key:'actividad',label:'⚡ Actividad'}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{flex:1,padding:'12px 0',border:'none',cursor:'pointer',fontWeight:900,fontSize:13,
                background:'transparent',
                color:tab===t.key?'#74B800':'rgba(255,255,255,0.4)',
                borderBottom:tab===t.key?'2px solid #74B800':'2px solid transparent'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* FEED POSTS */}
        {tab === 'posts' && (
        <main style={{ padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🦍</div>
              Cargando feed…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🦍</div>
              <div style={{ fontWeight: 900, color: '#fff', fontSize: 18, marginBottom: 6 }}>Nadie ha publicado aún</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>¡Sé el primero en compartir tu momento de pádel!</div>
              <button onClick={() => { if (!session) { navigate('/login'); return; } setShowUpload(true); }}
                style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#74B800,#9BE800)', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                ➕ Crear publicación
              </button>
            </div>
          ) : (
            posts.map(post => (
              <GorilandiaPost key={post.id} post={post} session={session} onReload={loadFeed} />
            ))
          )}
        </main>
        )}

        {/* FEED ACTIVIDAD */}
        {tab === 'actividad' && (
          <main style={{padding:'8px 16px'}}>
            {activityLoading ? (
              <div style={{textAlign:'center',padding:60,color:'rgba(255,255,255,0.4)'}}>
                <div style={{fontSize:32,marginBottom:10}}>⚡</div>Cargando actividad…
              </div>
            ) : activity.length === 0 ? (
              <div style={{textAlign:'center',padding:60,color:'rgba(255,255,255,0.4)'}}>
                <div style={{fontSize:40,marginBottom:8}}>🦍</div>
                <div style={{fontWeight:900,color:'#fff'}}>Sin actividad reciente</div>
                <div style={{fontSize:12,marginTop:4}}>Aquí verás partidos jugados y resultados</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8,paddingTop:8}}>
                {activity.map(item => {
                  const timeAgo = (date) => {
                    const diff = Date.now() - new Date(date).getTime();
                    const h = Math.floor(diff/3600000);
                    const d = Math.floor(diff/86400000);
                    if (h < 1) return 'Ahora';
                    if (h < 24) return `Hace ${h}h`;
                    return `Hace ${d}d`;
                  };

                  if (item.type === 'match_played') return (
                    <div key={item.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,background:'#111',border:'1px solid rgba(255,255,255,0.07)'}}>
                      {item.player?.avatar_url
                        ? <img src={item.player.avatar_url} style={{width:36,height:36,borderRadius:999,objectFit:'cover',flexShrink:0}} alt=""/>
                        : <div style={{width:36,height:36,borderRadius:999,background:'rgba(116,184,0,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🦍</div>
                      }
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>
                          <span style={{color:'#74B800'}}>{item.player?.name||item.player?.handle||'Jugador'}</span> jugó en {item.match?.club_name||'un club'}
                        </div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                          🏓 {item.match?.level} · {String(item.match?.start_at||'').slice(11,16)}
                        </div>
                      </div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',flexShrink:0}}>{timeAgo(item.created_at)}</div>
                    </div>
                  );

                  if (item.type === 'match_result') return (
                    <div key={item.id} style={{padding:'12px 14px',borderRadius:12,background:'rgba(116,184,0,0.06)',border:'1px solid rgba(116,184,0,0.15)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <div style={{fontSize:12,fontWeight:800,color:'#74B800'}}>🏆 Resultado</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>{timeAgo(item.created_at)}</div>
                      </div>
                      <div style={{fontSize:13,color:'#fff',fontWeight:800,marginBottom:4}}>{item.match?.club_name}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {(item.sets||[]).map((s,i)=>(
                          <div key={i} style={{padding:'4px 10px',borderRadius:8,background:'rgba(255,255,255,0.08)',fontSize:13,fontWeight:900,color:'#fff'}}>
                            {s.a}–{s.b}
                          </div>
                        ))}
                        {item.winner_side && (
                          <div style={{padding:'4px 10px',borderRadius:8,background:'rgba(116,184,0,0.2)',fontSize:11,fontWeight:900,color:'#74B800'}}>
                            Gana pareja {item.winner_side==='a'?'A':'B'} 🏆
                          </div>
                        )}
                      </div>
                    </div>
                  );

                  return null;
                })}
              </div>
            )}
          </main>
        )}
      </div>

      {showUpload && (
        <GorilandiaUpload 
          onClose={() => { setShowUpload(false); setPostMatchData(null); setPostMatchPlayers([]); }} 
          onSubmit={handleCreatePost} 
          uploading={uploading}
          matchData={postMatchData}
          matchPlayers={postMatchPlayers}
        />
      )}
    </div>
  );
}