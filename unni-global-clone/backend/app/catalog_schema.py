"""UNNI-only catalog schema in EXISTING Railway pgvector PostgreSQL.

Public factual category IDs are seeded; no copyrighted texts or private records.
Other tables remain empty until separately authorized live data acquisition.
"""
CATALOG_SCHEMA = """
CREATE SCHEMA IF NOT EXISTS unni_clone;

CREATE TABLE IF NOT EXISTS unni_clone.categories (
 category_id BIGINT PRIMARY KEY,
 parent_category_id BIGINT REFERENCES unni_clone.categories(category_id),
 name_en TEXT NOT NULL,
 source_path TEXT NOT NULL,
 source_updated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unni_clone.hospitals (
 original_hospital_id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 source_url TEXT NOT NULL,
 city TEXT,
 address TEXT,
 public_rating NUMERIC(4,2),
 public_review_count INTEGER,
 attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
 fetched_at TIMESTAMPTZ,
 rights_status TEXT NOT NULL DEFAULT 'metadata_only'
);

CREATE TABLE IF NOT EXISTS unni_clone.doctors (
 original_doctor_id TEXT PRIMARY KEY,
 original_hospital_id TEXT REFERENCES unni_clone.hospitals(original_hospital_id),
 display_name TEXT NOT NULL,
 source_url TEXT NOT NULL,
 public_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
 fetched_at TIMESTAMPTZ,
 rights_status TEXT NOT NULL DEFAULT 'metadata_only'
);

CREATE TABLE IF NOT EXISTS unni_clone.events (
 original_event_id TEXT PRIMARY KEY,
 original_hospital_id TEXT REFERENCES unni_clone.hospitals(original_hospital_id),
 public_title TEXT NOT NULL,
 source_url TEXT NOT NULL,
 public_rating NUMERIC(4,2),
 public_review_count INTEGER,
 min_price NUMERIC(15,2),
 currency TEXT NOT NULL DEFAULT 'USD',
 public_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
 fetched_at TIMESTAMPTZ,
 rights_status TEXT NOT NULL DEFAULT 'metadata_only'
);

CREATE TABLE IF NOT EXISTS unni_clone.event_categories (
 original_event_id TEXT NOT NULL REFERENCES unni_clone.events(original_event_id) ON DELETE CASCADE,
 category_id BIGINT NOT NULL REFERENCES unni_clone.categories(category_id),
 PRIMARY KEY(original_event_id, category_id)
);

CREATE TABLE IF NOT EXISTS unni_clone.event_options (
 source_option_key TEXT PRIMARY KEY,
 original_event_id TEXT NOT NULL REFERENCES unni_clone.events(original_event_id) ON DELETE CASCADE,
 original_option_id TEXT,
 display_order INTEGER NOT NULL,
 public_name TEXT NOT NULL,
 local_price NUMERIC(15,2),
 currency TEXT,
 public_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
 fetched_at TIMESTAMPTZ,
 rights_status TEXT NOT NULL DEFAULT 'metadata_only'
);

CREATE TABLE IF NOT EXISTS unni_clone.media_assets (
 asset_id BIGSERIAL PRIMARY KEY,
 entity_type TEXT NOT NULL,
 original_entity_id TEXT NOT NULL,
 source_url TEXT NOT NULL,
 license_status TEXT NOT NULL DEFAULT 'unverified',
 storage_path TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(entity_type, original_entity_id, source_url)
);

CREATE TABLE IF NOT EXISTS unni_clone.source_provenance (
 source_key TEXT PRIMARY KEY,
 entity_type TEXT NOT NULL,
 original_entity_id TEXT NOT NULL,
 canonical_url TEXT NOT NULL,
 reviewed_permission TEXT NOT NULL DEFAULT 'not_reviewed',
 observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_unni_event_hospital ON unni_clone.events(original_hospital_id);
CREATE INDEX IF NOT EXISTS idx_unni_options_event ON unni_clone.event_options(original_event_id);

INSERT INTO unni_clone.categories(category_id,name_en,source_path) VALUES
 (419,'Lifting','/us/events?q=Lifting&categoryId=419'),
 (411,'Skin','/us/events?q=Skin&categoryId=411'),
 (415,'Botox','/us/events?q=Botox&categoryId=415'),
 (416,'Filler','/us/events?q=Filler&categoryId=416'),
 (412,'Rhinoplasty','/us/events?q=Rhinoplasty&categoryId=412'),
 (413,'Eye','/us/events?q=Eye&categoryId=413'),
 (414,'Face Contour','/us/events?q=Face+Contour&categoryId=414'),
 (421,'Breast','/us/events?q=Breast&categoryId=421'),
 (422,'Body','/us/events?q=Body&categoryId=422'),
 (418,'Hair','/us/events?q=Hair&categoryId=418'),
 (537,'Hair Removal','/us/events?q=Hair+Removal&categoryId=537'),
 (417,'K-Med','/us/events?q=K-Med&categoryId=417'),
 (420,'Dental','/us/events?q=Dental&categoryId=420'),
 (423,'Others','/us/events?q=Others&categoryId=423')
ON CONFLICT(category_id) DO NOTHING;
"""
