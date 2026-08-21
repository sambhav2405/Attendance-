// netlify/functions/telegram-webhook.js
//
// Telegram calls THIS function whenever you reply to a suggestion message
// in your chat. It reads which message you replied to, finds the matching
// suggestion, and saves your reply text — so the user's browser can pick
// it up next time they open the site (any time later, no expiry).
//
// ONE-TIME SETUP (after you deploy this file, do this once):
// Open this URL in your browser (replace both placeholders):
//
//   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_SITE>.netlify.app/.netlify/functions/telegram-webhook
//
// You should see {"ok":true,"result":true,...}. That's it — from then on,
// every reply you send in Telegram is captured automatically. No further
// action needed on your side other than typing your reply in Telegram.

const { getSuggestionsStore } = require('./lib/blobs-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'ok' }; // Telegram just needs 200s
  }

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 200, body: 'ok' };
  }

  const msg = update.message;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // Only accept replies coming from your own configured chat, to real
  // messages that are replies to a previous bot message.
  if (!msg || !msg.reply_to_message || String(msg.chat.id) !== String(CHAT_ID)) {
    return { statusCode: 200, body: 'ok' };
  }

  const repliedToId = msg.reply_to_message.message_id;
  const replyText = (msg.text || '').trim();
  if (!replyText) {
    return { statusCode: 200, body: 'ok' };
  }

  try {
    const store = getSuggestionsStore();
    const pointer = await store.get(`tg:${repliedToId}`, { type: 'json' });
    if (!pointer || !pointer.pointsTo) {
      return { statusCode: 200, body: 'ok' }; // reply to some unrelated message, ignore
    }

    const record = await store.get(pointer.pointsTo, { type: 'json' });
    if (!record) {
      return { statusCode: 200, body: 'ok' };
    }

    record.reply = replyText;
    record.repliedAt = Date.now();
    await store.setJSON(pointer.pointsTo, record);

    // Optional: confirm to yourself in Telegram that it was saved.
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: '✅ Reply saved. User will see it next time they open the site.' })
      });
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('telegram-webhook error:', err);
    return { statusCode: 200, body: 'ok' }; // always 200 so Telegram doesn't retry-storm
  }
};
