// src/pages/ClassesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";

function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startEndISO(dateStr, timeStr, mins = 60) {
  const [hh, mm] = String(timeStr || "10:00")
    .split(":")
    .map((x) => Number(x));
  const start = new Date(`${dateStr}T00:00:00`);
  start.setHours(Number.isFinite(hh) ? hh : 10, Number.isFinite(mm) ? mm : 0, 0, 0);
  const end = new Date(start.getTime() + (Number(mins) || 60) * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function normText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "🦍";
  return parts.map((p) => p[0].toUpperCase()).join("");
}

function isUuid(x = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x));
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------- Session ----------
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // ---------- Teacher status ----------
  const [teacherReady, setTeacherReady] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  // ---------- Day ----------
  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const [day, setDay] = useState(todayStr);

  // ---------- Data ----------
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [profilesById, setProfilesById] = useState({});

  // ---------- Favoritos (para lógica “desde mapa”) ----------
  const [favTeacherIds, setFavTeacherIds] = useState(() => new Set());
  const [favReady, setFavReady] = useState(false);

  // ---------- Filtros ----------
  const [filterClubQuery, setFilterClubQuery] = useState("");
  const [filterClubId, setFilterClubId] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterPrice, setFilterPrice] = useState("all"); // all | le20 | p20_30 | gt30

  // ---------- Modal código profesor ----------
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);

  // ---------- Create class form ----------
  const [slotTime, setSlotTime] = useState("10:00");
  const [slotMins, setSlotMins] = useState(60);
  const [slotPrice, setSlotPrice] = useState("");
  const [slotLocation, setSlotLocation] = useState("");
  const [slotNotes, setSlotNotes] = useState("");
  const [slotCourt, setSlotCourt] = useState("");

  const [slotClubQuery, setSlotClubQuery] = useState(""); // lo que escribe
  const [slotClubPick, setSlotClubPick] = useState(null); // club seleccionado del sheet

  // ---------- Clubs sheet ----------
  const [clubsSheet, setClubsSheet] = useState([]);
  useEffect(() => {
    fetchClubsFromGoogleSheet()
      .then((rows) => setClubsSheet(Array.isArray(rows) ? rows : []))
      .catch(() => setClubsSheet([]));
  }, []);

  // ✅ Tu sheets.js ya devuelve: {id,name,city,address,lat,lng}
  const clubsAll = useMemo(() => {
    const list = Array.isArray(clubsSheet) ? clubsSheet : [];
    return list
      .map((r) => {
        const id = String(r?.id || "").trim();
        const name = String(r?.name || "").trim();
        const city = String(r?.city || "").trim();
        const lat = typeof r?.lat === "number" ? r.lat : null;
        const lng = typeof r?.lng === "number" ? r.lng : null; // ✅ IMPORTANTÍSIMO
        const website = String(r?.website || "").trim();

        const extra = [city].filter(Boolean).join(" · ");
        const label = extra ? `${name} — ${extra}` : name;

        return { id, name, city, lat, lng, website, label };
      })
      .filter((x) => x.id && x.name);
  }, [clubsSheet]);

  function goLogin() {
    navigate("/login", { replace: true });
  }

  // -------- Session ----------
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s ?? null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ Push subscription SOLO una vez por sesión
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user?.id) return;
    ensurePushSubscription().catch(() => {});
  }, [authReady, session?.user?.id]);

  // -------- Favoritos: IDs de profes favoritos ----------
  useEffect(() => {
    let alive = true;

    async function loadFavs() {
      try {
        setFavReady(false);

        const uid = session?.user?.id ? String(session.user.id) : "";
        if (!uid) {
          setFavTeacherIds(new Set());
          return;
        }

        const { data, error } = await supabase
          .from("teacher_favorites")
          .select("teacher_id")
          .eq("user_id", uid);

        if (error) throw error;

        const s = new Set((data || []).map((x) => String(x.teacher_id)).filter(Boolean));
        if (!alive) return;
        setFavTeacherIds(s);
      } catch {
        if (!alive) return;
        setFavTeacherIds(new Set());
      } finally {
        if (!alive) return;
        setFavReady(true);
      }
    }

    if (!authReady) return;
    loadFavs();

    return () => {
      alive = false;
    };
  }, [authReady, session?.user?.id]);

  // ✅ Leer filtros desde URL:
  // - /clases?teacher=<uuid>
  // - /clases?club=<club_id>&clubName=<name>
  useEffect(() => {
    if (!authReady) return;

    const t = searchParams.get("teacher");
    if (t && isUuid(t)) setFilterTeacher(String(t));

    const clubId = String(searchParams.get("club") || "").trim();
    if (clubId) {
      setFilterClubId(clubId);

      const clubName = String(searchParams.get("clubName") || "").trim();
      if (clubName) setFilterClubQuery(clubName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  // -------- Teacher status ----------
  async function fetchTeacherStatus(uid) {
    setTeacherReady(false);

    if (!uid) {
      setIsTeacher(false);
      setTeacherReady(true);
      return;
    }

    try {
      setTeacherLoading(true);

      const { data, error } = await supabase
        .from("teachers")
        .select("id, is_active")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;

      if (!data?.id) setIsTeacher(false);
      else setIsTeacher(data.is_active !== false);
    } catch {
      setIsTeacher(false);
    } finally {
      setTeacherLoading(false);
      setTeacherReady(true);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    fetchTeacherStatus(session?.user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session?.user?.id]);

  // ✅ Autocomplete CREAR clase
  const slotClubSuggest = useMemo(() => {
    const q = normText(slotClubQuery);
    if (!q || q.length < 2) return [];
    return clubsAll
      .filter((c) => normText(c.name).includes(q) || normText(c.city).includes(q) || normText(c.label).includes(q))
      .slice(0, 14);
  }, [clubsAll, slotClubQuery]);

  // ✅ Selección exacta CREAR clase
  useEffect(() => {
    const q = normText(slotClubQuery);
    if (!q) {
      setSlotClubPick(null);
      return;
    }
    const exact = clubsAll.find((c) => normText(c.name) === q);
    setSlotClubPick(exact || null);
  }, [slotClubQuery, clubsAll]);

  // ✅ Autocomplete FILTRO club
  const filterClubSuggest = useMemo(() => {
    const q = normText(filterClubQuery);
    if (!q || q.length < 2) return [];
    return clubsAll
      .filter((c) => normText(c.name).includes(q) || normText(c.city).includes(q) || normText(c.label).includes(q))
      .slice(0, 14);
  }, [clubsAll, filterClubQuery]);

  // ✅ Selección exacta FILTRO club
  useEffect(() => {
    const q = normText(filterClubQuery);
    if (!q) {
      setFilterClubId("");
      return;
    }
    const exact = clubsAll.find((c) => normText(c.name) === q);
    if (exact?.id) setFilterClubId(exact.id);
  }, [filterClubQuery, clubsAll]);

  // -------- Load day ----------
  async function loadDay() {
    try {
      setLoading(true);

      if (String(day) < String(todayStr)) {
        setItems([]);
        setProfilesById({});
        return;
      }

      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const { data, error } = await supabase
        .from("classes")
        .select(
          "id, teacher_id, start_at, end_at, price, location, club, club_id, club_name, club_city, club_lat, club_lon, court, notes, is_booked, is_cancelled, created_at"
        )
        .eq("is_cancelled", false)
        .gte("start_at", start)
        .lte("start_at", end);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      setItems(rows);

      const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id).filter(Boolean).map(String)));
      if (!teacherIds.length) {
        setProfilesById({});
        return;
      }

      const { data: profs, error: eProf } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url")
        .in("id", teacherIds);

      if (eProf) throw eProf;

      const map = {};
      for (const p of profs || []) map[String(p.id)] = p;
      setProfilesById(map);
    } catch (e) {
      toast.error(e?.message || "No se pudieron cargar las clases");
      setItems([]);
      setProfilesById({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, day]);

  // -------- Profesor: abrir modal ----------
  function onBeTeacher() {
    setCodeInput("");
    setShowTeacherCode(true);
  }

  // -------- Activar profesor con código ----------
  async function confirmTeacherCode() {
    if (!session?.user?.id) return goLogin();

    try {
      setTeacherBusy(true);

      const code = String(codeInput || "").trim();
      if (!code) return toast.error("Escribe el código del profesor");

      const { error } = await supabase.rpc("activate_teacher", { p_code: code });
      if (error) throw error;

      toast.success("Modo profesor activado 🦍");
      setShowTeacherCode(false);
      await fetchTeacherStatus(session.user.id);
    } catch (e) {
      toast.error(e?.message || "No se pudo activar");
    } finally {
      setTeacherBusy(false);
    }
  }

  // -------- Crear CLASE ----------
  async function createClass() {
    if (!session?.user) return goLogin();
    if (!isTeacher) return toast.error("Solo profesores pueden crear clases.");
    if (!slotClubPick?.id) return toast.error("Elige un club de la lista (autocompletar).");

    try {
      const { start_at, end_at } = startEndISO(day, slotTime, Number(slotMins) || 60);

      const payload = {
        teacher_id: session.user.id,
        start_at,
        end_at,
        price: slotPrice ? Number(slotPrice) : null,
        location: slotLocation?.trim() || null,

        // legacy + nuevo
        club: slotClubPick.name,
        club_id: slotClubPick.id,
        club_name: slotClubPick.name,
        club_city: slotClubPick.city || null,
        club_lat: Number.isFinite(slotClubPick.lat) ? slotClubPick.lat : null,
        club_lon: Number.isFinite(slotClubPick.lng) ? slotClubPick.lng : null, // ✅ viene como lng del sheet

        court: slotCourt?.trim() || null,
        notes: slotNotes?.trim() || null,
        is_booked: false,
        is_cancelled: false,
      };

      const { error } = await supabase.from("classes").insert(payload);
      if (error) throw error;

      toast.success("Clase creada ✅");

      setSlotPrice("");
      setSlotLocation("");
      setSlotNotes("");
      setSlotCourt("");

      await loadDay();
    } catch (e) {
      toast.error(e?.message || "No se pudo crear la clase");
    }
  }

  // -------- Reservar ----------
  const [bookingId, setBookingId] = useState(null);

  async function bookClass(classId) {
    if (!session?.user) return goLogin();
    if (bookingId) return;

    setBookingId(classId);
    setItems((prev) => prev.map((x) => (x.id === classId ? { ...x, is_booked: true } : x)));

    try {
      const { error } = await supabase.rpc("book_class", { p_class_id: classId });
      if (error) throw error;

      toast.success("Clase reservada 🦍");
      await loadDay();
    } catch (e) {
      toast.error(e?.message || "No se pudo reservar");
      await loadDay();
    } finally {
      setBookingId(null);
    }
  }

  // -------- Anular mi reserva (alumno) ----------
  async function cancelMyBooking(classId) {
    if (!session?.user) return goLogin();

    const ok = confirm("¿Seguro que quieres anular tu reserva?\n\nLa clase volverá a estar libre y el profe será avisado.");
    if (!ok) return;

    try {
      const { error } = await supabase.rpc("cancel_class_booking", { p_class_id: classId });
      if (error) throw error;

      toast.success("Reserva anulada. El profe ha sido avisado 📭");
      await loadDay();
    } catch (e) {
      toast.error(e?.message || "No se pudo anular");
    }
  }

  // -------- Cancelar / borrar clase (profe) ----------
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
      await loadDay();
    } catch (e) {
      toast.error(e?.message || "No se pudo cancelar");
    }
  }

  // ✅ Limpiar filtros + limpiar URL params
  function clearFilters() {
    setFilterClubQuery("");
    setFilterClubId("");
    setFilterTeacher("");
    setFilterPrice("all");

    const next = new URLSearchParams(searchParams);
    next.delete("teacher");
    next.delete("club");
    next.delete("clubName");
    setSearchParams(next, { replace: true });
  }

  const cameFromMapClub = useMemo(() => {
    const clubId = String(searchParams.get("club") || "").trim();
    return !!clubId;
  }, [searchParams]);

  // ✅ Lista filtrada + lógica favoritos desde mapa
  const filteredItems = useMemo(() => {
    const now = new Date();
    const hasFavs = favTeacherIds && favTeacherIds.size > 0;

    return (items || [])
      .filter((c) => {
        const start = new Date(c.start_at);
        if (String(day) === String(todayStr) && start < now) return false;

        // filtros base
        if (filterClubId && String(c.club_id || "") !== String(filterClubId)) return false;
        if (filterTeacher && String(c.teacher_id || "") !== String(filterTeacher)) return false;

        // ✅ si venimos del mapa con club=...
        // - si tengo favoritos => solo clases libres de mis profes favoritos
        if (cameFromMapClub && hasFavs) {
          if (!favTeacherIds.has(String(c.teacher_id))) return false;
          if (c.is_booked) return false;
        }

        const price = Number(c.price || 0);
        if (filterPrice === "le20" && !(price > 0 && price <= 20)) return false;
        if (filterPrice === "p20_30" && !(price >= 20 && price <= 30)) return false;
        if (filterPrice === "gt30" && !(price > 30)) return false;

        return true;
      })
      .slice()
      .sort((a, b) => String(a.start_at || "").localeCompare(String(b.start_at || "")));
  }, [items, day, todayStr, filterClubId, filterTeacher, filterPrice, cameFromMapClub, favTeacherIds]);

  const headerClubName = useMemo(() => {
    const n = String(searchParams.get("clubName") || "").trim();
    if (n) return n;
    const c = clubsAll.find((x) => String(x.id) === String(filterClubId));
    return c?.name || "";
  }, [searchParams, clubsAll, filterClubId]);

  const teacherFilterOptions = useMemo(() => {
    const set = new Set();
    for (const r of items || []) if (r?.teacher_id) set.add(String(r.teacher_id));
    const ids = Array.from(set);

    return ids
      .map((id) => {
        const p = profilesById?.[id];
        const display =
          (p?.name && String(p.name).trim()) ||
          (p?.handle && String(p.handle).trim()) ||
          `Profe ${id.slice(0, 6)}…`;
        return { id, name: display };
      })
      .sort((a, b) => normText(a.name).localeCompare(normText(b.name)));
  }, [items, profilesById]);

  const isCreatingDisabled = useMemo(() => {
    if (!isTeacher) return true;
    if (!slotClubPick?.id) return true;
    return false;
  }, [isTeacher, slotClubPick]);

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Clases</h1>
              <div className="pageMeta">
                {headerClubName ? `Clases en: ${headerClubName}` : "Elige un día y reserva con tu profe"}
                {cameFromMapClub && favReady && favTeacherIds.size > 0 ? " · mostrando libres de tus favoritos" : ""}
              </div>
            </div>
          </div>

          <div className="gpRow" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.75 }}>Día:</div>
            <input
              className="gpInput"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{ maxWidth: 200 }}
            />

            {!teacherReady || teacherLoading ? (
              <div className="gpBadge warn">⏳ Comprobando profesor…</div>
            ) : !isTeacher ? (
              <button type="button" className="btn ghost" onClick={onBeTeacher} disabled={teacherBusy}>
                {teacherBusy ? "Activando…" : "Soy profesor"}
              </button>
            ) : (
              <div className="gpBadge ok">🦍 Modo profesor</div>
            )}
          </div>

          {/* Panel profesor */}
          {isTeacher ? (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear clase</div>

              <div className="gpGrid2" style={{ marginTop: 12 }}>
                <div>
                  <label className="gpLabel">Hora</label>
                  <input className="gpInput" type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                </div>

                <div>
                  <label className="gpLabel">Duración (min)</label>
                  <input className="gpInput" type="number" value={slotMins} onChange={(e) => setSlotMins(e.target.value)} />
                </div>

                <div>
                  <label className="gpLabel">Precio (opcional)</label>
                  <input className="gpInput" type="number" value={slotPrice} onChange={(e) => setSlotPrice(e.target.value)} placeholder="Ej: 30" />
                </div>

                <div>
                  <label className="gpLabel">Ciudad / barrio / dirección (opcional)</label>
                  <input className="gpInput" value={slotLocation} onChange={(e) => setSlotLocation(e.target.value)} placeholder="Ej: Málaga · Teatinos · Calle X..." />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="gpLabel">Club (escribe 2–3 letras y elige uno)</label>
                  <input
                    className="gpInput"
                    value={slotClubQuery}
                    onChange={(e) => setSlotClubQuery(e.target.value)}
                    list="clubs-create-list"
                    placeholder="Ej: Inacua..."
                  />
                  <datalist id="clubs-create-list">
                    {slotClubSuggest.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>

                  {slotClubQuery && !slotClubPick?.id ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "crimson", fontWeight: 800 }}>
                      Elige un club de la lista para evitar errores.
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="gpLabel">Pista</label>
                  <input className="gpInput" value={slotCourt} onChange={(e) => setSlotCourt(e.target.value)} placeholder="Ej: Pista 3 / Central" />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="gpLabel">Notas (opcional)</label>
                <input className="gpInput" value={slotNotes} onChange={(e) => setSlotNotes(e.target.value)} placeholder="Ej: clase técnica + bandeja" />
              </div>

              <div className="gpRow" style={{ marginTop: 12 }}>
                <button className="btn" onClick={createClass} disabled={isCreatingDisabled}>
                  Crear clase
                </button>
              </div>
            </div>
          ) : null}

          {/* Filtros */}
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Filtros</div>
              <button type="button" className="btn ghost" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>

            <div className="gpGrid2" style={{ marginTop: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="gpLabel">Club (autocompletar)</label>
                <input
                  className="gpInput"
                  value={filterClubQuery}
                  onChange={(e) => setFilterClubQuery(e.target.value)}
                  list="clubs-filter-list"
                  placeholder="Escribe 2–3 letras..."
                />
                <datalist id="clubs-filter-list">
                  {filterClubSuggest.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="gpLabel">Profesor</label>
                <select className="gpInput" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                  <option value="">Todos</option>
                  {teacherFilterOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="gpLabel">Precio</label>
                <select className="gpInput" value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="le20">≤ 20€</option>
                  <option value="p20_30">20–30€</option>
                  <option value="gt30">&gt; 30€</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" className="btn ghost" onClick={() => loadDay()} style={{ width: "100%" }}>
                  Refrescar
                </button>
              </div>
            </div>
          </div>

          {/* Lista clases */}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <div style={{ opacity: 0.75 }}>Cargando…</div>
            ) : String(day) < String(todayStr) ? (
              <div style={{ opacity: 0.75 }}>No mostramos clases de días pasados.</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                No hay clases para este día (o con estos filtros).
                {cameFromMapClub && favReady && favTeacherIds.size > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    (Vienes del mapa y tienes favoritos: aquí solo aparecen <b>clases libres</b> de tus profes favoritos.)
                  </div>
                ) : null}
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {filteredItems.map((c) => {
                  const start = new Date(c.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  const end = new Date(c.end_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  const booked = !!c.is_booked;

                  const uid = session?.user?.id ? String(session.user.id) : "";
                  const isOwnerTeacher = uid && String(c.teacher_id) === uid;

                  const prof = profilesById[String(c.teacher_id)] || null;
                  const profName =
                    (prof?.name && String(prof.name).trim()) ||
                    (prof?.handle && String(prof.handle).trim()) ||
                    `Profe ${String(c.teacher_id).slice(0, 6)}…`;

                  const avatar = prof?.avatar_url || "";
                  const clubLabel = c.club_name || c.club || "";

                  return (
                    <li key={c.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ minWidth: 260, flex: 1 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950, fontSize: 16 }}>
                              {start} – {end}
                            </div>

                            <span
                              style={{
                                padding: "5px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 900,
                                background: booked ? "rgba(220, 38, 38, 0.10)" : "rgba(34, 197, 94, 0.12)",
                                color: booked ? "rgb(185, 28, 28)" : "rgb(21, 128, 61)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              {booked ? "❌ Reservada" : "✅ Libre"}
                            </span>

                            {clubLabel ? (
                              <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontSize: 12, fontWeight: 800 }}>
                                🏟️ {clubLabel}
                              </span>
                            ) : null}
                          </div>

                          {/* Profe */}
                          <div
                            onClick={() => navigate(`/profesores/${c.teacher_id}`)}
                            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, cursor: "pointer", userSelect: "none" }}
                            title="Ver perfil del profesor"
                          >
                            {avatar ? (
                              <img src={avatar} alt={profName} style={{ width: 34, height: 34, borderRadius: 999, objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(0,0,0,0.06)" }}>
                                {initials(profName)}
                              </div>
                            )}

                            <div style={{ fontSize: 13, opacity: 0.9 }}>
                              <div style={{ fontWeight: 900 }}>{profName}</div>

                              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {c.court ? (
                                  <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontSize: 12, fontWeight: 800 }}>
                                    🎾 {c.court}
                                  </span>
                                ) : null}

                                {c.location ? (
                                  <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontSize: 12, fontWeight: 800 }}>
                                    📍 {c.location}
                                  </span>
                                ) : null}

                                {c.price ? (
                                  <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", fontSize: 12, fontWeight: 800 }}>
                                    💶 {c.price}€
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {c.notes ? <div style={{ marginTop: 10, fontSize: 13 }}>{c.notes}</div> : null}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {!booked ? (
                            <button className="btn" onClick={() => bookClass(c.id)} disabled={!session || bookingId === c.id}>
                              {bookingId === c.id ? "Engorilando…" : "Reservar 🦍"}
                            </button>
                          ) : (
                            <button className="btn ghost" disabled>
                              Reservada
                            </button>
                          )}

                          {isOwnerTeacher ? (
                            <button className="btn ghost" onClick={() => cancelClass(c.id)} disabled={bookingId === c.id}>
                              {c.is_booked ? "❌ Cancelar (avisar alumno)" : "🗑️ Borrar clase"}
                            </button>
                          ) : booked && session?.user?.id ? (
                            <button className="btn ghost" onClick={() => cancelMyBooking(c.id)} disabled={bookingId === c.id}>
                              Anular mi reserva
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* MODAL CÓDIGO PROFESOR */}
      {showTeacherCode ? (
        <div className="gpModalOverlay" onClick={() => setShowTeacherCode(false)}>
          <div className="gpModalCard" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="gpModalHeader">
              <div style={{ fontWeight: 900, fontSize: 16 }}>🦍 Activar modo profesor</div>
              <button type="button" className="btn ghost" onClick={() => setShowTeacherCode(false)}>
                Cerrar
              </button>
            </div>

            <label className="gpLabel">Código de profesor</label>
            <input className="gpInput" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Ej: GP-7H2K-2026" />

            <div className="gpRow" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={confirmTeacherCode} disabled={teacherBusy}>
                {teacherBusy ? "Activando…" : "Activar"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowTeacherCode(false)} disabled={teacherBusy}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
