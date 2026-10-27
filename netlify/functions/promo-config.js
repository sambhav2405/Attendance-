// netlify/functions/promo-config.js -> /.netlify/functions/promo-config
//
// Backend-controlled promo cards for the swipeable popup, so the site admin
// can manage them from a password-protected page (/admin.html) instead of
// hand-editing raw JSON in a Gist.
//
// ONE-TIME SETUP (the only setup this needs):
// 1. Netlify -> Site settings -> Environment variables, add:
//      ADMIN_PASSWORD = <a password only you know>
// 2. Redeploy (env var changes need a redeploy to take effect).
// 3. Open /admin.html on your site and log in with that password.
//
// GET  (public, no auth) -> { ok:true, cards: [...] | null }
//   null means "nothing saved yet" -> the site falls back to its built-in
//   default cards until you save something from /admin.html.
// POST (requires { password, cards } in the JSON body) -> overwrites the
//   saved cards. Wrong/missing password -> 401, nothing is changed.

const crypto = require('crypto');
const { getBlobStore } = require('./lib/blobs-store');

const STORE_NAME = 'site-config';
const KEY = 'promoCards';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

exports.handler = async (event) => {
  const store = getBlobStore(STORE_NAME);

  if (event.httpMethod === 'GET') {
    try {
      const cards = await store.get(KEY, { type: 'json' });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ok: true, cards: cards || null })
      };
    } catch (err) {
      console.error('promo-config GET error:', err);
      return { statusCode: 200, body: JSON.stringify({ ok: true, cards: null }) };
    }
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
    }

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server not configured: set ADMIN_PASSWORD in Netlify env vars and redeploy.' }) };
    }
    if (!payload.password || !safeEqual(payload.password, ADMIN_PASSWORD)) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Wrong password' }) };
    }
    // No `cards` field = the admin page is just verifying the password
    // (login step), not saving anything yet.
    if (payload.cards === undefined) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, verified: true }) };
    }
    if (!Array.isArray(payload.cards)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'cards must be an array' }) };
    }

    try {
      await store.setJSON(KEY, payload.cards);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('promo-config POST error:', err);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Failed to save' }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
};
