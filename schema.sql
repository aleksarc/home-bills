-- =====================================================
-- HOME BILLS — Supabase Database Schema
-- Run this in Supabase SQL Editor (one-time setup)
-- =====================================================

-- ── Entries table ─────────────────────────────────────
CREATE TABLE entries (
  id            BIGSERIAL PRIMARY KEY,
  date          TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  who           TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_transfer   BOOLEAN NOT NULL DEFAULT FALSE,
  to_who        TEXT DEFAULT '',
  month         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  sheet         TEXT NOT NULL,
  is_closing_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Closed months table ───────────────────────────────
CREATE TABLE closed_months (
  id            BIGSERIAL PRIMARY KEY,
  month         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  aleks_spend   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ivan_spend    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_bills   NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_diff      NUMERIC(10,2) NOT NULL DEFAULT 0,
  settled       BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ── Custom sheets table ───────────────────────────────
CREATE TABLE custom_sheets (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────
-- Enable RLS on all tables (data is private by default)
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sheets ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by Cloudflare Worker)
-- The anon role has NO access — data is only accessible via the Worker + PIN
CREATE POLICY "service_role_all_entries" ON entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_closed" ON closed_months
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_sheets" ON custom_sheets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Indexes for performance ───────────────────────────
CREATE INDEX idx_entries_sheet ON entries(sheet);
CREATE INDEX idx_entries_year_month ON entries(year, month);
CREATE INDEX idx_closed_months_year_month ON closed_months(year, month);
