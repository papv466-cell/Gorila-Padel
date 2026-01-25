// src/pages/MapPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { fetchMatches } from "../services/matches";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ✅ Iconos Leaflet compatibles con Vite */
const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();
const [flyToPos, setFlyToPos] = useState(null);

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

/* Utils */
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

function makeCountIcon(count) {
  return L.divIcon({
    className: "gpClusterIcon",
    html: `
      <div style="
        width: 38px; height: 38px;
        border-radius: 999px;
        display:flex; align-items:center; justify-content:center;
        border:2px solid #111;
        background:#fff;
        font-weight:900;
        font-size:14px;
        box-shadow:0 10px 25px rgba(0,0,0,0.18);
      ">${count}</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -14],
  });
}

function normalizeCity(s) {
  return String(s || "").trim();
}

// ✅ para buscar sin tildes (Málaga = malaga)
function normText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* Controla zoom/centro desde eventos del mapa */
function MapEvents({ onZoom, onMove, onClick }) {
  useMapEvents({
    zoomend(e) {
      onZoom?.(e.target.getZoom());
    },
    moveend(e) {
      const c = e.target.getCenter();
      onMove?.({ lat: c.lat, lng: c.lng });
    },
    click(e) {
      onClick?.(e);
    },
  });
  return null;
}

function FlyTo({ target, zoomLevel }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], zoomLevel ?? Math.max(map.getZoom(), 14), {
      animate: true,
      duration: 0.8,
    });
  }, [target, zoomLevel, map]);

  return null;
}

/* ✅ icono “mi ubicación” */
const userIcon = L.divIcon({
  className: "gpUserIcon",
  html: `
    <div style="
      width:18px;height:18px;border-radius:999px;
      background:#111;
      border:3px solid #fff;
      box-shadow:0 10px 25px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [matches, setMatches] = useState([]);

  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedCity, setSelectedCity] = useState(""); // ✅ ciudad exacta elegida
  const [selectedClubId, setSelectedClubId] = useState(""); // ✅ club exacto elegido

  const [zoom, setZoom] = useState(11);
  const [mapCenter, setMapCenter] = useState({ lat: 36.7213, lng: -4.4214 }); // Málaga

  const [userPos, setUserPos] = useState(null);
  const [locBusy, setLocBusy] = useState(false);

  const [nearOnly, setNearOnly] = useState(false);
  const nearKm = 20;

  const [favOnly, setFavOnly] = useState(false);
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
  const [pendingFlyTo, setPendingFlyTo] = useState(null);

  function persistFav(nextSet) {
    try {
      localStorage.setItem("gp_fav_club_ids", JSON.stringify(Array.from(nextSet)));
    } catch {}
  }

  function toggleFav(clubId) {
    const id = String(clubId || "");
    if (!id) return;
    const next = new Set(Array.from(favIds));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavIds(next);
    persistFav(next);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const rows = await fetchClubsFromGoogleSheet();
        if (!alive) return;
        setClubs(Array.isArray(rows) ? rows : []);

        // partidos (para enseñar los 3 próximos en popup)
        try {
          const ms = await fetchMatches({ limit: 500 });
          if (!alive) return;
          setMatches(Array.isArray(ms) ? ms : []);
        } catch {
          if (!alive) return;
          setMatches([]);
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Error cargando clubs");
        setClubs([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const clubsWithCoords = useMemo(() => {
    return (clubs || []).filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng));
  }, [clubs]);

  // ✅ filtro base (club exacto / ciudad exacta / texto libre)
  const baseFiltered = useMemo(() => {
    const q = normText(query);

    let list = clubsWithCoords;

    // ✅ si eligió club exacto desde sugerencias
    if (selectedClubId) {
      list = list.filter((c) => String(c?.id || "") === String(selectedClubId));
    }
    // ✅ si eligió ciudad exacta desde sugerencias
    else if (selectedCity) {
      const sel = normText(selectedCity);
      list = list.filter((c) => normText(c?.city) === sel);
    }
    // ✅ texto libre: busca en club/ciudad/dirección
    else if (q) {
      list = list.filter((c) => {
        const name = normText(c?.name);
        const city = normText(c?.city);
        const address = normText(c?.address);
        return name.includes(q) || city.includes(q) || address.includes(q);
      });
    }

    // solo favoritos
    if (favOnly) {
      list = list.filter((c) => favIds.has(String(c?.id || "")));
    }

    // cerca de mí
    if (nearOnly && userPos) {
      list = list.filter((c) => haversineKm(userPos, { lat: c.lat, lng: c.lng }) <= nearKm);
    }

    return list;
  }, [clubsWithCoords, query, selectedClubId, selectedCity, favOnly, favIds, nearOnly, userPos]);

  const sortedList = useMemo(() => {
    const list = [...baseFiltered];

    // favoritos primero
    list.sort((a, b) => {
      const aFav = favIds.has(String(a?.id || "")) ? 1 : 0;
      const bFav = favIds.has(String(b?.id || "")) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      // por distancia si hay userPos
      if (userPos) {
        const da = haversineKm(userPos, { lat: a.lat, lng: a.lng });
        const db = haversineKm(userPos, { lat: b.lat, lng: b.lng });
        if (da !== db) return da - db;
      }

      return String(a?.name || "").localeCompare(String(b?.name || ""), "es");
    });

    return list;
  }, [baseFiltered, favIds, userPos]);

  const defaultCenter = useMemo(() => {
    const c = sortedList[0];
    if (c) return [c.lat, c.lng];
    return [36.7213, -4.4214];
  }, [sortedList]);

  /* ✅ SUGERENCIAS: ciudades + clubs (con normText) */
  const suggestions = useMemo(() => {
    const q = normText(query);
    if (!q || q.length < 2) return [];

    // ciudades únicas
    const cityMap = new Map();
    for (const c of clubsWithCoords) {
      const city =
  normalizeCity(c.city) ||
  normalizeCity(String(c.address || "").split(",").pop()); // ✅ intenta sacar “ciudad” del address
      if (!city) continue;
      const key = normText(city);
      if (!cityMap.has(key)) cityMap.set(key, { type: "city", label: city, city });
    }

    const cities = Array.from(cityMap.values())
      .filter((x) => normText(x.label).includes(q))
      .slice(0, 6);

    const clubsS = clubsWithCoords
      .filter((c) => normText(c?.name).includes(q))
      .slice(0, 8)
      .map((c) => ({
        type: "club",
        label: `${c.name}${c.city ? ` · ${c.city}` : ""}`,
        clubId: String(c.id || ""),
        lat: c.lat,
        lng: c.lng,
        name: c.name,
      }));

    return [...cities, ...clubsS].slice(0, 10);
  }, [query, clubsWithCoords]);

  /* ✅ clustering */
  const clusterItems = useMemo(() => {
    const list = sortedList;

    // Tier 1: por ciudad
    if (zoom <= 10) {
      const byCity = new Map();
      for (const c of list) {
        const city = normalizeCity(c.city) || "Otros";
        const key = normText(city) || "otros";
        const entry =
          byCity.get(key) || { key: `city:${key}`, label: city, count: 0, latSum: 0, lngSum: 0 };
        entry.count += 1;
        entry.latSum += c.lat;
        entry.lngSum += c.lng;
        byCity.set(key, entry);
      }
      return Array.from(byCity.values()).map((e) => ({
        type: "cluster",
        key: e.key,
        label: e.label,
        count: e.count,
        lat: e.latSum / e.count,
        lng: e.lngSum / e.count,
      }));
    }

    // Tier 2: grid
    if (zoom <= 12) {
      const step = 0.05;
      const grid = new Map();

      for (const c of list) {
        const glat = Math.round(c.lat / step) * step;
        const glng = Math.round(c.lng / step) * step;
        const key = `g:${glat.toFixed(2)}:${glng.toFixed(2)}`;
        const entry = grid.get(key) || { key, count: 0, latSum: 0, lngSum: 0 };
        entry.count += 1;
        entry.latSum += c.lat;
        entry.lngSum += c.lng;
        grid.set(key, entry);
      }

      return Array.from(grid.values()).map((e) => ({
        type: "cluster",
        key: e.key,
        label: "Zona",
        count: e.count,
        lat: e.latSum / e.count,
        lng: e.latSum && e.count ? e.lngSum / e.count : 0,
      }));
    }

    // Tier 3: clubes
    return list.map((c) => ({ type: "club", club: c, key: String(c.id || c.name) }));
  }, [sortedList, zoom]);

  function requestMyLocation({ centerMap = true } = {}) {
    if (!navigator.geolocation) {
      alert("Este navegador no soporta geolocalización.");
      return;
    }
    setLocBusy(true);
  
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
  
        if (centerMap) {
          setFlyToPos(p); // ✅ esto hace zoom seguro
        }
  
        setLocBusy(false);
      },
      (e) => {
        console.error(e);
        alert("No pude obtener tu ubicación. Revisa permisos del navegador.");
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }
  

  function clearAll() {
    setQuery("");
    setSelectedClubId("");
    setSelectedCity("");
    setShowSuggest(false);
    setNearOnly(false);
    setFavOnly(false);

    if (mapRef.current) {
      mapRef.current.setView(defaultCenter, 11);
    }
  }

  function doSearchCenter() {
    if (!mapRef.current) return;

    // club exacto
    if (selectedClubId) {
      const c = clubsWithCoords.find((x) => String(x.id || "") === String(selectedClubId));
      if (c) mapRef.current.setView([c.lat, c.lng], 14);
      return;
    }

    // ciudad exacta
    if (selectedCity) {
      const sel = normText(selectedCity);
      const inCity = clubsWithCoords.filter((c) => normText(c.city) === sel);
      if (inCity.length) {
        const lat = inCity.reduce((s, x) => s + x.lat, 0) / inCity.length;
        const lng = inCity.reduce((s, x) => s + x.lng, 0) / inCity.length;
        mapRef.current.setView([lat, lng], 12);
        return;
      }
    }

    // ✅ si el texto coincide con alguna ciudad exacta
const q = normText(query);
if (q) {
  const inCity = clubsWithCoords.filter((c) => normText(c.city) === q);
  if (inCity.length) {
    const lat = inCity.reduce((s, x) => s + x.lat, 0) / inCity.length;
    const lng = inCity.reduce((s, x) => s + x.lng, 0) / inCity.length;
    mapRef.current.setView([lat, lng], 12);
    return;
  }
}

    // fallback al primer resultado
    const first = sortedList[0];
    if (first) mapRef.current.setView([first.lat, first.lng], 13);
  }

  const upcomingByClubId = useMemo(() => {
    const now = Date.now();
    const map = new Map();
    for (const m of matches || []) {
      const clubId = String(m.club_id || "");
      if (!clubId) continue;
      const t = new Date(m.start_at).getTime();
      if (!Number.isFinite(t) || t < now) continue;
      if (!map.has(clubId)) map.set(clubId, []);
      map.get(clubId).push(m);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      map.set(k, arr.slice(0, 3));
    }
    return map;
  }, [matches]);

  return (
    <div className="page">
      <div className="pageWrap">
        <div className="container">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Mapa</h1>
              <div className="pageMeta">
                {loading ? "Cargando…" : `Clubs: ${sortedList.length}`}
                {userPos ? " · ordenados por cercanía" : ""}
              </div>
            </div>
          </div>

          {/* ✅ TOP BAR BOTONES */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn ghost" type="button" onClick={clearAll}>
              Limpiar
            </button>

            <button className="btn" type="button" onClick={doSearchCenter} disabled={loading}>
              Buscar
            </button>

            <button
              className="btn ghost"
              type="button"
              onClick={() => requestMyLocation({ centerMap: true })}
              disabled={locBusy}
              title="Te centra en el mapa y deja un marcador"
            >
              {locBusy ? "Ubicando…" : "📍 Mi ubicación"}
            </button>

            <button
              className={`btn ${nearOnly ? "" : "ghost"}`}
              type="button"
              onClick={() => {
                if (!userPos) requestMyLocation({ centerMap: false });
                setNearOnly((v) => !v);
              }}
              title="Filtra clubs a 20 km de tu ubicación"
            >
              Cerca de mí {nearKm} km
            </button>

            <button className={`btn ${favOnly ? "" : "ghost"}`} type="button" onClick={() => setFavOnly((v) => !v)}>
              ⭐ Favoritos
            </button>
          </div>

          {/* ✅ BUSCADOR + AUTOCOMPLETE */}
          <div style={{ position: "relative", marginTop: 10 }}>
            <input
              className="gpInput"
              value={query}
              placeholder="Escribe una ciudad o un club…"
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setSelectedClubId("");
                setSelectedCity(""); // ✅ si escribo, quito selección exacta
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
            />

            {showSuggest && suggestions.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                  zIndex: 9999,
                }}
              >
                {suggestions.map((s, idx) => (
                  <button
                    key={`${s.type}-${s.label}-${idx}`}
                    type="button"
                    className="gpSuggestItem"
                    onClick={() => {
                      if (s.type === "club") {
                        setQuery(s.label);
                        setSelectedClubId(s.clubId);
                        setSelectedCity("");
                        setShowSuggest(false);
                        if (mapRef.current) mapRef.current.setView([s.lat, s.lng], 14);
                      } else {
                        setQuery(s.city);
                        setSelectedCity(s.city);
                        setSelectedClubId("");
                        setShowSuggest(false);

                        const sel = normText(s.city);
                        const inCity = clubsWithCoords.filter((c) => normText(c.city) === sel);
                        if (inCity.length && mapRef.current) {
                          const lat = inCity.reduce((sum, x) => sum + x.lat, 0) / inCity.length;
                          const lng = inCity.reduce((sum, x) => sum + x.lng, 0) / inCity.length;
                          mapRef.current.setView([lat, lng], 12);
                        }
                      }
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "0",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {s.label}
                      <span style={{ marginLeft: 8, fontWeight: 700, opacity: 0.55, fontSize: 12 }}>
                        {s.type === "city" ? "Ciudad" : "Club"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {err ? <div style={{ marginTop: 10, color: "crimson" }}>{err}</div> : null}

          {/* ✅ MAPA */}
          <div
            style={{
              marginTop: 12,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid #eee",
              height: 420,
            }}
          >
            <MapContainer
              center={defaultCenter}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              whenCreated={(map) => {
                mapRef.current = map;
                setZoom(map.getZoom());
                const c = map.getCenter();
                setMapCenter({ lat: c.lat, lng: c.lng });
                if (pendingFlyTo) {
                  map.flyTo(pendingFlyTo.center, pendingFlyTo.zoom, { duration: 0.8 });
                  setPendingFlyTo(null);
                }
              }}
            >
              <MapEvents onZoom={(z) => setZoom(z)} onMove={(c) => setMapCenter(c)} onClick={() => setShowSuggest(false)} />

              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* ✅ mi ubicación visible */}
              {userPos ? (
                <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
                  <Popup>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Estás aquí</div>
                  </Popup>
                </Marker>
              ) : null}
                <FlyTo target={flyToPos} zoomLevel={14} />
              {/* clusters + clubs */}
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
                          const nextZoom = Math.min(14, zoom + 2);
                          mapRef.current.setView([it.lat, it.lng], nextZoom);
                        },
                      }}
                    />
                  );
                }

                const c = it.club;
                const clubId = String(c?.id || "");
                const isFav = favIds.has(clubId);
                const dist = userPos ? haversineKm(userPos, { lat: c.lat, lng: c.lng }) : null;
                const up = upcomingByClubId.get(clubId) || [];

                return (
                  <Marker key={it.key} position={[c.lat, c.lng]}>
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 220 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <strong>{c.name}</strong>
                            <div style={{ opacity: 0.75 }}>{c.city}</div>
                            {c.address ? <div style={{ opacity: 0.65, marginTop: 4 }}>{c.address}</div> : null}
                            {dist != null ? <div style={{ opacity: 0.7, marginTop: 6 }}>A {dist.toFixed(1)} km de ti</div> : null}
                          </div>

                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => toggleFav(clubId)}
                            title={isFav ? "Quitar favorito" : "Guardar favorito"}
                            style={{ height: 34, alignSelf: "flex-start" }}
                          >
                            {isFav ? "⭐" : "☆"}
                          </button>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Próximos partidos</div>
                          {up.length === 0 ? (
                            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>(No hay partidos próximos todavía)</div>
                          ) : (
                            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                              {up.map((m) => (
                                <div
                                  key={m.id}
                                  style={{
                                    border: "1px solid rgba(0,0,0,0.08)",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 800 }}>{new Date(m.start_at).toLocaleString("es-ES")}</div>
                                  <div style={{ fontSize: 12, opacity: 0.75 }}>{m.duration_min} min · Nivel {m.level}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={() => navigate(`/partidos?clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`)}
                          >
                            Ver partidos
                          </button>

                          <button
                            className="btn"
                            type="button"
                            onClick={() => navigate(`/partidos?create=1&clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`)}
                          >
                            Crear partido
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* ✅ LISTA PRO */}
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Cargando clubs…</div>
            ) : sortedList.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No se encontraron clubs.</div>
            ) : (
              sortedList.map((c) => {
                const clubId = String(c?.id || "");
                const isFav = favIds.has(clubId);
                const dist = userPos ? haversineKm(userPos, { lat: c.lat, lng: c.lng }) : null;

                return (
                  <div
                    key={clubId || c.name}
                    className="card"
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.08)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => toggleFav(clubId)}
                        title={isFav ? "Quitar favorito" : "Guardar favorito"}
                        style={{ width: 42, height: 38, display: "grid", placeItems: "center", borderRadius: 12 }}
                      >
                        {isFav ? "⭐" : "☆"}
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.name}
                        </div>
                        <div style={{ opacity: 0.75, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.city}
                          {dist != null ? ` · ${dist.toFixed(1)} km` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => navigate(`/partidos?clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`)}
                      >
                        Ver partidos
                      </button>

                      <button
                        className="btn"
                        type="button"
                        onClick={() => navigate(`/partidos?create=1&clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`)}
                      >
                        Crear partido
                      </button>

                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          if (mapRef.current) mapRef.current.setView([c.lat, c.lng], 14);
                        }}
                      >
                        Ver en mapa
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: 18, opacity: 0.5, fontSize: 12 }}>
            ruta: {location.pathname} · zoom: {zoom} · centro: {mapCenter.lat.toFixed(3)},{mapCenter.lng.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}
