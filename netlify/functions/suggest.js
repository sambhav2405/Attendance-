// netlify/functions/suggest.js
//
// This runs on Netlify's servers, NOT in the browser — so the bot token
// and chat ID stay hidden and are never visible in your page source.
//
// SETUP:
// 1. On Telegram, message @BotFather -> /newbot -> follow steps -> you get a BOT TOKEN.
// 2. Send any message to your new bot once (so it can see your chat).
// 3. Open in browser: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
//    Look for "chat":{"id": ...}  -> that number is your CHAT ID.
// 4. In Netlify: Site settings -> Environment variables -> add:
//      TELEGRAM_BOT_TOKEN = <your token>
//      TELEGRAM_CHAT_ID   = <your chat id>
// 5. Redeploy the site (env vars only apply after a new deploy).

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

  const lines = ['💡 New Suggestion (Academic Pro v7)', ''];
  if (name) lines.push(`👤 Name: ${name}`);
  if (branch) lines.push(`🎓 Branch: ${branch}`);
  lines.push('', `📝 ${text}`);

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
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error' }) };
  }
};
