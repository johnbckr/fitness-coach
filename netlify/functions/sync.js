const _fetch = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(m => m.default(...args));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ error: 'Sync nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_ANON_KEY in Netlify setzen.' })
    };
  }

  const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // GET — Daten laden
    if (event.httpMethod === 'GET') {
      const code = event.queryStringParameters?.code;
      if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Kein Sync-Code' }) };

      const res = await _fetch(
        `${SUPABASE_URL}/rest/v1/fitness_data?sync_code=eq.${encodeURIComponent(code)}&select=data,updated_at`,
        { headers: sbHeaders }
      );
      const rows = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(rows));
      return { statusCode: 200, headers: CORS, body: JSON.stringify(rows[0] || null) };
    }

    // POST — Daten speichern (upsert)
    if (event.httpMethod === 'POST') {
      const { sync_code, data } = JSON.parse(event.body);
      if (!sync_code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Kein Sync-Code' }) };

      const res = await _fetch(`${SUPABASE_URL}/rest/v1/fitness_data`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ sync_code, data, updated_at: new Date().toISOString() })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase ${res.status}: ${err}`);
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  } catch (err) {
    console.error('Sync error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
