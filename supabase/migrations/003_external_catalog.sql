-- External catalogs do not supply Spotify audio analysis or explicitness.
-- Preserve unknown values as NULL rather than fabricating measurements.
alter table tracks alter column duration drop not null;
alter table tracks alter column bpm drop not null;
alter table tracks alter column musical_key drop not null;
alter table tracks alter column energy drop not null;
alter table tracks alter column dance drop not null;
alter table tracks alter column valence drop not null;
alter table tracks alter column acoustic drop not null;
alter table tracks alter column popularity drop not null;
alter table tracks alter column explicit drop not null;
create unique index if not exists tracks_genius_id_idx on tracks ((raw->>'genius_id')) where raw->>'genius_id' is not null;
