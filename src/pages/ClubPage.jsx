// src/pages/ClubPage.jsx
// Ruta: /club/:clubId
// Muestra info del club, partidos activos, clases y botón crear partido

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { useToast } from "../components/ToastProvider";

/* ─── Helpers ─── */
function toDateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function safeParseDate(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) {
    const [y,mo,d] = m[1].split("-").map(Number);
    return new Date(y, mo-1, d, 0, 0, 0, 0);
  }
  return new Date(s);
}
function formatWhen(startAt) {
  try {
    const s = String(startAt||"");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
    return s;
  } catch { return String(startAt||""); }
}
function localYMD(startAt) {
  if (!startAt) return "";
  const m = String(startAt).match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || "";
}

const LEVEL_COLOR = { iniciacion:"#3b82f6", medio:"#f59e0b", alto:"#ef4444" };
const LEVEL_LABEL = { iniciacion:"Iniciación", medio:"Medio", alto:"Alto" };

const IS = {
  width:"100%", padding:"10px 12px", borderRadius:10,
  background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
  color:"#fff", fontSize:13, boxSizing:"border-box",
};

export default function ClubPage() {
  const { clubId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [club, setClub] = useState(null);
  const [matches, setMatches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("partidos"); // partidos | clases | info
  const [approvedCounts, setApprovedCounts] = useState({});
  const [myReqStatus, setMyReqStatus] = useState({});

  /* ─── Crear partido ─── */
  const [openCreate, setOpenCreate] = useState(false);
  const [slots, setSlots] = useState([]);
  const [courts, setCourts] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [myRating, setMyRating] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);
  const [clubRatings, setClubRatings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [clubBonos, setClubBonos] = useState([]);
  const [myBonos, setMyBonos] = useState([]);
  const [buyingBono, setBuyingBono] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const todayISO = toDateInputValue(new Date());
  const [form, setForm] = useState({
    date: todayISO, time: "19:00", durationMin: 90,
    level: "medio", pricePerPlayer: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { load(); }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    const normalizedId = clubId.toLowerCase();
    supabase.from('club_courts').select('*').eq('club_id', normalizedId).then(({data})=>{
      setCourts(data||[]);
      if (data?.length) setSelectedCourt(data[0].id);
    });
    supabase.from('club_ratings').select('*, profiles(name, handle, avatar_url)').eq('club_id', normalizedId).order('created_at',{ascending:false}).then(({data})=>setClubRatings(data||[]));
    supabase.from('club_bonos').select('*').eq('club_id', normalizedId).eq('activo', true).order('precio_cents').then(({data})=>setClubBonos(data||[]));
  }, [clubId]);

  useEffect(() => {
    if (!clubId || !session?.user?.id) return;
    const normalizedId = clubId.toLowerCase();
    supabase.from('user_bonos').select('*, club_bonos(nombre, tipo, horas_incluidas)').eq('club_id', normalizedId).eq('user_id', session.user.id).eq('activo', true).gte('fecha_expiracion', new Date().toISOString()).then(({data})=>setMyBonos(data||[]));
    supabase.from('club_ratings').select('*').eq('club_id', normalizedId).eq('user_id', session.user.id).maybeSingle().then(({data})=>{
      if (data) { setMyRating(data); setRatingValue(data.rating); setRatingComment(data.comment||''); }
    });
  }, [clubId, session]);

  async function load() {
    setLoading(true);
    try {
      // 1. Datos del club desde Google Sheets
      const clubs = await fetchClubsFromGoogleSheet();
      const found = (clubs || []).find(c => String(c.id) === String(clubId));
      setClub(found || null);

      const clubName = found?.name || searchParams.get("name") || "";

      // 2. Partidos del club desde Supabase
      const today = toDateInputValue(new Date());
      const { data: matchRows } = await supabase
        .from("matches")
        .select("*")
        .or(`club_id.eq.${clubId},club_name.ilike.${clubName}`)
        .gte("start_at", `${today}T00:00:00`)
        .order("start_at", { ascending: true })
        .limit(50);

      const mList = Array.isArray(matchRows) ? matchRows : [];
      setMatches(mList);

      // 3. Approved counts
      const ids = mList.map(m => m.id);
      if (ids.length) {
        const { data: appRows } = await supabase
          .from("match_join_requests")
          .select("match_id")
          .in("match_id", ids)
          .eq("status", "approved");
        const counts = {};
        for (const r of appRows || []) counts[r.match_id] = (counts[r.match_id] || 0) + 1;
        setApprovedCounts(counts);

        // 4. Mis solicitudes
        if (session?.user?.id) {
          const { data: myRows } = await supabase
            .from("match_join_requests")
            .select("match_id, status")
            .in("match_id", ids)
            .eq("user_id", session.user.id);
          const myMap = {};
          for (const r of myRows || []) myMap[r.match_id] = r.status;
          setMyReqStatus(myMap);
        }
      }

      // 5. Clases del club
      const { data: classRows } = await supabase
        .from("classes")
        .select("*")
        .or(`club_id.eq.${clubId},club_name.ilike.${clubName}`)
        .gte("start_at", `${today}T00:00:00`)
        .order("start_at", { ascending: true })
        .limit(30);
      setClasses(Array.isArray(classRows) ? classRows : []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!session) { navigate("/login"); return; }
    try {
      setSaveError(null); setSaving(true);
      const startAt = `${form.date}T${form.time}:00`;
      const { error } = await supabase.from("matches").insert({
        club_id: clubId,
        club_name: club?.name || "",
        start_at: startAt,
        duration_min: Number(form.durationMin) || 90,
        level: form.level,
        reserved_spots: 1,
        price_per_player: form.pricePerPlayer || null,
        created_by_user: session.user.id,
      });
      if (error) throw error;
      toast.success("Partido creado ✅");
      setOpenCreate(false);
      await load();
      setTab("partidos");
    } catch (e) {
      setSaveError(e?.message || "Error al crear");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Partidos filtrados por día seleccionado ─── */
  const [selectedDay, setSelectedDay] = useState("all");

  async function loadSlots(courtId, date) {
    if (!courtId || !date) return;
    const {data} = await supabase.from('court_slots').select('*').eq('court_id', courtId).eq('date', date).eq('status','available').order('start_time');
    setSlots(data||[]);
  }

  async function buyBono(bono) {
    if (!session) { navigate('/login'); return; }
    try {
      setBuyingBono(bono.id);
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + bono.duracion_dias);
      const {error} = await supabase.from('user_bonos').insert({
        user_id: session.user.id,
        club_id: bono.club_id,
        bono_id: bono.id,
        horas_restantes: bono.tipo === 'ilimitado' ? null : bono.horas_incluidas,
        fecha_expiracion: expiration.toISOString(),
        activo: true,
      });
      if (error) throw error;
      const normalizedId = clubId.toLowerCase();
      const {data} = await supabase.from('user_bonos').select('*, club_bonos(nombre, tipo, horas_incluidas)').eq('club_id', normalizedId).eq('user_id', session.user.id).eq('activo', true).gte('fecha_expiracion', new Date().toISOString());
      setMyBonos(data||[]);
      toast.success('🎟️ Bono activado correctamente');
    } catch(e) { toast.error(e.message); }
    finally { setBuyingBono(null); }
  }

  async function bookSlot(slot) {
    if (!session) { navigate('/login'); return; }
    try {
      setBookingSaving(true);
      // Ver si tiene bono activo con horas
      const bonoActivo = myBonos.find(b => b.activo && (b.club_bonos?.tipo === 'ilimitado' || (b.horas_restantes && b.horas_restantes > 0)));
      const precioFinal = bonoActivo ? 0 : slot.price;
      const {error} = await supabase.from('court_bookings').insert({
        club_id: slot.club_id,
        court_number: slot.court_id,
        user_id: session.user.id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        price_cents: Math.round(precioFinal * 100),
        status: 'pending',
      });
      if (error) throw error;
      // Descontar 1 hora del bono si no es ilimitado
      if (bonoActivo && bonoActivo.club_bonos?.tipo !== 'ilimitado') {
        const nuevasHoras = (bonoActivo.horas_restantes || 1) - 1;
        await supabase.from('user_bonos').update({
          horas_restantes: nuevasHoras,
          activo: nuevasHoras > 0,
        }).eq('id', bonoActivo.id);
        setMyBonos(prev => prev.map(b => b.id === bonoActivo.id ? {...b, horas_restantes: nuevasHoras, activo: nuevasHoras > 0} : b).filter(b => b.activo));
      }
      await supabase.from('court_slots').update({status:'pending'}).eq('id', slot.id);
      setSlots(prev=>prev.filter(s=>s.id!==slot.id));
      setBookingSlot(null);
      if (bonoActivo) {
        toast.success('✅ Reserva enviada · 1 hora descontada de tu bono');
      } else {
        alert('✅ Reserva enviada. El club la confirmará en breve.');
      }
    } catch(e) { alert(e.message); }
    finally { setBookingSaving(false); }
  }

  async function saveRating() {
    if (!session) { navigate('/login'); return; }
    try {
      setRatingSaving(true);
      const clubIdParam = (club?.id || String(window.location.pathname.split('/').pop())).toLowerCase();
      const payload = { club_id: clubIdParam, user_id: session.user.id, rating: ratingValue, comment: ratingComment.trim()||null };
      const {data, error} = await supabase.from('club_ratings').upsert(payload, {onConflict:'club_id,user_id'}).select().single();
      if (error) throw error;
      setMyRating(data);
      setClubRatings(prev=>{
        const idx=prev.findIndex(r=>r.user_id===session.user.id);
        if(idx>=0){const n=[...prev];n[idx]={...data,profiles:prev[idx]?.profiles};return n;}
        return [data,...prev];
      });
      alert('✅ ¡Gracias por tu valoración!');
    } catch(e) { alert(e.message); }
    finally { setRatingSaving(false); }
  }
  const uniqueDays = useMemo(() => {
    const days = new Set(matches.map(m => localYMD(m.start_at)).filter(Boolean));
    return Array.from(days).sort();
  }, [matches]);

  const visibleMatches = useMemo(() => {
    if (selectedDay === "all") return matches;
    return matches.filter(m => localYMD(m.start_at) === selectedDay);
  }, [matches, selectedDay]);

  function fmtDay(d) {
    try {
      const [y, mo, day] = d.split("-").map(Number);
      return new Date(y, mo-1, day).toLocaleDateString("es-ES", { weekday:"short", day:"numeric", month:"short" });
    } catch { return d; }
  }

  /* ─── Render ─── */
  const clubColor = "#74B800";

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        @keyframes gpFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .gpClubCard { animation: gpFadeUp 0.3s ease both; }
        .gpClubTab { transition: all .15s; }
        .gpClubTab:hover { background: rgba(116,184,0,0.1) !important; }
        .gpMatchItem { transition: background .15s; cursor: pointer; }
        .gpMatchItem:hover { background: rgba(116,184,0,0.05) !important; }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ paddingBottom: 40 }}>

          {loading ? (
            <div style={{ textAlign:"center", padding:60, color:"rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize:40 }}>🏟️</div>
              <div style={{ marginTop:8, fontSize:13 }}>Cargando club…</div>
            </div>
          ) : (
            <>
              {/* ── HERO DEL CLUB ── */}
              <div className="gpClubCard" style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(116,184,0,0.2)", background: "#111" }}>
                {/* Banner / imagen */}
                <div style={{ height: 120, background: "linear-gradient(135deg, #1a2a00, #0d1a00)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 30% 50%, rgba(116,184,0,0.18), transparent 70%)" }} />
                  {club?.urlimagen
                    ? <img src={club.urlimagen} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <div style={{ fontSize:56, zIndex:1 }}>🏟️</div>
                  }
                  {/* Botón crear flotante */}
                  <button
                    onClick={() => { if(!session){navigate("/login");return;} setOpenCreate(true); }}
                    style={{ position:"absolute", top:10, right:10, zIndex:2, padding:"7px 12px", borderRadius:10, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, border:"none", cursor:"pointer", fontSize:12, boxShadow:"0 4px 12px rgba(0,0,0,0.4)" }}>
                    ➕ Crear
                  </button>
                </div>

                <div style={{ padding: "14px 16px" }}>
                  {/* Nombre full width — sin columnas */}
                  <h1 style={{ margin:"0 0 4px", fontSize:18, fontWeight:900, color:"#fff", lineHeight:1.3, wordBreak:"break-word" }}>
                    {club?.name || searchParams.get("name") || `Club #${clubId}`}
                  </h1>
                  {club?.city && (
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:12 }}>
                      📍 {club.city}
                    </div>
                  )}

                  {/* Stats rápidas */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <div style={{ padding:"5px 10px", borderRadius:8, background:"rgba(116,184,0,0.1)", border:"1px solid rgba(116,184,0,0.2)", fontSize:11, fontWeight:800, color:"#74B800" }}>
                      🏓 {matches.length} partido{matches.length !== 1 ? "s" : ""} próximos
                    </div>
                    <div style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.7)" }}>
                      📚 {classes.length} clase{classes.length !== 1 ? "s" : ""} disponibles
                    </div>
                    {club?.lat && club?.lng && (
                      <a href={`https://maps.google.com/?q=${club.lat},${club.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.7)", textDecoration:"none" }}>
                        🗺️ Ver en mapa
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* ── TABS ── */}
              <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                {[
                  { key:"partidos", label:"Partidos", emoji:"🏓", count:matches.length },
                  { key:"clases",   label:"Clases",   emoji:"📚", count:classes.length },
                  { key:"reservar", label:"Reservar",  emoji:"📅", count:null },
                  { key:"bonos",    label:"Bonos",     emoji:"🎟️", count:clubBonos.length||null },
                  { key:"valorar",  label:"Valorar",   emoji:"⭐", count:null },
                  { key:"info",     label:"Info",      emoji:"ℹ️",  count:null },
                ].map(t => (
                  <button key={t.key} className="gpClubTab"
                    onClick={() => setTab(t.key)}
                    style={{ flex:1, padding:"8px 4px", borderRadius:10, border: tab===t.key ? "1px solid #74B800" : "1px solid transparent", cursor:"pointer", fontSize:11, fontWeight:900, background: tab===t.key ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.06)", color: tab===t.key ? "#74B800" : "rgba(255,255,255,0.6)", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <span style={{ fontSize:16 }}>{t.emoji}</span>
                    <span>{t.label}{t.count !== null ? ` (${t.count})` : ""}</span>
                  </button>
                ))}
              </div>

              {/* ══ TAB: PARTIDOS ══ */}
              {tab === "partidos" && (
                <div>
                  {/* Filtro por día */}
                  {uniqueDays.length > 1 && (
                    <div style={{ display:"flex", gap:5, overflowX:"auto", marginBottom:12, paddingBottom:4 }}>
                      <button onClick={() => setSelectedDay("all")}
                        style={{ padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:800, whiteSpace:"nowrap", background: selectedDay==="all" ? "#74B800" : "rgba(255,255,255,0.08)", color: selectedDay==="all" ? "#000" : "rgba(255,255,255,0.6)" }}>
                        Todos
                      </button>
                      {uniqueDays.map(d => (
                        <button key={d} onClick={() => setSelectedDay(d)}
                          style={{ padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:800, whiteSpace:"nowrap", background: selectedDay===d ? "#74B800" : "rgba(255,255,255,0.08)", color: selectedDay===d ? "#000" : "rgba(255,255,255,0.6)" }}>
                          {fmtDay(d)}
                        </button>
                      ))}
                    </div>
                  )}

                  {visibleMatches.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"40px 20px", background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize:36 }}>🦍</div>
                      <div style={{ color:"#fff", fontWeight:900, marginTop:8 }}>No hay partidos próximos</div>
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>¡Sé el primero en crear uno!</div>
                      <button onClick={() => { if(!session){navigate("/login");return;} setOpenCreate(true); }}
                        style={{ marginTop:14, padding:"9px 20px", borderRadius:10, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, border:"none", cursor:"pointer", fontSize:12 }}>
                        ➕ Crear partido
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {visibleMatches.map((m, idx) => {
                        const occupied = Math.min(4, (Number(m.reserved_spots)||1) + (approvedCounts[m.id]||0));
                        const left = Math.max(0, 4 - occupied);
                        const myStatus = myReqStatus?.[m.id];
                        const isCreator = session?.user?.id && String(m.created_by_user) === String(session.user.id);
                        const levelColor = LEVEL_COLOR[m.level] || "#74B800";

                        return (
                          <div key={m.id} className="gpMatchItem"
                            onClick={() => navigate(`/partidos?openChat=${m.id}`)}
                            style={{ background:"#111", borderRadius:12, border:`1px solid rgba(255,255,255,0.08)`, overflow:"hidden", animation:`gpFadeUp 0.3s ease ${idx*0.04}s both` }}>

                            {/* Franja de nivel */}
                            <div style={{ height:3, background:`linear-gradient(90deg, ${levelColor}, transparent)` }} />

                            <div style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:10 }}>
                              {/* Hora */}
                              <div style={{ textAlign:"center", flexShrink:0, minWidth:44 }}>
                                <div style={{ fontSize:15, fontWeight:900, color:"#fff", lineHeight:1 }}>
                                  {String(m.start_at||"").slice(11,16)}
                                </div>
                                <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                                  {fmtDay(localYMD(m.start_at))}
                                </div>
                              </div>

                              {/* Separador */}
                              <div style={{ width:1, height:36, background:"rgba(255,255,255,0.08)", flexShrink:0 }} />

                              {/* Info */}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:999, fontWeight:800, background:`rgba(${levelColor === "#3b82f6" ? "59,130,246" : levelColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.15)`, color:levelColor }}>
                                    {LEVEL_LABEL[m.level] || m.level}
                                  </span>
                                  <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>⏱️ {m.duration_min}min</span>
                                  {m.price_per_player && <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>💶 {m.price_per_player}€</span>}
                                  {isCreator && <span style={{ fontSize:10, color:"#FFD700" }}>👑</span>}
                                  {myStatus === "approved" && <span style={{ fontSize:10, color:"#74B800" }}>✅</span>}
                                  {myStatus === "pending" && <span style={{ fontSize:10, color:"#FFA500" }}>⏳</span>}
                                </div>
                                {/* Plazas */}
                                <div style={{ display:"flex", gap:4, marginTop:6 }}>
                                  {[0,1,2,3].map(i => (
                                    <div key={i} style={{ width:18, height:18, borderRadius:4, background: i < occupied ? "#74B800" : "rgba(255,255,255,0.08)", border: i < occupied ? "none" : "1px solid rgba(255,255,255,0.12)" }} />
                                  ))}
                                  <span style={{ fontSize:10, color: left > 0 ? "rgba(116,184,0,0.8)" : "rgba(255,100,0,0.8)", marginLeft:4, fontWeight:800 }}>
                                    {left > 0 ? `${left} libre${left > 1 ? "s" : ""}` : "Completo"}
                                  </span>
                                </div>
                              </div>

                              {/* Flecha */}
                              <div style={{ color:"rgba(255,255,255,0.2)", fontSize:16, flexShrink:0 }}>›</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB: CLASES ══ */}
              {tab === "clases" && (
                <div>
                  {classes.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"40px 20px", background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize:36 }}>📚</div>
                      <div style={{ color:"#fff", fontWeight:900, marginTop:8 }}>No hay clases próximas</div>
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>Vuelve pronto</div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {classes.map((c, idx) => (
                        <div key={c.id}
                          onClick={() => navigate(`/clases`)}
                          className="gpMatchItem"
                          style={{ background:"#111", borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", padding:"12px 14px", animation:`gpFadeUp 0.3s ease ${idx*0.04}s both` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div>
                              <div style={{ fontSize:13, fontWeight:900, color:"#fff" }}>{c.title || "Clase de pádel"}</div>
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:3 }}>
                                🗓️ {formatWhen(c.start_at)} · ⏱️ {c.duration_min || 60}min
                              </div>
                              {c.teacher_name && <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>👨‍🏫 {c.teacher_name}</div>}
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              {c.price && <div style={{ fontSize:14, fontWeight:900, color:"#74B800" }}>{c.price}€</div>}
                              <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
                                {c.spots_left > 0 ? `${c.spots_left} plazas` : "Completo"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB: INFO ══ */}
              {tab === "reservar" && (
                <div style={{padding:'12px'}}>
                  {courts.length === 0 ? (
                    <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)',fontSize:14}}>
                      <div style={{fontSize:36,marginBottom:8}}>🏟️</div>
                      Este club aún no tiene pistas configuradas en Gorila
                    </div>
                  ) : (
                    <>
                      {/* Selector pista */}
                      <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto'}}>
                        {courts.map(c=>(
                          <button key={c.id} onClick={()=>{setSelectedCourt(c.id);loadSlots(c.id,selectedDate);}}
                            style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:800,fontSize:12,whiteSpace:'nowrap',
                              background:selectedCourt===c.id?'linear-gradient(135deg,#74B800,#9BE800)':'rgba(255,255,255,0.08)',
                              color:selectedCourt===c.id?'#000':'#fff'}}>
                            {c.name} {c.court_type==='indoor'?'🏠':'☀️'}
                          </button>
                        ))}
                      </div>
                      {/* Selector fecha */}
                      <input type="date" value={selectedDate} min={new Date().toISOString().split('T')[0]}
                        onChange={e=>{setSelectedDate(e.target.value);loadSlots(selectedCourt,e.target.value);}}
                        style={{padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginBottom:12,background:'#1a1a1a'}} />
                      {/* Slots disponibles */}
                      {slots.length === 0 ? (
                        <div style={{textAlign:'center',padding:32,color:'rgba(255,255,255,0.3)',fontSize:13}}>
                          No hay horas disponibles para este día
                        </div>
                      ) : (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                          {slots.map(s=>(
                            <div key={s.id} onClick={()=>setBookingSlot(s)}
                              style={{padding:'12px 8px',borderRadius:12,background:'rgba(116,184,0,0.08)',border:'1px solid rgba(116,184,0,0.25)',cursor:'pointer',textAlign:'center'}}>
                              <div style={{fontSize:15,fontWeight:900,color:'#74B800'}}>{s.start_time?.slice(0,5)}</div>
                              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2}}>{s.end_time?.slice(0,5)}</div>
                              <div style={{fontSize:13,fontWeight:800,color:'#fff',marginTop:4}}>{s.price}€</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={()=>loadSlots(selectedCourt,selectedDate)}
                        style={{marginTop:12,width:'100%',padding:'10px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',fontWeight:800,fontSize:12,cursor:'pointer'}}>
                        🔄 Actualizar disponibilidad
                      </button>
                    </>
                  )}
                </div>
              )}

              {tab === "bonos" && (
                <div style={{padding:'12px'}}>
                  {/* Mis bonos activos */}
                  {myBonos.length > 0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Mis bonos activos</div>
                      {myBonos.map(b=>(
                        <div key={b.id} style={{background:'rgba(116,184,0,0.08)',borderRadius:12,border:'1px solid rgba(116,184,0,0.25)',padding:12,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:900,color:'#74B800'}}>{b.club_bonos?.nombre}</div>
                            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>
                              {b.club_bonos?.tipo==='ilimitado' ? '♾️ Ilimitado' : `🕐 ${b.horas_restantes} hora${b.horas_restantes!==1?'s':''} restantes`}
                            </div>
                            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2}}>
                              Expira: {new Date(b.fecha_expiracion).toLocaleDateString('es')}
                            </div>
                          </div>
                          <div style={{fontSize:24}}>✅</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bonos disponibles */}
                  {clubBonos.length === 0 ? (
                    <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)',fontSize:14}}>
                      <div style={{fontSize:36,marginBottom:8}}>🎟️</div>
                      Este club aún no tiene bonos disponibles
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Bonos disponibles</div>
                      {clubBonos.map(b=>{
                        const yaTiene = myBonos.some(mb => mb.bono_id === b.id);
                        return (
                          <div key={b.id} style={{background:'#111',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',padding:14,marginBottom:10}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                              <div>
                                <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{b.nombre}</div>
                                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:3}}>
                                  {b.tipo==='ilimitado' ? '♾️ Acceso ilimitado' : `🕐 ${b.horas_incluidas} horas incluidas`}
                                </div>
                                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                                  📅 Válido {b.duracion_dias} días desde la compra
                                </div>
                              </div>
                              <div style={{fontSize:22,fontWeight:900,color:'#74B800'}}>{(b.precio_cents/100).toFixed(2)}€</div>
                            </div>
                            {yaTiene ? (
                              <div style={{padding:'10px',borderRadius:10,background:'rgba(116,184,0,0.08)',border:'1px solid rgba(116,184,0,0.2)',textAlign:'center',fontSize:12,color:'#74B800',fontWeight:800}}>
                                ✅ Ya tienes este bono activo
                              </div>
                            ) : (
                              <button onClick={()=>buyBono(b)} disabled={buyingBono===b.id}
                                style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#74B800,#9BE800)',border:'none',color:'#000',fontWeight:900,fontSize:13,cursor:'pointer',opacity:buyingBono===b.id?0.6:1}}>
                                {buyingBono===b.id?'Activando…':'🎟️ Comprar bono'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "valorar" && (
                <div style={{padding:'12px'}}>
                  {/* Nota media */}
                  {clubRatings.length > 0 && (
                    <div style={{background:'#111',borderRadius:14,border:'1px solid rgba(116,184,0,0.15)',padding:16,marginBottom:16,textAlign:'center'}}>
                      <div style={{fontSize:36,fontWeight:900,color:'#74B800'}}>{(clubRatings.reduce((s,r)=>s+r.rating,0)/clubRatings.length).toFixed(1)}</div>
                      <div style={{fontSize:20,marginBottom:4}}>{'⭐'.repeat(Math.round(clubRatings.reduce((s,r)=>s+r.rating,0)/clubRatings.length))}</div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{clubRatings.length} valoracion{clubRatings.length!==1?'es':''}</div>
                    </div>
                  )}
                  {/* Formulario valorar */}
                  <div style={{background:'#111',borderRadius:14,border:'1px solid rgba(255,255,255,0.07)',padding:14,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:900,color:'#74B800',marginBottom:12}}>{myRating?'✏️ Editar tu valoración':'⭐ Valora este club'}</div>
                    <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:12}}>
                      {[1,2,3,4,5].map(star=>(
                        <div key={star} onClick={()=>setRatingValue(star)}
                          style={{fontSize:32,cursor:'pointer',opacity:star<=ratingValue?1:0.3,transition:'opacity .15s'}}>⭐</div>
                      ))}
                    </div>
                    <textarea placeholder="Comentario opcional (instalaciones, ambiente, servicio…)" value={ratingComment}
                      onChange={e=>setRatingComment(e.target.value)} rows={3}
                      style={{padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',resize:'none',marginBottom:10}} />
                    <button onClick={saveRating} disabled={ratingSaving}
                      style={{width:'100%',padding:'11px',borderRadius:10,background:'linear-gradient(135deg,#74B800,#9BE800)',border:'none',color:'#000',fontWeight:900,fontSize:13,cursor:'pointer'}}>
                      {ratingSaving?'Guardando…':myRating?'✅ Actualizar valoración':'✅ Enviar valoración'}
                    </button>
                  </div>
                  {/* Lista valoraciones */}
                  {clubRatings.map(r=>(
                    <div key={r.id} style={{background:'#111',borderRadius:12,border:'1px solid rgba(255,255,255,0.07)',padding:12,marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {r.profiles?.avatar_url?(
                            <img src={r.profiles.avatar_url} style={{width:30,height:30,borderRadius:999,objectFit:'cover'}} alt=""/>
                          ):(
                            <div style={{width:30,height:30,borderRadius:999,background:'rgba(116,184,0,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🦍</div>
                          )}
                          <div style={{fontSize:13,fontWeight:800}}>{r.profiles?.name||'Jugador'}</div>
                        </div>
                        <div style={{fontSize:14}}>{'⭐'.repeat(r.rating)}</div>
                      </div>
                      {r.comment&&<div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:6,lineHeight:1.5}}>{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Modal confirmar reserva */}
              {bookingSlot && (
                <div onClick={()=>setBookingSlot(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                  <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',border:'1px solid rgba(116,184,0,0.2)',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
                    <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:4}}>📅 Confirmar reserva</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:16}}>
                      {courts.find(c=>c.id===bookingSlot.court_id)?.name} · {bookingSlot.date} · {bookingSlot.start_time?.slice(0,5)} – {bookingSlot.end_time?.slice(0,5)}
                    </div>
                    {(()=>{
                      const bonoActivo = myBonos.find(b => b.activo && (b.club_bonos?.tipo === 'ilimitado' || (b.horas_restantes && b.horas_restantes > 0)));
                      return (
                        <div style={{background:'rgba(116,184,0,0.08)',borderRadius:10,padding:14,marginBottom:16,textAlign:'center'}}>
                          {bonoActivo ? (
                            <>
                              <div style={{fontSize:14,color:'rgba(255,255,255,0.4)',textDecoration:'line-through',marginBottom:2}}>{bookingSlot.price}€</div>
                              <div style={{fontSize:28,fontWeight:900,color:'#74B800'}}>0€ 🎟️</div>
                              <div style={{fontSize:11,color:'#74B800',marginTop:2,fontWeight:800}}>
                                {bonoActivo.club_bonos?.tipo==='ilimitado' ? 'Bono ilimitado activo' : `Bono activo · ${bonoActivo.horas_restantes} hora${bonoActivo.horas_restantes!==1?'s':''} restantes`}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{fontSize:28,fontWeight:900,color:'#74B800'}}>{bookingSlot.price}€</div>
                              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>Precio por hora</div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:16,textAlign:'center'}}>
                      La reserva quedará pendiente hasta que el club la confirme
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>bookSlot(bookingSlot)} disabled={bookingSaving}
                        style={{flex:1,padding:'12px',borderRadius:12,background:'linear-gradient(135deg,#74B800,#9BE800)',border:'none',color:'#000',fontWeight:900,fontSize:14,cursor:'pointer'}}>
                        {bookingSaving?'Reservando…':'✅ Confirmar reserva'}
                      </button>
                      <button onClick={()=>setBookingSlot(null)}
                        style={{padding:'12px 16px',borderRadius:12,background:'rgba(255,255,255,0.08)',border:'none',color:'#fff',fontWeight:900,cursor:'pointer'}}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "info" && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {club ? (
                    <>
                      <div style={{ background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", padding:16 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Información del club</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontSize:20 }}>🏟️</span>
                            <div>
                              <div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{club.name}</div>
                              {club.city && <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{club.city}</div>}
                            </div>
                          </div>
                          {club.address && (
                            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                              <span style={{ fontSize:18 }}>📍</span>
                              <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{club.address}</div>
                            </div>
                          )}
                          {club.phone && (
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:18 }}>📞</span>
                              <a href={`tel:${club.phone}`} style={{ fontSize:12, color:"#74B800" }}>{club.phone}</a>
                            </div>
                          )}
                          {club.website && (
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:18 }}>🌐</span>
                              <a href={club.website} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#74B800" }}>{club.website}</a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mapa */}
                      {club.lat && club.lng && (
                        <a href={`https://maps.google.com/?q=${club.lat},${club.lng}`} target="_blank" rel="noopener noreferrer"
                          style={{ display:"block", borderRadius:14, overflow:"hidden", border:"1px solid rgba(116,184,0,0.2)", textDecoration:"none" }}>
                          <div style={{ background:"rgba(116,184,0,0.08)", padding:"16px", display:"flex", alignItems:"center", gap:12 }}>
                            <span style={{ fontSize:32 }}>🗺️</span>
                            <div>
                              <div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>Ver en Google Maps</div>
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>
                                {club.lat.toFixed(4)}, {club.lng.toFixed(4)}
                              </div>
                            </div>
                            <div style={{ marginLeft:"auto", color:"#74B800", fontSize:18 }}>›</div>
                          </div>
                        </a>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign:"center", padding:"40px 20px", background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize:36 }}>🏟️</div>
                      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginTop:8 }}>No hay información adicional de este club</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════
          MODAL: CREAR PARTIDO
      ══════════════════════════════ */}
      {openCreate && (
        <div onClick={() => setOpenCreate(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10000, padding:20, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#1a1a1a", borderRadius:20, padding:24, maxWidth:440, width:"100%", border:"1px solid rgba(116,184,0,0.25)" }}>
            <h2 style={{ color:"#74B800", marginBottom:4, fontSize:18, fontWeight:900 }}>➕ Crear Partido</h2>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:18 }}>📍 {club?.name || "Este club"}</div>
            {saveError && <div style={{ background:"rgba(220,38,38,0.2)", padding:10, borderRadius:8, color:"#ff6b6b", marginBottom:12, fontSize:12 }}>{saveError}</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ color:"#fff", display:"block", marginBottom:5, fontSize:11, fontWeight:700 }}>Fecha</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} style={IS} />
                </div>
                <div>
                  <label style={{ color:"#fff", display:"block", marginBottom:5, fontSize:11, fontWeight:700 }}>Hora</label>
                  <input type="time" step="900" value={form.time} onChange={e => setForm({...form, time:e.target.value})} style={IS} />
                </div>
              </div>
              <div>
                <label style={{ color:"#fff", display:"block", marginBottom:5, fontSize:11, fontWeight:700 }}>Nivel</label>
                <select value={form.level} onChange={e => setForm({...form, level:e.target.value})} style={IS}>
                  <option value="iniciacion" style={{ background:"#1a1a1a" }}>Iniciación</option>
                  <option value="medio" style={{ background:"#1a1a1a" }}>Medio</option>
                  <option value="alto" style={{ background:"#1a1a1a" }}>Alto</option>
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ color:"#fff", display:"block", marginBottom:5, fontSize:11, fontWeight:700 }}>Duración (min)</label>
                  <input type="number" value={form.durationMin} onChange={e => setForm({...form, durationMin:e.target.value})} min="30" max="180" step="15" style={IS} />
                </div>
                <div>
                  <label style={{ color:"#fff", display:"block", marginBottom:5, fontSize:11, fontWeight:700 }}>Precio/jugador €</label>
                  <input type="number" value={form.pricePerPlayer} onChange={e => setForm({...form, pricePerPlayer:e.target.value})} placeholder="0" min="0" step="0.5" style={IS} />
                </div>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button onClick={handleCreate} disabled={saving}
                  style={{ flex:1, padding:13, borderRadius:12, background:saving?"rgba(116,184,0,0.4)":"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, border:"none", cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
                  {saving ? "⏳ Creando..." : "✅ Crear Partido"}
                </button>
                <button onClick={() => setOpenCreate(false)}
                  style={{ padding:"13px 16px", borderRadius:12, background:"rgba(255,255,255,0.08)", color:"#fff", fontWeight:700, border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer" }}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
