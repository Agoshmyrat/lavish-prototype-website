# Lavish Bar & Grill — website (concept redesign)

A static website: plain HTML, CSS and JavaScript. No build step, no frameworks, no installs.
Double-click `index.html` to run it.

> **Concept redesign.** Built as a pitch, not the official site. The restaurant's name, logo, photos and menus
> belong to the restaurant: get their permission before publishing this publicly. The page is marked
> `noindex` (see `index.html`) so search engines ignore it; delete that line when the restaurant adopts it.

## Folder map

```
lavish-website/
├── index.html                 The page (semantic HTML, no inline styles or scripts)
├── css/
│   ├── tokens.css             Colours, fonts, radius: change the look here
│   ├── base.css               Reset, layout helpers, buttons, accessibility helpers
│   ├── header.css             Navigation bar
│   ├── hero.css               Top banner
│   ├── sections.css           Highlights strip, About, The room, Reviews
│   ├── menu.css               Menu tabs, accordions, dishes, wines
│   ├── gallery.css            Photo grid + full-screen viewer
│   ├── reservation.css        Booking section and form
│   └── footer.css             Footer
├── js/
│   ├── config.js              ★ The only file to edit to connect the Sheet (address, phone, debug)
│   ├── header.js              Header turns solid on scroll
│   ├── menu-tabs.js           Menu tabs (keyboard accessible)
│   ├── gallery.js             Full-screen photo viewer
│   └── booking.js             Form validation + sending the request
├── images/                    Your photos (original files, untouched) and the logo mark
├── apps-script/Code.gs        Paste into the Google Sheet (Extensions → Apps Script); also builds the Statistics tab
└── docs/CONNECT-GOOGLE-SHEET.md   Step-by-step connection guide
```

## Quick start

1. Unzip, open the folder, double-click `index.html`.
2. To receive booking requests in Google Sheets, follow **`docs/CONNECT-GOOGLE-SHEET.md`**.

## Where to change things

| I want to change… | Edit |
|---|---|
| Colours, fonts | `css/tokens.css` |
| A dish, price or description | `index.html` — search for the dish name (menus are plain HTML; one `<div class="dish">` per dish) |
| Opening text, reviews, address, phone | `index.html` (phone also in `js/config.js` for form messages) |
| A photo | Replace the file in `images/` with the same name (ideal size 1200×800, WebP or JPG), or change the `src` in `index.html`. Update the `alt` text too |
| The Sheet address, debug logging | `js/config.js` |
| Running the Sheet: daily use, every problem and its fix | `docs/SHEET-MANAGEMENT-AND-TROUBLESHOOTING.md` |
| Where alert emails go, sheet columns | `apps-script/Code.gs` (top of file), then redeploy a **New version** |

## Conventions

- UTF-8, LF line endings, 2-space indent (`.editorconfig` configures most editors, which avoids hidden-character bugs).
- No inline `style=""`, no inline `onclick=""`: styling lives in `css/`, behaviour in `js/`.
- Scripts are classic (not ES modules) and loaded with `defer`, so the site also works when opened straight from disk.
- Each script is a self-contained IIFE; the only global is `window.LAVISH_CONFIG`.
- Menu tabs follow the WAI-ARIA tabs pattern; accordions are native `<details>`; the photo viewer is a native `<dialog>`.

## Putting it online later (optional)

Upload the **whole folder, keeping its structure**: `index.html` alone is not enough, because it needs `css/`, `js/` and `images/`.
Any static host works (GitHub Pages, Netlify, Cloudflare Pages). On GitHub, drag the folder's *contents* into the repository, then enable Pages.

## Known limitations / ideas

- Below 840px wide the section links are hidden and only "Reserve a table" remains in the header. A small mobile menu would help.
- The page cannot read Google's reply to a booking request (browser security), so "sent" means "left the browser". The Sheet row and email are the proof.
- The menu PDFs link to the restaurant's own website, so they stay current but depend on that site.
