// netlify/functions/check-reply.js
//
// The website calls this (GET ?id=xxx) to check if you've replied yet to a
// particular suggestion. Returns { ok:true, replied:false } until you reply
// in Telegram, then { ok:true, replied:true, reply:"..." }. No expiry —
// works whether you reply in 5 minutes or 5 days.

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing id' }) };
  }

  try {
    const store = getStore('suggestions');
    const record = await store.get(id, { type: 'json' });

    if (!record) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, replied: false }) };
    }

    if (record.reply) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, replied: true, reply: record.reply, repliedAt: record.repliedAt })
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, replied: false }) };
  } catch (err) {
    console.error('check-reply error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error' }) };
  }
};

