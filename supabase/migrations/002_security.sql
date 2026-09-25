-- Hosted Supabase only. The public app uses server-side database queries.
create or replace function public.is_curator() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.curators where user_id=auth.uid()) $$;
revoke all on function public.is_curator() from public;
grant execute on function public.is_curator() to authenticated;
alter table releases enable row level security;
alter table artists enable row level security;
alter table tracks enable row level security;
alter table track_artists enable row level security;
alter table eras enable row level security;
alter table milestones enable row level security;
alter table connections enable row level security;
alter table audio_assets enable row level security;
alter table curators enable row level security;
alter table editorial_drafts enable row level security;
-- No anonymous table API access. All public reads go through validated application queries.
revoke all on releases,artists,tracks,track_artists,eras,milestones,connections,audio_assets,curators,editorial_drafts from anon,authenticated;
grant select on curators to authenticated;
drop policy if exists own_curator on curators;
create policy own_curator on curators for select to authenticated using(user_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('track-audio','track-audio',false,104857600,array['audio/mpeg']) on conflict(id) do update set public=false,file_size_limit=104857600,allowed_mime_types=array['audio/mpeg'];
-- Browser uploads use expiring signed upload tokens, never broad storage credentials.
-- No public storage policies are installed; service-side authorization issues individual tokens.
revoke all on function publish_audio(uuid) from public,anon,authenticated;
