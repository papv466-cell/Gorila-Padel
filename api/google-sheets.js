// api/google-sheets.js
export default async function handler(req, res) {
    // CORS para permitir llamadas desde tu app
    const origin = req.headers.origin || '';
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    
    if (isLocal) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // En producción, permite cualquier origen por ahora (luego restringir)
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    try {
      // La key está SOLO en el servidor (sin VITE_)
      const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;
      const RANGE = process.env.GOOGLE_SHEET_RANGE || 'Clubs!A:Z';
  
      if (!GOOGLE_API_KEY || !SHEET_ID) {
        console.error('Missing GOOGLE_API_KEY or SHEET_ID');
        return res.status(500).json({ error: 'Configuración incompleta' });
      }
  
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Sheets error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return res.status(200).json(data);
      
    } catch (e) {
      console.error('[GOOGLE_SHEETS_ERROR]', e);
      return res.status(500).json({ 
        error: 'Error obteniendo clubs' 
      });
    }
  }