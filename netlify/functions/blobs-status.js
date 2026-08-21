// netlify/functions/blobs-status.js
//
// Debug helper — open this to check whether Netlify Blobs (used to store
// suggestions + replies) is actually working on this deploy:
//
//   https://<YOUR_SITE>.netlify.app/.netlify/functions/blobs-status
//
// { "ok": true, "writeRead": true } means Blobs is working fine.
// Anything else means suggestions ARE reaching Telegram, but the "developer
// replied" tracking feature won't work until this is fixed — the error
// field explains why.

const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('suggestions');
    const testKey = `selftest:${Date.now()}`;
    await store.setJSON(testKey, { ok: true, at: Date.now() });
    const readBack = await store.get(testKey, { type: 'json' });
    await store.delete(testKey);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, writeRead: Boolean(readBack && readBack.ok) })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message, stack: (err.stack || '').split('\n').slice(0, 3) })
    };
  }
};
