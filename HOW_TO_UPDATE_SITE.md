# How to Update the UI/Features Without Deploying (Zero-Deploy CMS)

**ATTENTION ANY AI OR DEVELOPER:**
This project uses a "Zero-Deploy CMS" architecture to save Netlify build minutes.
The site dynamically fetches its configuration, custom CSS, and custom JavaScript from a remote GitHub Gist on every page load.

**DO NOT MODIFY the `index.html` file or push to this repository to make UI changes!**
If you modify `index.html` and push it, you will consume precious Netlify build minutes.

Instead, ALL design updates, new features, and content changes MUST be made by editing the remote GitHub Gist.

## The Secret Gist Details
- **Gist ID:** `0a01fd493d7fedc0cba1cf73e39f6033`
- **Gist URL:** [https://gist.github.com/sambhav2405/0a01fd493d7fedc0cba1cf73e39f6033](https://gist.github.com/sambhav2405/0a01fd493d7fedc0cba1cf73e39f6033)

## How to Edit Using GitHub CLI (For AIs)
If you are an AI agent, you can edit the Gist directly via the GitHub CLI:
1. Create a local copy of the file you want to edit (e.g., `config.json`, `custom.css`, or `custom.js`).
2. Run the command: `gh gist edit 0a01fd493d7fedc0cba1cf73e39f6033 --add <filename>`
3. The changes will instantly reflect on `presentsir.me` upon refresh. No Netlify deploy required!

## Files in the Gist

### 1. `config.json`
Controls all text, popups, announcement banners, affiliate links, and Amazon deal categories.
- **To add a new Amazon deal:** Add a new object to the `deals` array.
- **To update the UPI ID:** Edit the `upiId` string.
- **To manage the promo popup's swipeable cards:** edit the `promoCards` array (see below).

#### `promoCards` — the swipeable promo popup
The popup that appears ~2s after page load (once per browser session) renders one card per
entry in `config.json`'s `promoCards` array. Each card is a full admin-controlled unit — no code
changes needed to add, change dates, change the rollout %, or remove one. Example:

```json
"promoCards": [
  {
    "id": "mcq-ras-upsc",
    "enabled": true,
    "image": "https://example.com/mcq-banner.jpg",
    "icon": "",
    "title": "📝 Daily MCQs — RAS & UPSC",
    "text": "Practice daily MCQs curated for RAS and UPSC aspirants.",
    "buttonText": "Practice Now",
    "link": "https://example.com/mcqs",
    "startDate": "2026-11-01",
    "endDate": "2026-12-31",
    "percentage": 100
  }
]
```

Field reference:
- `id` — unique string (never reuse between unrelated cards; a dismissed card's `id` is
  remembered in the visitor's browser so they don't see it again).
- `enabled` — `false` hides the card immediately without deleting it (soft remove/pause).
- `image` — required; the card's banner image URL. A card with no `image` or no `link` is
  skipped automatically.
- `icon` — optional small square icon (e.g. an app icon) shown next to the title.
- `title`, `text`, `buttonText` — the card's copy.
- `link` — required; the direct URL the button opens in a new tab.
- `startDate` / `endDate` — optional `YYYY-MM-DD`. Leave blank for "always" on either side —
  this is how many days a card shows: set `endDate` to the last day you want it visible.
- `percentage` — `0`–`100`. Controls what % of visitors see this card (e.g. `30` shows it to
  roughly 30% of people, consistently — the same visitor won't flip in and out on reload).
  Omit it (or set `100`) to show it to everyone eligible.

To remove a card for good, delete its object from the array. To pause it temporarily, just set
`"enabled": false` — no need to delete and re-add it later.

### 2. `custom.css`
Injects custom CSS styles directly into the `<head>` of the document.
- **To change the theme or colors:** Write standard CSS here. Use `!important` if necessary to override base styles.
- **Example:** `body { background-color: #1a1a1a !important; }`

### 3. `custom.js`
Injects custom JavaScript logic at the end of the `<body>`.
- **To add new features or event listeners:** Write standard JavaScript here.
- **Example:** `console.log("New feature loaded!");`

## When to actually modify `index.html` and push to this repo?
- ONLY if you need to add large core structural changes (like a completely new page or a heavy library that shouldn't be loaded dynamically).
- ONLY if you need to update the Netlify serverless functions (`netlify/functions/`).

**Remember:** The goal is to keep Netlify deployments to absolute zero. Always use the Gist for UI/Feature updates.
