// src/pages/ClubRegisterPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

const SERVICES = [
  { key: "padel", label: "Pádel", icon: "🎾" },
  { key: "tenis", label: "Tenis", icon: "🎾" },
  { key: "futbol", label: "Fútbol", icon: "⚽" },
  { key: "piscina", label: "Piscina", icon: "🏊" },
  { key: "gym", label: "Gimnasio", icon: "💪" },
  { key: "zumba", label: "Zumba / Clases", icon: "🕺" },
  { key: "bar", label: "Bar / Cafetería", icon: "☕" },
  { key: "ludoteca", label: "Ludoteca", icon: "🧸" },
  { key: "vestuarios", label: "Vestuarios", icon: "🚿" },
  { key: "parking", label: "Parking", icon: "🅿️" },
  { key: "accesible", label: "Accesible silla de ruedas", icon: "♿" },
  { key: "tienda", label: "Tienda / Pro shop", icon: "🛍️" },
];

const COURT_TYPES = [
  { key: "indoor", label: "Indoor" },
  { key: "outdoor", label: "Outdoor" },
  { key: "mixta", label: "Cubierta/Descubierta" },
];

const IS = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

export default function ClubRegisterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressTimeout, setAddressTimeout] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("23:00");
  const [selectedServices, setSelectedServices] = useState(new Set(["padel"]));
  const [courts, setCourts] = useState([{ name: "Pista 1", type: "indoor" }]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) navigate("/login");
      else setSession(data.session);
    });
  }, []);

  async function uploadLogo(file) {
    if (!file) return;
    try {
      setLogoUploading(true);
      const ext = file.name.split(".").pop();
      const path = `club-logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
    } catch (e) { alert("Error subiendo imagen: " + e.message); }
    finally { setLogoUploading(false); }
  }

  async function searchAddress(q) {
    setAddressQuery(q);
    if (addressTimeout) clearTimeout(addressTimeout);
    if (q.length < 3) { setAddressSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        setAddressSearching(true);
        const key = import.meta.env.VITE_GOOGLE_PLACES_KEY;
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=establishment|geocode&components=country:es&language=es&key=${key}`);
        const data = await res.json();
        setAddressSuggestions(data.predictions || []);
      } catch {}
      finally { setAddressSearching(false); }
    }, 400);
    setAddressTimeout(t);
  }

  async function pickAddress(item) {
    try {
      const key = import.meta.env.VITE_GOOGLE_PLACES_KEY;
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,formatted_address,address_components&language=es&key=${key}`);
      const data = await res.json();
      const result = data.result;
      if (!result) return;
      const comps = result.address_components || [];
      const get = (type) => comps.find(c => c.types.includes(type))?.long_name || "";
      const street = [get("route"), get("street_number")].filter(Boolean).join(" ");
      const cityName = get("locality") || get("administrative_area_level_2") || get("administrative_area_level_1");
      setAddress(street || result.formatted_address);
      setCity(cityName);
      setLat(result.geometry.location.lat);
      setLng(result.geometry.location.lng);
      setAddressQuery(result.formatted_address);
      setAddressSuggestions([]);
    } catch (e) { console.error(e); }
  }

  async function geocodeAddress() {
    const query = [address, city].filter(Boolean).join(", ");
    if (!query.trim()) return;
    try {
      setGeocoding(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await res.json();
      if (data?.[0]) { setLat(parseFloat(data[0].lat)); setLng(parseFloat(data[0].lon)); }
    } catch {}
    finally { setGeocoding(false); }
  }

  function toggleService(key) {
    setSelectedServices(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function addCourt() {
    setCourts(prev => [...prev, { name: `Pista ${prev.length + 1}`, type: "indoor" }]);
  }

  function removeCourt(i) {
    setCourts(prev => prev.filter((_, j) => j !== i));
  }

  async function handleSubmit() {
    if (!name.trim() || !city.trim()) { setError("Nombre y ciudad son obligatorios"); return; }
    try {
      setSaving(true); setError(null);
      const { error: err } = await supabase.from("clubs").insert({
        name: name.trim(), city: city.trim(), address: address.trim(), urlimagen: logoUrl || null, lat: lat || null, lon: lng || null,
        description: description.trim(), opening_time: openingTime, closing_time: closingTime,
        phone: phone.trim(), email: email.trim(), website: website.trim(),
        social_instagram: instagram.trim(), social_whatsapp: whatsapp.trim(),
        price_per_hour: pricePerHour ? Number(pricePerHour) : null,
        amenities: Array.from(selectedServices).join(","),
        services: Array.from(selectedServices).map(k => SERVICES.find(s => s.key === k)).filter(Boolean),
        courts_info: courts,
        owner_user_id: session.user.id,
        status: "pending", active: false, verified: false,
        submitted_at: new Date().toISOString(),
      });
      if (err) throw err;
      setStep(4);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const stepTitles = ["Info básica", "Instalaciones", "Contacto"];

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate(-1)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#74B800" }}>🏟️ Registra tu club</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Gratis · Revisión en 24h</div>
          </div>
        </div>

        {step < 4 && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
              {stepTitles.map((t, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 4, borderRadius: 2, background: i + 1 <= step ? "#74B800" : "rgba(255,255,255,0.1)", marginBottom: 6, transition: "background .3s" }} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: i + 1 <= step ? "#74B800" : "rgba(255,255,255,0.3)" }}>{t}</div>
                </div>
              ))}
            </div>
            {error && <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff6b6b", marginBottom: 16 }}>{error}</div>}
          </>
        )}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>¿Cómo se llama tu club?</div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Nombre del club *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Club Pádel Málaga" style={IS} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Dirección *</label>
              <div style={{ position: "relative" }}>
                <input value={addressQuery} onChange={e => searchAddress(e.target.value)}
                  placeholder="Busca la dirección del club..."
                  style={{ ...IS, paddingRight: addressSearching ? 36 : 14 }} />
                {addressSearching && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>⏳</div>}
                {addressSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 99, background: "#1a1a1a", border: "1px solid rgba(116,184,0,0.25)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    {addressSuggestions.map((item, i) => (
                      <div key={i} onClick={() => pickAddress(item)}
                        style={{ padding: "10px 12px", cursor: "pointer", borderBottom: i < addressSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", fontSize: 12, color: "#fff" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(116,184,0,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ fontWeight: 700 }}>{item.structured_formatting?.main_text || item.description}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{item.structured_formatting?.secondary_text || ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {lat && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#74B800", fontWeight: 700 }}>
                  ✅ Ubicación: {city} · {address} ({lat.toFixed(4)}, {lng.toFixed(4)})
                </div>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Descripción (opcional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Cuéntanos algo sobre tu club..." rows={3} style={{ ...IS, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Apertura</label>
                <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Cierre</label>
                <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} style={IS} />
              </div>
            </div>
            {/* Logo */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Logo o foto del club</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {logoUrl
                  ? <img src={logoUrl} alt="logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: "2px solid rgba(116,184,0,0.4)" }} />
                  : <div style={{ width: 64, height: 64, borderRadius: 12, background: "rgba(116,184,0,0.1)", border: "2px dashed rgba(116,184,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏟️</div>
                }
                <label style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: logoUploading ? "not-allowed" : "pointer" }}>
                  {logoUploading ? "⏳ Subiendo…" : "📷 Subir imagen"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadLogo(e.target.files[0])} disabled={logoUploading} />
                </label>
              </div>
            </div>



            <button onClick={() => { if (!name.trim() || !city.trim()) { setError("Nombre y ciudad son obligatorios"); return; } setError(null); setStep(2); }}
              style={{ padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer", marginTop: 8 }}>
              Siguiente →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>¿Qué tiene tu club?</div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>Servicios e instalaciones</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SERVICES.map(s => {
                  const sel = selectedServices.has(s.key);
                  return (
                    <button key={s.key} onClick={() => toggleService(s.key)}
                      style={{ padding: "7px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
                        background: sel ? "linear-gradient(135deg,rgba(116,184,0,0.3),rgba(155,232,0,0.2))" : "rgba(255,255,255,0.06)",
                        color: sel ? "#9BE800" : "rgba(255,255,255,0.5)",
                        outline: sel ? "1px solid rgba(116,184,0,0.5)" : "1px solid rgba(255,255,255,0.08)" }}>
                      {s.icon} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Pistas de pádel</label>
                <button onClick={addCourt} style={{ padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 900, background: "rgba(116,184,0,0.15)", color: "#74B800" }}>+ Añadir pista</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {courts.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <input value={c.name} onChange={e => setCourts(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      style={{ ...IS, flex: 1, padding: "7px 10px", fontSize: 12 }} placeholder="Nombre pista" />
                    <select value={c.type} onChange={e => setCourts(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                      style={{ ...IS, width: "auto", padding: "7px 10px", fontSize: 12 }}>
                      {COURT_TYPES.map(t => <option key={t.key} value={t.key} style={{ background: "#1a1a1a" }}>{t.label}</option>)}
                    </select>
                    {courts.length > 1 && (
                      <button onClick={() => removeCourt(i)} style={{ padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(220,38,38,0.15)", color: "#ff6b6b", fontSize: 12 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ padding: "13px 20px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => { setError(null); setStep(3); }} style={{ flex: 1, padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer" }}>Siguiente →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>¿Cómo contactamos contigo?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="600 000 000" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@club.com" style={IS} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Web</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://www.miclub.com" style={IS} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Instagram</label>
                <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@miclub" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>WhatsApp</label>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="600 000 000" style={IS} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Precio por hora (€)</label>
              <input type="number" value={pricePerHour} onChange={e => setPricePerHour(e.target.value)} placeholder="Ej: 12" min="0" step="0.5" style={{ ...IS, maxWidth: 160 }} />
            </div>
            <div style={{ background: "rgba(116,184,0,0.06)", border: "1px solid rgba(116,184,0,0.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>📋 Resumen</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", flexDirection: "column", gap: 4 }}>
                <div>🏟️ <strong style={{ color: "#fff" }}>{name}</strong> — {city}</div>
                <div>⏰ {openingTime} – {closingTime}</div>
                <div>🎾 {courts.length} pista{courts.length !== 1 ? "s" : ""}</div>
                <div>✅ {selectedServices.size} servicio{selectedServices.size !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Revisaremos tu solicitud en menos de 24h y te avisaremos por notificación.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(2)} style={{ padding: "13px 20px", borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer" }}>← Atrás</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex: 1, padding: "14px", borderRadius: 12, background: saving ? "rgba(116,184,0,0.4)" : "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 15, border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "⏳ Enviando…" : "✅ Enviar solicitud"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>🦍</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>¡Solicitud enviada!</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Hemos recibido los datos de <strong style={{ color: "#fff" }}>{name}</strong>.</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Revisaremos tu club en menos de 24h y te avisaremos cuando esté activo.</div>
            <div style={{ background: "rgba(116,184,0,0.08)", border: "1px solid rgba(116,184,0,0.2)", borderRadius: 14, padding: 16, marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#74B800", marginBottom: 8 }}>¿Qué pasa ahora?</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div>1️⃣ Verificamos que el club existe</div>
                <div>2️⃣ Aprobamos y activamos tu perfil</div>
                <div>3️⃣ Te damos acceso al panel de gestión</div>
                <div>4️⃣ Publicas tus pistas y empiezas a recibir reservas</div>
              </div>
            </div>
            <button onClick={() => navigate("/")} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer" }}>
              Volver al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
