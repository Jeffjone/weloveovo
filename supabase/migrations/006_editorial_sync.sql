BEGIN;
CREATE TABLE IF NOT EXISTS stories (
 id text PRIMARY KEY CHECK (id IN ('home','legacy')), title text NOT NULL, body text NOT NULL,
 source_url text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS song_notes (
 id text PRIMARY KEY REFERENCES tracks(id), title text NOT NULL, body text NOT NULL,
 source_url text NOT NULL, published boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS homepage_features (
 id text PRIMARY KEY CHECK (id IN ('records','eras','listening-room','legacy','vault')),
 release_id text NOT NULL REFERENCES releases(id), published boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS era_releases (
 id text PRIMARY KEY, era_id text NOT NULL REFERENCES eras(id), release_id text NOT NULL REFERENCES releases(id),
 position integer NOT NULL CHECK(position>=0), published boolean NOT NULL DEFAULT false, UNIQUE(era_id,release_id)
);
ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
ALTER TABLE editorial_drafts DROP CONSTRAINT IF EXISTS editorial_drafts_kind_check;
ALTER TABLE editorial_drafts ADD CONSTRAINT editorial_drafts_kind_check CHECK(kind IN ('eras','milestones','connections','stories','song_notes','homepage_features','era_releases','vault_entries'));
CREATE TABLE IF NOT EXISTS content_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, entity_id text NOT NULL,
 content jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS field_overrides (
 kind text NOT NULL, entity_id text NOT NULL, field text NOT NULL, value jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,entity_id,field)
);
CREATE TABLE IF NOT EXISTS source_songs (
 genius_id bigint PRIMARY KEY, track_id text REFERENCES tracks(id), snapshot jsonb,
 content_hash text, checked_at timestamptz, decision text NOT NULL DEFAULT 'review',
 decision_hash text, decision_reason text, missing boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS source_track_idx ON source_songs(track_id);
CREATE UNIQUE INDEX IF NOT EXISTS source_track_unique_idx ON source_songs(track_id) WHERE track_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS source_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), genius_id bigint NOT NULL REFERENCES source_songs(genius_id),
 track_id text REFERENCES tracks(id), kind text NOT NULL CHECK(kind IN ('new','link','metadata','unavailable')),
 content_hash text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
 decided_by text, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 UNIQUE(genius_id,content_hash,kind)
);
CREATE TABLE IF NOT EXISTS sync_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), automation_enabled boolean NOT NULL DEFAULT false,
 initialized boolean NOT NULL DEFAULT false, lease_owner uuid, lease_until timestamptz
);
INSERT INTO sync_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mode text NOT NULL CHECK(mode IN ('review','mixed')),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','paused','failed','complete')),
 next_page integer NOT NULL DEFAULT 1, discovery_complete boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 checked integer NOT NULL DEFAULT 0, error text
);
CREATE TABLE IF NOT EXISTS sync_items (
 run_id uuid NOT NULL REFERENCES sync_runs(id), genius_id bigint NOT NULL,
 done boolean NOT NULL DEFAULT false, PRIMARY KEY(run_id,genius_id)
);
CREATE TABLE IF NOT EXISTS catalog_write_lock (id boolean PRIMARY KEY DEFAULT true CHECK(id));
INSERT INTO catalog_write_lock VALUES(true) ON CONFLICT DO NOTHING;

-- Bootstrap once, without replacing curator edits on subsequent migrations.
INSERT INTO stories VALUES
 ('home','Welcome to the Other Side of Midnight',E'One city. A thousand memories.\nStep inside the sound, the stories, and the world of Drake.','',true),
 ('legacy','Some cities make artists. Some artists make you hear a city differently.',E'Drake’s story lives between confidence and confession. The rap verse and the melody. The hometown and the whole world. A catalog that can make an arena feel enormous — and a pair of headphones feel personal.\n\nToronto is the atmosphere: cold air, an after-hours glow, and a skyline that follows the music wherever it goes. Alongside Noah “40” Shebib and Oliver El-Khatib, the OVO collective carries that sensibility into a wider musical community.','https://music.apple.com/us/artist/drake/271256',true)
ON CONFLICT DO NOTHING;
INSERT INTO homepage_features(id,release_id,published)
 SELECT v.id,v.release_id,true FROM (VALUES ('records','take-care-deluxe'),('eras','nothing-was-the-same-deluxe'),('listening-room','views'),('legacy','scorpion'),('vault','dark-lane-demo-tapes')) v(id,release_id)
 JOIN releases r ON r.id=v.release_id ON CONFLICT DO NOTHING;
-- Persist existing curated shelf membership, including the intentional Demo Disc exception.
INSERT INTO era_releases(id,era_id,release_id,position,published)
 SELECT e.id||'--'||r.id,e.id,r.id,(row_number() OVER(PARTITION BY e.id ORDER BY r.release_date,r.title)-1)::int,true
 FROM eras e JOIN releases r ON nullif(left(r.release_date,4),'')::int BETWEEN e.start_year AND e.end_year
 WHERE r.featured OR r.id='genius-album-516437' ON CONFLICT DO NOTHING;
INSERT INTO source_songs(genius_id,track_id,decision)
 SELECT (raw->>'genius_id')::bigint,id,'linked' FROM tracks WHERE raw->>'genius_id' ~ '^[0-9]+$' ON CONFLICT DO NOTHING;
-- Existing release dates and local artwork are intentional catalog values, not sync-owned fields.
INSERT INTO field_overrides(kind,entity_id,field,value)
 SELECT 'releases',id,'release_date',to_jsonb(release_date) FROM releases WHERE release_date<>'' ON CONFLICT DO NOTHING;
INSERT INTO field_overrides(kind,entity_id,field,value)
 SELECT 'releases',id,'cover_url',to_jsonb(cover_url) FROM releases WHERE cover_url LIKE '/assets/%' ON CONFLICT DO NOTHING;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['stories','song_notes','homepage_features','era_releases','content_revisions','field_overrides','source_songs','source_changes','sync_settings','sync_runs','sync_items','catalog_write_lock','vault_entries'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',t); END IF;
 END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(name) VALUES ('001_catalog.sql'),('002_security.sql'),('003_external_catalog.sql'),('004_genius_metadata.sql'),('005_early_records_vault.sql'),('006_editorial_sync.sql') ON CONFLICT DO NOTHING;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON schema_migrations FROM PUBLIC;
COMMIT;
