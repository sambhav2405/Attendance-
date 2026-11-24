// netlify/functions/suggest.js
//
// Runs on Netlify servers. Saves each suggestion to Netlify Blobs (free,
// built-in) with a unique ID, and forwards it to Telegram with that ID
// visible. Reply to that Telegram message and telegram-webhook.js will
// save your reply back against this ID, so check-reply.js can return it
// to the right user's browser later — even days later.
//
// SETUP (same as before):
// 1. BotFather -> /newbot -> get BOT TOKEN.
// 2. Message your bot once, open https://api.telegram.org/bot<TOKEN>/getUpdates
//    to find your CHAT ID.
// 3. Netlify -> Site settings -> Environment variables:
//      TELEGRAM_BOT_TOKEN = <token>
//      TELEGRAM_CHAT_ID   = <chat id>
// 4. Redeploy.
// 5. Set the Telegram webhook once (see telegram-webhook.js header for the URL to call).

const { getSuggestionsStore, getBlobStore } = require('./lib/blobs-store');

// Rate limit: max 20 suggestions per device (and per IP) in any 30 minutes.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 30 * 60 * 1000;

// Returns true if this key is over the limit; otherwise records the hit.
// Fails open: if the store is unavailable, the message is still allowed.
async function isRateLimited(store, key) {
  const safeKey = 'rl:' + key.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 100);
  const now = Date.now();
  let hits = [];
  try {
    const saved = await store.get(safeKey, { type: 'json' });
    if (Array.isArray(saved)) hits = saved.filter((t) => now - t < RATE_WINDOW_MS);
  } catch (e) { /* treat as empty */ }
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  try { await store.setJSON(safeKey, hits); } catch (e) { console.error('rate limit store failed:', e); }
  return false;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const clean = (s, max) => (s || '').toString().trim().slice(0, max);
  const name = clean(payload.name, 60);
  const branch = clean(payload.branch, 60);
  const text = clean(payload.text, 800);
  const deviceId = clean(payload.deviceId, 64);

  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Empty suggestion' }) };
  }

  // Rate limit by device id and by IP (so clearing site data doesn't bypass it).
  try {
    const store = getBlobStore('ratelimit');
    const ip = (event.headers && (event.headers['x-nf-client-connection-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0].trim())) || '';
    const keys = [];
    if (deviceId) keys.push('d:' + deviceId);
    if (ip) keys.push('ip:' + ip);
    for (const k of keys) {
      if (await isRateLimited(store, k)) {
        return { statusCode: 429, body: JSON.stringify({ ok: false, error: 'rate_limited' }) };
      }
    }
  } catch (e) {
    console.error('rate limit check failed (allowing):', e);
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server not configured' }) };
  }

  const id = genId();

  const lines = ['💡 New Suggestion (Academic Pro v7)', ''];
  if (name) lines.push(`👤 Name: ${name}`);
  if (branch) lines.push(`🎓 Branch: ${branch}`);
  lines.push('', `📝 ${text}`, '', `🆔 ID: ${id}`, '↩️ Reply to THIS message to answer the user.');

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join('\n') })
    });
    const data = await res.json();

    if (!data.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Telegram rejected message' }) };
    }

    const telegramMessageId = data.result.message_id;

    // The message has already reached the developer on Telegram at this
    // point — that's the part the user actually cares about. Everything
    // below is only for the "developer replied" tracking feature, so a
    // failure here must NOT make the user think their suggestion was lost.
    try {
      const store = getSuggestionsStore();
      const record = {
        id, name, branch, text, deviceId,
        telegramMessageId,
        createdAt: Date.now(),
        reply: null,
        repliedAt: null
      };
      await store.setJSON(id, record);
      // Reverse lookup: when your Telegram reply comes in, we only know which
      // Telegram message you replied to — this map gets us back to our own id.
      await store.setJSON(`tg:${telegramMessageId}`, { pointsTo: id });
    } catch (storeErr) {
      console.error('suggest: blobs store failed (message still sent to Telegram):', storeErr);
      return { statusCode: 200, body: JSON.stringify({ ok: true, id, replyTrackingUnavailable: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, id }) };
  } catch (err) {
    console.error('suggest error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error' }) };
  }
};
