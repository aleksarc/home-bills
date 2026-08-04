# 🏠 Home Bills

A personal household expense tracker for two people, built as a single HTML page hosted on GitHub Pages, with Supabase (PostgreSQL) as the database and a Cloudflare Worker as a secure proxy.

No subscriptions. No backend servers. No app store. Just open the link and start tracking.

---

## What it does

Home Bills lets two people log shared household expenses via natural language, automatically splits the total 50/50, and always shows who owes whom and how much. Everything syncs in real time through a Supabase database.

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
| Database | Supabase — hosted PostgreSQL |
| Proxy / Auth | Cloudflare Worker (free) |
| Fonts | DM Sans + DM Mono via Google Fonts |

No frameworks. No npm. No build step.

---

## Architecture

```
Browser (GitHub Pages) → Cloudflare Worker → Supabase PostgreSQL
```

Every request carries an `X-App-Pin` header. The Worker validates the PIN before forwarding to Supabase. The Supabase service_role key lives only in the Cloudflare Worker — never in this repository.

---

## Files in this repo

| File | Purpose |
|---|---|
| `index.html` | The entire app — HTML, CSS and JavaScript |
| `worker.js` | Cloudflare Worker — paste into Cloudflare Worker editor |
| `schema.sql` | Run once in Supabase SQL Editor to create tables |
| `README.md` | This file |
| `archive/Code.gs` | Legacy Google Apps Script — no longer used |

---

## Setup

### 1. Supabase database

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** and run the contents of `schema.sql`
4. Go to **Settings → API** and copy:
   - Project URL (e.g. `https://yourproject.supabase.co`)
   - `service_role` key (keep this secret)

### 2. Cloudflare Worker

1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Go to **Workers & Pages → Create → Start with Hello World**
3. Replace the code with the contents of `worker.js`
4. Fill in the three constants at the top:
   ```javascript
   const SUPABASE_URL = 'https://yourproject.supabase.co';
   const SUPABASE_KEY = 'your-service-role-key';
   const VALID_PIN    = 'your-chosen-pin';
   ```
5. Click **Save and deploy**
6. Copy your Worker URL (e.g. `https://your-worker.yourname.workers.dev`)

### 3. Configure the app

1. Open `index.html` in a text editor
2. Find this line near the top of the `<script>` section:
   ```javascript
   const WORKER_URL = 'YOUR_CLOUDFLARE_WORKER_URL_HERE';
   ```
3. Replace with your Worker URL

### 4. Host on GitHub Pages

1. Create a new repository on GitHub
2. Upload `index.html`, `worker.js`, `schema.sql` and `README.md`
3. Go to **Settings → Pages → Branch: main → Save**
4. Your app will be live at `https://yourusername.github.io/your-repo`

Share the URL with the other person — you both use the same link, everything syncs through the shared database.

---

## Updating the app

**index.html changes** — replace the file on GitHub, live within a minute. No other changes needed.

**worker.js changes:**
1. Go to Cloudflare → Workers → your worker → Edit code
2. Make changes → Save and deploy
3. No changes needed to `index.html`

**Database changes:**
1. Go to Supabase → SQL Editor
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

- The Supabase service_role key is stored **only** in the Cloudflare Worker — never in this repository
- Row Level Security (RLS) is enabled on all tables — the anon key cannot access any data
- All requests require the correct PIN via the `X-App-Pin` header
- The PIN is stored in the browser's localStorage and sent automatically after first login
