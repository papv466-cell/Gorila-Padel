// src/pages/LeaguePage.jsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const CATEGORIES = [
  { key: "iniciacion",  label: "Iniciación",   emoji: "🌱", desc: "Para quienes empiezan" },
  { key: "intermedio",  label: "Intermedio",   emoji: "🎾", desc: "Nivel medio" },
  { key: "avanzado",    label: "Avanzado",     emoji: "⚡", desc: "Nivel alto" },
  { key: "competicion", label: "Competición",  emoji: "🏆", desc: "Nivel competitivo" },
  { key: "mixta",       label: "Mixta",        emoji: "🤝", desc: "Todos los niveles" },
  { key: "wheelchair",  label: "Silla de ruedas", emoji: "♿", desc: "Jugadores en silla" },
  { key: "blind",       label: "Baja visión",  emoji: "🦯", desc: "Ceguera o baja visión" },
  { key: "down",        label: "Síndrome Down",emoji: "💙", desc: "Síndrome de Down" },
  { key: "senior",      label: "Senior +60",   emoji: "👴", desc: "Mayores de 60 años" },
  { key: "kids",        label: "Juvenil",      emoji: "👦", desc: "Menores de 18 años" },
];

const S = {
  page: { background:"#050505", minHeight:"100vh", color:"#fff" },
  wrap: { maxWidth:600, margin:"0 auto", padding:"90px 16px 80px" },
  card: { background:"#111827", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", padding:"16px 18px", marginBottom:10 },
  btn: (c) => ({
    minHeight:48, padding:"12px 18px", borderRadius:14, border:"none", cursor:"pointer", fontWeight:900, fontSize:14,
    background: c==="primary" ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))" :
                c==="danger"  ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.07)",
    color: c==="primary" ? "#000" : c==="danger" ? "#ff6b6b" : "#fff",
    border: c==="danger" ? "1px solid rgba(220,38,38,0.25)" : "none",
  }),
  input: { width:"100%", minHeight:48, padding:"12px 16px", borderRadius:12, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontSize:15, boxSizing:"border-box" },
  label: { display:"block", fontSize:13, fontWeight:800, color:"rgba(255,255,255,0.55)", marginBottom:6 },
};

// Cálculo ELO
function calcElo(ratingA, ratingB, scoreA) {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newA = Math.round(ratingA + K * (scoreA - expectedA));
  const newB = Math.round(ratingB + K * ((1 - scoreA) - (1 - expectedA)));
  return { newA, newB, changeA: newA - ratingA, changeB: newB - ratingB };
}

export default function LeaguePage() {
  const { sportInfo } = useSport();
  const { session } = useSession();
  const sportColor = sportInfo?.color || "#2ECC71";

  const [view, setView] = useState("list"); // list | detail | create
  const [leagues, setLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueTab, setLeagueTab] = useState("clasificacion");
  const [pairs, setPairs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [resultModal, setResultModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [joinModal, setJoinModal] = useState(false);
  const [addMatchModal, setAddMatchModal] = useState(false);

  // Formularios
  const [sets, setSets] = useState([{a:"",b:""}]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("19:00");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [pairName, setPairName] = useState("");

  // Crear liga
  const [newLeague, setNewLeague] = useState({
    name:"", category:"mixta", sport: sportInfo?.key || "padel",
    description:"", jornadas:10, max_pairs:8, price_per_player:0, is_public:true
  });
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [creating, setCreating] = useState(false);

  // Nuevo partido
  const [newMatch, setNewMatch] = useState({ pairA:"", pairB:"", jornada:1 });

  useEffect(() => { loadLeagues(); }, [session?.user?.id]);

  async function loadLeagues() {
    setLoading(true);
    try {
      const [myRes, pubRes] = await Promise.all([
        session?.user?.id ? supabase.from("league_pairs")
          .select("league_id, leagues(*)")
          .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`) : { data: [] },
        supabase.from("leagues").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20),
      ]);
      const myLeagues = (myRes.data || []).map(r => r.leagues).filter(Boolean);
      setLeagues(myLeagues);
      setPublicLeagues((pubRes.data || []).filter(l => !myLeagues.find(m => m.id === l.id)));
    } finally { setLoading(false); }
  }

  async function loadLeagueDetail(league) {
    setSelectedLeague(league);
    setLeagueTab("clasificacion");
    setView("detail");
    const [pairsRes, matchesRes] = await Promise.all([
      supabase.from("league_pairs").select("*, p1:profiles!league_pairs_player1_id_fkey(name,avatar_url), p2:profiles!league_pairs_player2_id_fkey(name,avatar_url)").eq("league_id", league.id),
      supabase.from("league_matches").select("*").eq("league_id", league.id).order("jornada"),
    ]);
    setPairs(pairsRes.data || []);
    setMatches(matchesRes.data || []);
  }

  async function createLeague() {
    if (!session) return;
    if (!newLeague.name.trim()) return;
    setCreating(true);
    try {
      const { data: league, error } = await supabase.from("leagues").insert({
        name: newLeague.name.trim(),
        created_by: session.user.id,
        category: newLeague.category,
        sport: newLeague.sport,
        description: newLeague.description,
        jornadas: newLeague.jornadas,
        max_players: newLeague.max_pairs * 2,
        is_public: newLeague.is_public,
        price_per_player: newLeague.price_per_player,
        status: "active",
      }).select().single();
      if (error) throw error;
      await loadLeagues();
      setView("list");
      setNewLeague({ name:"", category:"mixta", sport: sportInfo?.key || "padel", description:"", jornadas:10, max_pairs:8, price_per_player:0, is_public:true });
    } catch(e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function joinLeague() {
    if (!session || !selectedPartner) return;
    try {
      const name = pairName.trim() || `${session.user.user_metadata?.name || "Yo"} / ${selectedPartner.name}`;
      await supabase.from("league_pairs").insert({
        league_id: selectedLeague.id,
        player1_id: session.user.id,
        player2_id: selectedPartner.id,
        pair_name: name,
        elo: 1000,
      });
      setJoinModal(false);
      setSelectedPartner(null);
      setPairName("");
      await loadLeagueDetail(selectedLeague);
    } catch(e) { alert(e.message); }
  }

  async function addMatch() {
    if (!newMatch.pairA || !newMatch.pairB || newMatch.pairA === newMatch.pairB) {
      alert("Selecciona dos parejas distintas"); return;
    }
    await supabase.from("league_matches").insert({
      league_id: selectedLeague.id,
      pair_a_id: newMatch.pairA,
      pair_b_id: newMatch.pairB,
      jornada: newMatch.jornada,
    });
    setAddMatchModal(false);
    setNewMatch({ pairA:"", pairB:"", jornada: matches.length > 0 ? Math.max(...matches.map(m=>m.jornada)) + 1 : 1 });
    await loadLeagueDetail(selectedLeague);
  }

  async function saveSchedule() {
    if (!scheduleModal || !scheduleDate) return;
    const dt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    await supabase.from("league_matches").update({ scheduled_at: dt }).eq("id", scheduleModal.id);
    setScheduleModal(null);
    await loadLeagueDetail(selectedLeague);
  }

  async function saveResult() {
    if (!resultModal) return;
    const validSets = sets.filter(s => s.a !== "" && s.b !== "");
    if (!validSets.length) return;
    let winsA = 0, winsB = 0;
    validSets.forEach(s => { if (parseInt(s.a) > parseInt(s.b)) winsA++; else if (parseInt(s.b) > parseInt(s.a)) winsB++; });
    const winner = winsA > winsB ? "a" : winsB > winsA ? "b" : null;

    // Calcular ELO
    const pairA = pairs.find(p => p.id === resultModal.pair_a_id);
    const pairB = pairs.find(p => p.id === resultModal.pair_b_id);
    let eloChange = { changeA: 0, changeB: 0, newA: pairA?.elo || 1000, newB: pairB?.elo || 1000 };
    if (winner && pairA && pairB) {
      eloChange = calcElo(pairA.elo || 1000, pairB.elo || 1000, winner === "a" ? 1 : 0);
    }

    await supabase.from("league_matches").update({
      sets: validSets, winner_side: winner,
      played_at: new Date().toISOString(),
      elo_change_a: eloChange.changeA,
      elo_change_b: eloChange.changeB,
    }).eq("id", resultModal.id);

    // Actualizar stats de parejas
    if (pairA) {
      await supabase.from("league_pairs").update({
        elo: eloChange.newA,
        pj: (pairA.pj || 0) + 1,
        pg: (pairA.pg || 0) + (winner === "a" ? 1 : 0),
        pp: (pairA.pp || 0) + (winner === "b" ? 1 : 0),
        pts: (pairA.pts || 0) + (winner === "a" ? 3 : winner === null ? 1 : 0),
        sets_favor: (pairA.sets_favor || 0) + winsA,
        sets_contra: (pairA.sets_contra || 0) + winsB,
      }).eq("id", pairA.id);
    }
    if (pairB) {
      await supabase.from("league_pairs").update({
        elo: eloChange.newB,
        pj: (pairB.pj || 0) + 1,
        pg: (pairB.pg || 0) + (winner === "b" ? 1 : 0),
        pp: (pairB.pp || 0) + (winner === "a" ? 1 : 0),
        pts: (pairB.pts || 0) + (winner === "b" ? 3 : winner === null ? 1 : 0),
        sets_favor: (pairB.sets_favor || 0) + winsB,
        sets_contra: (pairB.sets_contra || 0) + winsA,
      }).eq("id", pairB.id);
    }

    setSets([{a:"",b:""}]);
    setResultModal(null);
    await loadLeagueDetail(selectedLeague);
  }

  async function searchPartner(q) {
    if (!q.trim()) { setPartnerResults([]); return; }
    const { data } = await supabase.from("profiles").select("id,name,handle,avatar_url")
      .or(`name.ilike.%${q}%,handle.ilike.%${q}%`).neq("id", session?.user?.id).limit(8);
    setPartnerResults(data || []);
  }

  function pairLabel(pairId) {
    const p = pairs.find(x => x.id === pairId);
    if (!p) return "Pareja";
    return p.pair_name || `${p.p1?.name || "J1"} / ${p.p2?.name || "J2"}`;
  }

  const myPair = pairs.find(p => p.player1_id === session?.user?.id || p.player2_id === session?.user?.id);
  const isCreator = selectedLeague?.created_by === session?.user?.id;
  const sortedPairs = [...pairs].sort((a,b) => (b.pts||0)-(a.pts||0) || (b.sets_favor-b.sets_contra)-(a.sets_favor-a.sets_contra) || (b.elo||1000)-(a.elo||1000));
  const jornadasGroup = useMemo(() => {
    const map = {};
    matches.forEach(m => { if(!map[m.jornada]) map[m.jornada]=[]; map[m.jornada].push(m); });
    return Object.entries(map).sort((a,b) => parseInt(a[0])-parseInt(b[0]));
  }, [matches]);

  // ════════════════════════════════════════
  // VISTA: LISTA DE LIGAS
  // ════════════════════════════════════════
  if (view === "list") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:900, margin:0 }}>🏆 <span style={{ color:sportColor }}>Ligas</span></h1>
            <p style={{ fontSize:14, color:"rgba(255,255,255,0.50)", margin:"4px 0 0" }}>Compite en parejas por la clasificación</p>
          </div>
          {session && (
            <button onClick={() => setView("create")} style={{ ...S.btn("primary"), padding:"10px 18px" }}>
              + Crear liga
            </button>
          )}
        </div>

        {/* Cómo funciona */}
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:16, padding:"16px 20px", marginBottom:24, border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:14, fontWeight:900, color:sportColor, marginBottom:10 }}>¿Cómo funciona?</div>
          {[
            "1️⃣ Únete a una liga con tu pareja",
            "2️⃣ Jugáis los partidos cuando queráis — quedáis con los rivales",
            "3️⃣ Vais al club, pagáis la pista y jugáis",
            "4️⃣ Ponéis el resultado en la app",
            "5️⃣ La clasificación se actualiza sola 🎉",
          ].map(s => <div key={s} style={{ fontSize:13, color:"rgba(255,255,255,0.65)", marginBottom:5 }}>{s}</div>)}
          <div style={{ marginTop:10, padding:"8px 12px", borderRadius:10, background:"rgba(var(--sport-color-rgb,46,204,113),0.08)", border:`1px solid ${sportColor}25`, fontSize:12, color:sportColor, fontWeight:700 }}>
            🏅 Sistema ELO — ganas más puntos derrotando a rivales fuertes
          </div>
        </div>

        {/* Mis ligas */}
        {leagues.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:14, fontWeight:900, color:"rgba(255,255,255,0.50)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Mis ligas</div>
            {leagues.map(l => <LeagueCard key={l.id} league={l} onClick={() => loadLeagueDetail(l)} sportColor={sportColor} />)}
          </div>
        )}

        {/* Ligas públicas */}
        {publicLeagues.length > 0 && (
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:"rgba(255,255,255,0.50)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Ligas abiertas</div>
            {publicLeagues.map(l => <LeagueCard key={l.id} league={l} onClick={() => loadLeagueDetail(l)} sportColor={sportColor} />)}
          </div>
        )}

        {leagues.length === 0 && publicLeagues.length === 0 && !loading && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🏆</div>
            <div style={{ fontSize:20, fontWeight:900, marginBottom:8 }}>No hay ligas todavía</div>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.50)", marginBottom:24 }}>¡Sé el primero en crear una!</div>
            {session && <button onClick={() => setView("create")} style={{ ...S.btn("primary") }}>+ Crear primera liga</button>}
          </div>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════
  // VISTA: CREAR LIGA
  // ════════════════════════════════════════
  if (view === "create") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button onClick={() => setView("list")} style={{ ...S.btn("ghost"), marginBottom:20, width:"auto" }}>← Volver</button>
        <h1 style={{ fontSize:22, fontWeight:900, marginBottom:20 }}>🏆 Crear liga</h1>

        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div>
            <label style={S.label}>Nombre de la liga *</label>
            <input style={S.input} placeholder="Ej: Liga Inacua Primavera 2026" value={newLeague.name} onChange={e=>setNewLeague(p=>({...p,name:e.target.value}))} />
          </div>

          <div>
            <label style={S.label}>Categoría *</label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.key} type="button" onClick={() => setNewLeague(p=>({...p,category:cat.key}))}
                  style={{ minHeight:56, padding:"12px 16px", borderRadius:14, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14,
                    border: newLeague.category===cat.key ? `2px solid ${sportColor}` : "1px solid rgba(255,255,255,0.10)",
                    background: newLeague.category===cat.key ? `${sportColor}15` : "rgba(255,255,255,0.04)",
                    color:"#fff", fontWeight:700, fontSize:15 }}>
                  <span style={{ fontSize:22 }}>{cat.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:900 }}>{cat.label}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.50)", marginTop:2 }}>{cat.desc}</div>
                  </div>
                  {newLeague.category===cat.key && <span style={{ color:sportColor }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={S.label}>Descripción (opcional)</label>
            <textarea value={newLeague.description} onChange={e=>setNewLeague(p=>({...p,description:e.target.value}))}
              placeholder="Explica las reglas, formato, dónde se juega…"
              style={{ ...S.input, minHeight:80, resize:"vertical" }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={S.label}>Jornadas</label>
              <input type="number" min="2" max="30" value={newLeague.jornadas} onChange={e=>setNewLeague(p=>({...p,jornadas:parseInt(e.target.value)||10}))} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Máx. parejas</label>
              <input type="number" min="2" max="20" value={newLeague.max_pairs} onChange={e=>setNewLeague(p=>({...p,max_pairs:parseInt(e.target.value)||8}))} style={S.input} />
            </div>
          </div>

          <button type="button" onClick={() => setNewLeague(p=>({...p,is_public:!p.is_public}))}
            style={{ ...S.btn(newLeague.is_public?"primary":"ghost"), display:"flex", alignItems:"center", gap:12, justifyContent:"flex-start" }}>
            <span style={{ fontSize:20 }}>{newLeague.is_public ? "🌍" : "🔒"}</span>
            <div style={{ textAlign:"left" }}>
              <div>{newLeague.is_public ? "Liga pública — cualquiera puede unirse" : "Liga privada — solo por invitación"}</div>
            </div>
          </button>

          <button onClick={createLeague} disabled={creating || !newLeague.name.trim()}
            style={{ ...S.btn("primary"), width:"100%", minHeight:56, fontSize:17, opacity: !newLeague.name.trim() ? 0.5 : 1 }}>
            {creating ? "⏳ Creando…" : "🏆 Crear liga"}
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════
  // VISTA: DETALLE LIGA
  // ════════════════════════════════════════
  const cat = CATEGORIES.find(c => c.key === selectedLeague?.category);

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <button onClick={() => { setView("list"); setSelectedLeague(null); }} style={{ ...S.btn("ghost"), marginBottom:16, width:"auto" }}>← Volver</button>

        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:28 }}>{cat?.emoji || "🏆"}</span>
            <h1 style={{ fontSize:22, fontWeight:900, margin:0 }}>{selectedLeague?.name}</h1>
            <span style={{ fontSize:12, padding:"4px 10px", borderRadius:999, background:`${sportColor}15`, color:sportColor, fontWeight:900 }}>{cat?.label}</span>
          </div>
          {selectedLeague?.description && <p style={{ fontSize:14, color:"rgba(255,255,255,0.55)", margin:"0 0 8px" }}>{selectedLeague.description}</p>}
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.40)" }}>{pairs.length} parejas · {selectedLeague?.jornadas} jornadas · Sistema ELO</div>
        </div>

        {/* Acciones */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          {session && !myPair && (
            <button onClick={() => setJoinModal(true)} style={{ ...S.btn("primary") }}>🤝 Unirme con mi pareja</button>
          )}
          {isCreator && (
            <button onClick={() => { setAddMatchModal(true); setNewMatch({ pairA:"", pairB:"", jornada: matches.length > 0 ? Math.max(...matches.map(m=>m.jornada)) : 1 }); }}
              style={{ ...S.btn("ghost") }}>+ Añadir partido</button>
          )}
          {myPair && (
            <div style={{ padding:"8px 14px", borderRadius:12, background:`${sportColor}10`, border:`1px solid ${sportColor}25`, fontSize:13, fontWeight:700, color:sportColor }}>
              ✅ Tu pareja: {myPair.pair_name || `${myPair.p1?.name} / ${myPair.p2?.name}`}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)", marginBottom:20, gap:4 }}>
          {[
            { key:"clasificacion", label:"📊 Clasificación" },
            { key:"jornadas",      label:"🗓️ Partidos" },
          ].map(t => (
            <button key={t.key} onClick={() => setLeagueTab(t.key)}
              style={{ flex:1, minHeight:44, border:"none", cursor:"pointer", fontWeight:900, fontSize:13, background:"transparent",
                color: leagueTab===t.key ? sportColor : "rgba(255,255,255,0.40)",
                borderBottom: leagueTab===t.key ? `2px solid ${sportColor}` : "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CLASIFICACIÓN */}
        {leagueTab === "clasificacion" && (
          <div>
            {/* Cabecera tabla */}
            <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 40px 40px 40px 40px 50px", gap:8, padding:"6px 10px", fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>
              <span>#</span><span>Pareja</span><span style={{textAlign:"center"}}>PJ</span><span style={{textAlign:"center"}}>PG</span><span style={{textAlign:"center"}}>PP</span><span style={{textAlign:"center"}}>PTS</span><span style={{textAlign:"center"}}>ELO</span>
            </div>
            {sortedPairs.map((p, i) => {
              const isMe = p.player1_id === session?.user?.id || p.player2_id === session?.user?.id;
              return (
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:"32px 1fr 40px 40px 40px 40px 50px", gap:8, alignItems:"center", padding:"12px 10px", borderRadius:12, marginBottom:4,
                  background: isMe ? `${sportColor}10` : "rgba(255,255,255,0.03)",
                  border: isMe ? `1px solid ${sportColor}30` : "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize:16, fontWeight:900, color: i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.40)", textAlign:"center" }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                  </span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:900, color: isMe ? sportColor : "#fff" }}>
                      {p.pair_name || `${p.p1?.name || "J1"} / ${p.p2?.name || "J2"}`}
                    </div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.40)", marginTop:1 }}>
                      SF {p.sets_favor || 0} · SC {p.sets_contra || 0}
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.50)", textAlign:"center" }}>{p.pj||0}</span>
                  <span style={{ fontSize:12, color:sportColor, fontWeight:900, textAlign:"center" }}>{p.pg||0}</span>
                  <span style={{ fontSize:12, color:"rgba(255,100,100,0.80)", textAlign:"center" }}>{p.pp||0}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:"#fff", textAlign:"center" }}>{p.pts||0}</span>
                  <span style={{ fontSize:12, fontWeight:800, color:"rgba(255,255,255,0.60)", textAlign:"center" }}>{p.elo||1000}</span>
                </div>
              );
            })}
            {sortedPairs.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.35)" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
                <div style={{ fontSize:16, fontWeight:900, marginBottom:8 }}>Sin parejas inscritas</div>
                <div style={{ fontSize:14 }}>¡Únete con tu pareja para aparecer aquí!</div>
              </div>
            )}

            {/* Leyenda puntos */}
            <div style={{ marginTop:16, padding:"12px 16px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", fontSize:12, color:"rgba(255,255,255,0.50)" }}>
              <div style={{ fontWeight:900, marginBottom:6 }}>Sistema de puntos:</div>
              <div>🏆 Victoria → 3 puntos · 🤝 Empate → 1 punto · ❌ Derrota → 0 puntos</div>
              <div style={{ marginTop:4 }}>⚡ ELO — sube más ganando a rivales fuertes, baja menos perdiendo con ellos</div>
            </div>
          </div>
        )}

        {/* PARTIDOS / JORNADAS */}
        {leagueTab === "jornadas" && (
          <div>
            {jornadasGroup.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.35)" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🗓️</div>
                <div style={{ fontSize:16, fontWeight:900, marginBottom:8 }}>Sin partidos todavía</div>
                {isCreator && <div style={{ fontSize:14 }}>Añade el primer partido desde el botón de arriba</div>}
              </div>
            )}

            {jornadasGroup.map(([jornada, jorMatches]) => (
              <div key={jornada} style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:900, color:"rgba(255,255,255,0.40)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>
                  Jornada {jornada}
                </div>
                {jorMatches.map(m => {
                  const pA = pairs.find(p => p.id === m.pair_a_id);
                  const pB = pairs.find(p => p.id === m.pair_b_id);
                  const isInvolved = myPair && (myPair.id === m.pair_a_id || myPair.id === m.pair_b_id);
                  return (
                    <div key={m.id} style={{ ...S.card, border: isInvolved ? `1px solid ${sportColor}30` : "1px solid rgba(255,255,255,0.08)" }}>
                      {/* Estado */}
                      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                        {m.winner_side ? (
                          <span style={{ fontSize:11, fontWeight:900, padding:"3px 10px", borderRadius:999, background:"rgba(46,204,113,0.15)", color:"#2ECC71" }}>✅ Jugado</span>
                        ) : m.scheduled_at ? (
                          <span style={{ fontSize:11, fontWeight:900, padding:"3px 10px", borderRadius:999, background:"rgba(245,158,11,0.12)", color:"#F59E0B" }}>📅 Fecha acordada</span>
                        ) : (
                          <span style={{ fontSize:11, fontWeight:900, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.40)" }}>⏳ Pendiente</span>
                        )}
                      </div>

                      {/* Equipos y resultado */}
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:m.sets?.length || m.scheduled_at ? 10 : 0 }}>
                        <div style={{ flex:1, textAlign:"center" }}>
                          <div style={{ fontSize:14, fontWeight:900, color: m.winner_side==="a" ? sportColor : "#fff" }}>
                            {m.winner_side==="a" && "🏆 "}{pA?.pair_name || `${pA?.p1?.name||"J1"} / ${pA?.p2?.name||"J2"}`}
                          </div>
                        </div>
                        <div style={{ flexShrink:0 }}>
                          {m.sets?.length ? (
                            <div style={{ display:"flex", gap:4 }}>
                              {m.sets.map((s,i) => (
                                <div key={i} style={{ padding:"4px 8px", borderRadius:8, background:"rgba(255,255,255,0.08)", fontSize:15, fontWeight:900, color:"#fff" }}>{s.a}–{s.b}</div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize:20, color:"rgba(255,255,255,0.25)", fontWeight:900 }}>vs</div>
                          )}
                        </div>
                        <div style={{ flex:1, textAlign:"center" }}>
                          <div style={{ fontSize:14, fontWeight:900, color: m.winner_side==="b" ? sportColor : "#fff" }}>
                            {m.winner_side==="b" && "🏆 "}{pB?.pair_name || `${pB?.p1?.name||"J1"} / ${pB?.p2?.name||"J2"}`}
                          </div>
                        </div>
                      </div>

                      {/* Fecha acordada */}
                      {m.scheduled_at && !m.winner_side && (
                        <div style={{ fontSize:12, color:"#F59E0B", padding:"8px 12px", borderRadius:10, background:"rgba(245,158,11,0.08)", marginBottom:10 }}>
                          📅 {new Date(m.scheduled_at).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})} · {new Date(m.scheduled_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      )}

                      {/* ELO change */}
                      {m.winner_side && m.elo_change_a !== 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(255,255,255,0.40)", marginBottom:10 }}>
                          <span>ELO: {m.elo_change_a > 0 ? "+" : ""}{m.elo_change_a}</span>
                          <span>ELO: {m.elo_change_b > 0 ? "+" : ""}{m.elo_change_b}</span>
                        </div>
                      )}

                      {/* Acciones */}
                      {!m.winner_side && isInvolved && (
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {!m.scheduled_at && (
                            <button onClick={() => { setScheduleModal(m); setScheduleDate(""); setScheduleTime("19:00"); }}
                              style={{ ...S.btn("ghost"), fontSize:12, padding:"8px 14px", width:"auto" }}>
                              📅 Acordar fecha
                            </button>
                          )}
                          <button onClick={() => { setResultModal(m); setSets([{a:"",b:""}]); }}
                            style={{ ...S.btn("ghost"), fontSize:12, padding:"8px 14px", width:"auto" }}>
                            📝 Poner resultado
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL UNIRSE ── */}
      {joinModal && (
        <div onClick={() => setJoinModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.90)", zIndex:50000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"min(600px,100%)", background:"#0f172a", borderRadius:"24px 24px 0 0", padding:"24px 20px", paddingBottom:"max(24px,env(safe-area-inset-bottom))", border:`1px solid ${sportColor}25` }}>
            <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:999, margin:"0 auto 20px" }} />
            <div style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>🤝 Unirme a la liga</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.50)", marginBottom:20 }}>Busca a tu pareja para inscribiros juntos</div>

            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Buscar pareja</label>
              <input value={partnerSearch} onChange={e => { setPartnerSearch(e.target.value); searchPartner(e.target.value); }}
                placeholder="Nombre o apodo de tu pareja…" style={S.input} />
              {partnerResults.length > 0 && (
                <div style={{ background:"#1e293b", borderRadius:12, marginTop:6, border:"1px solid rgba(255,255,255,0.10)", overflow:"hidden" }}>
                  {partnerResults.map(p => (
                    <div key={p.id} onClick={() => { setSelectedPartner(p); setPartnerSearch(p.name || p.handle); setPartnerResults([]); }}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ width:36, height:36, borderRadius:999, background:`${sportColor}20`, display:"grid", placeItems:"center", fontSize:16 }}>
                        {p.avatar_url ? <img src={p.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:999 }} alt="" /> : "🦍"}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{p.name || p.handle}</div>
                        {p.handle && p.name && <div style={{ fontSize:12, color:"rgba(255,255,255,0.40)" }}>@{p.handle}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPartner && (
              <div style={{ padding:"12px 16px", borderRadius:14, background:`${sportColor}10`, border:`1px solid ${sportColor}30`, marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:900, color:sportColor }}>Pareja seleccionada</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.70)" }}>{selectedPartner.name || selectedPartner.handle}</div>
                </div>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Nombre de vuestra pareja (opcional)</label>
              <input value={pairName} onChange={e => setPairName(e.target.value)} placeholder="Ej: Los Invencibles" style={S.input} />
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button onClick={joinLeague} disabled={!selectedPartner}
                style={{ ...S.btn("primary"), width:"100%", minHeight:52, fontSize:16, opacity: !selectedPartner ? 0.5 : 1 }}>
                🤝 Unirme a la liga
              </button>
              <button onClick={() => setJoinModal(false)} style={{ ...S.btn("ghost"), width:"100%", minHeight:48 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ACORDAR FECHA ── */}
      {scheduleModal && (
        <div onClick={() => setScheduleModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.90)", zIndex:50000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"min(600px,100%)", background:"#0f172a", borderRadius:"24px 24px 0 0", padding:"24px 20px", paddingBottom:"max(24px,env(safe-area-inset-bottom))", border:"1px solid rgba(245,158,11,0.25)" }}>
            <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:999, margin:"0 auto 20px" }} />
            <div style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>📅 Acordar fecha</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.50)", marginBottom:12 }}>{pairLabel(scheduleModal.pair_a_id)} vs {pairLabel(scheduleModal.pair_b_id)}</div>

            <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,255,255,0.04)", marginBottom:16, fontSize:13, color:"rgba(255,255,255,0.60)", lineHeight:1.7 }}>
              💡 Queda con tu rival, id al club, pagad la pista allí y jugad el partido. Después pon el resultado aquí.
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <label style={S.label}>Día</label>
                <input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Hora</label>
                <select value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} style={S.input}>
                  {["09:00","10:00","11:00","12:00","13:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"].map(t=>(
                    <option key={t} value={t} style={{background:"#1e293b"}}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={saveSchedule} disabled={!scheduleDate} style={{ ...S.btn("primary"), flex:1, minHeight:52, opacity:!scheduleDate?0.5:1 }}>✅ Confirmar fecha</button>
              <button onClick={() => setScheduleModal(null)} style={{ ...S.btn("ghost"), minHeight:52, padding:"14px 20px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RESULTADO ── */}
      {resultModal && (
        <div onClick={() => setResultModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.90)", zIndex:50000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"min(600px,100%)", background:"#0f172a", borderRadius:"24px 24px 0 0", padding:"24px 20px", paddingBottom:"max(24px,env(safe-area-inset-bottom))", border:`1px solid ${sportColor}25` }}>
            <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:999, margin:"0 auto 20px" }} />
            <div style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>📝 Poner resultado</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.50)", marginBottom:20 }}>
              {pairLabel(resultModal.pair_a_id)} vs {pairLabel(resultModal.pair_b_id)}
            </div>

            <div style={{ fontSize:13, color:"rgba(255,255,255,0.60)", marginBottom:16, padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.04)" }}>
              💡 Introduce el resultado set a set. El sistema calculará el ganador y actualizará el ELO automáticamente.
            </div>

            {sets.map((s, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:12 }}>
                <div style={{ textAlign:"center", flex:1 }}>
                  {i === 0 && <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.40)", marginBottom:6 }}>PAREJA A</div>}
                  <input type="number" min="0" max="7" value={s.a} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,a:e.target.value}:x))}
                    style={{ width:"100%", padding:"14px 8px", borderRadius:12, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:28, fontWeight:900, textAlign:"center", outline:"none" }} />
                </div>
                <div>
                  {i === 0 && <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.40)", marginBottom:6, textAlign:"center" }}>SET {i+1}</div>}
                  <div style={{ fontSize:20, color:"rgba(255,255,255,0.25)", fontWeight:900, textAlign:"center" }}>–</div>
                </div>
                <div style={{ textAlign:"center", flex:1 }}>
                  {i === 0 && <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.40)", marginBottom:6 }}>PAREJA B</div>}
                  <input type="number" min="0" max="7" value={s.b} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,b:e.target.value}:x))}
                    style={{ width:"100%", padding:"14px 8px", borderRadius:12, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:28, fontWeight:900, textAlign:"center", outline:"none" }} />
                </div>
              </div>
            ))}

            {sets.length < 3 && (
              <button onClick={() => setSets(p=>[...p,{a:"",b:""}])} style={{ ...S.btn("ghost"), width:"100%", fontSize:13, padding:"10px", marginBottom:16 }}>
                + Añadir set {sets.length + 1}
              </button>
            )}

            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button onClick={saveResult} style={{ ...S.btn("primary"), flex:1, minHeight:52, fontSize:16 }}>✅ Guardar resultado</button>
              <button onClick={() => setResultModal(null)} style={{ ...S.btn("ghost"), minHeight:52, padding:"14px 20px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AÑADIR PARTIDO (solo creador) ── */}
      {addMatchModal && (
        <div onClick={() => setAddMatchModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.90)", zIndex:50000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"min(600px,100%)", background:"#0f172a", borderRadius:"24px 24px 0 0", padding:"24px 20px", paddingBottom:"max(24px,env(safe-area-inset-bottom))", border:`1px solid ${sportColor}25` }}>
            <div style={{ width:40, height:4, background:"rgba(255,255,255,0.15)", borderRadius:999, margin:"0 auto 20px" }} />
            <div style={{ fontSize:20, fontWeight:900, marginBottom:20 }}>➕ Añadir partido</div>

            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Jornada</label>
              <input type="number" min="1" value={newMatch.jornada} onChange={e=>setNewMatch(p=>({...p,jornada:parseInt(e.target.value)||1}))} style={S.input} />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Pareja A</label>
              <select value={newMatch.pairA} onChange={e=>setNewMatch(p=>({...p,pairA:e.target.value}))} style={S.input}>
                <option value="">Seleccionar pareja…</option>
                {pairs.filter(p=>p.id!==newMatch.pairB).map(p=>(
                  <option key={p.id} value={p.id} style={{background:"#1e293b"}}>{p.pair_name || `${p.p1?.name||"J1"} / ${p.p2?.name||"J2"}`}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={S.label}>Pareja B</label>
              <select value={newMatch.pairB} onChange={e=>setNewMatch(p=>({...p,pairB:e.target.value}))} style={S.input}>
                <option value="">Seleccionar pareja…</option>
                {pairs.filter(p=>p.id!==newMatch.pairA).map(p=>(
                  <option key={p.id} value={p.id} style={{background:"#1e293b"}}>{p.pair_name || `${p.p1?.name||"J1"} / ${p.p2?.name||"J2"}`}</option>
                ))}
              </select>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={addMatch} disabled={!newMatch.pairA || !newMatch.pairB} style={{ ...S.btn("primary"), flex:1, minHeight:52, fontSize:16, opacity:(!newMatch.pairA||!newMatch.pairB)?0.5:1 }}>
                ✅ Añadir partido
              </button>
              <button onClick={() => setAddMatchModal(false)} style={{ ...S.btn("ghost"), minHeight:52, padding:"14px 20px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeagueCard({ league, onClick, sportColor }) {
  const cat = CATEGORIES.find(c => c.key === league.category);
  return (
    <div onClick={onClick} style={{ background:"#111827", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", padding:"16px 18px", marginBottom:10, cursor:"pointer", transition:"border-color 0.2s" }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=sportColor+"44"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontSize:18 }}>{cat?.emoji || "🏆"}</span>
            <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{league.name}</div>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>
            {cat?.label} · {league.jornadas} jornadas · {league.sport}
          </div>
          {league.description && <div style={{ fontSize:12, color:"rgba(255,255,255,0.40)", marginTop:4 }}>{league.description.slice(0,60)}…</div>}
        </div>
        <div style={{ fontSize:20, color:"rgba(255,255,255,0.25)", marginLeft:10 }}>›</div>
      </div>
    </div>
  );
}
