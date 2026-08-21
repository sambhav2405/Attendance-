// netlify/functions/webhook-status.js
//
// Debug helper — open this URL in your browser to check whether Telegram
// actually has your webhook registered, without needing to remember the
// setWebhook command:
//
//   https://<YOUR_SITE>.netlify.app/.netlify/functions/webhook-status
//
// If "url" in the response is empty, the webhook was never set (or was
// cleared) — call setWebhook again (see telegram-webhook.js header).
// If "url" points somewhere else, another deploy/bot is still registered.
// "last_error_message" (if present) is Telegram telling you why the last
// delivery to your webhook failed.

exports.handler = async () => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN is not set in Netlify environment variables.'
      })
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        chatIdConfigured: Boolean(CHAT_ID),
        webhookInfo: data.result
      }, null, 2)
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Could not reach Telegram: ' + err.message })
    };
  }
};
