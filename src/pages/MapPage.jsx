// src/pages/MapPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import gorilaMarker from "../assets/map/marker-gorila.png";
import pelotaTenis from "../assets/map/1.png";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(s1 + Math.cos(lat1) * Math.cos(lat2) * s2));
  return R * c;
}

function normText(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function makeCountIcon(count) {
  // Tamaño dinámico según cantidad
  const size = count > 20 ? 60 : count > 10 ? 54 : 48;
  const fontSize = count > 20 ? 20 : count > 10 ? 18 : 16;
  
  return L.divIcon({
    className: "gpClusterIcon",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 999px;
        background: linear-gradient(135deg, #9BEF00 0%, #74B800 100%);
        border: 3px solid #111;
        display: grid;
        place-items: center;
        box-shadow: 0 12px 30px rgba(0,0,0,0.35);
        position: relative;
      ">
        <div style="
          font-weight: 950;
          font-size: ${fontSize}px;
          color: #111;
          text-shadow: 0 1px 2px rgba(255,255,255,0.4);
        ">${count}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function makeClubIcon({ isFav }) {
  return L.divIcon({
    className: "gpClubIcon",
    html: `
      <div style="
        width: 54px;
        height: 54px;
        position: relative;
        filter: drop-shadow(0 8px 20px rgba(0,0,0,0.4));
      ">
        <img 
          src="${pelotaTenis}" 
          style="
            width: 54px;
            height: 54px;
            object-fit: cover;
            display: block;
          "
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        />
        <div style="
          display: none;
          width: 54px;
          height: 54px;
          border-radius: 999px;
          background: #FFD700;
          border: 3px solid #111;
        "></div>
        
        ${isFav ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            border: 2.5px solid #111;
            font-size: 13px;
            display: grid;
            place-items: center;
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
          ">⭐</div>
        ` : ''}
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
    popupAnchor: [0, -27],
  });
}

function MapEvents({ onZoom, onMove }) {
  useMapEvents({
    zoomend(e) { onZoom?.(e.target.getZoom()); },
    moveend(e) { const c = e.target.getCenter(); onMove?.({ lat: c.lat, lng: c.lng }); },
  });
  return null;
}

function FlyTo({ target, zoomLevel }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], zoomLevel ?? 14, { animate: true, duration: 0.8 });
  }, [target, zoomLevel, map]);
  return null;
}

const userIcon = L.divIcon({
  className: "gpUserIcon",
  html: `<div style="width:34px;height:34px;border-radius:999px;background:#fff;border:2px solid #111;display:grid;place-items:center;font-size:18px;box-shadow:0 14px 30px rgba(0,0,0,0.25);">🍌</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function MapPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(9);
  const [userPos, setUserPos] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [viewMode, setViewMode] = useState(null);
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  
  const [favIds, setFavIds] = useState(() => {
    try {
      const raw = localStorage.getItem("gp_fav_club_ids");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  });

  const mapRef = useRef(null);
  const [flyToPos, setFlyToPos] = useState(null);

  function toggleFav(clubId) {
    const id = String(clubId || "");
    if (!id) return;
    const next = new Set(Array.from(favIds));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavIds(next);
    try {
      localStorage.setItem("gp_fav_club_ids", JSON.stringify(Array.from(next)));
    } catch {}
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await fetchClubsFromGoogleSheet();
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

  const clubsWithCoords = useMemo(() => {
    return (clubs || []).filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng));
  }, [clubs]);

  const suggestions = useMemo(() => {
    const q = normText(query);
    if (!q || q.length < 2) return [];

    return clubsWithCoords
      .filter((c) => normText(c?.name).includes(q) || normText(c?.city).includes(q))
      .slice(0, 8);
  }, [query, clubsWithCoords]);

  const filteredList = useMemo(() => {
    let list = clubsWithCoords;
    
    if (viewMode === "near" && userPos) {
      list = list.filter((c) => haversineKm(userPos, { lat: c.lat, lng: c.lng }) <= 20);
    } else if (viewMode === "fav") {
      list = list.filter((c) => favIds.has(String(c?.id || "")));
    }

    list = [...list].sort((a, b) => {
      const aFav = favIds.has(String(a?.id || "")) ? 1 : 0;
      const bFav = favIds.has(String(b?.id || "")) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      if (userPos) {
        const da = haversineKm(userPos, { lat: a.lat, lng: a.lng });
        const db = haversineKm(userPos, { lat: b.lat, lng: b.lng });
        if (da !== db) return da - db;
      }

      return String(a?.name || "").localeCompare(String(b?.name || ""), "es");
    });

    return list;
  }, [clubsWithCoords, viewMode, userPos, favIds]);

  const defaultCenter = useMemo(() => {
    const c = filteredList[0] || clubsWithCoords[0];
    if (c) return [c.lat, c.lng];
    return [36.7213, -4.4214];
  }, [filteredList, clubsWithCoords]);

  const clusterItems = useMemo(() => {
    const list = viewMode ? filteredList : clubsWithCoords;
    
    console.log("🔍 Zoom actual:", zoom, "Clubs:", list.length); // 👈 DEBUG
    
    // NIVEL 1: Zoom muy alejado (≤9) → UN SOLO CLUSTER
    if (zoom <= 9) {
      if (list.length === 0) return [];
      
      const latSum = list.reduce((sum, c) => sum + c.lat, 0);
      const lngSum = list.reduce((sum, c) => sum + c.lng, 0);
      
      console.log("📍 Mostrando 1 cluster grande"); // 👈 DEBUG
      
      return [{
        type: "cluster",
        key: "all",
        count: list.length,
        lat: latSum / list.length,
        lng: lngSum / list.length,
      }];
    }
    
    // NIVEL 2: Zoom medio (10-11) → CLUSTERS POR CIUDAD
    if (zoom <= 11) {
      const byCity = new Map();
      for (const c of list) {
        const city = String(c.city || "Otros").trim();
        const entry = byCity.get(city) || { key: `city:${city}`, count: 0, latSum: 0, lngSum: 0 };
        entry.count += 1;
        entry.latSum += c.lat;
        entry.lngSum += c.lng;
        byCity.set(city, entry);
      }
      
      const clusters = Array.from(byCity.values()).map((e) => ({
        type: "cluster",
        key: e.key,
        count: e.count,
        lat: e.latSum / e.count,
        lng: e.lngSum / e.count,
      }));
      
      console.log("📍 Mostrando", clusters.length, "clusters por ciudad"); // 👈 DEBUG
      
      return clusters;
    }
    
    // NIVEL 3: Zoom medio-cercano (12-13) → CLUSTERS POR ZONA
    if (zoom <= 13) {
      const step = 0.015;
      const grid = new Map();
  
      for (const c of list) {
        const glat = Math.round(c.lat / step) * step;
        const glng = Math.round(c.lng / step) * step;
        const key = `g:${glat.toFixed(3)}:${glng.toFixed(3)}`;
        const entry = grid.get(key) || { key, count: 0, latSum: 0, lngSum: 0 };
        entry.count += 1;
        entry.latSum += c.lat;
        entry.lngSum += c.lng;
        grid.set(key, entry);
      }
  
      const clusters = Array.from(grid.values()).map((e) => ({
        type: "cluster",
        key: e.key,
        count: e.count,
        lat: e.latSum / e.count,
        lng: e.lngSum / e.count,
      }));
      
      console.log("📍 Mostrando", clusters.length, "clusters por zona"); // 👈 DEBUG
      
      return clusters;
    }
  
    // NIVEL 4: Zoom cercano (14+) → ICONOS INDIVIDUALES
    console.log("📍 Mostrando", list.length, "iconos individuales"); // 👈 DEBUG
    
    return list.map((c) => ({ type: "club", club: c, key: String(c.id || c.name) }));
  }, [viewMode, filteredList, clubsWithCoords, zoom]);
  function requestMyLocation() {
    if (!navigator.geolocation) {
      alert("Este navegador no soporta geolocalización.");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        setFlyToPos(p);
        if (mapRef.current) {
          try {
            mapRef.current.flyTo([p.lat, p.lng], 14, { animate: true, duration: 0.8 });
          } catch {}
        }
        setLocBusy(false);
      },
      () => {
        alert("No pude obtener tu ubicación.");
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }


  function selectClub(club) {
    setQuery(club.name);
    setShowSuggest(false);
    setFlyToPos({ lat: club.lat, lng: club.lng });
    if (mapRef.current) {
      try {
        mapRef.current.flyTo([club.lat, club.lng], 14, { animate: true, duration: 0.8 });
      } catch {}
    }
  }

  return (
    <div className="page gpMapPage">
      <div className="pageWrap">
        <div className="gpMapContainer">
          
          {/* BARRA DE BÚSQUEDA */}
                          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Buscar ciudades, barrios, clubs..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setShowSuggest(true);
                      }}
                      onFocus={() => setShowSuggest(true)}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 999,
                        border: "2px solid rgba(0,0,0,0.15)",
                        background: "#74B800",
                        fontSize: 16,
                        color: "#fff",
                        fontWeight: 900,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                      }}
                    />
                    
                    {showSuggest && suggestions.length > 0 && (
                      <div className="gpSuggest">
                        {suggestions.map((c) => (
                          <button
                            key={c.id || c.name}
                            className="gpSuggestItem"
                            onClick={() => selectClub(c)}
                          >
                            <div style={{ fontWeight: 900 }}>{c.name}</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{c.city}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 999,
                      border: "none",
                      background: "#1DA1F2",
                      color: "#fff",
                      fontSize: 20,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    🐦
                  </button>
                </div>

          {/* MAPA */}
          <div className="gpMapWrapper">
            <MapContainer
              center={defaultCenter}
              zoom={9}
              style={{ height: "100%", width: "100%" }}
              whenCreated={(map) => {
                mapRef.current = map;
                setZoom(map.getZoom());
              }}
            >
              <MapEvents onZoom={(z) => setZoom(z)} onMove={() => {}} />
              
              {/* 👇 REEMPLAZA ESTA LÍNEA */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                maxZoom={19}
              />
                          
              <FlyTo target={flyToPos} zoomLevel={14} />

              {userPos ? (
                <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
                  <Popup>🍌 Estás aquí</Popup>
                </Marker>
              ) : null}

              {clusterItems.map((it) => {
                if (it.type === "cluster") {
                  return (
                    <Marker
                      key={it.key}
                      position={[it.lat, it.lng]}
                      icon={makeCountIcon(it.count)}
                      eventHandlers={{
                        click: () => {
                          if (!mapRef.current) return;
                          mapRef.current.setView([it.lat, it.lng], Math.min(14, zoom + 2));
                        },
                      }}
                    />
                  );
                }

                const c = it.club;
                const clubId = String(c?.id || "");
                const isFav = favIds.has(clubId);

                return (
                  <Marker key={it.key} position={[c.lat, c.lng]} icon={makeClubIcon({ isFav })}>
                    <Popup>
                      <strong>{c.name}</strong>
                      <div>{c.city}</div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* BOTÓN UBICACIÓN (DERECHA) */}
            <button 
              className="gpMapLocBtn" 
              onClick={requestMyLocation} 
              disabled={locBusy}
              title="Mi ubicación"
            >
              🍌
            </button>

            {/* BOTONES RADIO (ABAJO DEL MAPA) */}
            <div className="gpMapRadioBtns">
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode(viewMode === "list" ? null : "list")}
              >
                Ver Lista
              </button>
              <button
                className={viewMode === "near" ? "active" : ""}
                onClick={() => {
                  if (!userPos) requestMyLocation();
                  setViewMode(viewMode === "near" ? null : "near");
                }}
              >
                Cerca de mí 20km
              </button>
              <button
                className={viewMode === "fav" ? "active" : ""}
                onClick={() => setViewMode(viewMode === "fav" ? null : "fav")}
              >
                Favoritos
              </button>
            </div>
          </div>

          {/* LISTA DE CLUBS */}
          {viewMode && (
            <div className="gpClubList">
              {loading ? (
                <div className="gpLoading">Cargando clubs…</div>
              ) : filteredList.length === 0 ? (
                <div className="gpEmpty">
                  {viewMode === "fav" ? "No tienes favoritos aún" : "No se encontraron clubs"}
                </div>
              ) : (
                filteredList.map((c) => {
                  const clubId = String(c?.id || "");
                  const isFav = favIds.has(clubId);
                  const dist = userPos ? haversineKm(userPos, { lat: c.lat, lng: c.lng }) : null;

                  return (
                    <div key={clubId || c.name} className="gpClubCard">
                      <div className="gpClubPhoto">
                        {c.urlimagen ? (
                          <img src={c.urlimagen} alt={c.name} />
                        ) : (
                          <div className="gpClubPhotoPlaceholder">{c.name?.[0]?.toUpperCase() || "?"}</div>
                        )}
                      </div>

                      <div className="gpClubInfo">
                        <h3>{c.name}</h3>
                        <div className="gpClubMeta">
                          📍 {dist != null ? `${dist.toFixed(1)}km` : c.city}
                        </div>
                      </div>

                      <button className="gpClubFavBtn" onClick={() => toggleFav(clubId)}>
                        {isFav ? "⭐" : "☆"}
                      </button>

                      <div className="gpClubActions">
                        <button onClick={() => navigate(`/partidos?clubId=${c.id}`)}>
                          PARTIDOS
                        </button>
                        <button onClick={() => navigate(`/partidos?create=1&clubId=${c.id}`)}>
                          CREAR
                        </button>
                        <button>VER</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}