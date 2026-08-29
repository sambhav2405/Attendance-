// netlify/functions/visit-count.js
//
// Our own visitor counter, backed by Netlify Blobs. Replaces the old
// third-party abacus.jasoncameron.dev counter, which was shared across
// every site using that namespace worldwide and had no real de-duplication
// on our end — a page load could race and count the same device multiple
// times before localStorage caught up.
//
// The client sends a stable per-device id (a UUID it generates once and
// keeps in localStorage). We only increment the total the FIRST time we
// see that id, ever — recorded as its own key in the store, so repeat
// visits (including after clearing Chrome, reinstalling the PWA, etc. —
// which only regenerates the id) are idempotent from our side. This can
// safely be called on every page load.

const { getBlobStore } = require('./lib/blobs-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const deviceId = (body.deviceId || '').toString().trim().slice(0, 64);
  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing deviceId' }) };
  }

  try {
    const store = getBlobStore('visits');
    const seenKey = `seen:${deviceId}`;
    const alreadySeen = await store.get(seenKey);

    const totalRecord = await store.get('total', { type: 'json' });
    let count = (totalRecord && totalRecord.count) || 0;

    if (!alreadySeen) {
      count += 1;
      await store.setJSON('total', { count });
      await store.set(seenKey, '1');
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, raw: count }) };
  } catch (err) {
    console.error('visit-count error:', err);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Server error' }) };
  }
};
