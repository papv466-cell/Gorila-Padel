// src/pages/LeaguePage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const S = {
  page: { background:"#0a0a0a", minHeight:"100vh" },
  container: { maxWidth:480, margin:"0 auto", padding:"0 16px 80px" },
  header: { padding:"14px 0 10px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  title: { margin:0, fontSize:22, fontWeight:900, color:"#fff" },
  card: { background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", padding:16, marginBottom:10 },
  btn: (c) => ({ padding:"11px 16px", borderRadius:12, border:"none", cursor:"pointer", fontWeight:900, fontSize:13,
    background:c==="green"?"linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))":c==="ghost"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)",
    color:c==="green"?"#000":"#fff", width:"100%" }),
  input: { width:"100%", padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" },
  tab: (active) => ({ flex:1, padding:"10px 0", border:"none", cursor:"pointer", fontWeight:900, fontSize:12, background:"transparent", color:active?"var(--sport-color)":"rgba(255,255,255,0.4)", borderBottom:active?"2px solid var(--sport-color)":"2px solid transparent" }),
};

export default function LeaguePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("mis"); // mis | crear
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueTab, setLeagueTab] = useState("clasificacion"); // clasificacion | jornadas | resultado
  const [leagueMatches, setLeagueMatches] = useState([]);
  const [leaguePlayers, setLeaguePlayers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newLeague, setNewLeague] = useState({ name:"", jornadas:10, maxPlayers:8 });
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [resultModal, setResultModal] = useState(null);
  const [sets, setSets] = useState([{a:"",b:""}]);

  useEffect(() => {
    supabase.auth.getSession().then(({data})=>setSession(data?.session??null));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>{ if(_event==='TOKEN_REFRESHED') return; setSession(prev => prev?.user?.id === s?.user?.id && prev?.user?.id ? prev : s); });
    return ()=>subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session?.user?.id) loadLeagues(); }, [session?.user?.id]);

  async function loadLeagues() {
    setLoading(true);
    try {
      const {data} = await supabase.from("league_players")
        .select("league_id, status, leagues(id, name, status, jornadas, max_players, created_by, created_at)")
        .eq("user_id", session.user.id);
      setLeagues((data||[]).map(r=>({...r.leagues, myStatus:r.status})).filter(Boolean));
    } finally { setLoading(false); }
  }

  async function loadLeagueDetail(league) {
    setSelectedLeague(league);
    setLeagueTab("clasificacion");
    const [{data:matches},{data:players}] = await Promise.all([
      supabase.from("league_matches").select("*").eq("league_id",league.id).order("jornada"),
      supabase.from("league_players").select("user_id, status, profiles_public(name,handle,avatar_url)").eq("league_id",league.id),
    ]);
    setLeagueMatches(matches||[]);
    setLeaguePlayers((players||[]).map(p=>({...p,...p.profiles_public,id:p.user_id})));
  }

  async function createLeague() {
    if (!newLeague.name.trim()) return;
    try {
      setCreating(true);
      const {data:league, error} = await supabase.from("leagues").insert({
        name: newLeague.name.trim(),
        created_by: session.user.id,
        jornadas: newLeague.jornadas,
        max_players: newLeague.maxPlayers,
      }).select().single();
      if (error) throw error;
      // Añadir creador
      await supabase.from("league_players").insert({league_id:league.id, user_id:session.user.id, status:"accepted"});
      // Invitar usuarios
      for (const u of invitedUsers) {
        await supabase.from("league_players").insert({league_id:league.id, user_id:u.id, status:"invited"});
      }
      setNewLeague({name:"",jornadas:10,maxPlayers:8});
      setInvitedUsers([]);
      await loadLeagues();
      setTab("mis");
    } catch(e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function searchPlayers(q) {
    if (!q.trim()) { setInviteResults([]); return; }
    const {data} = await supabase.from("profiles_public").select("id,name,handle,avatar_url")
      .or(`name.ilike.%${q}%,handle.ilike.%${q}%`).limit(8);
    setInviteResults((data||[]).filter(p=>p.id!==session.user.id && !invitedUsers.find(u=>u.id===p.id)));
  }

  async function saveResult() {
    if (!resultModal) return;
    const validSets = sets.filter(s=>s.a!==""&&s.b!=="");
    if (!validSets.length) return;
    let winsA=0, winsB=0;
    validSets.forEach(s=>{ if(parseInt(s.a)>parseInt(s.b)) winsA++; else if(parseInt(s.b)>parseInt(s.a)) winsB++; });
    const winner = winsA>winsB?"a":winsB>winsA?"b":null;
    await supabase.from("league_matches").update({sets:validSets, winner_side:winner, played_at:new Date().toISOString()}).eq("id",resultModal.id);
    setSets([{a:"",b:""}]);
    setResultModal(null);
    await loadLeagueDetail(selectedLeague);
  }

  // Clasificación calculada
  const clasificacion = useMemo(() => {
    if (!leaguePlayers.length) return [];
    const stats = {};
    leaguePlayers.forEach(p=>{ stats[p.id]={...p, pj:0, pg:0, pp:0, pts:0, sf:0, sc:0}; });
    leagueMatches.filter(m=>m.winner_side).forEach(m=>{
      const players = {a:[m.player_a1,m.player_a2], b:[m.player_b1,m.player_b2]};
      const sets = m.sets||[];
      let sf=0,sc=0,sfb=0,scb=0;
      sets.forEach(s=>{ sf+=parseInt(s.a||0); sc+=parseInt(s.b||0); sfb+=parseInt(s.b||0); scb+=parseInt(s.a||0); });
      ["a","b"].forEach(side=>{
        const isWinner = m.winner_side===side;
        players[side].filter(Boolean).forEach(uid=>{
          if (!stats[uid]) return;
          stats[uid].pj++;
          if (isWinner) { stats[uid].pg++; stats[uid].pts+=3; }
          else stats[uid].pp++;
          stats[uid].sf += side==="a"?sf:sfb;
          stats[uid].sc += side==="a"?sc:scb;
        });
      });
    });
    return Object.values(stats).sort((a,b)=>b.pts-a.pts||(b.sf-b.sc)-(a.sf-a.sc));
  }, [leaguePlayers, leagueMatches]);

  // Jornadas agrupadas
  const jornadasGroup = useMemo(() => {
    const map = {};
    leagueMatches.forEach(m=>{ if(!map[m.jornada]) map[m.jornada]=[]; map[m.jornada].push(m); });
    return Object.entries(map).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
  }, [leagueMatches]);

  function playerName(id) {
    const p = leaguePlayers.find(x=>x.id===id);
    return p?.name||p?.handle||"Jugador";
  }

  // ─── VISTA DETALLE LIGA ───
  if (selectedLeague) return (
    <div className="page pageWithHeader" style={S.page}>
      <div style={S.container}>
        <div style={{...S.header, flexDirection:"column", alignItems:"flex-start", gap:8}}>
          <button onClick={()=>setSelectedLeague(null)} style={{...S.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:12}}>← Volver</button>
          <div>
            <h1 style={{...S.title, fontSize:20}}>🏆 {selectedLeague.name}</h1>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{leaguePlayers.length} jugadores · {selectedLeague.jornadas} jornadas</div>
          </div>
        </div>

        {/* Tabs liga */}
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          {[{key:"clasificacion",label:"📊 Clasificación"},{key:"jornadas",label:"🗓️ Jornadas"},{key:"nuevo",label:"➕ Partido"}].map(t=>(
            <button key={t.key} style={S.tab(leagueTab===t.key)} onClick={()=>setLeagueTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* CLASIFICACIÓN */}
        {leagueTab==="clasificacion" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto auto auto",gap:"6px 8px",alignItems:"center",padding:"6px 10px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1}}>
              <span>#</span><span>Jugador</span><span>PJ</span><span>PG</span><span>PP</span><span>PTS</span>
            </div>
            {clasificacion.map((p,i)=>(
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto auto auto",gap:"6px 8px",alignItems:"center",padding:"10px",borderRadius:10,marginBottom:4,
                background:p.id===session?.user?.id?"rgba(var(--sport-color-rgb, 46,204,113),0.08)":"rgba(255,255,255,0.03)",
                border:p.id===session?.user?.id?"1px solid rgba(var(--sport-color-rgb, 46,204,113),0.2)":"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{fontSize:14,fontWeight:900,color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.4)",minWidth:20,textAlign:"center"}}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                </span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {p.avatar_url?<img src={p.avatar_url} style={{width:28,height:28,borderRadius:999,objectFit:"cover"}} alt=""/>
                    :<div style={{width:28,height:28,borderRadius:999,background:"rgba(var(--sport-color-rgb, 46,204,113),0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🦍</div>}
                  <span style={{fontSize:12,fontWeight:800,color:p.id===session?.user?.id?"var(--sport-color)":"#fff"}}>{p.name||p.handle||"Jugador"}</span>
                </div>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>{p.pj}</span>
                <span style={{fontSize:12,color:"var(--sport-color)",textAlign:"center",fontWeight:800}}>{p.pg}</span>
                <span style={{fontSize:12,color:"rgba(255,100,100,0.7)",textAlign:"center"}}>{p.pp}</span>
                <span style={{fontSize:14,fontWeight:900,color:"#fff",textAlign:"center"}}>{p.pts}</span>
              </div>
            ))}
            {clasificacion.length===0&&<div style={{textAlign:"center",padding:30,color:"rgba(255,255,255,0.3)",fontSize:13}}>Sin partidos jugados aún</div>}
          </div>
        )}

        {/* JORNADAS */}
        {leagueTab==="jornadas" && (
          <div>
            {jornadasGroup.length===0&&<div style={{textAlign:"center",padding:30,color:"rgba(255,255,255,0.3)",fontSize:13}}>Sin jornadas creadas</div>}
            {jornadasGroup.map(([jornada, matches])=>(
              <div key={jornada} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Jornada {jornada}</div>
                {matches.map(m=>(
                  <div key={m.id} style={{...S.card, padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>
                        <span style={{color:m.winner_side==="a"?"var(--sport-color)":"#fff"}}>{playerName(m.player_a1)} / {playerName(m.player_a2)}</span>
                        <span style={{color:"rgba(255,255,255,0.3)",margin:"0 6px"}}>vs</span>
                        <span style={{color:m.winner_side==="b"?"var(--sport-color)":"#fff"}}>{playerName(m.player_b1)} / {playerName(m.player_b2)}</span>
                      </div>
                    </div>
                    {m.sets?.length ? (
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {m.sets.map((s,i)=><div key={i} style={{padding:"3px 10px",borderRadius:6,background:"rgba(255,255,255,0.08)",fontSize:13,fontWeight:900,color:"#fff"}}>{s.a}–{s.b}</div>)}
                        <div style={{padding:"3px 10px",borderRadius:6,background:"rgba(var(--sport-color-rgb, 46,204,113),0.15)",fontSize:11,fontWeight:900,color:"var(--sport-color)"}}>
                          Gana {m.winner_side==="a"?`${playerName(m.player_a1)}/${playerName(m.player_a2)}`:`${playerName(m.player_b1)}/${playerName(m.player_b2)}`} 🏆
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>{setResultModal(m);setSets([{a:"",b:""}]);}} style={{...S.btn("ghost"),fontSize:11,padding:"7px"}}>📝 Añadir resultado</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* NUEVO PARTIDO */}
        {leagueTab==="nuevo" && (
          <NewMatchForm league={selectedLeague} players={leaguePlayers} session={session} onSaved={()=>{ loadLeagueDetail(selectedLeague); setLeagueTab("jornadas"); }} jornadasGroup={jornadasGroup} />
        )}
      </div>

      {/* MODAL RESULTADO */}
      {resultModal && (
        <div onClick={()=>setResultModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:99999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(480px,100%)",background:"#111",borderRadius:"20px 20px 0 0",border:"1px solid rgba(var(--sport-color-rgb, 46,204,113),0.2)",padding:24,paddingBottom:"max(24px,env(safe-area-inset-bottom))"}}>
            <div style={{fontSize:16,fontWeight:900,color:"var(--sport-color)",marginBottom:4}}>📝 Resultado</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:16}}>
              {playerName(resultModal.player_a1)}/{playerName(resultModal.player_a2)} vs {playerName(resultModal.player_b1)}/{playerName(resultModal.player_b2)}
            </div>
            {sets.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:10}}>
                <input style={{width:60,padding:"10px 6px",borderRadius:10,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:22,fontWeight:900,textAlign:"center",outline:"none"}}
                  type="number" min="0" max="7" value={s.a} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,a:e.target.value}:x))} />
                <span style={{fontSize:18,color:"rgba(255,255,255,0.3)"}}>–</span>
                <input style={{width:60,padding:"10px 6px",borderRadius:10,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:22,fontWeight:900,textAlign:"center",outline:"none"}}
                  type="number" min="0" max="7" value={s.b} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,b:e.target.value}:x))} />
                <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Set {i+1}</span>
              </div>
            ))}
            {sets.length<3&&<button onClick={()=>setSets(p=>[...p,{a:"",b:""}])} style={{...S.btn("ghost"),fontSize:12,padding:"8px",marginBottom:12}}>+ Set</button>}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={saveResult} style={S.btn("green")}>✅ Guardar</button>
              <button onClick={()=>setResultModal(null)} style={{...S.btn("ghost"),width:"auto",padding:"11px 16px"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── VISTA PRINCIPAL ───
  return (
    <div className="page pageWithHeader" style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <h1 style={S.title}>🏆 <span style={{color:"var(--sport-color)"}}>Ligas</span></h1>
          <button onClick={()=>setTab(tab==="crear"?"mis":"crear")} style={{...S.btn("green"),width:"auto",padding:"9px 16px"}}>
            {tab==="crear"?"← Volver":"➕ Crear liga"}
          </button>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          {[{key:"mis",label:"Mis ligas"},{key:"crear",label:"➕ Crear"}].map(t=>(
            <button key={t.key} style={S.tab(tab===t.key)} onClick={()=>setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* MIS LIGAS */}
        {tab==="mis" && (
          loading ? <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.4)"}}>⏳ Cargando…</div>
          : leagues.length===0 ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:48,marginBottom:12}}>🏆</div>
              <div style={{fontWeight:900,color:"#fff",fontSize:16,marginBottom:6}}>Sin ligas todavía</div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,marginBottom:20}}>Crea una liga con tus amigos</div>
              <button onClick={()=>setTab("crear")} style={{...S.btn("green"),width:"auto",padding:"11px 20px"}}>➕ Crear liga</button>
            </div>
          ) : leagues.map(l=>(
            <div key={l.id} onClick={()=>loadLeagueDetail(l)} style={{...S.card, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{l.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{l.jornadas} jornadas · {l.myStatus==="invited"?"⏳ Invitado":"✅ Miembro"}</div>
              </div>
              <div style={{fontSize:20,color:"rgba(255,255,255,0.3)"}}>›</div>
            </div>
          ))
        )}

        {/* CREAR LIGA */}
        {tab==="crear" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",display:"block",marginBottom:5}}>Nombre de la liga</label>
              <input style={S.input} placeholder="Ej: Liga Inacua Primavera 2026" value={newLeague.name} onChange={e=>setNewLeague(p=>({...p,name:e.target.value}))} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",display:"block",marginBottom:5}}>Jornadas</label>
                <input style={S.input} type="number" min="2" max="30" value={newLeague.jornadas} onChange={e=>setNewLeague(p=>({...p,jornadas:parseInt(e.target.value)||10}))} />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",display:"block",marginBottom:5}}>Máx. jugadores</label>
                <input style={S.input} type="number" min="4" max="20" value={newLeague.maxPlayers} onChange={e=>setNewLeague(p=>({...p,maxPlayers:parseInt(e.target.value)||8}))} />
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",display:"block",marginBottom:5}}>Invitar jugadores</label>
              <input style={S.input} placeholder="Buscar por nombre o apodo…" value={inviteSearch}
                onChange={e=>{ setInviteSearch(e.target.value); searchPlayers(e.target.value); }} />
              {inviteResults.length>0&&(
                <div style={{background:"#1a1a1a",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",marginTop:4,overflow:"hidden"}}>
                  {inviteResults.map(p=>(
                    <div key={p.id} onClick={()=>{ setInvitedUsers(prev=>[...prev,p]); setInviteSearch(""); setInviteResults([]); }}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                      {p.avatar_url?<img src={p.avatar_url} style={{width:32,height:32,borderRadius:999,objectFit:"cover"}} alt=""/>
                        :<div style={{width:32,height:32,borderRadius:999,background:"rgba(var(--sport-color-rgb, 46,204,113),0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🦍</div>}
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:"#fff"}}>{p.name||p.handle}</div>
                        {p.handle&&p.name&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>@{p.handle}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invitedUsers.length>0&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {invitedUsers.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:20,background:"rgba(var(--sport-color-rgb, 46,204,113),0.12)",border:"1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)"}}>
                      <span style={{fontSize:12,fontWeight:800,color:"var(--sport-color)"}}>{u.name||u.handle}</span>
                      <span onClick={()=>setInvitedUsers(p=>p.filter(x=>x.id!==u.id))} style={{cursor:"pointer",fontSize:12,color:"rgba(255,255,255,0.4)"}}>✕</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={createLeague} disabled={creating||!newLeague.name.trim()} style={{...S.btn("green"),marginTop:8,opacity:!newLeague.name.trim()?0.5:1}}>
              {creating?"Creando…":"🏆 Crear Liga"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewMatchForm({league, players, session, onSaved, jornadasGroup}) {
  const [pa1, setPa1] = useState("");
  const [pa2, setPa2] = useState("");
  const [pb1, setPb1] = useState("");
  const [pb2, setPb2] = useState("");
  const [jornada, setJornada] = useState(jornadasGroup.length+1);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!pa1||!pa2||!pb1||!pb2) { alert("Selecciona los 4 jugadores"); return; }
    if (new Set([pa1,pa2,pb1,pb2]).size!==4) { alert("Los 4 jugadores deben ser distintos"); return; }
    try {
      setSaving(true);
      await supabase.from("league_matches").insert({
        league_id: league.id, jornada,
        player_a1:pa1, player_a2:pa2, player_b1:pb1, player_b2:pb2,
      });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const sel = (val, onChange, exclude=[]) => (
    <select value={val} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"9px 10px",borderRadius:10,background:"#1a1a1a",border:"1px solid rgba(255,255,255,0.12)",color:val?"#fff":"rgba(255,255,255,0.3)",fontSize:12,outline:"none"}}>
      <option value="">Seleccionar…</option>
      {players.filter(p=>!exclude.includes(p.id)).map(p=>(
        <option key={p.id} value={p.id} style={{background:"#1a1a1a"}}>{p.name||p.handle||"Jugador"}</option>
      ))}
    </select>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div>
        <label style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:5}}>Jornada</label>
        <input type="number" min="1" value={jornada} onChange={e=>setJornada(parseInt(e.target.value)||1)}
          style={{width:"100%",padding:"9px 10px",borderRadius:10,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}} />
      </div>
      <div style={{padding:14,borderRadius:12,background:"rgba(var(--sport-color-rgb, 46,204,113),0.06)",border:"1px solid rgba(var(--sport-color-rgb, 46,204,113),0.15)"}}>
        <div style={{fontSize:11,fontWeight:800,color:"var(--sport-color)",marginBottom:8}}>PAREJA A</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {sel(pa1,setPa1,[pa2,pb1,pb2])}
          {sel(pa2,setPa2,[pa1,pb1,pb2])}
        </div>
      </div>
      <div style={{padding:14,borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",marginBottom:8}}>PAREJA B</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {sel(pb1,setPb1,[pa1,pa2,pb2])}
          {sel(pb2,setPb2,[pa1,pa2,pb1])}
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{padding:"12px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:900,fontSize:14,background:"linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))",color:"#000"}}>
        {saving?"Guardando…":"✅ Crear partido de liga"}
      </button>
    </div>
  );
}
