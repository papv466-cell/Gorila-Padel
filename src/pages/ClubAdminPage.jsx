// src/pages/ClubAdminPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const TABS = ["calendario", "reservas", "espera", "precios", "comunicacion", "torneos", "informe", "valoraciones", "stats", "donaciones", "bonos", "config"];
const TAB_LABELS = {
  calendario: "📅 Calendario",
  reservas: "📋 Reservas",
  espera: "⏳ Espera",
  precios: "💶 Precios",
  comunicacion: "📣 Comunicar",
  torneos: "🏆 Torneos",
  informe: "📈 Informe",
  valoraciones: "⭐ Valoraciones",
  stats: "📊 Stats",
  donaciones: "💚 Donaciones",
  config: "⚙️ Config",
  bonos: "🎟️ Bonos"
};

const HOURS = Array.from({length:16}, (_,i) => `${(i+8).toString().padStart(2,'0')}:00`);
const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateToISO(d) {
  return d.toISOString().split('T')[0];
}

const STATUS_COLORS = {
  available: { bg: 'rgba(116,184,0,0.15)', border: 'rgba(116,184,0,0.4)', text: '#74B800' },
  booked: { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.4)', text: '#ff6b6b' },
  pending: { bg: 'rgba(255,165,0,0.15)', border: 'rgba(255,165,0,0.4)', text: '#FFA500' },
  blocked: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.2)' },
  playtomic: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa' },
};

export default function ClubAdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [clubAdmin, setClubAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("calendario");
  const [courts, setCourts] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [donations, setDonations] = useState([]);
  const [foundations, setFoundations] = useState([]);
  const [stats, setStats] = useState({ totalMatches:0, totalPlayers:0, totalEarned:0, totalDonated:0, occupancyByHour:[], topPlayers:[] });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [slotModal, setSlotModal] = useState(null); // { date, hour, court }
  const [slotForm, setSlotForm] = useState({ price:'', duration:60, status:'available' });
  const [saving, setSaving] = useState(false);
  const [showNewCourt, setShowNewCourt] = useState(false);
  const [courtForm, setCourtForm] = useState({ name:'', court_type:'outdoor' });
  const [playtomicUrl, setPlaytomicUrl] = useState('');
  const [waitlist, setWaitlist] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastForm, setBroadcastForm] = useState({title:'', body:''});
  const [sending, setSending] = useState(false);
  const [pricingForm, setPricingForm] = useState({day_type:'weekday', start_hour:8, end_hour:14, price:10});
  const [editingPrice, setEditingPrice] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentForm, setTournamentForm] = useState({name:'', date:'', start_time:'18:00', max_players:8, price_per_player:0, level:'todos'});
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [monthReport, setMonthReport] = useState(null);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [syncing, setSyncing] = useState(false);
  const [bonos, setBonos] = useState([]);
  const [bonoForm, setBonoForm] = useState({nombre:'', tipo:'horas', horas_incluidas:10, precio_cents:1500, duracion_dias:30, activo:true});
  const [showNewBono, setShowNewBono] = useState(false);
  const [savingBono, setSavingBono] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data?.session||null);
      if (!data?.session) { navigate('/login'); return; }
      loadAdmin(data.session.user.id);
    });
  }, []);

  async function loadAdmin(userId) {
    try {
      const {data} = await supabase.from('club_admins').select('*').eq('user_id', userId).eq('status','approved').maybeSingle();
      if (!data) { setLoading(false); return; }
      setClubAdmin(data);
      await Promise.all([
        loadCourts(data.club_id),
        loadSlots(data.club_id),
        loadBookings(data.club_id),
        loadDonations(data.club_id),
        loadFoundations(),
        loadStats(data.club_id),
        loadWaitlist(data.club_id),
        loadPricing(data.club_id),
        loadBroadcasts(data.club_id),
        loadRatings(data.club_id),
        loadTournaments(data.club_id),
        loadBonos(data.club_id),
      ]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadTournaments(clubId) {
    const {data} = await supabase.from('flash_tournaments').select('*, flash_tournament_players(user_id)').eq('club_id', clubId).order('date', {ascending:false});
    setTournaments(data||[]);
  }

  async function createTournament() {
    if (!tournamentForm.name.trim() || !tournamentForm.date) return;
    try {
      setSaving(true);
      const {data, error} = await supabase.from('flash_tournaments').insert({
        club_id: clubAdmin.club_id,
        club_name: clubAdmin.club_name,
        name: tournamentForm.name.trim(),
        date: tournamentForm.date,
        start_time: tournamentForm.start_time,
        max_players: Number(tournamentForm.max_players)||8,
        price_per_player: Number(tournamentForm.price_per_player)||0,
        level: tournamentForm.level,
        status: 'open',
        created_by: session.user.id,
      }).select().single();
      if (error) throw error;
      setTournaments(prev=>[data,...prev]);
      setShowNewTournament(false);
      setTournamentForm({name:'', date:'', start_time:'18:00', max_players:8, price_per_player:0, level:'todos'});
      // Notificar a jugadores del club
      try {
        const {notifyClubBroadcast} = await import('../services/notifications');
        const {data: matchPlayers} = await supabase.from('matches').select('match_players(player_uuid)').eq('club_id', clubAdmin.club_id).gte('start_at', new Date(Date.now()-30*24*60*60*1000).toISOString());
        const userIds = [...new Set((matchPlayers||[]).flatMap(m=>(m.match_players||[]).map(p=>p.player_uuid)).filter(Boolean))];
        if (userIds.length) await notifyClubBroadcast({clubName: clubAdmin.club_name, title: `🏆 Torneo flash: ${data.name}`, body: `${data.date} a las ${data.start_time} · Nivel ${data.level} · ${data.max_players} jugadores`, userIds});
      } catch {}
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function generateBracket(tournament) {
    const players = (tournament.flash_tournament_players||[]).map(p=>p.user_id);
    if (players.length < 4) { alert('Necesitas al menos 4 jugadores'); return; }
    const shuffled = [...players].sort(()=>Math.random()-0.5);
    const matches = [];
    for (let i=0; i<shuffled.length-1; i+=4) {
      matches.push({
        tournament_id: tournament.id,
        round: 1,
        team_a: [shuffled[i], shuffled[i+1]||shuffled[i]],
        team_b: [shuffled[i+2]||shuffled[i], shuffled[i+3]||shuffled[i+2]||shuffled[i]],
        status: 'pending',
      });
    }
    const {error} = await supabase.from('flash_tournament_matches').insert(matches);
    if (error) { alert(error.message); return; }
    await supabase.from('flash_tournaments').update({status:'in_progress'}).eq('id', tournament.id);
    setTournaments(prev=>prev.map(t=>t.id===tournament.id?{...t,status:'in_progress'}:t));
    alert(`✅ Cuadro generado con ${matches.length} partido${matches.length!==1?'s':''}`);
  }

  async function loadBonos(clubId) {
    const {data} = await supabase.from('club_bonos').select('*').eq('club_id', clubId).order('created_at', {ascending:false});
    setBonos(data||[]);
  }

  async function createBono() {
    if (!bonoForm.nombre.trim()) return;
    try {
      setSavingBono(true);
      const {data, error} = await supabase.from('club_bonos').insert({
        club_id: clubAdmin.club_id,
        club_name: clubAdmin.club_name,
        nombre: bonoForm.nombre.trim(),
        tipo: bonoForm.tipo,
        horas_incluidas: bonoForm.tipo === 'ilimitado' ? null : Number(bonoForm.horas_incluidas),
        precio_cents: Number(bonoForm.precio_cents),
        duracion_dias: Number(bonoForm.duracion_dias),
        activo: true,
      }).select().single();
      if (error) throw error;
      setBonos(prev => [data, ...prev]);
      setShowNewBono(false);
      setBonoForm({nombre:'', tipo:'horas', horas_incluidas:10, precio_cents:1500, duracion_dias:30, activo:true});
    } catch(e) { alert(e.message); }
    finally { setSavingBono(false); }
  }

  async function toggleBono(id, activo) {
    await supabase.from('club_bonos').update({activo: !activo}).eq('id', id);
    setBonos(prev => prev.map(b => b.id === id ? {...b, activo: !activo} : b));
  }

  async function deleteBono(id) {
    if (!window.confirm('¿Eliminar este bono?')) return;
    await supabase.from('club_bonos').delete().eq('id', id);
    setBonos(prev => prev.filter(b => b.id !== id));
  }

  async function loadRatings(clubId) {
    const {data} = await supabase.from('club_ratings').select('*, profiles(name, handle, avatar_url)').eq('club_id', clubId).order('created_at', {ascending:false});
    setRatings(data||[]);
  }

  async function generateMonthReport(clubId, month) {
    const [year, m] = month.split('-');
    const start = `${month}-01`;
    const end = new Date(Number(year), Number(m), 0).toISOString().split('T')[0];
    const {data: matches} = await supabase.from('matches').select('id, join_fee_cents, start_at, players_needed').eq('club_id', clubId).gte('start_at', start).lte('start_at', end+'T23:59:59');
    const {data: bookingsData} = await supabase.from('court_bookings').select('id, price, status, date').eq('club_id', clubId).gte('date', start).lte('date', end);
    const totalMatches = (matches||[]).length;
    const totalPlayers = (matches||[]).reduce((s,m)=>s+(m.players_needed||4),0);
    const totalEarned = (matches||[]).reduce((s,m)=>s+(m.join_fee_cents||0)/3,0);
    const totalDonated = totalEarned;
    const confirmedBookings = (bookingsData||[]).filter(b=>b.status==='confirmed').length;
    const bookingRevenue = (bookingsData||[]).filter(b=>b.status==='confirmed').reduce((s,b)=>s+Number(b.price||0),0);
    const byHour = {};
    HOURS.forEach(h=>byHour[h]=0);
    (matches||[]).forEach(m=>{const h=String(m.start_at||'').match(/T(\d{2}):/); if(h){const k=`${h[1]}:00`; if(byHour[k]!==undefined)byHour[k]++;}});
    const peakHour = Object.entries(byHour).sort((a,b)=>b[1]-a[1])[0]?.[0]||'--';
    setMonthReport({ totalMatches, totalPlayers, totalEarned: Math.round(totalEarned), totalDonated: Math.round(totalDonated), confirmedBookings, bookingRevenue, peakHour, month });
  }

  async function loadWaitlist(clubId) {
    const {data} = await supabase.from('slot_waitlist').select('*, profiles(name, handle, avatar_url), court_slots(date, start_time, end_time)').eq('club_id', clubId).eq('status','waiting').order('position');
    setWaitlist(data||[]);
  }

  async function loadPricing(clubId) {
    const {data} = await supabase.from('club_pricing').select('*').eq('club_id', clubId).order('day_type').order('start_hour');
    setPricing(data||[]);
  }

  async function loadBroadcasts(clubId) {
    const {data} = await supabase.from('club_broadcasts').select('*').eq('club_id', clubId).order('sent_at', {ascending:false}).limit(20);
    setBroadcasts(data||[]);
  }

  async function sendBroadcast() {
    if (!broadcastForm.title.trim() || !broadcastForm.body.trim()) return;
    try {
      setSending(true);
      // Buscar jugadores que han jugado en este club
      const {data: matchPlayers} = await supabase
        .from('matches')
        .select('match_players(player_uuid)')
        .eq('club_id', clubAdmin.club_id)
        .gte('start_at', new Date(Date.now() - 30*24*60*60*1000).toISOString());
      const userIds = [...new Set((matchPlayers||[]).flatMap(m => (m.match_players||[]).map(p=>p.player_uuid)).filter(Boolean))];
      if (!userIds.length) { alert('No hay jugadores recientes en tu club'); return; }
      // Enviar push a cada uno
      const {notifyClubBroadcast} = await import('../services/notifications');
      await notifyClubBroadcast({clubName: clubAdmin.club_name, title: broadcastForm.title, body: broadcastForm.body, userIds});
      // Guardar registro
      const {data} = await supabase.from('club_broadcasts').insert({
        club_id: clubAdmin.club_id, club_name: clubAdmin.club_name,
        sent_by: session.user.id, title: broadcastForm.title, body: broadcastForm.body,
        recipients_count: userIds.length
      }).select().single();
      setBroadcasts(prev => [data, ...prev]);
      setBroadcastForm({title:'', body:''});
      alert(`✅ Mensaje enviado a ${userIds.length} jugadores`);
    } catch(e) { alert(e.message); }
    finally { setSending(false); }
  }

  async function savePricing() {
    if (!pricingForm.price || !selectedCourt) return;
    try {
      setSaving(true);
      const payload = { club_id: clubAdmin.club_id, court_id: selectedCourt, ...pricingForm, price: Number(pricingForm.price) };
      const {data, error} = await supabase.from('club_pricing').upsert(payload, {onConflict:'club_id,court_id,day_type,start_hour'}).select().single();
      if (error) throw error;
      setPricing(prev => {
        const idx = prev.findIndex(p => p.id === data.id);
        if (idx >= 0) { const n=[...prev]; n[idx]=data; return n; }
        return [...prev, data];
      });
      setEditingPrice(null);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function removeFromWaitlist(id) {
    await supabase.from('slot_waitlist').delete().eq('id', id);
    setWaitlist(prev => prev.filter(w => w.id !== id));
  }

  async function notifyFirstInWaitlist(slotId) {
    const first = waitlist.filter(w => w.slot_id === slotId && w.status === 'waiting').sort((a,b)=>a.position-b.position)[0];
    if (!first) return;
    const expires = new Date(Date.now() + 15*60*1000).toISOString();
    await supabase.from('slot_waitlist').update({status:'notified', notified_at: new Date().toISOString(), expires_at: expires}).eq('id', first.id);
    setWaitlist(prev => prev.map(w => w.id === first.id ? {...w, status:'notified', expires_at: expires} : w));
    alert(`✅ Notificado a ${first.profiles?.name||'jugador'}. Tiene 15 minutos para confirmar.`);
  }

  async function loadCourts(clubId) {
    const {data} = await supabase.from('club_courts').select('*').eq('club_id', clubId).order('name');
    setCourts(data||[]);
    if (data?.length) setSelectedCourt(data[0].id);
  }

  async function loadSlots(clubId) {
    const start = dateToISO(getWeekDates(weekOffset)[0]);
    const end = dateToISO(getWeekDates(weekOffset)[6]);
    const {data} = await supabase.from('court_slots').select('*').eq('club_id', clubId).gte('date', start).lte('date', end);
    setSlots(data||[]);
  }

  async function loadBookings(clubId) {
    const {data} = await supabase.from('court_bookings').select('*, profiles(name, handle, avatar_url)').eq('club_id', clubId).order('date', {ascending:false}).limit(50);
    setBookings(data||[]);
  }

  async function loadDonations(clubId) {
    const {data} = await supabase.from('club_donations').select('*, foundations(name, logo_url)').eq('club_id', clubId).order('month', {ascending:false});
    setDonations(data||[]);
  }

  async function loadFoundations() {
    const {data} = await supabase.from('foundations').select('*').eq('active', true);
    setFoundations(data||[]);
  }

  async function loadStats(clubId) {
    const {data: matches} = await supabase.from('matches').select('id, join_fee_cents, start_at').eq('club_id', clubId);
    const total = (matches||[]).length;
    const earned = (matches||[]).reduce((s,m) => s + (m.join_fee_cents||0)/3, 0);

    // Ocupación por hora
    const byHour = {};
    HOURS.forEach(h => byHour[h] = 0);
    (matches||[]).forEach(m => {
      const h = String(m.start_at||'').match(/T(\d{2}):/);
      if (h) { const key = `${h[1]}:00`; if (byHour[key] !== undefined) byHour[key]++; }
    });
    const occupancyByHour = Object.entries(byHour).map(([hour, count]) => ({hour, count}));
    const maxCount = Math.max(...occupancyByHour.map(x=>x.count), 1);

    setStats({ totalMatches:total, totalPlayers:total*4, totalEarned:Math.round(earned), totalDonated:Math.round(earned), occupancyByHour, maxCount });
  }

  useEffect(() => {
    if (clubAdmin) loadSlots(clubAdmin.club_id);
  }, [weekOffset]);

  function getSlot(courtId, date, hour) {
    const dateStr = dateToISO(date);
    return slots.find(s => String(s.court_id) === String(courtId) && s.date === dateStr && s.start_time?.startsWith(hour));
  }

  async function handleCellClick(court, date, hour) {
    const existing = getSlot(court.id, date, hour);
    if (existing) {
      if (existing.status === 'booked') return;
      if (window.confirm(`¿Eliminar slot ${hour} del ${dateToISO(date)}?`)) {
        await supabase.from('court_slots').delete().eq('id', existing.id);
        setSlots(prev => prev.filter(s => s.id !== existing.id));
      }
      return;
    }
    setSlotModal({ court, date, hour });
    setSlotForm({ price:'10', duration:60, status:'available' });
  }

  async function createSlot() {
    if (!slotModal) return;
    try {
      setSaving(true);
      const {court, date, hour} = slotModal;
      const [h] = hour.split(':');
      const endH = String(Number(h) + Math.round(slotForm.duration/60)).padStart(2,'0');
      const endTime = `${endH}:00`;
      const {data, error} = await supabase.from('court_slots').insert({
        club_id: clubAdmin.club_id,
        court_id: court.id,
        date: dateToISO(date),
        start_time: hour,
        end_time: endTime,
        price: Number(slotForm.price)||0,
        status: slotForm.status,
        source: 'gorila',
      }).select().single();
      if (error) throw error;
      setSlots(prev => [...prev, data]);
      setSlotModal(null);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function createCourt() {
    if (!courtForm.name.trim()) return;
    try {
      setSaving(true);
      const {data, error} = await supabase.from('club_courts').insert({
        club_id: clubAdmin.club_id,
        name: courtForm.name.trim(),
        court_type: courtForm.court_type,
      }).select().single();
      if (error) throw error;
      setCourts(prev => [...prev, data]);
      setShowNewCourt(false);
      setCourtForm({name:'', court_type:'outdoor'});
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function updateBookingStatus(bookingId, status) {
    await supabase.from('court_bookings').update({status}).eq('id', bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? {...b, status} : b));
  }

  async function bulkCreateSlots() {
    if (!selectedCourt || !courts.length) return;
    const court = courts.find(c => c.id === selectedCourt);
    if (!court) return;
    const slotsToCreate = [];
    weekDates.forEach(date => {
      HOURS.forEach(hour => {
        const existing = getSlot(court.id, date, hour);
        if (!existing) {
          const [h] = hour.split(':');
          slotsToCreate.push({
            club_id: clubAdmin.club_id,
            court_id: court.id,
            date: dateToISO(date),
            start_time: hour,
            end_time: `${String(Number(h)+1).padStart(2,'0')}:00`,
            price: 10,
            status: 'available',
            source: 'gorila',
          });
        }
      });
    });
    if (!slotsToCreate.length) return;
    if (!window.confirm(`¿Crear ${slotsToCreate.length} slots disponibles esta semana?`)) return;
    try {
      setSaving(true);
      const {data, error} = await supabase.from('court_slots').insert(slotsToCreate).select();
      if (error) throw error;
      setSlots(prev => [...prev, ...(data||[])]);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const S = {
    page: { minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'system-ui,sans-serif', paddingBottom:60 },
    header: { background:'linear-gradient(135deg,#0f1a00,#1a2a00)', borderBottom:'1px solid rgba(116,184,0,0.2)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 },
    tabs: { display:'flex', gap:2, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', overflowX:'auto', WebkitOverflowScrolling:'touch' },
    tab: (a) => ({ padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:800, whiteSpace:'nowrap', background:a?'rgba(116,184,0,0.15)':'transparent', color:a?'#74B800':'rgba(255,255,255,0.4)', borderBottom:a?'2px solid #74B800':'2px solid transparent' }),
    card: { background:'#111', borderRadius:14, border:'1px solid rgba(255,255,255,0.07)', padding:14, marginBottom:10 },
    input: { padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
    btn: (c) => ({ padding:'10px 16px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:900, fontSize:13, background:c==='green'?'linear-gradient(135deg,#74B800,#9BE800)':c==='red'?'rgba(220,38,38,0.15)':c==='blue'?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.08)', color:c==='green'?'#000':c==='red'?'#ff6b6b':c==='blue'?'#60a5fa':'#fff' }),
    badge: (s) => ({ padding:'3px 8px', borderRadius:999, fontSize:10, fontWeight:800, background:s==='confirmed'||s==='available'?'rgba(116,184,0,0.15)':s==='pending'?'rgba(255,165,0,0.15)':'rgba(220,38,38,0.15)', color:s==='confirmed'||s==='available'?'#74B800':s==='pending'?'#FFA500':'#ff6b6b' }),
  };

  if (loading) return <div style={{...S.page, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.4)'}}>Cargando...</div>;

  if (!clubAdmin) return (
    <div style={{...S.page, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:32, textAlign:'center'}}>
      <div style={{fontSize:48}}>🏟️</div>
      <div style={{fontSize:20, fontWeight:900}}>Acceso restringido</div>
      <div style={{fontSize:14, color:'rgba(255,255,255,0.4)'}}>No tienes permisos de administrador de club.</div>
      <button onClick={()=>navigate('/')} style={S.btn('green')}>Volver al inicio</button>
    </div>
  );

  const activeCourt = courts.find(c => c.id === selectedCourt);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'#74B800',fontSize:20,cursor:'pointer'}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:900,color:'#74B800'}}>🏟️ {clubAdmin.club_name}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Panel de administración</div>
        </div>
        <div style={{fontSize:11,color:'rgba(116,184,0,0.6)',fontWeight:700,background:'rgba(116,184,0,0.08)',padding:'4px 8px',borderRadius:6}}>
          {courts.length} pistas
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{TAB_LABELS[t]}</button>)}
      </div>

      {/* ── CALENDARIO ── */}
      {tab === 'calendario' && (
        <div>
          {/* Selector de pista */}
          <div style={{padding:'10px 12px', display:'flex', gap:6, overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            {courts.map(c => (
              <button key={c.id} onClick={()=>setSelectedCourt(c.id)}
                style={{padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:12, whiteSpace:'nowrap',
                  background:selectedCourt===c.id?'linear-gradient(135deg,#74B800,#9BE800)':'rgba(255,255,255,0.08)',
                  color:selectedCourt===c.id?'#000':'#fff'}}>
                {c.name} {c.court_type==='indoor'?'🏠':'☀️'}
              </button>
            ))}
            <button onClick={()=>setShowNewCourt(true)}
              style={{padding:'6px 14px', borderRadius:20, border:'1px dashed rgba(116,184,0,0.3)', cursor:'pointer', fontWeight:800, fontSize:12, background:'transparent', color:'rgba(116,184,0,0.6)', whiteSpace:'nowrap'}}>
              + Añadir
            </button>
          </div>

          {/* Navegación semana */}
          <div style={{padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{...S.btn(''), padding:'6px 12px', fontSize:16}}>‹</button>
            <div style={{fontSize:13, fontWeight:800, color:'#fff'}}>
              {weekDates[0].toLocaleDateString('es',{day:'numeric',month:'short'})} — {weekDates[6].toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{...S.btn(''), padding:'6px 12px', fontSize:16}}>›</button>
          </div>

          {/* Leyenda */}
          <div style={{padding:'0 12px 8px', display:'flex', gap:8, flexWrap:'wrap'}}>
            {Object.entries(STATUS_COLORS).map(([key,val]) => (
              <div key={key} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:val.text}}>
                <div style={{width:10,height:10,borderRadius:3,background:val.bg,border:`1px solid ${val.border}`}}/>
                {key==='available'?'Libre':key==='booked'?'Reservado':key==='pending'?'Pendiente':key==='blocked'?'Bloqueado':'Playtomic'}
              </div>
            ))}
          </div>

          {/* Botón llenar semana */}
          {activeCourt && (
            <div style={{padding:'0 12px 8px', display:'flex', gap:8}}>
              <button onClick={bulkCreateSlots} disabled={saving}
                style={{...S.btn('green'), fontSize:11, padding:'6px 12px'}}>
                ⚡ Publicar toda la semana
              </button>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center'}}>
                Crea slots disponibles en todos los horarios vacíos
              </div>
            </div>
          )}

          {/* Grid calendario */}
          {activeCourt ? (
            <div style={{overflowX:'auto', padding:'0 0 20px'}}>
              <div style={{minWidth:340}}>
                {/* Header días */}
                <div style={{display:'grid', gridTemplateColumns:'48px repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <div/>
                  {weekDates.map((d,i) => {
                    const isToday = dateToISO(d) === dateToISO(new Date());
                    return (
                      <div key={i} style={{padding:'6px 2px', textAlign:'center', fontSize:11, fontWeight:800, color:isToday?'#74B800':'rgba(255,255,255,0.5)'}}>
                        <div>{DAYS[i]}</div>
                        <div style={{fontSize:13, color:isToday?'#74B800':'#fff', fontWeight:900}}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Filas de horas */}
                {HOURS.map(hour => (
                  <div key={hour} style={{display:'grid', gridTemplateColumns:'48px repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', padding:'8px 4px', display:'flex', alignItems:'center', justifyContent:'flex-end', fontWeight:700}}>{hour}</div>
                    {weekDates.map((date, di) => {
                      const slot = getSlot(activeCourt.id, date, hour);
                      const isPast = date < new Date() && dateToISO(date) !== dateToISO(new Date());
                      const colors = slot ? STATUS_COLORS[slot.source==='playtomic'?'playtomic':slot.status] : null;
                      return (
                        <div key={di} onClick={()=>!isPast && handleCellClick(activeCourt, date, hour)}
                          style={{
                            margin:'1px', borderRadius:4, minHeight:36, cursor:isPast?'default':'pointer',
                            background:slot?colors.bg:isPast?'rgba(255,255,255,0.01)':'rgba(255,255,255,0.02)',
                            border:slot?`1px solid ${colors.border}`:'1px solid transparent',
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                            transition:'all .15s',
                          }}>
                          {slot && (
                            <>
                              <div style={{fontSize:9, fontWeight:900, color:colors.text}}>
                                {slot.status==='available'?`${slot.price}€`:slot.status==='booked'?'🔒':slot.status==='pending'?'⏳':'✕'}
                              </div>
                              {slot.source==='playtomic' && <div style={{fontSize:8, color:'#60a5fa'}}>PT</div>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>
              Añade tu primera pista para empezar
            </div>
          )}
        </div>
      )}

      {/* ── RESERVAS ── */}
      {tab === 'reservas' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:12}}>📋 Reservas</div>
          {bookings.filter(b=>b.status==='pending').length > 0 && (
            <div style={{...S.card, border:'1px solid rgba(255,165,0,0.3)', marginBottom:16}}>
              <div style={{fontSize:12, fontWeight:800, color:'#FFA500', marginBottom:8}}>⏳ Pendientes de confirmar</div>
              {bookings.filter(b=>b.status==='pending').map(b=>(
                <div key={b.id} style={{padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13, fontWeight:800}}>{b.profiles?.name||'Usuario'}</div>
                      <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{b.date} · {b.start_time} – {b.end_time} · {b.price}€</div>
                    </div>
                    <span style={S.badge(b.status)}>{b.status}</span>
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={()=>updateBookingStatus(b.id,'confirmed')} style={{...S.btn('green'), flex:1, fontSize:12, padding:'8px'}}>✅ Confirmar</button>
                    <button onClick={()=>updateBookingStatus(b.id,'rejected')} style={{...S.btn('red'), flex:1, fontSize:12, padding:'8px'}}>❌ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {bookings.filter(b=>b.status!=='pending').map(b=>(
            <div key={b.id} style={{...S.card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:13, fontWeight:800}}>{b.profiles?.name||'Usuario'}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{b.date} · {b.start_time} · {b.price}€</div>
              </div>
              <span style={S.badge(b.status)}>{b.status}</span>
            </div>
          ))}
          {bookings.length===0 && <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>No hay reservas aún</div>}
        </div>
      )}

      {/* ── STATS ── */}
      {tab === 'stats' && (
        <div style={{padding:'12px'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
            {[
              {label:'Partidos', value:stats.totalMatches, icon:'🏓'},
              {label:'Jugadores', value:stats.totalPlayers, icon:'👥'},
              {label:'Ingresos €', value:(stats.totalEarned/100).toFixed(2), icon:'💶'},
              {label:'Donado €', value:(stats.totalDonated/100).toFixed(2), icon:'💚'},
            ].map(({label,value,icon})=>(
              <div key={label} style={{...S.card, textAlign:'center', padding:16}}>
                <div style={{fontSize:24}}>{icon}</div>
                <div style={{fontSize:24, fontWeight:900, color:'#74B800'}}>{value}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:700}}>{label}</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:12}}>⏰ Ocupación por hora</div>
            {stats.occupancyByHour?.map(({hour, count})=>(
              <div key={hour} style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', width:40, textAlign:'right', fontWeight:700}}>{hour}</div>
                <div style={{flex:1, height:16, background:'rgba(255,255,255,0.04)', borderRadius:4, overflow:'hidden'}}>
                  <div style={{height:'100%', width:`${stats.maxCount?count/stats.maxCount*100:0}%`, background:'linear-gradient(90deg,#74B800,#9BE800)', borderRadius:4, transition:'width .3s'}}/>
                </div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', width:20}}>{count}</div>
              </div>
            ))}
          </div>

          <div style={{...S.card, background:'rgba(116,184,0,0.05)', border:'1px solid rgba(116,184,0,0.15)'}}>
            <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:8}}>💚 Modelo de reparto</div>
            <div style={{display:'flex', gap:8}}>
              {[{l:'Tu club',c:'#74B800'},{l:'Gorila',c:'#9BE800'},{l:'Fundación',c:'#4ade80'}].map(({l,c})=>(
                <div key={l} style={{flex:1, padding:'10px 6px', borderRadius:10, background:'rgba(255,255,255,0.04)', textAlign:'center'}}>
                  <div style={{fontSize:16, fontWeight:900, color:c}}>10cts</div>
                  <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DONACIONES ── */}
      {tab === 'donaciones' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>💚 Donaciones</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>10cts de cada jugador van a la fundación.</div>
          {foundations[0] && (
            <div style={{...S.card, border:'1px solid rgba(116,184,0,0.2)', marginBottom:16}}>
              <div style={{fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.3)', marginBottom:4}}>FUNDACIÓN BENEFICIARIA</div>
              <div style={{fontSize:15, fontWeight:900, color:'#74B800'}}>{foundations[0].name}</div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:4}}>{foundations[0].description}</div>
            </div>
          )}
          {donations.map(d=>(
            <div key={d.id} style={{...S.card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:14, fontWeight:800}}>{new Date(d.month).toLocaleDateString('es',{month:'long',year:'numeric'})}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{d.matches_count} partidos</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20, fontWeight:900, color:'#4ade80'}}>{(d.total_cents/100).toFixed(2)}€</div>
                <div style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>donados</div>
              </div>
            </div>
          ))}
          {donations.length===0 && <div style={{textAlign:'center', padding:32, color:'rgba(255,255,255,0.3)', fontSize:14}}>Aún no hay donaciones</div>}
        </div>
      )}

      {/* ── BONOS ── */}
      {tab === 'bonos' && (
        <div style={{padding:'12px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
            <div style={{fontSize:15, fontWeight:900}}>🎟️ Bonos y abonos</div>
            <button onClick={()=>setShowNewBono(true)} style={{...S.btn('green'), fontSize:12, padding:'8px 14px'}}>+ Crear</button>
          </div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>
            Crea los bonos que quieras: horas sueltas, packs mensuales o acceso ilimitado. Cada club decide.
          </div>

          {bonos.length === 0 && !showNewBono && (
            <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>
              <div style={{fontSize:40, marginBottom:8}}>🎟️</div>
              No hay bonos. ¡Crea el primero!
            </div>
          )}

          {bonos.map(b => (
            <div key={b.id} style={{...S.card, marginBottom:10, opacity: b.activo ? 1 : 0.5}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div>
                  <div style={{fontSize:14, fontWeight:900}}>{b.nombre}</div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2}}>
                    {b.tipo === 'ilimitado' ? '♾️ Acceso ilimitado' : `🕐 ${b.horas_incluidas} horas`}
                    {' · '}{b.duracion_dias} días de validez
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:20, fontWeight:900, color:'#74B800'}}>{(b.precio_cents/100).toFixed(2)}€</div>
                  <span style={S.badge(b.activo ? 'available' : 'rejected')}>{b.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              <div style={{display:'flex', gap:6}}>
                <button onClick={()=>toggleBono(b.id, b.activo)}
                  style={{...S.btn(b.activo ? '' : 'green'), flex:1, fontSize:12, padding:'7px'}}>
                  {b.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                </button>
                <button onClick={()=>deleteBono(b.id)}
                  style={{...S.btn('red'), fontSize:12, padding:'7px 12px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL NUEVO BONO ── */}
      {showNewBono && (
        <div onClick={()=>setShowNewBono(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:16}}>🎟️ Nuevo bono</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input placeholder="Nombre (ej: Bono 10 horas, Abono mensual ilimitado...)" value={bonoForm.nombre}
                onChange={e=>setBonoForm(p=>({...p,nombre:e.target.value}))} style={S.input} />
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:6}}>TIPO DE BONO</div>
                <div style={{display:'flex',gap:6}}>
                  {[{v:'horas',l:'🕐 Por horas'},{v:'ilimitado',l:'♾️ Ilimitado'}].map(({v,l})=>(
                    <button key={v} onClick={()=>setBonoForm(p=>({...p,tipo:v}))}
                      style={{flex:1,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',fontWeight:800,fontSize:12,
                        background:bonoForm.tipo===v?'linear-gradient(135deg,#74B800,#9BE800)':'rgba(255,255,255,0.08)',
                        color:bonoForm.tipo===v?'#000':'#fff'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {bonoForm.tipo === 'horas' && (
                <div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>HORAS INCLUIDAS</div>
                  <input type="number" min="1" max="100" value={bonoForm.horas_incluidas}
                    onChange={e=>setBonoForm(p=>({...p,horas_incluidas:e.target.value}))} style={S.input} />
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>PRECIO (€)</div>
                  <input type="number" min="0" step="0.5" value={(bonoForm.precio_cents/100).toFixed(2)}
                    onChange={e=>setBonoForm(p=>({...p,precio_cents:Math.round(Number(e.target.value)*100)}))} style={S.input} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>VALIDEZ (días)</div>
                  <select value={bonoForm.duracion_dias} onChange={e=>setBonoForm(p=>({...p,duracion_dias:Number(e.target.value)}))}
                    style={{...S.input,background:'#1a1a1a'}}>
                    {[7,15,30,60,90,180,365].map(d=><option key={d} value={d}>{d} días</option>)}
                  </select>
                </div>
              </div>
              <div style={{background:'rgba(116,184,0,0.05)',borderRadius:10,padding:12,border:'1px solid rgba(116,184,0,0.15)'}}>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>
                  📱 Los jugadores verán este bono en la página de tu club y podrán comprarlo directamente desde la app.
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={createBono} disabled={savingBono||!bonoForm.nombre.trim()}
                  style={{...S.btn('green'),flex:1,opacity:savingBono||!bonoForm.nombre.trim()?0.5:1}}>
                  {savingBono?'Creando…':'✅ Crear bono'}
                </button>
                <button onClick={()=>setShowNewBono(false)} style={S.btn('')}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIG ── */}
      {tab === 'config' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:12}}>⚙️ Configuración</div>

          <div style={S.card}>
            <div style={{...S.card, marginBottom:12, background:'rgba(116,184,0,0.03)', border:'1px solid rgba(116,184,0,0.15)'}}>
              <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:10}}>🌐 Widget para tu web</div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10, lineHeight:1.6}}>
                Pega este código en tu web y tus clientes podrán reservar sin salir de ella.
              </div>
              <div style={{background:'#0a0a0a', borderRadius:8, padding:12, fontFamily:'monospace', fontSize:11, color:'#74B800', lineHeight:1.8, overflowX:'auto', marginBottom:8}}>
                {`<iframe src="https://gorila-padel.vercel.app/widget/club/${clubAdmin.club_id}" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`}
              </div>
              <button onClick={()=>{navigator.clipboard.writeText(`<iframe src="https://gorila-padel.vercel.app/widget/club/${clubAdmin.club_id}" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`); alert('✅ Copiado al portapapeles');}}
                style={{...S.btn('green'), width:'100%', fontSize:12}}>
                📋 Copiar código
              </button>
            </div>

            <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:10}}>🔵 Sincronización Playtomic</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10, lineHeight:1.6}}>
              Pega la URL pública de tu club en Playtomic y sincronizaremos automáticamente los horarios ocupados. No necesitas gestionar dos calendarios.
            </div>
            <input placeholder="https://playtomic.io/es/venues/tu-club" value={playtomicUrl}
              onChange={e=>setPlaytomicUrl(e.target.value)} style={{...S.input, marginBottom:8}} />
            <button onClick={()=>alert('Sincronización Playtomic próximamente disponible')} disabled={syncing}
              style={{...S.btn('blue'), width:'100%'}}>
              {syncing?'Sincronizando…':'🔄 Sincronizar con Playtomic'}
            </button>
            <div style={{fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:6, textAlign:'center'}}>
              Los slots de Playtomic aparecerán en azul en el calendario
            </div>
          </div>

          <div style={S.card}>
            <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:10}}>🏟️ Mis pistas</div>
            {courts.map(c=>(
              <div key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <div>
                  <div style={{fontSize:13, fontWeight:800}}>{c.name}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{c.court_type==='indoor'?'🏠 Indoor':'☀️ Outdoor'}</div>
                </div>
                <span style={S.badge(c.is_active?'available':'rejected')}>{c.is_active?'Activa':'Inactiva'}</span>
              </div>
            ))}
            <button onClick={()=>setShowNewCourt(true)} style={{...S.btn('green'), width:'100%', marginTop:10}}>+ Nueva pista</button>
          </div>
        </div>
      )}

      {/* ── LISTA DE ESPERA ── */}
      {tab === 'espera' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>⏳ Lista de espera</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>Cuando una reserva se cancela, notifica automáticamente al primero de la lista.</div>
          {waitlist.length === 0 && <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>No hay nadie en lista de espera</div>}
          {[...new Set(waitlist.map(w=>w.slot_id))].map(slotId => {
            const slotWaiters = waitlist.filter(w=>w.slot_id===slotId).sort((a,b)=>a.position-b.position);
            const slot = slotWaiters[0]?.court_slots;
            return (
              <div key={slotId} style={{...S.card, marginBottom:12}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:900, color:'#fff'}}>{slot?.date} · {slot?.start_time?.slice(0,5)} – {slot?.end_time?.slice(0,5)}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{slotWaiters.length} persona{slotWaiters.length!==1?'s':''} esperando</div>
                  </div>
                  <button onClick={()=>notifyFirstInWaitlist(slotId)} style={{...S.btn('green'), fontSize:11, padding:'6px 12px'}}>
                    📣 Notificar al 1º
                  </button>
                </div>
                {slotWaiters.map((w,i)=>(
                  <div key={w.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{width:24, height:24, borderRadius:999, background:'rgba(116,184,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#74B800', flexShrink:0}}>
                      {i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:800}}>{w.profiles?.name||'Usuario'}</div>
                      {w.status==='notified' && w.expires_at && (
                        <div style={{fontSize:10, color:'#FFA500'}}>⏰ Notificado · expira {new Date(w.expires_at).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</div>
                      )}
                    </div>
                    <span style={S.badge(w.status==='notified'?'pending':'available')}>{w.status==='notified'?'Notificado':'Esperando'}</span>
                    <button onClick={()=>removeFromWaitlist(w.id)} style={{background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:14}}>✕</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PRECIOS DINÁMICOS ── */}
      {tab === 'precios' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>💶 Precios dinámicos</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>Configura precios distintos por franja horaria y tipo de día. Se aplican automáticamente al publicar slots.</div>

          {/* Selector pista */}
          <div style={{display:'flex', gap:6, marginBottom:12, overflowX:'auto'}}>
            {courts.map(c=>(
              <button key={c.id} onClick={()=>setSelectedCourt(c.id)}
                style={{padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:12, whiteSpace:'nowrap',
                  background:selectedCourt===c.id?'linear-gradient(135deg,#74B800,#9BE800)':'rgba(255,255,255,0.08)',
                  color:selectedCourt===c.id?'#000':'#fff'}}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Tabla de precios */}
          {[{type:'weekday',label:'📅 Lunes – Viernes'},{type:'weekend',label:'🎉 Sábado – Domingo'}].map(({type,label})=>(
            <div key={type} style={{...S.card, marginBottom:12}}>
              <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:10}}>{label}</div>
              {pricing.filter(p=>String(p.court_id)===String(selectedCourt)&&p.day_type===type).map(p=>(
                <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{fontSize:13}}>{String(p.start_hour).padStart(2,'0')}:00 – {String(p.end_hour).padStart(2,'0')}:00</div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{fontSize:16, fontWeight:900, color:'#74B800'}}>{p.price}€</div>
                    <button onClick={()=>{setEditingPrice(p); setPricingForm({day_type:p.day_type, start_hour:p.start_hour, end_hour:p.end_hour, price:p.price});}}
                      style={{...S.btn(''), padding:'4px 10px', fontSize:11}}>Editar</button>
                  </div>
                </div>
              ))}
              <button onClick={()=>{setEditingPrice('new'); setPricingForm({day_type:type, start_hour:8, end_hour:14, price:10});}}
                style={{...S.btn('green'), width:'100%', marginTop:10, fontSize:12}}>+ Nueva franja</button>
            </div>
          ))}
        </div>
      )}

      {/* ── COMUNICACIÓN ── */}
      {tab === 'comunicacion' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>📣 Comunicar con jugadores</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>Envía un push a todos los jugadores que han jugado en tu club en los últimos 30 días. Máximo 2 mensajes por semana.</div>

          <div style={S.card}>
            <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:12}}>✉️ Nuevo mensaje</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <input placeholder="Título (ej: Torneo flash esta tarde 🏆)" value={broadcastForm.title}
                onChange={e=>setBroadcastForm(p=>({...p,title:e.target.value}))}
                style={S.input} />
              <textarea placeholder="Mensaje (ej: Quedan 2 plazas para el torneo de las 18h. ¡Apúntate ya!)" value={broadcastForm.body}
                onChange={e=>setBroadcastForm(p=>({...p,body:e.target.value}))}
                rows={3} style={{...S.input, resize:'none'}} />
              <div style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>📱 Se enviará como push notification a los jugadores recientes de tu club</div>
              <button onClick={sendBroadcast} disabled={sending||!broadcastForm.title.trim()||!broadcastForm.body.trim()}
                style={{...S.btn('green'), opacity:sending||!broadcastForm.title.trim()||!broadcastForm.body.trim()?0.5:1}}>
                {sending?'Enviando…':'📣 Enviar a jugadores'}
              </button>
            </div>
          </div>

          {broadcasts.length > 0 && (
            <div style={{marginTop:16}}>
              <div style={{fontSize:13, fontWeight:900, color:'rgba(255,255,255,0.5)', marginBottom:8}}>MENSAJES ANTERIORES</div>
              {broadcasts.map(b=>(
                <div key={b.id} style={{...S.card, marginBottom:8}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
                    <div style={{fontSize:13, fontWeight:800}}>{b.title}</div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>{new Date(b.sent_at).toLocaleDateString('es')}</div>
                  </div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:4}}>{b.body}</div>
                  <div style={{fontSize:11, color:'#74B800', fontWeight:700}}>👥 {b.recipients_count} destinatarios</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TORNEOS FLASH ── */}
      {tab === 'torneos' && (
        <div style={{padding:'12px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
            <div style={{fontSize:15, fontWeight:900}}>🏆 Torneos flash</div>
            <button onClick={()=>setShowNewTournament(true)} style={{...S.btn('green'), fontSize:12, padding:'8px 14px'}}>+ Crear</button>
          </div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>Torneos rápidos de 2h para jugadores de tu club. Se auto-organizan y generan el cuadro automáticamente.</div>

          {tournaments.map(t=>{
            const enrolled = (t.flash_tournament_players||[]).length;
            const isFull = enrolled >= t.max_players;
            return (
              <div key={t.id} style={{...S.card, marginBottom:10}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14, fontWeight:900}}>{t.name}</div>
                    <div style={{fontSize:12, color:'rgba(255,255,255,0.5)'}}>{t.date} · {t.start_time?.slice(0,5)} · Nivel {t.level}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:2}}>{t.price_per_player>0?`${t.price_per_player}€/jugador`:'Gratis'}</div>
                  </div>
                  <span style={S.badge(t.status==='open'?'available':t.status==='in_progress'?'pending':'confirmed')}>
                    {t.status==='open'?'Abierto':t.status==='in_progress'?'En curso':'Terminado'}
                  </span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                  <div style={{flex:1, height:8, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${enrolled/t.max_players*100}%`, background:isFull?'#ff6b6b':'linear-gradient(90deg,#74B800,#9BE800)', borderRadius:4}}/>
                  </div>
                  <div style={{fontSize:12, fontWeight:800, color:isFull?'#ff6b6b':'#74B800'}}>{enrolled}/{t.max_players}</div>
                </div>
                {t.status==='open' && enrolled >= 4 && (
                  <button onClick={()=>generateBracket(t)} style={{...S.btn('green'), width:'100%', fontSize:12}}>
                    ⚡ Generar cuadro y empezar
                  </button>
                )}
                {t.status==='open' && enrolled < 4 && (
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', textAlign:'center', padding:'6px 0'}}>
                    Necesitas al menos 4 jugadores inscritos
                  </div>
                )}
                {t.status==='in_progress' && (
                  <div style={{fontSize:12, color:'#FFA500', fontWeight:800, textAlign:'center', padding:'6px 0'}}>🏓 Torneo en curso</div>
                )}
              </div>
            );
          })}
          {tournaments.length===0 && (
            <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>
              <div style={{fontSize:40, marginBottom:8}}>🏆</div>
              No hay torneos aún. ¡Crea el primero!
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NUEVO TORNEO ── */}
      {showNewTournament && (
        <div onClick={()=>setShowNewTournament(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:16}}>🏆 Nuevo torneo flash</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input placeholder="Nombre (ej: Torneo Tarde Viernes)" value={tournamentForm.name}
                onChange={e=>setTournamentForm(p=>({...p,name:e.target.value}))} style={S.input} />
              <div style={{display:'flex',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>FECHA</div>
                  <input type="date" value={tournamentForm.date}
                    onChange={e=>setTournamentForm(p=>({...p,date:e.target.value}))} style={{...S.input,background:'#1a1a1a'}} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>HORA</div>
                  <input type="time" value={tournamentForm.start_time}
                    onChange={e=>setTournamentForm(p=>({...p,start_time:e.target.value}))} style={{...S.input,background:'#1a1a1a'}} />
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>JUGADORES MÁX</div>
                  <select value={tournamentForm.max_players} onChange={e=>setTournamentForm(p=>({...p,max_players:Number(e.target.value)}))}
                    style={{...S.input,background:'#1a1a1a'}}>
                    {[4,8,12,16].map(n=><option key={n} value={n}>{n} jugadores</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>NIVEL</div>
                  <select value={tournamentForm.level} onChange={e=>setTournamentForm(p=>({...p,level:e.target.value}))}
                    style={{...S.input,background:'#1a1a1a'}}>
                    {['todos','iniciación','medio','avanzado'].map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>PRECIO POR JUGADOR (0 = gratis)</div>
                <input type="number" min="0" step="0.5" value={tournamentForm.price_per_player}
                  onChange={e=>setTournamentForm(p=>({...p,price_per_player:e.target.value}))} style={S.input} />
              </div>
              <button onClick={createTournament} disabled={saving||!tournamentForm.name.trim()||!tournamentForm.date}
                style={{...S.btn('green'), opacity:saving||!tournamentForm.name.trim()||!tournamentForm.date?0.5:1}}>
                {saving?'Creando…':'🏆 Crear torneo y notificar jugadores'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INFORME MENSUAL ── */}
      {tab === 'informe' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>📈 Informe mensual</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:12}}>Resumen completo de actividad de tu club.</div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:16}}>
            <input type="month" value={reportMonth} onChange={e=>setReportMonth(e.target.value)}
              style={{...S.input, flex:1, background:'#1a1a1a'}} />
            <button onClick={()=>generateMonthReport(clubAdmin.club_id, reportMonth)}
              style={{...S.btn('green'), whiteSpace:'nowrap'}}>Ver informe</button>
          </div>
          {monthReport && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
                {[
                  {icon:'🏓', label:'Partidos', value:monthReport.totalMatches},
                  {icon:'👥', label:'Jugadores', value:monthReport.totalPlayers},
                  {icon:'💶', label:'Ingresos €', value:(monthReport.totalEarned/100).toFixed(2)},
                  {icon:'💚', label:'Donado €', value:(monthReport.totalDonated/100).toFixed(2)},
                  {icon:'📅', label:'Reservas', value:monthReport.confirmedBookings},
                  {icon:'💰', label:'Rev. reservas €', value:monthReport.bookingRevenue.toFixed(2)},
                ].map(({icon,label,value})=>(
                  <div key={label} style={{...S.card, textAlign:'center', padding:14}}>
                    <div style={{fontSize:22}}>{icon}</div>
                    <div style={{fontSize:22, fontWeight:900, color:'#74B800'}}>{value}</div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{...S.card, background:'rgba(116,184,0,0.05)', border:'1px solid rgba(116,184,0,0.15)'}}>
                <div style={{fontSize:13, fontWeight:900, color:'#74B800', marginBottom:8}}>⏰ Hora pico del mes</div>
                <div style={{fontSize:28, fontWeight:900, color:'#fff', textAlign:'center', padding:'8px 0'}}>{monthReport.peakHour}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', textAlign:'center'}}>Hora con más partidos jugados</div>
              </div>
              <div style={{...S.card, marginTop:10, background:'rgba(116,184,0,0.03)', border:'1px solid rgba(116,184,0,0.1)'}}>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.8}}>
                  📊 En <strong style={{color:'#fff'}}>{new Date(monthReport.month+'-01').toLocaleDateString('es',{month:'long',year:'numeric'})}</strong> tu club generó <strong style={{color:'#74B800'}}>{(monthReport.totalEarned/100).toFixed(2)}€</strong> en ingresos y donó <strong style={{color:'#4ade80'}}>{(monthReport.totalDonated/100).toFixed(2)}€</strong> a la fundación beneficiaria a través de <strong style={{color:'#fff'}}>{monthReport.totalMatches}</strong> partidos con <strong style={{color:'#fff'}}>{monthReport.totalPlayers}</strong> jugadores.
                </div>
              </div>
            </>
          )}
          {!monthReport && (
            <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>Selecciona un mes y pulsa "Ver informe"</div>
          )}
        </div>
      )}

      {/* ── VALORACIONES ── */}
      {tab === 'valoraciones' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:4}}>⭐ Valoraciones del club</div>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>Lo que dicen los jugadores sobre tu instalación.</div>
          {ratings.length > 0 && (
            <div style={{...S.card, background:'rgba(116,184,0,0.05)', border:'1px solid rgba(116,184,0,0.2)', marginBottom:16, textAlign:'center'}}>
              <div style={{fontSize:36, fontWeight:900, color:'#74B800'}}>
                {(ratings.reduce((s,r)=>s+r.rating,0)/ratings.length).toFixed(1)}
              </div>
              <div style={{fontSize:18, marginBottom:4}}>{'⭐'.repeat(Math.round(ratings.reduce((s,r)=>s+r.rating,0)/ratings.length))}</div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>{ratings.length} valoracion{ratings.length!==1?'es':''}</div>
              <div style={{display:'flex', justifyContent:'center', gap:8, marginTop:10}}>
                {[5,4,3,2,1].map(star=>{
                  const count = ratings.filter(r=>r.rating===star).length;
                  const pct = ratings.length ? count/ratings.length*100 : 0;
                  return (
                    <div key={star} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                      <div style={{fontSize:10, color:'rgba(255,255,255,0.4)'}}>{star}⭐</div>
                      <div style={{width:8, height:40, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden', position:'relative'}}>
                        <div style={{position:'absolute', bottom:0, width:'100%', height:`${pct}%`, background:'#74B800', borderRadius:4}}/>
                      </div>
                      <div style={{fontSize:9, color:'rgba(255,255,255,0.3)'}}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {ratings.map(r=>(
            <div key={r.id} style={{...S.card, marginBottom:8}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  {r.profiles?.avatar_url ? (
                    <img src={r.profiles.avatar_url} style={{width:32,height:32,borderRadius:999,objectFit:'cover'}} alt=""/>
                  ) : (
                    <div style={{width:32,height:32,borderRadius:999,background:'rgba(116,184,0,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🦍</div>
                  )}
                  <div>
                    <div style={{fontSize:13, fontWeight:800}}>{r.profiles?.name||'Jugador'}</div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>{new Date(r.created_at).toLocaleDateString('es')}</div>
                  </div>
                </div>
                <div style={{fontSize:16}}>{'⭐'.repeat(r.rating)}</div>
              </div>
              {r.comment && <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:6, lineHeight:1.5, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.05)'}}>{r.comment}</div>}
            </div>
          ))}
          {ratings.length===0 && (
            <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:14}}>
              <div style={{fontSize:40, marginBottom:8}}>⭐</div>
              Aún no hay valoraciones
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PRECIO ── */}
      {editingPrice && (
        <div onClick={()=>setEditingPrice(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:16}}>💶 {editingPrice==='new'?'Nueva franja de precio':'Editar precio'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'flex',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>DESDE</div>
                  <select value={pricingForm.start_hour} onChange={e=>setPricingForm(p=>({...p,start_hour:Number(e.target.value)}))}
                    style={{...S.input,background:'#1a1a1a'}}>
                    {Array.from({length:16},(_,i)=>i+8).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>HASTA</div>
                  <select value={pricingForm.end_hour} onChange={e=>setPricingForm(p=>({...p,end_hour:Number(e.target.value)}))}
                    style={{...S.input,background:'#1a1a1a'}}>
                    {Array.from({length:16},(_,i)=>i+9).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>PRECIO (€/hora)</div>
                <input type="number" min="0" step="0.5" value={pricingForm.price}
                  onChange={e=>setPricingForm(p=>({...p,price:e.target.value}))} style={S.input} />
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={savePricing} disabled={saving} style={{...S.btn('green'),flex:1}}>{saving?'Guardando…':'✅ Guardar'}</button>
                <button onClick={()=>setEditingPrice(null)} style={S.btn('')}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SLOT ── */}
      {slotModal && (
        <div onClick={()=>setSlotModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:4}}>📅 Publicar slot</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:16}}>
              {slotModal.court.name} · {slotModal.date.toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'})} · {slotModal.hour}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>PRECIO (€)</div>
                <input type="number" min="0" step="0.5" placeholder="10" value={slotForm.price}
                  onChange={e=>setSlotForm(p=>({...p,price:e.target.value}))} style={S.input} />
              </div>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:700,marginBottom:4}}>DURACIÓN</div>
                <div style={{display:'flex',gap:6}}>
                  {[60,90,120].map(d=>(
                    <button key={d} onClick={()=>setSlotForm(p=>({...p,duration:d}))}
                      style={{flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:800,fontSize:12,
                        background:slotForm.duration===d?'linear-gradient(135deg,#74B800,#9BE800)':'rgba(255,255,255,0.08)',
                        color:slotForm.duration===d?'#000':'#fff'}}>
                      {d}min
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button onClick={createSlot} disabled={saving} style={{...S.btn('green'),flex:1}}>
                  {saving?'Guardando…':'✅ Publicar slot'}
                </button>
                <button onClick={()=>setSlotModal(null)} style={{...S.btn(''),padding:'10px 16px'}}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA PISTA ── */}
      {showNewCourt && (
        <div onClick={()=>setShowNewCourt(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
            <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:16}}>🏟️ Nueva pista</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input placeholder="Nombre (ej: Pista 1, Pista Central…)" value={courtForm.name}
                onChange={e=>setCourtForm(p=>({...p,name:e.target.value}))} style={S.input} />
              <select value={courtForm.court_type} onChange={e=>setCourtForm(p=>({...p,court_type:e.target.value}))}
                style={{...S.input,background:'#1a1a1a'}}>
                <option value="outdoor">☀️ Outdoor</option>
                <option value="indoor">🏠 Indoor</option>
                <option value="covered">⛺ Cubierta</option>
              </select>
              <button onClick={createCourt} disabled={saving||!courtForm.name.trim()} style={S.btn('green')}>
                {saving?'Guardando…':'✅ Crear pista'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
