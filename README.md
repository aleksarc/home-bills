# 🏠 Home Bills

Home Bills is a small household expense tracker for Aleks and Ivan. It is a single-page web app hosted on GitHub Pages, with a Cloudflare Worker handling authentication and database access and Cloudflare D1 storing the data.

It is designed for private household use: record shared bills, split them equally, register settlements, and carry any remaining balance safely from one month to the next.

## What it does

- Records expenses using short, natural-language descriptions.
- Tracks which person paid each bill.
- Splits ordinary household bills 50/50.
- Records direct payments between Aleks and Ivan as settlements.
- Shows the current balance and who owes whom.
- Groups spending by category.
- Closes months and carries the final balance into the following month.
- Reopens closed months safely when a correction is required.
- Supports multiple years and optional custom sheets.
- Uses a PIN-protected Cloudflare Worker for all database requests.
- Provides responsive light and dark layouts without a build step.

Data is shared through D1 and refreshed when the app loads or performs an action. The app does not use push updates, so another browser that is already open may need to be reloaded to display a change made elsewhere.

## Balance rules

Home Bills keeps three kinds of financial records separate:

1. **Ordinary bills** count towards the amount paid by Aleks or Ivan and are split equally.
2. **Settlements** are direct transfers between the two people. They adjust the outstanding balance but are not counted as household spending.
3. **Balance carry-overs** contain the final balance from the previous month. They are applied once at their full value and are not divided by two or counted as a new bill.

Closing notes are display-only records and never participate in calculations.

In simplified form, the balance is calculated as:

```text
(Aleks's bills - Ivan's bills) / 2
+ previous balance
- payments Ivan sent to Aleks
+ payments Aleks sent to Ivan
```

A positive result means Ivan owes Aleks. A negative result means Aleks owes Ivan.

## Closing and reopening months

When a month is closed, the app performs the complete operation together:

- Saves the month's final totals in `closed_months`.
- Adds a closing note to the closed month.
- Adds the outstanding balance to the next month as a carry-over, unless the balance is fully settled.
- Prevents entries in the closed month from being added or deleted.

The frontend blocks changes to closed months, and the Worker independently enforces the same rule.

To preserve the balance chain, closed months must be reopened in reverse chronological order. If a later month is closed, it must be reopened before an earlier month. Reopening removes that month's closing note and the corresponding carry-over from the following month.

## How it is built

| Part | Technology |
|---|---|
| Frontend | One `index.html` file with vanilla HTML, CSS, and JavaScript |
| Hosting | GitHub Pages |
| API and PIN validation | Cloudflare Worker |
| Database | Cloudflare D1 (SQLite) |
| Fonts | DM Sans and DM Mono from Google Fonts |

```text
Browser on GitHub Pages -> Cloudflare Worker -> Cloudflare D1
```

There are no frameworks, package dependencies, build commands, or servers to manage.

## Repository files

| File | Purpose |
|---|---|
| `index.html` | Complete browser application, including its styles and JavaScript |
| `worker.js` | Cloudflare Worker API, validation, PIN protection, and D1 operations |
| `d1-schema.sql` | Initial D1 tables and indexes |
| `README.md` | Project documentation |
| `archive/Code.gs` | Legacy Google Apps Script retained for reference; it is not used by the current app |

## Installation

### 1. Create the D1 database

1. Sign in to [Cloudflare](https://dash.cloudflare.com/).
2. Open the Workers and D1 area and create a D1 database.
3. Give the database a name such as `home-bills`.
4. Open its SQL console.
5. Run the statements in `d1-schema.sql`.

The schema creates the `entries`, `closed_months`, and `custom_sheets` tables and their indexes.

### 2. Create the Cloudflare Worker

1. Create a Worker, using a name such as `home-bills`.
2. Replace its starter code with the complete contents of `worker.js`.
3. Add a D1 database binding:
   - Binding or variable name: `DB`
   - Database: the D1 database created above
4. Add an encrypted Worker secret:
   - Name: `APP_PIN`
   - Value: the private PIN that Aleks and Ivan will use
5. Deploy the Worker and copy its `workers.dev` URL.

Cloudflare's menu labels can vary. The D1 binding and encrypted secret are normally found in the Worker's **Settings**, under **Bindings** and **Variables and Secrets**.

Do not add the PIN to `worker.js`, `index.html`, this README, or any other committed file. The Worker reads it at runtime from `env.APP_PIN`.

### 3. Connect the app to the Worker

Open `index.html`, find the existing `WORKER_URL` setting near the beginning of the script, and replace its value with your own Worker URL:

```javascript
const WORKER_URL = 'https://your-worker.your-subdomain.workers.dev';
```

Do not add a trailing slash.

### 4. Publish with GitHub Pages

1. Put `index.html`, `worker.js`, `d1-schema.sql`, and `README.md` in a GitHub repository.
2. Open the repository's **Settings -> Pages**.
3. Select the branch and folder that contain `index.html`.
4. Save the Pages configuration and wait for deployment to finish.
5. Open the published GitHub Pages URL and enter the `APP_PIN` value when prompted.

Both people use the same published URL and PIN, and their data is stored in the same D1 database.

## Using the app

### Add an ordinary bill

1. Select **Aleks** or **Ivan** above the entry field. This selector determines who paid; a person's name typed in the description does not change the payer.
2. Choose the destination under **Save to**.
3. Enter the amount and description.
4. Check the preview and select **Add**.

Examples:

| Selection | Text entered | Result |
|---|---|---|
| Aleks | `paid 1200 mortgage` | Aleks paid a EUR 1,200 mortgage bill today |
| Ivan | `paid 85 electricity` | Ivan paid an EUR 85 electricity bill today |
| Aleks | `paid 85 electricity on 12/06/2026` | Aleks paid an EUR 85 electricity bill on 12 June 2026 |
| Aleks | `paid 27 network security` | Aleks paid an EUR 27 security bill |

The amount may use a decimal point or comma. It must be greater than zero.

Dates may use `/`, `-`, or `.` and can be written as `dd/mm`, `dd/mm/yy`, or `dd/mm/yyyy`, optionally preceded by `on`. When no date is supplied, the current date is used. Invalid calendar dates and invalid, zero, or negative amounts are rejected with a specific message.

### Add a settlement

Select the person sending the money, then name the recipient in the entry:

| Selection | Text entered | Result |
|---|---|---|
| Ivan | `paid 500 to Aleks ref mortgage` | Ivan sent Aleks EUR 500 |
| Aleks | `paid 200 to Ivan` | Aleks sent Ivan EUR 200 |

The optional text after `ref` becomes the settlement description. Settlements reduce or reverse the outstanding balance as appropriate; they do not increase either person's bill total.

### View the data

- **Entries** shows the records and bill totals for the selected month or custom sheet.
- **By category** groups ordinary bills by their detected category. Settlements, carry-overs, and closing notes are excluded.
- **Closed months** shows the saved results for all closed months.

### Add a year or custom sheet

**New year** makes all twelve virtual monthly views available for the selected year. A year with saved entries is loaded from D1 on future visits. **New sheet** creates a separately named custom sheet, useful for a project or another collection of costs. Custom sheets are not part of the monthly close-and-carry-over chain.

## Automatic categories

The app checks the cleaned description for the following keywords:

| Category | Recognised keywords |
|---|---|
| mortgage | mortgage, hipoteca |
| internet | internet, broadband, wifi, wi-fi, fibre, fiber, router, eir internet |
| insurance | insurance, house insurance, home insurance |
| security | security, alarm, cctv, camera, cameras, eufy |
| electricity | electricity, electric, energy, electric ireland |
| water | water |
| gas | gas, heating |
| groceries | groceries, supermarket, food, shopping, lidl, aldi |
| rent | rent, renda |
| phone | phone, mobile, vodafone, nos, meo |
| cleaning | cleaning, cleaner |
| maintenance | maintenance, repair, fix, plumber |
| garden | garden, grass, lawn, outdoor, b&q chairs, bbq |
| house | lamp, ikea, furniture, house, floor, flooring, stairs, carpet, kitchen |
| messi | messi, butternut, dog, pet, petshop |

Matching is case-insensitive. If no keyword matches, the app uses a suitable word from the description as the category, or `other` when none is available.

## Updating the app

### Frontend changes

Update `index.html` in the GitHub Pages source branch. GitHub Pages normally republishes it automatically.

### Worker changes

Keep the repository's `worker.js` and the deployed Cloudflare Worker code identical. After changing the file, copy or deploy the updated Worker code in Cloudflare and verify the deployment.

### Database changes

Back up the current D1 data before structural or corrective changes. Run only the required SQL in the D1 console and verify the affected rows afterwards. `d1-schema.sql` describes a new installation; it is not a replacement for a populated database.

## Security notes

- The private PIN is stored as the encrypted Cloudflare Worker secret `APP_PIN`, not in this repository.
- Every API request must supply the PIN in the `X-App-Pin` header.
- After a successful login, the browser keeps the PIN in `localStorage` so it can authenticate later requests.
- D1 is reached through the Worker; the browser contains no D1 credentials or public database key.
- The Worker validates entries, settlements, dates, identifiers, custom sheet names, close requests, and reopen requests before changing D1.
- CORS permits the browser frontend to call the Worker from GitHub Pages.

This is a practical access gate for a trusted household app, not a multi-user identity system. Use a unique PIN that is not reused for an important account, and avoid using the app on an untrusted shared device because the PIN remains in that browser's local storage.

## Backup

For this small dataset, exporting the D1 tables to CSV before database corrections or schema changes provides a simple additional backup. Keep backups somewhere private because they contain household financial information.
