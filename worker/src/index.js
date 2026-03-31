/**
 * CryptoWave — Button Usage Counter Worker
 * Routes:
 *   GET  /counts      → return all button counts
 *   POST /increment   → increment a button's count
 */

const ALLOWED_ORIGIN = 'https://cryptowaveapp.com';

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // GET /counts — return all counts
    if (request.method === 'GET' && url.pathname === '/counts') {
      const { results } = await env.DB.prepare(
        'SELECT button_id, count FROM button_counts ORDER BY count DESC'
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // POST /increment — increment a button count
    if (request.method === 'POST' && url.pathname === '/increment') {
      let body;
      try { body = await request.json(); } catch { return new Response('Bad Request', { status: 400, headers: CORS }); }

      const { button_id } = body;
      if (!button_id || typeof button_id !== 'string' || button_id.length > 100) {
        return new Response('Bad Request', { status: 400, headers: CORS });
      }

      await env.DB.prepare(`
        INSERT INTO button_counts (button_id, count) VALUES (?, 1)
        ON CONFLICT(button_id) DO UPDATE SET count = count + 1
      `).bind(button_id).run();

      return new Response('OK', { headers: CORS });
    }

    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
