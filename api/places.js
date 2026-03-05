export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { input, place_id } = req.query;
  const key = process.env.GOOGLE_PLACES_KEY;

  try {
    if (place_id) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry,formatted_address,address_components&language=es&key=${key}`);
      const data = await r.json();
      return res.json(data);
    }
    if (input) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=establishment|geocode&components=country:es&language=es&key=${key}`);
      const data = await r.json();
      return res.json(data);
    }
    res.status(400).json({ error: "Missing input or place_id" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
