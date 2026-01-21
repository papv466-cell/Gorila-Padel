import { useEffect, useRef, useState } from "react";
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
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 200);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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
  const location = useLocation(); // ✅ AHORA SÍ, DENTRO
  const isMapPage = location.pathname === "/mapa";

  const markerRefs = useRef(new Map());
  const [baseZoom, setBaseZoom] = useState(() =>
    window.innerWidth <= 768 ? 5 : 6
  );

  useEffect(() => {
    const onResize = () => setBaseZoom(window.innerWidth <= 768 ? 5 : 6);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!focusedClub?.id) return;
    const t = setTimeout(() => {
      const marker = markerRefs.current.get(String(focusedClub.id));
      marker?.openPopup?.();
    }, 500);
    return () => clearTimeout(t);
  }, [focusedClub]);

  const depsKey = `${baseZoom}-${focusedClub?.id || ""}`;

  return (
    <div className="mapShell">
      <MapContainer
        center={[40.4168, -3.7038]}
        zoom={baseZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <MapFix depsKey={depsKey} />

        <MapController
          focusedClub={focusedClub}
          userLocation={userLocation}
          searchLocation={searchLocation}
          homeRequestId={homeRequestId}
        />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {clubs
          .filter((c) => c?.lat && c?.lng && c?.id)
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

                  <ClubMatchesPreview clubId={clubId} clubName={clubName} limit={2} />

                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        navigate(`/partidos?clubId=${clubId}&clubName=${clubName}`)
                      }
                    >
                      Ver partidos
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        navigate(`/partidos?create=1&clubId=${clubId}&clubName=${clubName}`)
                      }
                    >
                      Crear partido
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <a
                      href={googleMapsUrl({
                        lat: Number(club.lat),
                        lng: Number(club.lng),
                        label: clubName,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
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
