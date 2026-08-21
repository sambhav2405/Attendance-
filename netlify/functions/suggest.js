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

const { getSuggestionsStore } = require('./lib/blobs-store');

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

  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Empty suggestion' }) };
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
        id, name, branch, text,
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
