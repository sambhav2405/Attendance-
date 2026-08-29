// netlify/functions/vapid-public-key.js
//
// Hands the frontend the VAPID public key it needs to subscribe to Web
// Push (PushManager.subscribe({ applicationServerKey: ... })). Public keys
// aren't secret, so serving it like this (rather than hardcoding it in
// index.html) just keeps it in one place.
//
// ONE-TIME SETUP: add these two Netlify environment variables (same place
// as NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN), then redeploy:
//   VAPID_PUBLIC_KEY  = BIrzFkL2Bg0ztwWr0ppaWOegB5qlD9uWazzNuHGyi3k1QdYtmyAW7xf6_aHNftSt9rJQvcbmdhPNARxFex8PiqA
//   VAPID_PRIVATE_KEY = K5HD8v6yb-TsOGQYrCnQevQafO4S57QegJ4qVB6vmRI
// (This keypair was generated once for this project — treat the private
// key like a password, it's what lets the server sign push messages.)

exports.handler = async () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: Boolean(publicKey), publicKey })
  };
};
