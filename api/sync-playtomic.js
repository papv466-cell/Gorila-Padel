// api/sync-playtomic.js
// Sincronización de slots de Playtomic
// Uso: POST /api/sync-playtomic { clubId, playtomicUrl }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clubId, playtomicUrl } = req.body || {};
  if (!clubId) return res.status(400).json({ error: 'Falta clubId' });
  if (!playtomicUrl) return res.status(400).json({ error: 'Falta playtomicUrl' });

  // TODO: cuando Playtomic conceda acceso API o se acuerde scraping:
  // 1. Fetch del calendario público de playtomicUrl
  // 2. Parsear slots ocupados
  // 3. Insertar en court_slots con source='playtomic' y status='blocked'

  // Por ahora devolvemos un mock para que el frontend funcione
  return res.status(200).json({
    ok: true,
    synced: 0,
    message: 'Sincronización Playtomic pendiente de activar — pega la URL del club cuando la tengas',
    playtomicUrl,
    clubId,
  });
}
