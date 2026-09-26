-- Repair only the imported Genius metadata from clients that double-encoded JSON.
-- Original catalog rows and curator fields remain unchanged.
update tracks
set raw = (raw #>> '{}')::jsonb
where id ~ '^genius-[0-9]+$' and jsonb_typeof(raw) = 'string';
