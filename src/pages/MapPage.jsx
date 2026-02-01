// src/pages/MapPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { fetchMatches, subscribeMatchesRealtime } from "../services/matches";
import gorilaMarker from "../assets/map/marker-gorila.png";
import { supabase } from "../services/supabaseClient";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ✅ Iconos Leaflet compatibles con Vite */
const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();

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
      <div class="gpClusterCircle" style="background:#74B800;">
        <div class="gpClusterNumber">${count}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -14],
  });
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function makeClubIcon({ isFav, hasFreeClass, pulse }) {
  return L.divIcon({
    className: "gpClubIcon",
    html: `
      <div class="gpClubIconWrap ${hasFreeClass ? "free" : "nofree"} ${pulse ? "pulse" : ""}">
        ${isFav ? `<div class="gpFavStar">⭐</div>` : ""}
        ${hasFreeClass ? `<div class="gpFreeDot" title="Clases libres hoy"></div>` : ""}
        <img src="${gorilaMarker}" class="gpClubIconImg" />
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -18],
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

/* ✅ FlyTo controlado por estado (backup) */
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

  const [todayClassesByClub, setTodayClassesByClub] = useState(() => new Map()); // club_id -> { freeCount, totalCount }
  const [mapTheme, setMapTheme] = useState("light"); // "light" | "dark"

  const [matches, setMatches] = useState([]);

  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");

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
  const mapBoxRef = useRef(null); // ✅ para scroll al mapa
  const [flyToPos, setFlyToPos] = useState(null);

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

  async function loadMatches() {
    try {
      const ms = await fetchMatches({ limit: 500 });
      setMatches(Array.isArray(ms) ? ms : []);
    } catch {
      setMatches([]);
    }
  }

  async function loadTodayClasses() {
    try {
      const start = startOfTodayISO();
      const end = endOfTodayISO();
      const nowIso = new Date().toISOString();

      const { data: allRows, error: eAll } = await supabase
        .from("classes")
        .select("club_id")
        .eq("is_cancelled", false)
        .gte("start_at", start)
        .lte("start_at", end)
        .gte("start_at", nowIso);

      if (eAll) throw eAll;

      const { data: freeRows, error: eFree } = await supabase
        .from("classes")
        .select("club_id")
        .eq("is_cancelled", false)
        .eq("is_booked", false)
        .gte("start_at", start)
        .lte("start_at", end)
        .gte("start_at", nowIso);

      if (eFree) throw eFree;

      const map = new Map();

      for (const r of allRows || []) {
        const id = String(r?.club_id || "").trim();
        if (!id) continue;
        const prev = map.get(id) || { totalCount: 0, freeCount: 0 };
        prev.totalCount += 1;
        map.set(id, prev);
      }

      for (const r of freeRows || []) {
        const id = String(r?.club_id || "").trim();
        if (!id) continue;
        const prev = map.get(id) || { totalCount: 0, freeCount: 0 };
        prev.freeCount += 1;
        map.set(id, prev);
      }

      setTodayClassesByClub(map);
    } catch {
      setTodayClassesByClub(new Map());
    }
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

        await loadMatches();
        await loadTodayClasses();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ REALTIME: refrescamos partidos y “clases libres hoy”
  useEffect(() => {
    const unsub = subscribeMatchesRealtime(() => {
      loadMatches();
      loadTodayClasses();
    });

    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clubsWithCoords = useMemo(() => {
    return (clubs || []).filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lng));
  }, [clubs]);

  const baseFiltered = useMemo(() => {
    const q = normText(query);
    let list = clubsWithCoords;

    if (selectedClubId) {
      list = list.filter((c) => String(c?.id || "") === String(selectedClubId));
    } else if (selectedCity) {
      const sel = normText(selectedCity);
      list = list.filter((c) => normText(c?.city) === sel);
    } else if (q) {
      list = list.filter((c) => {
        const name = normText(c?.name);
        const city = normText(c?.city);
        const address = normText(c?.address);
        return name.includes(q) || city.includes(q) || address.includes(q);
      });
    }

    if (favOnly) list = list.filter((c) => favIds.has(String(c?.id || "")));

    if (nearOnly && userPos) {
      list = list.filter((c) => haversineKm(userPos, { lat: c.lat, lng: c.lng }) <= nearKm);
    }

    return list;
  }, [clubsWithCoords, query, selectedClubId, selectedCity, favOnly, favIds, nearOnly, userPos]);

  const sortedList = useMemo(() => {
    const list = [...baseFiltered];

    list.sort((a, b) => {
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
  }, [baseFiltered, favIds, userPos]);

  const defaultCenter = useMemo(() => {
    const c = sortedList[0];
    if (c) return [c.lat, c.lng];
    return [36.7213, -4.4214];
  }, [sortedList]);

  /* ✅ SUGERENCIAS: ciudades + clubs */
  const suggestions = useMemo(() => {
    const q = normText(query);
    if (!q || q.length < 2) return [];

    const cityMap = new Map();
    for (const c of clubsWithCoords) {
      const city = normalizeCity(c.city) || normalizeCity(String(c.address || "").split(",").pop());
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

    if (zoom <= 10) {
      const byCity = new Map();
      for (const c of list) {
        const city = normalizeCity(c.city) || "Otros";
        const key = normText(city) || "otros";
        const entry = byCity.get(key) || { key: `city:${key}`, label: city, count: 0, latSum: 0, lngSum: 0 };
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
        lng: e.lngSum / e.count,
      }));
    }

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
          setFlyToPos(p); // ✅ backup por estado siempre
          if (mapRef.current) {
            try {
              mapRef.current.flyTo([p.lat, p.lng], Math.max(mapRef.current.getZoom(), 14), {
                animate: true,
                duration: 0.8,
              });
            } catch {}
          }
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
    } else {
      setFlyToPos({ lat: 36.7213, lng: -4.4214 });
    }
  }

  // ✅ Helpers: scroll + invalidate + flyTo “seguro”
  function flyToSafe(lat, lng, z = 14) {
    setFlyToPos({ lat, lng }); // ✅ backup siempre

    // scroll suave al mapa (por si estás abajo en la lista)
    if (mapBoxRef.current) {
      mapBoxRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // invalidar tamaño (por si el scroll/móvil altera el layout)
    setTimeout(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch {}
      try {
        mapRef.current?.flyTo([lat, lng], z, { duration: 0.8 });
      } catch {}
    }, 120);
  }

  function centerByCity(cityName) {
    const sel = normText(cityName);
    const inCity = clubsWithCoords.filter((c) => normText(c.city) === sel);
    if (!inCity.length) return false;

    const lat = inCity.reduce((s, x) => s + x.lat, 0) / inCity.length;
    const lng = inCity.reduce((s, x) => s + x.lng, 0) / inCity.length;
    flyToSafe(lat, lng, 12);
    return true;
  }

  // ✅ ARREGLADO: Buscar SIEMPRE centra algo útil
  function doSearchCenter() {
    setShowSuggest(false);

    // 1) club seleccionado
    if (selectedClubId) {
      const c = clubsWithCoords.find((x) => String(x.id || "") === String(selectedClubId));
      if (c) flyToSafe(c.lat, c.lng, 14);
      return;
    }

    // 2) ciudad seleccionada
    if (selectedCity) {
      if (centerByCity(selectedCity)) return;
    }

    // 3) si hay query: usa sugerencia top si existe
    const q = normText(query);
    if (q && q.length >= 2) {
      const top = suggestions?.[0];

      if (top?.type === "club") {
        setSelectedClubId(top.clubId);
        setSelectedCity("");
        flyToSafe(top.lat, top.lng, 14);
        return;
      }

      if (top?.type === "city") {
        setSelectedCity(top.city);
        setSelectedClubId("");
        if (centerByCity(top.city)) return;
      }

      // 4) fallback: primer match por includes
      const hit = clubsWithCoords.find((c) => {
        const name = normText(c?.name);
        const city = normText(c?.city);
        const address = normText(c?.address);
        return name.includes(q) || city.includes(q) || address.includes(q);
      });

      if (hit) {
        setSelectedClubId(String(hit.id || ""));
        setSelectedCity("");
        flyToSafe(hit.lat, hit.lng, 14);
        return;
      }
    }

    // 5) si hay lista filtrada, centra el primero
    const first = baseFiltered?.[0] || sortedList?.[0];
    if (first) {
      flyToSafe(first.lat, first.lng, 13);
      return;
    }

    // 6) fallback default
    flyToSafe(36.7213, -4.4214, 11);
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
    <div className="page gpMapPage">
      <div className="pageWrap">
        <div className="container">
          {/* HEADER */}
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Mapa</h1>
              <div className="pageMeta">
                {loading ? "Cargando…" : `Clubs: ${sortedList.length}`}
                {userPos ? " · ordenados por cercanía" : ""}
              </div>
            </div>
          </div>

          {/* TOP BAR */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn ghost gpMapBtn" type="button" onClick={clearAll}>
              Limpiar
            </button>

            <button className="btn gpMapBtn" type="button" onClick={doSearchCenter} disabled={loading}>
              Buscar
            </button>

            <button
              className={`btn ${mapTheme === "dark" ? "" : "ghost"} gpMapBtn`}
              type="button"
              onClick={() => setMapTheme((v) => (v === "dark" ? "light" : "dark"))}
            >
              {mapTheme === "dark" ? "🌙 Oscuro" : "☀️ Claro"}
            </button>

            <button
              className="btn ghost gpMapBtn"
              type="button"
              onClick={() => requestMyLocation({ centerMap: true })}
              disabled={locBusy}
              title="Te centra en el mapa y deja un marcador"
            >
              {locBusy ? "Ubicando…" : "📍 Mi ubicación"}
            </button>

            <button
              type="button"
              className={`gpChipBtn ${nearOnly ? "isOn" : ""}`}
              onClick={() => {
                if (!userPos) requestMyLocation({ centerMap: false });
                setNearOnly((v) => !v);
              }}
              title="Filtra clubs a 20 km de tu ubicación"
            >
              <span className="gpChipIcon" aria-hidden="true">📍</span>
              <span className="gpChipText">Cerca de mí {nearKm} km</span>
              <span className="gpChipDot" aria-hidden="true" />
            </button>

            <button
              type="button"
              className={`gpChipBtn ${favOnly ? "isOn" : ""}`}
              onClick={() => setFavOnly((v) => !v)}
              title="Mostrar solo mis clubs favoritos"
            >
              <span className="gpChipIcon" aria-hidden="true">{favOnly ? "⭐" : "☆"}</span>
              <span className="gpChipText">Favoritos{favIds.size ? ` (${favIds.size})` : ""}</span>
              <span className="gpChipDot" aria-hidden="true" />
            </button>
          </div>

          {/* BUSCADOR + AUTOCOMPLETE */}
          <div style={{ position: "relative", marginTop: 10 }}>
            <input
              className="gpInput"
              value={query}
              placeholder="Escribe una ciudad o un club…"
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setSelectedClubId("");
                setSelectedCity("");
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearchCenter();
              }}
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
                        flyToSafe(s.lat, s.lng, 14);
                      } else {
                        setQuery(s.city);
                        setSelectedCity(s.city);
                        setSelectedClubId("");
                        setShowSuggest(false);
                        centerByCity(s.city);
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

          {/* MAPA */}
          <div
              ref={mapBoxRef}
              className="gpMapMapWrap"
              style={{
                marginTop: 12,
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid #eee",
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
              }}
            >
              <MapEvents onZoom={(z) => setZoom(z)} onMove={(c) => setMapCenter(c)} onClick={() => setShowSuggest(false)} />

              <TileLayer
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                url={
                  mapTheme === "dark"
                    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                }
              />

              {/* ✅ flyTo backup por estado */}
              <FlyTo target={flyToPos} zoomLevel={14} />

              {/* ✅ mi ubicación visible */}
              {userPos ? (
                <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
                  <Popup>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Estás aquí</div>
                  </Popup>
                </Marker>
              ) : null}

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

                const stats = todayClassesByClub.get(clubId) || { freeCount: 0, totalCount: 0 };
                const hasFreeClass = (stats.freeCount || 0) > 0;
                const pulse = hasFreeClass;

                const dist = userPos ? haversineKm(userPos, { lat: c.lat, lng: c.lng }) : null;
                const up = upcomingByClubId.get(clubId) || [];

                return (
                  <Marker key={it.key} position={[c.lat, c.lng]} icon={makeClubIcon({ isFav, hasFreeClass, pulse })}>
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 220 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <strong>{c.name}</strong>
                            <div style={{ opacity: 0.75 }}>{c.city}</div>

                            {hasFreeClass ? (
                              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#111" }}>
                                🟢 {stats.freeCount} clase(s) libre(s) hoy
                              </div>
                            ) : null}

                            {c.address ? <div style={{ opacity: 0.65, marginTop: 4 }}>{c.address}</div> : null}

                            {dist != null ? (
                              <div style={{ opacity: 0.7, marginTop: 6 }}>A {dist.toFixed(1)} km de ti</div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => toggleFav(clubId)}
                            title={isFav ? "Quitar favorito" : "Guardar favorito"}
                            style={{
                              width: 42,
                              height: 38,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: 12,
                              alignSelf: "flex-start",
                            }}
                          >
                            {isFav ? "⭐" : "☆"}
                          </button>
                        </div>

                        {/* 3 próximos partidos */}
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
                                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                                    {new Date(m.start_at).toLocaleString("es-ES")}
                                  </div>
                                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {m.duration_min} min · Nivel {m.level}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="gpPopupActions">
                          <button
                            className="gpBtn gpBtnSoft"
                            onClick={() => navigate(`/clases?club=${clubId}&clubName=${encodeURIComponent(c.name)}`)}
                          >
                            Ver clases
                          </button>

                          <button
                            className="gpBtn"
                            onClick={() => navigate(`/partidos?clubId=${clubId}&clubName=${encodeURIComponent(c.name)}`)}
                          >
                            Ver partidos
                          </button>

                          <button
                            className="gpBtn gpBtnPrimary"
                            onClick={() => navigate(`/partidos?create=1&clubId=${clubId}&clubName=${encodeURIComponent(c.name)}`)}
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

          {/* LISTA (panel con scroll interno) */}
<div
  className="gpMapListPanel"
  style={{
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
    overflow: "hidden",
  }}
>
  <div className="gpMapListHeader" style={{
      padding: 12,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      fontWeight: 950,
    }}
  >
    Clubs ({sortedList.length})
  </div>

  <div
    className="gpMapListBody"
    style={{
      overflowY: "auto",
      padding: 12,
      display: "grid",
      gap: 10,
      WebkitOverflowScrolling: "touch",
    }}
  >
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
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => toggleFav(clubId)}
                title={isFav ? "Quitar favorito" : "Guardar favorito"}
                style={{ height: 34, minWidth: 44, padding: "0 12px" }}
              >
                {isFav ? "⭐" : "☆"}
              </button>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    opacity: 0.75,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.city}
                  {dist != null ? ` · ${dist.toFixed(1)} km` : ""}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  navigate(
                    `/partidos?clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`
                  )
                }
              >
                Partidos
              </button>

              <button
                className="btn"
                type="button"
                onClick={() =>
                  navigate(
                    `/partidos?create=1&clubId=${encodeURIComponent(c.id)}&clubName=${encodeURIComponent(c.name)}`
                  )
                }
              >
                Crear
              </button>

              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  flyToSafe(c.lat, c.lng, 14);
                }}
              >
                Ver
              </button>
            </div>
          </div>
        );
      })
    )}
  </div>
</div>


          <div style={{ marginTop: 18, opacity: 0.5, fontSize: 12 }}>
            ruta: {location.pathname} · zoom: {zoom} · centro: {mapCenter.lat.toFixed(3)},{mapCenter.lng.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}
