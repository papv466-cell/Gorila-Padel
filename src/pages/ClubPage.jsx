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
  const [saving, setSaving] = useState(false);
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
                {/* Cabecera con color */}
                <div style={{ height: 80, background: `linear-gradient(135deg, #1a2a00, #0d1a00)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 30% 50%, rgba(116,184,0,0.15), transparent 70%)" }} />
                  <div style={{ fontSize: 48, zIndex: 1 }}>🏟️</div>
                </div>

                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                    <div>
                      <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:"#fff" }}>
                        {club?.name || searchParams.get("name") || `Club #${clubId}`}
                      </h1>
                      {club?.city && (
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:3 }}>
                          📍 {club.city}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { if(!session){navigate("/login");return;} setOpenCreate(true); }}
                      style={{ padding:"9px 14px", borderRadius:10, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, border:"none", cursor:"pointer", fontSize:12, whiteSpace:"nowrap", flexShrink:0 }}>
                      ➕ Crear partido
                    </button>
                  </div>

                  {/* Stats rápidas */}
                  <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                    <div style={{ padding:"5px 10px", borderRadius:8, background:"rgba(116,184,0,0.1)", border:"1px solid rgba(116,184,0,0.2)", fontSize:11, fontWeight:800, color:"#74B800" }}>
                      🏓 {matches.length} partido{matches.length !== 1 ? "s" : ""} próximos
                    </div>
                    <div style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.7)" }}>
                      📚 {classes.length} clase{classes.length !== 1 ? "s" : ""} disponibles
                    </div>
                    {club?.lat && club?.lng && (
                      <a
                        href={`https://maps.google.com/?q=${club.lat},${club.lng}`}
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
                  { key:"info",     label:"Info",     emoji:"ℹ️",  count:null },
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