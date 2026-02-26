// src/pages/MapPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { supabase } from "../services/supabaseClient";
import pelotaTenis from "../assets/map/gorila-marker.png";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

/* ─── Utils ─── */
function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
function normText(s) {
  return String(s||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

/* ─── Iconos ─── */
function makeCountIcon(count) {
  const size = count > 20 ? 60 : count > 10 ? 54 : 48;
  const fontSize = count > 20 ? 20 : count > 10 ? 18 : 16;
  return L.divIcon({
    className: "gpClusterIcon",
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:linear-gradient(135deg,#9BEF00,#74B800);border:3px solid #111;display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,0.35);"><div style="font-weight:950;font-size:${fontSize}px;color:#111;">${count}</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -(size/2)],
  });
}
function makeClubIcon({ isFav, isSelected }) {
  const size = isSelected ? 64 : 54;
  const border = isSelected ? "4px solid #74B800" : "3px solid #111";
  const shadow = isSelected ? "0 0 0 3px rgba(116,184,0,0.4), 0 12px 30px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.4)";
  return L.divIcon({
    className: "gpClubIcon",
    html: `<div style="width:${size}px;height:${size}px;position:relative;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
    <circle cx="32" cy="32" r="30" fill="${isSelected ? '#9BE800' : '#74B800'}" stroke="#111" stroke-width="3"/>
    <rect x="29" y="42" width="6" height="14" rx="3" fill="#111"/>
    <ellipse cx="32" cy="28" rx="13" ry="16" fill="#fff" stroke="#111" stroke-width="2"/>
    <circle cx="28" cy="24" r="2" fill="#74B800"/>
    <circle cx="36" cy="24" r="2" fill="#74B800"/>
    <circle cx="32" cy="30" r="2" fill="#74B800"/>
    <circle cx="28" cy="36" r="2" fill="#74B800"/>
    <circle cx="36" cy="36" r="2" fill="#74B800"/>
    <circle cx="46" cy="46" r="7" fill="#9BE800" stroke="#111" stroke-width="1.5"/>
    <path d="M41 44 Q46 41 51 44" stroke="#fff" stroke-width="1" fill="none"/>
    <path d="M41 48 Q46 51 51 48" stroke="#fff" stroke-width="1" fill="none"/>
  </svg>
  ${isFav ? `<div style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:999px;background:#FFD700;border:2px solid #111;font-size:11px;display:grid;place-items:center;">⭐</div>` : ""}
  ${isSelected ? `<div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #9BE800;"></div>` : ""}
</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size+6],
    popupAnchor: [0, -(size+6)],
  });
}

const userIcon = L.divIcon({
  className: "gpUserIcon",
  html: `<div style="width:38px;height:38px;border-radius:999px;background:#fff;border:3px solid #74B800;display:grid;place-items:center;font-size:20px;box-shadow:0 0 0 6px rgba(116,184,0,0.2),0 8px 24px rgba(0,0,0,0.3);">🍌</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function MapEvents({ onZoom, onMove, onMapClick }) {
  useMapEvents({
    zoomend(e) { onZoom?.(e.target.getZoom()); },
    moveend(e) { const c = e.target.getCenter(); onMove?.({ lat: c.lat, lng: c.lng }); },
    click() { onMapClick?.(); },
  });
  return null;
}
function FlyTo({ target, zoomLevel }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], zoomLevel ?? 14, { animate: true, duration: 0.7 });
  }, [target, zoomLevel, map]);
  return null;
}

function SetMapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map]);
  return null;
}

function makeCourtIcon(isSelected) {
  const bg = isSelected ? "#9BE800" : "#f59e0b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <ellipse cx="18" cy="40" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>
    <path d="M18 2 C10 2 4 8 4 16 C4 28 18 42 18 42 C18 42 32 28 32 16 C32 8 26 2 18 2Z" fill="${bg}" stroke="#000" stroke-width="1.5"/>
    <text x="18" y="21" text-anchor="middle" font-size="14" fill="#000">🏠</text>
  </svg>`;
  return L.divIcon({ html: svg, className:"", iconSize:[36,44], iconAnchor:[18,44], popupAnchor:[0,-44] });
}

/* ─── Componente principal ─── */
export default function MapPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(9);
  const [userPos, setUserPos] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [viewMode, setViewMode] = useState(null); // null | "list" | "near" | "fav"
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null); // club seleccionado → bottom sheet
  const [sheetSnap, setSheetSnap] = useState("peek"); // peek | full
  const [flyToPos, setFlyToPos] = useState(null);
  const [activeFilter, setActiveFilter] = useState("todos"); // todos | cerca | favoritos | abierto
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const cardsRef = useRef(null);

  const [privateCourts, setPrivateCourts] = useState([]);
  const [showCreateCourt, setShowCreateCourt] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [courtForm, setCourtForm] = useState({name:"",description:"",lat:null,lng:null});
  const [courtSaving, setCourtSaving] = useState(false);
  const [session, setSession] = useState(null);
  const geoTimerRef = useRef(null);

  const [favIds, setFavIds] = useState(() => {
    try {
      const raw = localStorage.getItem("gp_fav_club_ids");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch { return new Set(); }
  });

  function toggleFav(clubId) {
    const id = String(clubId || "");
    if (!id) return;
    const next = new Set(Array.from(favIds));
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavIds(next);
    try { localStorage.setItem("gp_fav_club_ids", JSON.stringify(Array.from(next))); } catch {}
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        setSession(sessionData?.session||null);
        const rows = await fetchClubsFromGoogleSheet();
        const { data: courts } = await supabase.from("private_courts").select("*");
        setPrivateCourts(Array.isArray(courts) ? courts : []);
        if (!alive) return;
        setClubs(Array.isArray(rows) ? rows : []);
      } catch {
        if (!alive) return;
        setClubs([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const clubsWithCoords = useMemo(() =>
    (clubs||[]).filter(c => Number.isFinite(c?.lat) && Number.isFinite(c?.lng))
  , [clubs]);

  const suggestions = useMemo(() => {
    const q = normText(query);
    if (!q || q.length < 2) return [];
    return clubsWithCoords.filter(c => normText(c?.name).includes(q) || normText(c?.city).includes(q)).slice(0, 8);
  }, [query, clubsWithCoords]);

  const filteredList = useMemo(() => {
    let list = clubsWithCoords;
    if (activeFilter === "cerca" && userPos)
      list = list.filter(c => haversineKm(userPos, { lat: c.lat, lng: c.lng }) <= 20);
    else if (activeFilter === "favoritos")
      list = list.filter(c => favIds.has(String(c?.id||"")));

    return [...list].sort((a, b) => {
      const aFav = favIds.has(String(a?.id||"")) ? 1 : 0;
      const bFav = favIds.has(String(b?.id||"")) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (userPos) {
        const da = haversineKm(userPos, { lat: a.lat, lng: a.lng });
        const db = haversineKm(userPos, { lat: b.lat, lng: b.lng });
        if (da !== db) return da - db;
      }
      return String(a?.name||"").localeCompare(String(b?.name||""), "es");
    });
  }, [clubsWithCoords, activeFilter, userPos, favIds]);

  const defaultCenter = useMemo(() => {
    const c = filteredList[0] || clubsWithCoords[0];
    return c ? [c.lat, c.lng] : [36.7213, -4.4214];
  }, [filteredList, clubsWithCoords]);

  const clusterItems = useMemo(() => {
    const list = filteredList;
    if (zoom <= 9) {
      if (!list.length) return [];
      const latSum = list.reduce((s, c) => s+c.lat, 0);
      const lngSum = list.reduce((s, c) => s+c.lng, 0);
      return [{ type:"cluster", key:"all", count:list.length, lat:latSum/list.length, lng:lngSum/list.length }];
    }
    if (zoom <= 11) {
      const byCity = new Map();
      for (const c of list) {
        const city = String(c.city||"Otros").trim();
        const e = byCity.get(city) || { key:`city:${city}`, count:0, latSum:0, lngSum:0 };
        e.count++; e.latSum += c.lat; e.lngSum += c.lng;
        byCity.set(city, e);
      }
      return Array.from(byCity.values()).map(e => ({ type:"cluster", key:e.key, count:e.count, lat:e.latSum/e.count, lng:e.lngSum/e.count }));
    }
    if (zoom <= 13) {
      const step = 0.015, grid = new Map();
      for (const c of list) {
        const glat = Math.round(c.lat/step)*step, glng = Math.round(c.lng/step)*step;
        const key = `g:${glat.toFixed(3)}:${glng.toFixed(3)}`;
        const e = grid.get(key) || { key, count:0, latSum:0, lngSum:0 };
        e.count++; e.latSum += c.lat; e.lngSum += c.lng;
        grid.set(key, e);
      }
      return Array.from(grid.values()).map(e => ({ type:"cluster", key:e.key, count:e.count, lat:e.latSum/e.count, lng:e.lngSum/e.count }));
    }
    return list.map(c => ({ type:"club", club:c, key:String(c.id||c.name) }));
  }, [filteredList, zoom]);

  function requestMyLocation(cb) {
    if (!navigator.geolocation) { alert("Este navegador no soporta geolocalización."); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p); setFlyToPos(p);
        try { mapRef.current?.flyTo([p.lat, p.lng], 14, { animate:true, duration:0.7 }); } catch {}
        setLocBusy(false);
        cb?.();
      },
      () => { alert("No pude obtener tu ubicación."); setLocBusy(false); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:30000 }
    );
  }

  function selectClub(club) {
    setQuery(club.name);
    setShowSuggest(false);
    setFlyToPos({ lat: club.lat, lng: club.lng });
    setSelectedClub(club);
    setSheetSnap("peek");
    try { mapRef.current?.flyTo([club.lat, club.lng], 15, { animate:true, duration:0.7 }); } catch {}
  }

  function openClubSheet(club) {
    setSelectedClub(club);
    setSheetSnap("peek");
    try { mapRef.current?.flyTo([club.lat, club.lng], 15, { animate:true, duration:0.5 }); } catch {}
  }

  function closeSheet() { setSelectedClub(null); }

  /* ─── Scroll card activa en horizontal ─── */
  useEffect(() => {
    if (!selectedClub || !cardsRef.current) return;
    const idx = filteredList.findIndex(c => String(c.id) === String(selectedClub.id));
    if (idx < 0) return;
    const card = cardsRef.current.children[idx];
    if (card) card.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
  }, [selectedClub]);

  const dist = selectedClub && userPos ? haversineKm(userPos, { lat:selectedClub.lat, lng:selectedClub.lng }) : null;
  const isFavSelected = selectedClub ? favIds.has(String(selectedClub.id||"")) : false;

  return (
    <div className="page gpMapPage" style={{ position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes gpSheetIn { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes gpFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes gpCardIn  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .gpMapPage { background:#0a0a0a; }
        .gpFilterPill { transition:all .15s; border:none; cursor:pointer; padding:7px 14px; border-radius:20px; font-size:11px; font-weight:800; white-space:nowrap; }
        .gpFilterPill.active { background:#74B800; color:#000; box-shadow:0 4px 12px rgba(116,184,0,0.3); }
        .gpFilterPill:not(.active) { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.7); }
        .gpFilterPill:not(.active):hover { background:rgba(255,255,255,0.15); }
        .gpClubCardH { transition:all .2s; cursor:pointer; flex-shrink:0; }
        .gpClubCardH:hover { transform:translateY(-2px); }
        .gpClubCardH.selected { border-color:#74B800 !important; box-shadow:0 0 0 1px #74B800 !important; }
        .gpListCard { transition:background .15s; cursor:pointer; }
        .gpListCard:hover { background:rgba(116,184,0,0.05) !important; }
        .gpSheetHandle { width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.2);margin:0 auto 14px; }
        .gpSuggest { position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:999;background:#1a1a1a;border:1px solid rgba(116,184,0,0.25);border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6); }
        .gpSuggestItem { width:100%;text-align:left;padding:11px 14px;border:none;background:transparent;color:#fff;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05); }
        .gpSuggestItem:hover { background:rgba(116,184,0,0.1); }
        .gpSearchInput::placeholder { color:rgba(255,255,255,0.7); }
        .gpSearchInput:focus { outline:none; box-shadow:0 0 0 3px rgba(116,184,0,0.3); }
      `}</style>

      <div className="pageWrap">
        <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 60px)", position:"relative" }}>

          {/* ── BARRA BÚSQUEDA ── */}
          <div style={{ padding:"10px 12px 0", position:"relative", zIndex:200 }}>
            <div style={{ position:"relative" }}>
              <input
                ref={searchRef}
                className="gpSearchInput"
                type="text"
                placeholder="🔍 Buscar clubs o ciudades..."
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 160)}
                style={{ width:"100%", padding:"13px 16px 13px 14px", borderRadius:14, border:"1.5px solid rgba(116,184,0,0.3)", background:"rgba(20,20,20,0.96)", color:"#fff", fontSize:14, fontWeight:700, boxSizing:"border-box", backdropFilter:"blur(12px)" }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setShowSuggest(false); }}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:18, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
              )}
              {showSuggest && suggestions.length > 0 && (
                <div className="gpSuggest">
                  {suggestions.map(c => (
                    <button key={c.id||c.name} className="gpSuggestItem" onMouseDown={() => selectClub(c)}>
                      <div style={{ fontWeight:800, fontSize:13 }}>🏟️ {c.name}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>📍 {c.city}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── FILTROS PILLS ── */}
            <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"10px 0 6px", WebkitOverflowScrolling:"touch" }}>
              {[
                { key:"todos",      label:"Todos",       emoji:"🏟️" },
                { key:"cerca",      label:"Cerca de mí", emoji:"📍" },
                { key:"favoritos",  label:"Favoritos",   emoji:"⭐" },
              ].map(f => (
                <button key={f.key} className={`gpFilterPill ${activeFilter===f.key?"active":""}`}
                  onClick={() => {
                    if (f.key === "cerca" && !userPos) {
                      requestMyLocation(() => setActiveFilter("cerca"));
                    } else {
                      setActiveFilter(f.key);
                    }
                  }}>
                  {f.emoji} {f.label}
                  {f.key === "cerca" && userPos && activeFilter==="cerca" && <span style={{ marginLeft:4, fontSize:10, opacity:0.8 }}>20km</span>}
                  {f.key === "favoritos" && favIds.size > 0 && <span style={{ marginLeft:5, background:"rgba(0,0,0,0.2)", borderRadius:999, padding:"1px 5px", fontSize:10 }}>{favIds.size}</span>}
                </button>
              ))}
              <button className="gpFilterPill" onClick={() => setViewMode(v => v==="list"?null:"list")}
                style={{ background: viewMode==="list" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)", color:viewMode==="list"?"#fff":"rgba(255,255,255,0.6)", border: viewMode==="list" ? "1px solid rgba(255,255,255,0.3)" : "none" }}>
                {viewMode==="list" ? "🗺️ Ver mapa" : "📋 Ver lista"}
              </button>
            </div>
          </div>

          {/* ── MAPA ── */}
          {viewMode !== "list" && (
            <div style={{ flex:1, position:"relative", margin:"0 12px", borderRadius:16, overflow:"hidden", border:"1px solid rgba(116,184,0,0.15)" }}>
              <MapContainer
                center={defaultCenter} zoom={9}
                style={{ height:"100%", width:"100%" }}
                ref={mapRef}              >
                <MapEvents onZoom={z => setZoom(z)} onMove={() => {}} onMapClick={closeSheet} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={19}
                />
                <FlyTo target={flyToPos} zoomLevel={15} />

                {userPos && (
                  <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
                    <Popup>🍌 Estás aquí</Popup>
                  </Marker>
                )}

                {clusterItems.map(it => {
                  if (it.type === "cluster") {
                    return (
                      <Marker key={it.key} position={[it.lat, it.lng]} icon={makeCountIcon(it.count)}
                        eventHandlers={{ click: () => {
                      try {
                        const nextZoom = zoom <= 9 ? 11 : zoom <= 11 ? 13 : 15;
                        mapRef.current?.setView([it.lat, it.lng], nextZoom, { animate: true, duration: 0.6 });
                      } catch {}                        }}} />
                    );
                  }
                  const c = it.club;
                  const isSelected = selectedClub && String(selectedClub.id) === String(c.id);
                  return (
                    <Marker key={it.key} position={[c.lat, c.lng]}
                      icon={makeClubIcon({ isFav: favIds.has(String(c.id||"")), isSelected })}
                      eventHandlers={{ click: () => openClubSheet(c) }}
                    />
                  );
                })}
              {privateCourts.filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)).map(c=>(
                <Marker key={`court:${c.id}`} position={[c.lat,c.lng]}
                  icon={makeCourtIcon(selectedCourt&&selectedCourt.id===c.id)}
                  eventHandlers={{click:()=>{setSelectedCourt(c);setSelectedClub(null);}}}
                />
              ))}
              </MapContainer>

              {/* Botón ubicación */}}
              <button onClick={() => requestMyLocation()} disabled={locBusy}
                style={{ position:"absolute", bottom: selectedClub ? 200 : 16, right:12, zIndex:500, width:44, height:44, borderRadius:12, background:"rgba(20,20,20,0.95)", border:"1px solid rgba(116,184,0,0.3)", fontSize:20, cursor:"pointer", display:"grid", placeItems:"center", backdropFilter:"blur(8px)", transition:"bottom .3s" }}>
                {locBusy ? "⏳" : "🍌"}
              </button>

              {/* Botón crear pista */}
              {session && (
                <button onClick={()=>{setShowCreateCourt(true);setCourtForm({name:"",description:"",lat:userPos?.lat||36.7,lng:userPos?.lng||-4.4});}}
                  style={{position:"absolute",bottom:selectedClub?200:70,right:12,zIndex:500,padding:"8px 14px",borderRadius:12,background:"linear-gradient(135deg,#f59e0b,#fbbf24)",border:"none",color:"#000",fontWeight:900,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 12px rgba(0,0,0,0.4)"}}>
                  🏠 Mi pista
                </button>
              )}

              {/* Contador */}
              <div style={{ position:"absolute", top:12, right:12, zIndex:400, background:"rgba(20,20,20,0.9)", border:"1px solid rgba(116,184,0,0.2)", borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.7)", backdropFilter:"blur(8px)" }}>
                {filteredList.length} clubs
              </div>
            </div>
          )}

          {/* ── CARDS HORIZONTALES (Google Maps style) ── */}
          {viewMode !== "list" && zoom >= 12 && filteredList.length > 0 && !selectedClub && (
            <div style={{ padding:"10px 0 8px", animation:"gpCardIn 0.3s ease" }}>
              <div ref={cardsRef} style={{ display:"flex", gap:10, overflowX:"auto", padding:"0 12px", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
                {filteredList.slice(0, 20).map(c => {
                  const d = userPos ? haversineKm(userPos, { lat:c.lat, lng:c.lng }) : null;
                  const isSelected = selectedClub && String(selectedClub.id) === String(c.id);
                  return (
                    <div key={c.id||c.name} className={`gpClubCardH ${isSelected?"selected":""}`}
                      onClick={() => openClubSheet(c)}
                      style={{ minWidth:160, background:"#111", borderRadius:12, border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
                      <div style={{ height:70, background:"linear-gradient(135deg,#1a2a00,#0d1a00)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                        {c.urlimagen ? <img src={c.urlimagen} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🏟️"}
                      </div>
                      <div style={{ padding:"8px 10px" }}>
                        <div style={{ fontSize:12, fontWeight:900, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                          {d != null ? `📍 ${d.toFixed(1)}km` : `📍 ${c.city||""}`}
                        </div>
                        {favIds.has(String(c.id||"")) && <div style={{ fontSize:9, color:"#FFD700", marginTop:2 }}>⭐ Favorito</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LISTA COMPLETA ── */}
          {viewMode === "list" && (
            <div style={{ flex:1, overflowY:"auto", padding:"0 12px 20px" }}>
              {loading ? (
                <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)" }}>
                  <div style={{ fontSize:32 }}>🏟️</div>
                  <div style={{ marginTop:8, fontSize:13 }}>Cargando clubs…</div>
                </div>
              ) : filteredList.length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.4)", fontSize:13 }}>
                  {activeFilter === "favoritos" ? "⭐ No tienes favoritos aún" : "No se encontraron clubs"}
                </div>
              ) : (
                <>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", padding:"8px 0 10px", fontWeight:700 }}>
                    {filteredList.length} clubs {activeFilter==="cerca" ? "cerca de ti" : activeFilter==="favoritos" ? "favoritos" : ""}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {filteredList.map((c, idx) => {
                      const clubId = String(c?.id||"");
                      const isFav = favIds.has(clubId);
                      const d = userPos ? haversineKm(userPos, { lat:c.lat, lng:c.lng }) : null;
                      return (
                        <div key={clubId||c.name} className="gpListCard"
                          onClick={() => navigate(`/club/${c.id}?name=${encodeURIComponent(c.name)}`)}
                          style={{ background:"#111", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden", animation:`gpCardIn 0.3s ease ${idx*0.03}s both` }}>
                          <div style={{ display:"flex", gap:0 }}>
                            {/* Foto */}
                            <div style={{ width:80, flexShrink:0, background:"linear-gradient(135deg,#1a2a00,#0a1200)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
                              {c.urlimagen ? <img src={c.urlimagen} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🏟️"}
                            </div>
                            {/* Info */}
                            <div style={{ flex:1, padding:"12px 12px 10px", minWidth:0 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                                <div style={{ fontSize:14, fontWeight:900, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:8 }}>{c.name}</div>
                                <button onClick={e => { e.stopPropagation(); toggleFav(clubId); }}
                                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, flexShrink:0, padding:0 }}>
                                  {isFav ? "⭐" : "☆"}
                                </button>
                              </div>
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:3 }}>
                                📍 {d != null ? `${d.toFixed(1)} km · ` : ""}{c.city}
                              </div>
                              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                                <button onClick={e => { e.stopPropagation(); navigate(`/partidos?clubId=${c.id}`); }}
                                  style={{ padding:"5px 10px", borderRadius:8, background:"rgba(116,184,0,0.15)", border:"1px solid rgba(116,184,0,0.3)", color:"#74B800", fontSize:10, fontWeight:800, cursor:"pointer" }}>
                                  🏓 Partidos
                                </button>
                                <button onClick={e => { e.stopPropagation(); navigate(`/club/${c.id}?name=${encodeURIComponent(c.name)}`); }}
                                  style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:10, fontWeight:800, cursor:"pointer" }}>
                                  Ver club →
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════
          BOTTOM SHEET — CLUB SELECCIONADO
          (estilo Airbnb / Google Maps)
      ══════════════════════════════════════ */}
      {selectedClub && (
        <>
          {/* Overlay tenue */}
          <div onClick={closeSheet}
            style={{ position:"fixed", inset:0, zIndex:800, background:"transparent" }} />

          <div style={{
            position:"fixed", bottom:0, left:0, right:0, zIndex:900,
            background:"#161616", borderRadius:"20px 20px 0 0",
            border:"1px solid rgba(116,184,0,0.2)", borderBottom:"none",
            boxShadow:"0 -12px 40px rgba(0,0,0,0.6)",
            animation:"gpSheetIn 0.3s cubic-bezier(.32,0,.67,0)",
            maxHeight: sheetSnap==="full" ? "85vh" : "auto",
            overflowY: sheetSnap==="full" ? "auto" : "visible",
          }}>
            {/* Handle drag */}
            <div style={{ padding:"12px 0 0", cursor:"pointer" }}
              onClick={() => setSheetSnap(s => s==="peek"?"full":"peek")}>
              <div className="gpSheetHandle" />
            </div>

            <div style={{ padding:"0 16px 28px" }}>
              {/* Header club */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#fff", marginBottom:3 }}>{selectedClub.name}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    {dist != null && <span>📍 {dist.toFixed(1)} km</span>}
                    {selectedClub.city && <span>🏙️ {selectedClub.city}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0, marginLeft:10 }}>
                  <button onClick={() => toggleFav(String(selectedClub.id||""))}
                    style={{ width:38, height:38, borderRadius:10, background: isFavSelected ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.08)", border: isFavSelected ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.1)", fontSize:18, cursor:"pointer", display:"grid", placeItems:"center" }}>
                    {isFavSelected ? "⭐" : "☆"}
                  </button>
                  <button onClick={closeSheet}
                    style={{ width:38, height:38, borderRadius:10, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", fontSize:16, cursor:"pointer", display:"grid", placeItems:"center", color:"rgba(255,255,255,0.5)" }}>✕</button>
                </div>
              </div>

              {/* CTAs principales — los 3 más importantes */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                <button onClick={() => navigate(`/club/${selectedClub.id}?name=${encodeURIComponent(selectedClub.name)}`)}
                  style={{ padding:"12px 6px", borderRadius:12, background:"linear-gradient(135deg,#74B800,#9BE800)", color:"#000", fontWeight:900, border:"none", cursor:"pointer", fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span style={{ fontSize:18 }}>🏟️</span>
                  <span>Ver Club</span>
                </button>
                <button onClick={() => navigate(`/partidos?clubId=${selectedClub.id}&clubName=${encodeURIComponent(selectedClub.name)}`)}
                  style={{ padding:"12px 6px", borderRadius:12, background:"rgba(116,184,0,0.15)", border:"1px solid rgba(116,184,0,0.3)", color:"#74B800", fontWeight:900, cursor:"pointer", fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span style={{ fontSize:18 }}>🏓</span>
                  <span>Partidos</span>
                </button>
                <button onClick={() => navigate(`/partidos?create=1&clubId=${selectedClub.id}&clubName=${encodeURIComponent(selectedClub.name)}`)}
                  style={{ padding:"12px 6px", borderRadius:12, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontWeight:900, cursor:"pointer", fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span style={{ fontSize:18 }}>➕</span>
                  <span>Crear</span>
                </button>
              </div>

              {/* Info extra si snap=full */}
              {sheetSnap === "full" && (
                <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14, display:"flex", flexDirection:"column", gap:10 }}>
                  {selectedClub.address && (
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ fontSize:16 }}>📍</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{selectedClub.address}</span>
                    </div>
                  )}
                  {selectedClub.phone && (
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ fontSize:16 }}>📞</span>
                      <a href={`tel:${selectedClub.phone}`} style={{ fontSize:12, color:"#74B800" }}>{selectedClub.phone}</a>
                    </div>
                  )}
                  {selectedClub.lat && selectedClub.lng && (
                    <a href={`https://maps.google.com/?q=${selectedClub.lat},${selectedClub.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", textDecoration:"none" }}>
                      <span style={{ fontSize:16 }}>🗺️</span>
                      <span style={{ fontSize:12, color:"#74B800", fontWeight:700 }}>Cómo llegar</span>
                      <span style={{ marginLeft:"auto", color:"rgba(255,255,255,0.3)" }}>›</span>
                    </a>
                  )}
                </div>
              )}

              {/* Hint expandir */}
              {sheetSnap === "peek" && (selectedClub.address || selectedClub.phone || selectedClub.lat) && (
                <div style={{ textAlign:"center", fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:4 }}>
                  Toca la barra para ver más info
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {/* ── MODAL CREAR PISTA PRIVADA ── */}
      {showCreateCourt && (
        <div onClick={()=>setShowCreateCourt(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:50000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(640px,100%)",background:"#0f0f0f",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.1)",padding:20,paddingBottom:"max(20px,env(safe-area-inset-bottom))"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:900,color:"#f59e0b"}}>🏠 Nueva pista privada</div>
              <button onClick={()=>setShowCreateCourt(false)} style={{width:30,height:30,borderRadius:999,background:"rgba(255,255,255,0.08)",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <input placeholder="Nombre de la pista (ej: Pista de Ana, Urbanización Condesa…)" value={courtForm.name}
                onChange={e=>setCourtForm(p=>({...p,name:e.target.value}))}
                style={{padding:"11px 12px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:13,outline:"none"}} />
              <div style={{position:"relative"}}>
                <input placeholder="🔍 Busca la dirección (calle, número, ciudad…)" value={courtForm.addressQuery||""}
                  onChange={e=>{
                    const q=e.target.value;
                    setCourtForm(p=>({...p,addressQuery:q,lat:null,lng:null,addressLabel:"",geoResults:[]}));
                    if(geoTimerRef.current) clearTimeout(geoTimerRef.current);
                    if(q.length<3) return;
                    geoTimerRef.current = setTimeout(async()=>{
                      try{
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,{headers:{"Accept-Language":"es"}});
                        const data = await res.json();
                        setCourtForm(p=>({...p,geoResults:data||[]}));
                      }catch{}
                    }, 400);
                  }}
                  style={{width:"100%",padding:"11px 12px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}} />
                {courtForm.geoResults?.length>0 && !courtForm.lat && (
                  <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:9999,background:"#1a1a1a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,overflow:"hidden",marginTop:4}}>
                    {courtForm.geoResults.slice(0,5).map((r,i)=>(
                      <div key={i} onClick={()=>setCourtForm(p=>({...p,lat:parseFloat(r.lat),lng:parseFloat(r.lon),addressLabel:r.display_name,addressQuery:r.display_name,geoResults:[]}))}
                        style={{padding:"10px 12px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:12,color:"#fff",background:"rgba(255,255,255,0.02)"}}>
                        📍 {r.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {courtForm.lat && (
                <div style={{padding:"10px 12px",borderRadius:10,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",fontSize:12,color:"#f59e0b",fontWeight:700}}>
                  ✅ Ubicación seleccionada: {courtForm.addressLabel?.slice(0,60)}…
                </div>
              )}
              <textarea placeholder="Descripción opcional (instrucciones de acceso, pista número…)" value={courtForm.description||""}
                onChange={e=>setCourtForm(p=>({...p,description:e.target.value}))}
                rows={2}
                style={{padding:"11px 12px",borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:13,outline:"none",resize:"none"}} />
              <button disabled={!courtForm.name.trim()||!courtForm.lat||courtSaving}
                onClick={async()=>{
                  if(!courtForm.name.trim()||!courtForm.lat) return;
                  try{
                    setCourtSaving(true);
                    const {data,error} = await supabase.from("private_courts").insert({
                      name: courtForm.name.trim(),
                      description: (courtForm.description||"").trim()||courtForm.addressLabel||null,
                      lat: courtForm.lat,
                      lng: courtForm.lng,
                      is_public: true,
                      owner_id: session?.user?.id,
                    }).select().single();
                    if(error) throw error;
                    setPrivateCourts(prev=>[...prev,data]);
                    setShowCreateCourt(false);
                    setSelectedCourt(data);
                    setCourtForm({name:"",description:"",addressQuery:"",lat:null,lng:null,geoResults:[],addressLabel:""});
                  }catch(e){ alert(e?.message||"Error al crear pista"); }
                  finally{ setCourtSaving(false); }
                }}
                style={{padding:"12px",borderRadius:12,background:courtForm.name.trim()&&courtForm.lat?"linear-gradient(135deg,#f59e0b,#fbbf24)":"rgba(255,255,255,0.08)",border:"none",color:courtForm.name.trim()&&courtForm.lat?"#000":"rgba(255,255,255,0.3)",fontWeight:900,fontSize:14,cursor:courtForm.name.trim()&&courtForm.lat?"pointer":"default"}}>
                {courtSaving?"Creando…":"✅ Crear pista"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET PISTA PRIVADA ── */}
      {selectedCourt && !selectedClub && (
        <>
          <div onClick={()=>setSelectedCourt(null)} style={{position:"fixed",inset:0,zIndex:999}} />
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"min(640px,100%)",zIndex:1000,background:"#111",borderRadius:"18px 18px 0 0",border:"1px solid rgba(245,158,11,0.3)",padding:16,paddingBottom:"max(16px,env(safe-area-inset-bottom))"}}>
            <div style={{width:36,height:4,borderRadius:999,background:"rgba(255,255,255,0.15)",margin:"0 auto 14px"}} />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontSize:17,fontWeight:900,color:"#fff"}}>{selectedCourt.name}</div>
                {selectedCourt.description && <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:3}}>{selectedCourt.description}</div>}
                <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,marginTop:4}}>🏠 Pista privada</div>
              </div>
              <button onClick={()=>setSelectedCourt(null)} style={{width:28,height:28,borderRadius:999,background:"rgba(255,255,255,0.08)",border:"none",color:"#fff",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <button onClick={()=>navigate(`/partidos?create=1&courtId=${selectedCourt.id}&courtName=${encodeURIComponent(selectedCourt.name)}&lat=${selectedCourt.lat}&lng=${selectedCourt.lng}`)}
                style={{padding:"12px 6px",borderRadius:12,background:"linear-gradient(135deg,#74B800,#9BE800)",border:"none",color:"#000",fontWeight:900,cursor:"pointer",fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:20}}>➕</span>
                <span>Crear partido</span>
              </button>
              <button onClick={()=>navigate(`/partidos?courtId=${selectedCourt.id}&courtName=${encodeURIComponent(selectedCourt.name)}`)}
                style={{padding:"12px 6px",borderRadius:12,background:"rgba(116,184,0,0.15)",border:"1px solid rgba(116,184,0,0.3)",color:"#74B800",fontWeight:900,cursor:"pointer",fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:20}}>🏓</span>
                <span>Ver partidos</span>
              </button>
            </div>
            {session && String(selectedCourt.owner_id)===String(session?.user?.id) && (
              <button onClick={async()=>{
                if(!confirm("¿Eliminar esta pista?")) return;
                await supabase.from("private_courts").delete().eq("id",selectedCourt.id);
                setPrivateCourts(prev=>prev.filter(c=>c.id!==selectedCourt.id));
                setSelectedCourt(null);
              }} style={{marginTop:10,width:"100%",padding:"10px",borderRadius:10,background:"rgba(220,38,38,0.12)",border:"1px solid rgba(220,38,38,0.2)",color:"#ff6b6b",fontWeight:900,fontSize:12,cursor:"pointer"}}>
                🗑️ Eliminar pista
              </button>
            )}
          </div>
        </>
      )}

    </div>
  );
}