create table if not exists releases (id text primary key, title text not null, release_date text not null, cover_url text, apple_url text, featured boolean not null default false);
create table if not exists artists (id text primary key, name text not null);
create table if not exists tracks (
 id text primary key, title text not null, release_id text not null references releases(id), duration text not null,
 bpm integer not null, musical_key text not null, energy integer not null, dance integer not null, valence integer not null,
 acoustic integer not null, popularity integer not null, explicit boolean not null, rank integer not null,
 raw jsonb not null, search_document tsvector
);
create table if not exists track_artists (track_id text references tracks(id) on delete cascade, artist_id text references artists(id), position integer not null, primary key(track_id,artist_id));
create index if not exists tracks_search_idx on tracks using gin(search_document);
create index if not exists tracks_release_idx on tracks(release_id);
create index if not exists credits_artist_idx on track_artists(artist_id);
create table if not exists eras (id text primary key, label text not null, title text not null, body text not null, start_year integer not null, end_year integer not null, release_id text references releases(id), track_id text references tracks(id), source_url text not null, published boolean not null default false, position integer not null);
create table if not exists milestones (id text primary key, title text not null, body text not null, year integer not null, era_id text references eras(id), source_url text not null, published boolean not null default false);
create table if not exists connections (id uuid primary key default gen_random_uuid(), source text not null, target text not null, label text not null default 'Connected', published boolean not null default false, unique(source,target), check(source <> target));
create table if not exists audio_assets (id uuid primary key default gen_random_uuid(), track_id text not null references tracks(id), object_path text unique not null, filename text not null, size_bytes bigint not null, status text not null default 'pending' check(status in ('pending','ready','published')), created_at timestamptz not null default now());
create unique index if not exists one_published_audio_per_track on audio_assets(track_id) where status='published';
create table if not exists curators (user_id uuid primary key);
create or replace function refresh_track_search() returns trigger language plpgsql as $$
begin
 update tracks t set search_document=to_tsvector('simple', t.title || ' ' || coalesce((select title from releases where id=t.release_id),'') || ' ' || coalesce((select string_agg(a.name,' ') from artists a join track_artists ta on ta.artist_id=a.id where ta.track_id=t.id),'')) where t.id=coalesce(new.track_id,old.track_id);
 return null;
end $$;
drop trigger if exists refresh_credits on track_artists;
create trigger refresh_credits after insert or update or delete on track_artists for each row execute function refresh_track_search();
create table if not exists editorial_drafts (kind text not null check(kind in ('eras','milestones','connections')), entity_id text not null, content jsonb not null, updated_at timestamptz not null default now(), primary key(kind,entity_id));
create or replace function publish_audio(asset_id uuid) returns void language plpgsql as $$
declare chosen_track text;
begin
 select track_id into chosen_track from audio_assets where id=asset_id and status in ('ready','published');
 if chosen_track is null then raise exception 'Audio is not verified'; end if;
 perform 1 from tracks where id=chosen_track for update;
 update audio_assets set status='ready' where track_id=chosen_track and status='published';
 update audio_assets set status='published' where id=asset_id;
end $$;
