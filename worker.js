// =====================================================
// HOME BILLS — Cloudflare Worker with D1 Database
// =====================================================

const VALID_PIN = '198427';

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') return cors('', 204);

    // PIN check
    const pin = request.headers.get('X-App-Pin');
    if (pin !== VALID_PIN) return cors(JSON.stringify({ error: 'Unauthorized' }), 401);

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
            rowIndex:      row.id,
            date:          row.date,
            desc:          row.description,
            cat:           row.category,
            who:           row.who,
            amount:        row.amount,
            isTransfer:    row.is_transfer === 1,
            toWho:         row.to_who || '',
            month:         row.month,
            year:          row.year,
            isClosingNote: row.is_closing_note === 1,
            sheet:         row.sheet,
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
            month:      row.month,
            year:       row.year,
            aleksSpend: row.aleks_spend,
            ivanSpend:  row.ivan_spend,
            totalBills: row.total_bills,
            netDiff:    row.net_diff,
            settled:    row.settled === 1,
            closedAt:   row.closed_at,
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
          const result = await db.prepare(
            `INSERT INTO entries (date, description, category, who, amount, is_transfer, to_who, month, year, sheet, is_closing_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            e.date, e.desc, e.cat, e.who, e.amount,
            e.isTransfer ? 1 : 0, e.toWho || '',
            e.month, e.year, e.sheet,
            e.isClosingNote ? 1 : 0
          ).run();
          return cors(JSON.stringify({ success: true, id: result.meta.last_row_id }), 200);
        }

        if (action === 'deleteEntry') {
          await db.prepare('DELETE FROM entries WHERE id = ?').bind(body.rowIndex).run();
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'closeMonth') {
          const d = body.monthData;
          await db.prepare(
            `INSERT INTO closed_months (month, year, aleks_spend, ivan_spend, total_bills, net_diff, settled, closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(month, year) DO UPDATE SET
               aleks_spend = excluded.aleks_spend,
               ivan_spend  = excluded.ivan_spend,
               total_bills = excluded.total_bills,
               net_diff    = excluded.net_diff,
               settled     = excluded.settled,
               closed_at   = excluded.closed_at`
          ).bind(
            d.month, d.year, d.aleksSpend, d.ivanSpend,
            d.totalBills, d.netDiff, d.settled ? 1 : 0, d.closedAt
          ).run();
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'reopenMonth') {
          const { month, year, nextMonth, nextYear } = body;
          const sheet = `${year} - ${month}`;
          const nextSheet = `${nextYear} - ${nextMonth}`;
          await db.prepare(
            'DELETE FROM entries WHERE sheet = ? AND is_closing_note = 1'
          ).bind(sheet).run();
          await db.prepare(
            'DELETE FROM entries WHERE sheet = ? AND category = ? AND month = ? AND year = ?'
          ).bind(nextSheet, 'balance carry-over', nextMonth, nextYear).run();
          await db.prepare(
            'DELETE FROM closed_months WHERE month = ? AND year = ?'
          ).bind(month, year).run();
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'addYear') {
          // No-op for D1 — month sheets are virtual
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'createSheet') {
          await db.prepare(
            'INSERT INTO custom_sheets (name) VALUES (?) ON CONFLICT(name) DO NOTHING'
          ).bind(body.name).run();
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'deleteSheet') {
          await db.prepare('DELETE FROM entries WHERE sheet = ?').bind(body.name).run();
          await db.prepare('DELETE FROM custom_sheets WHERE name = ?').bind(body.name).run();
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
