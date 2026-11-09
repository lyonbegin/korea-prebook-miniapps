"""Independent tables inside the existing Railway PostgreSQL service.
No data from unni_clone is changed or shared. This schema records public facts
and provenance, not private clinical or account data.
"""
SCHEMA = """
CREATE SCHEMA IF NOT EXISTS mydoctor_clone;
CREATE TABLE IF NOT EXISTS mydoctor_clone.source_records (
  source_key TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  page_kind TEXT NOT NULL,
  title TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_status INTEGER NOT NULL DEFAULT 200,
  origin TEXT NOT NULL DEFAULT 'https://my-doctor.io',
  rights_status TEXT NOT NULL DEFAULT 'public_metadata_only'
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.original_response_cache (
  cache_key TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  cache_control TEXT NOT NULL,
  raw_body BYTEA NOT NULL,
  size_bytes BIGINT NOT NULL,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.departments (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  original_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.symptoms (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  original_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.hospitals (
  original_hospital_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  original_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.hospital_price_items (
  original_hospital_id TEXT NOT NULL REFERENCES mydoctor_clone.hospitals(original_hospital_id),
  ordinal INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  price_text TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(original_hospital_id,ordinal)
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.medical_cost_categories (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  original_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mydoctor_clone.source_assets (
  source_key TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  license_status TEXT NOT NULL DEFAULT 'unverified',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mydoctor_records_kind ON mydoctor_clone.source_records(page_kind,fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_mydoctor_prices_item ON mydoctor_clone.hospital_price_items(item_name);
"""