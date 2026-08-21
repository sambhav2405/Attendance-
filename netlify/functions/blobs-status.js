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

const { getSuggestionsStore } = require('./lib/blobs-store');

exports.handler = async () => {
  const usingManualConfig = Boolean(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN);
  try {
    const store = getSuggestionsStore();
    const testKey = `selftest:${Date.now()}`;
    await store.setJSON(testKey, { ok: true, at: Date.now() });
    const readBack = await store.get(testKey, { type: 'json' });
    await store.delete(testKey);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, writeRead: Boolean(readBack && readBack.ok), usingManualConfig })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        usingManualConfig,
        error: err.message,
        hint: usingManualConfig
          ? 'NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN are set but Blobs still failed — double check the token has Blobs access and the site ID is correct.'
          : 'NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN are not set — see the setup notes at the top of netlify/functions/lib/blobs-store.js.',
        stack: (err.stack || '').split('\n').slice(0, 3)
      })
    };
  }
};
