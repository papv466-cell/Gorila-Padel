// src/components/Map/MapView.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { useNavigate, useLocation } from "react-router-dom";
import MapController from "./MapController";
import ClubMatchesPreview from "../Matches/ClubMatchesPreview";

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix iconos Leaflet en Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function googleMapsUrl({ lat, lng, label }) {
  const q = label ? `${lat},${lng} (${label})` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function MapFix({ depsKey }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const doFix = () => {
      try {
        map.invalidateSize();
      } catch {}
    };

    doFix();
    const t1 = setTimeout(doFix, 150);
    const t2 = setTimeout(doFix, 600);
    const t3 = setTimeout(doFix, 1200);

    const onResize = () => doFix();
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", onResize);
    };
  }, [map, depsKey]);

  return null;
}

export default function MapView({
  clubs = [],
  focusedClub,
  userLocation,
  searchLocation,
  homeRequestId,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMapPage = location.pathname === "/mapa";

  const markerRefs = useRef(new Map());

  const [baseZoom, setBaseZoom] = useState(() => (window.innerWidth <= 768 ? 5 : 6));

  useEffect(() => {
    const onResize = () => setBaseZoom(window.innerWidth <= 768 ? 5 : 6);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!focusedClub?.id) return;
    const t = setTimeout(() => {
      const marker = markerRefs.current.get(String(focusedClub.id));
      if (marker) marker.openPopup();
    }, 650);
    return () => clearTimeout(t);
  }, [focusedClub]);

  function closePopup(clubId) {
    const marker = markerRefs.current.get(String(clubId));
    marker?.closePopup?.();
  }

  const depsKey = useMemo(() => `${baseZoom}-${focusedClub?.id || ""}`, [baseZoom, focusedClub?.id]);

  return (
    <div className="mapShell">
      <MapContainer center={[40.4168, -3.7038]} zoom={baseZoom} style={{ height: "100%", width: "100%" }}>
        <MapFix depsKey={depsKey} />

        <MapController
          focusedClub={focusedClub}
          userLocation={userLocation}
          searchLocation={searchLocation}
          homeRequestId={homeRequestId}
        />

        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {searchLocation ? (
          <Marker position={[Number(searchLocation.lat), Number(searchLocation.lng)]}>
            <Popup>
              <strong>Búsqueda</strong>
              <div style={{ marginTop: 6, fontSize: 12 }}>{searchLocation.displayName}</div>
            </Popup>
          </Marker>
        ) : null}

        {userLocation ? (
          <>
            <Marker position={[Number(userLocation.lat), Number(userLocation.lng)]}>
              <Popup>
                <strong>Mi ubicación</strong>
              </Popup>
            </Marker>
            <Circle center={[Number(userLocation.lat), Number(userLocation.lng)]} radius={userLocation.accuracy ?? 50} />
          </>
        ) : null}

        {clubs
          .filter((c) => c?.lat != null && c?.lng != null && c?.id != null)
          .map((club) => {
            const clubId = String(club.id);
            const clubName = String(club.name ?? "Club");

            return (
              <Marker
                key={clubId}
                position={[Number(club.lat), Number(club.lng)]}
                ref={(ref) => {
                  if (ref) markerRefs.current.set(clubId, ref);
                  else markerRefs.current.delete(clubId);
                }}
              >
                <Popup>
                  <strong>{clubName}</strong>
                  {club.city ? <div style={{ marginTop: 4, fontSize: 12 }}>{club.city}</div> : null}

                  <ClubMatchesPreview clubId={clubId} clubName={clubName} limit={2} />

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMapPage) closePopup(clubId);
                        navigate(`/partidos?clubId=${encodeURIComponent(clubId)}&clubName=${encodeURIComponent(clubName)}`);
                      }}
                    >
                      Ver partidos aquí
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMapPage) closePopup(clubId);
                        navigate(`/partidos?create=1&clubId=${encodeURIComponent(clubId)}&clubName=${encodeURIComponent(clubName)}`);
                      }}
                    >
                      Crear partido aquí
                    </button>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMapPage) closePopup(clubId);
                        navigate(`/clases?clubId=${encodeURIComponent(clubId)}&clubName=${encodeURIComponent(clubName)}`);
                      }}
                    >
                      Clases aquí
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <a
                      href={googleMapsUrl({ lat: Number(club.lat), lng: Number(club.lng), label: clubName })}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Abrir en Google Maps →
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
