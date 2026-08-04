// =====================================================
// HOME BILLS — Cloudflare Worker
// Proxy + PIN auth + Supabase integration
// =====================================================

const SUPABASE_URL = 'https://yourproject.supabase.co';
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE'; // ← replace with your service_role key
const VALID_PIN    = 'your_app_PIN';

export default {
  async fetch(request) {

    // CORS preflight
    if (request.method === 'OPTIONS') return cors('', 204);

    // PIN check
    const pin = request.headers.get('X-App-Pin');
    if (pin !== VALID_PIN) return cors(JSON.stringify({ error: 'Unauthorized' }), 401);

    const url = new URL(request.url);

    try {
      if (request.method === 'GET') {
        const action = url.searchParams.get('action');

        if (action === 'getVersion') {
          return cors(JSON.stringify({ version: '3.0' }), 200);
        }

        if (action === 'getSheets') {
          // Get distinct years from entries + custom sheets
          const [yearsRes, sheetsRes] = await Promise.all([
            sbGet('/rest/v1/entries?select=year&order=year.asc'),
            sbGet('/rest/v1/custom_sheets?select=name&order=name.asc'),
          ]);
          const years = [...new Set((yearsRes || []).map(r => r.year))].sort();
          const customSheets = (sheetsRes || []).map(r => r.name);
          // Always include current year
          const curYear = new Date().getFullYear();
          if (!years.includes(curYear)) years.push(curYear);
          return cors(JSON.stringify({ years, customSheets }), 200);
        }

        if (action === 'getEntries') {
          const sheet = url.searchParams.get('sheet');
          const data = await sbGet(
            `/rest/v1/entries?sheet=eq.${encodeURIComponent(sheet)}&order=created_at.desc`
          );
          const entries = (data || []).map(row => ({
            rowIndex:      row.id,
            date:          row.date,
            desc:          row.description,
            cat:           row.category,
            who:           row.who,
            amount:        parseFloat(row.amount),
            isTransfer:    row.is_transfer,
            toWho:         row.to_who || '',
            month:         row.month,
            year:          row.year,
            isClosingNote: row.is_closing_note,
            sheet:         row.sheet,
          }));
          return cors(JSON.stringify({ entries }), 200);
        }

        if (action === 'getClosedMonths') {
          const data = await sbGet('/rest/v1/closed_months?select=*&order=year.asc,month.asc');
          const closedMonths = (data || []).map(row => ({
            month:     row.month,
            year:      row.year,
            aleksSpend: parseFloat(row.aleks_spend),
            ivanSpend:  parseFloat(row.ivan_spend),
            totalBills: parseFloat(row.total_bills),
            netDiff:    parseFloat(row.net_diff),
            settled:    row.settled,
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
          const data = await sbPost('/rest/v1/entries', {
            date:           e.date,
            description:    e.desc,
            category:       e.cat,
            who:            e.who,
            amount:         e.amount,
            is_transfer:    e.isTransfer || false,
            to_who:         e.toWho || '',
            month:          e.month,
            year:           e.year,
            sheet:          e.sheet,
            is_closing_note: e.isClosingNote || false,
          });
          return cors(JSON.stringify({ success: true, id: data?.[0]?.id }), 200);
        }

        if (action === 'deleteEntry') {
          await sbDelete(`/rest/v1/entries?id=eq.${body.rowIndex}`);
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'closeMonth') {
          const d = body.monthData;
          // Upsert — if month already closed, update it
          await sbUpsert('/rest/v1/closed_months', {
            month:       d.month,
            year:        d.year,
            aleks_spend: d.aleksSpend,
            ivan_spend:  d.ivanSpend,
            total_bills: d.totalBills,
            net_diff:    d.netDiff,
            settled:     d.settled,
            closed_at:   d.closedAt,
          });
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'reopenMonth') {
          const { month, year, nextMonth, nextYear } = body;
          const sheet = `${year} - ${month}`;
          const nextSheet = `${nextYear} - ${nextMonth}`;

          // 1. Delete closing note from this month
          await sbDelete(
            `/rest/v1/entries?sheet=eq.${encodeURIComponent(sheet)}&is_closing_note=eq.true`
          );

          // 2. Delete carry-over entry from next month
          await sbDelete(
            `/rest/v1/entries?sheet=eq.${encodeURIComponent(nextSheet)}&category=eq.balance carry-over&month=eq.${nextMonth}&year=eq.${nextYear}`
          );

          // 3. Remove from closed_months
          await sbDelete(`/rest/v1/closed_months?month=eq.${month}&year=eq.${year}`);

          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'addYear') {
          // No-op for Supabase — sheets are virtual (just entries with a sheet name)
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'createSheet') {
          await sbPost('/rest/v1/custom_sheets', { name: body.name });
          return cors(JSON.stringify({ success: true }), 200);
        }

        if (action === 'deleteSheet') {
          // Delete all entries for this sheet and the sheet record
          await sbDelete(`/rest/v1/entries?sheet=eq.${encodeURIComponent(body.name)}`);
          await sbDelete(`/rest/v1/custom_sheets?name=eq.${encodeURIComponent(body.name)}`);
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

// ── Supabase helpers ──────────────────────────────────
const SB_HEADERS = {
  'apikey':        '',  // set at runtime
  'Authorization': '',
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

function getHeaders() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };
}

async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + path, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase GET error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPost(path, body) {
  const res = await fetch(SUPABASE_URL + path, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbUpsert(path, body) {
  const res = await fetch(SUPABASE_URL + path, {
    method: 'POST',
    headers: { ...getHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbDelete(path) {
  const res = await fetch(SUPABASE_URL + path, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase DELETE error: ${res.status} ${await res.text()}`);
  return res.json().catch(() => null);
}

// ── CORS ──────────────────────────────────────────────
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
