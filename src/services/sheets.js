// src/services/sheets.js

function toNumberSafe(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza coordenadas que pueden venir en formatos raros:
 * - "36.680.822"  -> 36.680822
 * - "-4.454.437"  -> -4.454437
 * - "36,680822"   -> 36.680822
 * - " 36.680 822" -> 36.680822
 *
 * Estrategia:
 * 1) limpiamos espacios
 * 2) si hay coma y no punto => coma decimal
 * 3) si hay varios puntos => generamos candidatos y elegimos el que esté en rango lat/lng
 */
function normalizeCoord(value, kind = "lat") {
  if (value == null) return null;

  let v = String(value).trim();
  if (!v) return null;

  // quitamos espacios
  v = v.replace(/\s+/g, "");

  // si usa coma como decimal
  if (v.includes(",") && !v.includes(".")) {
    v = v.replace(",", ".");
  }

  // si es número ya limpio
  const direct = toNumberSafe(v);
  if (direct != null) {
    if (kind === "lat" && direct >= -90 && direct <= 90) return direct;
    if (kind === "lng" && direct >= -180 && direct <= 180) return direct;
  }

  // Si hay varios puntos, probamos candidatos
  const dots = (v.match(/\./g) || []).length;
  if (dots >= 2) {
    const isNeg = v.startsWith("-");
    const sign = isNeg ? "-" : "";
    const raw = isNeg ? v.slice(1) : v;

    const parts = raw.split(".").filter(Boolean);

    // Candidato A: primer punto es decimal (lo que tú quieres)
    // "36.680.822" => "36.680822"
    const candA = sign + parts[0] + "." + parts.slice(1).join("");
    const numA = toNumberSafe(candA);

    // Candidato B: último punto es decimal (a veces pasa)
    // "36.680.822" => "36680.822"
    const candB = sign + parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    const numB = toNumberSafe(candB);

    // Elegimos el que tenga sentido
    const ok = (n) => {
      if (n == null) return false;
      if (kind === "lat") return n >= -90 && n <= 90;
      return n >= -180 && n <= 180;
    };

    if (ok(numA)) return numA;
    if (ok(numB)) return numB;

    // Si ninguno cae en rango, devolvemos el que no sea null (por si acaso)
    return numA ?? numB ?? null;
  }

  // Último intento: convertir lo que sea
  const n = toNumberSafe(v);
  return n;
}

function normalizeClub(rowObj = {}) {
  const out = { ...rowObj };

  const id =
    out.id ??
    out.club_id ??
    out.clubId ??
    out.ID ??
    out.Id ??
    "";

  const name =
    out.name ??
    out.club_name ??
    out.clubName ??
    out.Nombre ??
    out.nombre ??
    "";

  const city =
    out.city ??
    out.ciudad ??
    out.Ciudad ??
    "";

  const address =
    out.address ??
    out.direccion ??
    out.Direccion ??
    out.dirección ??
    out.Dirección ??
    "";

  // ✅ IMPORTANTE: tu hoja tiene "lon" (NO "lng")
  const latRaw = out.lat ?? out.latitude ?? out.Lat ?? out.LAT ?? "";
  const lngRaw =
    out.lng ??
    out.lon ?? // ✅ CLAVE
    out.longitude ??
    out.Longitude ??
    out.Lng ??
    out.LNG ??
    out.Lon ??
    out.LON ??
    "";

  const lat = normalizeCoord(latRaw, "lat");
  const lng = normalizeCoord(lngRaw, "lng");

  return {
    ...out,
    id: String(id || "").trim(),
    name: String(name || "").trim(),
    city: String(city || "").trim(),
    address: String(address || "").trim(),
    lat,
    lng,
  };
}

function rowsToObjects(values = []) {
  if (!Array.isArray(values) || values.length < 2) return [];

  const headers = (values[0] || []).map((h) => String(h || "").trim());
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c] ?? "";
    }
    out.push(normalizeClub(obj));
  }

  return out;
}

export async function fetchClubsFromGoogleSheet(opts = {}) {
  const sheetId =
    opts.sheetId ||
    import.meta.env.VITE_GOOGLE_SHEET_ID ||
    "";

  const apiKey =
    opts.apiKey ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    "";

  const range =
    opts.range ||
    import.meta.env.VITE_GOOGLE_SHEET_RANGE ||
    "Clubs!A:Z";

  if (!sheetId || !apiKey) {
    const msg =
      "Config Google Sheets incompleta. Revisa .env: VITE_GOOGLE_SHEET_ID y VITE_GOOGLE_API_KEY.";
    console.warn(msg, { sheetId: !!sheetId, apiKey: !!apiKey });
    throw new Error(msg);
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url);

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Google Sheets error (${r.status}). ${t || "No body"}`);
  }

  const json = await r.json();
  return rowsToObjects(json?.values || []);
}
