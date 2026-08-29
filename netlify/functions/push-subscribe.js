// netlify/functions/push-subscribe.js
//
// Saves (or removes) a browser's Web Push subscription, keyed by the same
// per-device id used for the visitor counter. telegram-webhook.js looks
// this up by device id when a reply comes in, so it can push a real
// notification to that device even if the site/PWA is closed.

const { getBlobStore } = require('./lib/blobs-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const deviceId = (body.deviceId || '').toString().trim().slice(0, 64);
  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing deviceId' }) };
  }

  try {
    const store = getBlobStore('push-subs');

    if (body.unsubscribe) {
      await store.delete(deviceId);
      return { statusCode: 200, body: JSON.stringify({ ok: true, removed: true }) };
    }

    if (!body.subscription || !body.subscription.endpoint) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing subscription' }) };
    }

    await store.setJSON(deviceId, body.subscription);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('push-subscribe error:', err);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Server error' }) };
  }
};
