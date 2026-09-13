// =====================================================
// HOME BILLS — Cloudflare Worker with D1 Database
// =====================================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function calendarSheetParts(sheet) {
  if (typeof sheet !== 'string') return null;
  const parts = sheet.split(' - ');
  if (
    parts.length !== 2 ||
    !/^\d{4}$/.test(parts[0]) ||
    !MONTHS.includes(parts[1])
  ) return null;

  return { year: Number(parts[0]), month: parts[1] };
}

function isValidDate(date) {
  if (typeof date !== 'string') return false;
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

async function isSheetClosed(db, sheet) {
  const result = await db.prepare(
    `SELECT 1
     FROM closed_months
     WHERE CAST(year AS TEXT) || ' - ' || month = ?
     LIMIT 1`
  ).bind(sheet).first();

  return Boolean(result);
}

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') return cors('', 204);

    // PIN check
    const pin = request.headers.get('X-App-Pin');
    if (!env.APP_PIN || pin !== env.APP_PIN) {
      return cors(JSON.stringify({ error: 'Unauthorized' }), 401);
    }

    const url = new URL(request.url);
    const db = env.DB; // D1 database binding

    try {
      if (request.method === 'GET') {
        const action = url.searchParams.get('action');

        if (action === 'getVersion') {
          return cors(JSON.stringify({ version: '4.0' }), 200);
        }

        if (action === 'getSheets') {
          const yearsResult = await db.prepare(
            'SELECT DISTINCT year FROM entries ORDER BY year ASC'
          ).all();

          const sheetsResult = await db.prepare(
            'SELECT name FROM custom_sheets ORDER BY name ASC'
          ).all();

          let years = yearsResult.results.map(r => r.year);
          const curYear = new Date().getFullYear();

          if (!years.includes(curYear)) years.push(curYear);

          const customSheets = sheetsResult.results.map(r => r.name);

          return cors(JSON.stringify({ years, customSheets }), 200);
        }

        if (action === 'getEntries') {
          const sheet = url.searchParams.get('sheet');

          const result = await db.prepare(
            'SELECT * FROM entries WHERE sheet = ? ORDER BY id ASC'
          ).bind(sheet).all();

          function parseDMY(d) {
            if (!d) return 0;

            const [dd, mm, yyyy] = d.split('/');
            return new Date(`${yyyy}-${mm}-${dd}`).getTime();
          }

          const entries = result.results.map(row => ({
            rowIndex: row.id,
            date: row.date,
            desc: row.description,
            cat: row.category,
            who: row.who,
            amount: row.amount,
            isTransfer: row.is_transfer === 1,
            toWho: row.to_who || '',
            month: row.month,
            year: row.year,
            isClosingNote: row.is_closing_note === 1,
            sheet: row.sheet,
          })).sort((a, b) => {
            if (a.cat === 'balance carry-over') return -1;
            if (b.cat === 'balance carry-over') return 1;
            if (a.isClosingNote) return 1;
            if (b.isClosingNote) return -1;

            return parseDMY(a.date) - parseDMY(b.date);
          });

          return cors(JSON.stringify({ entries }), 200);
        }

        if (action === 'getClosedMonths') {
          const result = await db.prepare(
            'SELECT * FROM closed_months ORDER BY year ASC, id ASC'
          ).all();

          const closedMonths = result.results.map(row => ({
            month: row.month,
            year: row.year,
            aleksSpend: row.aleks_spend,
            ivanSpend: row.ivan_spend,
            totalBills: row.total_bills,
            netDiff: row.net_diff,
            settled: row.settled === 1,
            closedAt: row.closed_at,
          }));

          return cors(JSON.stringify({ closedMonths }), 200);
        }

        return cors(JSON.stringify({ error: 'Unknown action' }), 400);
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const { action } = body;

        if (action === 'addEntry') {
          const e = body.entry;

          if (
            !e ||
            !['Aleks', 'Ivan'].includes(e.who) ||
            typeof e.amount !== 'number' ||
            !Number.isFinite(e.amount) ||
            e.amount <= 0 ||
            typeof e.desc !== 'string' ||
            !e.desc.trim() ||
            e.desc.length > 500 ||
            typeof e.cat !== 'string' ||
            !e.cat.trim() ||
            e.cat.length > 80 ||
            typeof e.month !== 'string' ||
            !MONTHS.includes(e.month) ||
            !Number.isInteger(Number(e.year)) ||
            typeof e.sheet !== 'string' ||
            !e.sheet.trim() ||
            e.sheet.length > 100 ||
            typeof e.isTransfer !== 'boolean' ||
            !isValidDate(e.date)
          ) {
            return cors(JSON.stringify({ error: 'Invalid entry data' }), 400);
          }

          const calendarSheet = calendarSheetParts(e.sheet);

          if (
            calendarSheet &&
            (calendarSheet.month !== e.month || calendarSheet.year !== Number(e.year))
          ) {
            return cors(JSON.stringify({ error: 'Entry month does not match its sheet' }), 400);
          }

          if (
            (e.isTransfer && (
              e.cat !== 'settlement' ||
              !['Aleks', 'Ivan'].includes(e.toWho) ||
              e.toWho === e.who
            )) ||
            (!e.isTransfer && e.cat === 'settlement')
          ) {
            return cors(JSON.stringify({ error: 'Invalid settlement data' }), 400);
          }

          if (
            e.isClosingNote ||
            e.cat === 'closing note' ||
            e.cat === 'balance carry-over'
          ) {
            return cors(JSON.stringify({ error: 'Managed balance entries cannot be added manually' }), 400);
          }

          if (await isSheetClosed(db, e.sheet)) {
            return cors(JSON.stringify({ error: 'This month is closed' }), 409);
          }

          const result = await db.prepare(
            `INSERT INTO entries (
              date,
              description,
              category,
              who,
              amount,
              is_transfer,
              to_who,
              month,
              year,
              sheet,
              is_closing_note
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            e.date,
            e.desc,
            e.cat,
            e.who,
            e.amount,
            e.isTransfer ? 1 : 0,
            e.toWho || '',
            e.month,
            e.year,
            e.sheet,
            e.isClosingNote ? 1 : 0
          ).run();

          return cors(
            JSON.stringify({
              success: true,
              id: result.meta.last_row_id,
            }),
            200
          );
        }

        if (action === 'deleteEntry') {
          const rowIndex = Number(body.rowIndex);

          if (!Number.isInteger(rowIndex) || rowIndex < 1) {
            return cors(JSON.stringify({ error: 'Invalid entry ID' }), 400);
          }

          const entry = await db.prepare(
            'SELECT sheet FROM entries WHERE id = ?'
          ).bind(rowIndex).first();

          if (!entry) {
            return cors(JSON.stringify({ error: 'Entry not found' }), 404);
          }

          if (await isSheetClosed(db, entry.sheet)) {
            return cors(JSON.stringify({ error: 'This month is closed' }), 409);
          }

          await db.prepare(
            'DELETE FROM entries WHERE id = ?'
          ).bind(rowIndex).run();

          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'closeMonthAtomic') {
          const d = body.monthData;
          const note = body.closingNote;
          const carry = body.carryOver || null;
          const { nextMonth, nextYear, nextSheet } = body;
          const targetMonthIndex = d ? MONTHS.indexOf(d.month) : -1;
          const parsedYear = d ? Number(d.year) : NaN;
          const parsedNextYear = Number(nextYear);
          const expectedNextIndex = (targetMonthIndex + 1) % 12;
          const expectedNextYear = expectedNextIndex === 0
            ? parsedYear + 1
            : parsedYear;
          const targetSheet = d ? `${parsedYear} - ${d.month}` : '';
          const expectedNextSheet = `${parsedNextYear} - ${nextMonth}`;

          if (
            !d ||
            !note ||
            targetMonthIndex < 0 ||
            !Number.isInteger(parsedYear) ||
            MONTHS[expectedNextIndex] !== nextMonth ||
            parsedNextYear !== expectedNextYear ||
            nextSheet !== expectedNextSheet ||
            note.sheet !== targetSheet ||
            note.month !== d.month ||
            Number(note.year) !== parsedYear ||
            note.cat !== 'closing note' ||
            note.isClosingNote !== true ||
            note.isTransfer !== false ||
            !isValidDate(note.date) ||
            typeof d.aleksSpend !== 'number' ||
            !Number.isFinite(d.aleksSpend) ||
            d.aleksSpend < 0 ||
            typeof d.ivanSpend !== 'number' ||
            !Number.isFinite(d.ivanSpend) ||
            d.ivanSpend < 0 ||
            typeof d.totalBills !== 'number' ||
            !Number.isFinite(d.totalBills) ||
            typeof d.netDiff !== 'number' ||
            !Number.isFinite(d.netDiff) ||
            typeof d.settled !== 'boolean' ||
            Math.abs(d.totalBills - (d.aleksSpend + d.ivanSpend)) > 0.01 ||
            d.settled !== (Math.abs(d.netDiff) < 0.02) ||
            typeof note.amount !== 'number' ||
            !Number.isFinite(note.amount) ||
            (d.settled
              ? note.amount !== 0 || note.who !== '' || (note.toWho || '') !== ''
              : Math.abs(note.amount - Math.abs(d.netDiff)) > 0.01 ||
                !['Aleks', 'Ivan'].includes(note.who) ||
                !['Aleks', 'Ivan'].includes(note.toWho) ||
                note.who === note.toWho ||
                note.toWho !== (d.netDiff > 0 ? 'Aleks' : 'Ivan') ||
                note.who !== (d.netDiff > 0 ? 'Ivan' : 'Aleks'))
          ) {
            return cors(JSON.stringify({ error: 'Invalid close month data' }), 400);
          }

          if (
            (d.settled && carry) ||
            (!d.settled && (
              !carry ||
              !['Aleks', 'Ivan'].includes(carry.who) ||
              carry.cat !== 'balance carry-over' ||
              carry.isClosingNote !== false ||
              carry.isTransfer !== false ||
              carry.sheet !== nextSheet ||
              carry.month !== nextMonth ||
              Number(carry.year) !== parsedNextYear ||
              !isValidDate(carry.date) ||
              typeof carry.amount !== 'number' ||
              !Number.isFinite(carry.amount) ||
              Math.abs(carry.amount - Math.abs(d.netDiff)) > 0.01 ||
              carry.who !== note.toWho
            ))
          ) {
            return cors(JSON.stringify({ error: 'Invalid carry-over data' }), 400);
          }

          if (await isSheetClosed(db, nextSheet)) {
            return cors(JSON.stringify({
              error: `Reopen ${nextMonth} ${parsedNextYear} before closing ${d.month} ${parsedYear}`,
            }), 409);
          }

          const statements = [
            db.prepare(
              `INSERT INTO closed_months (
                month,
                year,
                aleks_spend,
                ivan_spend,
                total_bills,
                net_diff,
                settled,
                closed_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(month, year) DO UPDATE SET
                aleks_spend = excluded.aleks_spend,
                ivan_spend  = excluded.ivan_spend,
                total_bills = excluded.total_bills,
                net_diff    = excluded.net_diff,
                settled     = excluded.settled,
                closed_at   = excluded.closed_at`
            ).bind(
              d.month,
              d.year,
              d.aleksSpend,
              d.ivanSpend,
              d.totalBills,
              d.netDiff,
              d.settled ? 1 : 0,
              d.closedAt
            ),

            db.prepare(
              'DELETE FROM entries WHERE sheet = ? AND is_closing_note = 1'
            ).bind(note.sheet),

            db.prepare(
              `DELETE FROM entries
               WHERE sheet = ?
                 AND category = 'balance carry-over'`
            ).bind(nextSheet),

            db.prepare(
              `INSERT INTO entries (
                date,
                description,
                category,
                who,
                amount,
                is_transfer,
                to_who,
                month,
                year,
                sheet,
                is_closing_note
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              note.date,
              note.desc,
              note.cat,
              note.who,
              note.amount,
              note.isTransfer ? 1 : 0,
              note.toWho || '',
              note.month,
              note.year,
              note.sheet,
              note.isClosingNote ? 1 : 0
            ),
          ];

          if (carry) {
            statements.push(
              db.prepare(
                `INSERT INTO entries (
                  date,
                  description,
                  category,
                  who,
                  amount,
                  is_transfer,
                  to_who,
                  month,
                  year,
                  sheet,
                  is_closing_note
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                carry.date,
                carry.desc,
                carry.cat,
                carry.who,
                carry.amount,
                carry.isTransfer ? 1 : 0,
                carry.toWho || '',
                carry.month,
                carry.year,
                carry.sheet,
                carry.isClosingNote ? 1 : 0
              )
            );
          }

          await db.batch(statements);

          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'reopenMonth') {
          const { month, year, nextMonth, nextYear } = body;
          const parsedYear = Number(year);
          const parsedNextYear = Number(nextYear);
          const monthIndex = MONTHS.indexOf(month);
          const expectedNextIndex = (monthIndex + 1) % 12;
          const expectedNextYear = expectedNextIndex === 0
            ? parsedYear + 1
            : parsedYear;

          if (
            monthIndex < 0 ||
            !Number.isInteger(parsedYear) ||
            MONTHS[expectedNextIndex] !== nextMonth ||
            parsedNextYear !== expectedNextYear
          ) {
            return cors(JSON.stringify({ error: 'Invalid reopen month data' }), 400);
          }

          const closedResult = await db.prepare(
            'SELECT month, year FROM closed_months'
          ).all();

          const targetOrder = parsedYear * 12 + monthIndex;
          const orderedClosed = closedResult.results.map(item => ({
            ...item,
            order: Number(item.year) * 12 + MONTHS.indexOf(item.month),
          }));

          const targetClosed = orderedClosed.some(item =>
            item.month === month && Number(item.year) === parsedYear
          );

          if (!targetClosed) {
            return cors(JSON.stringify({ error: 'Month is not closed' }), 409);
          }

          const laterClosed = orderedClosed
            .filter(item => item.order > targetOrder)
            .sort((a, b) => b.order - a.order);

          if (laterClosed.length) {
            const latest = laterClosed[0];
            return cors(JSON.stringify({
              error: `Reopen ${latest.month} ${latest.year} first to preserve the balance chain`,
            }), 409);
          }

          const sheet = `${parsedYear} - ${month}`;
          const nextSheet = `${parsedNextYear} - ${nextMonth}`;

          await db.batch([
            db.prepare(
              'DELETE FROM entries WHERE sheet = ? AND is_closing_note = 1'
            ).bind(sheet),

            db.prepare(
              `DELETE FROM entries
       WHERE sheet = ?
         AND category = ?
         AND month = ?
         AND year = ?`
            ).bind(
              nextSheet,
              'balance carry-over',
              nextMonth,
              parsedNextYear
            ),

            db.prepare(
              'DELETE FROM closed_months WHERE month = ? AND year = ?'
            ).bind(month, parsedYear),
          ]);

          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'addYear') {
          // No-op for D1 — month sheets are virtual
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'createSheet') {
          const name = typeof body.name === 'string' ? body.name.trim() : '';

          if (!name || name.length > 100 || calendarSheetParts(name)) {
            return cors(JSON.stringify({ error: 'Invalid custom sheet name' }), 400);
          }

          await db.prepare(
            `INSERT INTO custom_sheets (name)
             VALUES (?)
             ON CONFLICT(name) DO NOTHING`
          ).bind(name).run();

          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'deleteSheet') {
          const name = body.name;

          if (typeof name !== 'string' || !name.trim()) {
            return cors(JSON.stringify({ error: 'Invalid sheet name' }), 400);
          }

          const customSheet = await db.prepare(
            'SELECT 1 FROM custom_sheets WHERE name = ? LIMIT 1'
          ).bind(name).first();

          if (!customSheet) {
            return cors(JSON.stringify({ error: 'Custom sheet not found' }), 404);
          }

          await db.batch([
            db.prepare(
              'DELETE FROM entries WHERE sheet = ?'
            ).bind(name),

            db.prepare(
              'DELETE FROM custom_sheets WHERE name = ?'
            ).bind(name),
          ]);

          return cors(JSON.stringify({ success: true }), 200);
        }

        return cors(JSON.stringify({ error: 'Unknown action' }), 400);
      }

      return cors(JSON.stringify({ error: 'Method not allowed' }), 405);

    } catch (err) {
      return cors(JSON.stringify({ error: err.message }), 500);
    }
  }
};

function cors(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Pin',
    },
  });
}