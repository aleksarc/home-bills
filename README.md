# 🏠 Home Bills

A personal household expense tracker for two people, built as a single HTML page hosted on GitHub Pages, with Cloudflare D1 as the database and a Cloudflare Worker as a secure proxy.

No subscriptions. No backend servers. No app store. Just open the link and start tracking.

---

## What it does

Home Bills lets two people log shared household expenses via natural language, automatically splits the total 50/50, and always shows who owes whom and how much. Everything syncs in real time through a Cloudflare D1 database.

---

## Features

- **Natural language entry** — type expenses the way you'd say them out loud
- **Date from input** — include "on dd/mm" to set a specific entry date
- **Automatic 50/50 split** with real-time balance calculation
- **Cash settlements** — record when one person pays the other directly
- **Month close** — archives the month, writes a closing note, carries any balance to next month
- **Reopen month** — reverse a close to fix missing or incorrect entries, then close again
- **Custom sheets** — separate sheets for projects like house improvements
- **Multi-year support** — add a new year with one click
- **PIN authentication** via Cloudflare Worker
- **Mobile friendly** — responsive layout, works on any device
- **Dark mode** support

---

## How it's built

| Part | Technology |
|---|---|
| Frontend | Single HTML file, vanilla JS and CSS, no frameworks |
| Hosting | GitHub Pages (free) |
| Database | Cloudflare D1 — serverless SQLite (free, never pauses) |
| Proxy / Auth | Cloudflare Worker (free) |
| Fonts | DM Sans + DM Mono via Google Fonts |

No frameworks. No npm. No build step.

---

## Architecture

```
Browser (GitHub Pages) → Cloudflare Worker → Cloudflare D1 (SQLite)
```

Every request carries an `X-App-Pin` header. The Worker validates the PIN before querying D1. The PIN lives only in the Cloudflare Worker — never in this repository.

---

## Files in this repo

| File | Purpose |
|---|---|
| `index.html` | The entire app — HTML, CSS and JavaScript |
| `worker.js` | Cloudflare Worker — paste into Cloudflare Worker editor |
| `d1-schema.sql` | Run once in D1 console to create tables |
| `README.md` | This file |
| `archive/Code.gs` | Legacy Google Apps Script — no longer used |

---

## Setup

### 1. Cloudflare D1 database

1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Go to **Workers & Pages → D1 → Create database**
3. Name it `home-bills`
4. Click on the database → **Console tab**
5. Run each statement from `d1-schema.sql` one at a time

### 2. Cloudflare Worker

1. Go to **Workers & Pages → Create → Start with Hello World**
2. Name it `home-bills`
3. Replace the code with the contents of `worker.js`
4. Set the PIN at the top:
   ```javascript
   const VALID_PIN = 'your-chosen-pin';
   ```
5. Click **Save and deploy**
6. Go to **Settings → Bindings → Add binding → D1 Database**
7. Set Variable name: `DB`, select your `home-bills` D1 database
8. Click **Add Binding**
9. Copy your Worker URL (e.g. `https://your-worker.yourname.workers.dev`)

### 3. Configure the app

1. Open `index.html` in a text editor
2. Find this line near the top of the `<script>` section:
   ```javascript
   const WORKER_URL = 'YOUR_CLOUDFLARE_WORKER_URL_HERE';
   ```
3. Replace with your Worker URL

### 4. Host on GitHub Pages

1. Create a new repository on GitHub
2. Upload `index.html`, `worker.js`, `d1-schema.sql` and `README.md`
3. Go to **Settings → Pages → Branch: main → Save**
4. Your app will be live at `https://yourusername.github.io/your-repo`

Share the URL with the other person — you both use the same link, everything syncs through the shared database.

---

## Updating the app

**index.html changes** — replace the file on GitHub, live within a minute. No other changes needed.

**worker.js changes:**
1. Go to Cloudflare → Workers → home-bills → Edit code
2. Make changes → Save and deploy
3. No changes needed to `index.html`

**Database changes:**
1. Go to Cloudflare → D1 → home-bills → Console
2. Run the relevant `ALTER TABLE` or `CREATE TABLE` statements
3. Update `worker.js` if new columns need to be mapped

---

## Natural language entry examples

| What you type | What it does |
|---|---|
| `paid 1200 mortgage` | Aleks paid €1200, category: mortgage, today's date |
| `Ivan paid 85 electricity` | Ivan paid €85, category: electricity |
| `paid 85 electricity on 12/06` | Aleks paid €85, date set to 12/06 |
| `paid 500 to Ivan ref mortgage` | Cash settlement: Aleks paid Ivan €500 |
| `paid 27 network security` | Aleks paid €27, category: security |

---

## Category keywords

| Category | Keywords |
|---|---|
| mortgage | mortgage, hipoteca |
| internet | internet, broadband, wifi, fibre, fiber |
| insurance | insurance, house insurance, home insurance |
| security | security, alarm, cctv |
| electricity | electricity, electric, energy |
| water | water |
| gas | gas, heating |
| groceries | groceries, supermarket, food, shopping, lidl, aldi |
| rent | rent, renda |
| phone | phone, mobile, vodafone, nos, meo |
| cleaning | cleaning, cleaner |
| maintenance | maintenance, repair, fix, plumber |

If no keyword matches, the most descriptive word in your entry is used as the category.

---

## Security

- The PIN is stored **only** in the Cloudflare Worker — never in this repository
- All requests require the correct PIN via the `X-App-Pin` header
- The PIN is stored in the browser's localStorage and sent automatically after first login
- D1 is only accessible via the Worker — there are no public API keys exposed
