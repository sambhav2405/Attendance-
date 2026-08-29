// netlify/functions/lib/push.js
//
// Thin wrapper around the web-push library. VAPID keys come from Netlify
// env vars (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — see the setup notes in
// netlify/functions/vapid-public-key.js.

const webpush = require('web-push');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('mailto:no-reply@presentsir.me', publicKey, privateKey);
  configured = true;
  return true;
}

async function sendPush(subscription, payload) {
  if (!ensureConfigured()) {
    console.error('push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set, skipping push send');
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    console.error('push: sendNotification failed:', err.statusCode || '', err.message);
    throw err;
  }
}

module.exports = { sendPush };
