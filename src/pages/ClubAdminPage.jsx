// src/pages/ClubAdminPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const TABS = ["dashboard", "pistas", "reservas", "donaciones"];
const TAB_LABELS = { dashboard: "📊 Dashboard", pistas: "🏟️ Pistas", reservas: "📅 Reservas", donaciones: "💚 Donaciones" };

export default function ClubAdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [clubAdmin, setClubAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [courts, setCourts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [donations, setDonations] = useState([]);
  const [foundations, setFoundations] = useState([]);
  const [stats, setStats] = useState({ totalMatches: 0, totalPlayers: 0, totalEarned: 0, totalDonated: 0 });
  const [showNewCourt, setShowNewCourt] = useState(false);
  const [courtForm, setCourtForm] = useState({ name: "", court_type: "outdoor" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      if (!data?.session) { navigate("/login"); return; }
      loadAdmin(data.session.user.id);
    });
  }, []);

  async function loadAdmin(userId) {
    try {
      const { data } = await supabase.from("club_admins").select("*").eq("user_id", userId).maybeSingle();
      if (!data) { setLoading(false); return; }
      setClubAdmin(data);
      await Promise.all([loadCourts(data.club_id), loadBookings(data.club_id), loadDonations(data.club_id), loadStats(data.club_id), loadFoundations()]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadCourts(clubId) {
    const { data } = await supabase.from("club_courts").select("*").eq("club_id", clubId).order("created_at");
    setCourts(data || []);
  }

  async function loadBookings(clubId) {
    const { data } = await supabase.from("court_bookings").select("*, profiles(name, handle, avatar_url)").eq("club_id", clubId).order("date", { ascending: false }).limit(50);
    setBookings(data || []);
  }

  async function loadDonations(clubId) {
    const { data } = await supabase.from("club_donations").select("*, foundations(name, logo_url)").eq("club_id", clubId).order("month", { ascending: false });
    setDonations(data || []);
  }

  async function loadFoundations() {
    const { data } = await supabase.from("foundations").select("*").eq("active", true);
    setFoundations(data || []);
  }

  async function loadStats(clubId) {
    const { data: matches } = await supabase.from("matches").select("id, join_fee_cents").eq("club_id", clubId);
    const total = (matches || []).length;
    const earned = (matches || []).reduce((s, m) => s + (m.join_fee_cents || 0) / 3, 0);
    const donated = earned;
    setStats({ totalMatches: total, totalPlayers: total * 4, totalEarned: Math.round(earned), totalDonated: Math.round(donated) });
  }

  async function createCourt() {
    if (!courtForm.name.trim()) return;
    try {
      setSaving(true);
      const { data, error } = await supabase.from("club_courts").insert({ club_id: clubAdmin.club_id, name: courtForm.name.trim(), court_type: courtForm.court_type }).select().single();
      if (error) throw error;
      setCourts(prev => [...prev, data]);
      setShowNewCourt(false);
      setCourtForm({ name: "", court_type: "outdoor" });
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function toggleCourt(courtId, isActive) {
    await supabase.from("club_courts").update({ is_active: !isActive }).eq("id", courtId);
    setCourts(prev => prev.map(c => c.id === courtId ? { ...c, is_active: !isActive } : c));
  }

  async function updateBookingStatus(bookingId, status) {
    await supabase.from("court_bookings").update({ status }).eq("id", bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  }

  const S = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "system-ui, sans-serif", paddingBottom: 40 },
    header: { background: "linear-gradient(135deg, #0f1a00, #1a2a00)", borderBottom: "1px solid rgba(116,184,0,0.2)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 },
    title: { fontSize: 20, fontWeight: 900, color: "#74B800" },
    tabs: { display: "flex", gap: 4, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" },
    tab: (active) => ({ padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: active ? "rgba(116,184,0,0.15)" : "transparent", color: active ? "#74B800" : "rgba(255,255,255,0.5)", borderBottom: active ? "2px solid #74B800" : "2px solid transparent" }),
    section: { padding: "16px 16px" },
    card: { background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: 16, marginBottom: 12 },
    statCard: { background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: 16, textAlign: "center" },
    label: { fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    value: { fontSize: 28, fontWeight: 900, color: "#74B800" },
    btn: (color) => ({ padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 13, background: color === "green" ? "linear-gradient(135deg,#74B800,#9BE800)" : color === "red" ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.08)", color: color === "green" ? "#000" : color === "red" ? "#ff6b6b" : "#fff" }),
    input: { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" },
    badge: (status) => ({ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: status === "confirmed" ? "rgba(116,184,0,0.15)" : status === "pending" ? "rgba(255,165,0,0.15)" : "rgba(220,38,38,0.15)", color: status === "confirmed" ? "#74B800" : status === "pending" ? "#FFA500" : "#ff6b6b" }),
  };

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "rgba(255,255,255,0.5)" }}>Cargando...</div>;

  if (!clubAdmin) return (
    <div style={{ ...S.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
      <div style={{ fontSize: 48 }}>🏟️</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Acceso restringido</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No tienes permisos de administrador de club. Contacta con Gorila Pádel para registrar tu club.</div>
      <button onClick={() => navigate("/")} style={S.btn("green")}>Volver al inicio</button>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#74B800", fontSize: 20, cursor: "pointer" }}>←</button>
        <div>
          <div style={S.title}>🏟️ {clubAdmin.club_name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Panel de administración</div>
        </div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>)}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        <div style={S.section}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Partidos jugados", value: stats.totalMatches, icon: "🏓" },
              { label: "Jugadores totales", value: stats.totalPlayers, icon: "👥" },
              { label: "Ingresos (€)", value: (stats.totalEarned / 100).toFixed(2), icon: "💶" },
              { label: "Donado (€)", value: (stats.totalDonated / 100).toFixed(2), icon: "💚" },
            ].map(({ label, value, icon }) => (
              <div key={label} style={S.statCard}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
                <div style={S.value}>{value}</div>
                <div style={S.label}>{label}</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>💚 Modelo de reparto</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
              Por cada jugador que se une a un partido en tu club, se cobran <strong style={{ color: "#fff" }}>30 céntimos</strong> repartidos en 3 partes iguales:
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[{ label: "Tu club", color: "#74B800", pct: "10cts" }, { label: "Gorila Pádel", color: "#9BE800", pct: "10cts" }, { label: "Fundación", color: "#4ade80", pct: "10cts" }].map(({ label, color, pct }) => (
                <div key={label} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${color}33`, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{pct}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>📊 Reservas recientes</div>
            {bookings.slice(0, 5).map(b => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{b.profiles?.name || "Usuario"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{b.date} · {b.start_time}</div>
                </div>
                <span style={S.badge(b.status)}>{b.status}</span>
              </div>
            ))}
            {bookings.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 16 }}>No hay reservas aún</div>}
          </div>
        </div>
      )}

      {/* ── PISTAS ── */}
      {tab === "pistas" && (
        <div style={S.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Tus pistas</div>
            <button onClick={() => setShowNewCourt(true)} style={S.btn("green")}>+ Nueva pista</button>
          </div>

          {courts.map(c => (
            <div key={c.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c.is_active ? "#fff" : "rgba(255,255,255,0.3)" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{c.court_type === "indoor" ? "🏠 Indoor" : "☀️ Outdoor"}</div>
              </div>
              <button onClick={() => toggleCourt(c.id, c.is_active)}
                style={{ ...S.btn(c.is_active ? "red" : "green"), fontSize: 11, padding: "6px 12px" }}>
                {c.is_active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}

          {courts.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No tienes pistas registradas aún</div>}

          {showNewCourt && (
            <div onClick={() => setShowNewCourt(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div onClick={e => e.stopPropagation()} style={{ width: "min(640px,100%)", background: "#111", borderRadius: "20px 20px 0 0", border: "1px solid rgba(116,184,0,0.2)", padding: 20, paddingBottom: "max(20px,env(safe-area-inset-bottom))" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#74B800", marginBottom: 16 }}>🏟️ Nueva pista</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input placeholder="Nombre de la pista (ej: Pista 1, Pista Central…)" value={courtForm.name}
                    onChange={e => setCourtForm(p => ({ ...p, name: e.target.value }))} style={S.input} />
                  <select value={courtForm.court_type} onChange={e => setCourtForm(p => ({ ...p, court_type: e.target.value }))}
                    style={{ ...S.input, background: "#1a1a1a" }}>
                    <option value="outdoor">☀️ Outdoor</option>
                    <option value="indoor">🏠 Indoor</option>
                    <option value="covered">⛺ Cubierta</option>
                  </select>
                  <button onClick={createCourt} disabled={saving || !courtForm.name.trim()} style={S.btn("green")}>
                    {saving ? "Guardando…" : "✅ Crear pista"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESERVAS ── */}
      {tab === "reservas" && (
        <div style={S.section}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>Reservas</div>
          {bookings.map(b => (
            <div key={b.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{b.profiles?.name || "Usuario"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{b.date} · {b.start_time} – {b.end_time}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>💶 {b.price}€</div>
                </div>
                <span style={S.badge(b.status)}>{b.status}</span>
              </div>
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => updateBookingStatus(b.id, "confirmed")} style={{ ...S.btn("green"), flex: 1, fontSize: 12 }}>✅ Confirmar</button>
                  <button onClick={() => updateBookingStatus(b.id, "rejected")} style={{ ...S.btn("red"), flex: 1, fontSize: 12 }}>❌ Rechazar</button>
                </div>
              )}
            </div>
          ))}
          {bookings.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No hay reservas aún</div>}
        </div>
      )}

      {/* ── DONACIONES ── */}
      {tab === "donaciones" && (
        <div style={S.section}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>💚 Donaciones de tu club</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>10 céntimos de cada jugador que se une a un partido en tu club van a la fundación.</div>

          {foundations.length > 0 && (
            <div style={{ ...S.card, border: "1px solid rgba(116,184,0,0.2)", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>FUNDACIÓN BENEFICIARIA</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#74B800" }}>{foundations[0]?.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{foundations[0]?.description}</div>
            </div>
          )}

          {donations.map(d => (
            <div key={d.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{new Date(d.month).toLocaleDateString("es", { month: "long", year: "numeric" })}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{d.matches_count} partidos</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#4ade80" }}>{(d.total_cents / 100).toFixed(2)}€</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>donados</div>
                </div>
              </div>
            </div>
          ))}
          {donations.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Aún no hay donaciones registradas</div>}

          <div style={{ ...S.card, background: "rgba(116,184,0,0.05)", border: "1px solid rgba(116,184,0,0.15)", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
              🔍 Todas las donaciones son <strong style={{ color: "#74B800" }}>verificables y transparentes</strong>. Los usuarios pueden ver desde la app cuánto ha donado cada club y a qué fundación va el dinero.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
