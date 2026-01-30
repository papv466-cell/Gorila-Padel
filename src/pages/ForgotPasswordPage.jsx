// src/pages/ClassesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
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
  const end = new Date(start.getTime() + mins * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [day, setDay] = useState(today);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  // Teacher
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherRow, setTeacherRow] = useState(null);

  // Modal código profesor
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);

  // Create slot form (teacher)
  const [slotTime, setSlotTime] = useState("10:00");
  const [slotMins, setSlotMins] = useState(60);
  const [slotPrice, setSlotPrice] = useState("");
  const [slotLocation, setSlotLocation] = useState("");
  const [slotNotes, setSlotNotes] = useState("");

  // Reservas (control doble click)
  const [bookBusyId, setBookBusyId] = useState(null);

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

  // -------- Push notifications (IMPORTANTE) ----------
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user?.id) return;

    ensurePushSubscription()
      .then(() => {
        // console.log("🔔 Push subscription OK");
      })
      .catch(() => {
        // no rompemos nada si el navegador no soporta push
      });
  }, [authReady, session?.user?.id]);

  // -------- Teacher status (única fuente de verdad) ----------
  async function fetchTeacherStatus(uid) {
    if (!uid) {
      setIsTeacher(false);
      setTeacherRow(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;

      const active = !!data?.id && data?.is_active !== false;
      setIsTeacher(active);
      setTeacherRow(data || null);
    } catch {
      setIsTeacher(false);
      setTeacherRow(null);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    fetchTeacherStatus(session?.user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session?.user?.id]);

  // -------- Load day ----------
  async function loadDay() {
    try {
      setLoading(true);

      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();

      const { data, error } = await supabase
        .from("classes")
        .select("id, teacher_id, start_at, end_at, price, location, notes, is_booked, created_at")
        .gte("start_at", start)
        .lte("start_at", end)
        .order("start_at", { ascending: true });

      if (error) throw error;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.message || "No se pudieron cargar las clases");
      setItems([]);
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

  // -------- Activar profesor con código (RPC) ----------
  async function confirmTeacherCode() {
    if (!session?.user?.id) return goLogin();

    try {
      setTeacherBusy(true);

      const code = String(codeInput || "").trim();
      if (!code) {
        toast.error("Escribe el código del profesor");
        return;
      }

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

  // -------- Crear hueco ----------
  async function createSlot() {
    if (!session?.user) return goLogin();
    if (!isTeacher) return toast.error("Solo profesores pueden crear huecos.");

    try {
      const { start_at, end_at } = startEndISO(day, slotTime, Number(slotMins) || 60);

      const payload = {
        teacher_id: session.user.id,
        start_at,
        end_at,
        price: slotPrice ? Number(slotPrice) : null,
        location: slotLocation?.trim() || null,
        notes: slotNotes?.trim() || null,
        is_booked: false,
      };

      const { error } = await supabase.from("classes").insert(payload);
      if (error) throw error;

      toast.success("Hueco creado");
      await loadDay();
    } catch (e) {
      toast.error(e?.message || "No se pudo crear el hueco");
    }
  }

  // (Fase siguiente) eliminar hueco del profe
  // async function deleteSlot(classId) {
  //   if (!session?.user) return goLogin();
  //   try {
  //     const { error } = await supabase.from("classes").delete().eq("id", classId);
  //     if (error) throw error;
  //     toast.success("Hueco eliminado");
  //     await loadDay();
  //   } catch (e) {
  //     toast.error(e?.message || "No se pudo eliminar");
  //   }
  // }

  // -------- Reservar (optimistic + revert si falla) ----------
  async function bookClass(classId) {
    if (!session?.user) return goLogin();
    if (bookBusyId) return; // evita doble click

    const prevItems = items;
    setBookBusyId(classId);

    // UI optimista
    setItems((prev) =>
      prev.map((x) => (x.id === classId ? { ...x, is_booked: true } : x))
    );

    try {
      // 1) booking (UNIQUE class_id)
      const { error: e1 } = await supabase
        .from("class_bookings")
        .insert({ class_id: classId, user_id: session.user.id });
      if (e1) throw e1;

      // 2) marcar clase booked
      const { error: e2 } = await supabase
        .from("classes")
        .update({ is_booked: true })
        .eq("id", classId);
      if (e2) throw e2;

      toast.success("Clase reservada 🦍");

      // sincroniza
      await loadDay();
    } catch (e) {
      // revertimos UI
      setItems(prevItems);

      const msg = String(e?.message || "");
      if (
        e?.code === "23505" ||
        msg.includes("duplicate key") ||
        msg.includes("class_bookings_class_id_key")
      ) {
        toast.error("Esa clase ya está reservada 🥲");
      } else {
        toast.error(e?.message || "No se pudo reservar");
      }

      await loadDay();
    } finally {
      setBookBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Clases</h1>
              <div className="pageMeta">Elige un día y reserva con tu profe</div>
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

            {!isTeacher ? (
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
              <div style={{ fontWeight: 950, fontSize: 16 }}>Crear hueco</div>

              <div className="gpGrid2" style={{ marginTop: 12 }}>
                <div>
                  <label className="gpLabel">Hora</label>
                  <input
                    className="gpInput"
                    type="time"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="gpLabel">Duración (min)</label>
                  <input
                    className="gpInput"
                    type="number"
                    value={slotMins}
                    onChange={(e) => setSlotMins(e.target.value)}
                  />
                </div>

                <div>
                  <label className="gpLabel">Precio (opcional)</label>
                  <input
                    className="gpInput"
                    type="number"
                    value={slotPrice}
                    onChange={(e) => setSlotPrice(e.target.value)}
                    placeholder="ej: 30"
                  />
                </div>

                <div>
                  <label className="gpLabel">Lugar (opcional)</label>
                  <input
                    className="gpInput"
                    value={slotLocation}
                    onChange={(e) => setSlotLocation(e.target.value)}
                    placeholder="Club / pista…"
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="gpLabel">Notas (opcional)</label>
                <input
                  className="gpInput"
                  value={slotNotes}
                  onChange={(e) => setSlotNotes(e.target.value)}
                  placeholder="Ej: clase técnica + bandeja"
                />
              </div>

              <div className="gpRow" style={{ marginTop: 12 }}>
                <button className="btn" onClick={createSlot}>
                  Crear hueco
                </button>
              </div>
            </div>
          ) : null}

          {/* Lista clases */}
          <div style={{ marginTop: 14 }}>
            {loading ? (
              <div style={{ opacity: 0.75 }}>Cargando…</div>
            ) : items.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No hay clases para este día.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {items.map((c) => {
                  const start = new Date(c.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  const end = new Date(c.end_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  const booked = !!c.is_booked;

                  return (
                    <li key={c.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 950, fontSize: 16 }}>
                            {start} – {end} {booked ? " · ❌ Reservada" : " · ✅ Libre"}
                          </div>

                          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                            {c.location ? `📍 ${c.location} · ` : ""}
                            {c.price ? `💶 ${c.price}€ · ` : ""}
                            Profe: {String(c.teacher_id).slice(0, 8)}…
                          </div>

                          {c.notes ? <div style={{ marginTop: 8, fontSize: 13 }}>{c.notes}</div> : null}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {!booked ? (
                            <button
                              className="btn"
                              onClick={() => bookClass(c.id)}
                              disabled={!session || bookBusyId === c.id}
                            >
                              {bookBusyId === c.id ? "Reservando…" : "Reservar"}
                            </button>
                          ) : (
                            <button className="btn ghost" disabled>
                              Reservada
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            *Siguiente paso: notificar al profe cuando le reserven.
          </div>
        </div>
      </div>

      {/* ✅ MODAL CÓDIGO PROFESOR */}
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
            <input
              className="gpInput"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Ej: GP-7H2K-2026"
            />

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
