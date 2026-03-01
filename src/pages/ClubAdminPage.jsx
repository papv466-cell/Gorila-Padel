// src/pages/ClubAdminPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const TABS = ["calendario", "reservas", "stats", "donaciones", "config"];
const TAB_LABELS = {
  calendario: "📅 Calendario",
  reservas: "📋 Reservas",
  stats: "📊 Stats",
  donaciones: "💚 Donaciones",
  config: "⚙️ Config"
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
  const [syncing, setSyncing] = useState(false);

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
      ]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
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

      {/* ── CONFIG ── */}
      {tab === 'config' && (
        <div style={{padding:'12px'}}>
          <div style={{fontSize:15, fontWeight:900, marginBottom:12}}>⚙️ Configuración</div>

          <div style={S.card}>
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
