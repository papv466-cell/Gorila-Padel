// src/pages/LeaguePage.jsx
import { useEffect, useState, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "../services/supabaseClient";
import { useSport } from "../contexts/SportContext";
import { useSession } from "../contexts/SessionContext";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CATEGORIES = [
  { key: "iniciacion",  label: "Iniciación",      emoji: "🌱", color: "#22c55e", desc: "Para quienes empiezan a jugar" },
  { key: "intermedio",  label: "Intermedio",      emoji: "🎾", color: "#f59e0b", desc: "Nivel medio, llevas tiempo jugando" },
  { key: "avanzado",    label: "Avanzado",        emoji: "⚡", color: "#ef4444", desc: "Nivel alto, compites habitualmente" },
  { key: "competicion", label: "Competición",     emoji: "🏆", color: "#8b5cf6", desc: "Nivel federado o competitivo" },
  { key: "mixta",       label: "Mixta / Libre",   emoji: "🤝", color: "#06b6d4", desc: "Todos los niveles bienvenidos" },
  { key: "wheelchair",  label: "Silla de ruedas", emoji: "♿", color: "#3b82f6", desc: "Jugadores en silla de ruedas" },
  { key: "blind",       label: "Baja visión",     emoji: "🦯", color: "#6366f1", desc: "Ceguera o baja visión" },
  { key: "down",        label: "Síndrome Down",   emoji: "💙", color: "#0ea5e9", desc: "Jugadores con síndrome de Down" },
  { key: "senior",      label: "Senior +60",      emoji: "👴", color: "#f97316", desc: "Mayores de 60 años" },
  { key: "kids",        label: "Juvenil -18",     emoji: "👦", color: "#84cc16", desc: "Menores de 18 años" },
];

const MATCH_STATUSES = {
  pending:      { label: "⏳ Pendiente",      color: "rgba(255,255,255,0.40)", bg: "rgba(255,255,255,0.07)" },
  scheduled:    { label: "📅 Fecha acordada", color: "#F59E0B",               bg: "rgba(245,158,11,0.12)" },
  played:       { label: "✅ Jugado",          color: "#22c55e",               bg: "rgba(34,197,94,0.12)" },
  postponed:    { label: "📆 Pospuesto",       color: "#f97316",               bg: "rgba(249,115,22,0.12)" },
  unfinished:   { label: "⏸️ No terminado",    color: "#a78bfa",               bg: "rgba(167,139,250,0.12)" },
};

const S = {
  page:  { background: "#050505", minHeight: "100vh", color: "#fff" },
  wrap:  { maxWidth: 640, margin: "0 auto", padding: "90px 16px 80px" },
  card:  { background: "#111827", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 18px", marginBottom: 12 },
  input: { width: "100%", minHeight: 50, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, boxSizing: "border-box" },
  label: { display: "block", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 6 },
  btn: (v) => ({
    minHeight: 50, padding: "12px 18px", borderRadius: 14, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 14,
    background: v === "primary" ? "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))"
               : v === "danger"  ? "rgba(220,38,38,0.12)"
               : "rgba(255,255,255,0.07)",
    color: v === "primary" ? "#000" : v === "danger" ? "#ff6b6b" : "#fff",
    border: v === "danger" ? "1px solid rgba(220,38,38,0.25)" : "none",
  }),
};

function calcElo(rA, rB, winA) {
  const K = 32, exp = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return { dA: Math.round(K * (winA - exp)), dB: Math.round(K * ((1-winA) - (1-exp))) };
}

// Genera jornadas Round Robin para N parejas
function generateRoundRobin(pairIds) {
  const n = pairIds.length;
  const rounds = [];
  const ids = [...pairIds];
  if (n % 2 !== 0) ids.push("BYE");
  const total = ids.length;
  for (let r = 0; r < total - 1; r++) {
    const round = [];
    for (let i = 0; i < total / 2; i++) {
      const a = ids[i], b = ids[total - 1 - i];
      if (a !== "BYE" && b !== "BYE") round.push({ pairA: a, pairB: b });
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

export default function LeaguePage() {
  const { sportInfo } = useSport();
  const { session } = useSession();
  const sportColor = sportInfo?.color || "#2ECC71";

  const [view, setView]               = useState("list");
  const [leagues, setLeagues]         = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueTab, setLeagueTab]     = useState("clasificacion");
  const [pairs, setPairs]             = useState([]);
  const [matches, setMatches]         = useState([]);
  const [loading, setLoading]         = useState(true);

  // Modales
  const [resultModal, setResultModal]     = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [joinModal, setJoinModal]         = useState(false);
  const [payModal, setPayModal]           = useState(null); // { clientSecret, leagueId, pairData }
  const [addMatchModal, setAddMatchModal] = useState(false);

  // Forms
  const [sets, setSets]               = useState([{a:"",b:""}]);
  const [matchStatus, setMatchStatus] = useState("played");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("19:00");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [pairName, setPairName]       = useState("");
  const [newMatch, setNewMatch]       = useState({ pairA:"", pairB:"", jornada:1 });

  // Crear liga
  const [newLeague, setNewLeague] = useState({
    name:"", category:"mixta", sport: sportInfo?.key || "padel",
    description:"", jornadas:10, max_pairs:8, price_per_player:0, is_public:true
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadLeagues(); }, [session?.user?.id]);

  async function loadLeagues() {
    setLoading(true);
    try {
      const [myRes, pubRes] = await Promise.all([
        session?.user?.id
          ? supabase.from("league_pairs").select("league_id, leagues(*)").or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
          : Promise.resolve({ data: [] }),
        supabase.from("leagues").select("*").eq("is_public", true).eq("status","active").order("created_at", { ascending: false }).limit(30),
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
      supabase.from("league_pairs")
        .select("*, p1:profiles!league_pairs_player1_id_fkey(id,name,avatar_url), p2:profiles!league_pairs_player2_id_fkey(id,name,avatar_url)")
        .eq("league_id", league.id).order("pts", { ascending: false }),
      supabase.from("league_matches").select("*").eq("league_id", league.id).order("jornada"),
    ]);
    setPairs(pairsRes.data || []);
    setMatches(matchesRes.data || []);
  }

  async function createLeague() {
    if (!session || !newLeague.name.trim()) return;
    setCreating(true);
    try {
      const { data: league, error } = await supabase.from("leagues").insert({
        name: newLeague.name.trim(), created_by: session.user.id,
        category: newLeague.category, sport: newLeague.sport,
        description: newLeague.description, jornadas: newLeague.jornadas,
        max_players: newLeague.max_pairs * 2, is_public: newLeague.is_public,
        price_per_player: parseFloat(newLeague.price_per_player) || 0, status: "active",
      }).select().single();
      if (error) throw error;
      await loadLeagues();
      setView("list");
    } catch(e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function initiateJoin() {
    if (!session) return;
    if (!selectedPartner) { alert("Selecciona a tu pareja"); return; }
    const price = parseFloat(selectedLeague?.price_per_player || 0);
    const pairData = {
      league_id: selectedLeague.id, player1_id: session.user.id,
      player2_id: selectedPartner.id,
      pair_name: pairName.trim() || `${session.user.user_metadata?.name || "Yo"} / ${selectedPartner.name}`,
      elo: 1000,
    };
    if (price > 0) {
      // Pago requerido
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-league-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ leagueId: selectedLeague.id, userId: session.user.id, pricePerPlayer: price }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setJoinModal(false);
      setPayModal({ clientSecret: data.clientSecret, pairData, price, total: data.total });
    } else {
      // Liga gratuita
      await supabase.from("league_pairs").insert(pairData);
      setJoinModal(false);
      setSelectedPartner(null); setPairName("");
      await loadLeagueDetail(selectedLeague);
    }
  }

  async function confirmJoinAfterPayment(pairData) {
    await supabase.from("league_pairs").insert(pairData);
    setPayModal(null);
    setSelectedPartner(null); setPairName("");
    await loadLeagueDetail(selectedLeague);
  }

  async function generateRoundRobinMatches() {
    if (!isCreator || pairs.length < 2) return;
    const rounds = generateRoundRobin(pairs.map(p => p.id));
    const rows = rounds.flatMap((round, r) =>
      round.map(m => ({ league_id: selectedLeague.id, jornada: r+1, pair_a_id: m.pairA, pair_b_id: m.pairB, match_status: "pending" }))
    );
    await supabase.from("league_matches").insert(rows);
    await loadLeagueDetail(selectedLeague);
  }

  async function addSingleMatch() {
    if (!newMatch.pairA || !newMatch.pairB || newMatch.pairA === newMatch.pairB) { alert("Selecciona 2 parejas distintas"); return; }
    await supabase.from("league_matches").insert({
      league_id: selectedLeague.id, jornada: newMatch.jornada,
      pair_a_id: newMatch.pairA, pair_b_id: newMatch.pairB, match_status: "pending",
    });
    setAddMatchModal(false);
    await loadLeagueDetail(selectedLeague);
  }

  async function saveSchedule() {
    if (!scheduleModal || !scheduleDate) return;
    await supabase.from("league_matches").update({
      scheduled_at: new Date(`${scheduleDate}T${scheduleTime}`).toISOString(),
      match_status: "scheduled",
    }).eq("id", scheduleModal.id);
    setScheduleModal(null);
    await loadLeagueDetail(selectedLeague);
  }

  async function saveResult() {
    if (!resultModal) return;
    const validSets = sets.filter(s => s.a !== "" && s.b !== "");

    if (matchStatus === "postponed" || matchStatus === "unfinished") {
      await supabase.from("league_matches").update({ match_status: matchStatus }).eq("id", resultModal.id);
      setResultModal(null); setSets([{a:"",b:""}]); setMatchStatus("played");
      await loadLeagueDetail(selectedLeague); return;
    }

    if (!validSets.length) { alert("Introduce al menos un set"); return; }
    let wA = 0, wB = 0;
    validSets.forEach(s => { if (parseInt(s.a) > parseInt(s.b)) wA++; else if (parseInt(s.b) > parseInt(s.a)) wB++; });
    if (wA === wB) { alert("No puede haber empate. Si no se terminó el partido, elige Pospuesto o No terminado."); return; }
    const winner = wA > wB ? "a" : "b";

    const pA = pairs.find(p => p.id === resultModal.pair_a_id);
    const pB = pairs.find(p => p.id === resultModal.pair_b_id);
    const elo = calcElo(pA?.elo||1000, pB?.elo||1000, winner==="a"?1:0);
    const sfA = validSets.reduce((s,x)=>s+parseInt(x.a||0),0);
    const sfB = validSets.reduce((s,x)=>s+parseInt(x.b||0),0);

    await supabase.from("league_matches").update({
      sets: validSets, winner_side: winner, match_status: "played",
      played_at: new Date().toISOString(), elo_change_a: elo.dA, elo_change_b: elo.dB,
    }).eq("id", resultModal.id);

    if (pA) await supabase.from("league_pairs").update({
      elo: (pA.elo||1000)+elo.dA, pj:(pA.pj||0)+1,
      pg:(pA.pg||0)+(winner==="a"?1:0), pp:(pA.pp||0)+(winner==="b"?1:0),
      pts:(pA.pts||0)+(winner==="a"?3:0),
      sets_favor:(pA.sets_favor||0)+sfA, sets_contra:(pA.sets_contra||0)+sfB,
    }).eq("id", pA.id);

    if (pB) await supabase.from("league_pairs").update({
      elo: (pB.elo||1000)+elo.dB, pj:(pB.pj||0)+1,
      pg:(pB.pg||0)+(winner==="b"?1:0), pp:(pB.pp||0)+(winner==="a"?1:0),
      pts:(pB.pts||0)+(winner==="b"?3:0),
      sets_favor:(pB.sets_favor||0)+sfB, sets_contra:(pB.sets_contra||0)+sfA,
    }).eq("id", pB.id);

    setSets([{a:"",b:""}]); setResultModal(null); setMatchStatus("played");
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
    return p.pair_name || `${p.p1?.name||"J1"} / ${p.p2?.name||"J2"}`;
  }

  const myPair   = pairs.find(p => p.player1_id===session?.user?.id || p.player2_id===session?.user?.id);
  const isCreator = selectedLeague?.created_by === session?.user?.id;
  const sortedPairs = [...pairs].sort((a,b) => (b.pts||0)-(a.pts||0) || ((b.sets_favor||0)-(b.sets_contra||0))-((a.sets_favor||0)-(a.sets_contra||0)) || (b.elo||1000)-(a.elo||1000));
  const jornadasGroup = useMemo(() => {
    const map = {};
    matches.forEach(m => { if(!map[m.jornada]) map[m.jornada]=[]; map[m.jornada].push(m); });
    return Object.entries(map).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
  }, [matches]);
  const cat = CATEGORIES.find(c => c.key === selectedLeague?.category);

  // ── LISTA ──
  if (view === "list") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:900, margin:0 }}>🏆 <span style={{color:sportColor}}>Ligas</span></h1>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.50)", margin:"4px 0 0" }}>Compite en parejas toda la temporada</p>
        </div>
        {session && <button onClick={()=>setView("create")} style={{...S.btn("primary"),padding:"10px 18px"}}>+ Crear liga</button>}
      </div>

      {/* Cómo funciona */}
      <div style={{...S.card, marginBottom:24}}>
        <div style={{fontSize:14,fontWeight:900,color:sportColor,marginBottom:10}}>¿Cómo funciona?</div>
        {["1️⃣ Inscríbete con tu pareja en una liga","2️⃣ Se generan los partidos automáticamente","3️⃣ Quedáis con los rivales y jugáis en el club","4️⃣ Ponéis el resultado en la app","5️⃣ La clasificación se actualiza sola 🎉"].map(s=>(
          <div key={s} style={{fontSize:13,color:"rgba(255,255,255,0.65)",marginBottom:5}}>{s}</div>
        ))}
        <div style={{marginTop:10,padding:"8px 14px",borderRadius:10,background:`${sportColor}10`,border:`1px solid ${sportColor}25`,fontSize:12,color:sportColor,fontWeight:700}}>
          ⚡ Sistema ELO — ganas más puntos derrotando a parejas más fuertes · Victoria = 3 pts · Derrota = 0 pts
        </div>
      </div>

      {/* Categorías destacadas */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:900,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Categorías disponibles</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
          {CATEGORIES.map(c=>(
            <div key={c.key} style={{flexShrink:0,padding:"8px 14px",borderRadius:999,background:`${c.color}15`,border:`1px solid ${c.color}40`,fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:6}}>
              <span>{c.emoji}</span><span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {leagues.length > 0 && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:900,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Mis ligas</div>
          {leagues.map(l=><LeagueCard key={l.id} league={l} onClick={()=>loadLeagueDetail(l)} />)}
        </div>
      )}

      {publicLeagues.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:900,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Ligas abiertas</div>
          {publicLeagues.map(l=><LeagueCard key={l.id} league={l} onClick={()=>loadLeagueDetail(l)} />)}
        </div>
      )}

      {leagues.length===0 && publicLeagues.length===0 && !loading && (
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:56,marginBottom:16}}>🏆</div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:8}}>No hay ligas todavía</div>
          <div style={{fontSize:15,color:"rgba(255,255,255,0.50)",marginBottom:24}}>¡Sé el primero en crear una!</div>
          {session && <button onClick={()=>setView("create")} style={{...S.btn("primary")}}>+ Crear primera liga</button>}
        </div>
      )}
    </div></div>
  );

  // ── CREAR ──
  if (view === "create") return (
    <div style={S.page}><div style={S.wrap}>
      <button onClick={()=>setView("list")} style={{...S.btn("ghost"),marginBottom:20,width:"auto"}}>← Volver</button>
      <h1 style={{fontSize:22,fontWeight:900,marginBottom:20}}>🏆 Crear liga</h1>
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} placeholder="Ej: Liga Inacua Primavera 2026" value={newLeague.name} onChange={e=>setNewLeague(p=>({...p,name:e.target.value}))} />
        </div>
        <div>
          <label style={S.label}>Categoría *</label>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {CATEGORIES.map(c=>(
              <button key={c.key} type="button" onClick={()=>setNewLeague(p=>({...p,category:c.key}))}
                style={{minHeight:60,padding:"12px 16px",borderRadius:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14,
                  border:newLeague.category===c.key?`2px solid ${c.color}`:"1px solid rgba(255,255,255,0.10)",
                  background:newLeague.category===c.key?`${c.color}15`:"rgba(255,255,255,0.04)",color:"#fff",fontWeight:700,fontSize:15}}>
                <span style={{fontSize:24}}>{c.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900}}>{c.label}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.50)",marginTop:2}}>{c.desc}</div>
                </div>
                {newLeague.category===c.key && <span style={{color:c.color,fontSize:18}}>✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={S.label}>Descripción (opcional)</label>
          <textarea value={newLeague.description} onChange={e=>setNewLeague(p=>({...p,description:e.target.value}))}
            placeholder="Reglas, formato, club donde se juega…" style={{...S.input,minHeight:80,resize:"vertical"}} />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div><label style={S.label}>Jornadas</label><input type="number" min="2" max="30" value={newLeague.jornadas} onChange={e=>setNewLeague(p=>({...p,jornadas:parseInt(e.target.value)||10}))} style={S.input} /></div>
          <div><label style={S.label}>Máx. parejas</label><input type="number" min="2" max="32" value={newLeague.max_pairs} onChange={e=>setNewLeague(p=>({...p,max_pairs:parseInt(e.target.value)||8}))} style={S.input} /></div>
          <div><label style={S.label}>Precio/pareja (€)</label><input type="number" min="0" step="5" value={newLeague.price_per_player} onChange={e=>setNewLeague(p=>({...p,price_per_player:e.target.value}))} style={S.input} /></div>
        </div>
        {parseFloat(newLeague.price_per_player||0) > 0 && (
          <div style={{padding:"10px 14px",borderRadius:12,background:"rgba(var(--sport-color-rgb,46,204,113),0.08)",border:`1px solid ${sportColor}25`,fontSize:13,color:sportColor}}>
            💳 Inscripción: {newLeague.price_per_player}€/jugador + 0,30€ comisión GorilaGo! — pago con tarjeta al inscribirse
          </div>
        )}
        <button type="button" onClick={()=>setNewLeague(p=>({...p,is_public:!p.is_public}))}
          style={{...S.btn(newLeague.is_public?"primary":"ghost"),display:"flex",alignItems:"center",gap:12,justifyContent:"flex-start"}}>
          <span style={{fontSize:20}}>{newLeague.is_public?"🌍":"🔒"}</span>
          <span>{newLeague.is_public?"Liga pública — cualquiera puede unirse":"Liga privada — solo por invitación"}</span>
        </button>
        <button onClick={createLeague} disabled={creating||!newLeague.name.trim()}
          style={{...S.btn("primary"),width:"100%",minHeight:56,fontSize:17,opacity:!newLeague.name.trim()?0.5:1}}>
          {creating?"⏳ Creando…":"🏆 Crear liga"}
        </button>
      </div>
    </div></div>
  );

  // ── DETALLE ──
  return (
    <div style={S.page}><div style={S.wrap}>
      <button onClick={()=>{setView("list");setSelectedLeague(null);}} style={{...S.btn("ghost"),marginBottom:16,width:"auto"}}>← Volver</button>

      {/* Header liga */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          <span style={{fontSize:30}}>{cat?.emoji||"🏆"}</span>
          <h1 style={{fontSize:22,fontWeight:900,margin:0}}>{selectedLeague?.name}</h1>
          <span style={{fontSize:12,padding:"4px 12px",borderRadius:999,background:`${cat?.color||sportColor}18`,color:cat?.color||sportColor,fontWeight:900,border:`1px solid ${cat?.color||sportColor}35`}}>{cat?.label}</span>
        </div>
        {selectedLeague?.description && <p style={{fontSize:14,color:"rgba(255,255,255,0.55)",margin:"0 0 8px"}}>{selectedLeague.description}</p>}
        <div style={{fontSize:13,color:"rgba(255,255,255,0.40)"}}>
          {pairs.length} parejas · {selectedLeague?.jornadas} jornadas · {selectedLeague?.sport}
          {selectedLeague?.price_per_player > 0 && ` · 💳 ${selectedLeague.price_per_player}€/jugador`}
        </div>
      </div>

      {/* Acciones */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {session && !myPair && (
          <button onClick={()=>setJoinModal(true)} style={{...S.btn("primary")}}>🤝 Inscribirme con pareja</button>
        )}
        {myPair && (
          <div style={{padding:"10px 16px",borderRadius:12,background:`${sportColor}10`,border:`1px solid ${sportColor}25`,fontSize:13,fontWeight:700,color:sportColor}}>
            ✅ {myPair.pair_name||`${myPair.p1?.name} / ${myPair.p2?.name}`}
          </div>
        )}
        {isCreator && pairs.length >= 2 && matches.length === 0 && (
          <button onClick={generateRoundRobinMatches} style={{...S.btn("ghost")}}>🔄 Generar jornadas auto</button>
        )}
        {isCreator && (
          <button onClick={()=>{setAddMatchModal(true);setNewMatch({pairA:"",pairB:"",jornada:jornadasGroup.length+1});}} style={{...S.btn("ghost")}}>+ Añadir partido</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:20}}>
        {[{key:"clasificacion",label:"📊 Clasificación"},{key:"jornadas",label:"🗓️ Partidos"}].map(t=>(
          <button key={t.key} onClick={()=>setLeagueTab(t.key)}
            style={{flex:1,minHeight:44,border:"none",cursor:"pointer",fontWeight:900,fontSize:13,background:"transparent",
              color:leagueTab===t.key?sportColor:"rgba(255,255,255,0.40)",
              borderBottom:leagueTab===t.key?`2px solid ${sportColor}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CLASIFICACIÓN */}
      {leagueTab==="clasificacion" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 36px 36px 36px 36px 48px",gap:6,padding:"6px 8px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.30)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>
            <span>#</span><span>Pareja</span><span style={{textAlign:"center"}}>PJ</span><span style={{textAlign:"center"}}>PG</span><span style={{textAlign:"center"}}>PP</span><span style={{textAlign:"center"}}>PTS</span><span style={{textAlign:"center"}}>ELO</span>
          </div>
          {sortedPairs.map((p,i)=>{
            const isMe = p.player1_id===session?.user?.id || p.player2_id===session?.user?.id;
            const diff = (p.sets_favor||0)-(p.sets_contra||0);
            return (
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 36px 36px 36px 36px 48px",gap:6,alignItems:"center",padding:"12px 8px",borderRadius:14,marginBottom:4,
                background:isMe?`${sportColor}10`:"rgba(255,255,255,0.03)",border:isMe?`1px solid ${sportColor}30`:"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{fontSize:15,fontWeight:900,color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(255,255,255,0.35)",textAlign:"center"}}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                </span>
                <div>
                  <div style={{fontSize:13,fontWeight:900,color:isMe?sportColor:"#fff"}}>{p.pair_name||`${p.p1?.name||"J1"} / ${p.p2?.name||"J2"}`}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>Sets {p.sets_favor||0}/{p.sets_contra||0} · dif {diff>=0?"+":""}{diff}</div>
                </div>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.50)",textAlign:"center"}}>{p.pj||0}</span>
                <span style={{fontSize:12,color:sportColor,fontWeight:900,textAlign:"center"}}>{p.pg||0}</span>
                <span style={{fontSize:12,color:"rgba(255,100,100,0.80)",textAlign:"center"}}>{p.pp||0}</span>
                <span style={{fontSize:15,fontWeight:900,color:"#fff",textAlign:"center"}}>{p.pts||0}</span>
                <span style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.55)",textAlign:"center"}}>{p.elo||1000}</span>
              </div>
            );
          })}
          {sortedPairs.length===0 && (
            <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.35)"}}>
              <div style={{fontSize:40,marginBottom:12}}>🏆</div>
              <div style={{fontSize:16,fontWeight:900,marginBottom:8}}>Sin parejas todavía</div>
              {session && !myPair && <button onClick={()=>setJoinModal(true)} style={{...S.btn("primary")}}>🤝 Inscribirme</button>}
            </div>
          )}
          <div style={{marginTop:16,padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.03)",fontSize:12,color:"rgba(255,255,255,0.45)"}}>
            <div style={{fontWeight:900,marginBottom:4}}>Sistema de puntos:</div>
            <div>🏆 Victoria = 3 pts · ❌ Derrota = 0 pts · No hay empates</div>
            <div style={{marginTop:3}}>⚡ ELO sube más ganando a rivales fuertes, baja menos perdiendo con ellos</div>
          </div>
        </div>
      )}

      {/* PARTIDOS */}
      {leagueTab==="jornadas" && (
        <div>
          {jornadasGroup.length===0 && (
            <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.35)"}}>
              <div style={{fontSize:40,marginBottom:12}}>🗓️</div>
              <div style={{fontSize:16,fontWeight:900,marginBottom:8}}>Sin partidos todavía</div>
              {isCreator && pairs.length>=2 && <button onClick={generateRoundRobinMatches} style={{...S.btn("primary")}}>🔄 Generar jornadas automáticamente</button>}
              {isCreator && <div style={{marginTop:12,fontSize:13,color:"rgba(255,255,255,0.40)"}}>o añade partidos uno a uno con el botón de arriba</div>}
            </div>
          )}

          {jornadasGroup.map(([jornada,jorMatches])=>(
            <div key={jornada} style={{marginBottom:24}}>
              <div style={{fontSize:12,fontWeight:900,color:"rgba(255,255,255,0.40)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Jornada {jornada}</div>
              {jorMatches.map(m=>{
                const pA = pairs.find(p=>p.id===m.pair_a_id);
                const pB = pairs.find(p=>p.id===m.pair_b_id);
                const isInvolved = myPair && (myPair.id===m.pair_a_id||myPair.id===m.pair_b_id);
                const status = MATCH_STATUSES[m.match_status||"pending"];
                return (
                  <div key={m.id} style={{...S.card,border:isInvolved?`1px solid ${sportColor}35`:"1px solid rgba(255,255,255,0.08)"}}>
                    {/* Estado badge */}
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                      <span style={{fontSize:11,fontWeight:900,padding:"3px 12px",borderRadius:999,background:status.bg,color:status.color}}>{status.label}</span>
                    </div>

                    {/* Equipos */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:12,marginBottom:10}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:900,color:m.winner_side==="a"?sportColor:"#fff",marginBottom:4}}>{m.winner_side==="a"?"🏆 ":""}{pA?.pair_name||`${pA?.p1?.name||"?"} / ${pA?.p2?.name||"?"}`}</div>
                        {m.elo_change_a && m.match_status==="played" && <div style={{fontSize:11,color:m.elo_change_a>0?"#22c55e":"#ef4444"}}>ELO {m.elo_change_a>0?"+":""}{m.elo_change_a}</div>}
                      </div>
                      <div style={{textAlign:"center"}}>
                        {m.sets?.length ? (
                          <div style={{display:"flex",gap:4",flexDirection:"column",alignItems:"center"}}>
                            {m.sets.map((s,i)=><span key={i} style={{fontSize:16,fontWeight:900,color:"#fff"}}>{s.a}–{s.b}</span>)}
                          </div>
                        ) : <span style={{fontSize:18,color:"rgba(255,255,255,0.25)",fontWeight:900}}>vs</span>}
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:900,color:m.winner_side==="b"?sportColor:"#fff",marginBottom:4}}>{m.winner_side==="b"?"🏆 ":""}{pB?.pair_name||`${pB?.p1?.name||"?"} / ${pB?.p2?.name||"?"}`}</div>
                        {m.elo_change_b && m.match_status==="played" && <div style={{fontSize:11,color:m.elo_change_b>0?"#22c55e":"#ef4444"}}>ELO {m.elo_change_b>0?"+":""}{m.elo_change_b}</div>}
                      </div>
                    </div>

                    {/* Fecha */}
                    {m.scheduled_at && m.match_status!=="played" && (
                      <div style={{fontSize:12,color:"#F59E0B",padding:"8px 12px",borderRadius:10,background:"rgba(245,158,11,0.08)",marginBottom:10}}>
                        📅 {new Date(m.scheduled_at).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})} · {new Date(m.scheduled_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    )}

                    {/* Acciones */}
                    {m.match_status!=="played" && isInvolved && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {m.match_status!=="scheduled" && (
                          <button onClick={()=>{setScheduleModal(m);setScheduleDate("");setScheduleTime("19:00");}}
                            style={{...S.btn("ghost"),fontSize:12,padding:"8px 14px",width:"auto"}}>📅 Acordar fecha</button>
                        )}
                        <button onClick={()=>{setResultModal(m);setSets([{a:"",b:""}]);setMatchStatus("played");}}
                          style={{...S.btn("ghost"),fontSize:12,padding:"8px 14px",width:"auto"}}>📝 Poner resultado</button>
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

    {/* MODAL INSCRIPCIÓN */}
    {joinModal && (
      <div onClick={()=>setJoinModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.90)",zIndex:50000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(620px,100%)",background:"#0f172a",borderRadius:"24px 24px 0 0",padding:"24px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom))",border:`1px solid ${sportColor}25`,maxHeight:"85vh",overflowY:"auto"}}>
          <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:999,margin:"0 auto 20px"}} />
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>🤝 Inscribirme</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.50)",marginBottom:20}}>{selectedLeague?.name} · {cat?.label}</div>

          {selectedLeague?.price_per_player > 0 && (
            <div style={{padding:"12px 16px",borderRadius:14,background:`${sportColor}08`,border:`1px solid ${sportColor}25`,marginBottom:16,fontSize:13,color:sportColor,fontWeight:700}}>
              💳 Inscripción: {selectedLeague.price_per_player}€/jugador + 0,30€ comisión GorilaGo!
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label style={S.label}>Busca a tu pareja</label>
            <input value={partnerSearch} onChange={e=>{setPartnerSearch(e.target.value);searchPartner(e.target.value);}}
              placeholder="Nombre o apodo…" style={S.input} />
            {partnerResults.length>0 && (
              <div style={{background:"#1e293b",borderRadius:12,marginTop:6,border:"1px solid rgba(255,255,255,0.10)",overflow:"hidden"}}>
                {partnerResults.map(p=>(
                  <div key={p.id} onClick={()=>{setSelectedPartner(p);setPartnerSearch(p.name||p.handle);setPartnerResults([]);}}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                    <div style={{width:36,height:36,borderRadius:999,background:`${sportColor}20`,display:"grid",placeItems:"center",fontSize:14}}>
                      {p.avatar_url?<img src={p.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:999}} alt=""/>:"🦍"}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{p.name||p.handle}</div>
                      {p.handle&&<div style={{fontSize:12,color:"rgba(255,255,255,0.40)"}}>@{p.handle}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPartner && (
            <div style={{padding:"10px 14px",borderRadius:12,background:`${sportColor}10`,border:`1px solid ${sportColor}30`,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>✅</span>
              <div><div style={{fontSize:13,fontWeight:900,color:sportColor}}>Pareja</div><div style={{fontSize:13,color:"rgba(255,255,255,0.70)"}}>{selectedPartner.name||selectedPartner.handle}</div></div>
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label style={S.label}>Nombre de vuestra pareja (opcional)</label>
            <input value={pairName} onChange={e=>setPairName(e.target.value)} placeholder="Ej: Los Invencibles" style={S.input} />
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={initiateJoin} disabled={!selectedPartner}
              style={{...S.btn("primary"),width:"100%",minHeight:52,fontSize:16,opacity:!selectedPartner?0.5:1}}>
              {selectedLeague?.price_per_player>0?`💳 Pagar e inscribirse (${parseFloat(selectedLeague.price_per_player)+0.30}€)`:"🤝 Inscribirme gratis"}
            </button>
            <button onClick={()=>setJoinModal(false)} style={{...S.btn("ghost"),width:"100%",minHeight:48}}>Cancelar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL PAGO INSCRIPCIÓN */}
    {payModal && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:50001,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{width:"min(620px,100%)",background:"#0f172a",borderRadius:"24px 24px 0 0",padding:"24px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom))",border:`1px solid ${sportColor}25`}}>
          <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:999,margin:"0 auto 20px"}} />
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>💳 Pago inscripción</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginBottom:20}}>Total: {payModal.total?.toFixed(2)}€ (incluye 0,30€ comisión GorilaGo!)</div>
          <Elements stripe={stripePromise} options={{clientSecret:payModal.clientSecret,appearance:{theme:"night"}}}>
            <LeaguePayForm onSuccess={()=>confirmJoinAfterPayment(payModal.pairData)} onCancel={()=>setPayModal(null)} sportColor={sportColor} />
          </Elements>
        </div>
      </div>
    )}

    {/* MODAL ACORDAR FECHA */}
    {scheduleModal && (
      <div onClick={()=>setScheduleModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.90)",zIndex:50000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(620px,100%)",background:"#0f172a",borderRadius:"24px 24px 0 0",padding:"24px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom))",border:"1px solid rgba(245,158,11,0.25)"}}>
          <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:999,margin:"0 auto 20px"}} />
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>📅 Acordar fecha</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.50)",marginBottom:12}}>{pairLabel(scheduleModal.pair_a_id)} vs {pairLabel(scheduleModal.pair_b_id)}</div>
          <div style={{padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.04)",marginBottom:16,fontSize:13,color:"rgba(255,255,255,0.60)",lineHeight:1.7}}>
            💡 Queda con tu rival, id al club, pagad la pista allí y jugad. Después ponéis el resultado aquí.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div><label style={S.label}>Día</label><input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={S.input} /></div>
            <div>
              <label style={S.label}>Hora</label>
              <select value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} style={S.input}>
                {["09:00","10:00","11:00","12:00","13:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"].map(t=>(
                  <option key={t} value={t} style={{background:"#1e293b"}}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveSchedule} disabled={!scheduleDate} style={{...S.btn("primary"),flex:1,minHeight:52,opacity:!scheduleDate?0.5:1}}>✅ Confirmar</button>
            <button onClick={()=>setScheduleModal(null)} style={{...S.btn("ghost"),minHeight:52,padding:"14px 20px"}}>Cancelar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL RESULTADO */}
    {resultModal && (
      <div onClick={()=>setResultModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.90)",zIndex:50000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(620px,100%)",background:"#0f172a",borderRadius:"24px 24px 0 0",padding:"24px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom))",border:`1px solid ${sportColor}25`,maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:999,margin:"0 auto 20px"}} />
          <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>📝 Resultado del partido</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.50)",marginBottom:16}}>{pairLabel(resultModal.pair_a_id)} vs {pairLabel(resultModal.pair_b_id)}</div>

          {/* Estado del partido */}
          <div style={{marginBottom:16}}>
            <label style={S.label}>Estado del partido</label>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {key:"played",     label:"✅ Jugado y terminado",     color:sportColor},
                {key:"postponed",  label:"📆 Pospuesto — quedamos otro día",color:"#f97316"},
                {key:"unfinished", label:"⏸️ No terminado — continuamos otro día",color:"#a78bfa"},
              ].map(st=>(
                <button key={st.key} type="button" onClick={()=>setMatchStatus(st.key)}
                  style={{minHeight:52,padding:"12px 16px",borderRadius:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,
                    border:matchStatus===st.key?`2px solid ${st.color}`:"1px solid rgba(255,255,255,0.10)",
                    background:matchStatus===st.key?`${st.color}15`:"rgba(255,255,255,0.04)",color:"#fff",fontWeight:700,fontSize:14}}>
                  <span style={{flex:1}}>{st.label}</span>
                  {matchStatus===st.key && <span style={{color:st.color}}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Sets — solo si está jugado */}
          {matchStatus==="played" && (
            <>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginBottom:14,padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)"}}>
                💡 Introduce los sets jugados. No puede haber empate — si hay 1-1 en sets, añade el tercer set (o super tie-break).
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:8,padding:"0 4px"}}>
                <div style={{textAlign:"center",fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.40)"}}>PAREJA A</div>
                <div></div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.40)"}}>PAREJA B</div>
              </div>
              {sets.map((s,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:12,marginBottom:10}}>
                  <input type="number" min="0" max="7" value={s.a} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,a:e.target.value}:x))}
                    style={{...S.input,fontSize:28,fontWeight:900,textAlign:"center",padding:"12px 8px"}} />
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:4}}>SET {i+1}</div>
                    <div style={{fontSize:20,color:"rgba(255,255,255,0.25)",fontWeight:900}}>–</div>
                  </div>
                  <input type="number" min="0" max="7" value={s.b} onChange={e=>setSets(p=>p.map((x,j)=>j===i?{...x,b:e.target.value}:x))}
                    style={{...S.input,fontSize:28,fontWeight:900,textAlign:"center",padding:"12px 8px"}} />
                </div>
              ))}
              {sets.length<3 && (
                <button onClick={()=>setSets(p=>[...p,{a:"",b:""}])} style={{...S.btn("ghost"),width:"100%",fontSize:13,padding:"10px",marginBottom:12}}>
                  + Añadir set {sets.length+1}
                </button>
              )}
            </>
          )}

          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={saveResult} style={{...S.btn("primary"),flex:1,minHeight:52,fontSize:16}}>
              {matchStatus==="played"?"✅ Guardar resultado":matchStatus==="postponed"?"📆 Marcar como pospuesto":"⏸️ Marcar como no terminado"}
            </button>
            <button onClick={()=>setResultModal(null)} style={{...S.btn("ghost"),minHeight:52,padding:"14px 20px"}}>Cancelar</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL AÑADIR PARTIDO */}
    {addMatchModal && (
      <div onClick={()=>setAddMatchModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.90)",zIndex:50000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:"min(620px,100%)",background:"#0f172a",borderRadius:"24px 24px 0 0",padding:"24px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom))",border:`1px solid ${sportColor}25`}}>
          <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:999,margin:"0 auto 20px"}} />
          <div style={{fontSize:20,fontWeight:900,marginBottom:20}}>➕ Añadir partido</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={S.label}>Jornada</label><input type="number" min="1" value={newMatch.jornada} onChange={e=>setNewMatch(p=>({...p,jornada:parseInt(e.target.value)||1}))} style={S.input} /></div>
            <div>
              <label style={S.label}>Pareja A</label>
              <select value={newMatch.pairA} onChange={e=>setNewMatch(p=>({...p,pairA:e.target.value}))} style={S.input}>
                <option value="">Seleccionar…</option>
                {pairs.filter(p=>p.id!==newMatch.pairB).map(p=><option key={p.id} value={p.id} style={{background:"#1e293b"}}>{p.pair_name||`${p.p1?.name} / ${p.p2?.name}`}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Pareja B</label>
              <select value={newMatch.pairB} onChange={e=>setNewMatch(p=>({...p,pairB:e.target.value}))} style={S.input}>
                <option value="">Seleccionar…</option>
                {pairs.filter(p=>p.id!==newMatch.pairA).map(p=><option key={p.id} value={p.id} style={{background:"#1e293b"}}>{p.pair_name||`${p.p1?.name} / ${p.p2?.name}`}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={addSingleMatch} disabled={!newMatch.pairA||!newMatch.pairB} style={{...S.btn("primary"),flex:1,minHeight:52,opacity:(!newMatch.pairA||!newMatch.pairB)?0.5:1}}>✅ Añadir</button>
              <button onClick={()=>setAddMatchModal(false)} style={{...S.btn("ghost"),minHeight:52,padding:"14px 20px"}}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

function LeagueCard({ league, onClick }) {
  const cat = CATEGORIES.find(c => c.key === league.category);
  return (
    <div onClick={onClick} style={{background:"#111827",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)",padding:"16px 18px",marginBottom:10,cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=(cat?.color||"#2ECC71")+"55"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:20}}>{cat?.emoji||"🏆"}</span>
            <div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{league.name}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:`${cat?.color||"#2ECC71"}15`,color:cat?.color||"#2ECC71",fontWeight:700}}>{cat?.label}</span>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.55)",fontWeight:700}}>{league.sport}</span>
            {league.price_per_player>0 && <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:"rgba(245,158,11,0.12)",color:"#F59E0B",fontWeight:700}}>💳 {league.price_per_player}€/jug</span>}
            {!league.is_public && <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.40)",fontWeight:700}}>🔒 Privada</span>}
          </div>
          {league.description && <div style={{fontSize:12,color:"rgba(255,255,255,0.40)"}}>{league.description.slice(0,60)}…</div>}
        </div>
        <div style={{fontSize:20,color:"rgba(255,255,255,0.25)",marginLeft:10}}>›</div>
      </div>
    </div>
  );
}

function LeaguePayForm({ onSuccess, onCancel, sportColor }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true); setErr(null);
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: "if_required" });
    if (error) { setErr(error.message); setPaying(false); }
    else onSuccess();
  }

  return (
    <div>
      <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:16,marginBottom:16}}>
        <PaymentElement options={{wallets:{applePay:"auto",googlePay:"auto"},paymentMethodOrder:["card","apple_pay","google_pay"]}} />
      </div>
      {err && <div style={{color:"#ff6b6b",fontSize:13,fontWeight:700,marginBottom:12}}>⚠️ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={handlePay} disabled={paying||!stripe} style={{flex:1,minHeight:52,borderRadius:14,background:paying?"rgba(255,255,255,0.10)":`linear-gradient(135deg,${sportColor},#27AE60)`,color:"#000",fontWeight:900,fontSize:16,border:"none",cursor:paying?"not-allowed":"pointer"}}>
          {paying?"⏳ Procesando…":"💳 Pagar e inscribirse"}
        </button>
        <button onClick={onCancel} style={{minHeight:52,padding:"14px 20px",borderRadius:14,background:"transparent",color:"rgba(255,255,255,0.55)",fontWeight:700,border:"1px solid rgba(255,255,255,0.10)",cursor:"pointer"}}>Cancelar</button>
      </div>
    </div>
  );
}
