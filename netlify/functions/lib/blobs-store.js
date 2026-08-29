// netlify/functions/lib/blobs-store.js
//
// Wraps @netlify/blobs' getStore() so it also works when Netlify's
// automatic Blobs context isn't injected into the function environment
// (this shows up as "MissingBlobsEnvironmentError"). In that case we fall
// back to manual configuration using a Site ID + a Personal Access Token,
// exactly as the error message itself suggests.
//
// ONE-TIME SETUP (only needed if you saw MissingBlobsEnvironmentError):
// 1. Netlify dashboard -> Project configuration -> General -> Site details
//    -> copy the "Site ID".
// 2. Netlify dashboard -> click your avatar (top right) -> User settings
//    -> Applications -> Personal access tokens -> New access token
//    -> copy the token (shown only once).
// 3. Site settings -> Environment variables, add:
//      NETLIFY_SITE_ID     = <site id from step 1>
//      NETLIFY_BLOBS_TOKEN = <token from step 2>
// 4. Trigger a new deploy (env var changes need a redeploy to take effect).

const { getStore } = require('@netlify/blobs');

function getBlobStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

function getSuggestionsStore() {
  return getBlobStore('suggestions');
}

module.exports = { getSuggestionsStore, getBlobStore };
