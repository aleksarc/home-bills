-- =====================================================
-- HOME BILLS — Cloudflare D1 Schema
-- Run this first in D1 console to create tables
-- =====================================================

CREATE TABLE IF NOT EXISTS entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  who           TEXT NOT NULL DEFAULT '',
  amount        REAL NOT NULL DEFAULT 0,
  is_transfer   INTEGER NOT NULL DEFAULT 0,
  to_who        TEXT NOT NULL DEFAULT '',
  month         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  sheet         TEXT NOT NULL,
  is_closing_note INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS closed_months (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  month         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  aleks_spend   REAL NOT NULL DEFAULT 0,
  ivan_spend    REAL NOT NULL DEFAULT 0,
  total_bills   REAL NOT NULL DEFAULT 0,
  net_diff      REAL NOT NULL DEFAULT 0,
  settled       INTEGER NOT NULL DEFAULT 0,
  closed_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS custom_sheets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_sheet ON entries(sheet);
CREATE INDEX IF NOT EXISTS idx_entries_year_month ON entries(year, month);
