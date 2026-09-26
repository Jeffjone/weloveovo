-- Owner-supplied dates; a year-only date preserves the unknown Demo Disc day.
BEGIN;
CREATE TABLE IF NOT EXISTS vault_entries (
 track_id text PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
 category text NOT NULL CHECK (category IN ('unreleased','leaked','snippet','freestyle')),
 note text NOT NULL,
 source_url text NOT NULL
);
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vault_entries FROM PUBLIC;
UPDATE releases SET release_date='2006' WHERE id='genius-album-516437';
UPDATE releases SET release_date='2006-02-14', featured=true WHERE id='genius-album-2625';
UPDATE releases SET release_date='2007-09-01', featured=true WHERE id='genius-album-2622';
UPDATE releases SET release_date='2009-09-15' WHERE id='genius-album-31785';
UPDATE releases SET release_date='2010-09-17' WHERE id='genius-album-348688';
UPDATE eras SET start_year=2006, body='Before the arena anthems, there was the mixtape feeling: intimate, restless, and full of possibility. Room for Improvement arrived on February 14, 2006, followed by Comeback Season on September 1, 2007. So Far Gone introduced a world where rap ambition and R&B vulnerability could share the same room. Thank Me Later brought that world into sharper focus.' WHERE id='the-introduction';
COMMIT;
