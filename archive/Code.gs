// =====================================================
// HOME BILLS TRACKER — Google Apps Script Backend
// Paste this entire file into your Apps Script editor
// then run setupSpreadsheet() once to create all sheets
// =====================================================

// ── VERSION: 2.0 ─────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CLOSED_SHEET_NAME = '_ClosedMonths';

// Column order for every data sheet
const COLS = { DATE:0, DESC:1, CAT:2, WHO:3, AMOUNT:4, IS_TRANSFER:5, TO_WHO:6, MONTH:7, YEAR:8, IS_CLOSING_NOTE:9 };

// Sheet name helpers
function monthSheet(year, month) { return year + ' - ' + month; }
function isMonthSheet(name) { return /^\d{4} - /.test(name); }
function sheetYear(name) { return parseInt(name.split(' - ')[0]); }
function sheetMonth(name) { return name.split(' - ').slice(1).join(' - '); }

// ── Router ───────────────────────────────────────────
function doGet(e) {
  try {
    const a = e.parameter.action;
    if (a === 'getEntries')      return json(getEntries(e.parameter.sheet));
    if (a === 'getSheets')       return json(getSheets());
    if (a === 'getClosedMonths') return json(getClosedMonths());
    if (a === 'getVersion')      return json({ version: '2.0' });
    return json({ error: 'Unknown action: ' + a });
  } catch(err) { return json({ error: err.message }); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'addEntry')    return json(addEntry(b.entry));
    if (b.action === 'deleteEntry') return json(deleteEntry(b.sheet, b.rowIndex));
    if (b.action === 'closeMonth')  return json(saveClosedMonth(b.monthData));
    if (b.action === 'createSheet') return json(createCustomSheet(b.name));
    if (b.action === 'deleteSheet') return json(deleteCustomSheet(b.name));
    if (b.action === 'addYear')     return json(addYear(parseInt(b.year)));
    return json({ error: 'Unknown action: ' + b.action });
  } catch(err) { return json({ error: err.message }); }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Read entries ─────────────────────────────────────
function getEntries(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { entries: [] };
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { entries: [] };
  const entries = rows.slice(1).map((row, i) => ({
    rowIndex:      i + 2,
    date:          row[COLS.DATE],
    desc:          row[COLS.DESC],
    cat:           row[COLS.CAT],
    who:           row[COLS.WHO],
    amount:        parseFloat(row[COLS.AMOUNT]) || 0,
    isTransfer:    row[COLS.IS_TRANSFER] === true || row[COLS.IS_TRANSFER] === 'TRUE',
    toWho:         row[COLS.TO_WHO] || '',
    month:         row[COLS.MONTH],
    year:          row[COLS.YEAR],
    isClosingNote: row[COLS.IS_CLOSING_NOTE] === true || row[COLS.IS_CLOSING_NOTE] === 'TRUE',
    sheet:         sheetName,
  })).reverse();
  return { entries };
}

// ── Add entry ────────────────────────────────────────
function addEntry(entry) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(entry.sheet);
  if (!sheet) sheet = makeSheet(entry.sheet);
  sheet.appendRow([
    entry.date, entry.desc, entry.cat, entry.who,
    entry.amount, entry.isTransfer, entry.toWho || '',
    entry.month, entry.year, entry.isClosingNote || false
  ]);
  return { success: true };
}

// ── Delete entry ─────────────────────────────────────
function deleteEntry(sheetName, rowIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found' };
  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ── Close month ──────────────────────────────────────
function saveClosedMonth(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CLOSED_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CLOSED_SHEET_NAME);
    sheet.appendRow(['Month','Year','AleksSpend','IvanSpend','TotalBills','NetDiff','Settled','ClosedAt']);
    sheet.hideSheet();
  }
  sheet.appendRow([
    data.month, data.year, data.aleksSpend, data.ivanSpend,
    data.totalBills, data.netDiff, data.settled, data.closedAt
  ]);
  return { success: true };
}

// ── Get closed months ────────────────────────────────
function getClosedMonths() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLOSED_SHEET_NAME);
  if (!sheet) return { closedMonths: [] };
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { closedMonths: [] };
  return {
    closedMonths: rows.slice(1).map(r => ({
      month: r[0], year: r[1], aleksSpend: r[2], ivanSpend: r[3],
      totalBills: r[4], netDiff: r[5], settled: r[6], closedAt: r[7]
    }))
  };
}

// ── List all sheets ───────────────────────────────────
function getSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = ss.getSheets().map(s => s.getName());
  const yearSet = new Set();
  const customSheets = [];

  names.forEach(function(n) {
    // Year-prefixed month sheet: "2026 - January" etc
    if (/^\d{4} - /.test(n)) {
      yearSet.add(parseInt(n.split(' - ')[0]));
    } else if (n !== CLOSED_SHEET_NAME && MONTHS.indexOf(n) === -1) {
      // Not a plain month name and not the closed log = custom sheet
      customSheets.push(n);
    }
    // Plain month names (old sheets) are silently ignored
  });

  const years = Array.from(yearSet).sort();
  return { years: years, customSheets: customSheets };
}

// ── Add a full year of month sheets ──────────────────
function addYear(year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  MONTHS.forEach(m => {
    const name = monthSheet(year, m);
    if (!ss.getSheetByName(name)) { makeSheet(name); created.push(name); }
  });
  return { success: true, created };
}

// ── Create / delete custom sheet ─────────────────────
function createCustomSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(name)) return { error: 'Sheet already exists' };
  makeSheet(name);
  return { success: true };
}

function deleteCustomSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return { error: 'Sheet not found' };
  ss.deleteSheet(sheet);
  return { success: true };
}

// ── Helper: create a sheet with header row ────────────
function makeSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.insertSheet(name);
  const header = ['Date','Description','Category','Who','Amount','IsTransfer','ToWho','Month','Year','IsClosingNote'];
  sheet.appendRow(header);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#f3f3f3');
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 120); sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 90);
  return sheet;
}

// ── One-time setup ────────────────────────────────────
// Run this manually once from the Apps Script editor
function setupSpreadsheet() {
  const year = new Date().getFullYear();
  addYear(year);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch(e) {}
  }
  SpreadsheetApp.getUi().alert('Setup complete! ' + year + ' month sheets created.');
}
