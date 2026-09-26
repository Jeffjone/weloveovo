import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTrack, related } from '@/lib/catalog';
import { TrackActions } from '@/components/experience';
import { Cover, ConnectionLink, DownloadLink, TrackList, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getTrack((await params).id))?.title || 'Track not found' };
}
export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const track = await getTrack((await params).id);
  if (!track) notFound();
  const recommendations = await related(track.id);
  return (
    <div className={ui.container}>
      <nav className={ui.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Lobby</Link>
        <span>/</span>
        <Link href={'/records/' + track.release_id}>{track.release_title}</Link>
        <span>/</span>
        <span aria-current="page">{track.title}</span>
      </nav>
      <section className={ui.detail}>
        <Cover
          release={{ title: track.release_title, cover_url: track.cover_url }}
          className={ui.detailCover}
        />
        <div>
          <p className={ui.eyebrow}>
            IN YOUR ROTATION / {track.release_date.slice(0, 4) || 'Date unknown'}
            {track.explicit ? ' / EXPLICIT' : ''}
          </p>
          <h1>{track.title}</h1>
          <p>
            {track.artist_names.map((name, i) => (
              <span key={name}>
                {i > 0 ? ', ' : ''}
                <Link href={'/listening-room?artist=' + track.artist_ids[i]}>{name}</Link>
              </span>
            ))}
          </p>
          <div className={ui.metadata}>
            <span>
              RECORD
              <b>
                <Link href={'/records/' + track.release_id}>{track.release_title}</Link>
              </b>
            </span>
            <span>
              TIME<b>{track.duration || 'Unknown'}</b>
            </span>
            <span>
              TEMPO<b>{track.bpm === null ? 'Unknown' : `${track.bpm} BPM`}</b>
            </span>
          </div>
          <TrackActions track={track} />
          <div className={ui.actions}>
            <DownloadLink track={track} />
            <ConnectionLink root={'track:' + track.id} />
          </div>
        </div>
      </section>
      <section className={ui.narrative} aria-labelledby="song-file-heading">
        <div>
          <p className={ui.eyebrow}>
            THE SONG FILE / {track.release_date.slice(0, 4) || 'Date unknown'}
          </p>
          <h2 id="song-file-heading">Inside this song.</h2>
          <Link className={ui.outlineButton} href="/games">
            Test your catalog knowledge ↗
          </Link>
        </div>
        <div>
          <p>
            “{track.title}”{' '}
            {track.release_id === 'genius-unassigned' ? 'is filed under' : 'appears on'}{' '}
            <Link href={'/records/' + track.release_id}>{track.release_title}</Link>. The collection
            {track.release_date
              ? `dates this edition to ${track.release_date}`
              : 'does not have a confirmed release date for this edition'}
            . Its credited performers are {track.artist_names.join(', ')}.
          </p>
          {track.bpm !== null &&
          track.energy !== null &&
          track.dance !== null &&
          track.acoustic !== null ? (
            <p>
              At {track.duration || 'Unknown'}, the track is cataloged at{' '}
              {track.bpm === null ? 'Unknown' : `${track.bpm} BPM`} in {track.musical_key}. Its
              audio profile pairs an energy score of {track.energy}/100 with danceability of{' '}
              {track.dance}/100 and acoustic character of {track.acoustic}/100. Use those traits to
              follow a similar sound in the recommendations below.
            </p>
          ) : (
            <p>
              Audio measurements and duration are not available from this catalog source. Explore
              the credited artists and record for more context.
            </p>
          )}
          <p className={ui.subtle}>
            These notes describe the supplied catalog metadata and this release edition.
          </p>
          {track.source_release_date && (
            <p>Genius lists this recording’s release date as {track.source_release_date}.</p>
          )}
          {track.genius_url && (
            <a
              className={ui.source}
              href={track.genius_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Song metadata on Genius ↗
            </a>
          )}
          {track.apple_url && (
            <a
              className={ui.source}
              href={track.apple_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore the release on Apple Music ↗
            </a>
          )}
        </div>
      </section>
      <div className={ui.narrative}>
        <div>
          <p className={ui.eyebrow}>THE FEEL OF THE TRACK</p>
          <h2>
            There’s a reason
            <br />
            you keep coming back.
          </h2>
        </div>
        <div className={ui.featureBars}>
          {track.energy === null && <p>Audio profile unavailable.</p>}
          {[
            ['Energy', track.energy],
            ['Danceability', track.dance],
            ['Brightness', track.valence],
            ['Acoustic', track.acoustic],
          ]
            .filter(([, value]) => value !== null)
            .map(([label, value]) => (
              <div className={ui.feature} key={label}>
                <span>{label}</span>
                <span aria-hidden="true">
                  <i style={{ width: value + '%' }} />
                </span>
                <b>{value}</b>
              </div>
            ))}
        </div>
      </div>
      <div className={ui.sectionBar}>
        <h2>Stay in this feeling</h2>
        <span>RELATED BY SOUND & SHARED CREDITS</span>
      </div>
      {recommendations.map((item) => (
        <div key={item.track.id}>
          <p className={ui.subtle}>{item.reason}</p>
          <TrackList tracks={[item.track]} />
        </div>
      ))}
    </div>
  );
}
