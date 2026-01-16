function detectField(header) {
  const h = String(header ?? "").trim().toLowerCase();

  if (["lat", "latitude", "latitud"].includes(h)) return "lat";
  if (["lng", "lon", "long", "longitude", "longitud"].includes(h)) return "lng";
  if (["name", "club", "club_name", "nombre", "club nombre"].includes(h)) return "name";
  if (["address", "direccion", "dirección", "address_full"].includes(h)) return "address";
  if (["city", "ciudad", "municipio", "localidad"].includes(h)) return "city";

  return null;
}

function normalizeCoordinateString(raw) {
  let s = String(raw ?? "").trim();

  // Quita espacios raros
  s = s.replace(/\s+/g, "");

  // Caso 1: miles '.' y decimal ','  ->  1.234,56  => 1234.56
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
    return s;
  }

  // Caso 2: varios puntos (ej: 36.680.822)
  const dotCount = (s.match(/\./g) || []).length;
  if (dotCount > 1) {
    const firstDot = s.indexOf(".");
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    return s;
  }

  // Caso 3: varias comas (raro)
  const commaCount = (s.match(/,/g) || []).length;
  if (commaCount > 1) {
    const firstComma = s.indexOf(",");
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "");
  }

  // Caso 4: decimal con coma -> punto
  s = s.replace(",", ".");
  return s;
}

function toNumber(v) {
  if (v == null) return null;
  const s = normalizeCoordinateString(v);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function fetchClubsFromGoogleSheet({ sheetId, gid = 0 }) {
  // Endpoint más fiable para CSV
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`No se pudo leer Google Sheets (HTTP ${res.status}). ¿Está público?`);
  }

  const csv = await res.text();

  // Si Google devuelve HTML (permisos/login), lo detectamos
  const head = csv.slice(0, 200).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html") || head.includes("accounts.google.com")) {
    throw new Error(
      "Google Sheets no está accesible como CSV. Pon el documento en 'Cualquiera con el enlace: Lector' o 'Público'."
    );
  }

  // Parser CSV simple (soporta comillas)
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const mapping = headers.map(detectField);

  const clubs = rows.slice(1).map((r, idx) => {
    const obj = { id: String(idx) };

    for (let c = 0; c < headers.length; c++) {
      const key = mapping[c];
      const value = (r[c] ?? "").trim();
      if (!key) continue;

      if (key === "lat" || key === "lng") obj[key] = toNumber(value);
      else obj[key] = value;
    }

    return obj;
  });

  // Solo filas válidas con coordenadas
  return clubs.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");
}
