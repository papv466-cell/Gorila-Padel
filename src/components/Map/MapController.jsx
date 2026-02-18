import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useLocation } from "react-router-dom";

export default function MapController({
  focusedClub,
  userLocation,
  searchLocation,
  homeRequestId,
}) {
  const map = useMap();
  const location = useLocation();

  // ✅ Recalcular tamaño del mapa al cambiar de ruta (Mapa/Partidos/Clases)
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [location.pathname, map]);

  // ✅ Volver a España (trigger por id)
  useEffect(() => {
    if (!homeRequestId) return;
    map.setView([40.4168, -3.7038], 6, { animate: true });
  }, [homeRequestId, map]);

  // ✅ Prioridad: club seleccionado
  useEffect(() => {
    if (!focusedClub) return;
    map.setView([focusedClub.lat, focusedClub.lng], 15, { animate: true });
  }, [focusedClub, map]);

  // ✅ Luego: ubicación del usuario
  useEffect(() => {
    if (!userLocation) return;
    map.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
  }, [userLocation, map]);

  // ✅ Luego: búsqueda
  useEffect(() => {
    if (!searchLocation) return;
    map.setView([searchLocation.lat, searchLocation.lng], 14, { animate: true });
  }, [searchLocation, map]);

  return null;
}
