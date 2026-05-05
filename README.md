# 🏠 Home Bills

A personal household expense tracker for two people, built as a single HTML page hosted on GitHub Pages, with Google Sheets as the database.

No subscriptions. No backend servers. No app store. Just open the link and start tracking.

---

## What it does

Home Bills lets two people log shared household expenses via natural language, automatically splits the total in two, and always shows who owes whom and how much. Everything syncs in real time through a shared Google Sheet.

---

## Features

### Natural language entry
Type expenses the way you'd say them out loud. The app parses your message and extracts the amount, category, and month automatically.

Examples:
- `paid 1200 mortgage` → Aleks paid €1200, category: mortgage, current month
- `Ivan paid 85 electricity` → Ivan paid €85, category: electricity
- `paid 500 to Ivan ref mortgage April` → cash settlement of €500 from Aleks to Ivan, reference: mortgage, month: April
- `paid 27 network security` → Aleks paid €27, category: security

The month is optional — it defaults to the current month if not mentioned. You can include any month name to log an entry for a different month.

### Who paid selector
Before typing, select whether the entry is from **Aleks** or **Ivan**. The active person is highlighted. This determines who the expense is attributed to.

### Live parse preview
As you type, a preview line appears below the input showing how the app interpreted your message — who, amount, category, and month — before you submit. This helps catch mistakes before saving.

### Automatic category detection
The app recognises the following built-in categories from keywords in your entry:

| Category | Keywords recognised |
|---|---|
| Mortgage | mortgage, hipoteca |
| Internet | internet, broadband, wifi, fibre, fiber |
| Insurance | insurance, house insurance, home insurance |
| Security | security, alarm, cctv |
| Electricity | electricity, electric, energy, electric ireland |
| Water | water |
| Gas | gas, heating |
| Groceries | groceries, supermarket, food, shopping, lidl, aldi |
| Rent | rent, renda |
| Phone | phone, mobile, vodafone, nos, meo |
| Cleaning | cleaning, cleaner |
| Maintenance | maintenance, repair, fix, plumber |

If no built-in category is matched, the app picks the most descriptive word from your entry as the category label.

### Balance calculation
The app always shows:
- **Aleks paid** — total bills paid by Aleks this month
- **Ivan paid** — total bills paid by Ivan this month
- **Total bills** — combined, with the fair share (50/50 split) shown below
- **Who owes whom** — the net amount one person needs to pay the other to balance the month

### Cash settlements
When one person pays the other directly (not a shared bill), type it as:
`paid 500 to Ivan ref mortgage`

This records a cash transfer. It reduces the debt directly — the full amount is deducted from what is owed, not halved. Settlement entries appear dimmed in the entries list to distinguish them from regular bills.

### Sheet selector (Save to)
When adding an entry, you can choose which sheet to save it to — the current month, any other month, or a custom sheet. The default is always the current month.

### Viewing dropdown
In the Entries tab, a dropdown lets you switch between any month or custom sheet. The dropdown is grouped by year. The app loads on the current month by default.

### Month sheets grouped by year
Each year has its own group of 12 month sheets in Google Sheets, named `2026 - January`, `2026 - February`, etc. Years are clearly separated in both the app dropdowns and the spreadsheet.

### Add a new year
Click **+ New year** to create all 12 month sheets for a new year in one go. The app asks which year and creates them automatically in your Google Sheet. This is how you start a new year — no manual setup needed.

### Custom sheets
Click **+ New sheet** to create a custom sheet alongside the monthly ones. Useful for tracking a specific project over time, such as house improvements or renovation costs. Custom sheets appear in both the Viewing and Save to dropdowns, under a separate group.

### Close month
When you're ready to wrap up a month, click **Close month** (always visible in the toolbar when viewing the current month) or use the end-of-month popup that appears in the last 5 days of the month.

Closing a month does the following:
1. Archives the month's summary to the closed months log
2. Adds a **closing note** at the bottom of that month's sheet — either "Balance forward: fully settled" or "Balance forward: [person] owes [person] €X" — for reference
3. If there is an outstanding balance, automatically creates a **carry-over entry** at the top of the next month, so the debt is tracked into the new month
4. Switches the view to the next month

The closing note is display-only and does not affect any totals.

### Month-end reminder
In the last 5 days of the month, a yellow banner appears at the top with options to **Close month** or **Postpone**. Postponing dismisses it until the next time you open the app.

### By category tab
Shows a breakdown of all spending in the current view, sorted by amount, with a horizontal bar chart. Useful for seeing where most of the month's money went.

### Closed months tab
A history of all closed months, showing Aleks's spend, Ivan's spend, total, and whether the month was settled or had an outstanding balance carried forward.

### Sync indicator
A small dot in the top right corner shows the connection status:
- 🟢 Green — synced with Google Sheets
- 🟡 Amber (pulsing) — syncing in progress
- 🔴 Red — connection error

### Optimistic UI
When you add an entry, it appears in the list immediately while saving to Google Sheets in the background. If the save fails, you'll see an error toast notification.

### Delete entries
On desktop, hover over any row to reveal a delete button (✕) on the right. On mobile, it appears as a small ✕ in the corner of each entry card. Deleting removes the entry from Google Sheets.

### Dark mode
The app respects your device's dark/light mode preference automatically.

### Mobile friendly
The layout adapts to mobile screens. On mobile, entries are shown as compact cards instead of a table. The three main sections (balance overview, add entry, entries list) are visually separated for easier reading.

---

## How it's built

| Part | Technology |
|---|---|
| Frontend | Single HTML file with vanilla JS and CSS |
| Hosting | GitHub Pages (free) |
| Database | Google Sheets |
| Backend | Google Apps Script (free, deployed as a Web App) |
| Fonts | DM Sans + DM Mono via Google Fonts |

No frameworks. No npm. No build step. Open the HTML file and it works.

---

## Setup

### 1. Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Name it **Home Bills**
3. Open **Extensions → Apps Script**
4. Delete everything in the editor and paste the contents of `Code.gs`
5. Press **Cmd+S / Ctrl+S** to save
6. In the function dropdown, select **setupSpreadsheet** and click **Run**
7. Accept the permissions prompt — this creates all 12 month sheets for the current year

### 2. Deploy the Apps Script

1. Click **Deploy → New deployment**
2. Click the gear icon → select **Web app**
3. Set **Execute as: Me** and **Who has access: Anyone**
4. Click **Deploy** and copy the URL (ends in `/exec`)

### 3. Configure the app

1. Open `index.html` in a text editor
2. Find this line near the top of the `<script>` section:
   ```
   const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
   ```
3. Replace `YOUR_APPS_SCRIPT_URL_HERE` with your deployed URL

### 4. Host on GitHub Pages

1. Create a new repository on GitHub (e.g. `home-bills`)
2. Upload `index.html` and `README.md`
3. Go to **Settings → Pages → Branch: main → Save**
4. Your app will be live at `https://yourusername.github.io/home-bills`

Share the URL with the other person — you both use the same link, and everything syncs through the shared Google Sheet.

---

## Updating the app

Any time `index.html` is updated:
1. Download the new file
2. Replace the old one on GitHub (drag and drop)
3. No changes needed to `Code.gs` or the deployed URL unless specified

If `Code.gs` is updated:
1. Paste the new code into Apps Script
2. **Cmd+S / Ctrl+S to save**
3. **Deploy → Manage deployments → edit existing → New version → Deploy**
4. The URL stays the same

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — HTML, CSS, and JavaScript |
| `Code.gs` | Google Apps Script backend — paste into Apps Script editor |
| `README.md` | This file |
