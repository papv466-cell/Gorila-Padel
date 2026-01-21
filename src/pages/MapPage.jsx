import { useEffect, useState } from "react";

import MapView from "../components/Map/MapView";
import ClubList from "../components/UI/ClubList";
import SearchBox from "../components/UI/SearchBox";

import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { getCurrentPosition } from "../services/location";
import { geocodeNominatim } from "../services/geocode";

const SHEET_ID = "1d5wDnfeqedHMWF4hdBBoeAUf0KqwZrEOJ8k-6i8Fj0o";
const GID = 0;

const NEAR_ME_KM = 20;

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(a.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeClub(raw, idx) {
  const name = String(raw?.name ?? raw?.club ?? raw?.nombre ?? "Club").trim();
  const city = String(raw?.city ?? raw?.ciudad ?? "").trim();

  const lat =
    toNum(raw?.lat) ??
    toNum(raw?.latitude) ??
    toNum(raw?.Lat) ??
    toNum(raw?.LAT) ??
    null;

  const lng =
    toNum(raw?.lng) ??
    toNum(raw?.lon) ??
    toNum(raw?.long) ??
    toNum(raw?.longitude) ??
    toNum(raw?.Lng) ??
    toNum(raw?.LNG) ??
    null;

  const baseId = raw?.id ?? raw?.clubId ?? raw?.club_id ?? raw?.ID ?? raw?.Id ?? null;

  const id =
    baseId != null && String(baseId).trim() !== ""
      ? String(baseId).trim()
      : `${name}-${lat ?? "x"}-${lng ?? "y"}-${idx}`;

  return {
    ...raw,
    id: String(id),
    name,
    city,
    lat,
    lng,
  };
}

export default function MapPage() {
  const [clubs, setClubs] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [homeRequestId, setHomeRequestId] = useState(0);

  const [cityFilter, setCityFilter] = useState(() => {
    try {
      return localStorage.getItem("gp:cityFilter") ?? "";
    } catch {
      return "";
    }
  });

  const [nearMeOnly, setNearMeOnly] = useState(() => {
    try {
      return localStorage.getItem("gp:nearMeOnly") === "1";
    } catch {
      return false;
    }
  });

  const [focusedClub, setFocusedClub] = useState(null);

  const [userLocation, setUserLocation] = useState(null);
  const [locStatus, setLocStatus] = useState({ loading: false, error: null });

  const [searchLocation, setSearchLocation] = useState(null);
  const [searchStatus, setSearchStatus] = useState({ loading: false, error: null });
  const [searchResults, setSearchResults] = useState([]);

  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const raw = localStorage.getItem("gp:favorites");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  });

  const [favoritesOnly, setFavoritesOnly] = useState(() => {
    try {
      return localStorage.getItem("gp:favoritesOnly") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus({ loading: true, error: null });

        const raw = await fetchClubsFromGoogleSheet({ sheetId: SHEET_ID, gid: GID });
        const arr = Array.isArray(raw) ? raw : [];

        const normalized = arr
          .map((c, i) => normalizeClub(c, i))
          .filter((c) => c.lat != null && c.lng != null);

        if (!cancelled) {
          setClubs(normalized);
          setStatus({
            loading: false,
            error:
              normalized.length === 0
                ? "No llegaron clubs con lat/lng válidos desde la Sheet."
                : null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setClubs([]);
          setStatus({ loading: false, error: e?.message ?? "Error cargando clubs" });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("gp:favorites", JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  useEffect(() => {
    localStorage.setItem("gp:cityFilter", cityFilter);
  }, [cityFilter]);

  useEffect(() => {
    localStorage.setItem("gp:nearMeOnly", nearMeOnly ? "1" : "0");
  }, [nearMeOnly]);

  useEffect(() => {
    localStorage.setItem("gp:favoritesOnly", favoritesOnly ? "1" : "0");
  }, [favoritesOnly]);

  useEffect(() => {
    if (favoritesOnly && favoriteIds.size === 0) {
      setFavoritesOnly(false);
      try {
        localStorage.setItem("gp:favoritesOnly", "0");
      } catch {}
    }
  }, [favoritesOnly, favoriteIds]);

  async function handleUseMyLocation() {
    try {
      setLocStatus({ loading: true, error: null });

      const pos = await getCurrentPosition();
      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };

      setFocusedClub(null);
      setSearchLocation(null);
      setUserLocation(loc);

      setLocStatus({ loading: false, error: null });
    } catch (e) {
      setLocStatus({ loading: false, error: e?.message ?? "Error obteniendo ubicación" });
    }
  }

  async function handleSearchPlace(text) {
    const q = String(text ?? "").trim();
    if (!q) return;

    try {
      setSearchStatus({ loading: true, error: null });

      const results = await geocodeNominatim(q, { limit: 5 });
      setSearchResults(results);

      if (results.length === 0) {
        setSearchLocation(null);
        setSearchStatus({ loading: false, error: "No he encontrado resultados." });
        return;
      }

      if (results.length === 1) {
        setFocusedClub(null);
        setUserLocation(null);
        setSearchLocation(results[0]);
        setSearchResults([]);
      }

      setSearchStatus({ loading: false, error: null });
    } catch (e) {
      setSearchStatus({ loading: false, error: e?.message ?? "Error buscando ubicación" });
    }
  }

  function handlePickSearchResult(result) {
    setFocusedClub(null);
    setUserLocation(null);
    setSearchLocation(result);
    setSearchResults([]);
  }

  function handleClearSearch() {
    setSearchLocation(null);
    setSearchResults([]);
    setSearchStatus({ loading: false, error: null });
  }

  function handleClearSearchResults() {
    setSearchResults([]);
    setSearchStatus({ loading: false, error: null });
  }

  function handleGoHome() {
    setSearchLocation(null);
    setUserLocation(null);
    setFocusedClub(null);
    setHomeRequestId((n) => n + 1);
  }

  function toggleFavorite(clubId) {
    const id = String(clubId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const cities = Array.from(
    new Set(clubs.map((c) => (c.city ?? "").trim()).filter((c) => c.length > 0))
  ).sort((a, b) => a.localeCompare(b, "es"));

  const clubsByCity = cityFilter
    ? clubs.filter((c) => String(c.city ?? "").trim() === cityFilter)
    : clubs;

  const clubsByNearMe = (() => {
    if (!nearMeOnly) return clubsByCity;
    if (!userLocation) return clubsByCity;
    const origin = { lat: userLocation.lat, lng: userLocation.lng };
    return clubsByCity.filter((c) => haversineKm(origin, { lat: c.lat, lng: c.lng }) <= NEAR_ME_KM);
  })();

  const clubsFilteredFinal =
    favoritesOnly && favoriteIds.size > 0
      ? clubsByNearMe.filter((c) => favoriteIds.has(String(c.id)))
      : clubsByNearMe;

  const clubsForList = (() => {
    if (!userLocation) return clubsFilteredFinal;
    const origin = { lat: userLocation.lat, lng: userLocation.lng };
    return clubsFilteredFinal
      .map((c) => ({ ...c, distanceKm: haversineKm(origin, { lat: c.lat, lng: c.lng }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  })();

  return (
    <div className="page">
      <div className="layout">
        {/* ✅ Sidebar = CONTROLES + LISTA */}
        <aside className="sidebar">
          <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
              {status.loading
                ? "Cargando clubs…"
                : status.error
                  ? `Error: ${status.error}`
                  : `Clubs cargados: ${clubs.length}`}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={handleUseMyLocation} disabled={locStatus.loading} className="btn">
                {locStatus.loading ? "Pidiendo ubicación…" : "Usar mi ubicación"}
              </button>

              <button type="button" onClick={handleGoHome} className="btn">
                Volver a España
              </button>
            </div>

            {locStatus.error ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "crimson" }}>{locStatus.error}</div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <SearchBox
                onSearch={handleSearchPlace}
                onPickResult={handlePickSearchResult}
                onClearResults={handleClearSearchResults}
                loading={searchStatus.loading}
                error={searchStatus.error}
                results={searchResults}
              />
              {searchLocation ? (
                <button type="button" onClick={handleClearSearch} className="btn ghost" style={{ marginTop: 8 }}>
                  Limpiar búsqueda
                </button>
              ) : null}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Ciudad:</label>

              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                <option value="">Todas</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: 12, opacity: 0.75 }}>
                {clubsFilteredFinal.length} de {clubs.length}
              </span>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={nearMeOnly}
                  onChange={(e) => setNearMeOnly(e.target.checked)}
                  disabled={!userLocation}
                />
                Solo cerca de mí ({NEAR_ME_KM} km)
              </label>

              {!userLocation ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Actívalo tras “Usar mi ubicación”</div>
              ) : null}

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                  disabled={favoriteIds.size === 0}
                />
                Solo favoritos
              </label>

              {favoriteIds.size === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Marca alguno ⭐</div>
              ) : null}
            </div>
          </div>

          <ClubList
            clubs={clubsForList}
            userLocation={userLocation}
            favorites={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onSelect={(club) => setFocusedClub(club)}
          />
        </aside>

        {/* ✅ Map */}
        <main className="mapArea">
          <MapView
            clubs={clubsFilteredFinal}
            focusedClub={focusedClub}
            userLocation={userLocation}
            searchLocation={searchLocation}
            homeRequestId={homeRequestId}
          />
        </main>
      </div>
    </div>
  );
}
