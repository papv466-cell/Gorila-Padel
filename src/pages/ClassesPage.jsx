// src/pages/ClassesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";
import { scheduleGorilaForEnd, clearGorilaTimers } from "../services/gorilaSound";

const LS_ACTIVE_CLASS_ID = "gp_active_class_id";
const LS_ACTIVE_CLASS_END_AT = "gp_active_class_end_at";

function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startEndISO(dateStr, timeStr, mins = 60) {
  const [hh, mm] = String(timeStr || "10:00").split(":").map((x) => Number(x));
  const start = new Date(`${dateStr}T00:00:00`);
  start.setHours(Number.isFinite(hh) ? hh : 10, Number.isFinite(mm) ? mm : 0, 0, 0);
  const end = new Date(start.getTime() + (Number(mins) || 60) * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function normText(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map((p) => p[0].toUpperCase()).join("");
}

function isUuid(x = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x));
}

function setActiveClass(classId, endAtIso) {
  try { localStorage.setItem(LS_ACTIVE_CLASS_ID, String(classId || "")); localStorage.setItem(LS_ACTIVE_CLASS_END_AT, String(endAtIso || "")); } catch {}
}
function clearActiveClass() {
  try { localStorage.removeItem(LS_ACTIVE_CLASS_ID); localStorage.removeItem(LS_ACTIVE_CLASS_END_AT); } catch {}
}
function getActiveClass() {
  try { return { id: String(localStorage.getItem(LS_ACTIVE_CLASS_ID) || "").trim(), end_at: String(localStorage.getItem(LS_ACTIVE_CLASS_END_AT) || "").trim() }; }
  catch { return { id: "", end_at: "" }; }
}

const IS = { width: "100%", padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, boxSizing: "border-box" };
const LB = { fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 5 };

export default function ClassesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [teacherReady, setTeacherReady] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const [day, setDay] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [favTeacherIds, setFavTeacherIds] = useState(() => new Set());
  const [favReady, setFavReady] = useState(false);

  const [filterClubQuery, setFilterClubQuery] = useState("");
  const [filterClubId, setFilterClubId] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterPrice, setFilterPrice] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [slotTime, setSlotTime] = useState("10:00");
  const [slotMins, setSlotMins] = useState(60);
  const [slotPrice, setSlotPrice] = useState("");
  const [slotLocation, setSlotLocation] = useState("");
  const [slotNotes, setSlotNotes] = useState("");
  const [slotCourt, setSlotCourt] = useState("");
  const [slotClubQuery, setSlotClubQuery] = useState("");
  const [slotClubPick, setSlotClubPick] = useState(null);
  const [clubsSheet, setClubsSheet] = useState([]);
  const [bookingId, setBookingId] = useState(null);

  useEffect(() => {
    fetchClubsFromGoogleSheet().then((r) => setClubsSheet(Array.isArray(r) ? r : [])).catch(() => setClubsSheet([]));
  }, []);

  const clubsAll = useMemo(() => {
    return (Array.isArray(clubsSheet) ? clubsSheet : []).map((r) => ({
      id: String(r?.id || "").trim(), name: String(r?.name || "").trim(), city: String(r?.city || "").trim(),
      lat: typeof r?.lat === "number" ? r.lat : null, lng: typeof r?.lng === "number" ? r.lng : null,
      label: [String(r?.name || "").trim(), String(r?.city || "").trim()].filter(Boolean).join(" — "),
    })).filter((x) => x.id && x.name);
  }, [clubsSheet]);

  const uid = useMemo(() => (session?.user?.id ? String(session.user.id) : ""), [session?.user?.id]);
  function goLogin() { navigate("/login", { replace: true }); }

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (!alive) return; setSession(data?.session ?? null); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (!alive) return; setSession(s ?? null); setAuthReady(true); });
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => { if (!authReady || !uid) return; ensurePushSubscription().catch(() => {}); }, [authReady, uid]);

  useEffect(() => {
    if (!authReady) return;
    const { id, end_at } = getActiveClass();
    if (!id || !end_at) return;
    const endMs = new Date(end_at).getTime();
    if (!Number.isFinite(endMs) || endMs <= Date.now()) { clearGorilaTimers(); clearActiveClass(); return; }
    scheduleGorilaForEnd(end_at);
  }, [authReady]);

  useEffect(() => () => clearGorilaTimers(), []);

  useEffect(() => {
    let alive = true;
    async function loadFavs() {
      try {
        setFavReady(false);
        if (!uid) { setFavTeacherIds(new Set()); return; }
        const { data, error } = await supabase.from("teacher_favorites").select("teacher_id").eq("user_id", uid);
        if (error) throw error;
        if (!alive) return;
        setFavTeacherIds(new Set((data || []).map((x) => String(x.teacher_id)).filter(Boolean)));
      } catch { if (!alive) return; setFavTeacherIds(new Set()); }
      finally { if (!alive) return; setFavReady(true); }
    }
    if (!authReady) return;
    loadFavs();
    return () => { alive = false; };
  }, [authReady, uid]);

  useEffect(() => {
    if (!authReady) return;
    const t = searchParams.get("teacher");
    if (t && isUuid(t)) setFilterTeacher(String(t));
    const clubId = String(searchParams.get("club") || "").trim();
    if (clubId) { setFilterClubId(clubId); const clubName = String(searchParams.get("clubName") || "").trim(); if (clubName) setFilterClubQuery(clubName); }
  }, [authReady]);

  async function fetchTeacherStatus(teacherId) {
    setTeacherReady(false);
    if (!teacherId) { setIsTeacher(false); setTeacherReady(true); return; }
    try {
      setTeacherLoading(true);
      const { data, error } = await supabase.from("teachers").select("id, is_active").eq("id", teacherId).maybeSingle();
      if (error) throw error;
      setIsTeacher(!!(data?.id && data.is_active !== false));
    } catch { setIsTeacher(false); }
    finally { setTeacherLoading(false); setTeacherReady(true); }
  }

  useEffect(() => { if (!authReady) return; fetchTeacherStatus(uid); }, [authReady, uid]);

  const slotClubSuggest = useMemo(() => {
    const q = normText(slotClubQuery);
    if (!q || q.length < 2) return [];
    return clubsAll.filter((c) => normText(c.name).includes(q) || normText(c.city).includes(q)).slice(0, 14);
  }, [clubsAll, slotClubQuery]);

  useEffect(() => {
    const q = normText(slotClubQuery);
    if (!q) { setSlotClubPick(null); return; }
    setSlotClubPick(clubsAll.find((c) => normText(c.name) === q) || null);
  }, [slotClubQuery, clubsAll]);

  const filterClubSuggest = useMemo(() => {
    const q = normText(filterClubQuery);
    if (!q || q.length < 2) return [];
    return clubsAll.filter((c) => normText(c.name).includes(q) || normText(c.city).includes(q)).slice(0, 14);
  }, [clubsAll, filterClubQuery]);

  useEffect(() => {
    const q = normText(filterClubQuery);
    if (!q) { setFilterClubId(""); return; }
    const exact = clubsAll.find((c) => normText(c.name) === q);
    if (exact?.id) setFilterClubId(exact.id);
  }, [filterClubQuery, clubsAll]);

  async function loadDay() {
    try {
      setLoading(true);
      if (String(day) < String(todayStr)) { setItems([]); setProfilesById({}); return; }
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();
      const { data, error } = await supabase.from("classes")
        .select("id,teacher_id,start_at,end_at,price,location,club,club_id,club_name,club_city,club_lat,club_lon,court,notes,is_booked,is_cancelled,created_at")
        .eq("is_cancelled", false).gte("start_at", start).lte("start_at", end);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setItems(rows);
      const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id).filter(Boolean).map(String)));
      if (!teacherIds.length) { setProfilesById({}); return; }
      const { data: profs, error: eProf } = await supabase.from("profiles").select("id,name,handle,avatar_url").in("id", teacherIds);
      if (eProf) throw eProf;
      const map = {}; for (const p of profs || []) map[String(p.id)] = p;
      setProfilesById(map);
      const { id: activeId, end_at: activeEnd } = getActiveClass();
      if (activeId && activeEnd && new Date(activeEnd).getTime() <= Date.now()) { clearGorilaTimers(); clearActiveClass(); }
    } catch (e) { toast.error(e?.message || "No se pudieron cargar las clases"); setItems([]); setProfilesById({}); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!authReady) return; loadDay(); }, [authReady, day]);

  async function confirmTeacherCode() {
    if (!uid) return goLogin();
    try {
      setTeacherBusy(true);
      const code = String(codeInput || "").trim();
      if (!code) return toast.error("Escribe el código del profesor");
      const { error } = await supabase.rpc("activate_teacher", { p_code: code });
      if (error) throw error;
      toast.success("Modo profesor activado 🦍");
      setShowTeacherCode(false);
      await fetchTeacherStatus(uid);
    } catch (e) { toast.error(e?.message || "No se pudo activar"); }
    finally { setTeacherBusy(false); }
  }

  async function createClass() {
    if (!session?.user) return goLogin();
    if (!isTeacher) return toast.error("Solo profesores pueden crear clases.");
    if (!slotClubPick?.id) return toast.error("Elige un club de la lista.");
    try {
      const { start_at, end_at } = startEndISO(day, slotTime, Number(slotMins) || 60);
      const { error } = await supabase.from("classes").insert({
        teacher_id: session.user.id, start_at, end_at,
        price: slotPrice ? Number(slotPrice) : null,
        location: slotLocation?.trim() || null,
        club: slotClubPick.name, club_id: slotClubPick.id, club_name: slotClubPick.name,
        club_city: slotClubPick.city || null,
        club_lat: Number.isFinite(slotClubPick.lat) ? slotClubPick.lat : null,
        club_lon: Number.isFinite(slotClubPick.lng) ? slotClubPick.lng : null,
        court: slotCourt?.trim() || null, notes: slotNotes?.trim() || null,
        is_booked: false, is_cancelled: false,
      });
      if (error) throw error;
      toast.success("Clase creada ✅");
      setSlotPrice(""); setSlotLocation(""); setSlotNotes(""); setSlotCourt("");
      setShowCreateForm(false);
      await loadDay();
    } catch (e) { toast.error(e?.message || "No se pudo crear la clase"); }
  }

  async function bookClass(classId) {
    if (!session?.user) return goLogin();
    if (bookingId) return;
    const cls = items.find((x) => x.id === classId) || null;
    const endAt = cls?.end_at ? String(cls.end_at) : "";
    setBookingId(classId);
    setItems((prev) => prev.map((x) => (x.id === classId ? { ...x, is_booked: true } : x)));
    try {
      const { error } = await supabase.rpc("book_class", { p_class_id: classId });
      if (error) throw error;
      toast.success("Clase reservada 🦍");
      if (endAt) { setActiveClass(classId, endAt); scheduleGorilaForEnd(endAt, classId); }
      await loadDay();
    } catch (e) { toast.error(e?.message || "No se pudo reservar"); await loadDay(); }
    finally { setBookingId(null); }
  }

  async function cancelMyBooking(classId) {
    if (!session?.user) return goLogin();
    if (!confirm("¿Seguro que quieres anular tu reserva?\n\nLa clase volverá a estar libre y el profe será avisado.")) return;
    try {
      const { error } = await supabase.rpc("cancel_class_booking", { p_class_id: classId });
      if (error) throw error;
      toast.success("Reserva anulada. El profe ha sido avisado 📭");
      const { id: activeId } = getActiveClass();
      if (activeId && String(activeId) === String(classId)) { clearGorilaTimers(); clearActiveClass(); }
      await loadDay();
    } catch (e) { toast.error(e?.message || "No se pudo anular"); }
  }

  async function cancelClass(classId) {
    if (!session?.user) return goLogin();
    const cls = items.find((x) => x.id === classId);
    if (!cls) return;
    const msg = cls.is_booked
      ? "Esta clase está reservada.\n\nSe cancelará y se avisará al alumno.\n¿Continuar?"
      : "Esta clase está libre.\n\nSe borrará definitivamente.\n¿Continuar?";
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.rpc("cancel_class_slot", { p_class_id: classId });
      if (error) throw error;
      toast.success(cls.is_booked ? "Clase cancelada y alumno avisado ✅" : "Clase borrada ✅");
      const { id: activeId } = getActiveClass();
      if (activeId && String(activeId) === String(classId)) { clearGorilaTimers(); clearActiveClass(); }
      await loadDay();
    } catch (e) { toast.error(e?.message || "No se pudo cancelar"); }
  }

  function clearFilters() {
    setFilterClubQuery(""); setFilterClubId(""); setFilterTeacher(""); setFilterPrice("all");
    const next = new URLSearchParams(searchParams);
    next.delete("teacher"); next.delete("club"); next.delete("clubName");
    setSearchParams(next, { replace: true });
  }

  const cameFromMapClub = useMemo(() => !!String(searchParams.get("club") || "").trim(), [searchParams]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const hasFavs = favTeacherIds && favTeacherIds.size > 0;
    return (items || []).filter((c) => {
      const start = new Date(c.start_at);
      if (String(day) === String(todayStr) && start < now) return false;
      if (filterClubId && String(c.club_id || "") !== String(filterClubId)) return false;
      if (filterTeacher && String(c.teacher_id || "") !== String(filterTeacher)) return false;
      if (cameFromMapClub && hasFavs) { if (!favTeacherIds.has(String(c.teacher_id))) return false; if (c.is_booked) return false; }
      const price = Number(c.price || 0);
      if (filterPrice === "le20" && !(price > 0 && price <= 20)) return false;
      if (filterPrice === "p20_30" && !(price >= 20 && price <= 30)) return false;
      if (filterPrice === "gt30" && !(price > 30)) return false;
      return true;
    }).sort((a, b) => String(a.start_at || "").localeCompare(String(b.start_at || "")));
  }, [items, day, todayStr, filterClubId, filterTeacher, filterPrice, cameFromMapClub, favTeacherIds]);

  const headerClubName = useMemo(() => {
    const n = String(searchParams.get("clubName") || "").trim();
    if (n) return n;
    return clubsAll.find((x) => String(x.id) === String(filterClubId))?.name || "";
  }, [searchParams, clubsAll, filterClubId]);

  const teacherFilterOptions = useMemo(() => {
    const set = new Set();
    for (const r of items || []) if (r?.teacher_id) set.add(String(r.teacher_id));
    return Array.from(set).map((id) => {
      const p = profilesById?.[id];
      return { id, name: (p?.name && String(p.name).trim()) || (p?.handle && String(p.handle).trim()) || `Profe ${id.slice(0, 6)}…` };
    }).sort((a, b) => normText(a.name).localeCompare(normText(b.name)));
  }, [items, profilesById]);

  const activeInfo = useMemo(() => {
    const { id, end_at } = getActiveClass();
    if (!id || !end_at) return null;
    const endMs = new Date(end_at).getTime();
    if (!Number.isFinite(endMs) || endMs <= Date.now()) return null;
    return { id, end_at, minsLeft: Math.max(0, Math.round((endMs - Date.now()) / 60000)) };
  }, [items, day, loading]);

  const hasFilters = !!(filterClubId || filterTeacher || filterPrice !== "all");

  return (
    <div className="page pageWithHeader" style={{ background: "#0a0a0a", minHeight: "100vh" }}>
      <style>{`
        .clCard { background:#111; border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:14px; margin-bottom:8px; transition:border-color .2s; }
        .clCard:hover { border-color:rgba(116,184,0,0.3); }
        .clChip { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.7); }
        .clBtn { padding:9px 16px; border-radius:9px; font-weight:900; font-size:13px; cursor:pointer; border:none; transition:opacity .15s; }
        .clBtn:disabled { opacity:.5; cursor:not-allowed; }
        .clBtnPrimary { background:linear-gradient(135deg,#74B800,#9BE800); color:#000; }
        .clBtnGhost { background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15) !important; }
        .clBtnDanger { background:rgba(220,38,38,0.15); color:#ff6b6b; border:1px solid rgba(220,38,38,0.3) !important; }
        .clSection { background:#111; border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:16px; margin-bottom:10px; }
        .clGrid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:480px) { .clGrid2 { grid-template-columns:1fr; } }
      `}</style>

      <div className="pageWrap">
        <div className="container" style={{ padding: "0 16px", maxWidth: 720, margin: "0 auto" }}>

          {/* HEADER */}
          <div style={{ padding: "12px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>🎾 Clases</h1>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                {headerClubName ? `En: ${headerClubName}` : "Reserva con tu profe"}
                {cameFromMapClub && favReady && favTeacherIds.size > 0 ? " · libres de tus favoritos" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!teacherReady || teacherLoading ? (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>⏳</span>
              ) : !isTeacher ? (
                <button className="clBtn clBtnGhost" style={{ fontSize: 12 }} onClick={() => { setCodeInput(""); setShowTeacherCode(true); }}>
                  Soy profesor
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "#74B800", fontWeight: 800 }}>🦍 Profesor</span>
              )}
            </div>
          </div>

          {/* BANNER CLASE ACTIVA */}
          {activeInfo && (
            <div style={{ background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, color: "#74B800", fontSize: 13 }}>🦍 Clase activa — quedan ~{activeInfo.minsLeft} min</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Sonará el gorila a falta de 5 min y al terminar.</div>
              </div>
              <button className="clBtn clBtnGhost" style={{ fontSize: 11 }} onClick={() => { clearGorilaTimers(); clearActiveClass(); toast.success("Avisos desactivados ✅"); }}>
                Parar avisos
              </button>
            </div>
          )}

          {/* DÍA + ACCIONES */}
          <div className="clSection">
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={LB}>Día</label>
                <input style={IS} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="clBtn clBtnGhost" style={{ fontSize: 11 }} onClick={() => setFiltersOpen((f) => !f)}>
                  🔍{hasFilters ? ` (${[filterClubId, filterTeacher, filterPrice !== "all"].filter(Boolean).length})` : " Filtros"}
                </button>
                {isTeacher && (
                  <button className="clBtn clBtnPrimary" style={{ fontSize: 12 }} onClick={() => setShowCreateForm((f) => !f)}>
                    {showCreateForm ? "✕ Cerrar" : "➕ Crear clase"}
                  </button>
                )}
              </div>
            </div>

            {/* FILTROS */}
            {filtersOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="clGrid2">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LB}>Club</label>
                    <input style={IS} value={filterClubQuery} onChange={(e) => setFilterClubQuery(e.target.value)} list="clubs-filter-list" placeholder="Escribe para buscar…" />
                    <datalist id="clubs-filter-list">{filterClubSuggest.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                  </div>
                  <div>
                    <label style={LB}>Profesor</label>
                    <select style={IS} value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                      <option value="">Todos</option>
                      {teacherFilterOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LB}>Precio</label>
                    <select style={IS} value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)}>
                      <option value="all">Todos</option>
                      <option value="le20">≤ 20€</option>
                      <option value="p20_30">20–30€</option>
                      <option value="gt30">&gt; 30€</option>
                    </select>
                  </div>
                </div>
                {hasFilters && (
                  <button className="clBtn clBtnGhost" style={{ marginTop: 10, fontSize: 11 }} onClick={clearFilters}>✕ Limpiar filtros</button>
                )}
              </div>
            )}
          </div>

          {/* CREAR CLASE */}
          {isTeacher && showCreateForm && (
            <div className="clSection">
              <div style={{ fontWeight: 900, color: "#74B800", fontSize: 15, marginBottom: 14 }}>➕ Nueva clase — {day}</div>
              <div className="clGrid2">
                <div>
                  <label style={LB}>Hora</label>
                  <input style={IS} type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                </div>
                <div>
                  <label style={LB}>Duración (min)</label>
                  <input style={IS} type="number" value={slotMins} onChange={(e) => setSlotMins(e.target.value)} />
                </div>
                <div>
                  <label style={LB}>Precio (€)</label>
                  <input style={IS} type="number" value={slotPrice} onChange={(e) => setSlotPrice(e.target.value)} placeholder="Ej: 30" />
                </div>
                <div>
                  <label style={LB}>Pista</label>
                  <input style={IS} value={slotCourt} onChange={(e) => setSlotCourt(e.target.value)} placeholder="Ej: Pista 3" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={LB}>Club *</label>
                  <input style={IS} value={slotClubQuery} onChange={(e) => setSlotClubQuery(e.target.value)} list="clubs-create-list" placeholder="Escribe 2–3 letras y elige…" />
                  <datalist id="clubs-create-list">{slotClubSuggest.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                  {slotClubQuery && !slotClubPick?.id && <div style={{ fontSize: 11, color: "#ff6b6b", fontWeight: 800, marginTop: 4 }}>Elige un club de la lista</div>}
                </div>
                <div>
                  <label style={LB}>Ciudad / barrio</label>
                  <input style={IS} value={slotLocation} onChange={(e) => setSlotLocation(e.target.value)} placeholder="Ej: Teatinos" />
                </div>
                <div>
                  <label style={LB}>Notas</label>
                  <input style={IS} value={slotNotes} onChange={(e) => setSlotNotes(e.target.value)} placeholder="Ej: técnica + bandeja" />
                </div>
              </div>
              <button className="clBtn clBtnPrimary" style={{ marginTop: 14, width: "100%" }} onClick={createClass} disabled={!slotClubPick?.id}>
                Crear clase
              </button>
            </div>
          )}

          {/* LISTA */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando…</div>
          ) : String(day) < String(todayStr) ? (
            <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 24, fontSize: 13 }}>No mostramos clases de días pasados.</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ background: "#111", borderRadius: 14, padding: 28, textAlign: "center", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 36 }}>🎾</div>
              <div style={{ fontWeight: 900, color: "#fff", marginTop: 8 }}>No hay clases para este día</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
                {cameFromMapClub && favReady && favTeacherIds.size > 0 ? "Vienes del mapa: solo clases libres de tus profes favoritos." : "Prueba otro día o cambia los filtros."}
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredItems.map((c) => {
                const start = new Date(c.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                const end = new Date(c.end_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                const booked = !!c.is_booked;
                const isOwnerTeacher = uid && String(c.teacher_id) === uid;
                const prof = profilesById[String(c.teacher_id)] || null;
                const profName = (prof?.name && String(prof.name).trim()) || (prof?.handle && String(prof.handle).trim()) || `Profe ${String(c.teacher_id).slice(0, 6)}…`;
                const avatar = prof?.avatar_url || "";
                const clubLabel = c.club_name || c.club || "";

                return (
                  <li key={c.id} className="clCard">
                    {/* HORA + ESTADO */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{start} – {end}</div>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "3px 10px", borderRadius: 999, background: booked ? "rgba(220,38,38,0.15)" : "rgba(116,184,0,0.15)", color: booked ? "#ff6b6b" : "#74B800", border: booked ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(116,184,0,0.3)" }}>
                        {booked ? "❌ Reservada" : "✅ Libre"}
                      </span>
                    </div>

                    {/* PROFE */}
                    <div onClick={() => navigate(`/profesores/${c.teacher_id}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
                      {avatar
                        ? <img src={avatar} alt={profName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(116,184,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#74B800", fontSize: 13, flexShrink: 0 }}>{initials(profName)}</div>
                      }
                      <span style={{ fontWeight: 900, color: "#fff", fontSize: 13 }}>{profName}</span>
                    </div>

                    {/* CHIPS */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                      {clubLabel && <span className="clChip">🏟️ {clubLabel}</span>}
                      {c.court && <span className="clChip">🎾 {c.court}</span>}
                      {c.location && <span className="clChip">📍 {c.location}</span>}
                      {c.price && <span className="clChip">💶 {c.price}€</span>}
                    </div>

                    {c.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginBottom: 10 }}>{c.notes}</div>}

                    {/* ACCIONES */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!booked ? (
                        <button className="clBtn clBtnPrimary" onClick={() => bookClass(c.id)} disabled={!session || bookingId === c.id} style={{ flex: 1 }}>
                          {bookingId === c.id ? "Reservando…" : "Reservar 🦍"}
                        </button>
                      ) : (
                        <button className="clBtn clBtnGhost" disabled style={{ flex: 1 }}>Reservada</button>
                      )}
                      {isOwnerTeacher ? (
                        <button className="clBtn clBtnDanger" onClick={() => cancelClass(c.id)} disabled={bookingId === c.id}>
                          {c.is_booked ? "❌ Cancelar" : "🗑️ Borrar"}
                        </button>
                      ) : booked && session?.user?.id ? (
                        <button className="clBtn clBtnGhost" onClick={() => cancelMyBooking(c.id)} disabled={bookingId === c.id}>
                          Anular reserva
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL CÓDIGO PROFESOR */}
      {showTeacherCode && (
        <div onClick={() => setShowTeacherCode(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 40000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", border: "1px solid rgba(116,184,0,0.25)" }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 16 }}>🦍 Activar modo profesor</div>
            <label style={LB}>Código de profesor</label>
            <input style={IS} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Ej: GP-7H2K-2026" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="clBtn clBtnPrimary" style={{ flex: 1 }} onClick={confirmTeacherCode} disabled={teacherBusy}>
                {teacherBusy ? "Activando…" : "Activar"}
              </button>
              <button className="clBtn clBtnGhost" onClick={() => setShowTeacherCode(false)} disabled={teacherBusy}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}