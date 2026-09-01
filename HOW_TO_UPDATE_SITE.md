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
- **To change the popup text:** Edit the `popup.title`, `popup.subtitle`, or `popup.buttons` array.
- **To update the UPI ID:** Edit the `upiId` string.

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
