/**
 * CryptoWave — Button Usage Counter Worker
 * Routes:
 *   GET  /counts      → return all button counts (totals)
 *   GET  /daily       → return today's counts
 *   POST /increment   → increment a button's count (total + daily)
 */

const ALLOWED_ORIGIN = 'https://cryptowaveapp.com';

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const path = url.pathname.replace(/^\/api/, '');

    // GET /counts — return all cumulative counts
    if (request.method === 'GET' && path === '/counts') {
      const { results } = await env.DB.prepare(
        'SELECT button_id, count FROM button_counts ORDER BY count DESC'
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // GET /daily — return today's counts (and optionally a date range via ?date=YYYY-MM-DD)
    if (request.method === 'GET' && path === '/daily') {
      const date = url.searchParams.get('date') || todayUTC();
      const { results } = await env.DB.prepare(
        'SELECT button_id, count FROM button_daily WHERE date = ? ORDER BY count DESC'
      ).bind(date).all();
      return new Response(JSON.stringify({ date, results }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // POST /increment — increment total + daily count
    if (request.method === 'POST' && path === '/increment') {
      let body;
      try { body = await request.json(); } catch { return new Response('Bad Request', { status: 400, headers: CORS }); }

      const { button_id } = body;
      if (!button_id || typeof button_id !== 'string' || button_id.length > 100) {
        return new Response('Bad Request', { status: 400, headers: CORS });
      }

      const today = todayUTC();

      await env.DB.batch([
        // Update cumulative total
        env.DB.prepare(`
          INSERT INTO button_counts (button_id, count) VALUES (?, 1)
          ON CONFLICT(button_id) DO UPDATE SET count = count + 1
        `).bind(button_id),
        // Update daily count
        env.DB.prepare(`
          INSERT INTO button_daily (button_id, date, count) VALUES (?, ?, 1)
          ON CONFLICT(button_id, date) DO UPDATE SET count = count + 1
        `).bind(button_id, today),
      ]);

      return new Response('OK', { headers: CORS });
    }

    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
