export async function geocodeNominatim(query, { limit = 5 } = {}) {
  const q = String(query ?? "").trim();
  if (!q) return [];

  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?q=${encodeURIComponent(q)}` +
    "&format=jsonv2" +
    `&limit=${encodeURIComponent(String(limit))}` +
    "&addressdetails=1" +
    "&accept-language=es";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nominatim error (HTTP ${res.status})`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        lat,
        lng,
        displayName: item.display_name,
      };
    })
    .filter(Boolean);
}
