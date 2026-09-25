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
            IN YOUR ROTATION / {track.release_date.slice(0, 4)}
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
              TIME<b>{track.duration}</b>
            </span>
            <span>
              TEMPO<b>{track.bpm} BPM</b>
            </span>
          </div>
          <TrackActions track={track} />
          <div className={ui.actions}>
            <DownloadLink track={track} />
            <ConnectionLink root={'track:' + track.id} />
          </div>
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
          {[
            ['Energy', track.energy],
            ['Danceability', track.dance],
            ['Brightness', track.valence],
            ['Acoustic', track.acoustic],
          ].map(([label, value]) => (
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
